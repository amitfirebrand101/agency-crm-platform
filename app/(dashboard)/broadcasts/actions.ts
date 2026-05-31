"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twilioConfigured, sendSms } from "@/lib/twilio";
import { emailConfigured, sendEmail } from "@/lib/email";

export async function createBroadcast(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    console.error("createBroadcast: authentication failed");
    return;
  }

  if (!user.subAccountId) return;

  const schema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(200),
    channel: z.enum(["SMS", "Email"]),
    subject: z.string().trim().max(500).optional(),
    body: z.string().trim().min(1, "Body is required.").max(10000),
  });

  const parsed = schema.safeParse({
    name: formData.get("name"),
    channel: formData.get("channel"),
    subject: formData.get("subject") || undefined,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    console.error("createBroadcast: validation failed", parsed.error.issues[0]?.message);
    return;
  }

  const { name, channel, subject, body } = parsed.data;

  try {
    await prisma.broadcast.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        name,
        channel,
        subject: subject || null,
        body,
        status: "draft",
      },
    });
  } catch (err) {
    console.error("createBroadcast: failed", err);
    return;
  }

  revalidatePath("/broadcasts");
}

export async function deleteBroadcast(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    console.error("deleteBroadcast: authentication failed");
    return;
  }

  if (!user.subAccountId) return;

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) return;

  try {
    const existing = await prisma.broadcast.findFirst({
      where: { id: idParsed.data, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    if (!existing) return;
    await prisma.broadcast.delete({ where: { id: idParsed.data } });
  } catch (err) {
    console.error("deleteBroadcast: failed", err);
    return;
  }

  revalidatePath("/broadcasts");
}

export async function sendBroadcast(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    console.error("sendBroadcast: authentication failed");
    return;
  }

  if (!user.subAccountId) return;

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) return;

  let broadcast: Awaited<ReturnType<typeof prisma.broadcast.findFirst>>;
  try {
    broadcast = await prisma.broadcast.findFirst({
      where: { id: idParsed.data, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
  } catch (err) {
    console.error("sendBroadcast: db lookup failed", err);
    return;
  }

  if (!broadcast || broadcast.status !== "draft") return;

  if (broadcast.channel === "SMS" && !twilioConfigured()) {
    console.error("sendBroadcast: Twilio not configured");
    return;
  }
  if (broadcast.channel === "Email" && !emailConfigured()) {
    console.error("sendBroadcast: SMTP not configured");
    return;
  }

  const contacts = await prisma.contact.findMany({
    where: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      ...(broadcast.channel === "SMS"
        ? { smsOptOut: false, phone: { not: null } }
        : { emailOptOut: false, email: { not: null } }),
    },
    select: { id: true, phone: true, email: true },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const contact of contacts) {
    try {
      if (broadcast.channel === "SMS" && contact.phone) {
        await sendSms(contact.phone, broadcast.body);
      } else if (broadcast.channel === "Email" && contact.email) {
        await sendEmail({
          to: contact.email,
          subject: broadcast.subject ?? broadcast.name,
          text: broadcast.body,
        });
      }
      sentCount++;
    } catch (err) {
      console.error(`sendBroadcast: failed for contact ${contact.id}`, err);
      failedCount++;
    }
  }

  try {
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: {
        status: "sent",
        sentCount,
        failedCount,
        recipientCount: contacts.length,
      },
    });
  } catch (err) {
    console.error("sendBroadcast: failed to update broadcast status", err);
  }

  revalidatePath("/broadcasts");
}

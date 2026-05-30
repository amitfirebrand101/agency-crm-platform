"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createBroadcast(formData: FormData): Promise<{ error: string } | undefined> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { error: "Authentication required." };
  }

  if (!user.subAccountId) {
    return { error: "A sub-account is required to create a broadcast." };
  }

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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
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
    return { error: `Failed to create broadcast: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/broadcasts");
}

export async function deleteBroadcast(formData: FormData): Promise<{ error: string } | undefined> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { error: "Authentication required." };
  }

  if (!user.subAccountId) {
    return { error: "A sub-account is required to delete a broadcast." };
  }

  const idParsed = z.string().uuid("Invalid broadcast ID.").safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) {
    return { error: idParsed.error.issues[0]?.message ?? "Invalid broadcast ID." };
  }

  try {
    const existing = await prisma.broadcast.findFirst({
      where: { id: idParsed.data, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    if (!existing) {
      return { error: "Broadcast not found or access denied." };
    }
    await prisma.broadcast.delete({ where: { id: idParsed.data } });
  } catch (err) {
    return { error: `Failed to delete broadcast: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/broadcasts");
}

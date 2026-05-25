"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";
import { sendSms, twilioConfigured } from "@/lib/twilio";
import { sendEmail, emailConfigured } from "@/lib/email";

async function requireConversationAccess(conversationId: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage conversations.");
  }
  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    include: { contact: { select: { phone: true, email: true, firstName: true, lastName: true } } },
  });
  return { user, conversation };
}

export async function sendMessage(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const { conversation } = await requireConversationAccess(conversationId);
  const input = messageSchema.parse(Object.fromEntries(formData));

  let twilioSid: string | null = null;
  let smtpMessageId: string | null = null;

  // Route outbound messages to real providers
  if (input.direction === "outbound") {
    if (conversation.channel === "SMS") {
      if (!twilioConfigured()) {
        throw new Error(
          "SMS provider not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to your environment."
        );
      }
      const toPhone = conversation.contact?.phone;
      if (!toPhone) throw new Error("Contact has no phone number for SMS delivery.");
      try {
        twilioSid = await sendSms(toPhone, input.body);
      } catch (err) {
        throw new Error(`SMS delivery failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (conversation.channel === "EMAIL") {
      if (!emailConfigured()) {
        throw new Error(
          "Email provider not configured. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to your environment."
        );
      }
      const toEmail = conversation.contact?.email;
      if (!toEmail) throw new Error("Contact has no email address for email delivery.");
      try {
        smtpMessageId = await sendEmail({
          to: toEmail,
          subject: conversation.subject ?? "(no subject)",
          text: input.body,
        });
      } catch (err) {
        throw new Error(`Email delivery failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body: input.body,
      direction: input.direction,
      twilioSid,
      smtpMessageId,
    },
  });

  // Update conversation updatedAt and status back to OPEN if it was CLOSED
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date(), ...(conversation.status === "CLOSED" ? { status: "OPEN" } : {}) },
  });

  revalidatePath("/conversations");
  revalidatePath(`/conversations/${conversationId}`);
}

export async function updateConversationStatus(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const status = z.enum(["OPEN", "PENDING", "CLOSED"]).parse(String(formData.get("status") ?? ""));
  const { user, conversation } = await requireConversationAccess(conversationId);

  await prisma.conversation.update({
    where: { id: conversation.id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    data: { status },
  });

  revalidatePath("/conversations");
  revalidatePath(`/conversations/${conversationId}`);
}

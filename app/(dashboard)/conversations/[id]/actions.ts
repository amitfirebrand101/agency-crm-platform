"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";

async function requireConversationAccess(conversationId: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage conversations.");
  }
  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined }
  });
  return { user, conversation };
}

export async function sendMessage(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const { conversation } = await requireConversationAccess(conversationId);
  const input = messageSchema.parse(Object.fromEntries(formData));

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body: input.body,
      direction: input.direction
    }
  });

  revalidatePath(`/conversations/${conversation.id}`);
}

export async function updateConversationStatus(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const status = z.enum(["OPEN", "PENDING", "CLOSED"]).parse(String(formData.get("status") ?? ""));
  const { user, conversation } = await requireConversationAccess(conversationId);

  await prisma.conversation.update({
    where: { id: conversation.id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    data: { status }
  });

  revalidatePath(`/conversations/${conversation.id}`);
  revalidatePath("/conversations");
}

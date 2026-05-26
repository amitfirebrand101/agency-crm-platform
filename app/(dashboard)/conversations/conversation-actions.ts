"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireConvAccess(conversationId: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage conversations.");
  }
  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId! },
  });
  return { user, conversation };
}

// ── Unread ────────────────────────────────────────────────────────────────────

export async function markConversationRead(conversationId: string) {
  const { user } = await requireConvAccess(conversationId);
  await prisma.conversation.update({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { unread: false },
  });
  revalidatePath("/conversations");
}

export async function markConversationUnread(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const { user } = await requireConvAccess(conversationId);
  await prisma.conversation.update({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { unread: true },
  });
  revalidatePath("/conversations");
  redirect("/conversations");
}

// ── Priority ──────────────────────────────────────────────────────────────────

const prioritySchema = z.enum(["normal", "high", "urgent"]);

export async function setConversationPriority(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const priority = prioritySchema.parse(String(formData.get("priority") ?? "normal"));
  const { user } = await requireConvAccess(conversationId);
  await prisma.conversation.update({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { priority },
  });
  revalidatePath("/conversations");
}

// ── Labels ────────────────────────────────────────────────────────────────────

export async function addConversationLabel(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const label = z.string().min(1).max(50).parse(String(formData.get("label") ?? "").trim());
  const { user, conversation } = await requireConvAccess(conversationId);
  if (!conversation.labels.includes(label)) {
    await prisma.conversation.update({
      where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId! },
      data: { labels: { push: label } },
    });
  }
  revalidatePath("/conversations");
}

export async function removeConversationLabel(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const { user, conversation } = await requireConvAccess(conversationId);
  await prisma.conversation.update({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { labels: conversation.labels.filter((l) => l !== label) },
  });
  revalidatePath("/conversations");
}

// ── Assignment ────────────────────────────────────────────────────────────────

export async function assignConversation(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const rawUserId = String(formData.get("assignedUserId") ?? "").trim();
  const assignedUserId = rawUserId === "" ? null : z.string().uuid().parse(rawUserId);
  const { user } = await requireConvAccess(conversationId);

  // If assignedUserId is set, verify user belongs to this sub-account
  if (assignedUserId) {
    const member = await prisma.subAccountMembership.findFirst({
      where: { subAccountId: user.subAccountId!, userId: assignedUserId },
    });
    if (!member) throw new Error("User is not a member of this sub-account.");
  }

  await prisma.conversation.update({
    where: { id: conversationId, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { assignedUserId },
  });
  revalidatePath("/conversations");
}

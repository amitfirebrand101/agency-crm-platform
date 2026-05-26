"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSubAccountWrite() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage conversations.");
  }
  return user;
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => z.string().uuid().safeParse(s).success);
}

export async function bulkCloseConversations(formData: FormData) {
  const user = await requireSubAccountWrite();
  const ids = parseIds(String(formData.get("ids") ?? ""));
  if (ids.length === 0) return;

  await prisma.conversation.updateMany({
    where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { status: "CLOSED" },
  });

  revalidatePath("/conversations");
}

export async function bulkAssignConversations(formData: FormData) {
  const user = await requireSubAccountWrite();
  const ids = parseIds(String(formData.get("ids") ?? ""));
  const rawUserId = String(formData.get("assignedUserId") ?? "").trim();
  const assignedUserId = rawUserId === "" ? null : z.string().uuid().parse(rawUserId);

  if (ids.length === 0) return;

  if (assignedUserId) {
    const member = await prisma.subAccountMembership.findFirst({
      where: { subAccountId: user.subAccountId!, userId: assignedUserId },
    });
    if (!member) throw new Error("User is not a member of this sub-account.");
  }

  await prisma.conversation.updateMany({
    where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { assignedUserId },
  });

  revalidatePath("/conversations");
}

export async function bulkDeleteConversations(formData: FormData) {
  const user = await requireSubAccountWrite();
  const ids = parseIds(String(formData.get("ids") ?? ""));
  if (ids.length === 0) return;

  await prisma.conversation.deleteMany({
    where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId! },
  });

  revalidatePath("/conversations");
}

export async function bulkMarkRead(formData: FormData) {
  const user = await requireSubAccountWrite();
  const ids = parseIds(String(formData.get("ids") ?? ""));
  if (ids.length === 0) return;

  await prisma.conversation.updateMany({
    where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { unread: false },
  });

  revalidatePath("/conversations");
}

export async function bulkMarkUnread(formData: FormData) {
  const user = await requireSubAccountWrite();
  const ids = parseIds(String(formData.get("ids") ?? ""));
  if (ids.length === 0) return;

  await prisma.conversation.updateMany({
    where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId! },
    data: { unread: true },
  });

  revalidatePath("/conversations");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";

const idsSchema = z.array(z.string().uuid()).min(1).max(500);

async function requireWriteAccess() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("Permission denied.");
  }
  return user as typeof user & { subAccountId: string };
}

async function verifyContactsOwnership(user: { agencyId: string; subAccountId: string }, ids: string[]) {
  const count = await prisma.contact.count({
    where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  if (count !== ids.length) throw new Error("Some contacts were not found or access denied.");
}

export async function bulkAddTag(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireWriteAccess();
    const ids = idsSchema.parse(JSON.parse(String(formData.get("ids") ?? "[]")));
    const tagId = z.string().uuid().parse(String(formData.get("tagId") ?? ""));
    await verifyContactsOwnership(user, ids);

    const tag = await prisma.tag.findFirstOrThrow({
      where: { id: tagId, agencyId: user.agencyId },
    });

    await prisma.contactTag.createMany({
      data: ids.map((contactId) => ({ contactId, tagId: tag.id })),
      skipDuplicates: true,
    });

    await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", metadata: { bulkAction: "addTag", tagId, count: ids.length } });
    revalidatePath("/contacts");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

export async function bulkRemoveTag(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireWriteAccess();
    const ids = idsSchema.parse(JSON.parse(String(formData.get("ids") ?? "[]")));
    const tagId = z.string().uuid().parse(String(formData.get("tagId") ?? ""));
    await verifyContactsOwnership(user, ids);

    await prisma.contactTag.deleteMany({ where: { contactId: { in: ids }, tagId } });
    await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", metadata: { bulkAction: "removeTag", tagId, count: ids.length } });
    revalidatePath("/contacts");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

export async function bulkUpdateStatus(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireWriteAccess();
    const ids = idsSchema.parse(JSON.parse(String(formData.get("ids") ?? "[]")));
    const status = z.enum(["LEAD", "CUSTOMER", "INACTIVE"]).parse(String(formData.get("status") ?? ""));
    await verifyContactsOwnership(user, ids);

    await prisma.contact.updateMany({
      where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId },
      data: { status },
    });
    await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", metadata: { bulkAction: "updateStatus", status, count: ids.length } });
    revalidatePath("/contacts");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

export async function bulkDelete(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireWriteAccess();
    const ids = idsSchema.parse(JSON.parse(String(formData.get("ids") ?? "[]")));
    await verifyContactsOwnership(user, ids);

    await prisma.contact.deleteMany({
      where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "Contact", metadata: { bulkAction: "delete", count: ids.length } });
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

export async function bulkAssignUser(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireWriteAccess();
    const ids = idsSchema.parse(JSON.parse(String(formData.get("ids") ?? "[]")));
    const assignedUserId = String(formData.get("assignedUserId") ?? "");
    await verifyContactsOwnership(user, ids);

    await prisma.contact.updateMany({
      where: { id: { in: ids }, agencyId: user.agencyId, subAccountId: user.subAccountId },
      data: { assignedUserId: assignedUserId || null },
    });
    await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", metadata: { bulkAction: "assignUser", assignedUserId, count: ids.length } });
    revalidatePath("/contacts");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

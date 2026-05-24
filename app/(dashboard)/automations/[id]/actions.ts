"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import type { AutomationDefinition } from "@/lib/automations/types";

async function requireAccess(automationId: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to edit this workflow.");
  }
  const automation = await prisma.automation.findFirstOrThrow({
    where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId }
  });
  return { user: user as typeof user & { subAccountId: string }, automation };
}

export async function saveDefinition(automationId: string, definition: AutomationDefinition) {
  z.string().uuid().parse(automationId);
  const { user } = await requireAccess(automationId);
  await prisma.automation.update({
    where: { id: automationId },
    data: { definition: definition as object }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automationId });
  revalidatePath(`/automations/${automationId}`);
  revalidatePath("/automations");
}

export async function renameWorkflow(automationId: string, name: string) {
  z.string().uuid().parse(automationId);
  const trimmed = z.string().trim().min(1).max(120).parse(name);
  const { user } = await requireAccess(automationId);
  await prisma.automation.update({ where: { id: automationId }, data: { name: trimmed } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automationId, metadata: { name: trimmed } });
  revalidatePath(`/automations/${automationId}`);
  revalidatePath("/automations");
}

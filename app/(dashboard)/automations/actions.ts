"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAutomation } from "@/lib/automations/executor";
import { emptyAutomationDefinition, parseAutomationDefinition } from "@/lib/automations/types";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";

async function requireAutomationAccess(automationId?: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage automations.");
  }
  if (!automationId) return { user, automation: null };
  const automation = await prisma.automation.findFirstOrThrow({
    where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId }
  });
  return { user, automation };
}

async function requireExistingAutomation(automationId: string) {
  const { user, automation } = await requireAutomationAccess(automationId);
  if (!automation) throw new Error("Automation not found.");
  return { user: user as typeof user & { subAccountId: string }, automation };
}

export async function createWorkflow(formData: FormData) {
  const { user } = await requireAutomationAccess();
  const subAccountId = user.subAccountId!;
  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName.length >= 2 ? rawName : "Untitled Workflow";
  const automation = await prisma.automation.create({
    data: { agencyId: user.agencyId, subAccountId, name, definition: emptyAutomationDefinition }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Automation", entityId: automation.id });
  redirect(`/automations/${automation.id}`);
}

export async function deleteWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user } = await requireExistingAutomation(automationId);
  await prisma.automation.delete({ where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "Automation", entityId: automationId });
  revalidatePath("/automations");
  redirect("/automations");
}

export async function publishWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  const definition = parseAutomationDefinition(automation.definition);
  if (!definition.triggers.length || !definition.steps.length) {
    throw new Error("Add at least one trigger and one action before publishing.");
  }
  await prisma.automation.update({ where: { id: automation.id }, data: { status: "published" } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automation.id, metadata: { status: "published" } });
  revalidatePath("/automations");
  revalidatePath(`/automations/${automationId}`);
}

export async function unpublishWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  await prisma.automation.update({ where: { id: automation.id }, data: { status: "draft" } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automation.id, metadata: { status: "draft" } });
  revalidatePath("/automations");
  revalidatePath(`/automations/${automationId}`);
}

export async function runTestWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  await runAutomation({
    automationId: automation.id,
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: contactId || null,
    actorUserId: user.id,
    triggerType: "CONTACT_CREATED",
    payload: { test: true }
  });
  revalidatePath(`/automations/${automationId}`);
}

export async function duplicateWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  const copy = await prisma.automation.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: `${automation.name} (copy)`,
      definition: automation.definition ?? emptyAutomationDefinition,
      status: "draft"
    }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Automation", entityId: copy.id });
  revalidatePath("/automations");
  redirect(`/automations/${copy.id}`);
}

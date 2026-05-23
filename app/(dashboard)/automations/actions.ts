"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionCatalog, actionLabels, triggerCatalog, triggerLabels } from "@/lib/automations/catalog";
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

  if (!automationId) {
    return { user, automation: null };
  }

  const automation = await prisma.automation.findFirstOrThrow({
    where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId }
  });

  return { user, automation };
}

async function requireExistingAutomation(automationId: string) {
  const { user, automation } = await requireAutomationAccess(automationId);

  if (!automation) {
    throw new Error("Automation not found.");
  }

  return { user: user as typeof user & { subAccountId: string }, automation };
}

export async function createWorkflow(formData: FormData) {
  const { user } = await requireAutomationAccess();
  const subAccountId = user.subAccountId;
  if (!subAccountId) {
    throw new Error("A sub account is required.");
  }
  const input = z.object({ name: z.string().trim().min(2).max(120) }).parse(Object.fromEntries(formData));

  const automation = await prisma.automation.create({
    data: {
      agencyId: user.agencyId,
      subAccountId,
      name: input.name,
      definition: emptyAutomationDefinition
    }
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Automation", entityId: automation.id });
  revalidatePath("/automations");
  redirect(`/automations?workflow=${automation.id}`);
}

export async function addTrigger(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  const input = z
    .object({
      type: z.enum(triggerCatalog.map((item) => item.type) as [string, ...string[]]),
      filter: z.string().trim().max(160).optional()
    })
    .parse(Object.fromEntries(formData));
  const definition = parseAutomationDefinition(automation.definition);
  const type = input.type as keyof typeof triggerLabels;

  definition.triggers.push({
    id: randomUUID(),
    type,
    name: triggerLabels[type],
    config:
      type === "CONTACT_TAG" && input.filter
        ? { tagName: input.filter }
        : type === "INBOUND_WEBHOOK"
          ? { token: randomUUID() }
          : {}
  });

  await prisma.automation.update({ where: { id: automation.id }, data: { definition } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automation.id });
  revalidatePath("/automations");
}

export async function addAction(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  const input = z
    .object({
      type: z.enum(actionCatalog.map((item) => item.type) as [string, ...string[]]),
      primary: z.string().trim().max(160).optional(),
      secondary: z.string().trim().max(160).optional()
    })
    .parse(Object.fromEntries(formData));
  const definition = parseAutomationDefinition(automation.definition);
  const type = input.type as keyof typeof actionLabels;

  const config: Record<string, string> = {};
  if (type === "ADD_CONTACT_TAG" || type === "REMOVE_CONTACT_TAG") {
    config.tagName = input.primary || "";
  } else if (type === "UPDATE_CONTACT_FIELD") {
    config.field = input.primary || "source";
    config.value = input.secondary || "";
  } else if (type === "CREATE_CONVERSATION") {
    config.subject = input.primary || "Automation conversation";
    config.channel = input.secondary || "SMS";
  } else if (type === "CREATE_OPPORTUNITY") {
    config.name = input.primary || "Automation opportunity";
    config.value = input.secondary || "0";
  } else if (type === "WAIT") {
    config.duration = input.primary || "5";
    config.unit = input.secondary || "minutes";
  } else if (type === "CREATE_CONTACT") {
    config.email = input.primary || "";
    config.firstName = input.secondary || "New";
  }

  definition.steps.push({
    id: randomUUID(),
    type,
    name: actionLabels[type],
    config
  });

  await prisma.automation.update({ where: { id: automation.id }, data: { definition } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automation.id });
  revalidatePath("/automations");
}

export async function publishWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  const definition = parseAutomationDefinition(automation.definition);

  if (!definition.triggers.length || !definition.steps.length) {
    throw new Error("A workflow needs at least one trigger and one action before publishing.");
  }

  await prisma.automation.update({ where: { id: automation.id }, data: { status: "published" } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automation.id, metadata: { status: "published" } });
  revalidatePath("/automations");
}

export async function unpublishWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);

  await prisma.automation.update({ where: { id: automation.id }, data: { status: "draft" } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Automation", entityId: automation.id, metadata: { status: "draft" } });
  revalidatePath("/automations");
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
    payload: { test: true }
  });

  revalidatePath("/automations");
}

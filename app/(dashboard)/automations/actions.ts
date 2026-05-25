"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { validateDefinition, parseDefinition } from "@/lib/automations/schema";
import { emptyAutomationDefinition } from "@/lib/automations/types";
import { testWorkflow, cancelEnrollment, retryRun, resumeEnrollment } from "@/lib/automations/engine";

// ── Access guard ──────────────────────────────────────────────────────────────

async function requireAutomationAccess(automationId?: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage automations.");
  }
  if (!automationId) return { user, automation: null };
  const automation = await prisma.automation.findFirstOrThrow({
    where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  return { user, automation };
}

async function requireExistingAutomation(automationId: string) {
  const { user, automation } = await requireAutomationAccess(automationId);
  if (!automation) throw new Error("Automation not found.");
  return { user: user as typeof user & { subAccountId: string }, automation };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createWorkflow(formData: FormData) {
  const { user } = await requireAutomationAccess();
  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName.length >= 2 ? rawName : "Untitled Workflow";
  const automation = await prisma.automation.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId!,
      name,
      definition: emptyAutomationDefinition,
    },
  });
  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Automation",
    entityId: automation.id,
  });
  redirect(`/automations/${automation.id}`);
}

export async function deleteWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user } = await requireExistingAutomation(automationId);
  await prisma.automation.delete({
    where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "DELETE",
    entityType: "Automation",
    entityId: automationId,
  });
  revalidatePath("/automations");
  redirect("/automations");
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
      status: "draft",
    },
  });
  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Automation",
    entityId: copy.id,
  });
  revalidatePath("/automations");
  redirect(`/automations/${copy.id}`);
}

// ── Publish / unpublish ───────────────────────────────────────────────────────

export async function publishWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);

  const definition = parseDefinition(automation.definition);
  const { valid, errors } = validateDefinition(definition);
  if (!valid) {
    throw new Error(`Cannot publish: ${errors[0]}`);
  }

  // Create immutable version snapshot
  const lastVersion = await prisma.automationVersion.findFirst({
    where: { automationId: automation.id },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  await prisma.$transaction([
    prisma.automationVersion.create({
      data: {
        automationId: automation.id,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
        name: automation.name,
        definition: automation.definition as object,
        status: "PUBLISHED",
        createdById: user.id,
        publishedAt: new Date(),
      },
    }),
    // Archive any previously published versions
    prisma.automationVersion.updateMany({
      where: {
        automationId: automation.id,
        status: "PUBLISHED",
        // exclude the one we just created by using the old versionNumber
        versionNumber: { lte: lastVersion?.versionNumber ?? 0 },
      },
      data: { status: "ARCHIVED" },
    }),
    prisma.automation.update({
      where: { id: automation.id },
      data: { status: "published" },
    }),
  ]);

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "UPDATE",
    entityType: "Automation",
    entityId: automation.id,
    metadata: { status: "published" },
  });
  revalidatePath("/automations");
  revalidatePath(`/automations/${automationId}`);
}

export async function unpublishWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const { user, automation } = await requireExistingAutomation(automationId);
  await prisma.automation.update({ where: { id: automation.id }, data: { status: "draft" } });
  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "UPDATE",
    entityType: "Automation",
    entityId: automation.id,
    metadata: { status: "draft" },
  });
  revalidatePath("/automations");
  revalidatePath(`/automations/${automationId}`);
}

// ── Test run ──────────────────────────────────────────────────────────────────

export async function runTestWorkflow(formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const contactId = String(formData.get("contactId") ?? "") || null;
  const { user } = await requireExistingAutomation(automationId);
  await testWorkflow(
    automationId,
    user.agencyId,
    user.subAccountId,
    contactId,
    { test: true, source: "manual-test" }
  );
  revalidatePath(`/automations/${automationId}/runs`);
  revalidatePath(`/automations/${automationId}`);
}

// ── Enrollment management ─────────────────────────────────────────────────────

export async function cancelWorkflowEnrollment(formData: FormData) {
  const enrollmentId = z.string().uuid().parse(String(formData.get("enrollmentId") ?? ""));
  const automationId = z.string().uuid().parse(String(formData.get("automationId") ?? ""));
  const { user } = await requireExistingAutomation(automationId);
  const { cancelled, error } = await cancelEnrollment(
    enrollmentId,
    user.agencyId,
    user.subAccountId
  );
  if (!cancelled) throw new Error(error ?? "Failed to cancel enrollment.");
  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "UPDATE",
    entityType: "AutomationEnrollment",
    entityId: enrollmentId,
    metadata: { action: "cancel" },
  });
  revalidatePath(`/automations/${automationId}/runs`);
}

export async function resumeWorkflowEnrollment(formData: FormData) {
  const enrollmentId = z.string().uuid().parse(String(formData.get("enrollmentId") ?? ""));
  const automationId = z.string().uuid().parse(String(formData.get("automationId") ?? ""));
  const { user } = await requireExistingAutomation(automationId);
  const { resumed, error } = await resumeEnrollment(
    enrollmentId,
    user.agencyId,
    user.subAccountId
  );
  if (!resumed) throw new Error(error ?? "Failed to resume enrollment.");
  revalidatePath(`/automations/${automationId}/runs`);
}

// ── Run management ────────────────────────────────────────────────────────────

export async function retryWorkflowRun(formData: FormData) {
  const runId = z.string().uuid().parse(String(formData.get("runId") ?? ""));
  const automationId = z.string().uuid().parse(String(formData.get("automationId") ?? ""));
  const { user } = await requireExistingAutomation(automationId);
  const { retried, error } = await retryRun(runId, user.agencyId, user.subAccountId);
  if (!retried) throw new Error(error ?? "Failed to retry run.");
  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "UPDATE",
    entityType: "AutomationRun",
    entityId: runId,
    metadata: { action: "retry" },
  });
  revalidatePath(`/automations/${automationId}/runs`);
}

/**
 * Durable workflow engine — enrollment → run → step tracking.
 *
 * WAIT step semantics:
 *   An enrollment is set to WAITING with a resumeAt timestamp.
 *   No external queue is required: a Vercel Cron job at /api/cron/automations/resume
 *   polls for due enrollments every minute (configure in vercel.json).
 *   For production at scale, swap the resume scheduler with Inngest, Trigger.dev,
 *   Upstash QStash, or BullMQ/Redis.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDefinition, validateDefinition } from "@/lib/automations/schema";
import type { WorkflowDefinition, StepNode } from "@/lib/automations/schema";
import { executeStep, type StepContext } from "@/lib/automations/steps";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TriggerEvent = {
  type: string;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

type RunPassResult = {
  status: "completed" | "failed" | "waiting";
  error?: string;
  resumeAt?: Date | null;
  resumeSteps?: StepNode[];
  stepResults: Array<{
    stepId: string;
    stepName: string;
    stepType: string;
    status: string;
    output?: Record<string, unknown>;
    error?: string;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ── Event ledger ──────────────────────────────────────────────────────────────

export async function emitAutomationEvent(event: TriggerEvent): Promise<void> {
  try {
    await prisma.automationEvent.create({
      data: {
        agencyId: event.agencyId,
        subAccountId: event.subAccountId,
        type: event.type,
        source: "crm",
        contactId: event.contactId ?? null,
        payload: (event.payload ?? {}) as Prisma.InputJsonValue,
        idempotencyKey: event.idempotencyKey ?? null,
      },
    });
  } catch {
    // Non-fatal — tables may not be migrated yet
  }
}

// ── Trigger matching ──────────────────────────────────────────────────────────

function triggerMatchesEvent(def: WorkflowDefinition, event: TriggerEvent): boolean {
  return def.triggers.some((t) => {
    if (t.type !== event.type) return false;
    if (
      (t.type === "CONTACT_TAG" || t.type === "CONTACT_TAG_REMOVED") &&
      t.config.tagName
    ) {
      return event.payload?.tagName === t.config.tagName;
    }
    if (t.type === "OPPORTUNITY_STATUS" && t.config.status) {
      return event.payload?.status === t.config.status;
    }
    if (t.type === "APPOINTMENT_STATUS" && t.config.status) {
      return event.payload?.status === t.config.status;
    }
    return true;
  });
}

// ── Step run recording ────────────────────────────────────────────────────────

async function recordStepRun(
  runId: string,
  enrollmentId: string | null,
  automationId: string,
  agencyId: string,
  subAccountId: string,
  step: StepNode,
  result: { status: string; output?: Record<string, unknown>; error?: string }
) {
  try {
    await prisma.automationStepRun.create({
      data: {
        runId,
        enrollmentId,
        automationId,
        agencyId,
        subAccountId,
        stepId: step.id,
        stepType: step.type,
        stepName: step.name,
        status: result.status,
        input: {} as Prisma.InputJsonValue,
        output: result.output ? (result.output as Prisma.InputJsonValue) : undefined,
        error: result.error ? { message: result.error } as Prisma.InputJsonValue : undefined,
        startedAt: new Date(),
        endedAt: new Date(),
      },
    });
  } catch {
    // Non-fatal
  }
}

// ── Core step execution pass ──────────────────────────────────────────────────

async function runSteps(
  steps: StepNode[],
  startIdx: number,
  ctx: StepContext,
  runId: string,
  enrollmentId: string | null,
  automationId: string
): Promise<RunPassResult> {
  const stepResults: RunPassResult["stepResults"] = [];
  let mutableContactId = ctx.contactId;

  for (let i = startIdx; i < steps.length; i++) {
    const step = steps[i];
    const stepCtx: StepContext = { ...ctx, contactId: mutableContactId };

    // IF_ELSE — execute branch inline
    if (step.type === "IF_ELSE") {
      const condResult = await executeStep(step, stepCtx);
      await recordStepRun(runId, enrollmentId, automationId, ctx.agencyId, ctx.subAccountId, step, {
        status: condResult.status,
        output: condResult.output,
      });
      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: condResult.status,
        output: condResult.output,
      });
      if (condResult.status !== "COMPLETED") continue;

      const conditionMet = condResult.output?.conditionMet as boolean;
      const branch = conditionMet
        ? ((step.trueBranch ?? []) as StepNode[])
        : ((step.falseBranch ?? []) as StepNode[]);

      if (branch.length > 0) {
        const branchPath = [...branch, ...steps.slice(i + 1)];
        const branchResult = await runSteps(branchPath, 0, stepCtx, runId, enrollmentId, automationId);
        stepResults.push(...branchResult.stepResults);
        if (branchResult.status === "failed") return { status: "failed", error: branchResult.error, stepResults };
        if (branchResult.status === "waiting") {
          return {
            status: "waiting",
            resumeAt: branchResult.resumeAt ?? null,
            resumeSteps: branchResult.resumeSteps ?? [],
            stepResults,
          };
        }
        return { status: "completed", stepResults };
      }
      continue;
    }

    // All other steps
    let result: Awaited<ReturnType<typeof executeStep>>;
    try {
      result = await executeStep(step, stepCtx);
    } catch (err) {
      result = { status: "FAILED", error: `Unexpected error: ${String(err)}` };
    }

    // Propagate new contactId if step created one
    if (result.contactId) mutableContactId = result.contactId;

    const output =
      result.status === "WAITING"
        ? {
            ...(result.output ?? {}),
            resumeAt: result.resumeAt?.toISOString() ?? null,
            resumeSteps: steps.slice(i + 1),
          }
        : result.output;

    await recordStepRun(runId, enrollmentId, automationId, ctx.agencyId, ctx.subAccountId, step, {
      status: result.status,
      output,
      error: result.error,
    });

    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      status: result.status,
      output,
      error: result.error,
    });

    if (result.status === "WAITING" || result.status === "WAITING_TEST") {
      return {
        status: result.status === "WAITING_TEST" ? "completed" : "waiting",
        resumeAt: result.resumeAt ?? null,
        resumeSteps: steps.slice(i + 1),
        stepResults,
        error: undefined,
      };
    }

    if (result.status === "FAILED" && ctx.isTestRun !== true) {
      return { status: "failed", error: result.error, stepResults };
    }
  }

  return { status: "completed", stepResults };
}

// ── Enrollment + run creation ─────────────────────────────────────────────────

async function createRun(
  automationId: string,
  enrollmentId: string | null,
  versionId: string | null,
  agencyId: string,
  subAccountId: string,
  contactId: string | null | undefined,
  triggerType: string,
  payload: Record<string, unknown>
): Promise<string> {
  const run = await prisma.automationRun.create({
    data: {
      automationId,
      enrollmentId,
      versionId,
      agencyId,
      subAccountId,
      contactId: contactId ?? null,
      status: "RUNNING",
      triggerType,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  return run.id;
}

async function finalizeRun(
  runId: string,
  status: "COMPLETED" | "FAILED" | "WAITING",
  error?: string
) {
  try {
    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status,
        completedAt: status !== "WAITING" ? new Date() : undefined,
        error: error ?? null,
      },
    });
  } catch {
    // Non-fatal
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runAutomationsForEvent(event: TriggerEvent): Promise<void> {
  // Emit to event ledger (best-effort)
  await emitAutomationEvent(event);

  let automations: Array<{
    id: string;
    definition: unknown;
    status: string;
    name: string;
    versions?: Array<{ id: string; status: string }>;
  }> = [];

  try {
    automations = await prisma.automation.findMany({
      where: {
        agencyId: event.agencyId,
        subAccountId: event.subAccountId,
        status: "published",
      },
      select: {
        id: true,
        definition: true,
        status: true,
        name: true,
        versions: {
          where: { status: "PUBLISHED" },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });
  } catch {
    return;
  }

  for (const automation of automations) {
    const def = parseDefinition(automation.definition);
    if (!triggerMatchesEvent(def, event)) continue;

    // Idempotency — scope by second to deduplicate burst events
    const epochSecond = Math.floor(Date.now() / 1000);
    const idempotencyKey = `${automation.id}:${event.type}:${event.contactId ?? "none"}:${epochSecond}`;

    try {
      await enrollAndRun({
        automationId: automation.id,
        versionId: automation.versions?.[0]?.id ?? null,
        agencyId: event.agencyId,
        subAccountId: event.subAccountId,
        contactId: event.contactId,
        triggerType: event.type,
        payload: event.payload ?? {},
        idempotencyKey,
        definition: def,
      });
    } catch (err) {
      console.error(`[engine] enrollment failed for automation ${automation.id}:`, err);
    }
  }
}

export async function enrollAndRun(input: {
  automationId: string;
  versionId: string | null;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  triggerType: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  definition: WorkflowDefinition;
  isTestRun?: boolean;
}): Promise<RunPassResult> {
  const { definition } = input;

  // Idempotency check (skip for test runs)
  if (!input.isTestRun) {
    try {
      const existing = await prisma.automationEnrollment.findUnique({
        where: {
          idempotencyKey_subAccountId: {
            idempotencyKey: input.idempotencyKey,
            subAccountId: input.subAccountId,
          },
        },
      });
      if (existing) {
        return { status: "completed", stepResults: [], error: undefined };
      }
    } catch {
      // Table not migrated — proceed without idempotency
    }
  }

  // Create enrollment
  let enrollmentId: string | null = null;
  if (!input.isTestRun && input.versionId) {
    try {
      const enrollment = await prisma.automationEnrollment.create({
        data: {
          automationId: input.automationId,
          versionId: input.versionId,
          agencyId: input.agencyId,
          subAccountId: input.subAccountId,
          contactId: input.contactId ?? null,
          eventKey: input.triggerType,
          triggerType: input.triggerType,
          status: "ACTIVE",
          context: (input.payload ?? {}) as Prisma.InputJsonValue,
          idempotencyKey: input.idempotencyKey,
        },
      });
      enrollmentId = enrollment.id;
    } catch {
      // Table not migrated — continue without enrollment tracking
    }
  }

  // Create run
  let runId: string;
  try {
    runId = await createRun(
      input.automationId,
      enrollmentId,
      input.versionId,
      input.agencyId,
      input.subAccountId,
      input.contactId,
      input.triggerType,
      input.payload
    );
  } catch {
    // AutomationRun table might not be migrated
    runId = "no-run";
  }

  const ctx: StepContext = {
    automationId: input.automationId,
    agencyId: input.agencyId,
    subAccountId: input.subAccountId,
    runId,
    contactId: input.contactId,
    payload: input.payload,
    isTestRun: input.isTestRun,
  };

  const result = await runSteps(definition.steps as StepNode[], 0, ctx, runId, enrollmentId, input.automationId);

  // Finalize run
  if (runId !== "no-run") {
    if (result.status === "waiting") {
      const waitResult = result.stepResults.find((r) => r.status === "WAITING");
      const resumeAt = result.resumeAt ?? asDate(waitResult?.output?.resumeAt);
      const waitingContext = {
        ...(input.payload ?? {}),
        __automationResumeSteps: result.resumeSteps ?? [],
      };

      await finalizeRun(runId, "WAITING");

      if (enrollmentId) {
        const waitingStep = result.stepResults.find((r) => r.status === "WAITING");
        try {
          await prisma.automationEnrollment.update({
            where: { id: enrollmentId },
            data: {
              status: "WAITING",
              currentStepId: waitingStep?.stepId ?? null,
              resumeAt: resumeAt ?? null,
              context: waitingContext as Prisma.InputJsonValue,
            },
          });
        } catch { /* non-fatal */ }
      }
    } else if (result.status === "failed") {
      await finalizeRun(runId, "FAILED", result.error);
      if (enrollmentId) {
        try {
          await prisma.automationEnrollment.update({
            where: { id: enrollmentId },
            data: { status: "FAILED", completedAt: new Date() },
          });
        } catch { /* non-fatal */ }
      }
    } else {
      await finalizeRun(runId, "COMPLETED");
      if (enrollmentId) {
        try {
          await prisma.automationEnrollment.update({
            where: { id: enrollmentId },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
        } catch { /* non-fatal */ }
      }
    }
  }

  return result;
}

export async function resumeEnrollment(
  enrollmentId: string,
  agencyId: string,
  subAccountId: string
): Promise<{ resumed: boolean; error?: string }> {
  let enrollment: {
    id: string;
    automationId: string;
    versionId: string;
    contactId: string | null;
    currentStepId: string | null;
    context: unknown;
    status: string;
  } | null = null;

  try {
    enrollment = await prisma.automationEnrollment.findFirst({
      where: { id: enrollmentId, agencyId, subAccountId, status: "WAITING" },
    });
  } catch {
    return { resumed: false, error: "Database unavailable." };
  }

  if (!enrollment) return { resumed: false, error: "Enrollment not found or not in WAITING state." };

  // Load version definition
  let definition: WorkflowDefinition | null = null;
  try {
    const version = await prisma.automationVersion.findFirst({
      where: { id: enrollment.versionId },
    });
    if (version) definition = parseDefinition(version.definition);
  } catch { /* non-fatal */ }

  if (!definition) {
    // Fallback: load live automation definition
    try {
      const automation = await prisma.automation.findFirst({ where: { id: enrollment.automationId } });
      if (automation) definition = parseDefinition(automation.definition);
    } catch { /* non-fatal */ }
  }

  if (!definition) return { resumed: false, error: "Could not load workflow definition." };

  const context = asRecord(enrollment.context);
  const resumeStepsCandidate = context.__automationResumeSteps;
  const resumeSteps =
    Array.isArray(resumeStepsCandidate)
      ? (resumeStepsCandidate as StepNode[])
      : null;
  const steps = resumeSteps ?? (definition.steps as StepNode[]);
  const startIdx = resumeSteps ? 0 : (() => {
    const waitIdx = enrollment.currentStepId
      ? steps.findIndex((s) => s.id === enrollment.currentStepId)
      : -1;
    return waitIdx >= 0 ? waitIdx + 1 : 0;
  })();

  if (startIdx >= steps.length) {
    // Nothing left — mark completed
    try {
      await prisma.automationEnrollment.update({
        where: { id: enrollmentId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    } catch { /* non-fatal */ }
    return { resumed: true };
  }

  // Mark enrollment as active again
  try {
    await prisma.automationEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "ACTIVE", resumeAt: null, currentStepId: null },
    });
  } catch { /* non-fatal */ }

  const payloadContext = { ...context };
  delete payloadContext.__automationResumeSteps;

  let runId: string;
  try {
    runId = await createRun(
      enrollment.automationId,
      enrollmentId,
      enrollment.versionId,
      agencyId,
      subAccountId,
      enrollment.contactId,
      "RESUME",
      payloadContext
    );
  } catch {
    runId = "no-run";
  }

  const ctx: StepContext = {
    automationId: enrollment.automationId,
    agencyId,
    subAccountId,
    runId,
    contactId: enrollment.contactId,
    payload: payloadContext,
  };

  const result = await runSteps(steps, startIdx, ctx, runId, enrollmentId, enrollment.automationId);

  if (runId !== "no-run") {
    if (result.status === "waiting") {
      await finalizeRun(runId, "WAITING");
      const waitStep = result.stepResults.find((r) => r.status === "WAITING");
      const nextContext = {
        ...payloadContext,
        __automationResumeSteps: result.resumeSteps ?? [],
      };
      try {
        await prisma.automationEnrollment.update({
          where: { id: enrollmentId },
          data: {
            status: "WAITING",
            currentStepId: waitStep?.stepId ?? null,
            resumeAt: result.resumeAt ?? asDate(waitStep?.output?.resumeAt),
            context: nextContext as Prisma.InputJsonValue,
          },
        });
      } catch { /* non-fatal */ }
    } else if (result.status === "failed") {
      await finalizeRun(runId, "FAILED", result.error);
      try {
        await prisma.automationEnrollment.update({
          where: { id: enrollmentId },
          data: { status: "FAILED", completedAt: new Date() },
        });
      } catch { /* non-fatal */ }
    } else {
      await finalizeRun(runId, "COMPLETED");
      try {
        await prisma.automationEnrollment.update({
          where: { id: enrollmentId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      } catch { /* non-fatal */ }
    }
  }

  return { resumed: true };
}

export async function cancelEnrollment(
  enrollmentId: string,
  agencyId: string,
  subAccountId: string
): Promise<{ cancelled: boolean; error?: string }> {
  try {
    const enrollment = await prisma.automationEnrollment.findFirst({
      where: {
        id: enrollmentId,
        agencyId,
        subAccountId,
        status: { in: ["ACTIVE", "WAITING"] },
      },
    });
    if (!enrollment) return { cancelled: false, error: "Enrollment not found or already completed." };

    await prisma.automationEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    // Also mark any associated waiting runs as cancelled
    await prisma.automationRun.updateMany({
      where: { enrollmentId, status: "WAITING" },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    return { cancelled: true };
  } catch (err) {
    return { cancelled: false, error: String(err) };
  }
}

export async function retryRun(
  runId: string,
  agencyId: string,
  subAccountId: string
): Promise<{ retried: boolean; newRunId?: string; error?: string }> {
  try {
    const run = await prisma.automationRun.findFirst({
      where: { id: runId, agencyId, subAccountId, status: "FAILED" },
    });
    if (!run) return { retried: false, error: "Run not found or not in FAILED state." };

    const automation = await prisma.automation.findFirst({
      where: { id: run.automationId, agencyId, subAccountId },
    });
    if (!automation) return { retried: false, error: "Automation not found." };

    const definition = parseDefinition(automation.definition);
    const validation = validateDefinition(definition);
    if (!validation.valid) {
      return { retried: false, error: `Workflow validation failed: ${validation.errors[0]}` };
    }

    const idempotencyKey = `retry:${runId}:${Date.now()}`;
    const result = await enrollAndRun({
      automationId: run.automationId,
      versionId: run.versionId,
      agencyId,
      subAccountId,
      contactId: run.contactId,
      triggerType: run.triggerType,
      payload: (run.payload ?? {}) as Record<string, unknown>,
      idempotencyKey,
      definition,
    });

    return { retried: true, error: result.error };
  } catch (err) {
    return { retried: false, error: String(err) };
  }
}

export async function testWorkflow(
  automationId: string,
  agencyId: string,
  subAccountId: string,
  contactId?: string | null,
  payload?: Record<string, unknown>
): Promise<RunPassResult> {
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, agencyId, subAccountId },
  });
  if (!automation) return { status: "failed", error: "Automation not found.", stepResults: [] };

  const definition = parseDefinition(automation.definition);

  return enrollAndRun({
    automationId,
    versionId: null,
    agencyId,
    subAccountId,
    contactId,
    triggerType: definition.triggers[0]?.type ?? "CONTACT_CREATED",
    payload: payload ?? { test: true },
    idempotencyKey: `test:${automationId}:${Date.now()}`,
    definition,
    isTestRun: true,
  });
}

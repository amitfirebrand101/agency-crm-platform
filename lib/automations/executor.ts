import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeWebhookFetch } from "@/lib/automations/ssrf-guard";
import { parseAutomationDefinition, type AutomationDefinition, type AutomationStep } from "@/lib/automations/types";
import type { AutomationTriggerType } from "@/lib/automations/catalog";

type AutomationEvent = {
  type: AutomationTriggerType;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  payload?: Record<string, unknown>;
};

type ExecutionContext = AutomationEvent & {
  automationId: string;
  runId: string;
  actorUserId?: string | null;
};

type StepResult = {
  status: string;
  output?: Record<string, unknown>;
  error?: string;
};

function triggerMatches(definition: AutomationDefinition, event: AutomationEvent) {
  return definition.triggers.some((trigger) => {
    if (trigger.type !== event.type) return false;
    if (trigger.type === "CONTACT_TAG" && trigger.config.tagName) {
      return event.payload?.tagName === trigger.config.tagName;
    }
    if (trigger.type === "OPPORTUNITY_STATUS" && trigger.config.status) {
      return event.payload?.status === trigger.config.status;
    }
    return true;
  });
}

async function getOrCreateTag(input: { agencyId: string; subAccountId: string; name: string }) {
  const existing = await prisma.tag.findFirst({
    where: { agencyId: input.agencyId, subAccountId: input.subAccountId, name: input.name }
  });
  if (existing) return existing;
  return prisma.tag.create({
    data: { agencyId: input.agencyId, subAccountId: input.subAccountId, name: input.name }
  });
}

async function evaluateCondition(context: ExecutionContext, step: AutomationStep): Promise<boolean> {
  const { conditionType, field, value, tagName } = step.config;

  if (conditionType === "always.true") return true;
  if (conditionType === "always.false") return false;
  if (!context.contactId) return false;

  if (conditionType === "contact.field.equals") {
    const contact = await prisma.contact.findUnique({ where: { id: context.contactId } });
    if (!contact) return false;
    const fieldValue = (contact as Record<string, unknown>)[field ?? ""];
    return String(fieldValue ?? "") === (value ?? "");
  }

  if (conditionType === "contact.hasTag") {
    const tag = await prisma.tag.findFirst({ where: { name: tagName, agencyId: context.agencyId } });
    if (!tag) return false;
    const ct = await prisma.contactTag.findUnique({
      where: { contactId_tagId: { contactId: context.contactId, tagId: tag.id } }
    });
    return ct !== null;
  }

  if (conditionType === "contact.status.is") {
    const contact = await prisma.contact.findUnique({ where: { id: context.contactId } });
    return contact?.status === value;
  }

  return false;
}

async function executeStep(step: AutomationStep, context: ExecutionContext): Promise<StepResult> {
  if (step.type === "WAIT") {
    return {
      status: "deferred",
      output: { duration: step.config.duration ?? "5", unit: step.config.unit ?? "minutes" }
    };
  }

  if (step.type === "IF_ELSE") {
    const conditionMet = await evaluateCondition(context, step);
    const branch = conditionMet ? (step.trueBranch ?? []) : (step.falseBranch ?? []);
    const branchResults = [];
    for (const branchStep of branch) {
      const result = await executeStep(branchStep, context);
      branchResults.push({ stepId: branchStep.id, stepType: branchStep.type, ...result });
    }
    return {
      status: "branched",
      output: { conditionMet, branch: conditionMet ? "true" : "false", steps: branchResults }
    };
  }

  if (step.type === "OUTBOUND_WEBHOOK") {
    const url = step.config.url;
    if (!url) return { status: "skipped", error: "Missing webhook URL." };
    try {
      const result = await safeWebhookFetch(url, {
        automationId: context.automationId,
        contactId: context.contactId,
        triggerType: context.type,
        payload: context.payload
      });
      return {
        status: result.ok ? "sent" : "failed",
        output: { httpStatus: result.status, responseBody: result.body }
      };
    } catch (err) {
      return { status: "failed", error: String(err) };
    }
  }

  if (step.type === "CREATE_CONTACT") {
    const email = step.config.email || String(context.payload?.email ?? "");
    const firstName = step.config.firstName || String(context.payload?.firstName ?? "New");
    const lastName = step.config.lastName || String(context.payload?.lastName ?? "");
    const contact = await prisma.contact.create({
      data: {
        agencyId: context.agencyId,
        subAccountId: context.subAccountId,
        firstName,
        lastName: lastName || null,
        email: email || null,
        source: "Automation"
      }
    });
    context.contactId = contact.id;
    return { status: "created", output: { entityType: "Contact", entityId: contact.id } };
  }

  if (!context.contactId) {
    return { status: "skipped", error: "Step requires a contact context." };
  }

  if (step.type === "UPDATE_CONTACT_FIELD") {
    const allowedFields = new Set(["firstName", "lastName", "email", "phone", "companyName", "source", "timezone"]);
    const field = step.config.field;
    const value = step.config.value;
    if (!field || !allowedFields.has(field)) return { status: "skipped", error: "Unsupported contact field." };
    await prisma.contact.update({
      where: { id: context.contactId, agencyId: context.agencyId, subAccountId: context.subAccountId },
      data: { [field]: value } as Prisma.ContactUpdateInput
    });
    return { status: "updated", output: { field, value } };
  }

  if (step.type === "ADD_CONTACT_TAG") {
    const name = step.config.tagName;
    if (!name) return { status: "skipped", error: "Missing tag name." };
    const tag = await getOrCreateTag({ agencyId: context.agencyId, subAccountId: context.subAccountId, name });
    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: context.contactId!, tagId: tag.id } },
      update: {},
      create: { contactId: context.contactId!, tagId: tag.id }
    });
    return { status: "tagged", output: { tagId: tag.id, tagName: name } };
  }

  if (step.type === "REMOVE_CONTACT_TAG") {
    const name = step.config.tagName;
    if (!name) return { status: "skipped", error: "Missing tag name." };
    const tag = await prisma.tag.findFirst({ where: { agencyId: context.agencyId, subAccountId: context.subAccountId, name } });
    if (!tag) return { status: "skipped", error: "Tag not found." };
    await prisma.contactTag.deleteMany({ where: { contactId: context.contactId!, tagId: tag.id } });
    return { status: "untagged", output: { tagName: name } };
  }

  if (step.type === "CREATE_CONVERSATION") {
    const channel = (["EMAIL", "CALL", "VOICEMAIL", "INTERNAL_NOTE"].includes(step.config.channel ?? "")
      ? step.config.channel
      : "SMS") as "SMS" | "EMAIL" | "CALL" | "VOICEMAIL" | "INTERNAL_NOTE";
    const conversation = await prisma.conversation.create({
      data: {
        agencyId: context.agencyId,
        subAccountId: context.subAccountId,
        contactId: context.contactId,
        channel,
        subject: step.config.subject || "Automation conversation"
      }
    });
    return { status: "created", output: { entityType: "Conversation", entityId: conversation.id } };
  }

  if (step.type === "CREATE_OPPORTUNITY") {
    const stage = await prisma.pipelineStage.findFirst({
      where: { pipeline: { agencyId: context.agencyId, subAccountId: context.subAccountId } },
      orderBy: { position: "asc" }
    });
    if (!stage) return { status: "skipped", error: "No pipeline stage found. Create a pipeline first." };
    const opportunity = await prisma.opportunity.create({
      data: {
        agencyId: context.agencyId,
        subAccountId: context.subAccountId,
        contactId: context.contactId,
        stageId: stage.id,
        name: step.config.name || "Automation opportunity",
        valueCents: Math.round(Number(step.config.value || 0) * 100)
      }
    });
    return { status: "created", output: { entityType: "Opportunity", entityId: opportunity.id } };
  }

  return { status: "skipped", error: `${step.type} requires a provider integration that is not yet configured.` };
}

async function recordStepRun(runId: string, step: AutomationStep, result: StepResult) {
  try {
    await prisma.automationStepRun.create({
      data: {
        runId,
        stepId: step.id,
        stepType: step.type,
        stepName: step.name,
        status: result.status,
        output: result.output ? (result.output as Prisma.InputJsonValue) : undefined,
        error: result.error,
        endedAt: new Date()
      }
    });
  } catch {
    // non-fatal — step execution already happened
  }
}

export async function runAutomation(input: {
  automationId: string;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  actorUserId?: string | null;
  triggerType?: AutomationTriggerType;
  payload?: Record<string, unknown>;
}) {
  const automation = await prisma.automation.findFirst({
    where: { id: input.automationId, agencyId: input.agencyId, subAccountId: input.subAccountId }
  });

  if (!automation) return { executed: false, results: [] };

  const definition = parseAutomationDefinition(automation.definition);

  let run: { id: string } | null = null;
  try {
    run = await prisma.automationRun.create({
      data: {
        automationId: automation.id,
        agencyId: input.agencyId,
        subAccountId: input.subAccountId,
        contactId: input.contactId ?? null,
        status: "RUNNING",
        triggerType: input.triggerType ?? "CONTACT_CREATED",
        payload: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined
      }
    });
  } catch {
    // DB unavailable or tables not migrated yet — continue without tracking
  }

  const context: ExecutionContext = {
    type: input.triggerType ?? "CONTACT_CREATED",
    automationId: automation.id,
    runId: run?.id ?? "no-run",
    agencyId: input.agencyId,
    subAccountId: input.subAccountId,
    contactId: input.contactId,
    actorUserId: input.actorUserId,
    payload: input.payload
  };

  const results = [];
  let failed = false;
  let failError = "";

  for (const step of definition.steps) {
    try {
      const result = await executeStep(step, context);
      results.push({ stepId: step.id, stepName: step.name, stepType: step.type, ...result });
      if (run) await recordStepRun(run.id, step, result);
    } catch (err) {
      const error = String(err);
      failed = true;
      failError = error;
      results.push({ stepId: step.id, stepName: step.name, stepType: step.type, status: "error", error });
      if (run) await recordStepRun(run.id, step, { status: "error", error });
      break;
    }
  }

  if (run) {
    try {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: failed ? "FAILED" : "COMPLETED",
          completedAt: new Date(),
          error: failError || null
        }
      });
    } catch {
      // non-fatal
    }
  }

  return { executed: true, results };
}

export async function runAutomationsForEvent(event: AutomationEvent) {
  const automations = await prisma.automation.findMany({
    where: { agencyId: event.agencyId, subAccountId: event.subAccountId, status: "published" }
  });

  const results = [];
  for (const automation of automations) {
    const definition = parseAutomationDefinition(automation.definition);
    if (!triggerMatches(definition, event)) continue;
    results.push(
      await runAutomation({
        automationId: automation.id,
        triggerType: event.type,
        ...event
      })
    );
  }

  return results;
}

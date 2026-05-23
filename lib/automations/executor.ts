import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
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
  actorUserId?: string | null;
};

function triggerMatches(definition: AutomationDefinition, event: AutomationEvent) {
  return definition.triggers.some((trigger) => {
    if (trigger.type !== event.type) {
      return false;
    }

    if (trigger.type === "CONTACT_TAG" && trigger.config.tagName) {
      return event.payload?.tagName === trigger.config.tagName;
    }

    return true;
  });
}

async function getOrCreateTag(input: { agencyId: string; subAccountId: string; name: string }) {
  const existing = await prisma.tag.findFirst({
    where: { agencyId: input.agencyId, subAccountId: input.subAccountId, name: input.name }
  });

  if (existing) {
    return existing;
  }

  return prisma.tag.create({
    data: {
      agencyId: input.agencyId,
      subAccountId: input.subAccountId,
      name: input.name
    }
  });
}

async function executeStep(step: AutomationStep, context: ExecutionContext) {
  if (step.type === "WAIT") {
    return { status: "deferred", message: `Wait step recorded for ${step.config.duration || "0"} ${step.config.unit || "minutes"}.` };
  }

  if (step.type === "IF_ELSE") {
    return { status: "evaluated", message: "Condition evaluated; branch execution is a builder-level next step." };
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
    return { status: "created", entityType: "Contact", entityId: contact.id };
  }

  if (!context.contactId) {
    return { status: "skipped", message: "Step requires a contact context." };
  }

  if (step.type === "UPDATE_CONTACT_FIELD") {
    const field = step.config.field;
    const value = step.config.value;
    const allowedFields = new Set(["firstName", "lastName", "email", "phone", "companyName", "source", "timezone"]);

    if (!field || !allowedFields.has(field)) {
      return { status: "skipped", message: "Unsupported contact field." };
    }

    await prisma.contact.update({
      where: { id: context.contactId, agencyId: context.agencyId, subAccountId: context.subAccountId },
      data: { [field]: value } as Prisma.ContactUpdateInput
    });

    return { status: "updated", entityType: "Contact", entityId: context.contactId };
  }

  if (step.type === "ADD_CONTACT_TAG") {
    const name = step.config.tagName;
    if (!name) {
      return { status: "skipped", message: "Missing tag name." };
    }

    const tag = await getOrCreateTag({ agencyId: context.agencyId, subAccountId: context.subAccountId, name });
    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: context.contactId, tagId: tag.id } },
      update: {},
      create: { contactId: context.contactId, tagId: tag.id }
    });

    return { status: "tagged", entityType: "Tag", entityId: tag.id };
  }

  if (step.type === "REMOVE_CONTACT_TAG") {
    const name = step.config.tagName;
    if (!name) {
      return { status: "skipped", message: "Missing tag name." };
    }

    const tag = await prisma.tag.findFirst({ where: { agencyId: context.agencyId, subAccountId: context.subAccountId, name } });
    if (!tag) {
      return { status: "skipped", message: "Tag not found." };
    }

    await prisma.contactTag.deleteMany({ where: { contactId: context.contactId, tagId: tag.id } });
    return { status: "untagged", entityType: "Tag", entityId: tag.id };
  }

  if (step.type === "CREATE_CONVERSATION") {
    const conversation = await prisma.conversation.create({
      data: {
        agencyId: context.agencyId,
        subAccountId: context.subAccountId,
        contactId: context.contactId,
        channel: step.config.channel === "EMAIL" ? "EMAIL" : step.config.channel === "CALL" ? "CALL" : "SMS",
        subject: step.config.subject || "Automation conversation"
      }
    });

    return { status: "created", entityType: "Conversation", entityId: conversation.id };
  }

  if (step.type === "CREATE_OPPORTUNITY") {
    const stage = await prisma.pipelineStage.findFirst({
      where: { pipeline: { agencyId: context.agencyId, subAccountId: context.subAccountId } },
      orderBy: { position: "asc" }
    });

    if (!stage) {
      return { status: "skipped", message: "Create a pipeline first." };
    }

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

    return { status: "created", entityType: "Opportunity", entityId: opportunity.id };
  }

  return { status: "skipped", message: `${step.type} is cataloged but not executable yet.` };
}

export async function runAutomation(input: {
  automationId: string;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const automation = await prisma.automation.findFirst({
    where: { id: input.automationId, agencyId: input.agencyId, subAccountId: input.subAccountId }
  });

  if (!automation) {
    return { executed: false, results: [] };
  }

  const definition = parseAutomationDefinition(automation.definition);
  const context: ExecutionContext = {
    type: "CUSTOMER_REPLIED",
    automationId: automation.id,
    agencyId: input.agencyId,
    subAccountId: input.subAccountId,
    contactId: input.contactId,
    actorUserId: input.actorUserId,
    payload: input.payload
  };

  const results = [];
  for (const step of definition.steps) {
    results.push({ stepId: step.id, stepName: step.name, ...(await executeStep(step, context)) });
  }

  await auditLog({
    agencyId: input.agencyId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "AutomationRun",
    entityId: automation.id,
    metadata: { runId: randomUUID(), results }
  });

  return { executed: true, results };
}

export async function runAutomationsForEvent(event: AutomationEvent) {
  const automations = await prisma.automation.findMany({
    where: { agencyId: event.agencyId, subAccountId: event.subAccountId, status: "published" }
  });

  const results = [];
  for (const automation of automations) {
    const definition = parseAutomationDefinition(automation.definition);
    if (!triggerMatches(definition, event)) {
      continue;
    }

    results.push(await runAutomation({ automationId: automation.id, ...event }));
  }

  return results;
}

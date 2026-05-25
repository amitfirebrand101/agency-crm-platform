/**
 * Pure step execution — given a step config and execution context, performs
 * the action and returns a structured result. No enrollment/run tracking here.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeWebhookFetch, validateWebhookUrl } from "@/lib/automations/ssrf-guard";
import type { StepNode } from "@/lib/automations/schema";
import { PROVIDER_REQUIRED_STEPS } from "@/lib/automations/schema";

export type StepContext = {
  automationId: string;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
  isTestRun?: boolean;
};

export type StepOutput = {
  status: "COMPLETED" | "FAILED" | "SKIPPED" | "WAITING" | "WAITING_TEST";
  output?: Record<string, unknown>;
  error?: string;
  /** For WAIT steps: when to resume. Null in test mode. */
  resumeAt?: Date | null;
  /** Updated contactId if a contact was created. */
  contactId?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateTag(agencyId: string, subAccountId: string, name: string) {
  const existing = await prisma.tag.findFirst({
    where: { agencyId, subAccountId, name },
  });
  if (existing) return existing;
  return prisma.tag.create({
    data: { agencyId, subAccountId, name },
  });
}

async function evaluateCondition(step: StepNode, ctx: StepContext): Promise<boolean> {
  const { conditionType, field, value, tagName } = step.config;
  if (conditionType === "always.true") return true;
  if (conditionType === "always.false") return false;
  if (!ctx.contactId) return false;

  if (conditionType === "contact.hasTag") {
    const tag = await prisma.tag.findFirst({ where: { name: tagName, agencyId: ctx.agencyId } });
    if (!tag) return false;
    const ct = await prisma.contactTag.findUnique({
      where: { contactId_tagId: { contactId: ctx.contactId, tagId: tag.id } },
    });
    return ct !== null;
  }

  if (conditionType === "contact.fieldEquals" || conditionType === "contact.field.equals") {
    const contact = await prisma.contact.findUnique({ where: { id: ctx.contactId } });
    if (!contact) return false;
    const fieldValue = (contact as Record<string, unknown>)[field ?? ""];
    return String(fieldValue ?? "") === (value ?? "");
  }

  if (conditionType === "contact.status.is") {
    const contact = await prisma.contact.findUnique({ where: { id: ctx.contactId } });
    return contact?.status === value;
  }

  return false;
}

// ── Main executor ─────────────────────────────────────────────────────────────

export async function executeStep(step: StepNode, ctx: StepContext): Promise<StepOutput> {
  // Provider-required steps — fail with clear reason if provider not configured
  if (PROVIDER_REQUIRED_STEPS.has(step.type)) {
    return {
      status: "SKIPPED",
      error: `${step.type} requires a provider integration (Twilio / email provider). Configure credentials to enable this step.`,
    };
  }

  // ── WAIT ────────────────────────────────────────────────────────────────────
  if (step.type === "WAIT") {
    const duration = Math.max(1, Number(step.config.duration ?? 5));
    const unit = (step.config.unit ?? "minutes") as "minutes" | "hours" | "days";
    const ms =
      unit === "days" ? duration * 86_400_000 :
      unit === "hours" ? duration * 3_600_000 :
      duration * 60_000;

    if (ctx.isTestRun) {
      return {
        status: "WAITING_TEST",
        output: { duration, unit, note: "Test mode — wait skipped" },
      };
    }
    return {
      status: "WAITING",
      output: { duration, unit },
      resumeAt: new Date(Date.now() + ms),
    };
  }

  // ── IF_ELSE — callers handle branch recursion ───────────────────────────────
  if (step.type === "IF_ELSE") {
    const conditionMet = await evaluateCondition(step, ctx);
    return {
      status: "COMPLETED",
      output: { conditionMet, branch: conditionMet ? "true" : "false" },
    };
  }

  // ── REMOVE_FROM_WORKFLOW ────────────────────────────────────────────────────
  if (step.type === "REMOVE_FROM_WORKFLOW") {
    return { status: "COMPLETED", output: { removed: true } };
  }

  // ── OUTBOUND_WEBHOOK ────────────────────────────────────────────────────────
  if (step.type === "OUTBOUND_WEBHOOK") {
    const url = step.config.url?.trim();
    if (!url) return { status: "FAILED", error: "Missing webhook URL." };
    try {
      validateWebhookUrl(url); // throws on private IP / bad scheme
    } catch (e) {
      return { status: "FAILED", error: String(e) };
    }
    try {
      const result = await safeWebhookFetch(url, {
        automationId: ctx.automationId,
        contactId: ctx.contactId,
        triggerPayload: ctx.payload,
      });
      return {
        status: result.ok ? "COMPLETED" : "FAILED",
        output: { httpStatus: result.status, responseBody: result.body },
        ...(!result.ok && { error: `HTTP ${result.status}` }),
      };
    } catch (err) {
      return { status: "FAILED", error: `Webhook fetch failed: ${String(err)}` };
    }
  }

  // ── CREATE_CONTACT ──────────────────────────────────────────────────────────
  if (step.type === "CREATE_CONTACT") {
    const firstName =
      step.config.firstName?.trim() || String(ctx.payload?.firstName ?? "New");
    const lastName = step.config.lastName?.trim() || String(ctx.payload?.lastName ?? "");
    const email = step.config.email?.trim() || String(ctx.payload?.email ?? "");
    const contact = await prisma.contact.create({
      data: {
        agencyId: ctx.agencyId,
        subAccountId: ctx.subAccountId,
        firstName,
        lastName: lastName || null,
        email: email || null,
        source: "Automation",
      },
    });
    return {
      status: "COMPLETED",
      output: { entityType: "Contact", entityId: contact.id },
      contactId: contact.id,
    };
  }

  // Steps below require a contact in context
  if (!ctx.contactId) {
    return { status: "SKIPPED", error: "Step requires a contact in context." };
  }

  // ── UPDATE_CONTACT_FIELD ────────────────────────────────────────────────────
  if (step.type === "UPDATE_CONTACT_FIELD") {
    const ALLOWED = new Set(["firstName","lastName","email","phone","companyName","source","timezone"]);
    const field = step.config.field;
    const value = step.config.value ?? "";
    if (!field || !ALLOWED.has(field)) {
      return { status: "SKIPPED", error: `Field "${field}" is not allowed.` };
    }
    await prisma.contact.update({
      where: { id: ctx.contactId, agencyId: ctx.agencyId, subAccountId: ctx.subAccountId },
      data: { [field]: value } as Prisma.ContactUpdateInput,
    });
    return { status: "COMPLETED", output: { field, value } };
  }

  // ── ADD_CONTACT_TAG ─────────────────────────────────────────────────────────
  if (step.type === "ADD_CONTACT_TAG") {
    const name = step.config.tagName?.trim();
    if (!name) return { status: "SKIPPED", error: "Missing tagName." };
    const tag = await getOrCreateTag(ctx.agencyId, ctx.subAccountId, name);
    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: ctx.contactId!, tagId: tag.id } },
      update: {},
      create: { contactId: ctx.contactId!, tagId: tag.id },
    });
    return { status: "COMPLETED", output: { tagId: tag.id, tagName: name } };
  }

  // ── REMOVE_CONTACT_TAG ──────────────────────────────────────────────────────
  if (step.type === "REMOVE_CONTACT_TAG") {
    const name = step.config.tagName?.trim();
    if (!name) return { status: "SKIPPED", error: "Missing tagName." };
    const tag = await prisma.tag.findFirst({
      where: { agencyId: ctx.agencyId, subAccountId: ctx.subAccountId, name },
    });
    if (!tag) return { status: "SKIPPED", error: "Tag not found." };
    await prisma.contactTag.deleteMany({
      where: { contactId: ctx.contactId!, tagId: tag.id },
    });
    return { status: "COMPLETED", output: { tagName: name } };
  }

  // ── CREATE_CONVERSATION ─────────────────────────────────────────────────────
  if (step.type === "CREATE_CONVERSATION") {
    const validChannels = new Set(["SMS", "EMAIL", "CALL", "VOICEMAIL", "INTERNAL_NOTE"]);
    const channel = validChannels.has(step.config.channel ?? "")
      ? (step.config.channel as "SMS" | "EMAIL" | "CALL" | "VOICEMAIL" | "INTERNAL_NOTE")
      : "INTERNAL_NOTE";
    const conversation = await prisma.conversation.create({
      data: {
        agencyId: ctx.agencyId,
        subAccountId: ctx.subAccountId,
        contactId: ctx.contactId,
        channel,
        subject: step.config.subject?.trim() || "Automation conversation",
      },
    });
    return {
      status: "COMPLETED",
      output: { entityType: "Conversation", entityId: conversation.id },
    };
  }

  // ── CREATE_OPPORTUNITY ──────────────────────────────────────────────────────
  if (step.type === "CREATE_OPPORTUNITY") {
    const stage = await prisma.pipelineStage.findFirst({
      where: { pipeline: { agencyId: ctx.agencyId, subAccountId: ctx.subAccountId } },
      orderBy: { position: "asc" },
    });
    if (!stage) {
      return { status: "SKIPPED", error: "No pipeline stage found. Create a pipeline first." };
    }
    const opportunity = await prisma.opportunity.create({
      data: {
        agencyId: ctx.agencyId,
        subAccountId: ctx.subAccountId,
        contactId: ctx.contactId,
        stageId: stage.id,
        name: step.config.name?.trim() || "Automation opportunity",
        valueCents: Math.max(0, Math.round(Number(step.config.value ?? 0) * 100)),
      },
    });
    return {
      status: "COMPLETED",
      output: { entityType: "Opportunity", entityId: opportunity.id },
    };
  }

  // ── ASSIGN_TO_USER ──────────────────────────────────────────────────────────
  if (step.type === "ASSIGN_TO_USER") {
    const userEmail = step.config.userId?.trim(); // field is named userId but accepts email
    if (!userEmail) return { status: "SKIPPED", error: "No user email provided." };
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return { status: "SKIPPED", error: `User "${userEmail}" not found.` };
    await prisma.contact.update({
      where: { id: ctx.contactId, agencyId: ctx.agencyId, subAccountId: ctx.subAccountId },
      data: { assignedUserId: user.id },
    });
    return { status: "COMPLETED", output: { assignedUserId: user.id } };
  }

  return {
    status: "SKIPPED",
    error: `${step.type} is not yet supported in this environment.`,
  };
}

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
  runId?: string | null;
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
    const tag = await prisma.tag.findFirst({
      where: {
        name: tagName ?? value,
        agencyId: ctx.agencyId,
        subAccountId: ctx.subAccountId,
      },
    });
    if (!tag) return false;
    const ct = await prisma.contactTag.findUnique({
      where: { contactId_tagId: { contactId: ctx.contactId, tagId: tag.id } },
    });
    return ct !== null;
  }

  if (conditionType === "contact.fieldEquals" || conditionType === "contact.field.equals") {
    const contact = await prisma.contact.findUnique({ where: { id: ctx.contactId } });
    if (!contact) return false;
    const fieldKey = field || String(ctx.payload?.field ?? "");
    const fieldValue = (contact as Record<string, unknown>)[fieldKey];
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
      const delivery = await prisma.automationWebhookDelivery.create({
        data: {
          agencyId: ctx.agencyId,
          subAccountId: ctx.subAccountId,
          automationId: ctx.automationId,
          runId: ctx.runId && ctx.runId !== "no-run" ? ctx.runId : null,
          url,
          method: "POST",
          status: "PENDING",
          request: {
            automationId: ctx.automationId,
            contactId: ctx.contactId,
            triggerPayload: ctx.payload,
          } as Prisma.InputJsonValue,
        },
      }).catch(() => null);
      const result = await safeWebhookFetch(url, {
        automationId: ctx.automationId,
        contactId: ctx.contactId,
        triggerPayload: ctx.payload,
      });
      if (delivery) {
        await prisma.automationWebhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: result.ok ? "SUCCESS" : "FAILED",
            response: {
              httpStatus: result.status,
              body: result.body,
            } as Prisma.InputJsonValue,
            error: result.ok ? undefined : ({ message: `HTTP ${result.status}` } as Prisma.InputJsonValue),
          },
        }).catch(() => undefined);
      }
      return {
        status: result.ok ? "COMPLETED" : "FAILED",
        output: { httpStatus: result.status, responseBody: result.body },
        ...(!result.ok && { error: `HTTP ${result.status}` }),
      };
    } catch (err) {
      await prisma.automationWebhookDelivery.create({
        data: {
          agencyId: ctx.agencyId,
          subAccountId: ctx.subAccountId,
          automationId: ctx.automationId,
          runId: ctx.runId && ctx.runId !== "no-run" ? ctx.runId : null,
          url,
          method: "POST",
          status: "FAILED",
          request: { triggerPayload: ctx.payload } as Prisma.InputJsonValue,
          error: { message: String(err) } as Prisma.InputJsonValue,
        },
      }).catch(() => undefined);
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

  // ── SET_DND ────────────────────────────────────────────────────────────────
  if (step.type === "SET_DND") {
    const channel = step.config.channel ?? "both";
    const enabled = step.config.enabled === "true";
    const data: Prisma.ContactUpdateInput = {};
    if (channel === "email" || channel === "both") data.emailOptOut = enabled;
    if (channel === "sms" || channel === "both") data.smsOptOut = enabled;
    await prisma.contact.update({
      where: { id: ctx.contactId, agencyId: ctx.agencyId, subAccountId: ctx.subAccountId },
      data,
    });
    return { status: "COMPLETED", output: { channel, dndEnabled: enabled } };
  }

  // ── REMOVE_ASSIGNED_USER ───────────────────────────────────────────────────
  if (step.type === "REMOVE_ASSIGNED_USER") {
    await prisma.contact.update({
      where: { id: ctx.contactId, agencyId: ctx.agencyId, subAccountId: ctx.subAccountId },
      data: { assignedUserId: null },
    });
    return { status: "COMPLETED", output: { assignedUserId: null } };
  }

  // ── UPDATE_CONTACT_FIELD ────────────────────────────────────────────────────
  if (step.type === "UPDATE_CONTACT_FIELD") {
    const ALLOWED = new Set(["firstName","lastName","email","phone","companyName","source","timezone","status"]);
    const field = step.config.field;
    const value = field === "status"
      ? (step.config.value ?? "").toUpperCase()
      : (step.config.value ?? "");
    if (!field || !ALLOWED.has(field)) {
      return { status: "SKIPPED", error: `Field "${field}" is not allowed.` };
    }
    if (field === "status" && !["LEAD", "CUSTOMER", "INACTIVE"].includes(value)) {
      return { status: "SKIPPED", error: "Status must be lead, customer, or inactive." };
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
    const body = step.config.body?.trim() || step.config.message?.trim();
    if (body) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          body,
          direction: "INTERNAL",
        },
      });
    }
    return {
      status: "COMPLETED",
      output: { entityType: "Conversation", entityId: conversation.id },
    };
  }

  // ── ADD_NOTE / SEND_INTERNAL_NOTIFICATION ──────────────────────────────────
  if (step.type === "ADD_NOTE" || step.type === "SEND_INTERNAL_NOTIFICATION") {
    const body = step.config.note?.trim() || step.config.message?.trim();
    if (!body) return { status: "SKIPPED", error: "Missing note/message." };
    const conversation = await prisma.conversation.create({
      data: {
        agencyId: ctx.agencyId,
        subAccountId: ctx.subAccountId,
        contactId: ctx.contactId,
        channel: "INTERNAL_NOTE",
        subject: step.type === "ADD_NOTE" ? "Automation note" : "Automation notification",
        messages: {
          create: {
            body,
            direction: "INTERNAL",
          },
        },
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

  // ── UPDATE_OPPORTUNITY ─────────────────────────────────────────────────────
  if (step.type === "UPDATE_OPPORTUNITY") {
    const statusMap = new Set(["OPEN", "WON", "LOST"]);
    const status = (step.config.status ?? "").toUpperCase();
    if (!statusMap.has(status)) return { status: "SKIPPED", error: "Invalid opportunity status." };
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        agencyId: ctx.agencyId,
        subAccountId: ctx.subAccountId,
        contactId: ctx.contactId,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!opportunity) return { status: "SKIPPED", error: "No opportunity found for contact." };
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { status: status as "OPEN" | "WON" | "LOST" },
    });
    return { status: "COMPLETED", output: { opportunityId: opportunity.id, status } };
  }

  // ── UPDATE_APPOINTMENT_STATUS ──────────────────────────────────────────────
  if (step.type === "UPDATE_APPOINTMENT_STATUS") {
    const status = step.config.status?.trim();
    if (!status) return { status: "SKIPPED", error: "Missing appointment status." };
    const appointment = await prisma.appointment.findFirst({
      where: {
        contactId: ctx.contactId,
        calendar: { agencyId: ctx.agencyId, subAccountId: ctx.subAccountId },
      },
      orderBy: { startsAt: "desc" },
    });
    if (!appointment) return { status: "SKIPPED", error: "No appointment found for contact." };
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status } });
    return { status: "COMPLETED", output: { appointmentId: appointment.id, status } };
  }

  // ── ASSIGN_TO_USER ──────────────────────────────────────────────────────────
  if (step.type === "ASSIGN_TO_USER") {
    const userEmail = step.config.userId?.trim(); // field is named userId but accepts email
    if (!userEmail) return { status: "SKIPPED", error: "No user email provided." };
    const user = await prisma.user.findFirst({
      where: {
        email: userEmail,
        subAccountMemberships: { some: { subAccountId: ctx.subAccountId } },
      },
    });
    if (!user) return { status: "SKIPPED", error: `User "${userEmail}" not found.` };
    await prisma.contact.update({
      where: { id: ctx.contactId, agencyId: ctx.agencyId, subAccountId: ctx.subAccountId },
      data: { assignedUserId: user.id },
    });
    return { status: "COMPLETED", output: { assignedUserId: user.id } };
  }

  // ── DELETE_CONTACT ─────────────────────────────────────────────────────────
  if (step.type === "DELETE_CONTACT") {
    if (step.config.confirm !== "DELETE") {
      return { status: "SKIPPED", error: "Delete contact requires confirm=DELETE." };
    }
    await prisma.contact.delete({
      where: { id: ctx.contactId, agencyId: ctx.agencyId, subAccountId: ctx.subAccountId },
    });
    return { status: "COMPLETED", output: { deletedContactId: ctx.contactId } };
  }

  return {
    status: "SKIPPED",
    error: `${step.type} is not yet supported in this environment.`,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { appointmentSchema } from "@/lib/validation";
import { runAutomationsForEvent } from "@/lib/automations/executor";

async function requireWritableSubAccount() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to update this sub account.");
  }
  return user as typeof user & { subAccountId: string };
}

const nameSchema = z.object({ name: z.string().trim().min(2).max(120) });

export async function createConversation(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({
      subject: z.string().trim().max(160).optional(),
      channel: z.enum(["SMS", "EMAIL", "CALL", "VOICEMAIL", "INTERNAL_NOTE"]),
      contactId: z.string().uuid().optional(),
    })
    .parse(Object.fromEntries(formData));

  // If SMS/EMAIL + contact, reuse any open thread for that contact
  if ((input.channel === "SMS" || input.channel === "EMAIL") && input.contactId) {
    const existing = await prisma.conversation.findFirst({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        contactId: input.contactId,
        channel: input.channel,
        status: { in: ["OPEN", "PENDING"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      redirect(`/conversations?id=${existing.id}`);
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      channel: input.channel,
      subject: input.subject || null,
      contactId: input.contactId || null,
    },
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Conversation", entityId: conversation.id });
  revalidatePath("/conversations");
  redirect(`/conversations?id=${conversation.id}`);
}

export async function createCalendar(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = nameSchema.parse(Object.fromEntries(formData));
  const calendar = await prisma.calendar.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: input.name }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Calendar", entityId: calendar.id });
  revalidatePath("/calendars");
}

export async function createAppointment(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = appointmentSchema.parse(Object.fromEntries(formData));

  const calendar = await prisma.calendar.findFirstOrThrow({
    where: { id: input.calendarId, agencyId: user.agencyId, subAccountId: user.subAccountId }
  });

  const appointment = await prisma.appointment.create({
    data: {
      calendarId: calendar.id,
      contactId: input.contactId || null,
      title: input.title,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      status: "scheduled"
    }
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Appointment", entityId: appointment.id });
  await runAutomationsForEvent({
    type: "APPOINTMENT_STATUS",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: appointment.contactId,
    payload: {
      appointmentId: appointment.id,
      calendarId: calendar.id,
      status: appointment.status,
      title: appointment.title,
    },
  });
  revalidatePath(`/calendars/${calendar.id}`);
  revalidatePath("/calendars");
}

export async function updateAppointmentStatus(formData: FormData) {
  const user = await requireWritableSubAccount();
  const appointmentId = z.string().uuid().parse(String(formData.get("appointmentId") ?? ""));
  const status = z.enum(["scheduled", "confirmed", "cancelled", "completed", "no_show"]).parse(String(formData.get("status") ?? ""));

  const appointment = await prisma.appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: { calendar: true }
  });

  if (appointment.calendar.agencyId !== user.agencyId) throw new Error("Access denied.");

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Appointment", entityId: appointmentId });
  await runAutomationsForEvent({
    type: "APPOINTMENT_STATUS",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: appointment.contactId,
    payload: {
      appointmentId,
      calendarId: appointment.calendarId,
      status,
      previousStatus: appointment.status,
    },
  });
  revalidatePath(`/calendars/${appointment.calendarId}`);
}

export async function createPipeline(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = nameSchema.parse(Object.fromEntries(formData));
  const pipeline = await prisma.pipeline.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: input.name,
      stages: { create: [{ name: "New", position: 1 }, { name: "Qualified", position: 2 }, { name: "Won", position: 3 }] }
    }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Pipeline", entityId: pipeline.id });
  revalidatePath("/opportunities");
}

export async function createOpportunity(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({
      name: z.string().trim().min(2).max(120),
      stageId: z.string().uuid(),
      value: z.coerce.number().min(0).default(0)
    })
    .parse(Object.fromEntries(formData));
  const opportunity = await prisma.opportunity.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      stageId: input.stageId,
      name: input.name,
      valueCents: Math.round(input.value * 100)
    }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Opportunity", entityId: opportunity.id });
  await runAutomationsForEvent({
    type: "OPPORTUNITY_CREATED",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: opportunity.contactId,
    payload: {
      opportunityId: opportunity.id,
      stageId: opportunity.stageId,
      status: opportunity.status,
      valueCents: opportunity.valueCents,
    },
  });
  revalidatePath("/opportunities");
}

export async function moveOpportunityToStage(formData: FormData) {
  const user = await requireWritableSubAccount();
  const opportunityId = z.string().uuid().parse(String(formData.get("opportunityId") ?? ""));
  const stageId = z.string().uuid().parse(String(formData.get("stageId") ?? ""));

  const opp = await prisma.opportunity.findFirstOrThrow({
    where: { id: opportunityId, agencyId: user.agencyId, subAccountId: user.subAccountId }
  });

  await prisma.opportunity.update({ where: { id: opp.id }, data: { stageId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Opportunity", entityId: opp.id, metadata: { stageId } });
  // PIPELINE_STAGE_CHANGED event fires here — wired to kanban DnD via KanbanBoard.handleDragEnd.
  // Automations with a PIPELINE_STAGE_CHANGED trigger will be enrolled for any matching contacts.
  await runAutomationsForEvent({
    type: "PIPELINE_STAGE_CHANGED",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: opp.contactId,
    payload: {
      opportunityId: opp.id,
      previousStageId: opp.stageId,
      stageId,
      status: opp.status,
    },
  });
  revalidatePath("/opportunities");
}

export async function updateOpportunityStatus(formData: FormData) {
  const user = await requireWritableSubAccount();
  const opportunityId = z.string().uuid().parse(String(formData.get("opportunityId") ?? ""));
  const status = z.enum(["OPEN", "WON", "LOST"]).parse(String(formData.get("status") ?? ""));

  const opp = await prisma.opportunity.findFirstOrThrow({
    where: { id: opportunityId, agencyId: user.agencyId, subAccountId: user.subAccountId }
  });

  await prisma.opportunity.update({ where: { id: opp.id }, data: { status } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Opportunity", entityId: opp.id, metadata: { status } });
  // OPPORTUNITY_STATUS event fires here — called by kanban Won/Lost buttons via KanbanBoard.handleStatusChange.
  // Automations with an OPPORTUNITY_STATUS trigger will be enrolled for any matching contacts.
  await runAutomationsForEvent({
    type: "OPPORTUNITY_STATUS",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: opp.contactId,
    payload: {
      opportunityId: opp.id,
      previousStatus: opp.status,
      status,
      stageId: opp.stageId,
    },
  });
  revalidatePath("/opportunities");
}

export async function createAutomation(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = nameSchema.parse(Object.fromEntries(formData));
  const automation = await prisma.automation.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: input.name }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Automation", entityId: automation.id });
  revalidatePath("/automations");
}

export async function createSite(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({ name: z.string().trim().min(2).max(120), domain: z.string().trim().max(160).optional() })
    .parse(Object.fromEntries(formData));
  const site = await prisma.site.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: input.name, domain: input.domain || null }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Site", entityId: site.id });
  revalidatePath("/sites");
}

export async function createMarketingCampaign(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({ name: z.string().trim().min(2).max(120), channel: z.string().trim().min(2).max(40) })
    .parse(Object.fromEntries(formData));
  const campaign = await prisma.marketingCampaign.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: input.name, channel: input.channel }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "MarketingCampaign", entityId: campaign.id });
  revalidatePath("/marketing");
}

export async function deleteMarketingCampaign(formData: FormData): Promise<void> {
  const user = await requireWritableSubAccount();
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId },
    select: { id: true },
  });
  if (!campaign) return;
  await prisma.marketingCampaign.delete({ where: { id: campaign.id } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "MarketingCampaign", entityId: id });
  revalidatePath("/marketing");
}

export async function createPhoneNumber(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({ number: z.string().trim().min(7).max(32), provider: z.string().trim().max(40).optional() })
    .parse(Object.fromEntries(formData));
  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      number: input.number,
      provider: input.provider || "manual"
    }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "PhoneNumber", entityId: phoneNumber.id });
  revalidatePath("/calling");
  revalidatePath("/sms");
}

export async function updateOpportunity(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({
      opportunityId: z.string().uuid(),
      name: z.string().trim().min(1).max(200),
      value: z.coerce.number().min(0).default(0),
      status: z.enum(["OPEN", "WON", "LOST"]),
      lostReason: z.string().trim().max(500).optional(),
      closeDate: z.string().optional(),
      notes: z.string().trim().max(5000).optional(),
    })
    .parse(Object.fromEntries(formData));

  const opp = await prisma.opportunity.findFirstOrThrow({
    where: { id: input.opportunityId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });

  const closeDate = input.closeDate ? new Date(input.closeDate) : null;

  await prisma.opportunity.update({
    where: { id: opp.id },
    data: {
      name: input.name,
      valueCents: Math.round(input.value * 100),
      status: input.status,
      lostReason: input.lostReason || null,
      closeDate,
      notes: input.notes || null,
    },
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "UPDATE",
    entityType: "Opportunity",
    entityId: opp.id,
    metadata: {
      name: input.name,
      status: input.status,
      valueCents: Math.round(input.value * 100),
      lostReason: input.lostReason || null,
      closeDate: closeDate?.toISOString() ?? null,
    },
  });

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${opp.id}`);
}

export async function deleteOpportunity(formData: FormData) {
  const user = await requireWritableSubAccount();
  const opportunityId = z.string().uuid().parse(String(formData.get("opportunityId") ?? ""));

  const opp = await prisma.opportunity.findFirstOrThrow({
    where: { id: opportunityId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });

  await prisma.opportunity.delete({ where: { id: opp.id } });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "DELETE",
    entityType: "Opportunity",
    entityId: opp.id,
  });

  revalidatePath("/opportunities");
  redirect("/opportunities");
}

export async function addPipelineStage(formData: FormData) {
  const user = await requireWritableSubAccount();
  const pipelineId = z.string().uuid().parse(String(formData.get("pipelineId") ?? ""));
  const name = z.string().trim().min(1).max(80).parse(String(formData.get("name") ?? ""));

  // Verify pipeline belongs to this sub-account
  await prisma.pipeline.findFirstOrThrow({
    where: { id: pipelineId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });

  // Get max position
  const maxPos = await prisma.pipelineStage.aggregate({
    where: { pipelineId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? 0) + 1;

  await prisma.pipelineStage.create({ data: { pipelineId, name, position } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "PipelineStage", entityId: pipelineId });
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/stages");
}

export async function renamePipelineStage(formData: FormData) {
  const user = await requireWritableSubAccount();
  const stageId = z.string().uuid().parse(String(formData.get("stageId") ?? ""));
  const name = z.string().trim().min(1).max(80).parse(String(formData.get("name") ?? ""));

  const stage = await prisma.pipelineStage.findFirstOrThrow({
    where: { id: stageId },
    include: { pipeline: true },
  });
  if (stage.pipeline.agencyId !== user.agencyId || stage.pipeline.subAccountId !== user.subAccountId) {
    throw new Error("Access denied.");
  }

  await prisma.pipelineStage.update({ where: { id: stageId }, data: { name } });
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/stages");
}

export async function deletePipelineStage(formData: FormData) {
  const user = await requireWritableSubAccount();
  const stageId = z.string().uuid().parse(String(formData.get("stageId") ?? ""));

  const stage = await prisma.pipelineStage.findFirstOrThrow({
    where: { id: stageId },
    include: { pipeline: true, _count: { select: { opportunities: true } } },
  });
  if (stage.pipeline.agencyId !== user.agencyId || stage.pipeline.subAccountId !== user.subAccountId) {
    throw new Error("Access denied.");
  }
  if (stage._count.opportunities > 0) {
    throw new Error(`Cannot delete a stage with ${stage._count.opportunities} opportunities. Move them first.`);
  }

  await prisma.pipelineStage.delete({ where: { id: stageId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "PipelineStage", entityId: stageId });
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/stages");
}

export async function renamePipeline(formData: FormData) {
  const user = await requireWritableSubAccount();
  const pipelineId = z.string().uuid().parse(String(formData.get("pipelineId") ?? ""));
  const name = z.string().trim().min(2).max(120).parse(String(formData.get("name") ?? ""));

  await prisma.pipeline.findFirstOrThrow({
    where: { id: pipelineId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  await prisma.pipeline.update({ where: { id: pipelineId }, data: { name } });
  revalidatePath("/opportunities");
  revalidatePath("/opportunities/stages");
}

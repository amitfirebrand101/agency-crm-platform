"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";

async function requireWritableSubAccount() {
  const user = await requireUser();

  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to update this sub account.");
  }

  return user as typeof user & { subAccountId: string };
}

const nameSchema = z.object({
  name: z.string().trim().min(2).max(120)
});

export async function createConversation(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({
      subject: z.string().trim().max(160).optional(),
      channel: z.enum(["SMS", "EMAIL", "CALL", "VOICEMAIL", "INTERNAL_NOTE"])
    })
    .parse(Object.fromEntries(formData));

  const conversation = await prisma.conversation.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      channel: input.channel,
      subject: input.subject || null
    }
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Conversation", entityId: conversation.id });
  revalidatePath("/conversations");
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

export async function createPipeline(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = nameSchema.parse(Object.fromEntries(formData));
  const pipeline = await prisma.pipeline.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: input.name,
      stages: {
        create: [
          { name: "New", position: 1 },
          { name: "Qualified", position: 2 },
          { name: "Won", position: 3 }
        ]
      }
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
    .object({
      name: z.string().trim().min(2).max(120),
      domain: z.string().trim().max(160).optional()
    })
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
    .object({
      name: z.string().trim().min(2).max(120),
      channel: z.string().trim().min(2).max(40)
    })
    .parse(Object.fromEntries(formData));
  const campaign = await prisma.marketingCampaign.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: input.name, channel: input.channel }
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "MarketingCampaign", entityId: campaign.id });
  revalidatePath("/marketing");
}

export async function createPhoneNumber(formData: FormData) {
  const user = await requireWritableSubAccount();
  const input = z
    .object({
      number: z.string().trim().min(7).max(32),
      provider: z.string().trim().max(40).optional()
    })
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

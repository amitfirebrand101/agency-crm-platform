"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { contactSchema, customFieldSchema, tagSchema } from "@/lib/validation";
import { runAutomationsForEvent } from "@/lib/automations/executor";

// ── Schemas ────────────────────────────────────────────────────────────────────

const addNoteSchema = z.object({
  contactId: z.string().uuid(),
  body: z.string().trim().min(1, "Note body is required").max(2000, "Note must be 2000 characters or fewer"),
});

const deleteNoteSchema = z.object({
  conversationId: z.string().uuid(),
  contactId: z.string().uuid(),
});

const startSmsSchema = z.object({
  contactId: z.string().uuid(),
});

const createTaskSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
  dueDate: z.string().optional().transform((v) => (v && v.trim() !== "" ? v : undefined)),
  assignedUserId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : undefined))
    .pipe(z.string().uuid().optional()),
});

const taskIdSchema = z.object({
  taskId: z.string().uuid(),
  contactId: z.string().uuid(),
});

const updateContactExtSchema = z.object({
  contactId: z.string().uuid(),
  emailOptOut: z.string().optional().transform((v) => v === "on" || v === "true" || v === "1"),
  smsOptOut: z.string().optional().transform((v) => v === "on" || v === "true" || v === "1"),
  assignedUserId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : undefined))
    .pipe(z.string().uuid().optional()),
});

async function requireContactAccess(contactId: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage contacts.");
  }
  const contact = await prisma.contact.findFirstOrThrow({
    where: { id: contactId, agencyId: user.agencyId, subAccountId: user.subAccountId }
  });
  return { user: user as typeof user & { subAccountId: string }, contact };
}

export async function createContact(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    return { error: "You do not have permission to create contacts." };
  }

  let input: z.infer<typeof contactSchema>;
  try {
    input = contactSchema.parse(Object.fromEntries(formData));
  } catch (err) {
    const zodErr = err as z.ZodError;
    return { error: zodErr.issues[0]?.message ?? "Invalid input." };
  }

  // ─── Duplicate email detection ─────────────────────────────────────────────
  if (input.email) {
    const existing = await prisma.contact.findFirst({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        email: input.email,
      },
      select: { id: true, firstName: true, lastName: true },
    });
    if (existing) {
      const existingName =
        `${existing.firstName}${existing.lastName ? ` ${existing.lastName}` : ""}`.trim();
      return {
        error: `A contact with email ${input.email} already exists: ${existingName}`,
      };
    }
  }

  // Round-robin auto-assignment: assign to next team member if no explicit assignee
  let autoAssignedUserId: string | null = null;
  const members = await prisma.subAccountMembership.findMany({
    where: { subAccountId: user.subAccountId },
    orderBy: { userId: "asc" },
    select: { userId: true },
  });
  if (members.length > 0) {
    const subAccount = await prisma.subAccount.findUnique({
      where: { id: user.subAccountId },
      select: { assignmentCursor: true },
    });
    const cursor = subAccount?.assignmentCursor ?? 0;
    autoAssignedUserId = members[cursor % members.length].userId;
    await prisma.subAccount.update({
      where: { id: user.subAccountId },
      data: { assignmentCursor: { increment: 1 } },
    });
  }

  const contact = await prisma.contact.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email || null,
      phone: input.phone || null,
      companyName: input.companyName || null,
      source: input.source || null,
      assignedUserId: autoAssignedUserId,
    },
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Contact", entityId: contact.id });

  await runAutomationsForEvent({
    type: "CONTACT_CREATED",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: contact.id,
    payload: { email: contact.email, firstName: contact.firstName, lastName: contact.lastName, source: contact.source },
  });

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateContact(formData: FormData) {
  const contactId = String(formData.get("contactId") ?? "");
  const { user, contact } = await requireContactAccess(contactId);
  const input = contactSchema.parse(Object.fromEntries(formData));

  // Parse extended fields (opt-outs and assigned user)
  const ext = updateContactExtSchema.parse({
    contactId,
    emailOptOut: formData.get("emailOptOut") ?? undefined,
    smsOptOut: formData.get("smsOptOut") ?? undefined,
    assignedUserId: formData.get("assignedUserId") ?? undefined,
  });

  // Validate assignedUserId belongs to this sub-account if one was submitted
  let resolvedAssignedUserId: string | null = contact.assignedUserId;
  const rawAssignedUserId = formData.get("assignedUserId");
  if (rawAssignedUserId === "" || rawAssignedUserId === null) {
    // Explicit unassign
    resolvedAssignedUserId = null;
  } else if (ext.assignedUserId) {
    const membership = await prisma.subAccountMembership.findFirst({
      where: { subAccountId: user.subAccountId, userId: ext.assignedUserId },
    });
    resolvedAssignedUserId = membership ? ext.assignedUserId : contact.assignedUserId;
  }

  const rawScore = formData.get("score");
  const score = rawScore !== null && rawScore !== "" ? Math.min(100, Math.max(0, parseInt(String(rawScore), 10) || 0)) : undefined;

  await prisma.contact.update({
    where: { id: contact.id, agencyId: user.agencyId, subAccountId: user.subAccountId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email || null,
      phone: input.phone || null,
      companyName: input.companyName || null,
      source: input.source || null,
      status: input.status ?? contact.status,
      emailOptOut: ext.emailOptOut,
      smsOptOut: ext.smsOptOut,
      assignedUserId: resolvedAssignedUserId,
      ...(score !== undefined ? { score } : {}),
    }
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", entityId: contact.id });
  await runAutomationsForEvent({
    type: "CONTACT_CHANGED",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: contact.id,
    payload: {
      previous: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        companyName: contact.companyName,
        source: contact.source,
        status: contact.status,
      },
      current: {
        firstName: input.firstName,
        lastName: input.lastName || null,
        email: input.email || null,
        phone: input.phone || null,
        companyName: input.companyName || null,
        source: input.source || null,
        status: input.status ?? contact.status,
      },
    },
  });
  revalidatePath(`/contacts/${contact.id}`);
  revalidatePath("/contacts");
}

export async function deleteContact(formData: FormData) {
  const contactId = String(formData.get("contactId") ?? "");
  const { user, contact } = await requireContactAccess(contactId);

  await prisma.contact.delete({ where: { id: contact.id, agencyId: user.agencyId, subAccountId: user.subAccountId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "DELETE", entityType: "Contact", entityId: contact.id });
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  redirect("/contacts");
}

export async function assignTagToContact(formData: FormData) {
  const contactId = String(formData.get("contactId") ?? "");
  const tagId = z.string().uuid().parse(String(formData.get("tagId") ?? ""));
  const { user, contact } = await requireContactAccess(contactId);

  const tag = await prisma.tag.findFirstOrThrow({
    where: { id: tagId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
    update: {},
    create: { contactId: contact.id, tagId: tag.id }
  });

  await runAutomationsForEvent({
    type: "CONTACT_TAG",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: contact.id,
    payload: { tagName: tag.name }
  });

  revalidatePath(`/contacts/${contact.id}`);
}

export async function removeTagFromContact(formData: FormData) {
  const contactId = String(formData.get("contactId") ?? "");
  const tagId = z.string().uuid().parse(String(formData.get("tagId") ?? ""));
  const { user, contact } = await requireContactAccess(contactId);

  const tag = await prisma.tag.findFirstOrThrow({
    where: { id: tagId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  await prisma.contactTag.deleteMany({ where: { contactId: contact.id, tagId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", entityId: contact.id, metadata: { removedTagId: tagId } });
  await runAutomationsForEvent({
    type: "CONTACT_TAG_REMOVED",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: contact.id,
    payload: { tagName: tag.name },
  });
  revalidatePath(`/contacts/${contact.id}`);
}

export async function createTag(formData: FormData) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to create tags.");
  }
  const input = tagSchema.parse(Object.fromEntries(formData));
  await prisma.tag.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: input.name, color: input.color }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Tag" });
  revalidatePath("/contacts");
}

export async function createCustomField(formData: FormData) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to create custom fields.");
  }
  const input = customFieldSchema.parse(Object.fromEntries(formData));
  await prisma.customField.create({
    data: { agencyId: user.agencyId, subAccountId: user.subAccountId, name: input.name, key: input.key, type: input.type, required: input.required }
  });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "CustomField" });
  revalidatePath("/contacts");
}

export async function addContactNote(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const input = addNoteSchema.parse(raw);
  const { user, contact } = await requireContactAccess(input.contactId);

  const conversation = await prisma.conversation.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      contactId: contact.id,
      channel: "INTERNAL_NOTE",
      status: "CLOSED",
      subject: "Internal note",
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body: input.body,
      direction: "outbound",
    },
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Conversation",
    entityId: conversation.id,
    metadata: { type: "INTERNAL_NOTE", contactId: contact.id },
  });

  revalidatePath(`/contacts/${input.contactId}`);
}

export async function deleteContactNote(formData: FormData) {
  const raw = {
    conversationId: String(formData.get("conversationId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
  };
  const input = deleteNoteSchema.parse(raw);
  const { user, contact } = await requireContactAccess(input.contactId);

  // Verify the conversation belongs to this contact and is an internal note
  const conversation = await prisma.conversation.findFirstOrThrow({
    where: {
      id: input.conversationId,
      contactId: contact.id,
      channel: "INTERNAL_NOTE",
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
    },
  });

  await prisma.conversation.delete({ where: { id: conversation.id } });
  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "DELETE",
    entityType: "Conversation",
    entityId: conversation.id,
    metadata: { type: "INTERNAL_NOTE", contactId: contact.id },
  });

  revalidatePath(`/contacts/${input.contactId}`);
}

export async function createContactTask(formData: FormData) {
  const raw = {
    contactId: String(formData.get("contactId") ?? ""),
    title: String(formData.get("title") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    assignedUserId: String(formData.get("assignedUserId") ?? ""),
  };
  const input = createTaskSchema.parse(raw);
  const { user, contact } = await requireContactAccess(input.contactId);

  // Verify assignedUserId belongs to this sub-account if provided
  let resolvedAssignedUserId: string | null = null;
  if (input.assignedUserId) {
    const membership = await prisma.subAccountMembership.findFirst({
      where: { subAccountId: user.subAccountId, userId: input.assignedUserId },
    });
    resolvedAssignedUserId = membership ? input.assignedUserId : null;
  }

  const task = await prisma.contactTask.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      contactId: contact.id,
      title: input.title,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignedUserId: resolvedAssignedUserId,
    },
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "ContactTask",
    entityId: task.id,
    metadata: { contactId: contact.id },
  });

  revalidatePath(`/contacts/${input.contactId}`);
}

export async function completeContactTask(formData: FormData) {
  const raw = {
    taskId: String(formData.get("taskId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
  };
  const input = taskIdSchema.parse(raw);
  const { user, contact } = await requireContactAccess(input.contactId);

  await prisma.contactTask.updateMany({
    where: {
      id: input.taskId,
      contactId: contact.id,
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
    },
    data: { completedAt: new Date() },
  });

  revalidatePath(`/contacts/${input.contactId}`);
}

export async function uncompleteContactTask(formData: FormData) {
  const raw = {
    taskId: String(formData.get("taskId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
  };
  const input = taskIdSchema.parse(raw);
  const { user, contact } = await requireContactAccess(input.contactId);

  await prisma.contactTask.updateMany({
    where: {
      id: input.taskId,
      contactId: contact.id,
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
    },
    data: { completedAt: null },
  });

  revalidatePath(`/contacts/${input.contactId}`);
}

export async function deleteContactTask(formData: FormData) {
  const raw = {
    taskId: String(formData.get("taskId") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
  };
  const input = taskIdSchema.parse(raw);
  const { user, contact } = await requireContactAccess(input.contactId);

  await prisma.contactTask.deleteMany({
    where: {
      id: input.taskId,
      contactId: contact.id,
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
    },
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "DELETE",
    entityType: "ContactTask",
    entityId: input.taskId,
    metadata: { contactId: contact.id },
  });

  revalidatePath(`/contacts/${input.contactId}`);
}

export async function startSmsConversation(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const input = startSmsSchema.parse(raw);
  const { user, contact } = await requireContactAccess(input.contactId);

  if (contact.smsOptOut) {
    throw new Error("This contact has opted out of SMS messages.");
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      contactId: contact.id,
      channel: "SMS",
      status: { in: ["OPEN", "PENDING"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    redirect(`/conversations?id=${existing.id}`);
  }

  const conversation = await prisma.conversation.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      contactId: contact.id,
      channel: "SMS",
      status: "OPEN",
    },
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Conversation",
    entityId: conversation.id,
    metadata: { channel: "SMS", contactId: contact.id },
  });

  revalidatePath("/conversations");
  redirect(`/conversations?id=${conversation.id}`);
}

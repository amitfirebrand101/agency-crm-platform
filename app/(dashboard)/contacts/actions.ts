"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { contactSchema, customFieldSchema, tagSchema } from "@/lib/validation";
import { runAutomationsForEvent } from "@/lib/automations/executor";

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

export async function createContact(formData: FormData) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to create contacts.");
  }
  const input = contactSchema.parse(Object.fromEntries(formData));
  const contact = await prisma.contact.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email || null,
      phone: input.phone || null,
      companyName: input.companyName || null,
      source: input.source || null
    }
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "CREATE", entityType: "Contact", entityId: contact.id });

  await runAutomationsForEvent({
    type: "CONTACT_CREATED",
    agencyId: user.agencyId,
    subAccountId: user.subAccountId,
    contactId: contact.id,
    payload: { email: contact.email, firstName: contact.firstName, lastName: contact.lastName, source: contact.source }
  });

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
}

export async function updateContact(formData: FormData) {
  const contactId = String(formData.get("contactId") ?? "");
  const { user, contact } = await requireContactAccess(contactId);
  const input = contactSchema.parse(Object.fromEntries(formData));

  await prisma.contact.update({
    where: { id: contact.id, agencyId: user.agencyId, subAccountId: user.subAccountId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName || null,
      email: input.email || null,
      phone: input.phone || null,
      companyName: input.companyName || null,
      source: input.source || null,
      status: input.status ?? contact.status
    }
  });

  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", entityId: contact.id });
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

  const tag = await prisma.tag.findFirstOrThrow({ where: { id: tagId, agencyId: user.agencyId } });
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

  await prisma.contactTag.deleteMany({ where: { contactId: contact.id, tagId } });
  await auditLog({ agencyId: user.agencyId, actorUserId: user.id, action: "UPDATE", entityType: "Contact", entityId: contact.id, metadata: { removedTagId: tagId } });
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

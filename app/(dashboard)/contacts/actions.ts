"use server";

import { revalidatePath } from "next/cache";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { contactSchema, customFieldSchema, tagSchema } from "@/lib/validation";

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

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Contact",
    entityId: contact.id
  });

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
}

export async function createTag(formData: FormData) {
  const user = await requireUser();

  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to create tags.");
  }

  const input = tagSchema.parse(Object.fromEntries(formData));

  await prisma.tag.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: input.name,
      color: input.color
    }
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "Tag"
  });

  revalidatePath("/contacts");
}

export async function createCustomField(formData: FormData) {
  const user = await requireUser();

  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to create custom fields.");
  }

  const input = customFieldSchema.parse(Object.fromEntries(formData));

  await prisma.customField.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name: input.name,
      key: input.key,
      type: input.type,
      required: input.required
    }
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "CustomField"
  });

  revalidatePath("/contacts");
}

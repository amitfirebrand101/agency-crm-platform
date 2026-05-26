"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";

async function requireAccess() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("Permission denied.");
  }
  return user as typeof user & { subAccountId: string };
}

export async function searchContacts(query: string): Promise<{
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
  }>;
  error: string | null;
}> {
  try {
    const user = await requireUser();
    if (!user.subAccountId) return { contacts: [], error: null };

    const q = query.trim();
    if (q.length < 2) return { contacts: [], error: null };

    const contacts = await prisma.contact.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        companyName: true,
      },
      take: 10,
      orderBy: { firstName: "asc" },
    });

    return { contacts, error: null };
  } catch (err) {
    return { contacts: [], error: String(err instanceof Error ? err.message : err) };
  }
}

const mergeSchema = z.object({
  primaryId: z.string().uuid(),
  secondaryId: z.string().uuid(),
});

export async function mergeContacts(
  primaryId: string,
  secondaryId: string
): Promise<{ error: string | null }> {
  try {
    const user = await requireAccess();
    const ids = mergeSchema.parse({ primaryId, secondaryId });

    if (ids.primaryId === ids.secondaryId) {
      return { error: "Cannot merge a contact with itself." };
    }

    const [primary, secondary] = await Promise.all([
      prisma.contact.findFirst({
        where: { id: ids.primaryId, agencyId: user.agencyId, subAccountId: user.subAccountId },
      }),
      prisma.contact.findFirst({
        where: { id: ids.secondaryId, agencyId: user.agencyId, subAccountId: user.subAccountId },
      }),
    ]);

    if (!primary) return { error: "Primary contact not found." };
    if (!secondary) return { error: "Secondary contact not found." };

    // Fetch existing tag and custom field IDs on primary to avoid duplicate-key violations
    const [primaryTagIds, primaryCustomFieldIds] = await Promise.all([
      prisma.contactTag
        .findMany({ where: { contactId: ids.primaryId }, select: { tagId: true } })
        .then((rows) => rows.map((r) => r.tagId)),
      prisma.customFieldValue
        .findMany({ where: { contactId: ids.primaryId }, select: { customFieldId: true } })
        .then((rows) => rows.map((r) => r.customFieldId)),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.conversation.updateMany({
        where: { contactId: ids.secondaryId, agencyId: user.agencyId },
        data: { contactId: ids.primaryId },
      });
      await tx.appointment.updateMany({
        where: { contactId: ids.secondaryId },
        data: { contactId: ids.primaryId },
      });
      await tx.opportunity.updateMany({
        where: { contactId: ids.secondaryId, agencyId: user.agencyId },
        data: { contactId: ids.primaryId },
      });
      await tx.contactTask.updateMany({
        where: { contactId: ids.secondaryId, agencyId: user.agencyId },
        data: { contactId: ids.primaryId },
      });

      // Drop duplicate tags before reassigning
      if (primaryTagIds.length > 0) {
        await tx.contactTag.deleteMany({
          where: { contactId: ids.secondaryId, tagId: { in: primaryTagIds } },
        });
      }
      await tx.contactTag.updateMany({
        where: { contactId: ids.secondaryId },
        data: { contactId: ids.primaryId },
      });

      // Drop duplicate custom field values before reassigning
      if (primaryCustomFieldIds.length > 0) {
        await tx.customFieldValue.deleteMany({
          where: { contactId: ids.secondaryId, customFieldId: { in: primaryCustomFieldIds } },
        });
      }
      await tx.customFieldValue.updateMany({
        where: { contactId: ids.secondaryId },
        data: { contactId: ids.primaryId },
      });

      await tx.formSubmission.updateMany({
        where: { contactId: ids.secondaryId },
        data: { contactId: ids.primaryId },
      });

      // Fill gaps on primary from secondary
      await tx.contact.update({
        where: { id: ids.primaryId },
        data: {
          lastName: primary.lastName ?? secondary.lastName ?? undefined,
          email: primary.email ?? secondary.email ?? undefined,
          phone: primary.phone ?? secondary.phone ?? undefined,
          companyName: primary.companyName ?? secondary.companyName ?? undefined,
          source: primary.source ?? secondary.source ?? undefined,
          addressLine1: primary.addressLine1 ?? secondary.addressLine1 ?? undefined,
          city: primary.city ?? secondary.city ?? undefined,
          region: primary.region ?? secondary.region ?? undefined,
          country: primary.country ?? secondary.country ?? undefined,
          postalCode: primary.postalCode ?? secondary.postalCode ?? undefined,
          timezone: primary.timezone ?? secondary.timezone ?? undefined,
          assignedUserId: primary.assignedUserId ?? secondary.assignedUserId ?? undefined,
          score: Math.max(primary.score, secondary.score),
        },
      });

      await tx.contact.delete({ where: { id: ids.secondaryId } });
    });

    await auditLog({
      agencyId: user.agencyId,
      actorUserId: user.id,
      action: "DELETE",
      entityType: "Contact",
      entityId: ids.secondaryId,
      metadata: { mergedIntoPrimaryId: ids.primaryId, mergeAction: true },
    });

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${ids.primaryId}`);
  } catch (err) {
    const zodErr = err as z.ZodError;
    if (zodErr?.issues) return { error: zodErr.issues[0]?.message ?? "Invalid input." };
    return { error: String(err instanceof Error ? err.message : err) };
  }

  redirect(`/contacts/${primaryId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser, canWriteSubAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REVALIDATE_PATH = "/settings/integrations/facebook";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function requireWriteAccess() {
  const user = await requireUser();
  if (!canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage Facebook integrations.");
  }
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Disconnect Facebook
// ─────────────────────────────────────────────────────────────────────────────

export async function disconnectFacebook(_formData: FormData): Promise<void> {
  try {
    const user = await requireWriteAccess();

    const subAccountId = user.subAccountId ?? "";

    await prisma.providerCredential.deleteMany({
      where: {
        agencyId:     user.agencyId,
        subAccountId,
        provider:     "facebook",
      },
    });

    revalidatePath(REVALIDATE_PATH);
  } catch (err) {
    console.error("[facebook-actions] disconnectFacebook failed", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save (upsert) a Facebook Lead Form
// ─────────────────────────────────────────────────────────────────────────────

export async function saveFacebookLeadForm(formData: FormData): Promise<void> {
  try {
    const user = await requireWriteAccess();

    const subAccountId = user.subAccountId;
    if (!subAccountId) {
      console.error("[facebook-actions] saveFacebookLeadForm — user has no subAccountId");
      return;
    }

    const fbFormId   = String(formData.get("fbFormId")  ?? "").trim();
    const fbFormName = String(formData.get("fbFormName") ?? "").trim();
    const fbPageId   = String(formData.get("fbPageId")   ?? "").trim();

    if (!fbFormId || !fbFormName || !fbPageId) {
      console.error("[facebook-actions] saveFacebookLeadForm — missing required fields");
      return;
    }

    // The page sends individual mapping__{crmField} selects. Assemble them here.
    const CRM_FIELDS = ["email", "phone", "firstName", "lastName", "companyName", "source"];
    const fieldMappings: Record<string, string> = {};
    for (const key of CRM_FIELDS) {
      const fbFieldName = String(formData.get(`mapping__${key}`) ?? "").trim();
      if (fbFieldName) {
        fieldMappings[key] = fbFieldName;
      }
    }

    await prisma.facebookLeadForm.upsert({
      where: {
        subAccountId_fbFormId: {
          subAccountId,
          fbFormId,
        },
      },
      update: {
        fbPageId,
        fbFormName,
        fieldMappings,
      },
      create: {
        agencyId:     user.agencyId,
        subAccountId,
        fbPageId,
        fbFormId,
        fbFormName,
        fieldMappings,
        active:       true,
      },
    });

    revalidatePath(REVALIDATE_PATH);
  } catch (err) {
    console.error("[facebook-actions] saveFacebookLeadForm failed", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a Facebook Lead Form
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteFacebookLeadForm(formData: FormData): Promise<void> {
  try {
    const user = await requireWriteAccess();

    const formId = String(formData.get("id") ?? "").trim();
    if (!formId) {
      console.error("[facebook-actions] deleteFacebookLeadForm — missing id");
      return;
    }

    // Verify ownership before deleting
    const record = await prisma.facebookLeadForm.findUnique({
      where: { id: formId },
    });

    if (!record || record.agencyId !== user.agencyId) {
      console.warn("[facebook-actions] deleteFacebookLeadForm — ownership mismatch or not found", {
        formId,
        agencyId: user.agencyId,
      });
      return;
    }

    if (user.subAccountId && record.subAccountId !== user.subAccountId) {
      console.warn("[facebook-actions] deleteFacebookLeadForm — subAccount mismatch", {
        formId,
        subAccountId: user.subAccountId,
      });
      return;
    }

    await prisma.facebookLeadForm.delete({ where: { id: formId } });

    revalidatePath(REVALIDATE_PATH);
  } catch (err) {
    console.error("[facebook-actions] deleteFacebookLeadForm failed", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle a form's active status
// ─────────────────────────────────────────────────────────────────────────────

export async function toggleFormActive(formData: FormData): Promise<void> {
  try {
    const user = await requireWriteAccess();

    const formId = String(formData.get("id") ?? "").trim();
    if (!formId) {
      console.error("[facebook-actions] toggleFormActive — missing id");
      return;
    }

    // Verify ownership before mutating
    const record = await prisma.facebookLeadForm.findUnique({
      where: { id: formId },
    });

    if (!record || record.agencyId !== user.agencyId) {
      console.warn("[facebook-actions] toggleFormActive — ownership mismatch or not found", {
        formId,
        agencyId: user.agencyId,
      });
      return;
    }

    if (user.subAccountId && record.subAccountId !== user.subAccountId) {
      console.warn("[facebook-actions] toggleFormActive — subAccount mismatch", {
        formId,
        subAccountId: user.subAccountId,
      });
      return;
    }

    await prisma.facebookLeadForm.update({
      where: { id: formId },
      data:  { active: !record.active },
    });

    revalidatePath(REVALIDATE_PATH);
  } catch (err) {
    console.error("[facebook-actions] toggleFormActive failed", err);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Schemas ────────────────────────────────────────────────────────────────────

const sendReviewRequestSchema = z.object({
  contactId: z.string().uuid("Invalid contact ID"),
  platform: z.enum(["google", "yelp", "facebook"], { message: "Invalid platform" }),
  channel: z.enum(["SMS", "Email"], { message: "Invalid channel" }),
  reviewUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .pipe(z.string().url("Review URL must be a valid URL").optional()),
});

const deleteReviewRequestSchema = z.object({
  id: z.string().uuid("Invalid request ID"),
});

// ── Actions ────────────────────────────────────────────────────────────────────

export async function sendReviewRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof sendReviewRequestSchema>;
  try {
    input = sendReviewRequestSchema.parse(Object.fromEntries(formData));
  } catch (err) {
    console.error("sendReviewRequest validation failed", err);
    return;
  }

  try {
    // Verify contact belongs to this agency + sub-account
    await prisma.contact.findFirstOrThrow({
      where: {
        id: input.contactId,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
      select: { id: true },
    });

    await prisma.reviewRequest.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        contactId: input.contactId,
        platform: input.platform,
        channel: input.channel,
        reviewUrl: input.reviewUrl ?? null,
        // NOTE: Actual SMS/email delivery requires Twilio/SMTP integration.
        // Record is stored with status "pending"; delivery status will be
        // updated by the sending integration when implemented.
        status: "pending",
        sentAt: new Date(),
      },
    });
  } catch (err) {
    console.error("sendReviewRequest failed", err);
    return;
  }

  revalidatePath("/reputation");
}

export async function deleteReviewRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof deleteReviewRequestSchema>;
  try {
    input = deleteReviewRequestSchema.parse({ id: formData.get("id") });
  } catch (err) {
    console.error("deleteReviewRequest validation failed", err);
    return;
  }

  try {
    // Verify ownership before deletion
    const request = await prisma.reviewRequest.findFirstOrThrow({
      where: {
        id: input.id,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
      select: { id: true },
    });

    await prisma.reviewRequest.delete({ where: { id: request.id } });
  } catch (err) {
    console.error("deleteReviewRequest failed", err);
    return;
  }

  revalidatePath("/reputation");
}

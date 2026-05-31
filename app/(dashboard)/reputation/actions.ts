"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twilioConfigured, sendSms } from "@/lib/twilio";
import { emailConfigured, sendEmail } from "@/lib/email";

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

  const contact = await prisma.contact.findFirst({
    where: {
      id: input.contactId,
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
    },
    select: { id: true, firstName: true, phone: true, email: true },
  });

  if (!contact) return;

  const platformLabel = input.platform.charAt(0).toUpperCase() + input.platform.slice(1);
  const reviewLink = input.reviewUrl ?? "";
  const messageBody = reviewLink
    ? `Hi ${contact.firstName}, we'd love your review on ${platformLabel}! ${reviewLink}`
    : `Hi ${contact.firstName}, we'd love your review on ${platformLabel}!`;

  let deliveryStatus: string = "pending";

  if (input.channel === "SMS") {
    if (twilioConfigured() && contact.phone) {
      try {
        await sendSms(contact.phone, messageBody);
        deliveryStatus = "sent";
      } catch (err) {
        console.error("sendReviewRequest: SMS delivery failed", err);
        deliveryStatus = "failed";
      }
    }
  } else {
    if (emailConfigured() && contact.email) {
      try {
        await sendEmail({
          to: contact.email,
          subject: `We'd love your ${platformLabel} review!`,
          text: messageBody,
          html: reviewLink
            ? `<p>${messageBody}</p><p><a href="${reviewLink}">Leave a review</a></p>`
            : `<p>${messageBody}</p>`,
        });
        deliveryStatus = "sent";
      } catch (err) {
        console.error("sendReviewRequest: email delivery failed", err);
        deliveryStatus = "failed";
      }
    }
  }

  try {
    await prisma.reviewRequest.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        contactId: input.contactId,
        platform: input.platform,
        channel: input.channel,
        reviewUrl: input.reviewUrl ?? null,
        status: deliveryStatus,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    console.error("sendReviewRequest: db write failed", err);
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
    const request = await prisma.reviewRequest.findFirst({
      where: {
        id: input.id,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
      select: { id: true },
    });
    if (!request) return;
    await prisma.reviewRequest.delete({ where: { id: request.id } });
  } catch (err) {
    console.error("deleteReviewRequest failed", err);
    return;
  }

  revalidatePath("/reputation");
}

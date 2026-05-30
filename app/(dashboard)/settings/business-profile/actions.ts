"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v ?? null));

const profileSchema = z.object({
  businessName:    z.string().trim().optional().transform((v) => v || null),
  website:         optionalUrl,
  address:         z.string().trim().optional().transform((v) => v || null),
  city:            z.string().trim().optional().transform((v) => v || null),
  state:           z.string().trim().optional().transform((v) => v || null),
  zip:             z.string().trim().optional().transform((v) => v || null),
  country:         z.string().trim().optional().transform((v) => v || null),
  timezone:        z.string().trim().optional().transform((v) => v || null),
  logoUrl:         optionalUrl,
  primaryColor:    z.string().trim().optional().transform((v) => v || "#4361ee"),
  googleReviewUrl: optionalUrl,
  yelpUrl:         optionalUrl,
  facebookUrl:     optionalUrl,
});

// ─────────────────────────────────────────────────────────────────────────────
// Save business profile fields
// ─────────────────────────────────────────────────────────────────────────────

export async function saveBusinessProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  const raw = Object.fromEntries(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("saveBusinessProfile validation failed", parsed.error.issues[0]?.message);
    return;
  }

  const {
    businessName,
    website,
    address,
    city,
    state,
    zip,
    country,
    timezone,
    logoUrl,
    primaryColor,
    googleReviewUrl,
    yelpUrl,
    facebookUrl,
  } = parsed.data;

  try {
    await prisma.businessProfile.upsert({
      where: { subAccountId: user.subAccountId },
      update: {
        businessName,
        website,
        address,
        city,
        state,
        zip,
        country,
        timezone,
        logoUrl,
        primaryColor,
        googleReviewUrl,
        yelpUrl,
        facebookUrl,
        updatedAt: new Date(),
      },
      create: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        businessName,
        website,
        address,
        city,
        state,
        zip,
        country,
        timezone,
        logoUrl,
        primaryColor,
        googleReviewUrl,
        yelpUrl,
        facebookUrl,
      },
    });
  } catch (err) {
    console.error("saveBusinessProfile failed", err);
    return;
  }

  revalidatePath("/settings/business-profile");
}

// ─────────────────────────────────────────────────────────────────────────────
// Save business hours
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export async function saveBusinessHours(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  const businessHours: Record<
    string,
    { enabled: boolean; start: string; end: string }
  > = {};

  for (const day of DAYS) {
    businessHours[day] = {
      enabled: formData.get(`enabled_${day}`) === "on",
      start: String(formData.get(`start_${day}`) ?? "09:00"),
      end: String(formData.get(`end_${day}`) ?? "17:00"),
    };
  }

  try {
    await prisma.businessProfile.upsert({
      where: { subAccountId: user.subAccountId },
      update: {
        businessHours,
        updatedAt: new Date(),
      },
      create: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        businessHours,
      },
    });
  } catch (err) {
    console.error("saveBusinessHours failed", err);
    return;
  }

  revalidatePath("/settings/business-profile");
}

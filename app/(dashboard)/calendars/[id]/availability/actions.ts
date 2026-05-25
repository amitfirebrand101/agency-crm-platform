"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const slugRe = /^[a-z0-9-]*$/;

export async function saveAvailability(
  _prev: { success?: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    return { error: "Permission denied." };
  }

  const calendarId = z.string().uuid().parse(String(formData.get("calendarId") ?? ""));

  const calendar = await prisma.calendar.findFirst({
    where: { id: calendarId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  if (!calendar) return { error: "Calendar not found." };

  const slug = (String(formData.get("bookingPageSlug") ?? "")).trim().toLowerCase() || null;
  if (slug && !slugRe.test(slug)) return { error: "Slug must be lowercase letters, numbers, and hyphens only." };

  // Parse availability windows from form (day_0_enabled, day_0_start, day_0_end, etc.)
  const windows = [];
  for (let i = 0; i < 7; i++) {
    const enabled = formData.get(`day_${i}_enabled`) === "on";
    const startTime = String(formData.get(`day_${i}_start`) ?? "09:00");
    const endTime = String(formData.get(`day_${i}_end`) ?? "17:00");
    windows.push({ dayOfWeek: i, startTime, endTime, isEnabled: enabled });
  }

  const settings = z.object({
    slotDuration: z.coerce.number().int().min(5).max(480).default(30),
    bufferBefore: z.coerce.number().int().min(0).max(120).default(0),
    bufferAfter: z.coerce.number().int().min(0).max(120).default(0),
    minNotice: z.coerce.number().int().min(0).default(60),
    maxDaysAhead: z.coerce.number().int().min(1).max(365).default(60),
    timezone: z.string().trim().max(60).default("America/New_York"),
    location: z.string().trim().max(300).optional(),
    conferenceUrl: z.string().trim().max(500).optional(),
    description: z.string().trim().max(1000).optional(),
    confirmationEmailEnabled: z.boolean().default(true),
    reminderEmailEnabled: z.boolean().default(false),
    reminderEmailHours: z.coerce.number().int().min(1).max(168).default(24),
    reminderSmsEnabled: z.boolean().default(false),
    reminderSmsHours: z.coerce.number().int().min(1).max(168).default(24),
  }).parse({
    slotDuration: formData.get("slotDuration"),
    bufferBefore: formData.get("bufferBefore"),
    bufferAfter: formData.get("bufferAfter"),
    minNotice: formData.get("minNotice"),
    maxDaysAhead: formData.get("maxDaysAhead"),
    timezone: formData.get("timezone"),
    location: formData.get("location") || undefined,
    conferenceUrl: formData.get("conferenceUrl") || undefined,
    description: formData.get("description") || undefined,
    confirmationEmailEnabled: formData.get("confirmationEmailEnabled") === "on",
    reminderEmailEnabled: formData.get("reminderEmailEnabled") === "on",
    reminderEmailHours: formData.get("reminderEmailHours"),
    reminderSmsEnabled: formData.get("reminderSmsEnabled") === "on",
    reminderSmsHours: formData.get("reminderSmsHours"),
  });

  await prisma.calendar.update({
    where: { id: calendar.id },
    data: {
      ...settings,
      bookingPageSlug: slug,
      location: settings.location ?? null,
      conferenceUrl: settings.conferenceUrl ?? null,
      description: settings.description ?? null,
    },
  });

  // Upsert availability windows
  await Promise.all(
    windows.map((w) =>
      prisma.calendarAvailability.upsert({
        where: { calendarId_dayOfWeek: { calendarId: calendar.id, dayOfWeek: w.dayOfWeek } },
        update: { startTime: w.startTime, endTime: w.endTime, isEnabled: w.isEnabled },
        create: { calendarId: calendar.id, ...w },
      })
    )
  );

  revalidatePath(`/calendars/${calendar.id}`);
  revalidatePath(`/calendars/${calendar.id}/availability`);
  return { success: true };
}

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bookingSchema = z.object({
  calendarId: z.string().uuid(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(32).optional(),
});

export async function bookAppointment(
  formData: FormData
): Promise<{ error?: string }> {
  // Parse and validate core fields — coerce empty strings to undefined for optional fields
  const getString = (key: string) => {
    const v = formData.get(key);
    if (v === null || v === "") return undefined;
    return String(v);
  };

  const raw = {
    calendarId: getString("calendarId"),
    startsAt: getString("startsAt"),
    endsAt: getString("endsAt"),
    firstName: getString("firstName"),
    lastName: getString("lastName"),
    email: getString("email"),
    phone: getString("phone"),
  };

  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message ?? "Invalid form data." };
  }

  const input = parsed.data;

  let startsAt: Date;
  let endsAt: Date;
  try {
    startsAt = new Date(input.startsAt);
    endsAt = new Date(input.endsAt);
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
      return { error: "Invalid date/time values." };
    }
  } catch {
    return { error: "Invalid date/time values." };
  }

  if (endsAt <= startsAt) {
    return { error: "End time must be after start time." };
  }

  try {
    // Verify calendar exists
    const calendar = await prisma.calendar.findFirst({
      where: { id: input.calendarId },
      select: {
        id: true,
        agencyId: true,
        subAccountId: true,
        name: true,
        slotDuration: true,
        minNotice: true,
      },
    });

    if (!calendar) {
      return { error: "Calendar not found." };
    }

    // Enforce minNotice
    const minNoticeMs = calendar.minNotice * 60 * 1000;
    if (startsAt.getTime() - Date.now() < minNoticeMs) {
      return { error: "This time slot is no longer available (insufficient notice)." };
    }

    // Check for overlapping appointments (exclude cancelled / no_show)
    const overlap = await prisma.appointment.findFirst({
      where: {
        calendarId: calendar.id,
        status: { notIn: ["cancelled", "no_show"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });

    if (overlap) {
      return { error: "That time slot has just been booked. Please choose another." };
    }

    // Find or create contact by email within the same agency/sub-account
    let contact = await prisma.contact.findFirst({
      where: {
        agencyId: calendar.agencyId,
        subAccountId: calendar.subAccountId,
        email: input.email,
      },
      select: { id: true },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          agencyId: calendar.agencyId,
          subAccountId: calendar.subAccountId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          email: input.email,
          phone: input.phone ?? null,
        },
        select: { id: true },
      });
    }

    // Collect custom question answers from formData (keys prefixed "q_")
    const customAnswers: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("q_")) {
        const questionId = key.slice(2);
        customAnswers[questionId] = String(value);
      }
    }

    // Create the appointment
    await prisma.appointment.create({
      data: {
        calendarId: calendar.id,
        contactId: contact.id,
        title: `Appointment — ${input.firstName}${input.lastName ? ` ${input.lastName}` : ""}`,
        startsAt,
        endsAt,
        status: "scheduled",
        contactEmail: input.email,
        contactPhone: input.phone ?? null,
        customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
      },
    });

    return {};
  } catch (err) {
    console.error("[bookAppointment] error:", err);
    return { error: "Something went wrong. Please try again." };
  }
}

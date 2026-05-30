"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/google-calendar";

const REVALIDATE_PATH = "/settings/integrations/google";

// ─────────────────────────────────────────────────────────────────────────────
// Disconnect Google Calendar
// ─────────────────────────────────────────────────────────────────────────────

export async function disconnectGoogle(_formData?: FormData): Promise<void> {
  const user = await requireUser();

  try {
    await prisma.userOAuthToken.delete({
      where: {
        userId_provider: { userId: user.id, provider: "google_calendar" },
      },
    });
  } catch (err) {
    // If the record doesn't exist that's fine — treat as already disconnected
    if ((err as { code?: string }).code !== "P2025") {
      console.error("[disconnectGoogle] Failed to delete token", err);
    }
    return;
  }

  revalidatePath(REVALIDATE_PATH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync a single appointment to Google Calendar
// ─────────────────────────────────────────────────────────────────────────────

export async function syncAppointment(formData: FormData): Promise<void> {
  const user          = await requireUser();
  const appointmentId = (formData.get("appointmentId") as string | null)?.trim();

  if (!appointmentId) {
    console.error("[syncAppointment] appointmentId is required");
    return;
  }

  // Load the appointment, verify ownership via calendar
  const appointment = await prisma.appointment.findUnique({
    where:   { id: appointmentId },
    include: { calendar: true },
  });

  if (
    !appointment ||
    appointment.calendar.agencyId     !== user.agencyId ||
    (user.subAccountId && appointment.calendar.subAccountId !== user.subAccountId)
  ) {
    console.error("[syncAppointment] Appointment not found or access denied", { appointmentId });
    return;
  }

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    console.error("[syncAppointment] No valid Google access token for user", user.id);
    return;
  }

  const eventPayload = {
    summary:     appointment.title,
    description: appointment.notes ?? undefined,
    start: {
      dateTime: appointment.startsAt.toISOString(),
      timeZone: appointment.calendar.timezone,
    },
    end: {
      dateTime: appointment.endsAt.toISOString(),
      timeZone: appointment.calendar.timezone,
    },
    attendees: appointment.contactEmail
      ? [{ email: appointment.contactEmail }]
      : undefined,
  };

  try {
    if (appointment.googleEventId) {
      await updateCalendarEvent(accessToken, appointment.googleEventId, eventPayload);
    } else {
      const created = await createCalendarEvent(accessToken, eventPayload);
      await prisma.appointment.update({
        where: { id: appointmentId },
        data:  { googleEventId: created.id },
      });
    }
  } catch (err) {
    console.error("[syncAppointment] Google Calendar API error", err);
    return;
  }

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/calendars");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync all future appointments (capped at 100)
// ─────────────────────────────────────────────────────────────────────────────

export async function syncAllAppointments(_formData?: FormData): Promise<void> {
  const user = await requireUser();

  const accessToken = await getValidAccessToken(user.id);
  if (!accessToken) {
    console.error("[syncAllAppointments] No valid Google access token for user", user.id);
    return;
  }

  // Fetch future appointments belonging to this user's sub-account calendars
  const now = new Date();
  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: now },
      calendar: {
        agencyId:     user.agencyId,
        ...(user.subAccountId ? { subAccountId: user.subAccountId } : {}),
      },
    },
    include: { calendar: true },
    orderBy: { startsAt: "asc" },
    take:    100,
  });

  let synced  = 0;
  let errored = 0;

  for (const appointment of appointments) {
    const eventPayload = {
      summary:     appointment.title,
      description: appointment.notes ?? undefined,
      start: {
        dateTime: appointment.startsAt.toISOString(),
        timeZone: appointment.calendar.timezone,
      },
      end: {
        dateTime: appointment.endsAt.toISOString(),
        timeZone: appointment.calendar.timezone,
      },
      attendees: appointment.contactEmail
        ? [{ email: appointment.contactEmail }]
        : undefined,
    };

    try {
      if (appointment.googleEventId) {
        await updateCalendarEvent(accessToken, appointment.googleEventId, eventPayload);
      } else {
        const created = await createCalendarEvent(accessToken, eventPayload);
        await prisma.appointment.update({
          where: { id: appointment.id },
          data:  { googleEventId: created.id },
        });
      }
      synced++;
    } catch (err) {
      errored++;
      console.error("[syncAllAppointments] Failed for appointment", appointment.id, err);
    }
  }

  console.info(`[syncAllAppointments] Done — synced: ${synced}, errored: ${errored}`);
  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/calendars");
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { emailConfigured, sendAppointmentReminder } from "@/lib/email";
import { twilioConfigured, sendSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // allow if not set (development)
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

/**
 * GET /api/cron/reminders
 *
 * Runs every 15 minutes (see vercel.json).
 * Finds appointments where:
 *   - reminderSent = false
 *   - startsAt is within the reminder window (email or SMS hours before)
 *   - status is "scheduled" or "confirmed"
 * Sends the reminder and marks reminderSent = true.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let sent = 0;
  let failed = 0;

  try {
    // Fetch upcoming appointments that haven't had reminders sent yet
    // We check a 15-minute window (matching cron interval) looking ahead
    const appointments = await prisma.appointment.findMany({
      where: {
        reminderSent: false,
        status:       { in: ["scheduled", "confirmed"] },
        startsAt:     { gte: now }, // hasn't already started
      },
      include: {
        calendar: {
          select: {
            name:                 true,
            timezone:             true,
            location:             true,
            conferenceUrl:        true,
            reminderEmailEnabled: true,
            reminderEmailHours:   true,
            reminderSmsEnabled:   true,
            reminderSmsHours:     true,
          },
        },
      },
      take: 100,
    });

    for (const appt of appointments) {
      const cal         = appt.calendar;
      const hoursUntil  = (appt.startsAt.getTime() - now.getTime()) / 3_600_000;
      let shouldSend    = false;

      // Email reminder
      if (
        cal.reminderEmailEnabled &&
        appt.contactEmail &&
        emailConfigured() &&
        hoursUntil <= cal.reminderEmailHours &&
        hoursUntil > 0
      ) {
        try {
          // Title format is "Contact Name — Calendar Name"
          const contactName = appt.title.split(" — ")[0] ?? appt.title;
          await sendAppointmentReminder({
            to:            appt.contactEmail,
            contactName,
            calendarName:  cal.name,
            startsAt:      appt.startsAt,
            timezone:      cal.timezone,
            location:      cal.location ?? undefined,
            conferenceUrl: cal.conferenceUrl ?? undefined,
          });
          shouldSend = true;
        } catch (err) {
          logger.error("Failed to send reminder email", { appointmentId: appt.id, error: String(err) });
          failed++;
        }
      }

      // SMS reminder
      if (
        cal.reminderSmsEnabled &&
        appt.contactPhone &&
        twilioConfigured() &&
        hoursUntil <= cal.reminderSmsHours &&
        hoursUntil > 0
      ) {
        try {
          const dateStr = appt.startsAt.toLocaleString("en-US", {
            timeZone:     cal.timezone,
            weekday:      "short",
            month:        "short",
            day:          "numeric",
            hour:         "numeric",
            minute:       "2-digit",
          });
          await sendSms(
            appt.contactPhone,
            `Reminder: "${appt.title}" is on ${dateStr}.${cal.location ? ` Location: ${cal.location}` : ""}`
          );
          shouldSend = true;
        } catch (err) {
          logger.error("Failed to send reminder SMS", { appointmentId: appt.id, error: String(err) });
          failed++;
        }
      }

      if (shouldSend) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data:  { reminderSent: true },
        });
        sent++;
      }
    }

    logger.info("Reminder cron completed", { sent, failed });
    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    logger.error("Reminder cron failed", { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

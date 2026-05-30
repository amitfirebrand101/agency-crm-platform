/**
 * google-calendar-sync.ts
 *
 * Exported helper called by other parts of the app (e.g., booking flows,
 * appointment update actions) to silently sync a single appointment to Google
 * Calendar after it has been created or modified.
 *
 * Strategy for finding the syncing user:
 *   1. Find the SubAccountMembership with an ADMIN role for the calendar's
 *      sub-account — that user is most likely the calendar owner.
 *   2. Fall back to any active AgencyMembership (OWNER first) for the agency.
 *   3. If no candidate user has a connected Google token, silently no-op.
 *
 * This is intentionally fire-and-forget — it never throws to the caller.
 */

import { prisma } from "@/lib/prisma";
import {
  getValidAccessToken,
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/google-calendar";

export async function syncAppointmentToGoogle(appointmentId: string): Promise<void> {
  try {
    // Load the appointment with its calendar
    const appointment = await prisma.appointment.findUnique({
      where:   { id: appointmentId },
      include: { calendar: true },
    });

    if (!appointment) return;

    const { calendar } = appointment;

    // ── Resolve which user to sync as ─────────────────────────────────────
    // Try sub-account admins first (most specific), then agency owners.
    const candidateUserIds = await resolveSyncCandidates(
      calendar.agencyId,
      calendar.subAccountId
    );

    if (candidateUserIds.length === 0) return;

    // Find the first candidate that has a connected, valid Google token
    let accessToken: string | null = null;

    for (const userId of candidateUserIds) {
      const token = await getValidAccessToken(userId);
      if (token) {
        accessToken = token;
        break;
      }
    }

    if (!accessToken) return; // No one has Google connected — silently skip

    // ── Build the event payload ────────────────────────────────────────────
    const eventPayload = {
      summary:     appointment.title,
      description: appointment.notes ?? undefined,
      start: {
        dateTime: appointment.startsAt.toISOString(),
        timeZone: calendar.timezone,
      },
      end: {
        dateTime: appointment.endsAt.toISOString(),
        timeZone: calendar.timezone,
      },
      attendees: appointment.contactEmail
        ? [{ email: appointment.contactEmail }]
        : undefined,
    };

    // ── Create or update the Google event ─────────────────────────────────
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
    // Never surface to caller — this is best-effort sync
    console.error("[syncAppointmentToGoogle] Error syncing appointment", appointmentId, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an ordered list of candidate user IDs to attempt syncing as.
 * Sub-account ADMINs come before agency OWNERs.
 */
async function resolveSyncCandidates(
  agencyId: string,
  subAccountId: string
): Promise<string[]> {
  const [subMembers, agencyMembers] = await Promise.all([
    prisma.subAccountMembership.findMany({
      where:   { subAccountId, role: "ADMIN" },
      select:  { userId: true },
      orderBy: { createdAt: "asc" },
      take:    5,
    }),
    prisma.agencyMembership.findMany({
      where:   { agencyId, deactivatedAt: null, role: { in: ["OWNER", "ADMIN"] } },
      select:  { userId: true, role: true },
      orderBy: { createdAt: "asc" },
      take:    5,
    }),
  ]);

  const seen   = new Set<string>();
  const result: string[] = [];

  for (const m of subMembers) {
    if (!seen.has(m.userId)) {
      seen.add(m.userId);
      result.push(m.userId);
    }
  }

  // Agency owners first, then admins
  const owners = agencyMembers.filter((m) => m.role === "OWNER");
  const admins = agencyMembers.filter((m) => m.role !== "OWNER");

  for (const m of [...owners, ...admins]) {
    if (!seen.has(m.userId)) {
      seen.add(m.userId);
      result.push(m.userId);
    }
  }

  return result;
}

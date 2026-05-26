/**
 * Public booking API — no auth required.
 *
 * GET  /api/book/[calendarId]?date=YYYY-MM-DD  → available slots for a day
 * POST /api/book/[calendarId]                   → create booking
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSlotsForDay } from "@/lib/booking";
import { sendAppointmentConfirmation } from "@/lib/email";
import { emailConfigured } from "@/lib/email";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ calendarId: string }> };

async function findCalendar(calendarId: string) {
  // Accept either the UUID or bookingPageSlug
  const isUuid = /^[0-9a-f-]{36}$/.test(calendarId);
  return prisma.calendar.findFirst({
    where: isUuid ? { id: calendarId } : { bookingPageSlug: calendarId },
    include: { availability: true },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { calendarId } = await ctx.params;
  const dateStr = req.nextUrl.searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date param required (YYYY-MM-DD)" }, { status: 400 });
  }

  const calendar = await findCalendar(calendarId);
  if (!calendar) return NextResponse.json({ error: "Calendar not found." }, { status: 404 });

  const appointments = await prisma.appointment.findMany({
    where: {
      calendarId: calendar.id,
      startsAt: { gte: new Date(`${dateStr}T00:00:00`), lt: new Date(`${dateStr}T23:59:59`) },
    },
    select: { startsAt: true, endsAt: true, status: true },
  });

  const slots = getSlotsForDay(dateStr, calendar, calendar.availability, appointments);
  return NextResponse.json({ slots });
}

const bookingSchema = z.object({
  calendarId: z.string().min(1),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().email().max(200),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  customAnswers: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  const { calendarId } = await ctx.params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(LIMITS.booking, ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many booking requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let input: z.infer<typeof bookingSchema>;
  try {
    input = bookingSchema.parse({ calendarId, ...(body as object) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 });
  }

  const calendar = await findCalendar(calendarId);
  if (!calendar) return NextResponse.json({ error: "Calendar not found." }, { status: 404 });

  // Verify the slot is still available
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const dateStr = input.startsAt.slice(0, 10);

  const appointments = await prisma.appointment.findMany({
    where: {
      calendarId: calendar.id,
      startsAt: { gte: new Date(`${dateStr}T00:00:00`), lt: new Date(`${dateStr}T23:59:59`) },
    },
    select: { startsAt: true, endsAt: true, status: true },
  });

  const slots = getSlotsForDay(dateStr, calendar, calendar.availability, appointments);
  const slotTaken = !slots.some((s) => s.start === input.startsAt);
  if (slotTaken) {
    return NextResponse.json({ error: "This time slot is no longer available. Please pick another." }, { status: 409 });
  }

  // Find or create contact
  let contactId: string | null = null;
  try {
    let contact = await prisma.contact.findFirst({
      where: { subAccountId: calendar.subAccountId, email: input.email },
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
          source: "Booking page",
        },
      });
    }
    contactId = contact.id;
  } catch { /* non-fatal */ }

  const confirmToken = crypto.randomUUID();
  const cancelToken = crypto.randomUUID();
  const rescheduleToken = crypto.randomUUID();

  const appointment = await prisma.appointment.create({
    data: {
      calendarId: calendar.id,
      contactId,
      title: `${input.firstName}${input.lastName ? ` ${input.lastName}` : ""} — ${calendar.name}`,
      startsAt,
      endsAt,
      status: "scheduled",
      notes: input.notes ?? null,
      customAnswers: input.customAnswers ?? undefined,
      contactEmail: input.email,
      contactPhone: input.phone ?? null,
      confirmToken,
      cancelToken,
      rescheduleToken,
    },
  });

  // Send confirmation email (non-fatal)
  if (calendar.confirmationEmailEnabled && emailConfigured()) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    sendAppointmentConfirmation({
      to: input.email,
      contactName: `${input.firstName}${input.lastName ? ` ${input.lastName}` : ""}`,
      calendarName: calendar.name,
      startsAt,
      timezone: calendar.timezone,
      location: calendar.location ?? undefined,
      conferenceUrl: calendar.conferenceUrl ?? undefined,
      cancelUrl: `${appUrl}/book/cancel/${cancelToken}`,
      rescheduleUrl: `${appUrl}/book/${calendarId}?reschedule=${rescheduleToken}`,
    }).catch(console.error);
  }

  return NextResponse.json({
    ok: true,
    appointmentId: appointment.id,
    startsAt: appointment.startsAt.toISOString(),
  });
}

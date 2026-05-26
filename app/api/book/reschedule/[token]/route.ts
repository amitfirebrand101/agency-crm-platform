/**
 * POST /api/book/reschedule/[token]
 *
 * Public endpoint — no auth required.
 * Reschedules an appointment to a new time slot identified by its rescheduleToken.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSlotsForDay } from "@/lib/booking";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ token: string }> };

const rescheduleSchema = z.object({
  newStartsAt: z.string().datetime({ message: "newStartsAt must be a valid ISO datetime string" }),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;

  // ─── Rate limit ────────────────────────────────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(LIMITS.booking, ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // ─── Parse body (supports both JSON and form-encoded from <form method="POST">) ──
  let rawNewStartsAt: string | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const fd = new URLSearchParams(text);
    rawNewStartsAt = fd.get("newStartsAt");
  } else {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    rawNewStartsAt = typeof body === "object" && body !== null && "newStartsAt" in body
      ? String((body as Record<string, unknown>).newStartsAt)
      : null;
  }

  if (!rawNewStartsAt) {
    return NextResponse.json({ error: "newStartsAt is required." }, { status: 422 });
  }

  let input: z.infer<typeof rescheduleSchema>;
  try {
    input = rescheduleSchema.parse({ newStartsAt: rawNewStartsAt });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 });
  }

  // ─── Fetch appointment ─────────────────────────────────────────────────────
  const appointment = await prisma.appointment.findUnique({
    where: { rescheduleToken: token },
    include: {
      calendar: {
        include: { availability: true },
      },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json(
      { error: "Cannot reschedule a cancelled appointment." },
      { status: 400 }
    );
  }

  const now = new Date();
  if (
    appointment.startsAt < now ||
    appointment.status === "completed" ||
    appointment.status === "no_show"
  ) {
    return NextResponse.json(
      { error: "Cannot reschedule a past appointment." },
      { status: 400 }
    );
  }

  // ─── Validate the requested slot is available ──────────────────────────────
  const newStartsAt = new Date(input.newStartsAt);
  const dateStr = input.newStartsAt.slice(0, 10);
  const { calendar } = appointment;

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      calendarId: calendar.id,
      // Exclude the current appointment so rescheduling to the same window
      // isn't blocked by itself
      id: { not: appointment.id },
      startsAt: {
        gte: new Date(`${dateStr}T00:00:00`),
        lt: new Date(`${dateStr}T23:59:59`),
      },
    },
    select: { startsAt: true, endsAt: true, status: true },
  });

  const slots = getSlotsForDay(dateStr, calendar, calendar.availability, existingAppointments);
  const slotValid = slots.some((s) => s.start === input.newStartsAt);

  if (!slotValid) {
    return NextResponse.json(
      { error: "This time slot is no longer available. Please pick another time." },
      { status: 409 }
    );
  }

  // ─── Compute new end time ──────────────────────────────────────────────────
  const newEndsAt = new Date(newStartsAt.getTime() + calendar.slotDuration * 60_000);

  // ─── Update appointment ────────────────────────────────────────────────────
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      startsAt: newStartsAt,
      endsAt: newEndsAt,
      // Reset reminder so it fires again for the new time
      reminderSent: false,
    },
  });

  // ─── Redirect to success state ─────────────────────────────────────────────
  return NextResponse.redirect(
    new URL(`/book/reschedule/${token}?rescheduled=1`, req.url)
  );
}

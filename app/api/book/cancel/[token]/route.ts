/**
 * POST /api/book/cancel/[token]
 *
 * Public endpoint — no auth required.
 * Cancels an appointment identified by its cancelToken.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { sendEmail, emailConfigured } from "@/lib/email";

type Ctx = { params: Promise<{ token: string }> };

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

  // ─── Fetch appointment ─────────────────────────────────────────────────────
  const appointment = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    include: { calendar: true },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  if (appointment.status === "cancelled") {
    return NextResponse.redirect(new URL(`/book/cancel/${token}?cancelled=1`, req.url));
  }

  if (
    appointment.status === "completed" ||
    appointment.status === "no_show" ||
    appointment.startsAt < new Date()
  ) {
    return NextResponse.json(
      { error: "Cannot cancel a past appointment." },
      { status: 400 }
    );
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "cancelled" },
  });

  // ─── Cancellation email (non-fatal) ────────────────────────────────────────
  if (
    appointment.calendar.confirmationEmailEnabled &&
    appointment.contactEmail &&
    emailConfigured()
  ) {
    const dateStr = appointment.startsAt.toLocaleString("en-US", {
      timeZone: appointment.calendar.timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    sendEmail({
      to: appointment.contactEmail,
      subject: `Appointment cancelled — ${appointment.calendar.name}`,
      html: `
        <h2>Appointment Cancelled</h2>
        <p>Your appointment with <strong>${appointment.calendar.name}</strong> has been cancelled.</p>
        <p><strong>Date &amp; Time:</strong> ${dateStr} (${appointment.calendar.timezone})</p>
        <p style="color:#888;font-size:13px">If you cancelled by mistake, please book a new appointment.</p>
      `,
    }).catch(console.error);
  }

  // ─── Redirect to success state ─────────────────────────────────────────────
  return NextResponse.redirect(new URL(`/book/cancel/${token}?cancelled=1`, req.url));
}

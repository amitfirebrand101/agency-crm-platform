/**
 * POST /api/book/confirm/[token]
 *
 * Public endpoint — no auth required.
 * Confirms an appointment identified by its confirmToken.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

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
    where: { confirmToken: token },
    select: { id: true, status: true },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json(
      { error: "This appointment has been cancelled and cannot be confirmed." },
      { status: 400 }
    );
  }

  // Idempotent — already confirmed, redirect to success
  if (appointment.status === "confirmed") {
    return NextResponse.redirect(new URL(`/book/confirm/${token}?confirmed=1`, req.url));
  }

  // ─── Confirm ───────────────────────────────────────────────────────────────
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "confirmed" },
  });

  return NextResponse.redirect(new URL(`/book/confirm/${token}?confirmed=1`, req.url));
}

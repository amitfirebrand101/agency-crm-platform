import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

/**
 * GET /api/cron/cleanup
 *
 * Runs daily at 03:00 UTC (see vercel.json).
 * Performs database housekeeping:
 *   - Deletes LoginAttempt records older than 24 hours
 *   - Expires UserInvites that are past expiry (marks them so no separate query needed)
 *   - Cleans up AutomationEvent records older than 90 days
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats: Record<string, number> = {};

  try {
    // 1. Login attempt records older than 24h
    const { count: loginAttempts } = await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } },
    });
    stats.loginAttemptsPurged = loginAttempts;

    // 2. AutomationEvents older than 90 days
    const { count: oldEvents } = await prisma.automationEvent.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } },
    });
    stats.automationEventsPurged = oldEvents;

    // 3. Expired invites that slipped through without being marked revoked
    // (they won't be used but we mark them to keep the DB clean)
    const { count: expiredInvites } = await prisma.userInvite.updateMany({
      where: {
        expiresAt:  { lt: new Date() },
        acceptedAt: null,
        revokedAt:  null,
      },
      data: { revokedAt: new Date() },
    });
    stats.expiredInvitesMarked = expiredInvites;

    logger.info("Cleanup cron completed", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    logger.error("Cleanup cron failed", { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/**
 * Cron route — resumes WAITING automation enrollments that are past their resumeAt time.
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/automations/resume", "schedule": "* * * * *" }]
 * }
 *
 * Protect with CRON_SECRET env var. Vercel Cron passes the secret as Authorization bearer.
 * For other schedulers, pass it as ?secret= query param.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resumeEnrollment } from "@/lib/automations/engine";

const MAX_PER_RUN = 20; // process at most 20 enrollments per cron tick

export async function GET(req: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const provided = authHeader?.replace("Bearer ", "") ?? querySecret ?? "";
    if (provided !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  let dueEnrollments: Array<{ id: string; agencyId: string; subAccountId: string }> = [];

  try {
    dueEnrollments = await prisma.automationEnrollment.findMany({
      where: {
        status: "WAITING",
        resumeAt: { lte: new Date() },
      },
      orderBy: { resumeAt: "asc" },
      take: MAX_PER_RUN,
      select: { id: true, agencyId: true, subAccountId: true },
    });
  } catch (err) {
    console.error("[cron/resume] DB query failed:", err);
    return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 500 });
  }

  if (dueEnrollments.length === 0) {
    return NextResponse.json({ ok: true, resumed: 0 });
  }

  const results = await Promise.allSettled(
    dueEnrollments.map((e) => resumeEnrollment(e.id, e.agencyId, e.subAccountId))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.resumed).length;
  const failed = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.resumed)
  ).length;

  console.log(`[cron/resume] processed ${dueEnrollments.length}: ${succeeded} resumed, ${failed} failed`);

  return NextResponse.json({
    ok: true,
    processed: dueEnrollments.length,
    resumed: succeeded,
    failed,
  });
}

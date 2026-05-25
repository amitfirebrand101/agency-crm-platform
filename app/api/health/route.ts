import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckResult = {
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
};

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "down", error: String(err), latencyMs: Date.now() - start };
  }
}

function checkProviders(): Record<string, CheckResult> {
  const results: Record<string, CheckResult> = {};

  results.twilio = process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
    ? { status: "ok" }
    : { status: "degraded", error: "credentials not configured" };

  results.smtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? { status: "ok" }
    : { status: "degraded", error: "credentials not configured" };

  results.stripe = process.env.STRIPE_SECRET_KEY
    ? { status: "ok" }
    : { status: "degraded", error: "credentials not configured" };

  results.credentialEncryption = process.env.CREDENTIAL_ENCRYPTION_KEY
    ? { status: "ok" }
    : { status: "degraded", error: "CREDENTIAL_ENCRYPTION_KEY not set" };

  results.upstashRateLimiting = process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
    ? { status: "ok" }
    : { status: "degraded", error: "using in-memory fallback" };

  return results;
}

/**
 * GET /api/health
 *
 * Returns the operational status of all platform sub-systems.
 * Used by uptime monitors (Better Uptime, Checkly, etc.).
 *
 * Returns HTTP 200 when the platform is healthy or degraded (some providers
 * missing but the app is running). Returns HTTP 503 only when the database
 * is unreachable, as that makes the platform non-functional.
 */
export async function GET() {
  const start = Date.now();

  const [dbCheck] = await Promise.all([checkDatabase()]);
  const providerChecks = checkProviders();

  const overallStatus: "ok" | "degraded" | "down" =
    dbCheck.status === "down"
      ? "down"
      : Object.values(providerChecks).some((c) => c.status !== "ok")
      ? "degraded"
      : "ok";

  const body = {
    status:    overallStatus,
    timestamp: new Date().toISOString(),
    version:   process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "local",
    environment: process.env.NODE_ENV,
    latencyMs: Date.now() - start,
    checks: {
      database:  dbCheck,
      providers: providerChecks,
    },
  };

  logger.info("Health check", { status: overallStatus, latencyMs: body.latencyMs });

  return NextResponse.json(body, {
    status:  overallStatus === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

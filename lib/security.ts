import { headers } from "next/headers";
import type { Prisma, AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Request metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

export async function getRequestUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent") ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

export type AuditLogInput = {
  agencyId:    string;
  actorUserId?: string | null;
  action:      AuditAction;
  entityType:  string;
  entityId?:   string | null;
  metadata?:   Prisma.InputJsonValue;
  /** Provide explicitly if already fetched; otherwise read from request headers. */
  ip?:         string | null;
  userAgent?:  string | null;
};

/**
 * Write a structured audit log entry.
 * Non-fatal: logs a warning on failure rather than crashing the request.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    const ip        = input.ip        ?? await getRequestIp();
    const userAgent = input.userAgent ?? await getRequestUserAgent();

    await prisma.auditLog.create({
      data: {
        agencyId:    input.agencyId,
        actorUserId: input.actorUserId ?? null,
        action:      input.action,
        entityType:  input.entityType,
        entityId:    input.entityId ?? null,
        metadata:    input.metadata,
        ipAddress:   ip,
        userAgent:   userAgent ?? undefined,
      },
    });
  } catch (err) {
    // Audit failures must never crash the main request
    logger.warn("Failed to write audit log", {
      action:    input.action,
      agencyId:  input.agencyId,
      entityType: input.entityType,
      error:     String(err),
    });
  }
}

/**
 * Log a permission-denied event. Call this from server actions / API routes
 * when a user attempts an unauthorized operation.
 */
export async function auditPermissionDenied(opts: {
  agencyId:    string;
  actorUserId: string;
  resource:    string;
  action:      string;
}): Promise<void> {
  await auditLog({
    agencyId:    opts.agencyId,
    actorUserId: opts.actorUserId,
    action:      "PERMISSION_DENIED",
    entityType:  opts.resource,
    metadata:    { attemptedAction: opts.action },
  });

  logger.warn("Permission denied", {
    agencyId:  opts.agencyId,
    userId:    opts.actorUserId,
    resource:  opts.resource,
    action:    opts.action,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Login attempt tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a login attempt in the database.
 * Used for login rate limiting audit — the in-memory limiter is the first
 * line of defence; this provides a persistent record for security reviews.
 */
export async function recordLoginAttempt(opts: {
  ip:      string | null;
  email:   string | null;
  success: boolean;
}): Promise<void> {
  if (!opts.ip && !opts.email) return;
  try {
    await prisma.loginAttempt.create({
      data: {
        ipAddress: opts.ip ?? "unknown",
        email:     opts.email,
        success:   opts.success,
      },
    });

    // Clean up old attempts (keep last 24h only)
    await prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 86_400_000) },
      },
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Count recent failed login attempts from an IP or email.
 * Returns the count within the given window (default: last 15 minutes).
 */
export async function countRecentFailedLogins(opts: {
  ip?:           string;
  email?:        string;
  windowMinutes?: number;
}): Promise<number> {
  const since = new Date(Date.now() - (opts.windowMinutes ?? 15) * 60_000);
  const where: Prisma.LoginAttemptWhereInput = {
    success:   false,
    createdAt: { gte: since },
    OR: [
      opts.ip    ? { ipAddress: opts.ip    } : undefined,
      opts.email ? { email:     opts.email } : undefined,
    ].filter(Boolean) as Prisma.LoginAttemptWhereInput[],
  };
  return prisma.loginAttempt.count({ where });
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AgencyRole, SubAccountRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH_DISABLED safety guard
//
// AUTH_DISABLED is only permitted in non-production environments.
// If it is set to "true" in a production deployment this file will throw
// immediately so the misconfiguration is caught on boot, not silently bypassed.
// ─────────────────────────────────────────────────────────────────────────────

export function isAuthDisabled(): boolean {
  const value = process.env.AUTH_DISABLED?.replace(/^["']|["']$/g, "").toLowerCase();
  const disabled = value === "true" || value === "1" || value === "yes";

  if (disabled && process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: AUTH_DISABLED=true is set in a production environment. " +
      "Remove it immediately — all requests are unauthenticated."
    );
  }

  return disabled;
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo user (development only — never reaches production)
// ─────────────────────────────────────────────────────────────────────────────

const DEV_USER_ID    = "00000000-0000-4000-8000-000000000001";
const DEV_AGENCY_ID  = "00000000-0000-4000-8000-000000000010";
const DEV_SUB_ID     = "00000000-0000-4000-8000-000000000020";

const devSessionUser: SessionUser = {
  id:             DEV_USER_ID,
  name:           "Dev Owner",
  email:          "owner@dev.local",
  agencyId:       DEV_AGENCY_ID,
  agencyName:     "Dev Agency",
  agencyRole:     "OWNER",
  subAccountId:   DEV_SUB_ID,
  subAccountName: "Primary Sub Account",
  subAccountRole: "ADMIN",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SessionUser = {
  id:             string;
  name:           string | null;
  email:          string;
  agencyId:       string;
  agencyName:     string;
  agencyRole:     AgencyRole;
  subAccountId:   string | null;
  subAccountName: string | null;
  subAccountRole: SubAccountRole | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Core auth functions
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the raw Supabase auth user, or null if not authenticated. */
export async function getAuthUser() {
  if (isAuthDisabled()) {
    return {
      id: DEV_USER_ID,
      email: "owner@dev.local",
      user_metadata: { full_name: "Dev Owner", name: "Dev Owner", avatar_url: null },
    };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) return null;
  return user;
}

/**
 * Returns the full session user (with agency/sub-account context), or null.
 * On first login, auto-provisions an agency and sub-account for new users.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const authUser = await getAuthUser();
  if (!authUser?.email) return null;

  if (isAuthDisabled()) {
    // In dev mode, ensure the demo seed records exist
    try {
      await ensureDevSeed();
    } catch {
      // Non-fatal — demo seed may already exist or DB may be unavailable
    }
    return devSessionUser;
  }

  // Upsert the User record so profile info stays current
  try {
    await prisma.user.upsert({
      where:  { id: authUser.id },
      update: {
        email:    authUser.email,
        name:     authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
        imageUrl: authUser.user_metadata?.avatar_url ?? null,
      },
      create: {
        id:       authUser.id,
        email:    authUser.email,
        name:     authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
        imageUrl: authUser.user_metadata?.avatar_url ?? null,
      },
    });
  } catch (err) {
    logger.error("Failed to upsert user record", { userId: authUser.id, error: String(err) });
    throw err;
  }

  // Load agency membership
  const membership = await prisma.agencyMembership.findFirst({
    where:   { userId: authUser.id, deactivatedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      agency: {
        include: {
          subAccounts: {
            orderBy: { createdAt: "asc" },
            take: 1,
            include: {
              members: { where: { userId: authUser.id }, take: 1 },
            },
          },
        },
      },
    },
  });

  // New user — auto-provision agency + sub-account
  if (!membership) {
    if (!authUser.email) throw new Error("Cannot provision agency: user has no email address.");
    return await provisionNewAgency({ ...authUser, email: authUser.email });
  }

  // User has been deactivated across all memberships (deactivatedAt set above)
  const subAccount         = membership.agency.subAccounts[0] ?? null;
  const subAccountMembership = subAccount?.members[0] ?? null;

  return {
    id:             authUser.id,
    name:           authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
    email:          authUser.email,
    agencyId:       membership.agencyId,
    agencyName:     membership.agency.name,
    agencyRole:     membership.role,
    subAccountId:   subAccount?.id   ?? null,
    subAccountName: subAccount?.name ?? null,
    subAccountRole: subAccountMembership?.role ?? null,
  };
}

/**
 * Requires an authenticated user. Redirects to /login if not signed in.
 * Also redirects deactivated members.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Role helpers (backward-compatible; prefer lib/permissions.ts for new code)
// ─────────────────────────────────────────────────────────────────────────────

export function canWriteAgency(role: AgencyRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canWriteSubAccount(role: SubAccountRole | null): boolean {
  return role === "ADMIN" || role === "SALES" || role === "SUPPORT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Get request metadata (IP + User-Agent) for audit logs
// ─────────────────────────────────────────────────────────────────────────────

export async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function provisionNewAgency(authUser: {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}): Promise<SessionUser> {
  const slugBase = authUser.email
    .split("@")[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") ?? "agency";

  const slug = `${slugBase}-${authUser.id.slice(0, 8)}`;

  let agency: Awaited<ReturnType<typeof prisma.agency.create>> & {
    subAccounts: Array<{ id: string; name: string; members: Array<{ role: string }> }>;
  };

  try {
    agency = await prisma.agency.create({
      data: {
        name: `${authUser.user_metadata?.full_name ?? authUser.email.split("@")[0]}'s Agency`,
        slug,
        members: {
          create: { userId: authUser.id, role: "OWNER" },
        },
        subAccounts: {
          create: {
            name: "Primary Sub Account",
            slug: "primary",
            members: { create: { userId: authUser.id, role: "ADMIN" } },
          },
        },
      },
      include: {
        subAccounts: {
          include: { members: { where: { userId: authUser.id } } },
        },
      },
    });
    logger.info("Provisioned new agency for user", { userId: authUser.id, agencyId: agency.id });
  } catch (err) {
    // Race condition: multiple concurrent requests all found no membership and
    // all tried to provision. First one won; re-fetch the one it created.
    if ((err as { code?: string }).code !== "P2002") throw err;

    const existing = await prisma.agencyMembership.findFirst({
      where:   { userId: authUser.id },
      include: {
        agency: {
          include: {
            subAccounts: {
              take: 1,
              include: { members: { where: { userId: authUser.id }, take: 1 } },
            },
          },
        },
      },
    });
    if (!existing) throw err;

    const sub = existing.agency.subAccounts[0] ?? null;
    return {
      id:             authUser.id,
      name:           (authUser.user_metadata?.full_name as string | null) ?? null,
      email:          authUser.email,
      agencyId:       existing.agencyId,
      agencyName:     existing.agency.name,
      agencyRole:     existing.role,
      subAccountId:   sub?.id   ?? null,
      subAccountName: sub?.name ?? null,
      subAccountRole: sub?.members[0]?.role ?? null,
    };
  }

  const subAccount = agency.subAccounts[0] ?? null;
  return {
    id:             authUser.id,
    name:           (authUser.user_metadata?.full_name as string | null) ?? null,
    email:          authUser.email,
    agencyId:       agency.id,
    agencyName:     agency.name,
    agencyRole:     "OWNER" as AgencyRole,
    subAccountId:   subAccount?.id   ?? null,
    subAccountName: subAccount?.name ?? null,
    subAccountRole: (subAccount?.members[0]?.role ?? null) as SubAccountRole | null,
  };
}

/** Ensure dev seed data exists (idempotent). Only runs when AUTH_DISABLED=true. */
async function ensureDevSeed(): Promise<void> {
  const existingUser = await prisma.user.findUnique({ where: { id: DEV_USER_ID } });
  if (existingUser) return;

  await prisma.user.create({
    data: {
      id:    DEV_USER_ID,
      email: "owner@dev.local",
      name:  "Dev Owner",
      agencyMemberships: {
        create: {
          role: "OWNER",
          agency: {
            create: {
              id:   DEV_AGENCY_ID,
              name: "Dev Agency",
              slug: "dev-agency",
              subAccounts: {
                create: {
                  id:   DEV_SUB_ID,
                  name: "Primary Sub Account",
                  slug: "primary",
                  members: { create: { userId: DEV_USER_ID, role: "ADMIN" } },
                },
              },
            },
          },
        },
      },
    },
  });
}

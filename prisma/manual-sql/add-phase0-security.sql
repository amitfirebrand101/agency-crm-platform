-- Phase 0: Security & Production Baseline
-- Run this in Supabase SQL Editor ONCE
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks)

-- ─────────────────────────────────────────────────────────────
-- 1. Extend AuditAction enum with new values
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVITE_ACCEPTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DEACTIVATE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REACTIVATE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EXPORT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'IMPORT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERMISSION_DENIED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Add columns to AgencyMembership
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "AgencyMembership"
  ADD COLUMN IF NOT EXISTS "invitedById" UUID,
  ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- 3. Add userAgent column to AuditLog
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- New indexes for filtered audit log queries
CREATE INDEX IF NOT EXISTS "AuditLog_agencyId_action_idx" ON "AuditLog" ("agencyId", "action");

-- ─────────────────────────────────────────────────────────────
-- 4. Rename Agency.Contact relation (no DDL needed — Prisma-only)
--    The column was already named correctly in the database.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 5. Create UserInvite table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserInvite" (
  "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId"    UUID         NOT NULL REFERENCES "Agency"("id") ON DELETE CASCADE,
  "email"       TEXT         NOT NULL,
  "role"        "AgencyRole" NOT NULL DEFAULT 'MEMBER',
  "token"       TEXT         NOT NULL UNIQUE,
  "expiresAt"   TIMESTAMPTZ  NOT NULL,
  "acceptedAt"  TIMESTAMPTZ,
  "revokedAt"   TIMESTAMPTZ,
  "invitedById" UUID         REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "UserInvite_agencyId_idx" ON "UserInvite" ("agencyId");
CREATE INDEX IF NOT EXISTS "UserInvite_token_idx"    ON "UserInvite" ("token");
CREATE INDEX IF NOT EXISTS "UserInvite_email_idx"    ON "UserInvite" ("email");

-- ─────────────────────────────────────────────────────────────
-- 6. Create ProviderCredential table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProviderCredential" (
  "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "agencyId"      UUID        NOT NULL REFERENCES "Agency"("id") ON DELETE CASCADE,
  "subAccountId"  UUID,
  "provider"      TEXT        NOT NULL,
  "encryptedData" TEXT        NOT NULL,
  "iv"            TEXT        NOT NULL,
  "authTag"       TEXT        NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("agencyId", "subAccountId", "provider")
);

CREATE INDEX IF NOT EXISTS "ProviderCredential_agencyId_idx" ON "ProviderCredential" ("agencyId");

-- ─────────────────────────────────────────────────────────────
-- 7. Create LoginAttempt table (for auth rate limiting audit)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  "id"        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "ipAddress" TEXT        NOT NULL,
  "email"     TEXT,
  "success"   BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_created_idx"    ON "LoginAttempt" ("ipAddress", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_email_created_idx" ON "LoginAttempt" ("email", "createdAt");

-- Auto-delete old login attempts after 24 hours (keep table small)
-- Note: Supabase doesn't support pg_cron by default on free tier.
-- Alternatively, run: DELETE FROM "LoginAttempt" WHERE "createdAt" < NOW() - INTERVAL '24 hours';
-- from your cron job endpoint.

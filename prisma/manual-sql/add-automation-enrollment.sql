-- Migration: AutomationEnrollment table + missing columns on AutomationRun/AutomationStepRun
-- Run this in the Supabase SQL Editor.

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AutomationEnrollmentStatus" AS ENUM ('ACTIVE','WAITING','COMPLETED','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationRunStatus" AS ENUM ('QUEUED','RUNNING','WAITING','COMPLETED','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AutomationEnrollment ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AutomationEnrollment" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "automationId"   UUID        NOT NULL,
  "versionId"      UUID        NOT NULL,
  "agencyId"       UUID        NOT NULL,
  "subAccountId"   UUID        NOT NULL,
  "contactId"      UUID,
  "eventKey"       TEXT        NOT NULL,
  "triggerType"    TEXT        NOT NULL,
  "status"         "AutomationEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStepId"  TEXT,
  "context"        JSONB       NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT        NOT NULL,
  "resumeAt"       TIMESTAMPTZ,
  "startedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"    TIMESTAMPTZ,
  "cancelledAt"    TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AutomationEnrollment_automationId_fkey"
    FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE,
  CONSTRAINT "AutomationEnrollment_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE CASCADE,
  CONSTRAINT "AutomationEnrollment_idempotencyKey_subAccountId_key"
    UNIQUE ("idempotencyKey", "subAccountId")
);

CREATE INDEX IF NOT EXISTS "AutomationEnrollment_agencyId_subAccountId_idx"
  ON "AutomationEnrollment"("agencyId", "subAccountId");
CREATE INDEX IF NOT EXISTS "AutomationEnrollment_automationId_status_idx"
  ON "AutomationEnrollment"("automationId", "status");
CREATE INDEX IF NOT EXISTS "AutomationEnrollment_subAccountId_contactId_idx"
  ON "AutomationEnrollment"("subAccountId", "contactId");
CREATE INDEX IF NOT EXISTS "AutomationEnrollment_status_resumeAt_idx"
  ON "AutomationEnrollment"("status", "resumeAt");

-- ── AutomationRun — add missing columns ──────────────────────────────────────

ALTER TABLE "AutomationRun"
  ADD COLUMN IF NOT EXISTS "enrollmentId" UUID,
  ADD COLUMN IF NOT EXISTS "versionId"    UUID;

ALTER TABLE "AutomationRun"
  DROP CONSTRAINT IF EXISTS "AutomationRun_enrollmentId_fkey";
ALTER TABLE "AutomationRun"
  ADD CONSTRAINT "AutomationRun_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "AutomationEnrollment"("id") ON DELETE SET NULL;

ALTER TABLE "AutomationRun"
  DROP CONSTRAINT IF EXISTS "AutomationRun_versionId_fkey";
ALTER TABLE "AutomationRun"
  ADD CONSTRAINT "AutomationRun_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "AutomationRun_enrollmentId_idx"
  ON "AutomationRun"("enrollmentId");

-- ── AutomationStepRun — add missing columns ───────────────────────────────────

ALTER TABLE "AutomationStepRun"
  ADD COLUMN IF NOT EXISTS "enrollmentId" UUID,
  ADD COLUMN IF NOT EXISTS "automationId" UUID,
  ADD COLUMN IF NOT EXISTS "agencyId"     UUID,
  ADD COLUMN IF NOT EXISTS "subAccountId" UUID,
  ADD COLUMN IF NOT EXISTS "stepName"     TEXT;

CREATE INDEX IF NOT EXISTS "AutomationStepRun_enrollmentId_idx"
  ON "AutomationStepRun"("enrollmentId");

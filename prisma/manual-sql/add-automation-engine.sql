-- Migration: Automation engine — versions, enrollments, events, webhook delivery
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AutomationVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationEnrollmentStatus" AS ENUM ('ACTIVE', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationWebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add QUEUED value to existing AutomationRunStatus
ALTER TYPE "AutomationRunStatus" ADD VALUE IF NOT EXISTS 'QUEUED';

-- ── Alter existing AutomationRun ──────────────────────────────────────────────

ALTER TABLE "AutomationRun"
  ADD COLUMN IF NOT EXISTS "enrollmentId" UUID,
  ADD COLUMN IF NOT EXISTS "versionId"    UUID;

CREATE INDEX IF NOT EXISTS "AutomationRun_enrollmentId_idx"
  ON "AutomationRun"("enrollmentId");

-- ── Alter existing AutomationStepRun ─────────────────────────────────────────

-- Make stepName nullable (was NOT NULL)
ALTER TABLE "AutomationStepRun"
  ALTER COLUMN "stepName" DROP NOT NULL;

ALTER TABLE "AutomationStepRun"
  ADD COLUMN IF NOT EXISTS "enrollmentId" UUID,
  ADD COLUMN IF NOT EXISTS "automationId" UUID,
  ADD COLUMN IF NOT EXISTS "agencyId"     UUID,
  ADD COLUMN IF NOT EXISTS "subAccountId" UUID,
  ADD COLUMN IF NOT EXISTS "input"        JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "error"        JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Rename startedAt to align — startedAt was already NOT NULL DEFAULT NOW()
-- We're keeping it as-is and making it nullable for new-style rows
ALTER TABLE "AutomationStepRun"
  ALTER COLUMN "startedAt" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "AutomationStepRun_enrollmentId_idx"
  ON "AutomationStepRun"("enrollmentId");

-- ── AutomationVersion ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AutomationVersion" (
  "id"            UUID                      NOT NULL DEFAULT gen_random_uuid(),
  "automationId"  UUID                      NOT NULL,
  "agencyId"      UUID                      NOT NULL,
  "subAccountId"  UUID                      NOT NULL,
  "versionNumber" INT                       NOT NULL,
  "name"          TEXT                      NOT NULL,
  "definition"    JSONB                     NOT NULL,
  "status"        "AutomationVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById"   UUID,
  "createdAt"     TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  "publishedAt"   TIMESTAMPTZ,
  CONSTRAINT "AutomationVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutomationVersion"
  ADD CONSTRAINT IF NOT EXISTS "AutomationVersion_automationId_fkey"
  FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationVersion_automationId_versionNumber_key"
  ON "AutomationVersion"("automationId", "versionNumber");

CREATE INDEX IF NOT EXISTS "AutomationVersion_agencyId_subAccountId_idx"
  ON "AutomationVersion"("agencyId", "subAccountId");

CREATE INDEX IF NOT EXISTS "AutomationVersion_automationId_status_idx"
  ON "AutomationVersion"("automationId", "status");

-- ── AutomationEnrollment ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AutomationEnrollment" (
  "id"             UUID                         NOT NULL DEFAULT gen_random_uuid(),
  "automationId"   UUID                         NOT NULL,
  "versionId"      UUID                         NOT NULL,
  "agencyId"       UUID                         NOT NULL,
  "subAccountId"   UUID                         NOT NULL,
  "contactId"      UUID,
  "eventKey"       TEXT                         NOT NULL,
  "triggerType"    TEXT                         NOT NULL,
  "status"         "AutomationEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStepId"  TEXT,
  "context"        JSONB                        NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT                         NOT NULL,
  "resumeAt"       TIMESTAMPTZ,
  "startedAt"      TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
  "completedAt"    TIMESTAMPTZ,
  "cancelledAt"    TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ                  NOT NULL DEFAULT NOW(),
  CONSTRAINT "AutomationEnrollment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutomationEnrollment"
  ADD CONSTRAINT IF NOT EXISTS "AutomationEnrollment_automationId_fkey"
  FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE;

ALTER TABLE "AutomationEnrollment"
  ADD CONSTRAINT IF NOT EXISTS "AutomationEnrollment_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationEnrollment_idempotencyKey_subAccountId_key"
  ON "AutomationEnrollment"("idempotencyKey", "subAccountId");

CREATE INDEX IF NOT EXISTS "AutomationEnrollment_agencyId_subAccountId_idx"
  ON "AutomationEnrollment"("agencyId", "subAccountId");

CREATE INDEX IF NOT EXISTS "AutomationEnrollment_automationId_status_idx"
  ON "AutomationEnrollment"("automationId", "status");

CREATE INDEX IF NOT EXISTS "AutomationEnrollment_subAccountId_contactId_idx"
  ON "AutomationEnrollment"("subAccountId", "contactId");

CREATE INDEX IF NOT EXISTS "AutomationEnrollment_status_resumeAt_idx"
  ON "AutomationEnrollment"("status", "resumeAt");

-- ── AutomationEvent ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AutomationEvent" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"       UUID        NOT NULL,
  "subAccountId"   UUID        NOT NULL,
  "type"           TEXT        NOT NULL,
  "source"         TEXT        NOT NULL,
  "contactId"      UUID,
  "payload"        JSONB       NOT NULL,
  "idempotencyKey" TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutomationEvent_agencyId_subAccountId_type_idx"
  ON "AutomationEvent"("agencyId", "subAccountId", "type");

CREATE INDEX IF NOT EXISTS "AutomationEvent_subAccountId_contactId_idx"
  ON "AutomationEvent"("subAccountId", "contactId");

CREATE INDEX IF NOT EXISTS "AutomationEvent_idempotencyKey_idx"
  ON "AutomationEvent"("idempotencyKey");

-- ── AutomationWebhookDelivery ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AutomationWebhookDelivery" (
  "id"           UUID                              NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID                              NOT NULL,
  "subAccountId" UUID                              NOT NULL,
  "automationId" UUID                              NOT NULL,
  "runId"        UUID,
  "stepRunId"    UUID,
  "url"          TEXT                              NOT NULL,
  "method"       TEXT                              NOT NULL DEFAULT 'POST',
  "status"       "AutomationWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "request"      JSONB                             NOT NULL,
  "response"     JSONB,
  "error"        JSONB,
  "attempt"      INT                               NOT NULL DEFAULT 1,
  "createdAt"    TIMESTAMPTZ                       NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ                       NOT NULL DEFAULT NOW(),
  CONSTRAINT "AutomationWebhookDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutomationWebhookDelivery"
  ADD CONSTRAINT IF NOT EXISTS "AutomationWebhookDelivery_automationId_fkey"
  FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "AutomationWebhookDelivery_agencyId_subAccountId_idx"
  ON "AutomationWebhookDelivery"("agencyId", "subAccountId");

CREATE INDEX IF NOT EXISTS "AutomationWebhookDelivery_automationId_idx"
  ON "AutomationWebhookDelivery"("automationId");

CREATE INDEX IF NOT EXISTS "AutomationWebhookDelivery_runId_idx"
  ON "AutomationWebhookDelivery"("runId");

-- ── updatedAt trigger for AutomationEnrollment ────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS "AutomationEnrollment_updatedAt" ON "AutomationEnrollment";
CREATE TRIGGER "AutomationEnrollment_updatedAt"
  BEFORE UPDATE ON "AutomationEnrollment"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS "AutomationWebhookDelivery_updatedAt" ON "AutomationWebhookDelivery";
CREATE TRIGGER "AutomationWebhookDelivery_updatedAt"
  BEFORE UPDATE ON "AutomationWebhookDelivery"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── FK on AutomationRun (enrollment / version) ────────────────────────────────

-- These may fail if enrollment table was not created yet; rerun after above succeeds.
ALTER TABLE "AutomationRun"
  ADD CONSTRAINT IF NOT EXISTS "AutomationRun_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "AutomationEnrollment"("id") ON DELETE SET NULL;

ALTER TABLE "AutomationRun"
  ADD CONSTRAINT IF NOT EXISTS "AutomationRun_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE SET NULL;

-- Automation execution tables — run in Supabase SQL Editor
-- Safe to re-run: all statements use IF NOT EXISTS

-- Enum types (CREATE TYPE has no IF NOT EXISTS, so use DO block)
DO $$ BEGIN
  CREATE TYPE "AutomationRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationEnrollmentStatus" AS ENUM ('ACTIVE', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AutomationVersion
CREATE TABLE IF NOT EXISTS "AutomationVersion" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "automationId"  UUID         NOT NULL,
    "agencyId"      UUID         NOT NULL,
    "subAccountId"  UUID         NOT NULL,
    "versionNumber" INTEGER      NOT NULL,
    "name"          TEXT         NOT NULL,
    "definition"    JSONB        NOT NULL,
    "status"        "AutomationVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById"   UUID,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt"   TIMESTAMP(3),
    CONSTRAINT "AutomationVersion_pkey" PRIMARY KEY ("id")
);

-- AutomationEnrollment
CREATE TABLE IF NOT EXISTS "AutomationEnrollment" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "automationId"   UUID         NOT NULL,
    "versionId"      UUID         NOT NULL,
    "agencyId"       UUID         NOT NULL,
    "subAccountId"   UUID         NOT NULL,
    "contactId"      UUID,
    "eventKey"       TEXT         NOT NULL,
    "triggerType"    TEXT         NOT NULL,
    "status"         "AutomationEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStepId"  TEXT,
    "context"        JSONB        NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT         NOT NULL,
    "resumeAt"       TIMESTAMP(3),
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"    TIMESTAMP(3),
    "cancelledAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationEnrollment_pkey" PRIMARY KEY ("id")
);

-- AutomationRun
CREATE TABLE IF NOT EXISTS "AutomationRun" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "enrollmentId" UUID,
    "automationId" UUID         NOT NULL,
    "versionId"    UUID,
    "agencyId"     UUID         NOT NULL,
    "subAccountId" UUID         NOT NULL,
    "contactId"    UUID,
    "status"       "AutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggerType"  TEXT         NOT NULL,
    "payload"      JSONB,
    "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"  TIMESTAMP(3),
    "error"        TEXT,
    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- AutomationStepRun
CREATE TABLE IF NOT EXISTS "AutomationStepRun" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "runId"        UUID         NOT NULL,
    "enrollmentId" UUID,
    "automationId" UUID,
    "agencyId"     UUID,
    "subAccountId" UUID,
    "stepId"       TEXT         NOT NULL,
    "stepType"     TEXT         NOT NULL,
    "stepName"     TEXT,
    "status"       TEXT         NOT NULL,
    "input"        JSONB        NOT NULL DEFAULT '{}',
    "output"       JSONB,
    "error"        JSONB,
    "startedAt"    TIMESTAMP(3),
    "endedAt"      TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationStepRun_pkey" PRIMARY KEY ("id")
);

-- AutomationEvent (event ledger)
CREATE TABLE IF NOT EXISTS "AutomationEvent" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "agencyId"       UUID         NOT NULL,
    "subAccountId"   UUID         NOT NULL,
    "type"           TEXT         NOT NULL,
    "source"         TEXT         NOT NULL,
    "contactId"      UUID,
    "payload"        JSONB        NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AutomationEvent_agencyId_subAccountId_type_idx" ON "AutomationEvent"("agencyId", "subAccountId", "type");
CREATE INDEX IF NOT EXISTS "AutomationEvent_subAccountId_contactId_idx"     ON "AutomationEvent"("subAccountId", "contactId");
CREATE INDEX IF NOT EXISTS "AutomationEvent_idempotencyKey_idx"              ON "AutomationEvent"("idempotencyKey");

-- Indexes
CREATE INDEX IF NOT EXISTS "AutomationVersion_agencyId_subAccountId_idx"       ON "AutomationVersion"("agencyId", "subAccountId");
CREATE INDEX IF NOT EXISTS "AutomationVersion_automationId_status_idx"          ON "AutomationVersion"("automationId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationVersion_automationId_versionNumber_key" ON "AutomationVersion"("automationId", "versionNumber");

CREATE INDEX IF NOT EXISTS "AutomationEnrollment_agencyId_subAccountId_idx"     ON "AutomationEnrollment"("agencyId", "subAccountId");
CREATE INDEX IF NOT EXISTS "AutomationEnrollment_automationId_status_idx"       ON "AutomationEnrollment"("automationId", "status");
CREATE INDEX IF NOT EXISTS "AutomationEnrollment_subAccountId_contactId_idx"    ON "AutomationEnrollment"("subAccountId", "contactId");
CREATE INDEX IF NOT EXISTS "AutomationEnrollment_status_resumeAt_idx"           ON "AutomationEnrollment"("status", "resumeAt");
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationEnrollment_idempotencyKey_subAccountId_key" ON "AutomationEnrollment"("idempotencyKey", "subAccountId");

CREATE INDEX IF NOT EXISTS "AutomationRun_automationId_idx"                     ON "AutomationRun"("automationId");
CREATE INDEX IF NOT EXISTS "AutomationRun_agencyId_subAccountId_startedAt_idx"  ON "AutomationRun"("agencyId", "subAccountId", "startedAt");
CREATE INDEX IF NOT EXISTS "AutomationRun_enrollmentId_idx"                     ON "AutomationRun"("enrollmentId");

CREATE INDEX IF NOT EXISTS "AutomationStepRun_runId_idx"                        ON "AutomationStepRun"("runId");
CREATE INDEX IF NOT EXISTS "AutomationStepRun_enrollmentId_idx"                 ON "AutomationStepRun"("enrollmentId");

-- Foreign keys (idempotent via exception blocks)
DO $$ BEGIN
  ALTER TABLE "AutomationVersion"
    ADD CONSTRAINT "AutomationVersion_automationId_fkey"
      FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationEnrollment"
    ADD CONSTRAINT "AutomationEnrollment_automationId_fkey"
      FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationEnrollment"
    ADD CONSTRAINT "AutomationEnrollment_versionId_fkey"
      FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationRun"
    ADD CONSTRAINT "AutomationRun_enrollmentId_fkey"
      FOREIGN KEY ("enrollmentId") REFERENCES "AutomationEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationRun"
    ADD CONSTRAINT "AutomationRun_versionId_fkey"
      FOREIGN KEY ("versionId") REFERENCES "AutomationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationRun"
    ADD CONSTRAINT "AutomationRun_automationId_fkey"
      FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationStepRun"
    ADD CONSTRAINT "AutomationStepRun_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

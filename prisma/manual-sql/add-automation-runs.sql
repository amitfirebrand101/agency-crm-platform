-- Migration: add AutomationRun and AutomationStepRun tables
-- Run this in Supabase SQL Editor after the initial schema is applied.

CREATE TYPE "AutomationRunStatus" AS ENUM ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "AutomationRun" (
  "id"           UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "automationId" UUID                   NOT NULL,
  "agencyId"     UUID                   NOT NULL,
  "subAccountId" UUID                   NOT NULL,
  "contactId"    UUID,
  "status"       "AutomationRunStatus"  NOT NULL DEFAULT 'RUNNING',
  "triggerType"  TEXT                   NOT NULL,
  "payload"      JSONB,
  "startedAt"    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  "completedAt"  TIMESTAMPTZ,
  "error"        TEXT,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationStepRun" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "runId"     UUID        NOT NULL,
  "stepId"    TEXT        NOT NULL,
  "stepType"  TEXT        NOT NULL,
  "stepName"  TEXT        NOT NULL,
  "status"    TEXT        NOT NULL,
  "output"    JSONB,
  "error"     TEXT,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "endedAt"   TIMESTAMPTZ,
  CONSTRAINT "AutomationStepRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRun_automationId_idx"
  ON "AutomationRun"("automationId");

CREATE INDEX "AutomationRun_agencyId_subAccountId_startedAt_idx"
  ON "AutomationRun"("agencyId", "subAccountId", "startedAt" DESC);

CREATE INDEX "AutomationStepRun_runId_idx"
  ON "AutomationStepRun"("runId");

ALTER TABLE "AutomationRun"
  ADD CONSTRAINT "AutomationRun_automationId_fkey"
  FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationStepRun"
  ADD CONSTRAINT "AutomationStepRun_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

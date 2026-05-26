-- Phase 1 schema additions
-- Run in Supabase SQL Editor

-- ── ContactTask ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ContactTask" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"       UUID        NOT NULL,
  "subAccountId"   UUID        NOT NULL,
  "contactId"      UUID        NOT NULL,
  "assignedUserId" UUID,
  "title"          TEXT        NOT NULL,
  "dueDate"        TIMESTAMPTZ,
  "completedAt"    TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ContactTask_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE,
  CONSTRAINT "ContactTask_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ContactTask_agencyId_subAccountId_idx" ON "ContactTask"("agencyId","subAccountId");
CREATE INDEX IF NOT EXISTS "ContactTask_contactId_idx"             ON "ContactTask"("contactId");
CREATE INDEX IF NOT EXISTS "ContactTask_assignedUserId_idx"        ON "ContactTask"("assignedUserId");
CREATE INDEX IF NOT EXISTS "ContactTask_dueDate_idx"               ON "ContactTask"("dueDate");

-- ── Opportunity — add missing columns ─────────────────────────────────────────
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "lostReason" TEXT,
  ADD COLUMN IF NOT EXISTS "closeDate"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "notes"      TEXT;

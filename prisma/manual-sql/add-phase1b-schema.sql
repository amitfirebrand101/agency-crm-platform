-- Phase 1B schema additions — run in Supabase SQL Editor

-- Contact scoring
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "score" INTEGER NOT NULL DEFAULT 0;

-- SubAccount round-robin assignment cursor
ALTER TABLE "SubAccount" ADD COLUMN IF NOT EXISTS "assignmentCursor" INTEGER NOT NULL DEFAULT 0;

-- Conversation enhancements
ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "assignedUserId" UUID,
  ADD COLUMN IF NOT EXISTS "unread"         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "priority"       TEXT    NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "labels"         TEXT[]  DEFAULT '{}';

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Conversation_subAccountId_assignedUserId_idx" ON "Conversation"("subAccountId","assignedUserId");
CREATE INDEX IF NOT EXISTS "Conversation_subAccountId_unread_idx"         ON "Conversation"("subAccountId","unread");

-- Appointment custom question answers
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "customAnswers" JSONB;

-- Calendar branding
ALTER TABLE "Calendar"
  ADD COLUMN IF NOT EXISTS "logoUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "primaryColor" TEXT NOT NULL DEFAULT '#0e7490';

-- SmartList (saved contact filter segments)
CREATE TABLE IF NOT EXISTS "SmartList" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"     UUID        NOT NULL,
  "subAccountId" UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "filters"      JSONB       NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SmartList_subAccountId_fkey"
    FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SmartList_agencyId_subAccountId_idx" ON "SmartList"("agencyId","subAccountId");

-- CannedResponse (message templates / quick replies)
CREATE TABLE IF NOT EXISTS "CannedResponse" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"     UUID        NOT NULL,
  "subAccountId" UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "body"         TEXT        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CannedResponse_subAccountId_fkey"
    FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "CannedResponse_agencyId_subAccountId_idx" ON "CannedResponse"("agencyId","subAccountId");

-- CalendarQuestion (custom booking form fields)
CREATE TABLE IF NOT EXISTS "CalendarQuestion" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "calendarId" UUID        NOT NULL,
  "label"      TEXT        NOT NULL,
  "type"       TEXT        NOT NULL DEFAULT 'text',
  "options"    TEXT[]      DEFAULT '{}',
  "required"   BOOLEAN     NOT NULL DEFAULT false,
  "order"      INTEGER     NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CalendarQuestion_calendarId_fkey"
    FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "CalendarQuestion_calendarId_idx" ON "CalendarQuestion"("calendarId");

-- Notification (in-app bell)
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"  UUID        NOT NULL,
  "userId"    UUID        NOT NULL,
  "title"     TEXT        NOT NULL,
  "body"      TEXT        NOT NULL,
  "read"      BOOLEAN     NOT NULL DEFAULT false,
  "link"      TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId","read");
CREATE INDEX IF NOT EXISTS "Notification_agencyId_idx"    ON "Notification"("agencyId");

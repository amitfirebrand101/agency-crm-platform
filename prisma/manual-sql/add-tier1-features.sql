-- Tier 1 features: calendar availability, booking tokens, message provider IDs
-- Run this in the Supabase SQL Editor

-- ── Calendar enhancements ─────────────────────────────────────────────────────
ALTER TABLE "Calendar"
  ADD COLUMN IF NOT EXISTS "description"              TEXT,
  ADD COLUMN IF NOT EXISTS "location"                 TEXT,
  ADD COLUMN IF NOT EXISTS "conferenceUrl"            TEXT,
  ADD COLUMN IF NOT EXISTS "slotDuration"             INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "bufferBefore"             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bufferAfter"              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "minNotice"                INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "maxDaysAhead"             INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "bookingPageSlug"          TEXT,
  ADD COLUMN IF NOT EXISTS "confirmationEmailEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "reminderEmailEnabled"     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "reminderEmailHours"       INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "reminderSmsEnabled"       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "reminderSmsHours"         INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "Calendar"
  DROP CONSTRAINT IF EXISTS "Calendar_bookingPageSlug_key";
ALTER TABLE "Calendar"
  ADD CONSTRAINT "Calendar_bookingPageSlug_key" UNIQUE ("bookingPageSlug");

-- ── CalendarAvailability ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CalendarAvailability" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "calendarId" UUID        NOT NULL REFERENCES "Calendar"("id") ON DELETE CASCADE,
  "dayOfWeek"  INTEGER     NOT NULL,
  "startTime"  TEXT        NOT NULL DEFAULT '09:00',
  "endTime"    TEXT        NOT NULL DEFAULT '17:00',
  "isEnabled"  BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT "CalendarAvailability_calendarId_dayOfWeek_key" UNIQUE ("calendarId", "dayOfWeek")
);

CREATE INDEX IF NOT EXISTS "CalendarAvailability_calendarId_idx"
  ON "CalendarAvailability"("calendarId");

-- ── Appointment enhancements ──────────────────────────────────────────────────
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "notes"          TEXT,
  ADD COLUMN IF NOT EXISTS "contactEmail"   TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone"   TEXT,
  ADD COLUMN IF NOT EXISTS "confirmToken"   TEXT,
  ADD COLUMN IF NOT EXISTS "cancelToken"    TEXT,
  ADD COLUMN IF NOT EXISTS "rescheduleToken" TEXT,
  ADD COLUMN IF NOT EXISTS "reminderSent"   BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Appointment"
  DROP CONSTRAINT IF EXISTS "Appointment_confirmToken_key",
  DROP CONSTRAINT IF EXISTS "Appointment_cancelToken_key",
  DROP CONSTRAINT IF EXISTS "Appointment_rescheduleToken_key";
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_confirmToken_key" UNIQUE ("confirmToken"),
  ADD CONSTRAINT "Appointment_cancelToken_key"  UNIQUE ("cancelToken"),
  ADD CONSTRAINT "Appointment_rescheduleToken_key" UNIQUE ("rescheduleToken");

-- ── Message enhancements ──────────────────────────────────────────────────────
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "twilioSid"    TEXT,
  ADD COLUMN IF NOT EXISTS "smtpMessageId" TEXT;

ALTER TABLE "Message"
  DROP CONSTRAINT IF EXISTS "Message_twilioSid_key";
ALTER TABLE "Message"
  ADD CONSTRAINT "Message_twilioSid_key" UNIQUE ("twilioSid");

CREATE INDEX IF NOT EXISTS "Message_twilioSid_idx" ON "Message"("twilioSid");

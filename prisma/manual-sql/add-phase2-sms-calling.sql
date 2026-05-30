-- Phase 2: SMS delivery status + phone number Twilio SID
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE "PhoneNumber" ADD COLUMN IF NOT EXISTS "twilioSid" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PhoneNumber_twilioSid_key" ON "PhoneNumber"("twilioSid") WHERE "twilioSid" IS NOT NULL;

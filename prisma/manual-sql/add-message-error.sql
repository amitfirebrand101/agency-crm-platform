-- Add error column to Message for failed delivery tracking
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "error" TEXT;

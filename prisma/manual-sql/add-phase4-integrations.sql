-- Phase 4 Integrations: Stripe, Google Calendar, Facebook Lead Ads, Webhooks, API Keys
-- Run in Supabase SQL Editor (safe to run multiple times — all IF NOT EXISTS)

-- ─────────────────────────────────────────────────────────────────────────────
-- Contact: stripeCustomerId
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Appointment: googleEventId, stripePaymentIntentId
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Invoice: stripeInvoiceId, stripePaymentIntentId
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ApiKey: rateLimitPerHour
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "rateLimitPerHour" INTEGER NOT NULL DEFAULT 1000;

-- ─────────────────────────────────────────────────────────────────────────────
-- PaymentLink
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PaymentLink" (
  "id"                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"             UUID        NOT NULL,
  "subAccountId"         UUID        NOT NULL,
  "name"                 TEXT        NOT NULL,
  "description"          TEXT,
  "type"                 TEXT        NOT NULL DEFAULT 'one_time',
  "amountCents"          INTEGER     NOT NULL DEFAULT 0,
  "currency"             TEXT        NOT NULL DEFAULT 'USD',
  "stripeProductId"      TEXT,
  "stripePriceId"        TEXT,
  "stripePaymentLinkId"  TEXT,
  "stripePaymentLinkUrl" TEXT,
  "active"               BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PaymentLink_agencyId_subAccountId_idx') THEN
    CREATE INDEX "PaymentLink_agencyId_subAccountId_idx" ON "PaymentLink"("agencyId", "subAccountId");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- StripeSubscription
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StripeSubscription" (
  "id"                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"             UUID        NOT NULL,
  "subAccountId"         UUID        NOT NULL,
  "contactId"            UUID        NOT NULL,
  "stripeSubscriptionId" TEXT        NOT NULL UNIQUE,
  "stripeCustomerId"     TEXT        NOT NULL,
  "stripePriceId"        TEXT,
  "status"               TEXT        NOT NULL DEFAULT 'active',
  "currentPeriodStart"   TIMESTAMPTZ,
  "currentPeriodEnd"     TIMESTAMPTZ,
  "canceledAt"           TIMESTAMPTZ,
  "trialEnd"             TIMESTAMPTZ,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "StripeSubscription_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'StripeSubscription_agencyId_subAccountId_idx') THEN
    CREATE INDEX "StripeSubscription_agencyId_subAccountId_idx" ON "StripeSubscription"("agencyId", "subAccountId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'StripeSubscription_contactId_idx') THEN
    CREATE INDEX "StripeSubscription_contactId_idx" ON "StripeSubscription"("contactId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'StripeSubscription_stripeSubscriptionId_idx') THEN
    CREATE INDEX "StripeSubscription_stripeSubscriptionId_idx" ON "StripeSubscription"("stripeSubscriptionId");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- UserOAuthToken (per-user OAuth tokens, e.g. Google Calendar)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserOAuthToken" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"        UUID        NOT NULL,
  "provider"      TEXT        NOT NULL,
  "encryptedData" TEXT        NOT NULL,
  "iv"            TEXT        NOT NULL,
  "authTag"       TEXT        NOT NULL,
  "expiresAt"     TIMESTAMPTZ,
  "metadata"      JSONB       NOT NULL DEFAULT '{}',
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "UserOAuthToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserOAuthToken_userId_provider_key" UNIQUE ("userId", "provider")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserOAuthToken_userId_idx') THEN
    CREATE INDEX "UserOAuthToken_userId_idx" ON "UserOAuthToken"("userId");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FacebookLeadForm
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FacebookLeadForm" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"      UUID        NOT NULL,
  "subAccountId"  UUID        NOT NULL,
  "fbPageId"      TEXT        NOT NULL,
  "fbFormId"      TEXT        NOT NULL,
  "fbFormName"    TEXT        NOT NULL,
  "fieldMappings" JSONB       NOT NULL DEFAULT '{}',
  "active"        BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "FacebookLeadForm_subAccountId_fbFormId_key" UNIQUE ("subAccountId", "fbFormId")
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'FacebookLeadForm_agencyId_subAccountId_idx') THEN
    CREATE INDEX "FacebookLeadForm_agencyId_subAccountId_idx" ON "FacebookLeadForm"("agencyId", "subAccountId");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- WebhookDeliveryLog (outbound)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebhookDeliveryLog" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "webhookEndpointId" UUID        NOT NULL,
  "event"             TEXT        NOT NULL,
  "payload"           JSONB       NOT NULL,
  "responseStatus"    INTEGER,
  "responseBody"      TEXT,
  "durationMs"        INTEGER,
  "success"           BOOLEAN     NOT NULL DEFAULT false,
  "error"             TEXT,
  "attemptedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "WebhookDeliveryLog_webhookEndpointId_fkey"
    FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'WebhookDeliveryLog_webhookEndpointId_attemptedAt_idx') THEN
    CREATE INDEX "WebhookDeliveryLog_webhookEndpointId_attemptedAt_idx"
      ON "WebhookDeliveryLog"("webhookEndpointId", "attemptedAt");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- InboundWebhook
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InboundWebhook" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"       UUID        NOT NULL,
  "subAccountId"   UUID        NOT NULL,
  "name"           TEXT        NOT NULL,
  "token"          TEXT        NOT NULL UNIQUE,
  "description"    TEXT,
  "active"         BOOLEAN     NOT NULL DEFAULT true,
  "receiveCount"   INTEGER     NOT NULL DEFAULT 0,
  "lastReceivedAt" TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'InboundWebhook_agencyId_subAccountId_idx') THEN
    CREATE INDEX "InboundWebhook_agencyId_subAccountId_idx" ON "InboundWebhook"("agencyId", "subAccountId");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- InboundWebhookDelivery
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InboundWebhookDelivery" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "inboundWebhookId" UUID        NOT NULL,
  "ipAddress"        TEXT,
  "headers"          JSONB       NOT NULL DEFAULT '{}',
  "payload"          JSONB       NOT NULL DEFAULT '{}',
  "receivedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "InboundWebhookDelivery_inboundWebhookId_fkey"
    FOREIGN KEY ("inboundWebhookId") REFERENCES "InboundWebhook"("id") ON DELETE CASCADE
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'InboundWebhookDelivery_inboundWebhookId_receivedAt_idx') THEN
    CREATE INDEX "InboundWebhookDelivery_inboundWebhookId_receivedAt_idx"
      ON "InboundWebhookDelivery"("inboundWebhookId", "receivedAt");
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ApiKeyUsageLog
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ApiKeyUsageLog" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "apiKeyId"   UUID        NOT NULL,
  "method"     TEXT        NOT NULL,
  "path"       TEXT        NOT NULL,
  "ipAddress"  TEXT,
  "statusCode" INTEGER,
  "durationMs" INTEGER,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ApiKeyUsageLog_apiKeyId_fkey"
    FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ApiKeyUsageLog_apiKeyId_createdAt_idx') THEN
    CREATE INDEX "ApiKeyUsageLog_apiKeyId_createdAt_idx" ON "ApiKeyUsageLog"("apiKeyId", "createdAt");
  END IF;
END $$;

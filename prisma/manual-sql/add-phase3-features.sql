-- Phase 3: Full GHL feature parity
-- Safe to re-run: all statements use IF NOT EXISTS / DO blocks

-- ── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Product" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID         NOT NULL,
  "name"         TEXT         NOT NULL,
  "description"  TEXT,
  "priceCents"   INTEGER      NOT NULL DEFAULT 0,
  "currency"     TEXT         NOT NULL DEFAULT 'USD',
  "type"         TEXT         NOT NULL DEFAULT 'service',
  "status"       TEXT         NOT NULL DEFAULT 'active',
  "imageUrl"     TEXT,
  "taxable"      BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Product_agencyId_subAccountId_idx" ON "Product"("agencyId","subAccountId");

-- ── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"        UUID         NOT NULL,
  "subAccountId"    UUID         NOT NULL,
  "contactId"       UUID,
  "number"          TEXT         NOT NULL,
  "status"          TEXT         NOT NULL DEFAULT 'draft',
  "currency"        TEXT         NOT NULL DEFAULT 'USD',
  "subtotalCents"   INTEGER      NOT NULL DEFAULT 0,
  "taxCents"        INTEGER      NOT NULL DEFAULT 0,
  "discountCents"   INTEGER      NOT NULL DEFAULT 0,
  "totalCents"      INTEGER      NOT NULL DEFAULT 0,
  "paidCents"       INTEGER      NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "terms"           TEXT,
  "title"           TEXT         NOT NULL DEFAULT 'Invoice',
  "dueDate"         TIMESTAMP(3),
  "sentAt"          TIMESTAMP(3),
  "paidAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Invoice_agencyId_subAccountId_idx"  ON "Invoice"("agencyId","subAccountId");
CREATE INDEX IF NOT EXISTS "Invoice_contactId_idx"              ON "Invoice"("contactId");

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "invoiceId"     UUID         NOT NULL,
  "productId"     UUID,
  "name"          TEXT         NOT NULL,
  "description"   TEXT,
  "quantity"      NUMERIC(10,2) NOT NULL DEFAULT 1,
  "unitPriceCents" INTEGER     NOT NULL DEFAULT 0,
  "totalCents"    INTEGER      NOT NULL DEFAULT 0,
  "taxRate"       NUMERIC(5,2) NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- ── Broadcasts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Broadcast" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"         UUID         NOT NULL,
  "subAccountId"     UUID         NOT NULL,
  "name"             TEXT         NOT NULL,
  "channel"          TEXT         NOT NULL,
  "status"           TEXT         NOT NULL DEFAULT 'draft',
  "subject"          TEXT,
  "body"             TEXT         NOT NULL DEFAULT '',
  "segmentFilters"   JSONB        NOT NULL DEFAULT '{}',
  "recipientCount"   INTEGER      NOT NULL DEFAULT 0,
  "sentCount"        INTEGER      NOT NULL DEFAULT 0,
  "deliveredCount"   INTEGER      NOT NULL DEFAULT 0,
  "failedCount"      INTEGER      NOT NULL DEFAULT 0,
  "scheduledAt"      TIMESTAMP(3),
  "startedAt"        TIMESTAMP(3),
  "completedAt"      TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Broadcast_agencyId_subAccountId_idx" ON "Broadcast"("agencyId","subAccountId");

-- ── Review Requests ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ReviewRequest" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID         NOT NULL,
  "contactId"    UUID         NOT NULL,
  "channel"      TEXT         NOT NULL DEFAULT 'SMS',
  "status"       TEXT         NOT NULL DEFAULT 'pending',
  "platform"     TEXT         NOT NULL DEFAULT 'google',
  "reviewUrl"    TEXT,
  "sentAt"       TIMESTAMP(3),
  "clickedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReviewRequest_agencyId_subAccountId_idx" ON "ReviewRequest"("agencyId","subAccountId");
CREATE INDEX IF NOT EXISTS "ReviewRequest_contactId_idx"              ON "ReviewRequest"("contactId");

-- ── Social Posts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SocialPost" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID         NOT NULL,
  "content"      TEXT         NOT NULL,
  "platforms"    TEXT[]       NOT NULL DEFAULT '{}',
  "status"       TEXT         NOT NULL DEFAULT 'draft',
  "scheduledAt"  TIMESTAMP(3),
  "publishedAt"  TIMESTAMP(3),
  "mediaUrls"    TEXT[]       NOT NULL DEFAULT '{}',
  "error"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SocialPost_agencyId_subAccountId_idx" ON "SocialPost"("agencyId","subAccountId");
CREATE INDEX IF NOT EXISTS "SocialPost_scheduledAt_status_idx"    ON "SocialPost"("scheduledAt","status");

-- ── Trigger Links ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TriggerLink" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID         NOT NULL,
  "name"         TEXT         NOT NULL,
  "slug"         TEXT         NOT NULL,
  "redirectUrl"  TEXT         NOT NULL,
  "clickCount"   INTEGER      NOT NULL DEFAULT 0,
  "automationId" UUID,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TriggerLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TriggerLink_subAccountId_slug_key" ON "TriggerLink"("subAccountId","slug");
CREATE INDEX IF NOT EXISTS "TriggerLink_agencyId_subAccountId_idx" ON "TriggerLink"("agencyId","subAccountId");

CREATE TABLE IF NOT EXISTS "TriggerLinkClick" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "triggerLinkId" UUID         NOT NULL,
  "contactId"     UUID,
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TriggerLinkClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TriggerLinkClick_triggerLinkId_idx" ON "TriggerLinkClick"("triggerLinkId");

-- ── Courses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Course" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID         NOT NULL,
  "title"        TEXT         NOT NULL,
  "description"  TEXT,
  "status"       TEXT         NOT NULL DEFAULT 'draft',
  "thumbnailUrl" TEXT,
  "priceCents"   INTEGER      NOT NULL DEFAULT 0,
  "isFree"       BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Course_agencyId_subAccountId_idx" ON "Course"("agencyId","subAccountId");

CREATE TABLE IF NOT EXISTS "CourseSection" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "courseId"  UUID         NOT NULL,
  "title"     TEXT         NOT NULL,
  "position"  INTEGER      NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseSection_courseId_idx" ON "CourseSection"("courseId");

CREATE TABLE IF NOT EXISTS "CourseLesson" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "sectionId"   UUID         NOT NULL,
  "courseId"    UUID         NOT NULL,
  "title"       TEXT         NOT NULL,
  "description" TEXT,
  "type"        TEXT         NOT NULL DEFAULT 'video',
  "content"     JSONB        NOT NULL DEFAULT '{}',
  "duration"    INTEGER,
  "position"    INTEGER      NOT NULL DEFAULT 0,
  "isFree"      BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CourseLesson_sectionId_idx" ON "CourseLesson"("sectionId");
CREATE INDEX IF NOT EXISTS "CourseLesson_courseId_idx"  ON "CourseLesson"("courseId");

-- ── API Keys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID,
  "userId"       UUID         NOT NULL,
  "name"         TEXT         NOT NULL,
  "keyHash"      TEXT         NOT NULL UNIQUE,
  "keyPrefix"    TEXT         NOT NULL,
  "scopes"       TEXT[]       NOT NULL DEFAULT '{}',
  "lastUsedAt"   TIMESTAMP(3),
  "expiresAt"    TIMESTAMP(3),
  "revokedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApiKey_agencyId_idx" ON "ApiKey"("agencyId");

-- ── Webhook Endpoints ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"         UUID         NOT NULL,
  "subAccountId"     UUID         NOT NULL,
  "name"             TEXT         NOT NULL,
  "url"              TEXT         NOT NULL,
  "events"           TEXT[]       NOT NULL DEFAULT '{}',
  "secret"           TEXT         NOT NULL,
  "enabled"          BOOLEAN      NOT NULL DEFAULT true,
  "successCount"     INTEGER      NOT NULL DEFAULT 0,
  "failureCount"     INTEGER      NOT NULL DEFAULT 0,
  "lastTriggeredAt"  TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_agencyId_subAccountId_idx" ON "WebhookEndpoint"("agencyId","subAccountId");

-- ── Custom Values (merge fields) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CustomValue" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID,
  "name"         TEXT         NOT NULL,
  "key"          TEXT         NOT NULL,
  "value"        TEXT         NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomValue_agencyId_subAccountId_key_key" ON "CustomValue"("agencyId","subAccountId","key");

-- ── Media Files ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MediaFile" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"     UUID         NOT NULL,
  "subAccountId" UUID,
  "name"         TEXT         NOT NULL,
  "url"          TEXT         NOT NULL,
  "mimeType"     TEXT         NOT NULL DEFAULT 'application/octet-stream',
  "sizeBytes"    BIGINT       NOT NULL DEFAULT 0,
  "folder"       TEXT,
  "altText"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MediaFile_agencyId_subAccountId_idx" ON "MediaFile"("agencyId","subAccountId");

-- ── Business Profile ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BusinessProfile" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "agencyId"        UUID         NOT NULL,
  "subAccountId"    UUID         NOT NULL UNIQUE,
  "businessName"    TEXT,
  "address"         TEXT,
  "city"            TEXT,
  "state"           TEXT,
  "zip"             TEXT,
  "country"         TEXT         DEFAULT 'US',
  "timezone"        TEXT         DEFAULT 'America/New_York',
  "businessHours"   JSONB        NOT NULL DEFAULT '{}',
  "googleReviewUrl" TEXT,
  "yelpUrl"         TEXT,
  "facebookUrl"     TEXT,
  "website"         TEXT,
  "logoUrl"         TEXT,
  "primaryColor"    TEXT         DEFAULT '#4361ee',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BusinessProfile_agencyId_idx" ON "BusinessProfile"("agencyId");

-- ── Foreign keys ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TriggerLinkClick" ADD CONSTRAINT "TriggerLinkClick_triggerLinkId_fkey"
    FOREIGN KEY ("triggerLinkId") REFERENCES "TriggerLink"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "CourseSection"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

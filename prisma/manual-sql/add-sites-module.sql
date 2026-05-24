-- Sites module: Funnels, Forms, Surveys, Blog Posts
-- Run in Supabase SQL Editor

-- Funnels
CREATE TABLE IF NOT EXISTS "Funnel" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"     UUID        NOT NULL,
  "subAccountId" UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "description"  TEXT,
  "domain"       TEXT,
  "favicon"      TEXT,
  "status"       TEXT        NOT NULL DEFAULT 'draft',
  "type"         TEXT        NOT NULL DEFAULT 'funnel',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Funnel_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Funnel_agencyId_subAccountId_idx" ON "Funnel"("agencyId", "subAccountId");

-- Funnel Pages (steps)
CREATE TABLE IF NOT EXISTS "FunnelPage" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "funnelId"    UUID        NOT NULL,
  "name"        TEXT        NOT NULL,
  "pathSlug"    TEXT        NOT NULL,
  "order"       INTEGER     NOT NULL DEFAULT 0,
  "type"        TEXT        NOT NULL DEFAULT 'sales',
  "content"     JSONB,
  "visits"      INTEGER     NOT NULL DEFAULT 0,
  "conversions" INTEGER     NOT NULL DEFAULT 0,
  "splitTest"   JSONB,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "FunnelPage_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "FunnelPage_funnelId_idx" ON "FunnelPage"("funnelId");

-- Funnel Submissions
CREATE TABLE IF NOT EXISTS "FunnelSubmission" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "funnelId"  UUID        NOT NULL,
  "pageId"    UUID,
  "contactId" UUID,
  "data"      JSONB       NOT NULL DEFAULT '{}',
  "sourceUrl" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "FunnelSubmission_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE,
  CONSTRAINT "FunnelSubmission_pageId_fkey"   FOREIGN KEY ("pageId")   REFERENCES "FunnelPage"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "FunnelSubmission_funnelId_idx" ON "FunnelSubmission"("funnelId");
CREATE INDEX IF NOT EXISTS "FunnelSubmission_pageId_idx"   ON "FunnelSubmission"("pageId");

-- Site Forms
CREATE TABLE IF NOT EXISTS "SiteForm" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"     UUID        NOT NULL,
  "subAccountId" UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "fields"       JSONB       NOT NULL DEFAULT '[]',
  "settings"     JSONB       NOT NULL DEFAULT '{}',
  "status"       TEXT        NOT NULL DEFAULT 'active',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SiteForm_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SiteForm_agencyId_subAccountId_idx" ON "SiteForm"("agencyId", "subAccountId");

-- Form Submissions
CREATE TABLE IF NOT EXISTS "FormSubmission" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "formId"    UUID        NOT NULL,
  "contactId" UUID,
  "data"      JSONB       NOT NULL DEFAULT '{}',
  "ipAddress" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SiteForm"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "FormSubmission_formId_idx" ON "FormSubmission"("formId");

-- Surveys
CREATE TABLE IF NOT EXISTS "Survey" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"     UUID        NOT NULL,
  "subAccountId" UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "questions"    JSONB       NOT NULL DEFAULT '[]',
  "settings"     JSONB       NOT NULL DEFAULT '{}',
  "status"       TEXT        NOT NULL DEFAULT 'active',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Survey_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Survey_agencyId_subAccountId_idx" ON "Survey"("agencyId", "subAccountId");

-- Survey Responses
CREATE TABLE IF NOT EXISTS "SurveyResponse" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "surveyId"  UUID        NOT NULL,
  "contactId" UUID,
  "answers"   JSONB       NOT NULL DEFAULT '{}',
  "ipAddress" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");

-- Blog Posts
CREATE TABLE IF NOT EXISTS "BlogPost" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"     UUID        NOT NULL,
  "subAccountId" UUID        NOT NULL,
  "siteId"       UUID,
  "title"        TEXT        NOT NULL,
  "slug"         TEXT        NOT NULL,
  "content"      TEXT,
  "excerpt"      TEXT,
  "author"       TEXT,
  "category"     TEXT,
  "tags"         TEXT[]      NOT NULL DEFAULT '{}',
  "coverImage"   TEXT,
  "status"       TEXT        NOT NULL DEFAULT 'draft',
  "publishedAt"  TIMESTAMPTZ,
  "seoTitle"     TEXT,
  "seoDesc"      TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BlogPost_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "BlogPost_agencyId_subAccountId_idx" ON "BlogPost"("agencyId", "subAccountId");
CREATE INDEX IF NOT EXISTS "BlogPost_siteId_idx"                ON "BlogPost"("siteId");

-- Trigger to auto-update updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'funnel_updated_at') THEN
    CREATE TRIGGER funnel_updated_at BEFORE UPDATE ON "Funnel" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'funnelpage_updated_at') THEN
    CREATE TRIGGER funnelpage_updated_at BEFORE UPDATE ON "FunnelPage" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'siteform_updated_at') THEN
    CREATE TRIGGER siteform_updated_at BEFORE UPDATE ON "SiteForm" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'survey_updated_at') THEN
    CREATE TRIGGER survey_updated_at BEFORE UPDATE ON "Survey" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'blogpost_updated_at') THEN
    CREATE TRIGGER blogpost_updated_at BEFORE UPDATE ON "BlogPost" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

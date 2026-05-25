-- Sites page-builder module: SitePage + SitePageVersion
-- Run in Supabase SQL Editor

-- Site Pages
CREATE TABLE IF NOT EXISTS "SitePage" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "siteId"         UUID        NOT NULL,
  "subAccountId"   UUID        NOT NULL,
  "agencyId"       UUID        NOT NULL,
  "slug"           TEXT        NOT NULL,
  "title"          TEXT        NOT NULL,
  "status"         TEXT        NOT NULL DEFAULT 'draft',
  "seoTitle"       TEXT,
  "seoDescription" TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SitePage_siteId_fkey"       FOREIGN KEY ("siteId")       REFERENCES "Site"("id")       ON DELETE CASCADE,
  CONSTRAINT "SitePage_subAccountId_fkey" FOREIGN KEY ("subAccountId") REFERENCES "SubAccount"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SitePage_siteId_slug_key" ON "SitePage"("siteId", "slug");
CREATE INDEX IF NOT EXISTS "SitePage_siteId_idx"       ON "SitePage"("siteId");
CREATE INDEX IF NOT EXISTS "SitePage_subAccountId_idx" ON "SitePage"("subAccountId");

-- Site Page Versions
CREATE TABLE IF NOT EXISTS "SitePageVersion" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "pageId"        UUID        NOT NULL,
  "versionNumber" INTEGER     NOT NULL,
  "status"        TEXT        NOT NULL DEFAULT 'draft',
  "schema"        JSONB       NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "publishedAt"   TIMESTAMPTZ,
  CONSTRAINT "SitePageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "SitePageVersion_pageId_idx"        ON "SitePageVersion"("pageId");
CREATE INDEX IF NOT EXISTS "SitePageVersion_pageId_status_idx" ON "SitePageVersion"("pageId", "status");

-- Trigger to auto-update updatedAt on SitePage
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sitepage_updated_at') THEN
    CREATE TRIGGER sitepage_updated_at BEFORE UPDATE ON "SitePage" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

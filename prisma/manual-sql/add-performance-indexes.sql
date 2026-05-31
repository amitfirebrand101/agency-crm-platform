-- Performance indexes for common dashboard/filter query patterns.
-- Run in Supabase SQL Editor. All are idempotent (IF NOT EXISTS).

-- Contact: status filter/count (contacts page lifecycle bar + groupBy)
CREATE INDEX IF NOT EXISTS "Contact_agencyId_subAccountId_status_idx"
  ON "Contact" ("agencyId", "subAccountId", "status");

-- Contact: default sort (contacts page orderBy createdAt desc)
CREATE INDEX IF NOT EXISTS "Contact_agencyId_subAccountId_createdAt_idx"
  ON "Contact" ("agencyId", "subAccountId", "createdAt" DESC);

-- Opportunity: status filter + aggregate (dashboard pipeline groupBy)
CREATE INDEX IF NOT EXISTS "Opportunity_agencyId_subAccountId_status_idx"
  ON "Opportunity" ("agencyId", "subAccountId", "status");

-- Opportunity: stage groupBy query (dashboard pipeline by stage)
CREATE INDEX IF NOT EXISTS "Opportunity_stageId_status_idx"
  ON "Opportunity" ("stageId", "status");

-- Conversation: default sort (conversations page orderBy updatedAt desc)
CREATE INDEX IF NOT EXISTS "Conversation_agencyId_subAccountId_updatedAt_idx"
  ON "Conversation" ("agencyId", "subAccountId", "updatedAt" DESC);

-- Appointment: upcoming filter (dashboard + calendar queries)
CREATE INDEX IF NOT EXISTS "Appointment_calendarId_startsAt_status_idx"
  ON "Appointment" ("calendarId", "startsAt", "status");

-- Notification: user + createdAt for ordered fetch
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification" ("userId", "createdAt" DESC);

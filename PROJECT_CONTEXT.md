# Project Context

Last updated: 2026-05-24

## Product Direction

Build `GoLowLevel`, a production-grade multi-tenant agency CRM SaaS with original branding and UI. It should support agency accounts, sub accounts, contacts, conversations, calendars, automations, opportunities, sites, marketing, calling, SMS, settings, and future provider integrations.

Do not copy GoHighLevel branding, text, UI, or proprietary workflows.

## Stack Used

- Next.js 15 App Router (typedRoutes enabled)
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Prisma 5
- Zod
- lucide-react icons

## External Setup

- GitHub repo: `https://github.com/amitfirebrand101/agency-crm-platform.git`
- Supabase project URL: `https://qraauvmmomiepojmodhh.supabase.co`
- Vercel app: `https://agency-crm-platform.vercel.app`
- Auth choice: Supabase Auth (currently bypassed with `AUTH_DISABLED=true`)
- Email provider: skipped for now
- Region/currency: US/USD

Security note: Rotate secret keys before real production use.

## Environment Variables Required

```
DATABASE_URL=           # Supabase pooler connection string
DIRECT_URL=             # Supabase direct connection for migrations
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
AUTH_DISABLED=true      # Remove when Supabase Auth is configured
NEXT_PUBLIC_APP_NAME=GoLowLevel
NEXT_PUBLIC_APP_URL=https://agency-crm-platform.vercel.app
```

## Files Created Or Updated (v0.3.0)

**Schema:**
- `prisma/schema.prisma` — added AutomationRun, AutomationStepRun, AutomationRunStatus enum
- `prisma/manual-sql/add-automation-runs.sql` — Supabase SQL migration for new tables

**Lib:**
- `lib/automations/ssrf-guard.ts` — SSRF protection for outbound webhooks
- `lib/automations/types.ts` — AutomationStep.trueBranch/falseBranch added
- `lib/automations/executor.ts` — DB run tracking, real If/Else branching, outbound webhook
- `lib/automations/catalog.ts` — OUTBOUND_WEBHOOK now executable, OPPORTUNITY_STATUS trigger added
- `lib/validation.ts` — messageSchema, appointmentSchema, agencySchema, contact status field

**Components:**
- `components/ui/badge.tsx` — Badge component with statusVariant helper
- `components/layout/sidebar-nav.tsx` — Client nav with active route highlighting
- `components/layout/app-shell.tsx` — Uses SidebarNav, no longer calls getPublicEnv()

**Pages and actions (new):**
- `app/(dashboard)/contacts/[id]/page.tsx` — Contact detail with edit, tags, timeline
- `app/(dashboard)/conversations/[id]/page.tsx` — Thread view with send/status actions
- `app/(dashboard)/conversations/[id]/actions.ts`
- `app/(dashboard)/calendars/[id]/page.tsx` — Appointments management
- `app/(dashboard)/settings/actions.ts` — updateAgency action

**Pages and actions (updated):**
- `app/(dashboard)/automations/page.tsx` — Run history, delete, remove step/trigger
- `app/(dashboard)/automations/actions.ts` — deleteWorkflow, removeTrigger, removeStep
- `app/(dashboard)/contacts/actions.ts` — updateContact, deleteContact, tag assignment
- `app/(dashboard)/contacts/page.tsx` — Search, filter, clickable rows
- `app/(dashboard)/conversations/page.tsx` — Channel/status filter, clickable rows
- `app/(dashboard)/opportunities/page.tsx` — Kanban board with stage moves and status
- `app/(dashboard)/calendars/page.tsx` — Links to detail pages
- `app/(dashboard)/dashboard/page.tsx` — Real metrics, pipeline summary, run history
- `app/(dashboard)/settings/page.tsx` — Agency edit form, audit log panel
- `app/(dashboard)/module-actions.ts` — createAppointment, updateAppointmentStatus, moveOpportunityToStage, updateOpportunityStatus
- `app/(dashboard)/sites/page.tsx` — Improved with status and coming-soon note
- `app/(dashboard)/marketing/page.tsx` — Campaign stats, provider status
- `app/(dashboard)/calling/page.tsx` — Provider status, A2P compliance note
- `app/(dashboard)/sms/page.tsx` — Linked threads, provider status

## Data Model Decisions

- `Agency` is the top-level tenant.
- `SubAccount` is the client/location tenant boundary.
- `AutomationRun` tracks every automation execution with DB persistence.
- `AutomationStepRun` tracks per-step output for debugging.
- All tenant-scoped writes include agencyId + subAccountId ownership checks.
- SSRF protection is applied before any outbound HTTP call in automation executor.
- Redirect/navigation errors are re-thrown from try/catch blocks so auth redirects work.

## Implemented Features

- Supabase Auth login screen (Google OAuth + password), middleware, callback.
- AUTH_DISABLED bypass for development.
- Agency/sub-account auto-bootstrap on first login.
- App shell with active-state sidebar nav.
- Contact CRUD: create, edit, delete, tag assignment, activity timeline.
- Conversation CRUD: list with filter, thread view, send message, status change.
- Calendar CRUD: list with link, detail with appointment management.
- Opportunity CRUD: pipeline+stage CRUD, kanban board, stage moves, won/lost.
- Automation CRUD: workflow builder, trigger+action CRUD, publish/unpublish, delete, run history.
- Automation executor: DB run tracking, If/Else branching, outbound webhook with SSRF guard.
- Inbound webhook trigger with token auth.
- Dashboard: real metrics (contacts, open conversations, pipeline value, appointments, automation runs).
- Settings: agency profile edit, team members, audit log.
- Sites, Marketing, Calling, SMS module pages with create/list.
- Sub-accounts management.
- Audit logging on all mutations.
- Full TypeScript coverage — zero tsc errors.
- Production build passes.

## Database Migration Required

The following SQL must be applied to Supabase before `AutomationRun` features work:

```
prisma/manual-sql/add-automation-runs.sql
```

The initial schema SQL is at:
```
prisma/manual-sql/reset-and-init.sql
```

## Known Gaps

- `AutomationRun` features (run history, tracking) require the SQL migration to be applied.
- Google OAuth still needs to be configured in Supabase.
- Dark mode persistence not implemented.
- Provider integrations (Twilio, Telnyx, email) not configured.
- Invite flow not implemented.
- No rate limiter wired yet.
- No CI/CD workflow yet.
- No tests yet.
- Wait/delay action is recorded but not backed by a real queue (Inngest/QStash/Trigger.dev recommended).
- Send Email and Send SMS actions are cataloged but not provider-backed.
- Import/export, duplicate detection, bulk actions for contacts not yet implemented.
- Drag-and-drop Kanban (needs a DnD library like @dnd-kit).
- Sub-account switcher for multi-sub-account access not yet implemented.
- Contact custom field values display/edit not implemented on contact detail page.

## Exact Next Steps

1. Apply `prisma/manual-sql/add-automation-runs.sql` in Supabase SQL Editor.
2. Configure Google OAuth in Supabase and remove `AUTH_DISABLED`.
3. Choose and integrate a queue provider for WAIT steps (Inngest recommended for Vercel).
4. Add Twilio or Telnyx credentials for SMS/calling.
5. Add email provider (SendGrid/Postmark) for Send Email action.
6. Add rate limiting for public endpoints (inbound webhook, auth routes).
7. Add invite flow for team members.
8. Add custom field values display/edit to contact detail page.
9. Add sub-account switcher in the sidebar.
10. Add drag-and-drop to the Kanban board.
11. Add CI/CD (GitHub Actions) with tsc + build checks.
12. Add tests for automation executor and security-sensitive server actions.

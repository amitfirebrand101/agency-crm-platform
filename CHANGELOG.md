# Changelog

## 0.3.1 - 2026-05-25

### Automations
- Fixed IF/ELSE execution so the selected branch becomes the actual execution path, including steps that follow the branch.
- Fixed WAIT persistence by storing `resumeAt` and a durable resume cursor for the remaining steps. The resume route is present, but Vercel Hobby cannot run minute-level cron schedules.
- Added support for WAIT steps inside IF/ELSE paths.
- Added executable `CONTACT_TAG_REMOVED` and `PIPELINE_STAGE_CHANGED` triggers.
- Wired contact update, tag removal, appointment status, opportunity created, opportunity status, and pipeline stage events into the automation dispatcher.
- Added/finished internal executable actions for remove assigned user, DND opt-in/out flags, add note, internal notification, update opportunity, update appointment status, and guarded delete contact.
- Hardened assignment so workflow user assignment only targets users who belong to the current sub-account.
- Added outbound webhook delivery persistence in `AutomationWebhookDelivery`.
- Disabled non-executable catalog items in the builder picker so unsupported actions cannot be added as if they work.

### Verification
- `npx tsc --noEmit` passes.
- `npm run lint` passes with existing unrelated warnings.
- `npm run build` passes.

## 0.3.0 - 2026-05-24

Major feature expansion and production hardening across all CRM modules.

### Schema
- Added `AutomationRunStatus` enum.
- Added `AutomationRun` model with full run tracking (trigger type, status, payload, timestamps, error).
- Added `AutomationStepRun` model with per-step execution records.
- Added `runs` back-relation on `Automation`.
- Added `prisma/manual-sql/add-automation-runs.sql` for manual Supabase migration.

### Automations
- Executor now creates `AutomationRun` and `AutomationStepRun` records on every run.
- Added real If/Else condition evaluation (`contact.field.equals`, `contact.hasTag`, `contact.status.is`).
- Added `OUTBOUND_WEBHOOK` action with SSRF protection (`lib/automations/ssrf-guard.ts`) — blocks private IP ranges, enforces http/https, validates URL, sets timeout and User-Agent.
- Added `OPPORTUNITY_STATUS` trigger type to catalog.
- Added delete workflow, remove trigger, remove step actions.
- Automations page now shows run history with status icons.
- Automations page now shows webhook URL for `INBOUND_WEBHOOK` triggers.
- Fixed redirect error swallowing in outer try/catch (now re-throws navigation errors).

### Contacts
- Added `updateContact`, `deleteContact`, `assignTagToContact`, `removeTagFromContact` server actions.
- Contacts list page now supports search (first/last name, email, company) and status filtering.
- Contacts list rows are now clickable links.
- New contact detail page (`/contacts/[id]`) with edit form, tag management, activity timeline, danger zone delete.

### Conversations
- Conversations list page now supports channel and status filtering.
- Clickable rows link to conversation detail.
- New conversation detail page (`/conversations/[id]`) with message thread, send form (outbound/inbound/internal note), and status actions.

### Opportunities
- Opportunities page now shows a per-pipeline Kanban board with stage columns, deal cards, and move/status forms.
- Added pipeline summary stats (open deals, pipeline value, won count).
- Added `moveOpportunityToStage` and `updateOpportunityStatus` server actions.

### Calendars
- Calendar list cards are now clickable links to the detail page.
- New calendar detail page (`/calendars/[id]`) with appointment list (upcoming/past), status update forms, and new appointment creation form.
- Added `createAppointment` and `updateAppointmentStatus` server actions.

### Dashboard
- Real metrics: open conversations, pipeline value, published automations, upcoming appointments.
- Pipeline by stage widget showing open deal counts and values.
- Recent automation runs table (if `AutomationRun` table exists).
- All static/placeholder stat cards replaced with live DB queries.

### Settings
- Added agency profile edit form with `updateAgency` server action.
- Audit log panel showing last 30 events with actor, action, entity type, and timestamp.

### Marketing / Calling / SMS
- Marketing page shows campaign summary stats and provider connection status.
- Calling page redesigned with provider status panel and A2P compliance note.
- SMS page redesigned with linked conversation threads and provider status.

### UI
- Added `Badge` component with status-aware `statusVariant` helper.
- Added `SidebarNav` client component with active route highlighting.
- `AppShell` no longer throws on missing Supabase env vars for the app name.
- Nav active state highlights current module.

### Validation
- Extended `lib/validation.ts` with `messageSchema`, `appointmentSchema`, `agencySchema`, contact `status` field.

## 0.2.0 - 2026-05-24

- Renamed product direction to GoLowLevel.
- Added Supabase Auth client, server, callback, and middleware integration.
- Added Google OAuth and password sign-in UI.
- Rebuilt Prisma schema around agency, sub account, Supabase-auth users, roles, contacts, tags, custom fields, conversations, calendars, opportunities, automations, sites, campaigns, phone numbers, and audit logs.
- Added first-login agency and sub-account bootstrap.
- Added tenant-scoped server actions for contacts, tags, custom fields, and sub accounts.
- Reworked app shell into dense CRM navigation.
- Added module pages for conversations, calendars, automations, opportunities, sites, marketing, calling, and SMS.
- Added security helpers, Zod validation, and audit logging.
- Initialized local git repository and set GitHub remote.

## 0.1.0 - 2026-05-24

- Created Next.js, TypeScript, Tailwind CSS, Postgres, and Prisma project foundation.
- Added initial tenant-aware Prisma schema.
- Added first app shell and placeholder milestone screens.
- Added project handoff documentation and environment example.

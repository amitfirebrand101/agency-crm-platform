# Project Context

Last updated: 2026-05-24

## Product Direction

Build `GoLowLevel`, a production-grade multi-tenant agency CRM SaaS with original branding and UI. It should support agency accounts, sub accounts, contacts, conversations, calendars, automations, opportunities, sites, marketing, calling, SMS, settings, and future provider integrations.

Do not copy GoHighLevel branding, text, UI, or proprietary workflows.

## Stack Used

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Prisma
- Zod
- lucide-react icons

## External Setup Provided

- GitHub repo: `https://github.com/amitfirebrand101/agency-crm-platform.git`
- Supabase project URL: `https://qraauvmmomiepojmodhh.supabase.co`
- Vercel app: `https://agency-crm-platform.vercel.app`
- Auth choice: Supabase Auth
- Email provider: skipped for now
- Region/currency: US/USD
- Theme: light and dark mode expected; light exists, dark toggle UI is present but persistence is not implemented yet
- Auth is temporarily bypassable with `AUTH_DISABLED="true"` so the dashboard can be accessed before Supabase Auth provider setup is complete.

Security note: Supabase secret material was shared during setup. Rotate secret keys before real production use.

## Files Created Or Updated

- `middleware.ts`
- `.env.example`
- `.env.local` local-only, gitignored
- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `PROJECT_CONTEXT.md`
- `prisma/schema.prisma`
- `prisma/migrations/202605241_init/migration.sql`
- `app/auth/callback/route.ts`
- `app/(auth)/login/page.tsx`
- `app/(auth)/login/loading.tsx`
- `app/(dashboard)/actions.ts`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/contacts/page.tsx`
- `app/(dashboard)/contacts/actions.ts`
- `app/(dashboard)/sub-accounts/page.tsx`
- `app/(dashboard)/sub-accounts/actions.ts`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/conversations/page.tsx`
- `app/(dashboard)/calendars/page.tsx`
- `app/(dashboard)/automations/page.tsx`
- `app/(dashboard)/opportunities/page.tsx`
- `app/(dashboard)/sites/page.tsx`
- `app/(dashboard)/marketing/page.tsx`
- `app/(dashboard)/calling/page.tsx`
- `app/(dashboard)/sms/page.tsx`
- `app/(dashboard)/workspaces/page.tsx`
- `components/auth/login-form.tsx`
- `components/layout/app-shell.tsx`
- `components/modules/module-page.tsx`
- `components/ui/card.tsx`
- `components/ui/field.tsx`
- `components/ui/stat-card.tsx`
- `lib/auth.ts`
- `lib/env.ts`
- `lib/prisma.ts`
- `lib/security.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `lib/validation.ts`

## Data Model Decisions

- `Agency` is the top-level tenant and owns currency, country, users, sub accounts, tags, custom fields, and audit logs.
- `SubAccount` is the client/location tenant boundary and owns contacts plus future CRM modules.
- Supabase Auth user IDs are used as `User.id` UUIDs in Prisma.
- `AgencyMembership` and `SubAccountMembership` separate agency-level permissions from sub-account operational permissions.
- Contacts, tags, custom fields, conversations, calendars, opportunities, automations, sites, campaigns, phone numbers, and audit logs carry tenant scope.
- Custom field values use JSON for flexible field storage.
- Provider-specific IDs are represented only where needed, with provider integrations deferred.

## Implemented Features

- Supabase Auth login screen with Google OAuth and password login.
- Auth callback route.
- Middleware route protection and session refresh.
- Automatic first-login bootstrap for a new agency owner and primary sub account.
- Reusable app shell with module navigation.
- Server-side role checks and tenant-scoped Prisma queries.
- Create sub account.
- Create contact.
- Create tag.
- Create custom field.
- Dashboard metrics from Prisma.
- Settings view for agency and members.
- Module pages for conversations, calendars, automations, opportunities, sites, marketing, calling, and SMS.
- Audit log helper for sensitive mutations.
- Git repository initialized and remote set.

## Known Gaps

- Supabase database password was not provided, so migrations were not applied to the hosted database.
- Direct DB connection from this machine failed with `P1001` to `db.qraauvmmomiepojmodhh.supabase.co:5432`; use Vercel runtime or Supabase pooler connection if direct access remains blocked.
- Initial schema SQL was generated at `prisma/migrations/202605241_init/migration.sql` for manual execution in Supabase SQL Editor.
- Google OAuth provider still needs to be configured in Supabase.
- Dark mode persistence is not implemented.
- Contact edit/delete, tag assignment, import/export, and profile timeline are not implemented yet.
- Invite flow and granular permission policies need implementation.
- No rate limiter is wired yet.
- No provider webhooks are implemented yet.
- No tests are configured yet.
- No CI/CD workflow has been added yet.

## Exact Next Steps

1. Add the real Supabase database password to Vercel `DATABASE_URL` and `DIRECT_URL`.
2. If direct DB access remains blocked locally, copy Supabase's pooler connection string from the dashboard and use that for local Prisma commands.
3. Run `npm run prisma:migrate` or `npx prisma db push` once a reachable database URL is configured.
4. Configure Google OAuth in Supabase.
5. Push this repo to GitHub and connect Vercel deployment.
6. Add rate limiting for auth-sensitive and mutation routes.
7. Add invite flow and email verification policy.
8. Add contact edit/delete, tag assignment, and contact detail timeline.
9. Add RLS-compatible Supabase policies or keep all application data behind Prisma server-only access with strict service boundaries.
10. Add tests for auth guards, tenant scoping, and mutation permissions.
11. Start deeper provider setup: Twilio/Telnyx, email provider, queue provider, storage, then Stripe.

## Verification

- `npm install @supabase/ssr @supabase/supabase-js zod`
- `npx prisma format`
- `npm run prisma:generate`
- `npm run build`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` after dynamic dashboard patch
- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/202605241_init/migration.sql`

# GoLowLevel

Production-oriented agency CRM SaaS foundation for multi-tenant agencies and client sub accounts. The product is inspired by the agency CRM category, but uses original naming, UI, copy, and implementation decisions.

## Current Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Prisma
- Zod
- lucide-react

## Implemented

- Supabase Auth-ready login with Google OAuth and password sign-in.
- Session middleware that protects application routes.
- Automatic first-login tenant bootstrap for agency owner and primary sub account.
- Tenant-aware Prisma schema for agencies, sub accounts, users, roles, contacts, tags, custom fields, conversations, calendars, opportunities, automations, sites, campaigns, phone numbers, and audit logs.
- CRM shell with dense module navigation.
- Real server actions for creating contacts, tags, custom fields, and sub accounts.
- Dashboard, Contacts, Sub accounts, Settings, and module planning screens.
- Audit logging helper for sensitive mutations.

## Security Posture

- Server-side session checks are required for dashboard routes.
- Mutations use server actions, Zod validation, role checks, and tenant IDs from the server session.
- Client-submitted tenant IDs are not trusted.
- Supabase secret keys stay server-only and must never be exposed in client bundles.
- Audit logs capture mutation actor, entity, action, metadata, timestamp, and request IP where available.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

3. Set real Supabase database password in:

```text
DATABASE_URL
DIRECT_URL
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Create and apply the first migration:

```bash
npm run prisma:migrate
```

If direct database access is blocked from your network, run the SQL in:

```text
prisma/migrations/202605241_init/migration.sql
```

Paste it into Supabase SQL Editor and execute it once.

6. Start local development:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

Project URL:

```text
https://qraauvmmomiepojmodhh.supabase.co
```

Required Supabase dashboard steps:

1. Authentication -> Providers -> enable Google.
2. Add Google OAuth client ID and secret.
3. Authentication -> URL Configuration:
   - Site URL local: `http://localhost:3000`
   - Site URL production: `https://agency-crm-platform.vercel.app`
   - Redirect URL local: `http://localhost:3000/auth/callback`
   - Redirect URL production: `https://agency-crm-platform.vercel.app/auth/callback`
4. Database -> Connection string -> copy the password-bearing URI into Vercel and local env.
5. Rotate the secret key before production because it was shared during setup.
6. If direct Postgres on port `5432` is unreachable, use the Supabase transaction pooler connection string for local Prisma commands.

## Vercel Setup

Project:

```text
agency-crm-platform
https://agency-crm-platform.vercel.app
```

Add these env vars in Vercel for Production, Preview, and Development:

```text
NEXT_PUBLIC_APP_NAME
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
DATABASE_URL
DIRECT_URL
AUTH_DISABLED
```

Use production app URL for `NEXT_PUBLIC_APP_URL` in production.

Temporary access mode:

```text
AUTH_DISABLED="true"
```

Use this only while Supabase Auth is being deferred. Set it back to `false` before handling real customer data.

## GitHub

Remote:

```text
https://github.com/amitfirebrand101/agency-crm-platform.git
```

The local repository has been initialized and the remote has been added.

## Next Provider Setup

1. Google OAuth for Supabase Auth.
2. Twilio or Telnyx for SMS, calling, A2P 10DLC, toll-free verification, and phone number inventory.
3. Resend or Postmark for transactional email and later conversation email.
4. Redis/BullMQ, Trigger.dev, or Inngest for automation execution and provider webhook jobs.
5. S3-compatible storage or Supabase Storage for attachments, media, forms, and site assets.
6. Stripe for billing when subscription plans are ready.

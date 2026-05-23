# HighLevel-Style Agency CRM SaaS Roadmap

Last updated: 2026-05-24

## Recommendation

Create a new project/repository for this app.

This current Codex workspace was created for diagnosing internet speed, so it should not become the long-term app repo. Use this file as the planning handoff, then create a clean project such as:

```text
agency-crm-platform/
```

Do not build a literal GoHighLevel clone. Build an original agency CRM/marketing automation platform with similar categories of functionality, original branding, original UI, and your own product decisions.

## Product Goal

Build a multi-tenant agency platform for managing leads, conversations, calling, SMS/email outreach, funnels, forms, surveys, sites, opportunities, automations, phone numbers, and sub-accounts.

The user mostly needs:

- Automations
- Conversations
- Contacts
- Funnels
- Forms
- Surveys
- Sites
- Settings
- SMS
- Email
- Tags
- Opportunities/pipelines
- Sub-accounts
- Calling
- A2P 10DLC numbers
- Toll-free numbers
- Phone number management

## Suggested Tech Stack

Recommended default:

- Frontend/app: Next.js with App Router, TypeScript
- UI: Tailwind CSS plus shadcn/ui or a similar internal component system
- Database: Postgres
- ORM: Prisma or Drizzle
- Auth: Better Auth, Auth.js, Clerk, or Supabase Auth
- Jobs/queues: Redis plus BullMQ, or Inngest/Trigger.dev for workflow execution
- Realtime: WebSockets, Pusher, Ably, or Supabase Realtime
- File storage: S3-compatible storage
- Payments: Stripe
- SMS/calling/phone numbers: Twilio, Telnyx, or Plivo
- Email sending: Resend, Postmark, Mailgun, or SendGrid
- Email receiving/inbound routing: Mailgun, SendGrid Inbound Parse, or Postmark inbound
- Page/funnel publishing: Next.js rendering plus custom domain mapping
- Analytics/events: PostHog or internal event tables

My preference for the first serious build:

```text
Next.js + TypeScript + Postgres + Prisma + Redis/BullMQ + Twilio + Resend/Postmark + Stripe
```

## Core Architecture

The platform should be multi-tenant from day one.

Main tenancy levels:

- Agency account: owns billing, users, global settings, and sub-accounts.
- Sub-account/location/workspace: owns contacts, conversations, pipelines, funnels, forms, surveys, phone numbers, automations, sites, and settings.
- User: belongs to one or more agencies/sub-accounts with roles and permissions.

Every business record should include:

- `agencyId`
- `subAccountId` where applicable
- `createdAt`
- `updatedAt`
- audit-friendly ownership fields when useful

Do not add features as isolated screens. Build shared platform modules:

- Identity and tenancy
- Contacts and custom fields
- Messaging and conversations
- Voice/calling
- Opportunities/pipelines
- Builders: forms, surveys, funnels, sites
- Automation engine
- Phone number/compliance
- Settings/admin
- Billing
- Reporting

## Major Modules

### 1. Auth, Agency, Sub-Accounts, Roles

Required:

- Sign up/login/logout
- Agency creation
- Sub-account creation
- Invite users
- Roles and permissions
- Agency-level settings
- Sub-account-level settings
- User profile settings
- Audit log for important changes

Important roles:

- Agency owner
- Agency admin
- Sub-account admin
- Sales user
- Support user
- Read-only user

### 2. Contacts, Tags, Custom Fields

Required:

- Contact list
- Contact profile
- Add/edit/delete contacts
- Import/export later
- Tags
- Custom fields
- Activity timeline
- Source attribution
- Contact owner
- DND/opt-out state
- Email/SMS/call history
- Linked opportunities
- Linked form/survey submissions

Contact fields:

- Name
- Email
- Phone
- Address/location fields
- Source
- Tags
- Custom fields
- Consent fields
- Time zone
- Assigned user

### 3. Conversations Inbox

Required:

- Unified inbox per sub-account
- SMS threads
- Email threads
- Call history
- Voicemail entries
- Internal notes
- Assign conversation to user
- Conversation status: open, pending, closed
- Search and filters
- Templates/snippets
- Attachments later

Channels:

- SMS
- Email
- Phone calls
- Voicemail
- Missed calls
- Later: Instagram/Facebook/WhatsApp if required

### 4. Calling and Voice

Required:

- Buy/connect phone numbers
- Make outbound calls from browser
- Receive inbound calls
- Call forwarding
- Call recording setting
- Voicemail
- Missed call tracking
- Call notes
- Call disposition/outcome
- Link calls to contacts and conversations
- Trigger automations from call events

Provider options:

- Twilio Voice is the easiest starting point.
- Telnyx may be better for advanced telephony/pricing in some cases.

Voice events to store:

- Call initiated
- Call ringing
- Call answered
- Call completed
- Missed call
- Voicemail received
- Recording available

Compliance:

- Recording consent rules vary by region.
- Show clear settings for call recording and consent prompts.

### 5. SMS, A2P 10DLC, Toll-Free

Required:

- SMS sending and receiving
- Phone number purchase
- Toll-free number support
- A2P 10DLC campaign registration status
- Brand registration status
- Campaign use case/status
- Opt-in/opt-out handling
- STOP/START/HELP handling
- Message templates
- Failed delivery tracking
- Rate limit awareness

Important: A2P and toll-free verification are provider/compliance workflows. Build screens that track status and guide the user, but much of the real approval is handled by Twilio/Telnyx/etc.

### 6. Email

Required:

- Send one-to-one email from conversations
- Bulk/automation email
- Inbound email threading
- Sender identities
- Domain authentication status
- Unsubscribe handling
- Bounce tracking
- Open/click events if provider supports them
- Email templates

Recommended provider:

- Postmark for transactional/conversation quality
- Resend for developer simplicity
- Mailgun/SendGrid if inbound parse and marketing-style workflows are priorities

### 7. Opportunities and Pipelines

Required:

- Pipelines
- Stages
- Opportunities/deals
- Drag-and-drop board
- Opportunity value
- Status: open, won, lost, abandoned
- Assigned user
- Linked contact
- Activity timeline
- Automation triggers on stage changes

### 8. Forms

Required:

- Form builder
- Fields: text, email, phone, select, checkbox, radio, date, hidden
- Custom fields mapping
- Embed script
- Public hosted form URL
- Submission storage
- Spam protection
- Trigger automations on submission

### 9. Surveys

Required:

- Survey builder
- Multi-step questions
- Conditional branches later
- Submission storage
- Contact creation/update
- Trigger automations on submission

### 10. Funnels and Sites

Required:

- Page/funnel builder
- Funnel steps
- Site pages
- Public preview
- Publish/unpublish
- Custom domains later
- Form/survey embedding
- Basic analytics
- Templates later

Start simple. A full drag-and-drop page builder is a big project. For MVP, consider section/block-based editing before unrestricted freeform layout.

### 11. Automation Engine

This is one of the most important modules.

Triggers:

- Contact created
- Tag added/removed
- Form submitted
- Survey submitted
- SMS received
- Email received
- Call missed
- Call completed
- Opportunity created
- Opportunity stage changed
- Appointment booked later
- Webhook received

Actions:

- Send SMS
- Send email
- Create/update contact
- Add/remove tag
- Create/update opportunity
- Move opportunity stage
- Assign user
- Wait/delay
- If/else condition
- Internal notification
- Webhook request
- Stop workflow

Must-have engine behavior:

- Durable job execution
- Retry failed steps
- Execution logs
- Per-contact workflow enrollment
- Avoid duplicate enrollment where configured
- Version workflows or snapshot definitions at runtime
- Rate limit SMS/email actions
- Respect opt-out/DND

### 12. Settings

Required settings areas:

- Business profile
- Users and roles
- Sub-accounts
- Phone numbers
- A2P/toll-free verification
- Email domains/senders
- Pipelines
- Tags
- Custom fields
- Templates
- Integrations
- Billing
- Notification settings
- Security settings
- Audit log

## Roadmap

### Phase 0: Product and Repo Setup

Output:

- New repo/project
- Product name
- Stack chosen
- Database schema draft
- Design direction
- Environment variable plan
- Handoff docs

Decisions needed:

- Twilio vs Telnyx
- Resend/Postmark/Mailgun/etc.
- Prisma vs Drizzle
- Auth provider
- Hosted platform: Vercel, Render, Railway, Fly.io, AWS, etc.

### Phase 1: Foundation

Build:

- Next.js app shell
- Auth
- Agency/sub-account tenancy
- Users and roles
- Database schema
- Settings layout
- Navigation
- Seed/demo data

Acceptance:

- User can create agency and sub-account
- User can switch sub-accounts
- Records are scoped correctly by sub-account

### Phase 2: Contacts, Tags, Custom Fields

Build:

- Contacts table
- Contact detail page
- Tags
- Custom fields
- Activity timeline base
- Import/export optional

Acceptance:

- User can manage contacts, tags, and custom fields
- Contact data is isolated per sub-account

### Phase 3: Conversations, SMS, Email

Build:

- Conversations inbox
- SMS provider integration
- Inbound SMS webhook
- Outbound SMS
- Email send
- Inbound email if selected provider supports it
- Message delivery status
- Opt-out handling

Acceptance:

- User can send and receive SMS from contact thread
- User can send email from contact thread
- Incoming messages appear in the correct sub-account/conversation

### Phase 4: Calling and Phone Numbers

Build:

- Phone number purchase/assignment
- Browser outbound calling
- Inbound call handling
- Call logs
- Voicemail/missed call records
- Call recording setting
- Conversation linking

Acceptance:

- User can call a contact from the app
- Incoming/missed calls are logged
- Call events appear in conversations and contact timeline

### Phase 5: Opportunities/Pipelines

Build:

- Pipeline settings
- Stages
- Opportunity board
- Create/edit opportunities
- Link opportunities to contacts
- Stage-change events

Acceptance:

- User can manage deals visually by pipeline stage
- Stage changes can later trigger automations

### Phase 6: Forms and Surveys

Build:

- Form builder
- Survey builder
- Public form/survey rendering
- Submissions
- Contact creation/update from submissions
- Embed code

Acceptance:

- Public submissions create/update contacts
- Submissions appear in contact timeline

### Phase 7: Automation Engine

Build:

- Workflow builder UI
- Trigger/action model
- Job runner
- Wait/delay
- Conditions
- Execution history
- Retries and failure display

Acceptance:

- Form submission can trigger SMS/email/tag/opportunity actions
- Inbound SMS or missed call can trigger a workflow
- Failed actions are visible and retryable

### Phase 8: Funnels and Sites

Build:

- Funnel/site list
- Page builder MVP
- Hosted public pages
- Funnel steps
- Forms/surveys embedded in pages
- Publish/unpublish
- Basic analytics

Acceptance:

- User can publish a simple funnel/site
- Leads captured from funnel pages enter contacts and automations

### Phase 9: A2P, Toll-Free, Compliance, Deliverability

Build:

- A2P brand/campaign status screens
- Toll-free verification status screens
- Opt-in proof fields
- Message compliance warnings
- Email domain authentication status
- Bounce/complaint handling

Acceptance:

- Sub-account can track messaging compliance status
- SMS/email sends respect opt-out and compliance state

### Phase 10: Reporting, Billing, Hardening

Build:

- Dashboard
- Lead source reporting
- Conversation reporting
- Automation reporting
- Usage billing
- Stripe subscriptions
- Rate limiting
- Audit logs
- Error monitoring
- Backups

Acceptance:

- Agency owner can see usage and billing
- Platform is ready for controlled beta users

## Suggested File For Ongoing Handoff

In the new project, create and maintain:

```text
PROJECT_CONTEXT.md
```

Every coding assistant should update it when making meaningful changes.

Suggested format:

```markdown
# Project Context

## Current Goal

## Current Stack

## Architecture Decisions

## Database Notes

## Implemented Features

## In Progress

## Known Issues

## Next Steps

## Environment Variables

## Recent Changes
- YYYY-MM-DD: ...
```

Also create:

```text
CHANGELOG.md
```

Use `PROJECT_CONTEXT.md` for working context and `CHANGELOG.md` for user-facing/release-style changes.

## Collaboration Rules For Codex And Claude

When any assistant works on the project:

- Read `PROJECT_CONTEXT.md` first.
- Read the relevant files before editing.
- Keep changes scoped to the current task.
- Update `PROJECT_CONTEXT.md` after significant architecture or feature changes.
- Add migrations for schema changes.
- Do not rename broad structures without noting why.
- Do not silently change provider assumptions.
- Do not copy GoHighLevel branding, UI, or proprietary text.
- Prefer original product language and UI.
- Run tests/typechecks/lint when available.
- Record commands run and results when useful.

## First Build Prompt To Use

Use this when starting the new project:

```text
Create a new multi-tenant agency CRM SaaS from scratch. It should be inspired by the category of tools like HighLevel, but use original branding, UI, copy, and architecture. The first milestone is foundation + contacts + tags + sub-accounts.

Set up a Next.js TypeScript app with a clean app shell, auth-ready architecture, Postgres ORM schema, tenant-aware data model, and PROJECT_CONTEXT.md. Do not implement every feature yet. Build the foundation so future modules can be added safely: conversations, SMS/email, calling, opportunities, forms, surveys, funnels, sites, automations, phone numbers, A2P/toll-free, and settings.

After changes, update PROJECT_CONTEXT.md with what was created, key decisions, and next steps.
```

## MVP Priority

Build in this order:

1. Foundation: auth, agencies, sub-accounts, roles
2. Contacts, tags, custom fields
3. Conversations with SMS/email
4. Calling and phone number management
5. Opportunities/pipelines
6. Forms/surveys
7. Automation engine
8. Funnels/sites
9. A2P/toll-free/compliance screens
10. Reporting, billing, hardening

## Biggest Risks

- Messaging compliance can block SMS features if not planned early.
- Browser calling needs careful provider integration and webhook handling.
- Automation engines become unreliable if built as simple synchronous code.
- Multi-tenancy mistakes can leak data between sub-accounts.
- A full page builder can consume huge time; start block-based.
- Deliverability matters more than UI for SMS/email.

## Immediate Next Step

Create a new project/repo and initialize the foundation. Keep this roadmap available as the starting plan, then copy its important parts into the new repo's `PROJECT_CONTEXT.md`.

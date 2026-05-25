# Automation Parity Audit

This is the working source-of-truth for building GoLowLevel automations toward HighLevel-level coverage without copying HighLevel branding, UI copy, or proprietary implementation. It is derived from public HighLevel help docs reviewed on 2026-05-25.

Primary sources:
- HighLevel workflow triggers: https://help.gohighlevel.com/support/solutions/articles/155000002292
- HighLevel workflow actions: https://help.gohighlevel.com/support/solutions/articles/155000002294-what-are-workflow-actions-complete-list-
- HighLevel If/Else action: https://help.gohighlevel.com/support/solutions/articles/155000002471-workflow-action-if-else
- HighLevel internal notification action: https://help.gohighlevel.com/support/solutions/articles/155000003202-workflow-action-internal-notification

## Implementation Rules

- A catalog item is not “done” unless it has typed config, validation, tenant checks, executor behavior, run/step logs, and UI that exposes the real options.
- Provider-backed actions must not pretend delivery happened. They stay disabled or fail with a clear provider-required result until credentials and adapters exist.
- Branching must create real paths in workflow JSON, not just a text field.
- External calls need rate limits, SSRF protection, timeouts, payload limits, and delivery logs.
- Every event trigger needs an event emitter in the owning module.

## Trigger Inventory

| Category | Trigger | What Starts It | Required/Expected Options | Current Status |
| --- | --- | --- | --- | --- |
| Contact | Birthday Reminder | Contact birthday reaches configured offset. | birthday/date field, before/on/after offset, timezone, time of day. | Missing date-field model support. |
| Contact | Contact Changed | Selected contact fields change. | field selector, operator, old/new value filters. | Partially wired; needs field-level filters. |
| Contact | Contact Created | Contact is created. | optional source/status/tag filters. | Wired. |
| Contact | Contact DND | Contact email/SMS DND changes. | channel, enabled/disabled. | Action exists; trigger missing. |
| Contact | Contact Tag | Tag added/removed. | tag, event type added/removed. | Added and removed wired separately. |
| Contact | Custom Date Reminder | Custom date field reaches offset. | object type, date field, offset, time, timezone. | Missing scheduler/date field engine. |
| Contact | Note Changed | Note created/updated/deleted. | note event, author/user filters. | Missing note model. |
| Contact | Task Added | Task is created. | task title/type/user filters. | Missing task model. |
| Contact | Task Reminder | Task due date reminder fires. | due offset, assigned user filters. | Missing task scheduler. |
| Contact | Task Completed | Task marked complete. | task filters, assigned user. | Cataloged only. |
| Contact | Contact Engagement Score | Score crosses configured threshold. | score field, operator, value. | Missing scoring module. |
| Events | Call Details | Call event occurs. | call direction/status/duration/number filters. | Requires calling provider. |
| Events | Email Events | Email sent/opened/clicked/replied/bounced/etc. | email/template/campaign, event type. | Requires email provider/events. |
| Events | Conversation AI Trigger | AI conversation event occurs. | agent/bot, outcome/intent filters. | Missing AI conversation module. |
| Events | Customer Replied | Contact replies in a conversation. | channel, contains/exact text, direction. | Cataloged; conversation inbound emitter missing. |
| Events | Custom Trigger | App/API emits custom event. | event key, payload filters. | Needs custom event UI/API. |
| Events | Form Submitted | Form submission received. | form, page/site, field filters. | Forms exist; submission/event wiring needed. |
| Events | Survey Submitted | Survey submission received. | survey, field filters. | Surveys exist; submission/event wiring needed. |
| Events | Trigger Link Clicked | Tracked link clicked. | trigger link, campaign/message filters. | Missing trigger link model. |
| Events | Facebook Lead Form Submitted | Meta lead ad form submitted. | page, form, field mapping. | Requires Meta OAuth/webhooks. |
| Events | TikTok Form Submitted | TikTok lead form submitted. | account/form mapping. | Requires TikTok integration. |
| Events | Video Tracking | Video watch event occurs. | video, percentage/milestone. | Missing video tracking. |
| Events | Number Validation | Phone validation completes. | status/result filters. | Requires validation provider. |
| Events | Messaging Error - SMS | SMS provider error occurs. | error code, provider, number. | Requires SMS provider/status callbacks. |
| Events | LinkedIn Lead Form Submitted | LinkedIn lead form submitted. | account/form mapping. | Requires LinkedIn integration. |
| Events | Funnel/Website PageView | Page view tracked. | site/page/URL, UTM filters. | Requires tracking script/events. |
| Events | Quiz Submitted | Quiz submitted. | quiz, score/answer filters. | Missing quiz module. |
| Events | Prospect Generated | Prospecting result generated. | source/campaign filters. | Missing prospecting module. |
| Events | Click To WhatsApp Ads | WhatsApp ad click event occurs. | ad/account/campaign filters. | Requires Meta/WhatsApp integration. |
| Events | External Tracking Event | External tracking event received. | event name, source, payload filters. | Needs tracking endpoint. |
| Appointments | Appointment Status | Appointment status changes. | calendar, status, appointment type. | Wired basic status. |
| Appointments | Customer Booked Appointment | Customer books an appointment. | calendar, user, appointment type. | Missing dedicated booking event. |
| Appointments | Service Booking | Service booking created/changed. | service, status, staff. | Missing services module. |
| Appointments | Rental Booking | Rental booking created/changed. | rental asset, status. | Missing rentals module. |
| Opportunities | Opportunity Created | Opportunity is created. | pipeline, stage, value filters. | Wired basic event. |
| Opportunities | Opportunity Changed | Opportunity fields change. | field, pipeline, stage, status filters. | Missing broad field-change emitter. |
| Opportunities | Pipeline Stage Changed | Opportunity moves stages. | pipeline, from stage, to stage. | Wired basic event. |
| Opportunities | Stale Opportunities | Opportunity has not changed for configured time. | pipeline, stage, stale duration. | Missing scheduler query. |
| Affiliate | Affiliate Created | Affiliate record created. | campaign/source filters. | Missing affiliate module. |
| Affiliate | New Affiliate Sales | Affiliate sale recorded. | campaign/product/value filters. | Missing affiliate/payments. |
| Affiliate | Affiliate Enrolled In Campaign | Affiliate added to campaign. | campaign. | Missing affiliate module. |
| Affiliate | Lead Created | Affiliate-attributed lead created. | affiliate/campaign. | Missing affiliate attribution. |
| Courses | Category Started | Learner starts category. | product/category. | Missing courses module. |
| Courses | Category Completed | Learner completes category. | product/category. | Missing courses module. |
| Courses | Lesson Started | Learner starts lesson. | product/category/lesson. | Missing courses module. |
| Courses | Lesson Completed | Learner completes lesson. | product/category/lesson. | Missing courses module. |
| Courses | New Signup | Learner signs up. | offer/product. | Missing courses module. |
| Courses | Offer Access Granted | Offer access granted. | offer. | Missing courses module. |
| Courses | Offer Access Removed | Offer access removed. | offer. | Missing courses module. |
| Courses | Product Access Granted | Product access granted. | product. | Missing courses module. |
| Courses | Product Access Removed | Product access removed. | product. | Missing courses module. |
| Courses | Product Started | Product started. | product. | Missing courses module. |
| Courses | Product Completed | Product completed. | product. | Missing courses module. |
| Courses | User Login | Course/community user logs in. | user/product/community filters. | Missing portal auth events. |
| Payments | Invoice | Invoice status/event occurs. | invoice status, amount, product. | Missing invoicing. |
| Payments | Order Form Submission | Order form submitted. | form/product. | Missing checkout/order forms. |
| Payments | Order Submitted | Order submitted. | product, amount, status. | Missing payments/orders. |
| Payments | Documents & Contracts | Document/contract event occurs. | template/status/signer. | Missing docs/contracts. |
| Payments | Estimates | Estimate event occurs. | status/amount. | Missing estimates. |
| Payments | Subscription | Subscription event occurs. | product, status, failure/trial filters. | Missing subscriptions. |
| Payments | Refund | Refund occurs. | amount/product/status. | Missing payments. |
| Payments | Coupon Code Applied | Coupon applied. | coupon/product/order. | Missing coupons. |
| Payments | Coupon Redemption Limit Reached | Coupon limit reached. | coupon. | Missing coupons. |
| Payments | Coupon Code Expired | Coupon expires. | coupon. | Missing coupons scheduler. |
| Payments | Coupon Code Redeemed | Coupon redeemed. | coupon/order/contact. | Missing coupons. |
| Ecommerce | Shopify Abandoned Cart | Shopify checkout abandoned. | store/product/cart value. | Requires Shopify. |
| Ecommerce | Shopify Order Placed | Shopify order placed. | store/product/status. | Requires Shopify. |
| Ecommerce | Shopify Order Fulfilled | Shopify order fulfilled. | store/product/status. | Requires Shopify. |
| Ecommerce | Order Fulfilled | Store order fulfilled. | store/product/status. | Missing ecommerce. |
| Ecommerce | Product Review Submitted | Product review submitted. | product/rating. | Missing ecommerce reviews. |
| Ecommerce | Abandoned Checkout | Checkout abandoned. | store/product/cart value/time. | Missing ecommerce. |
| IVR | Start IVR Trigger | Caller reaches IVR entry/option. | phone number, menu/option. | Requires voice/IVR module. |
| Social | Facebook Comment On Post | Facebook post receives comment. | page/post/comment filters. | Requires Meta. |
| Social | Instagram Comment On Post | Instagram post receives comment. | account/post/comment filters. | Requires Meta. |
| Communities | Group Access Granted | Community access granted. | group. | Missing communities. |
| Communities | Group Access Revoked | Community access revoked. | group. | Missing communities. |
| Communities | Private Channel Access Granted | Channel access granted. | channel. | Missing communities. |
| Communities | Private Channel Access Revoked | Channel access revoked. | channel. | Missing communities. |
| Communities | Leaderboard Level Changed | Community leaderboard level changes. | group/level. | Missing communities. |
| Certificates | Certificates Issued | Certificate generated. | product/certificate. | Missing certificates/courses. |
| Communication | TikTok Comment On Video | TikTok video comment received. | account/video/comment filters. | Requires TikTok. |
| Communication | Transcript Generated | Call/conversation transcript created. | source/channel. | Missing transcript service. |
| Google Ads | Google Lead Form Submitted | Google lead form submitted. | account/form mapping. | Requires Google Ads integration. |

## Action Inventory

| Category | Action | What It Must Do | Required/Expected Fields | Current Status |
| --- | --- | --- | --- | --- |
| Contact | Create Contact | Create a tenant-scoped contact. | first name, last name, email, phone, source, tags, custom fields, duplicate behavior. | Basic. Needs custom fields/duplicate behavior. |
| Contact | Find Contact | Find existing contact and bind it to workflow context. | search by email/phone/id/custom field, fallback behavior. | Missing. |
| Contact | Update Contact Field | Update native/custom contact fields. | field selector, value/dynamic value, overwrite rules. | Basic native fields only. |
| Contact | Add Contact Tag | Add tag. | tag selector/create tag. | Working. |
| Contact | Remove Contact Tag | Remove tag. | tag selector. | Working. |
| Contact | Assign to User | Assign contact owner. | user/round robin/assigned user rules. | Basic user email. |
| Contact | Remove Assigned User | Clear contact owner. | none or target owner type. | Working. |
| Contact | Edit Conversation | Open/close/read/unread/assign conversation. | conversation selector/context, status, assignee. | Missing. |
| Contact | Set Contact DND | Enable/disable communication opt-outs. | email/SMS/both, enabled, reason. | Basic. |
| Contact | Add Note | Create note on contact timeline. | note body, author, pinned/visibility. | Implemented as internal note conversation. Needs real note model. |
| Contact | Add Task | Create task. | title, description, due date/delay, assigned user, priority. | Missing task model. |
| Contact | Copy Contact | Duplicate contact to another sub-account/workflow context. | target sub-account, fields/tags. | Missing. |
| Contact | Delete Contact | Delete contact. | explicit confirmation, archive vs permanent. | Guarded delete. |
| Contact | Modify Engagement Score | Adjust engagement score. | operation add/subtract/set, value. | Missing scoring. |
| Contact | Add/Remove Followers | Manage contact followers. | user/team, add/remove. | Missing followers. |
| Communication | Send Email | Send customer email and log conversation. | from name/email, reply-to, template/custom body, subject, attachments, send window, unsubscribe/compliance. | Provider missing. UI shallow. |
| Communication | Send SMS | Send customer SMS/MMS and log conversation. | from number, message, media, consent/opt-out, quiet hours. | Provider missing. |
| Communication | Send Slack Message | Send Slack notification. | workspace/channel/user, message. | Requires Slack. |
| Communication | Call | Start/log call. | from number, destination, user/queue. | Requires voice provider. |
| Communication | Messenger | Send Messenger message. | page, recipient, template/message. | Requires Meta. |
| Communication | Instagram DM | Send Instagram DM. | account, recipient, template/message. | Requires Meta. |
| Communication | Manual Action | Create manual step/task requiring user completion. | assignee, due date, instructions. | Missing. |
| Communication | GMB Messaging | Send Google Business Profile message. | location, message. | Requires Google Business. |
| Communication | Send Internal Notification | Notify users by email, in-app, SMS, WhatsApp. | notification type, recipients, subject/title, message, CC/BCC for email, attachments, redirect page. | Basic internal note only; needs notification/email/SMS adapters. |
| Communication | Send Review Request | Send review request. | review link/source, channel, template. | Missing reputation module. |
| Communication | Conversation AI | Run conversation AI. | agent, intent/outcome, handoff rules. | Missing AI module. |
| Communication | Facebook Interactive Messenger | Send interactive Messenger flow. | page, template/buttons. | Requires Meta. |
| Communication | Instagram Interactive Messenger | Send interactive Instagram flow. | account, template/buttons. | Requires Meta. |
| Communication | Reply in Comments | Reply to social comment. | platform/post/comment, reply body. | Requires social comments. |
| Communication | WhatsApp | Send WhatsApp message. | provider, template, variables, media. | Requires WhatsApp provider. |
| Communication | Send Live Chat Message | Send chat widget message. | conversation, message, sender. | Missing live chat. |
| Send Data | Webhook | Deliver HTTP request and log response. | URL, method, headers, body mapping, retry policy. | Basic POST with SSRF guard/logging. Needs headers/body/retries. |
| Send Data | Google Sheets | Append/update row. | account, spreadsheet, sheet, column mapping. | Requires Google OAuth. |
| Internal Tools | Goal Event | Move contact to goal/exit waits when condition met. | goal condition, timeout, remove behavior. | Missing. |
| Internal Tools | If/Else | Branch workflow path. | branches, condition groups, AND/OR, operators, dynamic values, else path. | Branch UI now basic Yes/No. Needs multi-branch condition builder. |
| Internal Tools | Split | Random A/B split. | percentages, paths. | Missing. |
| Internal Tools | Update Custom Value | Update account custom value. | custom value key, operation, value. | Missing custom values. |
| Internal Tools | Go To | Jump to another step/workflow point. | target step/branch. | Missing graph jump. |
| Internal Tools | Arrays | Transform/list operations. | source, filter/map/reduce config. | Missing. |
| Internal Tools | Drip Mode | Batch/delay enrolled contacts. | batch size, interval, schedule window. | Missing queue controls. |
| Internal Tools | Text Formatter | Transform strings. | source value, operation, output variable. | Missing variables. |
| Internal Tools | Custom Code | Run sandboxed custom code. | code, inputs, outputs, timeout. | Do not implement until sandbox exists. |
| Internal Tools | Math Operation | Calculate/store numeric output. | operands, operation, output variable/field. | Missing. |
| Workflow AI | AI Prompt | Run AI prompt and store result. | provider/model, prompt, inputs, output destination. | Missing provider/config. |
| Eliza | Appointment Booking | Let Eliza book appointment. | agent/calendar/service. | Missing Eliza/provider. |
| Eliza | Send to Agent Platform | Send conversation/contact to Eliza. | agent, payload mapping. | Missing Eliza/provider. |
| Appointments | Update Appointment Status | Update appointment. | target appointment, status. | Basic latest appointment. Needs explicit target. |
| Appointments | Generate One-Time Booking Link | Generate single-use booking URL. | calendar, user, expiration, contact. | Missing booking link model. |
| Opportunities | Create/Update Opportunity | Upsert opportunity. | pipeline, stage, status, value, title, owner, duplicate matching. | Create basic, update basic. |
| Opportunities | Remove Opportunity | Remove from one/multiple pipelines. | pipeline/opportunity selector, archive/delete. | Missing. |
| Payments | Stripe One-Time Charge | Charge stored Stripe customer. | Stripe account, customer id, amount, currency, description. | Requires Stripe. |
| Payments | Send Invoice | Create/send invoice. | invoice template/items/taxes/due date. | Missing invoicing. |
| Payments | Send Documents and Contracts | Send document/contract. | template, recipients, signing order. | Missing docs/contracts. |
| Marketing | Add to Google Analytics | Send GA event. | measurement id/event/payload. | Requires GA. |
| Marketing | Add to Google AdWords | Send conversion. | account/conversion action/value. | Requires Google Ads. |
| Marketing | Add to Facebook Custom Audience | Add contact to audience. | ad account/audience, identifier mapping. | Requires Meta. |
| Marketing | Remove from Facebook Custom Audience | Remove contact from audience. | ad account/audience. | Requires Meta. |
| Marketing | Facebook Conversion API | Send CAPI event. | pixel/event, user data, custom data. | Requires Meta. |
| Affiliate | Add to Affiliate Manager | Create affiliate. | affiliate info/campaign. | Missing affiliate module. |
| Affiliate | Update Affiliate | Update affiliate record. | affiliate, fields. | Missing affiliate module. |
| Affiliate | Add/Remove from Affiliate Campaign | Manage campaign membership. | affiliate, campaign, add/remove. | Missing affiliate module. |
| Courses | Course Grant Offer | Grant course offer. | contact, offer/product, expiration. | Missing courses. |
| Courses | Course Revoke Offer | Revoke course offer. | contact, offer/product. | Missing courses. |
| IVR | Gather Input on Call | Collect keypad/speech input. | prompt, timeout, retries, branch mapping. | Missing IVR. |
| IVR | Play Message | Play TTS/audio. | text/audio URL, voice. | Missing IVR. |
| IVR | Connect to Call | Transfer call. | user/number/ring strategy. | Missing IVR. |
| IVR | End Call | Hang up. | reason/log. | Missing IVR. |
| IVR | Record Voicemail | Record voicemail. | max duration, transcription, destination. | Missing IVR. |
| Communities | Grant Group Access | Give community group access. | group, member/contact. | Missing communities. |
| Communities | Revoke Group Access | Remove community group access. | group, member/contact. | Missing communities. |

## Immediate Build Order

1. Replace generic config fields with action-specific forms for IF/ELSE, Send Email, Send Internal Notification, Webhook, Wait, Opportunity, Appointment, and Contact actions.
2. Add workflow variables and merge-field resolver (`{{contact.firstName}}`, previous step outputs, trigger payload).
3. Add Email module: templates, sender identities, provider adapter, email conversation logging, status webhooks.
4. Add provider-backed SMS module with consent/opt-out and Twilio/Telnyx callbacks.
5. Add task/note models before claiming Add Task/Note parity.
6. Add event emitters from every owning module as those modules are completed.

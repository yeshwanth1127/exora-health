# Managed dashboard integrations

Implementation checkout: branch `codex/dashboard-integrations`. This packet covers the HMS_NEW staff dashboard and its Fastify API/worker. It does not modify the older hospital backend or deploy anything.

## Customer experience

- WhatsApp: connect through Meta's secure consent window, use the inbox, assign conversations, send replies, accept appointment bookings, enable appointment notices, review and approve promotions, see recorded delivery, record purpose-specific consent, and disconnect. Meta owns account/password/phone verification. Provider credentials, registration PINs, webhook settings and token exchanges remain on the server.
- Google: connect through Google consent, select an accessible clinic listing, read details/reviews/posts, publish supported profile fields, reply/delete replies, publish/delete text updates/events/offers, schedule text posts, inspect performance, and disconnect. Google can review or reject changes after accepting them. Owners must grant access; OAuth cannot remove that requirement.
- Analytics: company-managed Umami, one website address and one public installation snippet. A site's status becomes Counting only after its origin-matched event is accepted by Umami. Counts, referrals, devices, public page categories and supported clicks are read server-side. PostHog is an optional company-managed mirror, not a second customer setup flow.

The existing page shell, tab structure and component kit remain. The analytics provider/key-entry screens are replaced by managed setup. Integration setup no longer requires adding doctors, fees and schedules first; published doctors, priced consultation slots and a dedicated server booking identity are prerequisites for accepting appointments.

## Implemented boundaries

Migration `20261015090000_managed_dashboard_integrations.sql` adds tenant-owned connections, one-use connection attempts, website mappings, WhatsApp draft preferences and an irreversible send-attempt ledger. Tables enforce tenant RLS, composite tenant keys, indexed foreign keys and the existing version trigger. Disconnects clear encrypted credentials and pending authorizations, disable the connection and cancel queued managed replies. Historical identities remain reserved rather than being reassigned across clinics.

Credentials use AES-256-GCM with tenant/facility/provider binding as authenticated data. Store the master key in company secret management and retain it across restarts; losing or replacing it requires reconnecting accounts. Idempotency records and audit diffs never contain provider tokens. Callbacks omit parameters from request logs, and dashboard responses are private/no-store. A legitimate customer can inspect their own dashboard API requests; browser-visible public IDs and the installation snippet are not secrets. Security comes from server authorization and tenant isolation.

Google uses short-lived, actor-scoped state, an HttpOnly/SameSite callback cookie, PKCE, a fixed redirect origin, refresh tokens and provider-verified listing membership. Writes commit an attempt before contacting Google; a retry of an uncertain write requires reading provider state rather than silently reposting.

Meta signup exchanges codes server-side and verifies the chosen phone against the selected WABA. Subscription and phone registration must succeed before exposing a connected state. Dynamic bindings come from encrypted database records, not browser assertions or runtime edits to environment variables. The signed webhook validates complete batches before storing them. STOP/human commands use the existing synchronous controls.

The worker sends only explicit managed inbox replies, responses to signed inbound booking messages, newly armed appointment notices, and reviewed/approved promotion recipients. Existing log/simulation rows remain simulations. Before sending it rechecks the live connection, clinic/module state, staff access, active contact and purpose-specific permission. Free-text replies also need a fresh inbound window on the same receiving number. Appointment notices and promotions require current provider-approved message content; they do not borrow a free-text window. Scheduled messages respect the facility timezone and quiet hours. Concurrent workers share a durable claim. Unknown acceptance is not automatically retried; receipts advance only the matching account/message and cannot regress read/delivered status.

Analytics collection accepts only a bounded public page category, source category, device category and one of five named events. It drops titles, queries, form contents, patient/booking identifiers, arbitrary event properties and staff/teleconsult pages. It honors DNT/GPC. Origin checks and per-IP limits reduce accidental/abusive collection; public analytics events are not authenticated evidence of a clinical booking. IP/User-Agent reach company-managed Umami to support its own visit calculation; they are not mirrored to PostHog. Add collection to the website privacy notice and apply site-specific consent requirements. No screen recording, autocapture or identity profile is enabled by this integration.

## Company activation

Populate the server-only settings documented in `.env.example`; none belong in a `VITE_` variable:

1. Fixed dashboard origin and a persistent random 32-byte encryption key (64 hex characters).
2. Company Google OAuth client/secret, Business Profile API access, and redirect `<dashboard-origin>/integrations/google/callback`. Enable Account Management, Business Information, reviews/posts, and Performance APIs as applicable.
3. Company Meta app ID/secret, approved embedded-signup configuration, supported pinned Graph API version and verify token. Configure the `messages` callback at `<dashboard-origin>/v1/integrations/whatsapp/webhook`; set `WA_MANAGED_SENDING_ENABLED=true` only for the intended live environment and run the worker.
4. A company-controlled, self-hosted Umami 3.x origin and API key, optionally a team ID. This adapter targets the self-hosted `/api` endpoints, not Umami Cloud's distinct API base.
5. Optionally, one company PostHog ingestion key and approved US/EU ingestion origin. Failure of the mirror does not change Umami's canonical counts.
6. Apply the migration and regenerate DB types. Route `/v1/*`, `/integrations/*`, `/a.js` and `/a/collect` to the API under the configured origin. Keep the separate Umami administration surface private. CORS does not replace HTTPS or the exact site's Origin check.
7. Connect an authorized test clinic from the dashboard. Verify provider callbacks and receipt/readback, installation collection and owner-visible publishing with real accounts before production acceptance.

The user confirmed on 2026-10-16 that the deployment URL and company accounts are not provisioned yet. No company provider credentials were present in the inspected checkout. Read-only Meta inspection found Hospital-WA-booking in development mode, with its existing messages subscription targeting the Avocado service; no subscription was changed. Live provider acceptance, delivery, production hosting and owner-consent flows are therefore unverified. Local provider tests use injected HTTP transports and a separate PostgreSQL cluster on port 54339.

## Operational behavior

WhatsApp booking is a deterministic conversation: explicit care consent, optional separate reminder consent, speciality/doctor selection, visit mode, actual available time and fee, patient name, and an explicit CONFIRM. Signed inbound IDs are consumed once, state persists for 15 minutes, and the booking command replays by that same ID. It reuses the public booking transaction's authority, calendar/fee locks, reservation and persisted readback. A WhatsApp caller becomes an unregistered booking party with a verified WhatsApp channel; a shared phone never selects a clinical patient. Only the explicitly granted care/reminder purposes transfer to that booking party. STOP and human requests stop automation; there is no automatic cancellation/rescheduling based on chat text. Staff handle those changes through the appointment workflow.

Booking activation is validated server-side and its dashboard switch waits for saved readback. Number snapshots bind inbound messages, chat state, reply windows and queued messages. Reconnecting another number cannot inherit an older number's reply window or pending sends. Historical inbound rows without a number snapshot do not authorize live replies; a fresh message is required.

The Automations tab prepares five fixed utility notices: confirmation, 24-hour reminder, 2-hour reminder, rescheduled and cancelled. A committed, account-scoped submission claim precedes template creation. Unknown creation is reconciled by read-only lookup, never blindly resubmitted. Pending approvals are polled by the worker. Only new appointments created after enabling a ready rule are armed; turning on a rule never upgrades historical simulation rows. A WhatsApp booking already receives its chat confirmation, so it does not get a second automated confirmation. Delivery rechecks appointment status, successor, contact ownership, consent, rule revision, provider content and authority under locks.

Promotions use approved, plain-text marketing messages without parameters, headers or buttons. Staff choose a message, future time and estimated budget cap, then review the persisted audience count/body/cost. An authorized approver schedules the exact snapshot. Audience changes force another preview; the worker checks current opt-in, destination, approval, quiet hours and a 24-hour sending deadline. Each campaign supports up to 500 opted-in contacts. Provider charges may differ from the configured estimate; it is not an invoice or provider-side spend guarantee. Provider message approval is performed by the company service team, without a customer developer console.

Google schedules are durable, actor-attributed and cancellable before claiming. The worker checks current listing/connection and publishing permission, commits an attempt, then publishes once. Disconnect, withdrawn access and expired schedules prevent publishing. Unknown publication remains visible for provider readback; it is never silently reposted. The post editor retains text on a failed request and reports success only after server acceptance.

Website booking totals come only from committed public booking commands on an enabled, origin-matched analytics site in the same facility. Appointment IDs stay in the tenant database; no name, phone, appointment ID or booking reference is sent to Umami/PostHog. Replaying a booking receipt cannot increment the count twice. These are aggregate website booking counts, not individual visitor identity matching. The rate compares those counts with measured visitors; blocked visit tracking can change that ratio. DNT/GPC suppress optional attribution as well as collection. Optional PostHog events have a durable queue, a stable event UUID on retries, bounded backoff and ten attempts; the mirror does not change Umami's canonical traffic reports.

## Minimal release limits

Media/flow file uploads, Google photo publishing, category/service/attribute/holiday publishing and automatic review requests remain unavailable. These optional preview controls are disabled. The minimal release uses text messages and the existing public appointment catalogue, and keeps profile publishing to name, phone, website, description and regular hours. Campaign creation supports existing approved plain-text messages; campaign image editing and arbitrary template design are outside this release. Google reads remain bounded to the latest 50 reviews and 100 posts. Independent website pages need the public installation snippet once; the integration does not rewrite or automatically instrument a separate website repository.

A crash after an irreversible send/publishing claim can leave a claimed/unknown result. Its ledger prevents automatic resend. Reconcile against provider events/readback before requesting a new intent; local tests do not establish exactly-once external delivery.

## Operator activation check

Run `pnpm integrations:check` with the deployment's server environment. It checks only configuration presence/shape and schema readiness, prints no secret values or account identifiers, and performs no provider writes. Exit 2 means company provisioning is incomplete; it is the expected current local result. PostHog is optional. A green configuration check still requires API/worker deployment, dashboard owner consent and real provider receipt/readback.

Use `pnpm db:migrate` for an existing deployment, then start both `pnpm api:dev` and `pnpm worker:dev` under the production process manager's equivalent commands. `db:reset` below is for the disposable local test environment only. Apply all three managed-integration migrations, including the account-rotation snapshot migration. Keep provider consoles and Umami administration within the company environment; clinic users only get the dashboard consent and operational controls.

## Verification

Run from `HMS_NEW` in the isolated checkout:

```sh
PG_PORT=54339 node db/scripts/local-pg.mjs start
PG_PORT=54339 node_modules/.bin/vitest run
node_modules/.bin/tsc --noEmit -p tsconfig.json
```

Run the staff tests from `apps/staff-web` so tsx resolves that project's path aliases:

```sh
node --import tsx --test tests/*.test.ts
node_modules/.bin/vite build
```

Current local results: **409 backend tests, 163 staff tests, TypeScript and production staff build passed**. Twenty-two browser checks passed with mocked provider responses, including 1440px/390px layout checks and failure/refusal behavior. See `managed-integrations/validation.json`. The shared header now wraps on narrow screens; desktop layout stays the same. The production build retains its existing large-chunk warning.

Reproducible browser fixtures live under `apps/staff-web/tests/browser`. Start the local API and staff dev server with `VITE_HMS_DEV_LOGIN=true` and `VITE_HMS_DEV_SUBJECT=priya` against the synthetic dev database, then run each through `playwright-cli -s=<session> run-code --filename=<fixture>`. Open the browser in that session first. These fixtures never connect a real provider or send a real message. They intentionally assert failure paths by returning provider refusal responses.

The targeted integration tests additionally cover the complete persisted WhatsApp booking/consent conversation, booking replay, STOP/handoff, explicit notice arming, preservation of historical simulation rows, notice content drift, promotions/audience review/quiet hours, scheduled Google publishing, account rotation, trusted aggregate booking counts and private mirror retry. Earlier integration tests cover encrypted binding/tampering, no credential leakage, authorization/tenant isolation, site setup retry, origin/payload rejection, real-event installation status, provider outage states, OAuth cookie/state/PKCE replay protection, membership validation, bounded performance reads, provider write retry prevention, optimistic draft conflicts, signed inbound deduplication, consented send claims, concurrent workers, receipt ordering, uncertain acceptance, STOP and disconnect.

API references: [Umami authentication](https://docs.umami.is/docs/api/authentication), [website creation](https://docs.umami.is/docs/api-reference/create-website), [summary statistics](https://docs.umami.is/docs/api-reference/get-website-stats), [metrics](https://docs.umami.is/docs/api-reference/get-website-metrics), [Google profile API](https://developers.google.com/my-business/reference/rest/), [Google performance](https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries), [Meta embedded signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/), [Meta's sample provider app](https://github.com/fbsamples/business-messaging-sample-tech-provider-app).

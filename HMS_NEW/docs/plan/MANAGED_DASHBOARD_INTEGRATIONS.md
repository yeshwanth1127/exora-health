# Managed dashboard integrations

Implementation checkout: branch `codex/dashboard-integrations`. This packet covers the HMS_NEW staff dashboard and its Fastify API/worker. It does not modify the older hospital backend or deploy anything.

## Customer experience

- WhatsApp: connect through Meta's secure consent window, use the inbox, assign conversations, queue replies, see recorded delivery, save clinic preferences, record explicit care-message consent with evidence, and disconnect. Meta owns account/password/phone verification. Provider credentials, registration PINs, webhook settings and token exchanges remain on the server.
- Google: connect through Google consent, select an accessible clinic listing, read details/reviews/posts, publish supported profile fields, reply/delete replies, publish/delete text updates/events/offers, inspect performance, and disconnect. Google can review or reject changes after accepting them. Owners must grant access; OAuth cannot remove that requirement.
- Analytics: company-managed Umami, one website address and one public installation snippet. A site's status becomes Counting only after its origin-matched event is accepted by Umami. Counts, referrals, devices, public page categories and supported clicks are read server-side. PostHog is an optional company-managed mirror, not a second customer setup flow.

The existing page shell, tab structure and component kit remain. The analytics provider/key-entry screens are replaced by managed setup. Integration setup no longer requires adding doctors, fees and schedules first; those remain prerequisites for a future booking runtime.

## Implemented boundaries

Migration `20261015090000_managed_dashboard_integrations.sql` adds tenant-owned connections, one-use connection attempts, website mappings, WhatsApp draft preferences and an irreversible send-attempt ledger. Tables enforce tenant RLS, composite tenant keys, indexed foreign keys and the existing version trigger. Disconnects clear encrypted credentials and pending authorizations, disable the connection and cancel queued managed replies. Historical identities remain reserved rather than being reassigned across clinics.

Credentials use AES-256-GCM with tenant/facility/provider binding as authenticated data. Store the master key in company secret management and retain it across restarts; losing or replacing it requires reconnecting accounts. Idempotency records and audit diffs never contain provider tokens. Callbacks omit parameters from request logs, and dashboard responses are private/no-store. A legitimate customer can still inspect their own dashboard API requests; browser-visible public IDs and the installation snippet are not secrets. Security comes from server authorization and tenant isolation.

Google uses short-lived, actor-scoped state, an HttpOnly/SameSite callback cookie, PKCE, a fixed redirect origin, refresh tokens and provider-verified listing membership. Writes commit an attempt before contacting Google; a retry of an uncertain write requires reading provider state rather than silently reposting.

Meta signup exchanges codes server-side and verifies the chosen phone against the selected WABA. Subscription and phone registration must succeed before exposing a connected state. Dynamic bindings come from encrypted database records, not browser assertions or runtime edits to environment variables. The signed webhook validates complete batches before storing them. STOP/human commands use the existing synchronous controls.

The worker sends only messages explicitly requested by the managed inbox. Existing log/simulation rows remain simulations. Before sending it rechecks the live connection, clinic/module state, staff access, active contact, explicit care consent and the current 24-hour reply window. Concurrent workers share a durable claim. Unknown acceptance is not automatically retried; receipts advance only the matching account/message and cannot regress read/delivered status.

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

No company provider credentials were present in the inspected checkout. Live provider acceptance, delivery, production hosting and owner-consent flows are therefore unverified. Local provider tests use injected HTTP transports and a separate PostgreSQL cluster on port 54339.

## Deliberately unavailable

This is a working minimal integration slice, not completion of every preview feature. WhatsApp automatic appointment booking, scheduled reminders, promotion delivery and flow media upload remain disabled; saved flow/quiet-hours/away-reply preferences are drafts, not an active automation runtime. Real free-text replies require fresh documented care consent. Google photo upload, scheduled posts, category/service/attribute/holiday publishing and automatic review requests remain disabled. Google data is bounded to the latest 50 reviews and 100 posts; it is not presented as complete historical coverage. Website booking conversion remains a dash until a trusted server-side attribution contract exists. Booking pages are not advertised as automatically instrumented. PostHog export is best effort, with no durable mirror or independent dashboard-read guarantee.

A process crash after an irreversible send claim can leave a claimed/unknown result. Its ledger intentionally prevents automatic resend; reconcile against provider events before requesting a new message. This avoids promising exactly-once delivery across an external API.

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

Current local results: **398 backend tests, 163 staff tests, TypeScript and production staff build passed**. Thirteen browser checks passed with mocked provider responses, including 1440px/390px layout checks and failure/refusal behavior. See `managed-integrations/validation.json`. The shared header now wraps on narrow screens; desktop layout stays the same. The production build retains its existing large-chunk warning.

Reproducible browser fixtures live under `apps/staff-web/tests/browser`. Start the local API and staff dev server with `VITE_HMS_DEV_LOGIN=true` and `VITE_HMS_DEV_SUBJECT=priya` against the synthetic dev database, then run each through `playwright-cli -s=<session> run-code --filename=<fixture>`. Open the browser in that session first. These fixtures never connect a real provider or send a real message. They intentionally assert failure paths by returning provider refusal responses.

The targeted integration tests cover encrypted binding/tampering, no credential leakage, authorization/tenant isolation, site setup retry, origin/payload rejection, real-event installation status, provider outage states, OAuth cookie/state/PKCE replay protection, membership validation, bounded performance reads, provider write retry prevention, optimistic draft conflicts, signed inbound deduplication, consented send claims, concurrent workers, receipt ordering, uncertain acceptance, STOP and disconnect.

API references: [Umami authentication](https://docs.umami.is/docs/api/authentication), [website creation](https://docs.umami.is/docs/api-reference/create-website), [summary statistics](https://docs.umami.is/docs/api-reference/get-website-stats), [metrics](https://docs.umami.is/docs/api-reference/get-website-metrics), [Google profile API](https://developers.google.com/my-business/reference/rest/), [Google performance](https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries), [Meta embedded signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/), [Meta's sample provider app](https://github.com/fbsamples/business-messaging-sample-tech-provider-app).

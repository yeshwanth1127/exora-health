# WhatsApp template submission revisions

13 October 2026. WhatsApp only; Sarvam remains paused. This phase creates template assets for review, not patient messages. It is off by default and has not been exercised against live Meta.

## Staff workflow

WhatsApp → Templates → Review submission shows the saved draft, language, category and reviewed version. Staff must supply fictional examples for every numbered parameter and confirm they contain no patient data. Current provider support is body-only positional utility/marketing content, up to 1,024 characters. Local drafts can remain longer or use a header, but must be adapted before submission.

The backend creates an immutable revision with a unique `hms_<revision UUID>` provider name. Changes in the dashboard remain local until a new revision is submitted; earlier provider assets are never silently overwritten. The current list prefers the most recent submission matching the saved draft, otherwise the latest submission. Reverting a draft can reuse its earlier provider revision without another creation attempt. Historical snapshots are available through the API. Native in-place editing of an existing Meta asset is not implemented; deliberate immutable revisions avoid invalidating an already approved provider asset.

Queued, submitting, submitted, uncertain, failed, conflict and cancelled are separate from Meta's approval status. A successful creation response does not imply approval or delivery. Check Meta status targets the captured provider revision, reconciles an uncertain creation by reading, and only applies approval when the current draft matches. A changed provider template ID refuses reconciliation instead of replacing the original identity.

## API and persistence

- `POST /v1/message-templates/:templateId/submissions`: strict `{ facilityId, version, samples, fictionalExamples: true }`, Idempotency-Key, authenticated actor and current `comms.manage` authority.
- `GET /v1/message-templates/:templateId/submissions`: exact clinic `comms.read`, latest 100 immutable revisions; no credential values.
- Migration `20261013090000_whatsapp_template_submissions.sql` stores immutable snapshot, actor/user, account/clinic, phone/WABA, token reference, stable attempt identity and durable result. Snapshot edits/deletes, replacing an existing attempt and requeuing an attempted revision are refused by database triggers.
- The content guard excludes local aliases, generated provider names, examples and row versions. A new key, copied draft or different sample cannot bypass an uncertain/submitted revision with the same content on that tenant's WABA. Known failed/cancelled revisions permit a new explicit reviewed intent.

The queue request commits its receipt, audit and outbox before dispatch. Receipt recovery returns the original request outcome; fresh reads show the revision's later state. The dedicated worker is separate from transactional outbox handlers: those handlers can retry after rollback and must never perform this external POST.

## Dispatcher safety

1. Read the exact generated name from the captured clinic WABA. Existing exact content reconciles without POST; conflicting content remains a conflict. Provider read failure postpones creation.
2. Lock the account, submission and current access in consistent order. Recheck the original requester, active clinic/module and captured provider binding. Commit one attempt ID and `dispatching` before contacting Meta.
3. POST once using the current canonical server token reference and captured body/examples. A definitive documented validation refusal becomes failed. Transport failure, unexpected provider errors, malformed success or an ambiguous duplicate result remains uncertain.
4. Record a known result even if the requester loses access after the committed attempt. External evidence must not disappear because local authorization changes. A worker crash after the attempt commit becomes uncertain after two minutes; never return it to queued.
5. Read-only checks reconcile uncertain results. A missing provider result remains uncertain and cannot authorize another POST. The worker polls those reads with a one-minute delay; missing binding/credentials never reroutes a revision to another WABA.

The authorization decision is the committed claim. Revocation after that point cannot recall an already possible provider request. No locks are held over network calls. Provider bodies, tokens and fictional examples are excluded from audit summaries and error text.

## Enablement and acceptance

`WA_TEMPLATE_SUBMISSIONS_ENABLED=true` explicitly enables creation for already configured managed bindings. The worker must also run. This switch never enables patient delivery. Keep it false in synthetic preview; do not set it against real credentials until clinic asset ownership, authorization and deployment are accepted. The provider client pins HTTPS Graph endpoint/version/WABA, refuses redirects, bounds response size/time and never retries POST.

Local evidence: **35 backend files / 368 tests**, **139 frontend tests**, backend TypeScript and frontend TypeScript/production build pass. The new phase has 10 creation-client tests and 10 persisted submission tests. Checks cover competing workers, lost response, abandoned attempts, immutable snapshots, aliases/examples deduplication, requester withdrawal, module suspension, changed WABA and current-draft approval isolation. The first combined run exposed a reused synthetic phone ID in another test; the fixture was isolated and the full rerun passed. The final combined run also covers draft reversion to an earlier provider revision without another creation attempt.

The preserved synthetic preview received the new migration without resetting records. Browser inspection confirmed Review submission is disabled with a configuration explanation; a live-enabled submission form/provider round trip is not browser-verified. No live template or patient message was created. Existing large frontend bundle warning remains.

Before broad fleet activation, add provider-account creation-rate limiting, operator resolution of permanently uncertain revisions, signed template-status callbacks, ownership/provisioning/offboarding and controlled real-provider acceptance. Actual outbound messaging and multilingual booking automation are still separate unfinished phases.

Primary contracts: [Meta template overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview), [template management](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management). These support the creation format and distinguish provider asset creation from template message delivery.

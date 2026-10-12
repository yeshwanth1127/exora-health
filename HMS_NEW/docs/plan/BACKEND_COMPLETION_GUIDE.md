# Backend completion guide (original staff UI scope)

**Phase closed by the product owner on 12 October 2026.** Local staff implementation is accepted. Active focus is UX/UI and operations review; webpage/Voice-bot integration is on hold. Provider work below is carried forward in [UX_AND_CHANNEL_TODO.md](UX_AND_CHANNEL_TODO.md), not silently marked implemented. [Current operations review](STAFF_OPS_REVIEW.md).

Updated 12 October 2026 after the third local implementation phase from `6713e01` on `codex/staff-frontend-integration`. Read [HANDOFF.md](HANDOFF.md) first. Test plan: [REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md).

## Resolved decisions (12 October)

The product owner delegated module choices. [STAFF_MODULE_DEVELOPMENT_DECISIONS.md](STAFF_MODULE_DEVELOPMENT_DECISIONS.md) is the implementation decision document and overrides earlier unresolved choices below. Scope remains the original UI. It chooses private content storage, defers the patient WhatsApp bot and telephone infrastructure, retains staff Voice history/runtime ingestion and the Loyalty concept, excluding the separate public call launcher, and moves G25 contracts into each new slice. Provider account availability is still unverified.

## Scope

Build only what the **original staff UI** needs. The retained inventory is 15 pages (Design removed by owner) in `apps/staff-web/src/hms/original-ui-inventory.json`:

overview, appointments, doctors, schedules, waitlist, catalogue, operations, whatsapp, voice, google_business, growth_analytics, settings, activity, teleconsultations, loyalty.

Patients, Queue, Consultations and Walk-in were added during integration. They stay and must not regress.

**Out of scope. Do not build these:**
- ERD modules M06 diagnostics, M07 inpatient, M08 theatre, M09 pharmacy, M10 inventory, M11 billing, M12 insurance, M14 documents (beyond what WhatsApp uploads need, see G20), M15 operations work tasks, M16 integration and M17 ABDM.
- Ledger items G28 prescriptions, G29 lab/imaging, G30 billing, G31 general uploads, G32 inpatient and G33 public booking API.
- M06, M09 and M10 were built once and then removed in `0aaff77`, because they are not in the original UI. Do not restore them.

## Where things stand

| Page | State |
|---|---|
| Overview, Appointments, Doctors, Waitlist, Hospital catalogue, Operations, Settings, Activity log, Teleconsultations | Connected to `/v1`. Small gaps are listed below. |
| Schedules | Connected: board, weekly hours, blocks/revocation, in-person and virtual extra hours, booking, overbooking, exact-range moves and cancellations. G05/G06/G08 acceptance completed; G37 adds no UI scope. |
| Design guide | Removed from the staff frontend by owner request; no route/component to restore. |
| WhatsApp | All seven original tabs integrated locally. Meta transport/templates/media and production storage/scanner still need implementation. |
| Voice, Google Business, Growth analytics | Original bodies mounted with scoped typed routes; G21/G22 local implementation DONE, actual provider acceptance unverified. |
| Loyalty | Concept only, with sample data in `modules/feature-concepts.tsx`. **G23 below**: retain the labelled concept; no operational backend. |

Contacts/consent, all visit-rule controls and history are integrated. The local Voice, Google/growth and WhatsApp workflows are complete; real provider transport and production storage remain under G19/G20. [Current progress](STAFF_MODULE_PROGRESS.md) contains evidence and the remaining-work list. Earlier detailed targets below are acceptance references, not missing-module status.

The ledger statuses are in [BACKEND_WORK_LEDGER.md](BACKEND_WORK_LEDGER.md).

## Work items, in order

### 1. Small schedule gaps (G05, G06, G08, G37, G10)

**G05/G06/G08 are complete.** Do not repeat the old implementation tasks.
- G08: `schedule-acceptance.test.ts` proves exact-range rescheduling, predecessor cancellation/release, replacement linkage, readback, idempotent replay and overlap refusal; `tests/schedule-source.test.ts` verifies the original adapter sends range hold then reschedule.
- G06: migration `20261012102000_m04_extra_hours_visit_mode.sql` stores visit mode on extra hours; route validation, matching-service selection, virtual slot generation and exactly-one tele session are tested.
- G05: browser Resolve → cancel → fresh review retained the proposed 10:00–13:00 draft and enabled Save. Appointment changes refresh the board without unmounting the weekly editor. Holiday preview is not needed: the original UI has no holiday editor.

**G37: all-clinics block.**
- The block sheet always sends the current clinic's `facilityId`. The API already accepts a block with no `facilityId`, which blocks the doctor at every clinic (G01 authorization applies).
- Release decision: keep the original clinic-specific sheet; no new all-clinics control. Preserve existing server scope checks. This is not additional backend work.

**G10: archive.**
- The original Delete is already mapped to a reasoned cancellation, which keeps history.
- Release decision: G10 is not needed. Keep reasoned cancellation/history; add no archive command.

### 2. Shared foundation for G19–G22: the `comms` schema

**Already implemented:** mod_comms registration, contact_point, messaging_consent_event, reminder_job, outbound_message, scoped comms.read/reply/manage, shared schemas, notification consumer and local worker evaluation. Extend these in later migrations; do not rebuild them. Templates, accounts, provider claims, receipts and inbox/growth/voice tables remain pending. The log-only schema deliberately allows queued/cancelled outbound rows and zero provider attempts; add real-provider state transitions only with their implementation.

WhatsApp, voice, Google links and growth all live in ERD module M13 (`docs/design/erd-v2/m13-comms.md`, schema `comms`). `comms` is already a valid `module_code` in:
- `platform.module_state`
- `MODULES` in `apps/api/src/modules/access/admin.ts`

That means Settings → Optional modules can already suspend it.

**Registering the schema touches six places (miss one and tests fail):**
- `packages/platform/src/command.ts` `MODULES`
- `db/tests/conventions.test.ts` `MODULE_ROLE`
- `db/tests/db.ts` `ModuleRole`
- `db/scripts/codegen.mjs`
- `apps/api/src/server.ts` (register the route file)
- `db/tests/m01-platform.test.ts` (system role list)

**Rules every comms write must follow:**
- Staff business commands and outbound dispatch call `assertModuleActive(db, caller, 'comms')` first. A suspended module keeps records readable. Narrow authenticated STOP/withdrawal ingestion and receipts for already sent messages still persist while suspended; see the decision document.
- Module roles never DELETE. Retire, close or cancel instead.
- Go through `runCommand` so the write is audited and emits outbox events.
- Take the actor from the authenticated caller, **never from the body**. The original screens send `actor: user.name` and `assigned_to: user.name`. Ignore those fields: the server sets the assignee to the caller's staff id.
- Money (campaign rate and budget) is integer `_minor` units. The original sends `rate_paise`/`budget_paise`; map them to `rateMinor`/`budgetMinor`.
- Phone numbers are E.164. Mask them in list responses, for example `+91•••••3210`, unless the caller has `comms.reply`.
- Messaging consent is the `messaging_consent_event` log, where **STOP always wins** until a fresh explicit opt-in. Check consent per purpose (`care`, `reminders`, `marketing`) at send time, not only at queue time.
- Outbound status includes `unknown`. A provider timeout after the send started is `unknown`. Never retry it automatically, and never show it as delivered.

**Permissions:** comms.read/reply/manage and front-desk read/reply are implemented. Add later slice permissions when their routes exist. Extend the seed setup with a new migration/seed as appropriate; the initial file is `db/seeds/reference/070_permissions_comms.sql` with `module_code = 'comms'`. Suggested codes:

| Code | For | Sensitive |
|---|---|---|
| `comms.read` | scoped inbox, delivery history, campaigns (read); body/contact fields explicitly authorized | yes |
| `comms.reply` | assign, reply, close conversations, update cases | yes |
| `comms.manage` | follow-up rules, template sync, reception settings, uploads | no |
| `campaigns.manage` | draft, preview, test-send, pause | no |
| `campaigns.approve` | approve a campaign for sending | yes |
| `voice.read` | call history, transcripts | yes |
| `voice.recordings.read` | play recordings (every access is logged) | yes |
| `growth.read` | Google links, growth analytics | no |
| `growth.manage` | edit booking links | no |

- `tenant_admin` gets every permission except `break_glass.use` automatically (`020_system_roles.sql`).
- Add `comms.read` and `comms.reply` to `front_desk` in the same seed file. Never edit an existing seed's bundle in place.
- Then change the nav permissions in `apps/staff-web/src/App.tsx`:
  - `whatsapp` is currently `catalog.read`; use `comms.read`.
  - `voice` is currently `catalog.read`; use `voice.read`.
  - The Patient growth group (Google Business, Growth analytics, Loyalty) has **no permission check today**. Add `growth.read`.

**Worker.**
- Outbound sending, reminders and campaign fan-out run in `apps/worker`.
- New outbox consumers go in `apps/api/src/consumers.ts`. Follow the existing ones, for example `openEncounterOnCheckIn`.
- Claim rows with a `claim_token` and `FOR UPDATE SKIP LOCKED` so two workers never send the same message.

**Provider adapters.**
- Put each provider behind a small interface: `send`, `verifyWebhook` and `fetchTemplates` for WhatsApp; `fetchTranscript` and `fetchRecording` for voice.
- Ship a **log adapter** that is used when credentials are missing. It records the message as `queued`, and never as sent or delivered.
- Load settings like `loadTelehealthSettings` in `apps/api/src/config.ts`:
  - Validate them at startup.
  - Refuse dev defaults when `NODE_ENV=production`.
  - Secrets come only from the environment and are never returned by any API.

**Frontend wiring pattern.** This is how Waitlist, Settings, Activity log and Schedules were done; copy it.
- Mount the original module inside `<OriginalResourceContext.Provider value={source}>`. Look at `apps/staff-web/src/hms/Waitlist.tsx`.
- The `source.read` and `source.write` functions translate the original `/api/v1/admin/...` paths to typed `/v1` calls. **Do not add `/api/v1/admin` routes to the API** (the ledger rule).
- Some original modules call `api()` from `@/lib/api` directly, which bypasses the source:
  - `whatsapp.tsx`: 4 calls
  - `campaigns.tsx`: 9 calls
  - `conversations.tsx`: 4 calls
  - `voice.tsx`: 1 call, plus `recordingBlob`

  Change those calls to `useApi()` from `@/components/workspace` (as `weekly-hours.tsx` does), so the source handles them.
- `GrowthModule.tsx` takes an `api` prop: pass the adapter.
- Replace `PendingModule` for that page in `App.tsx`.
- `coverage.test.ts` scans every `/v1/...` string in `apps/staff-web/src`, so each new call needs a route.

### 3. G19: patient notifications

What the UI needs:
- **Booking, move and cancel** now have durable local notification history in appointment details/actions. Explicit contacts and consent are editable by authorized staff. No message has been sent by this implementation.
- **Waitlist offers** now create local consented jobs and readback; accepted/declined/withdrawn/expired offers cancel stale local work. No provider message is sent.
- **Overview and Operations** now count unexpired local scheduled/queued jobs, only with scoped comms.read. Labels say local/not sent. Unavailable module/permissions remain null; persisted Voice session totals require voice.read, otherwise null.

Remaining full G19 target: local appointment/waitlist workflows, rules, follow-ups, filtered history and counts are implemented. Reuse those; build real template/send/receipt reconciliation; feedback/no-show and immediate reschedule/cancellation controls are now implemented. The historical detailed target below is retained as acceptance reference:
1. Tables from the ERD:
   - `contact_point` (patient or booking party; CHECK that exactly one is set)
   - `messaging_consent_event`
   - `message_template`
   - `outbound_message`
   - `delivery_receipt`
   - `reminder_job`

   Each row carries `tenant_id`, RLS and the standard columns: copy `platform.setup_tenant_table(...)` usage from any migration.
2. Consumers:
   - On `appointment.confirmed`: create a `reminder_job` of kind `day_before`, due 24 hours before (skip this reminder if already due; confirmation/same-day messages are separate rules), with the current purpose consent checked. Otherwise record a non-sendable `skipped_no_consent` job/state.
   - On `appointment.rescheduled`: cancel the predecessor's unsent jobs and create replacement jobs using `fromAppointmentId`/`toAppointmentId`. Deduplicate by appointment/message kind as well as event ID because rescheduling also emits confirmation and cancellation events.
   - On `appointment.cancelled` and `appointment.no_show`: cancel the job.
   - Idempotent per event: consumers already dedupe by consumer name and event id.
3. Worker: claims due jobs, renders the template and sends through the adapter, recording `queued → claimed → sent | failed | unknown`. Delivery receipts update the row to `delivered` or `read` (webhook, G20).
4. Reads:
   - `GET /v1/appointments/:id/messages`, the readback for the appointment sheet.
   - `GET /v1/outbound-messages?status&facilityId&cursor`, for delivery history and Operations.

Tests:
- No consent means a skipped job/state and no sendable message.
- STOP after opt-in suppresses sending.
- Reschedule cancels old unsent jobs and creates deduplicated replacement jobs; cancel cancels unsent jobs.
- A timeout gives `unknown` and no retry.
- Two workers never claim the same job.
- A suspended `comms` module refuses new business jobs and sends; signed STOP/withdrawals and receipts still persist.

### 4. G20: WhatsApp — current local implementation and remaining provider work

The seven original staff tabs are retained: Overview, Conversations, Doctor content, Campaigns, Follow-ups, Delivery history and Clinic details. The new typed route contracts live in `packages/contracts/src/whatsapp.ts`; the original screen transport maps legacy names to the routes documented in [API README](../api/README.md#whatsapp-workspace). This section replaces the old proposed route names.

| Original screen/API | Implemented typed route | Current boundary |
|---|---|---|
| `wa/operations-config`, reception counters | `GET /v1/comms/settings?facilityId`, `/v1/comms/summary?facilityId` | Database counts and timestamps, separate webhook/provider configuration, `liveSending=false` |
| `wa/conversations?kind&status&q&offset&limit` | `GET /v1/conversations?facilityId&kind&status&search&offset&limit` | Reception/issue/feedback, open/closed, items/total/offset/limit; search by address |
| `wa/conversations/:sender_id` | `GET /v1/conversations/:id` | Audited full thread, latest 100 messages and truthful truncation marker; UUID conversation identity, not a phone-derived clinical identity |
| Reception assignment/close/reply | `POST /v1/conversations/:id/assign`, `/close`, `/reply` | Server actor, row version, Idempotency-Key. Text reply ≤3000 chars, actual inbound within 24 h and explicit care consent; local queue only |
| Cases | `POST /v1/support-cases`, `/v1/support-cases/:id/status` | Issue/feedback, rating and versioned status; local cases can be created from known contacts without inventing inbound messages |
| Doctor content / campaign image | `GET /v1/comms/assets`; typed practitioner photo, department guide and campaign-asset routes | Private local files, JSON base64 transport from browser File, immutable keys, SHA-256, structural format/size checks and authenticated byte reads |
| Templates | `GET/POST /v1/message-templates` | Local template draft creation only; `providerApproval=not_synced`, `simulationOnly=true`. Meta sync route refuses rather than inventing approval |
| Campaign draft/preview/test/approve/pause | `GET/POST /v1/campaigns`, `/:id/preview`, `/:id/test`, `/:id/approve`, `/:id/pause` | Consent-only destination deduplication, content/audience/rate/budget binding, configured test aliases, optimistic versions, atomic budget reservation, local-only scheduling/pause |
| Follow-ups | `GET/PUT /v1/comms/followup-rules`, `POST /v1/appointments/:id/followup` | All seven rule kinds implemented: day-before, same-day, requested follow-up, feedback, no-show and immediate reschedule/cancellation. Feedback/no-show default off, 24 h after authoritative status change; immediate rules enforce zero delay |
| Delivery history | `GET /v1/whatsapp/outbound` | Merged notifications (including skipped), replies and campaign recipient records; kind/status/time filters and microsecond-safe keyset paging; no message bodies |
| Clinic details | Existing `GET/PATCH /v1/facilities/:id` | Selected clinic, existing permissions/version rules |

All mutating staff routes require Idempotency-Key and permission at the actual clinic. Front desk can manage scoped conversations/cases, but campaign approval requires `campaigns.approve`. Content/templates use `comms.manage`. Marketing contacts carry declared interests only after explicit marketing consent; no clinical-condition audience inference. Full addresses require `comms.reply`; consent evidence is not echoed in ordinary lists.

#### Signed ingestion and opt-out

`GET/POST /v1/integrations/whatsapp/webhook` are the only WhatsApp staff-auth exceptions. GET checks the configured verification token. POST uses an encapsulated raw-body parser, validates `X-Hub-Signature-256` with constant-time HMAC comparison and checks the configured phone-number/account binding. Deduplicated provider events persist before acknowledgement. New unregistered senders become unverified booking contacts via `booking.create_comms_caller`; patients are never chosen/created by phone matching.

STOP and delivery receipts are control-plane writes even while suspended. Signed STOP is applied synchronously before acknowledgement, then normal business processing uses the existing outbox/inbox worker. STOP affects every matching tenant/channel/address alias and cancels local pending work; fresh purpose-specific affirmative consent is required to re-enable that purpose. Receipts are append-only and deduplicated by scoped provider identity; they cannot transform a log-only message into delivered evidence.

#### Local completion versus real-provider completion

Local templates/campaign tests are a deliberate simulation path. `testReceived=true` means the staff reviewed that local result. `scheduled` and budget reservations describe local queues; `providerDelivery=unavailable`, provider attempts remain zero and no network sends occur. The adapter must not label these records Meta-approved, sent or delivered.

Provider account facts remain unknown. Production activation still requires server-only Meta phone/business account IDs, access token, app/verification secrets, pinned graph version and configured test-recipient aliases. No credentials belong in browser code, documentation or commits. Implement real template synchronization, approved-template checks, provider media upload, free-text/template send policy, claimed/send-attempt markers, unknown-outcome reconciliation and account-scoped receipt correlation before enabling any live sends. Do not automatically flush old simulation queues on activation.

Local content is private filesystem storage (`COMMS_STORAGE_PATH`) with opaque immutable keys and authenticated reads. JPEG/PNG limits are 5 MiB; PDF guides 10 MiB. Local structural validation is not full malware/decoder assurance. Production uploads deliberately refuse until a private S3-compatible adapter plus quarantine/scanner path is implemented and configured. This does not authorize a general M14 documents module.

Patient WhatsApp booking bot remains deferred. No public booking conversation engine, billing, pharmacy, voice dialling, provider account creation or live-message test is included.

Targeted local evidence: `apps/api/src/http/whatsapp.test.ts` covers signed-byte refusal/deduplication, shared-phone identity, suspended immediate STOP, reply window/permissions, stale case changes, private content validation/access, audience changes/opt-out, configured tests, concurrent budget approval/pause and interest declarations. Keep notification, contract and schema-convention suites passing. External provider delivery/template/media acceptance requires configured accounts and explicit live validation; the local fixture is not that proof.

### 5. G21: staff Voice — implemented locally

Original history, recordings, transcripts and access-history layouts in `modules/voice.tsx` are mounted by `hms/Voice.tsx` and the typed `voice-source.ts` adapter. Shared schemas are in `packages/contracts/src/voice-growth.ts`.

| Original call | Implemented route | Contract/authority |
|---|---|---|
| `GET /api/v1/staff/voice?offset=` | `GET /v1/voice-calls?facilityId&offset` | Original last-30-days history, 25-row pages, bounded offset and summary. `voice.read`. Proposed arbitrary date filters/keyset cursor were not added to this original screen. |
| Legacy transcript POST | `GET /v1/voice-calls/:id/transcript` | Original/English turns, separate transcript consent/expiry, audited review. `voice.read`. |
| Legacy recording session path | `GET /v1/voice-calls/:id/recording` | Private authenticated byte proxy, exact configured HTTPS hosts, no redirects, timeout/size/MIME limits, consent/expiry; no-store. `voice.recordings.read`. Allowed/refused access decisions are persisted. |
| Recording-access history | `GET /v1/voice-recording-access?facilityId` | Latest 100 authenticated staff review decisions, including transcript reads. `voice.recordings.read`. |
| Trusted runtime events | `POST /integrations/voice/events` | Dedicated `X-Voice-Secret`, explicit server account/tenant/clinic binding and pinned positive runtime version; missing configuration 503. Not staff/browser authentication. |

Tables include `voice_call`, current transcript projection, immutable `voice_transcript_revision`, `voice_consent_event` and `voice_recording_access`. Event identity/body-hash replay, sequence/status progression and appointment link validation are implemented. A booked callback must reference an actual voice-origin appointment in its bound clinic with the correct confirmation code. This endpoint does not build a voice booking engine.

Consent is separate per recording/transcript, affirmative and time bounded. Withdrawal takes precedence over business ordering and suspension; a delayed higher-sequence old opt-in cannot revive withdrawn content. Raw recording URLs never appear in history. Spoken clinical content is absent from summary/list fields.

**Actual configuration:** `VOICE_CALLBACK_SECRET` (at least 32 chars), `VOICE_CALLBACK_TENANT_ID`, `VOICE_CALLBACK_FACILITY_ID`, `VOICE_CALLBACK_ACCOUNT_ID`, pinned `SARVAM_APP_VERSION`, and exact public `VOICE_RECORDING_HOSTS`. The implemented normalized event includes the recording URL; it does not consume a provider-specific `VOICE_RECORDING_URL_FIELD`. Actual Sarvam key/org/workspace/app and callback field mapping belong to the external runtime and require verification against its real response. They are not proof of a built callback normalizer.

Provider callback normalization/recording-host acceptance, real runtime account setup and retention/purge decisions remain unverified. History remains readable when the runtime is unavailable. No public launcher, telephone infrastructure or live calls. `voice-growth.test.ts` covers secret/config refusal, account/version binding, replay/order, consent/expiry/withdrawal, privacy while suspended, sensitive permission refusals and private mock recording access; browser proof covers a persisted synthetic transcript, not a live provider recording.

### 6. G22: Google Business and growth analytics

Original source: `modules/growth/GrowthModule.tsx` (prop `api`, prefix `/api/v1/admin`) and `modules/growth/WebsiteActivity.tsx`.

| Original call | `/v1` route | Notes |
|---|---|---|
| `GET /growth/catalogue` | `GET /v1/facilities` | **Exists.** Map to the `Branch` shape `{id, name, slug, is_active, is_virtual}`. |
| `GET /google/booking-links` | `GET /v1/booking-links?facilityId` | One per facility: `{facilityId, bookingUrl, version, updatedAt}`. `growth.read`. |
| `PUT /google/booking-links/:branch {booking_url}` | `PUT /v1/facilities/:id/booking-link` | `growth.manage`. Configured exact approved public HTTPS hosts (`BOOKING_LINK_HOSTS`), no URL credentials/hash, only allowlisted UTM/lang query parameters, max 500 chars, optimistic version, audited with before/after. |
| `GET /google/changes` | `GET /v1/booking-links/changes?facilityId` | From the audit log (`actor`, `before`, `after`). |
| `GET /google/capabilities` | `GET /v1/growth/capabilities?facilityId` | Server-computed list `{title, state, description, reference}`. Manual booking link is `available` only with configured approved destination hosts; otherwise `not_connected`; Google API features are `not_connected` until credentials exist. Static otherwise. |
| `GET /growth/summary?start_date&end_date&branch_id&cohort` | `GET /v1/growth/summary?from&to&facilityId&cohort=created\|visit` | **Computed from `booking.appointment`.** See the definitions below. |
| `GET /growth/website-activity?traffic=` | `GET /v1/growth/website-activity?facilityId&from&to&traffic=production\|demo` | PostHog aggregate. Status `disabled\|not_configured\|unavailable\|available`. Never invent zeros. |

**Growth summary definitions.** Preserve the legacy metric labels with the following HMS reschedule-chain semantics:
- Cohort unit is one logical visit/reschedule chain. `created` uses the root creation time; `visit` uses the current successor's clinic-local visit date. Handle untimed walk-ins through session date and known status. The range is at most 366 days and defaults to the last 30 days.
- `appointmentsInCohort` = logical visits in the cohort, counting each reschedule chain once through its current successor.
- `retainedConfirmationShare` = (confirmed + checked_in + completed) ÷ cohort × 100. Return `null` when the cohort is empty.
- `attendanceRateResolved` = (checked_in + completed) ÷ (checked_in + completed + no_show), counting only visits that have ended. Return `null` when the denominator is 0.
- `byStatus` and `byChannel` (`origin_channel`).
- **Difference from the legacy:** in HMS_NEW a move cancels the old row and creates a new one (`rescheduled_from_id`). Exclude cancelled rows that have a successor, or every move counts as a cancellation.
- `byAcquisitionSource` needs attribution. `booking.appointment` has no such column. Return `{}` with `sources.acquisition = "not_tracked"` until trusted attribution is measured through an existing authorized booking source. Creating tables alone does not establish attribution.
- Never label any of these "conversion".

**Credentials:**
- Manual booking links need no provider credential, but writes require configured `BOOKING_LINK_HOSTS`.
- Website activity needs explicit `POSTHOG_TENANT_ID`/`POSTHOG_FACILITY_ID` project binding, `POSTHOG_PROJECT_ID`, `POSTHOG_READ_KEY` (a personal key with `query:read` only, server-side) and `POSTHOG_API_HOST` (an allowlist of `https://us.posthog.com` and `https://eu.posthog.com`).
- Google Business Profile API features (performance, profile edits) need an approved Google Cloud project, an OAuth client and an authorized profile manager. They are **not required** for the original screens. Leave them `not_connected`.

PostHog reads only fixed public consented aggregate events with production/demo separation, no clinical payload or event-list export. The project binding and website instrumentation must be verified before live acceptance; no network request was made with real credentials.

The **Patient journey** tab is illustrative (`PatientPreview`). It has no API.

Tests:
- The summary math on seeded appointments, including a move, which must not count as a cancel.
- The empty cohort gives `null`, not 0.
- A booking link refuses `http://` and `https://user:pass@...`.
- `growth.read` is required.
- PostHog not configured gives `not_configured` with no network call.

### 7. G23: Loyalty (resolved: concept only)

- The original is a **concept**: `LoyaltyProgram` in `modules/feature-concepts.tsx`, with sample data. It shows one program (`name`, `benefit` such as "10% off eligible consultations", `amount` such as "₹499 / year", `expiry`), a member list and a patient view.
- Release decision: retain the clearly labelled concept and its sample design in an isolated preview. Build no membership tables, payment/benefit redemption or discounts. Billing stays out of scope.

### 8. G25: shared contracts

- `packages/contracts/src/index.ts`, `whatsapp.ts` and `voice-growth.ts` now export the shared runtime schemas used by every newly implemented scoped module. G25 is DONE locally.
- Extend these alongside future provider slices and use them in both route and staff adapter. Malformed responses fail closed; never import database code into browser bundles.
- Don't migrate existing routes as part of this work.

## Product decisions resolved; deployment facts remaining

See [STAFF_MODULE_DEVELOPMENT_DECISIONS.md](STAFF_MODULE_DEVELOPMENT_DECISIONS.md) for the complete ERD/flow decisions:

1. Build local/private S3-compatible content storage for Doctor content and campaign images, without M14.
2. Defer the patient-facing WhatsApp booking bot and G33 public booking API.
3. Build staff Voice history/runtime ingestion; defer the public call launcher and telephone infrastructure.
4. Keep Loyalty as a concept; no membership/discount backend.
5. Build manual Google links/internal growth; optional server-side PostHog aggregates.
6. Define shared new-route schemas before/alongside implementation.

Actual Meta, Sarvam, storage and optional PostHog accounts are unknown. Confirm account identifiers, secret references, approved provider configuration and production readiness before enabling live operations. Do not request credentials in docs or enable providers as part of planning.

## Acceptance for each item

An item is DONE only when all of these hold:
- migration, commands, routes and permissions exist;
- tests cover authorization (allowed **and** refused), the module-suspended refusal, idempotency and races where they apply;
- the original screen is mounted through an `OriginalResourceSource` and its Pending label is gone;
- the full regression suite passes ([REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md));
- the ledger row says DONE with the routes listed;
- anything that needs real provider credentials is listed as **unverified** in the ledger, not as done.

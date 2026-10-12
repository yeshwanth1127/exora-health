# Backend completion guide (original staff UI scope)

Written 12 October 2026 against commit `0aaff77` on `codex/staff-frontend-integration`. Read [HANDOFF.md](HANDOFF.md) first. Test plan: [REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md).

## Scope

Build only what the **original staff UI** needs. The original UI is the 16 pages in `apps/staff-web/src/hms/original-ui-inventory.json`:

overview, appointments, doctors, schedules, waitlist, catalogue, operations, whatsapp, voice, google_business, growth_analytics, settings, activity, design, teleconsultations, loyalty.

Patients, Queue, Consultations and Walk-in were added during integration. They stay and must not regress.

**Out of scope. Do not build these:**
- ERD modules M06 diagnostics, M07 inpatient, M08 theatre, M09 pharmacy, M10 inventory, M11 billing, M12 insurance, M14 documents (beyond what WhatsApp uploads need, see G20), M15 operations work tasks, M16 integration and M17 ABDM.
- Ledger items G28 prescriptions, G29 lab/imaging, G30 billing, G31 general uploads, G32 inpatient and G33 public booking API.
- M06, M09 and M10 were built once and then removed in `0aaff77`, because they are not in the original UI. Do not restore them.

## Where things stand

| Page | State |
|---|---|
| Overview, Appointments, Doctors, Waitlist, Hospital catalogue, Operations, Settings, Activity log, Teleconsultations | Connected to `/v1`. Small gaps are listed below. |
| Schedules | Connected: the board, weekly hours (read, preview, save), blocks (preview, save, unblock), in-person extra hours, booking, overbooking, moves and cancellations. Gaps: G05, G06 and G37 below. |
| Design guide | Static. Nothing to build. |
| WhatsApp, Voice, Google Business, Growth analytics | Render `PendingModule.tsx` (the original design with a Pending label). **G19–G22 below.** |
| Loyalty | Concept only, with sample data in `modules/feature-concepts.tsx`. **G23 below**, which is conditional. |

The ledger statuses are in [BACKEND_WORK_LEDGER.md](BACKEND_WORK_LEDGER.md).

## Work items, in order

### 1. Small schedule gaps (G05, G06, G08, G37, G10)

These are in pages that already work. Do them first: they are small and close out the Schedules page.

**G08: moving a visit to an exact time.**
- The frontend already sends exact-time moves. `holdFor` in `apps/staff-web/src/hms/schedule-source.ts` falls back to `POST /v1/holds/range` when the time is not a whole slot, then calls `POST /v1/appointments/:id/reschedule` with that `newReservationId`.
- `rescheduleAppointment` in `apps/api/src/modules/booking/appointments.ts` uses the same `confirmHeldReservation` as booking, so this should already work. No test proves it yet.
- Task: add a test to `records.test.ts`, in the "M04 board, exact-time holds" describe. Range-hold a free exact window, reschedule into it, and assert:
  - a new appointment exists with `rescheduled_from_id` set;
  - the old appointment is cancelled.
- If the test passes, mark G08 DONE. If it fails, fix `confirmHeldReservation`, not the frontend.

**G06: virtual extra hours.**
- `booking.schedule_exception` has no visit mode, so `schedule-source.ts` throws "Extra virtual hours is not available yet." when `consultation_type !== "in_person"`.
- Task:
  - Add a migration with `visit_mode text NULL CHECK (visit_mode IN ('in_person','virtual'))`. Make it required when `kind = 'extra_hours'`, using a CHECK, and default existing rows to `in_person`.
  - Accept `visitMode` on `POST /v1/practitioners/:id/exceptions` for `extra_hours`.
  - Make slot generation give extra-hours slots that visit mode.
  - Remove the throw in `schedule-source.ts` and pass `visitMode: b.consultation_type`.
- Test: a virtual extra-hours window yields virtual slots only, and booking one creates a tele session (the existing consumer `createTeleSessionOnVirtualBooking`).

**G05: conflict resolution.**
- The weekly sheet (`modules/weekly-hours.tsx`) lists affected visits with a **Resolve** button. That button opens the appointment editor, which moves and cancels through the `/v1` adapter. Save stays disabled while `can_save` is false.
- Task: verify in the browser that Resolve, then move or cancel, then preview again, enables Save. Then mark G05 DONE.
- Holiday preview is **not needed**: the original UI has no holiday editor. Holidays are only read on the board.

**G37: all-clinics block.**
- The block sheet always sends the current clinic's `facilityId`. The API already accepts a block with no `facilityId`, which blocks the doctor at every clinic (G01 authorization applies).
- This is optional. Offer it only if the original sheet had the choice. `modules/schedule-range-actions.tsx` is the source of truth; if it has no such control, close G37 as done.

**G10: archive.**
- The original Delete is already mapped to a reasoned cancellation, which keeps history.
- Recommendation: close G10 as "not needed". Ask the product owner before adding an archive command.

### 2. Shared foundation for G19–G22: the `comms` schema

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
- Call `assertModuleActive(db, caller, 'comms')` first. A suspended module keeps its records readable.
- Module roles never DELETE. Retire, close or cancel instead.
- Go through `runCommand` so the write is audited and emits outbox events.
- Take the actor from the authenticated caller, **never from the body**. The original screens send `actor: user.name` and `assigned_to: user.name`. Ignore those fields: the server sets the assignee to the caller's staff id.
- Money (campaign rate and budget) is integer `_minor` units. The original sends `rate_paise`/`budget_paise`; map them to `rateMinor`/`budgetMinor`.
- Phone numbers are E.164. Mask them in list responses, for example `+91•••••3210`, unless the caller has `comms.reply`.
- Messaging consent is the `messaging_consent_event` log, where **STOP always wins** until a fresh explicit opt-in. Check consent per purpose (`care`, `reminders`, `marketing`) at send time, not only at queue time.
- Outbound status includes `unknown`. A provider timeout after the send started is `unknown`. Never retry it automatically, and never show it as delivered.

**New permissions.** Add a seed file `db/seeds/reference/070_permissions_comms.sql` with `module_code = 'comms'`. Suggested codes:

| Code | For | Sensitive |
|---|---|---|
| `comms.read` | inbox, delivery history, campaigns (read) | no |
| `comms.reply` | assign, reply, close conversations, update cases | no |
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
- **Booking, move and cancel** show a "contact the patient" notice today, with no delivery claim. After G19 they should show what was queued for the patient and its state.
- **Waitlist offers** (`docs/prd/waitlist.md`) send nothing today. With G19, an offer can queue a message.
- **Overview and Operations** show messages as "—" (`Overview.tsx` line 75, `GET /v1/operations/summary` returns `null`). Fill these from `comms.outbound_message` counts. Keep `null` when the module is not provisioned. Never return 0 for unknown.

Build:
1. Tables from the ERD:
   - `contact_point` (patient or booking party; CHECK that exactly one is set)
   - `messaging_consent_event`
   - `message_template`
   - `outbound_message`
   - `delivery_receipt`
   - `reminder_job`

   Each row carries `tenant_id`, RLS and the standard columns: copy `platform.setup_tenant_table(...)` usage from any migration.
2. Consumers:
   - On `appointment.confirmed`: create a `reminder_job` of kind `day_before`, due 24 hours before (or at once if the visit is sooner), only if `reminders` consent is in effect. Otherwise record `skipped_no_consent`.
   - On `appointment.rescheduled`: move the job to the new appointment.
   - On `appointment.cancelled` and `appointment.no_show`: cancel the job.
   - Idempotent per event: consumers already dedupe by consumer name and event id.
3. Worker: claims due jobs, renders the template and sends through the adapter, recording `queued → claimed → sent | failed | unknown`. Delivery receipts update the row to `delivered` or `read` (webhook, G20).
4. Reads:
   - `GET /v1/appointments/:id/messages`, the readback for the appointment sheet.
   - `GET /v1/outbound-messages?status&facilityId&cursor`, for delivery history and Operations.

Tests:
- No consent means no job.
- STOP after opt-in suppresses sending.
- Reschedule moves the job; cancel cancels it.
- A timeout gives `unknown` and no retry.
- Two workers never claim the same job.
- A suspended `comms` module refuses new jobs.

### 4. G20: WhatsApp

The original screen tabs: Overview, Conversations, Doctor content, Campaigns, Follow-ups, Delivery history, Clinic details. Original source: `modules/whatsapp.tsx`, `conversations.tsx`, `campaigns.tsx`. Response shapes are in `src/lib/api.ts` (`Config`, `Conversation`, `Template`, `Campaign`, `Preview`, `Asset`, `Inventory`) and in the types at the top of `conversations.tsx` (`Inbox`, `Thread`, `Content`).

**Original call → proposed `/v1` route** (route names are proposals; keep them typed and update the coverage test):

| Tab | Original call | `/v1` route | Notes |
|---|---|---|---|
| Overview | `GET wa/operations-config` | `GET /v1/comms/whatsapp/status` | `outreachEnabled`, `environment`, `marketingContacts` (count only), reception hours/phone/response, provider `configured: boolean`. Never return tokens or test numbers in full. |
| Overview | `GET wa/reception` | `GET /v1/conversations?status=open&limit=5` | |
| Conversations | `GET wa/conversations?kind&status&q&offset&limit=30` | `GET /v1/conversations?status&q&cursor&limit` | Keyset paging like `GET /v1/appointments` (G03). `q` matches name or last 4+ phone digits. |
| Conversations | `GET wa/conversations/:sender_id` | `GET /v1/conversations/:id` | Messages (newest page, `hasOlderMessages`), cases, `canReply`, `assignedTo`. Audited as a view when it shows patient content. |
| Conversations | `PATCH wa/reception/:sender {status:"active", assigned_to}` | `POST /v1/conversations/:id/assign` | Assignee = caller. `version` for optimistic locking. |
| Conversations | `PATCH wa/reception/:sender {status:"closed"}` | `POST /v1/conversations/:id/close` | |
| Conversations | `POST wa/reception/:sender/reply {text, idempotency_key}` | `POST /v1/conversations/:id/replies` | `Idempotency-Key` header (existing convention). Refuse with 409 `reply_window_closed` outside WhatsApp's 24-hour customer-service window. The original's `can_reply` comes from this. Max 4096 chars. |
| Conversations | `PATCH /api/v1/admin/whatsapp-cases/:id {status}` | `POST /v1/support-cases/:id/status` | **The ERD has no case table.** Add `comms.support_case` (`conversation_id`, `kind issue|feedback`, `description`, `rating 1–5 NULL`, `status open|in_progress|resolved`). |
| Doctor content | `GET /api/v1/admin/whatsapp-assets` | `GET /v1/comms/assets` | Department guides (PDF) and doctor photos (JPEG/PNG). |
| Doctor content | `POST .../departments/:id/guide`, `POST .../doctors/:id/photo` (multipart) | `PUT /v1/departments/:id/whatsapp-guide`, `PUT /v1/practitioners/:id/whatsapp-photo` | Needs file storage. See the decisions below. |
| Campaigns | `GET wa/campaigns`, `GET wa/templates` | `GET /v1/campaigns`, `GET /v1/message-templates` | Templates are synced from Meta (`POST /v1/message-templates/sync`, `comms.manage`). Only `approved` templates can be used. |
| Campaigns | `POST wa/campaigns {title, template_id, parameters, asset_id, audience{branch_id, interest}, scheduled_at, rate_paise, budget_paise}` | `POST /v1/campaigns` | Status `draft`. Only `marketing` templates. Audience is a definition, not a list. |
| Campaigns | `GET wa/campaigns/:id/preview` | `GET /v1/campaigns/:id/preview` | `body`, `recipients` (marketing opt-in only, STOP excluded), `estimatedCostMinor`, `withinBudget`, `audienceHash`. |
| Campaigns | `POST wa/campaigns/:id/test {sender_id}` | `POST /v1/campaigns/:id/test` | Only to configured test recipients (env), never an arbitrary number from the body. |
| Campaigns | `POST wa/campaigns/:id/approve {test_received, expected_count, audience_hash}` | `POST /v1/campaigns/:id/approve` | `campaigns.approve`. Refuse with 409 if the audience hash or count changed since the preview, so the approver approves exactly what they saw. |
| Campaigns | `POST wa/campaigns/:id/pause` | `POST /v1/campaigns/:id/pause` | |
| Campaigns | `POST wa/campaign-assets` (multipart) | `POST /v1/campaign-assets` | Header image. Same storage decision. |
| Follow-ups | `GET wa/followup-rules`, `PUT wa/followup-rules/:kind {enabled, template_id, delay_hours}` | `GET /v1/follow-up-rules`, `PUT /v1/follow-up-rules/:kind` | Kinds from the ERD `reminder_job.kind`. `utility` templates only. |
| Follow-ups | `GET /api/v1/admin/appointments?status=completed` | `GET /v1/appointments?status=completed` | **Already exists.** |
| Follow-ups | `POST wa/appointments/:id/followup {due_at}` | `POST /v1/appointments/:id/follow-ups` | Creates a `reminder_job` of kind `follow_up`. Consent checked. |
| Delivery history | `GET wa/outbound`, `GET .../whatsapp-delivery-issues` | `GET /v1/outbound-messages?status` | Issues = `status in (failed, unknown)`. No message bodies in the list. |
| Clinic details | `GET .../catalogue`, `PATCH wa/branches/:id {address, directions_url, arrival_instructions}` | `GET /v1/facilities/:id`, `PATCH /v1/facilities/:id` | **Already exists** (G13: `addressLine1/2`, `directionsUrl`, `arrivalInstructions`). Frontend mapping only. |

**Webhook (provider → API).** These routes are unauthenticated by staff tokens:
- `GET /v1/integrations/whatsapp/webhook`: Meta's verify-token challenge.
- `POST /v1/integrations/whatsapp/webhook`:
  - Verify `X-Hub-Signature-256` (HMAC-SHA256 of the **raw** body with the app secret, `timingSafeEqual`) before parsing.
  - Store inbound messages and receipts once, using the unique `provider_message_id` / `provider_event_id`.
  - Answer 200 quickly. Process in the worker.
- Rate-limit these routes. Accept only the configured phone number id.

**Not in the staff UI.** The patient-facing booking chatbot (the conversation engine) is not part of the staff screens. The legacy one is `hms-backend` `whatsapp-bot/`. A seeded service account already exists for it: "WhatsApp booking bot", role `booking_agent`, in `db/seeds/dev/010_demo_tenant.sql`. It would call the normal `/v1/holds` and `/v1/appointments` routes. Ask the product owner before building it.

**Provider credentials (Meta WhatsApp Cloud API).** All live only in the API and worker environment:
- `WA_PHONE_NUMBER_ID`
- `WA_BUSINESS_ACCOUNT_ID` (for template sync)
- `WA_ACCESS_TOKEN` (system-user token)
- `WA_APP_SECRET` (webhook signature)
- `WA_VERIFY_TOKEN` (webhook challenge)
- `WA_GRAPH_VERSION`
- `WA_TEST_RECIPIENTS`

Templates must be approved by Meta per category (utility, marketing, authentication). Marketing needs opt-in. Without credentials the log adapter is used and the Overview shows "Not connected". **Real delivery can only be verified with a real number and two phones. Say so; don't claim it.**

Tests:
- The webhook rejects a bad signature, and the same message twice is stored once.
- Reply outside the 24-hour window gives 409.
- Reply needs `comms.reply`.
- Campaign approve refuses a changed audience hash.
- STOP contacts are excluded from preview and send.
- The test send refuses a non-test number.
- The budget cap stops fan-out.
- Suspended `comms` refuses every write but reads still work.
- Front desk can't approve.

### 5. G21: Voice

Original tabs: Call history, Recordings, Transcripts, Access history. Source: `modules/voice.tsx`, which has the types `Call`, `History`, `Access` and `Transcript`. The behaviour reference is `VOICE_MODULE.md` in the legacy `hms-backend` repository.

| Original call | `/v1` route | Notes |
|---|---|---|
| `GET /api/v1/staff/voice?offset=` | `GET /v1/voice-calls?from&to&cursor` | Calls plus `summary {calls, bookings, errors, completed, toolCalls, periodDays}`. `voice.read`. |
| `POST .../sessions/:id/transcript` | `GET /v1/voice-calls/:id/transcript` | Turns with original and English text. Audited view. `voice.read`. |
| `.../sessions/:id/recording` | `GET /v1/voice-calls/:id/recording` | `voice.recordings.read`. Refuse when there is no recording consent or after `recordingAvailableUntil`. Stream the audio through the API, or return a short-lived URL from an allowlisted HTTPS host. **Every attempt, allowed or refused, is written to the access log.** |
| `GET .../voice/recording-access` | `GET /v1/voice-recording-access` | The access log. `voice.recordings.read`. |

- Tables: ERD `voice_call` and `voice_transcript`, plus a `voice_recording_access` log (actor, call, outcome, time).
- The `appointment` link on a call is the appointment the agent booked (`origin_channel = 'voice'`).
- **Runtime callbacks (provider → API):** session start, turn/tool events and session end, as in the legacy `VOICE_MODULE.md` "Trusted runtime contract".
  - Authenticate them with a dedicated secret header (`VOICE_CALLBACK_SECRET`, at least 32 chars, `timingSafeEqual`), because the provider can only send static headers.
  - Make event ids idempotent.
  - Never store spoken symptoms in call history.

**Provider credentials (Sarvam conversational agents, as used by the original):**
- `SARVAM_API_KEY`
- `SARVAM_ORG_ID`
- `SARVAM_WORKSPACE_ID`
- `SARVAM_APP_ID`
- `SARVAM_APP_VERSION` (pinned, never "latest")
- `VOICE_CALLBACK_SECRET`
- `VOICE_RECORDING_URL_FIELD` and `VOICE_RECORDING_HOSTS`: these must come from a real recording response; blank disables playback.

Phone calls also need a telephony provider that collects recording consent before recording. Without credentials the page shows an empty history, not sample calls.

Tests:
- Recording refused without consent, after expiry, and without the permission, and each refusal is logged.
- A callback with a bad secret gives 401.
- A repeated event id is counted once.
- Front desk can't see recordings.

### 6. G22: Google Business and growth analytics

Original source: `modules/growth/GrowthModule.tsx` (prop `api`, prefix `/api/v1/admin`) and `modules/growth/WebsiteActivity.tsx`.

| Original call | `/v1` route | Notes |
|---|---|---|
| `GET /growth/catalogue` | `GET /v1/facilities` | **Exists.** Map to the `Branch` shape `{id, name, slug, is_active, is_virtual}`. |
| `GET /google/booking-links` | `GET /v1/booking-links` | One per facility: `{facilityId, bookingUrl, updatedAt}`. `growth.read`. |
| `PUT /google/booking-links/:branch {booking_url}` | `PUT /v1/facilities/:id/booking-link` | `growth.manage`. HTTPS only, no credentials in the URL, max 500 chars, audited with before/after. |
| `GET /google/changes` | `GET /v1/booking-links/changes` | From the audit log (`actor`, `before`, `after`). |
| `GET /google/capabilities` | `GET /v1/growth/capabilities` | Server-computed list `{title, state, description, reference}`. Manual booking link is `available`; Google API features are `not_connected` until credentials exist. Static otherwise. |
| `GET /growth/summary?start_date&end_date&branch_id&cohort` | `GET /v1/growth/summary?from&to&facilityId&cohort=created\|visit` | **Computed from `booking.appointment`.** See the definitions below. |
| `GET /growth/website-activity?traffic=` | `GET /v1/growth/website-activity?from&to&traffic=production\|demo` | PostHog aggregate. Status `disabled\|not_configured\|unavailable\|available`. Never invent zeros. |

**Growth summary definitions.** Copy these from legacy `hms-backend` `app/growth.py` `summary()`:
- Cohort is by `created_at` (`created`) or `starts_at` (`visit`), in the facility's timezone. The range is at most 366 days and defaults to the last 30 days.
- `appointmentsInCohort` = all rows in the cohort.
- `retainedConfirmationShare` = (confirmed + checked_in + completed) ÷ cohort × 100. Return `null` when the cohort is empty.
- `attendanceRateResolved` = (checked_in + completed) ÷ (checked_in + completed + no_show), counting only visits that have ended. Return `null` when the denominator is 0.
- `byStatus` and `byChannel` (`origin_channel`).
- **Difference from the legacy:** in HMS_NEW a move cancels the old row and creates a new one (`rescheduled_from_id`). Exclude cancelled rows that have a successor, or every move counts as a cancellation.
- `byAcquisitionSource` needs attribution. `booking.appointment` has no such column. Return `{}` with `sources.acquisition = "not_tracked"` until ERD `booking_link`/`attribution_event` exist.
- Never label any of these "conversion".

**Credentials:**
- Manual booking links need none.
- Website activity needs `POSTHOG_PROJECT_ID`, `POSTHOG_READ_KEY` (a personal key with `query:read` only, server-side) and `POSTHOG_API_HOST` (an allowlist of `https://us.posthog.com` and `https://eu.posthog.com`).
- Google Business Profile API features (performance, profile edits) need an approved Google Cloud project, an OAuth client and an authorized profile manager. They are **not required** for the original screens. Leave them `not_connected`.

The **Patient journey** tab is illustrative (`PatientPreview`). It has no API.

Tests:
- The summary math on seeded appointments, including a move, which must not count as a cancel.
- The empty cohort gives `null`, not 0.
- A booking link refuses `http://` and `https://user:pass@...`.
- `growth.read` is required.
- PostHog not configured gives `not_configured` with no network call.

### 7. G23: Loyalty (conditional, ask first)

- The original is a **concept**: `LoyaltyProgram` in `modules/feature-concepts.tsx`, with sample data. It shows one program (`name`, `benefit` such as "10% off eligible consultations", `amount` such as "₹499 / year", `expiry`), a member list and a patient view.
- Applying a benefit needs a bill to discount, and billing is out of scope.
- **Do not build this without a product-owner decision.** If asked for a minimal version: `membership_plan` plus `membership` (patient, plan, `starts_on`, `ends_on`, `status`) and a "benefit used" log, with no price effect.

### 8. G25: shared contracts

- `packages/contracts` exists with only a README ("Zod schemas for API requests/responses and outbox event payloads, shared with frontends").
- Do this last, and only for the comms routes you add: export their Zod schemas from there, and use them in both the route and the staff-web adapter.
- Don't migrate existing routes as part of this work.

## Decisions to get from the product owner before G20–G23

1. **File storage for WhatsApp uploads** (doctor photos, department guides, campaign header images). Options:
   - (a) A storage adapter: local disk in dev, S3-compatible in production. Use `@fastify/multipart` with strict limits: JPEG/PNG ≤ 5 MB, PDF ≤ 10 MB, type checked by magic bytes, and a virus scan if required.
   - (b) Defer the Doctor content tab and campaign images.
   - Neither exists today, and `@fastify/multipart` is not installed.
2. Whether to build the patient-facing WhatsApp booking bot (not a staff screen).
3. Whether Voice needs live phone calls now, or only history for calls made through another system.
4. Loyalty: build it, keep the concept, or remove it from the nav.
5. Which provider accounts exist: Meta WhatsApp Business, Sarvam, telephony, PostHog.

## Acceptance for each item

An item is DONE only when all of these hold:
- migration, commands, routes and permissions exist;
- tests cover authorization (allowed **and** refused), the module-suspended refusal, idempotency and races where they apply;
- the original screen is mounted through an `OriginalResourceSource` and its Pending label is gone;
- the full regression suite passes ([REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md));
- the ledger row says DONE with the routes listed;
- anything that needs real provider credentials is listed as **unverified** in the ledger, not as done.

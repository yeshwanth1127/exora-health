# WhatsApp backend TODO

Written 14 October 2026, when the self-serve WhatsApp UI was finished and the backend had not started. Use this file to pick the work back up.

- Product spec: [PRD](../prd/whatsapp-self-serve-setup.md)
- Earlier provider work: [integration progress](WHATSAPP_INTEGRATION_PROGRESS.md), [template submissions](WHATSAPP_TEMPLATE_SUBMISSIONS.md), [template status](WHATSAPP_TEMPLATE_PROVIDER_STATUS.md), [handoff contract](WHATSAPP_HANDOFF_CONTRACT.md), [managed bindings](MANAGED_PROVIDER_BINDINGS.md)

## Where things stand

The UI is complete and runs entirely in the browser. Nothing in it calls Meta.

| Piece | Stored now | Notes |
| --- | --- | --- |
| Setup progress (connect, flow, files, tested, live, paused) | `localStorage` `exora:whatsapp-setup:<facilityId>` | `useSetup()` in `apps/staff-web/src/hms/WhatsApp.tsx` |
| Automations, inbox, message log, promotions, settings | `localStorage` `exora:whatsapp:<facilityId>` | `useWaData()` in `whatsapp-ui.tsx`. Sample data comes from `seed()` in `whatsapp-data.ts` and is rebuilt daily. |
| Message statuses, Meta approvals, campaign sending | Simulated by `progress()` in `whatsapp-data.ts`, ticking once a second | Marked `ponytail:`. Webhooks replace it. |
| Uploaded files | Object URLs only (`previews` map). Files are never uploaded. | |
| Meta sign-up | Dialog explains the steps. "Simulate connection" appears only in dev builds. | |

To swap in the backend, keep the screens and replace three things:

1. `useSetup` → API.
2. `useWaData` plus its `change()` calls → API queries and commands.
3. `progress()` → nothing, because real statuses arrive from webhooks.

The types in `whatsapp-data.ts` (`Automation`, `Conversation`, `LogEntry`, `Campaign`, `WaSettings`) are the contract the screens expect. Line them up with `packages/contracts` first.

Files:
- `apps/staff-web/src/hms/`: `WhatsApp.tsx` (gate and setup), `WhatsAppLive.tsx` (tabs, Overview, Settings), `WhatsAppInbox.tsx`, `WhatsAppAutomations.tsx`, `WhatsAppPromotions.tsx`, `WhatsAppActivity.tsx`, `whatsapp-ui.tsx`, `whatsapp-data.ts`, `whatsapp-setup.ts`
- Tests: `apps/staff-web/tests/whatsapp-setup.test.ts`, `whatsapp-data.test.ts`

## Blockers outside the code

- [ ] Meta Tech Provider (partner) approval for Paperwhale. Embedded Signup and coexistence depend on it.
- [ ] Meta app: Embedded Signup configuration ID, app review for `whatsapp_business_management` and `whatsapp_business_messaging`, business verification.
- [ ] An HTTPS environment registered with Meta (Embedded Signup origin and webhook URL).
- [ ] Secret store for per-clinic tokens. Tokens never reach the dashboard.
- [ ] One pilot clinic number that has been on the Business app for 7+ days, to test coexistence.

## Work, in order

### 1. Connect (Embedded Signup)
- [ ] Load the Facebook JS SDK in the Connect dialog. Call `FB.login` with the config ID and `extras: { featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }` for coexistence; omit `featureType` for a new number.
- [ ] Accept `message` events only from the exact `facebook.com` origin. Read `waba_id` and `phone_number_id`, and handle the `CANCEL` and `ERROR` events.
- [ ] `POST /v1/whatsapp/signup` with `{ code, wabaId, phoneNumberId, state }`. The server exchanges the code for a business token, checks it can access that WABA and phone number, and stores a token reference.
- [ ] Write `comms.channel_account`: WABA, phone number ID, display phone, display name, path (coexistence or new), connected by and at.
- [ ] Subscribe the app to the WABA webhooks, then register the number (new-number path).
- [ ] Coexistence extras: subscribe to `smb_message_echoes`, `smb_app_state_sync` and `history`. Echoes must show in the inbox as staff messages sent from the phone.
- [ ] Health readout for Settings: quality rating, messaging limit, display name status, verification. This should be a read endpoint, not the hard-coded values now in `WhatsAppLive.tsx`.
- [ ] Disconnect: unsubscribe the webhooks, mark the account inactive, and keep the history.
- [ ] Leave out the dev-only "Simulate connection" button once real sign-up works.

### 2. Setup and booking flow
- [ ] Persist setup per facility: `GET/PUT /v1/whatsapp/setup` storing shape, steps (`on`, `message`, header asset), content map, tested, live and paused.
- [ ] Gate going live on the server: connected, flow saved, test confirmed. The register-first checks (doctors, fees, hours) are re-checked when going live.
- [ ] Make the bot read this config instead of the hard-coded menu. It covers the six steps: welcome, department, doctor, slot, details and confirm.
- [ ] Paused: bot replies with the away text and takes no bookings.
- [ ] Uploads: add a doctor-profile PDF asset kind next to the existing practitioner photo and department guide. Step header assets go through `/v1/comms/assets`. Upload the media to Meta once and cache the media ID.

### 3. Lifecycle automations
- [ ] Map the UI ids to the existing `FollowupRuleKindSchema`:

  | UI id | Existing rule kind |
  | --- | --- |
  | `reminder_day` | `day_before` |
  | `reminder_soon` | `same_day` |
  | `rescheduled` | `reschedule` |
  | `cancelled` | `cancellation` |
  | `no_show` | `no_show` |
  | `feedback` | `feedback` |
  | `follow_up` | `follow_up` |
  | `confirmation` | **missing, add it** |
  | `staff_reply` | **missing, add it** (manual-only template) |

- [ ] Store per rule: on, timing key, body, buttons and header. Converting named variables (`{{patient_name}}`) to Meta's format is a decision: Meta now supports named parameters, so use those and drop numbered placeholders.
- [ ] Submit through the existing immutable-revision submission worker. Keep "approved version keeps sending while an edit is reviewed".
- [ ] Template status comes in through the webhook (`message_template_status_update`), with the manual "Check Meta status" call as a fallback. Store the rejection reason.
- [ ] Auto-submit the core templates (confirmation, day-before reminder, rescheduled, cancelled, reception follow-up) when a clinic goes live.
- [ ] Scheduler: from appointment events (booked, moved, cancelled, no-show, visit closed, follow-up date set), work out send times, apply quiet hours, and skip if the appointment changed since then. Use one durable job per appointment and rule, so a reminder never sends twice.
- [ ] WhatsApp bookings get the flow's own confirmation inside the 24 h window. Don't also send the confirmation template.
- [ ] Quick-reply buttons from reminders (Confirm, Reschedule, Cancel, Book again, feedback ratings) need handlers in the bot. "Not good" feedback opens an inbox conversation.

### 4. Inbox
- [ ] The existing conversation and support-case routes cover handoff. Add or confirm: list filters (needs reply, mine, open, resolved), assign, hand back to bot, resolve and reopen. Attribute each to the staff member and version-check it.
- [ ] Reply: `POST /v1/conversations/:id/messages`. The server re-checks the 24 h window from the last inbound timestamp and refuses with 131047-style wording when it has closed.
- [ ] After 24 h: send the approved `reception_follow_up` template. Block repeats until the patient replies (the UI already does this).
- [ ] Patient context panel: match the number to a patient, then show next appointment, last visit and visit count. This replaces `context` in the seed.
- [ ] Save saved replies, reception hours, handoff words and away reply into `/v1/comms/settings`.
- [ ] Live updates: poll every 5 s with `useQuery(path, 5000)` to start. Move to SSE if needed.

### 5. Message log
- [ ] Use `GET /v1/whatsapp/outbound` (or a new `/v1/whatsapp/log`) for incoming and outgoing messages. Fields: kind, template, category, status history and Meta error code.
- [ ] Webhook `statuses[]` updates sent, delivered, read and failed, plus the error. Map errors to the plain text in `metaErrors` (`whatsapp-data.ts`).
- [ ] Retry only codes where `retry: true`, and use a new idempotency key. Never resend automatically when the outcome is uncertain (already a rule in the progress doc).
- [ ] Mask phone numbers in the list (the UI does this); the detail view shows the full number to staff with `comms.read`.
- [ ] Today's stats are computed on the server.

### 6. Promotions
- [ ] Opt-in: store consent per patient and channel, including where it came from (booking flow question, desk). STOP and the "Stop promotions" button opt the patient out. Never send marketing to anyone who opted out.
- [ ] Audience queries: everyone opted in, by speciality, not seen in N months. Return a size estimate before submitting.
- [ ] Campaign: submit the marketing template, then schedule, then send in batches within the messaging limit. Track per-recipient status and totals (sent, delivered, read, replied, failed, opted out).
- [ ] Handle 131049 (Meta's per-user marketing limit) as retry-later, not as a failure of the campaign.
- [ ] Cancel before sending starts.
- [ ] Use the existing `/v1/campaigns` routes. Line their shape up with `Campaign` in `whatsapp-data.ts`.

### 7. Permissions and safety
- [ ] `comms.manage`: setup, automations, promotions, settings. `comms.reply`: inbox. `comms.read`: log and inbox read-only. The server enforces these; the UI already hides the controls.
- [ ] Audit every send, assignment, setting change and template submission.
- [ ] Rate-limit per WABA. Pause automations automatically if quality drops to Low, and show it on the Overview.

### 8. Acceptance (real Meta)
- [ ] Pilot clinic connects through Embedded Signup with coexistence and keeps the Business app.
- [ ] Book through WhatsApp from another phone. The booking appears in Appointments.
- [ ] The day-before reminder sends from the approved template. Reschedule from its button works.
- [ ] A patient asks for staff. A reply from the dashboard is delivered and read. The reply after 24 h goes out as the template.
- [ ] A failed message shows in the log with Meta's code. Retry behaves as specified.
- [ ] A promotion goes only to opted-in patients. STOP opts out.

## Open questions

- Should each clinic's WABA live under Paperwhale's partner business, or under the clinic's own Meta business (the default with Embedded Signup)?
- Languages: does the bot and template set need Telugu or Hindi at launch? Templates are per language at Meta.
- Billing: Meta charges marketing and utility templates per delivered message. Do we pass that cost to clinics, or include it in the plan?
- The old WhatsApp screens (`modules/whatsapp.tsx`, `campaigns.tsx`, `conversations.tsx`, `whatsapp-notifications.tsx`, `hms/MessageTemplates.tsx`, `hms/whatsapp-full-source.ts`) are no longer used by the page. Should they be deleted? Some have uncommitted changes.

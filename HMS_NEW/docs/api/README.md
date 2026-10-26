# HMS_NEW API (v1)

JSON over HTTP, connected to the staff workspace in `apps/staff-web`. Start locally with `pnpm api:dev` (port 3000) and `pnpm worker:dev`.

## Authentication
Staff `/v1` requests need `Authorization: Bearer <token>`. The exact GET/POST `/v1/integrations/whatsapp/webhook` routes use configured verification/HMAC authentication instead; `/integrations/voice/events` uses its dedicated runtime secret and server account binding.

| Mode | When | Tokens |
|---|---|---|
| `AUTH_MODE=dev` (default) | Local development only (refused when `NODE_ENV=production`) | `pnpm dev:token <subject>` — e.g. `ravi` (front desk), `asha` (doctor), `meena` (nurse), `priya` (tenant admin), `whatsapp-bot` (booking channel) |
| `AUTH_MODE=oidc` | Real environments | From your identity provider; verified against `OIDC_JWKS_URL`, with `OIDC_ISSUER` and `OIDC_AUDIENCE` |

The token's issuer + subject must match an active `platform.user_account`. If one identity has accounts in several tenants, send `X-Tenant-Id`. Integrations (WhatsApp bot, voice agent) use **service accounts**: a staff row flagged `is_system_account` with the `booking_agent` role, so their actions are permission-checked and attributed like a person's.

## Wiring a front-end (local)
1. `pnpm pg:start && pnpm db:reset`, then run `pnpm api:dev` and `pnpm worker:dev` (the worker opens encounters after check-in and completes appointments after the visit).
2. **CORS**: browser origins in `CORS_ORIGINS` (default `http://localhost:5173,http://127.0.0.1:5173`, the Vite dev server).
3. **Sign in**: `POST /dev/login {"subject": "ravi"}` → `{ token }` (only when `AUTH_MODE=dev`). Send it as `Authorization: Bearer <token>`.
4. Seeded demo identities:

| Subject | Who | Can |
|---|---|---|
| `ravi` | Ravi Shankar, front desk (Bengaluru) | register patients, book, check in, run the queue |
| `asha` | Dr Asha Rao, General Medicine (has a council registration, so can sign notes) | queue, encounters, vitals, notes, diagnoses; Saturday 14:00–16:00 video OPD (Bengaluru) |
| `meena` | Meena Kumari, nurse (Bengaluru) | vitals, nursing notes |
| `priya` | Priya Nair, tenant admin | everything except break-glass; schedules |
| `whatsapp-bot` | WhatsApp booking bot (service account) | find/register patients, book, cancel, reschedule |

Demo IDs: tenant `01920000-0000-7000-8000-000000000001`; Bengaluru facility `…0101`; Dr Asha `…0401` (Mon–Sat 09:00–13:00 slots, Mon–Fri 17:00–19:00 walk-ins); Dr Vikram `…0402`.

5. A typical OPD screen flow: slots → hold → book → (on the day) check-in → poll `GET /v1/appointments/:id/encounter` (ready within ~1 s once the worker runs) → doctor: start → vitals/notes/diagnoses → sign → finish → appointment shows `completed`.
6. Send a fresh `Idempotency-Key` (e.g. `crypto.randomUUID()`) per user action on 🔑 endpoints, and reuse it when retrying the same action.

## Authorization
Each endpoint checks its required permissions, checked **for the facility involved** (a role granted for one branch doesn't work at another). `GET /v1/me` shows the caller's permissions and their facility scope (`*` = all facilities).

**Chart access** additionally needs a care relationship: being a participant of one of the patient's encounters (open, or ended within 30 days), an active care assignment, or break-glass access (`POST /v1/patients/:id/break-glass`, audited, up to 24 h). Staff with clinical permissions at the facility join an *active* encounter automatically when they work on it (e.g. the nurse taking vitals). Every chart or encounter view is recorded in the audit log. Patient-portal accounts are rejected for now.

## Conventions
| Topic | Rule |
|---|---|
| Idempotency | Creating commands require `Idempotency-Key` (8–128 chars). A retry with the same key and body returns the first result; a different body with the same key → 409 |
| Request id | Send `X-Request-Id` (UUID) to trace a request; it is echoed back and stored on audit and outbox rows |
| Times | Instants are ISO-8601 with offset (`2026-10-19T09:30:00+05:30`); dates are `YYYY-MM-DD` in the facility's local calendar; money is integer paise (`feeMinor: 50000` = ₹500) |
| Lists | `{ "items": [...] }` |
| Errors | `{ "error": { "code", "message", "details" }, "requestId" }` |

| Status | `error.code` | Meaning |
|---|---|---|
| 400 | `validation` | Bad input (`details.issues` lists fields) or missing `Idempotency-Key` |
| 401 | `unauthenticated` | Missing, invalid or expired token |
| 403 | `forbidden` | No account, or missing permission (`details.permission`, `details.facilityId`) |
| 404 | `not_found` / `route_not_found` | Unknown record (including other tenants' records) or route |
| 409 | `conflict` / `idempotency_conflict` | e.g. `details.reason: slot_unavailable`, `walk_ins_full` |
| 422 | `precondition_failed` | Valid request, wrong state: `hold_expired`, `patient_required`, `no_walk_ins`, `no_session` |

## Endpoints

### Service
| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | none | Process is up |
| `GET /ready` | none | Database reachable |
| `GET /v1/me` | any | Caller, tenant, permissions |

### Communications: local staff workflows

Transport is `log`; `liveSending` is false and provider attempts are zero. Notification records are not evidence of patient contact. Shared schemas are exported by `@hms/contracts`.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/comms/summary?facilityId` | `comms.read` @ facility | Persisted local notification counts, timestamp and truthful transport availability |
| `GET /v1/comms/followup-rules?facilityId` | `comms.read` @ facility | All seven default/saved day_before, same_day, follow_up, feedback, no_show, reschedule and cancellation rule versions |
| `PUT /v1/comms/followup-rules/:kind` 🔑 | `comms.manage` @ facility | Versioned enabled/delayHours rule; cancels stale unsent jobs |
| `POST /v1/appointments/:id/followup` 🔑 | `appointments.read` and `comms.reply` @ facility | Completed visit, version and dueAt; one requested local follow-up |
| `GET /v1/waitlist-offers/:id/messages` | `appointments.read` and `comms.read` @ facility | Consent-aware local offer history |
| `GET /v1/comms/capabilities?facilityId` | `comms.read` @ facility | Module state and local-only capability |
| `GET /v1/contact-points?facilityId&patientId` or `bookingPartyId` | `comms.read` + owner-domain access | Explicit WhatsApp contacts and current purpose consents; mask address without `comms.reply` |
| `POST /v1/contact-points` 🔑 | `comms.reply` + owner-domain access | Add an E.164 contact for exactly one patient/caller; grants no consent |
| `POST /v1/contact-points/:id/consents` 🔑 | `comms.reply`, or `comms.manage` for marketing opt-in | Purpose care/reminders/marketing; opt_in/opt_out/stop; fresh opt-in affirmation and evidence; authenticated actor; withdrawal allowed during suspension |
| `GET /v1/appointments/:id/messages` | Both `appointments.read` and `comms.read` @ actual facility | Notification jobs and optional local outbound status |
| `GET /v1/outbound-messages?facilityId` | `comms.read` @ facility | Facility history with kind/status/from/to/limit/cursor filters and nextCursor; recorded-time bounds |

Patient-owner access requires `patients.read`; caller-owner access requires `appointments.read` and an appointment, waitlist request or existing reception conversation at that facility. STOP suppresses every purpose across matching tenant/channel/address contacts until a fresh explicit purpose opt-in. Confirmation, reschedule, cancellation and day-before jobs are implemented. Local same-day/requested follow-up, feedback/no-show and waitlist lifecycle are implemented. Reschedule/cancellation rules enforce immediate zero-delay timing. The local WhatsApp inbox, content, templates/campaign preparation and signed inbound/receipt storage are implemented below. Real template synchronization, external sending/receipt-to-send reconciliation and production object storage remain pending. See [current progress](../plan/STAFF_MODULE_PROGRESS.md).

### WhatsApp workspace

All staff mutations below require `Idempotency-Key`. Records use tenant RLS and clinic permission checks. Local templates have `providerApproval=not_synced`, `simulationOnly=true`; local campaign approval never represents Meta approval or delivery.

| Method & path | Permission at clinic | Result / input |
|---|---|---|
| `GET/PUT /v1/comms/settings` | `comms.read` / `comms.manage` | Read readiness, test aliases, estimated rate and persisted operational counts; PUT `{facilityId,phoneNumberId,version}` binds a number without accepting secrets |
| `GET /v1/conversations/contacts?facilityId` | `comms.read` plus patient/appointment reads | Known contacts for local cases; addresses masked without reply authority |
| `GET /v1/conversations?facilityId&kind&status&search&offset&limit` | `comms.read` | Scoped reception/issue/feedback filters, open/closed, items/total/offset/limit |
| `POST /v1/conversations` | `comms.reply` plus owner access | `{facilityId,contactPointId}` → `{id,version}`; does not invent an inbound message or reply window |
| `GET /v1/conversations/:id` | `comms.read` | Audited thread, latest 100 messages, `hasOlderMessages`, cases and current version |
| `POST /v1/conversations/:id/assign`, `/close` | `comms.reply` | `{version}`; assignment uses the authenticated caller |
| `POST /v1/conversations/:id/reply` | `comms.reply` | `{version,text}` (≤3000 chars); actual inbound within 24 h and explicit care consent required; log queue only |
| `POST /v1/support-cases`, `/v1/support-cases/:id/status` | `comms.reply` | Create issue/feedback with optional rating; update `{version,status}` |
| `GET /v1/comms/assets?facilityId` | `comms.read` | Active private asset metadata; opaque storage keys are excluded |
| `PUT /v1/practitioners/:id/whatsapp-photo`, `/v1/departments/:id/whatsapp-guide`; `POST /v1/campaign-assets` | `comms.manage` | JSON `{facilityId,filename,mimeType,dataBase64}`. Frontend reads the selected File; JPEG/PNG ≤5 MiB, guide PDF ≤10 MiB; authenticated requests ≤15 MB |
| `GET /v1/comms/assets/:id/content` | `comms.read` | Authenticated bytes, no-store/nosniff; integrity hash checked; no public download URL |
| `GET/POST /v1/message-templates` | `comms.read` / `comms.manage` | Local content drafts with numbered placeholders; no fabricated provider approval |
| `POST /v1/message-templates/sync` | `comms.manage` | Explicit 422 unavailable until a real Meta synchronization adapter is implemented/configured |
| `GET/POST /v1/campaigns` | `comms.read` / `campaigns.manage` | Local drafts; server-configured estimated rate, budget, template/asset/clinic validation |
| `GET /v1/campaigns/:id/preview` | `campaigns.manage` | Rendered local content, consented destination count, estimate/cap and bound audience hash |
| `POST /v1/campaigns/:id/test` | `campaigns.manage` | `{version,recipientId}` configured alias only; `queued/log/delivered=false`; refresh preview after test changes version |
| `POST /v1/campaigns/:id/approve` | `campaigns.approve` | `{version,audienceHash,expectedCount,testReceived}`; acknowledgement concerns local review, not delivery. One atomic estimated reservation per destination |
| `POST /v1/campaigns/:id/pause` | `campaigns.manage` | `{version}`; cancel local queued recipient rows |
| `POST /v1/contact-points/:id/interests` | `comms.manage` plus owner access | `{version,interest,evidence}` requires explicit marketing consent; voluntary interest only, never chart-derived |
| `GET /v1/whatsapp/outbound?facilityId&kind&status&from&to&limit&cursor` | `comms.read` | Merged notification jobs, local replies and campaign recipients; includes skipped notifications, no bodies, stable keyset cursor and `nextCursor` |
| `GET/POST /v1/integrations/whatsapp/webhook` | Provider verification / raw-body HMAC | Exact signed bytes, configured phone/account binding, durable deduplicated event storage; STOP is applied before acknowledgement; normal inbox processing uses existing worker |

Provider event receipts are append-only, account-scoped and deduplicated. They do not change log messages into sent/delivered records. Unknown send outcomes and provider receipt reconciliation remain part of the future real-send adapter. New inbound senders become unverified booking contacts through a narrow booking-owned function; shared phones never auto-link patients. Suspended modules still record signed STOP and receipts.

Local assets use `COMMS_STORAGE_PATH` (default private `.comms-storage`) with immutable opaque keys, hashes and local structural file checks. Production uploads are refused until a private S3-compatible adapter and scanner are configured/implemented; local validation is not an antivirus acceptance claim. Provider credentials remain server environment variables; no messages or account provisioning are performed by this implementation.

### Staff Voice and Google/growth

`GET /v1/operations/summary` also returns `voiceSessions`: the persisted all-time clinic call count when `voice.read` is granted, otherwise null. It does not imply any live provider connection.

Shared runtime schemas live in `packages/contracts/src/voice-growth.ts`; original screen adapters map legacy paths to these routes. All staff writes below require Idempotency-Key. Provider/runtime configuration remains server-only.

| Method & path | Permission / authentication | Purpose |
|---|---|---|
| `POST /integrations/voice/events` | Dedicated `X-Voice-Secret`, configured tenant/facility/account, pinned app version | Normalized external-runtime event ingestion, event/body replay validation, status/sequence progression, real voice-booking reference validation and privacy consent |
| `GET /v1/voice-calls?facilityId&offset` | `voice.read` @ facility | Last 30 days, 25-row pages, bounded offset, totals/summary/config availability; no sensitive spoken text or private URL |
| `GET /v1/voice-calls/:id/transcript` | `voice.read` @ actual facility | Consented/unexpired original and English turns, audited review, no-store |
| `GET /v1/voice-calls/:id/recording` | `voice.recordings.read` @ actual facility | Consent/expiry and audited decision, authenticated private byte proxy, exact HTTPS host, no redirects, bounded audio/MIME/timeout |
| `GET /v1/voice-recording-access?facilityId` | `voice.recordings.read` @ facility | Latest 100 append-only review decisions; allowed and refused |
| `GET /v1/booking-links?facilityId` | `growth.read` @ facility | Manual clinic booking destination/version |
| `PUT /v1/facilities/:id/booking-link` | `growth.manage` @ facility | `{bookingUrl,version}`, exact approved public HTTPS destination hosts, no credentials/hash, UTM/lang query allowlist, server actor/audit/history |
| `GET /v1/booking-links/changes?facilityId` | `growth.read` @ facility | Latest 100 before/after changes with authenticated staff name |
| `GET /v1/growth/capabilities?facilityId` | `growth.read` @ facility | Actual availability; Google publishing manual, acquisition untracked |
| `GET /v1/growth/summary?facilityId&from&to&cohort=created\|visit` | `growth.read` @ facility | Logical visit chains once, clinic-time cohort/current status, resolved attendance and retained share; empty ratios null |
| `GET /v1/growth/website-activity?facilityId&from&to&traffic=production\|demo` | `growth.read` @ configured project facility | Optional fixed PostHog public/consented aggregates; disabled/not_configured/unavailable are explicit, no invented zeros |

Voice requires strong `VOICE_CALLBACK_SECRET`, explicit `VOICE_CALLBACK_TENANT_ID`, `VOICE_CALLBACK_FACILITY_ID`, `VOICE_CALLBACK_ACCOUNT_ID`, pinned positive `SARVAM_APP_VERSION`; playback additionally needs exact `VOICE_RECORDING_HOSTS`. Consent is independent per recording/transcript; withdrawals persist before business-order/suspension checks, delayed old opt-ins cannot revive content. The normalized callback adapter is implemented; actual Sarvam response/event normalization, retention/purge policy and live private recording acceptance remain unverified. No public call launcher or telephony.

Manual booking writes require `BOOKING_LINK_HOSTS`; absent hosts disable saving. PostHog requires server-only `POSTHOG_READ_KEY`, numeric `POSTHOG_PROJECT_ID`, explicit `POSTHOG_TENANT_ID`/`POSTHOG_FACILITY_ID` and `POSTHOG_API_HOST` fixed to US/EU PostHog. Only public consented event aggregates are queried, with production/demo filters and bounded request/response; actual public telemetry instrumentation and account binding must be validated. Nothing synchronizes a Google profile or claims acquisition conversion.

### Directory
Edits name the row `version` they were made from; a newer row returns 409 `stale_version`. Switching something off is refused (409) while it is still in use (`in_use`, `future_appointments`, `published_hours`, `last_facility`).

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/facilities?includeInactive` | `catalog.read` | Facilities (inactive ones only for `facility.manage` holders) |
| `GET /v1/facilities/:id` | `catalog.read` @ facility | Full details: address, phone, email, directions link, arrival instructions, version |
| `POST /v1/facilities` 🔑 | `facility.manage` @ every facility | Open a clinic (code fixed afterwards) |
| `PATCH /v1/facilities/:id` | `facility.manage` @ facility | Edit details or switch on/off |
| `GET /v1/facilities/:id/directory?includeInactive` | `catalog.read` @ facility | Departments, services, consult rooms (inactive rows for managers) |
| `POST /v1/facilities/:id/departments` 🔑 · `PATCH /v1/departments/:id` | `facility.manage` @ facility | Departments |
| `POST /v1/facilities/:id/consult-rooms` 🔑 · `PATCH /v1/consult-rooms/:id` | `facility.manage` @ facility | Consult rooms |
| `POST /v1/departments/:id/services` 🔑 · `PATCH /v1/healthcare-services/:id` | `catalog.manage` @ facility (+ `pricing.manage` for an opening fee) | Bookable services and their billing item |
| `PUT /v1/healthcare-services/:id/fee` | `pricing.manage` @ facility | Default fee (`mode`, `feeMinor` or null, `effectiveFrom`) |
| `GET /v1/facilities/:id/price-book?on` | `catalog.read` @ facility | Service and doctor fees in force on/after a date |
| `GET /v1/specialties` | `catalog.read` | Reference specialties |
| `GET /v1/practitioners?facilityId&specialty` | `catalog.read` | Doctors with current affiliations |
| `GET /v1/practitioners/:staffId/profile?facilityId` | `catalog.read` @ facility | Profile, all affiliations, calendar, contact, versions |
| `PUT /v1/practitioners/:staffId/profile` | `catalog.manage` @ every facility the doctor works at | Booking profile (specialty, qualifications, languages, video visits, public page) |
| `POST /v1/practitioners/:staffId/affiliations` 🔑 | `catalog.manage` @ facility | Add the doctor to a department |
| `POST /v1/practitioner-affiliations/:id/end` | `catalog.manage` @ facility | Stop working there from a date (needs no booked visits or weekly hours left) |
| `GET /v1/practitioners/:staffId/fees?facilityId&on` | `catalog.read` @ facility | Fee quote for the next two weeks of sessions, as booking prices it |
| `PUT /v1/practitioners/:staffId/fees` | `pricing.manage` @ the service's facility | Doctor's own fee; `feeMinor: null` returns to the service fee |
| `PATCH /v1/staff/:staffId` | `staff.manage` @ every facility they hold a grant at | Display name, phone |

Fee changes publish a new version of the default cash price list (active lists are frozen); appointments keep their fee snapshot and price item.

### Patients
| Method & path | Permission | Purpose |
|---|---|---|
| `POST /v1/patients` 🔑 | `patients.register` @ `registeredFacilityId` | Register; returns `patientId`, `mrn` |
| `GET /v1/patients?q|phone|abhaNumber` | `patients.read` | Search (name typo-tolerant, MRN, phone, ABHA) |
| `GET /v1/patients/:patientId` | `patients.read` | Patient with identifiers, contacts, home address and `version` |
| `PATCH /v1/patients/:patientId` | `patients.update` | Demographics, primary phone/email, home address (earlier contacts are ended, not overwritten); `version` required |
| `GET /v1/patients/:patientId/registry` | `patients.read` | Identifiers, related people, consents, flags (sensitive reasons need `patient_flags.manage`), links |
| `POST /v1/patients/:id/identifiers` 🔑 · `POST /v1/patient-identifiers/:id/remove` | `patients.update` | Add an identifier; remove retires it with a reason (the value may be registered again) |
| `POST /v1/patients/:id/related-persons` · `PATCH /v1/related-persons/:id` | `patients.update` | Next of kin, guardian, legal representative (`ended: true` closes) |
| `POST /v1/patients/:id/consents` · `POST /v1/patient-consents/:id/withdraw` | `patients.update` | General consents (minors need a guardian, representatives their scope) |
| `POST /v1/patients/:id/flags` · `POST /v1/patient-flags/:id/clear` | `patient_flags.manage` | Alerts on the record |
| `POST /v1/patients/:id/no-known-allergies` | `clinical.write` + care | Confirm no known allergies |
| `GET/POST /v1/patient-links` · `POST /v1/patient-links/:id/decide` · `/unmerge` | `patients.merge` | Duplicate proposals; a second person merges, a third may unmerge |

### Doctor calendars
| Method & path | Permission | Purpose |
|---|---|---|
| `POST /v1/practitioners/:staffId/calendar` | `schedules.manage` | Create the doctor's calendar (idempotent) |
| `POST /v1/practitioners/:staffId/weekly-sessions` | `schedules.manage` @ facility | Weekly session (slots and/or walk-in tokens) |
| `POST /v1/weekly-sessions/:id/end` | `schedules.manage` | End a weekly session from a date |
| `POST /v1/practitioners/:staffId/exceptions` | `schedules.manage` | Leave (`closed`), `block`, `extra_hours`; extra hours accept `visitMode` in_person/virtual (old callers default in_person); returns clashing appointments |
| `POST /v1/facilities/:facilityId/holidays` | `schedules.manage` @ facility | Facility holiday; returns clashing appointments |
| `PUT /v1/practitioners/:staffId/weekly-plan` (`POST …/preview`) | `schedules.manage` @ facility | Replace weekly hours; optional `healthcareServiceId`/`consultLocationId` (default: as replaced, else the clinic's one matching service) |
| `PUT /v1/practitioners/:staffId/day-plans/:date` | `schedules.manage` @ each block's facility | One-day plan (new revision) |
| `GET /v1/practitioners/:staffId/sessions?from&to` | `appointments.read` | Effective sessions per day |
| `GET /v1/practitioners/:staffId/slots?from&to&facilityId&includeUnavailable` | `appointments.read` | Bookable slots (≤ 31 days) |

### Booking
| Method & path | Permission | Purpose |
|---|---|---|
| `POST /v1/holds` 🔑 | `appointments.book` @ slot's facility | Hold a slot for a few minutes |
| `DELETE /v1/holds/:reservationId` | `appointments.book` | Release a hold |
| `POST /v1/holds/range` 🔑 | `appointments.book` @ facility | Hold an exact-minute window (5–240 min) inside a published session; optional `visitMode` |
| `GET /v1/calendar-board?facilityId&from&to` | `appointments.read` @ facility | Timeline: each doctor's sessions, slots, appointments, holds, exceptions, holidays |
| `GET /v1/request-outcomes/:key` | signed in | Did a write with this idempotency key land? `unknown`/`in_progress`/`completed` |
| `POST /v1/appointments` 🔑 | `appointments.book` @ facility | Book a held slot for a patient and/or a booking party |
| `GET /v1/appointments?from&to&facilityId&staffId&patientId&status` | `appointments.read` | List (facility-scoped staff must pass `facilityId`) |
| `GET /v1/appointments/:id` | `appointments.read` @ facility | One appointment with patient, booker and token |
| `POST /v1/appointments/:id/cancel` | `appointments.cancel` @ facility | Cancel (reason required); frees the slot |
| `POST /v1/appointments/:id/reschedule` 🔑 | `appointments.reschedule` @ both facilities | Move to a newly held slot |
| `POST /v1/appointments/:id/no-show` | `appointments.check_in` @ facility | After the slot ends |
| `POST /v1/appointments/:id/check-in` 🔑 | `appointments.check_in` @ facility | On the day; links `patientId` if needed; issues a token |
| `POST /v1/walk-ins` 🔑 | `appointments.check_in` @ facility | Walk-in straight into today's queue (capacity-limited) |

### Workspace administration
| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/staff-accounts?facilityId` | `access.manage` @ facility | Staff with access there, their grants and versions |
| `POST /v1/staff-accounts` 🔑 | `staff.manage` + `access.manage` @ scope | Invite by work email with a first role |
| `POST /v1/staff/:id/grants` 🔑 · `POST /v1/role-grants/:id/revoke` | `access.manage` @ scope | Give or remove a role (reason required to remove) |
| `POST /v1/staff/:id/status` | `staff.manage` @ every facility they work at | Deactivate or reactivate |
| `GET /v1/roles` · `POST /v1/roles` 🔑 | `access.manage` (copy: @ every facility) | Roles and permissions; copy a role |
| `PUT /v1/roles/:id/permissions/:code` | `access.manage` @ every facility | Switch a permission on a copied role |
| `POST /v1/roles/:id/retire` | `access.manage` @ every facility | Retire a copied role nobody holds |
| `GET /v1/audit-events` · `POST /v1/audit-events/export` | `audit.read` @ every facility | Activity log and audited CSV export |
| `GET /v1/session-context` | signed in | Tenant, staff, facilities (with names) and permissions |
| `GET/POST /v1/staff/:id/registrations` · `PATCH /v1/staff-registrations/:id` | `staff.manage` | Council registrations; verifying needs someone other than the holder |
| `POST /v1/staff/:id/invite/renew` | `staff.manage` + `access.manage` | Re-open an expired invite for 14 days |
| `GET/POST /v1/care-assignments` · `POST /v1/care-assignments/:id/end` | `access.manage` @ facility | Who may open a patient's chart |
| `GET /v1/break-glass` · `POST /v1/break-glass/:id/review` | `break_glass.review` @ every facility | Emergency access review (with the charts viewed); not one's own |
| `GET /v1/modules` · `PUT /v1/modules/:module` | `tenant.manage` @ every facility | Optional module switches (core modules always on) |
| `GET/POST /v1/consent-documents` · `PATCH /:id` · `POST /:id/publish` · `/retire` | `consent_documents.manage` @ every facility | Consent text drafts, publication (replaces the language's current one) and retirement |

### Queue
| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/queue?staffId&facilityId&date` | `appointments.read` @ facility | The doctor's queue in calling order |
| `POST /v1/queue/call-next` | `queue.manage` @ facility | Next patient (emergency → VIP → senior → normal, then token); 204 when empty |
| `POST /v1/queue-tokens/:id/start` · `/complete` · `/skip` | `queue.manage` @ facility | Consultation progress; complete also completes the appointment |

### Clinical (encounters)
| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/encounters?facilityId&date&staffId&status` | `encounters.read` @ facility | Worklist (no chart contents) |
| `GET /v1/appointments/:id/encounter` | `encounters.read` @ facility | The encounter opened by check-in |
| `POST /v1/encounters` 🔑 | `encounters.manage` @ facility | Unscheduled / emergency encounter |
| `GET /v1/encounters/:id` | `clinical.read` @ facility + care | Encounter with vitals, notes, diagnoses, allergies, problems (audited view) |
| `POST /v1/encounters/:id/start` · `/finish` · `/cancel` | `encounters.manage` @ facility | Lifecycle; finish needs a disposition and no draft notes, and completes the appointment |
| `POST /v1/encounters/:id/participants` | `encounters.manage` | Add a clinician |
| `POST /v1/encounters/:id/vitals` | `clinical.write` @ facility | One capture of vitals by code (`BP_SYS`, `BP_DIA`, `PULSE`, `RESP`, `TEMP`, `SPO2`, `WEIGHT`, `HEIGHT`, `BMI`) |
| `POST /v1/observations/:id/correct` | `clinical.write` | Correct (new value supersedes) or mark entered in error |
| `GET /v1/note-templates` | `clinical.read` | Published templates (e.g. `opd_consultation` SOAP) |
| `POST /v1/encounters/:id/notes` 🔑 | `clinical.write` @ facility | New draft note (optionally from a template) |
| `PUT /v1/notes/:id` | `clinical.write` | Save a new version (`baseVersion` required; signed notes need `amendmentReason`) |
| `POST /v1/notes/:id/sign` | `clinical.sign` (`clinical.sign_nursing` for nursing notes) | Author signs; needs a current council registration |
| `POST /v1/notes/:id/entered-in-error` | `clinical.write` | Void a note (reason required) |
| `POST /v1/encounters/:id/diagnoses` | `clinical.write` @ facility | Diagnosis (new or existing condition); one primary per encounter |
| `PATCH /v1/conditions/:id` | `clinical.write` + care | Problem-list status (resolved, confirmed…) |
| `GET /v1/patients/:id/chart` | `clinical.read` + care | Allergies, problems, recent encounters, latest vitals (audited view) |
| `POST /v1/patients/:id/allergies` · `PATCH /v1/allergies/:id` | `clinical.write` + care | Allergies |
| `POST /v1/patients/:id/break-glass` | `break_glass.use` | Emergency chart access, audited |
| `POST /v1/encounters/:id/triage` | `clinical.write` + care | Triage category, complaint, early-warning score |
| `POST /v1/encounters/:id/mlc` · `PATCH /v1/mlc-records/:id` | `mlc.record` (`mlc.read` to see details) | Medico-legal case, numbered `MLC/{year}/{n}` per clinic |
| `POST /v1/encounters/:id/immunizations` · `POST /v1/immunizations/:id/entered-in-error` | `clinical.write` + care | Vaccines given (author voids) |
| `POST /v1/encounters/:id/care-plans` · `POST /v1/care-plans/:id/status` · `POST /v1/care-plan-activities/:id/status` | `clinical.write` + care | Care plans and their activities |
| `POST /v1/encounters/:id/referrals` · `POST /v1/referrals/:id/respond` · `GET /v1/referrals` | `clinical.write` + care | Internal/external referrals; accepting gives the recipient 30 days of care access |
| `POST /v1/encounters/:id/births` · `POST /v1/birth-records/:id/report` | `vital_records.record` | Birth record and civil registration report |
| `POST /v1/encounters/:id/death` · `POST /v1/death-records/:id/certify` | `vital_records.record` | Death record (marks the patient deceased), MCCD and body release |

### Virtual OPD (teleconsultation)
Design and rules: [../plan/VIRTUAL_OPD_PLAN.md](../plan/VIRTUAL_OPD_PLAN.md). Book a slot from a session with `visitMode: "virtual"` as usual; the worker creates its teleconsultation.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/teleconsults?facilityId&date&staffId&status` | `teleconsult.read` @ facility | Worklist: status, consent, waiting since, link state, encounter |
| `GET /v1/teleconsults/:id` · `GET /v1/appointments/:id/teleconsult` | `teleconsult.read` @ facility | Detail with the session's event log |
| `POST /v1/appointments/:id/teleconsult/link` | `teleconsult.manage` @ facility | Issue (or re-issue, revoking the old) patient join link; returned once, `no-store` |
| `POST /v1/teleconsults/:id/consent` | `consents.record` @ facility | Staff record verbal consent (`documentVersion`, `note`) |
| `POST /v1/teleconsults/:id/start` | `teleconsult.conduct` + assigned doctor | `scheduled/waiting → in_progress`; appointment must be checked in |
| `POST /v1/teleconsults/:id/join` | `teleconsult.conduct` + assigned doctor | Moderator Jitsi grant `{domain, roomName, jwt, expiresAt}` (5 min) |
| `POST /v1/teleconsults/:id/identity` | `teleconsult.conduct` + assigned doctor | Record how identity was confirmed (`known_patient`, `photo_id`, `abha`, `verified_by_staff`) |
| `POST /v1/teleconsults/:id/end` | `teleconsult.conduct` + assigned doctor | End the call: `consulted` (needs identity) · `patient_did_not_join` · `technical_failure` (need a note). Finish the encounter separately |

Patient endpoints take the link token in `X-Teleconsult-Token` (no bearer token). The link is `<TELE_PATIENT_LINK_BASE>#t=<token>`; the page reads the fragment.

| Method & path | Purpose |
|---|---|
| `GET /tele/v1/session` | Doctor, hospital, times, join window, consent document, `next` (`accept_consent`, `wait_for_start_time`, `enter_waiting_room`, `wait_for_doctor`, `join`, `closed`, `unavailable`), `retryAfterSeconds` |
| `POST /tele/v1/session/consent` | `{documentVersion, accepted: true}` |
| `POST /tele/v1/session/check-in` | Enter the waiting room (inside the join window); a linked patient is checked in automatically |
| `POST /tele/v1/session/join` | Participant Jitsi grant, once the doctor has started |
| `POST /tele/v1/session/leave` | Record that the patient left (the call can be rejoined) |

### Billing (switchable module `billing`)
Every route answers 422 `module_inactive` until the tenant switches billing on (`PUT /v1/modules/billing`). Money is integer paise. A consultation is charged by the worker at check-in from the appointment's booked fee; lines no GST rule matches are exempt.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/billing/summary?facilityId&date` | `billing.read` @ facility | The counter's day: charges, bills issued, money by method, refunds, open shifts |
| `GET /v1/billing/charges?facilityId[&patientId&status&unbilled=true]` | `billing.read` | Charges (with the live bill each is on) |
| `POST /v1/billing/charges` 🔑 | `billing.charge` | Manual charge (service priced from the active list, or a typed price) |
| `POST /v1/billing/charges/:id/reverse` | `billing.charge` | Reverse an unbilled charge |
| `POST /v1/billing/charges/:id/discounts` 🔑 | `billing.charge` | Discount; applies at once within the role's `max_discount_percent` or with `billing.approve`, else pending |
| `POST /v1/billing/discounts/:id/decision` | `billing.approve` | Approve or reject a pending discount |
| `POST /v1/billing/invoices` 🔑 | `billing.invoice` | Draft a bill from a patient's open charges (or given charge ids) |
| `POST /v1/billing/invoices/:id/issue` 🔑 | `billing.invoice` | Issue: recompute, number (`BOS/`, `INV/` per facility per FY), mark charges invoiced |
| `POST /v1/billing/invoices/:id/void` | `billing.invoice` | Void a draft or an unpaid, uncredited bill |
| `GET /v1/billing/invoices?facilityId[…]` · `GET /v1/billing/invoices/:id` | `billing.read` | Bills; one bill as a print-ready payload |
| `POST /v1/billing/invoices/:id/credit-notes` 🔑 | `billing.approve` | Credit whole charges off an issued bill (`CN/` numbering); overpayment becomes refundable |
| `POST /v1/billing/payments` 🔑 | `billing.collect` | Payment + allocations + receipt (`RC/`); cash needs your open shift; s.269ST cash limit |
| `POST /v1/billing/payments/:id/allocations` 🔑 | `billing.collect` | Allocate what is left of a payment |
| `GET /v1/billing/payments?facilityId[&patientId&date]` | `billing.read` | Payments with unallocated balance |
| `POST /v1/billing/refunds` 🔑 · `/:id/decision` · `/:id/pay` 🔑 | `billing.refund` · `billing.approve` · `billing.refund` | Request, approve, pay out a refund |
| `GET /v1/billing/refunds?facilityId` | `billing.read` | Refunds |
| `POST /v1/billing/cashier-shifts` 🔑 · `/:id/close` · `/:id/verify` | `billing.collect` · `billing.collect` · `billing.approve` | Open your shift, close it with the counted cash, verify (not your own) |
| `GET /v1/billing/cashier-shifts?facilityId` | `billing.read` | Shifts with expected/counted cash and variance |
| `GET /v1/billing/accounts?facilityId[&status&admissionId]` | `billing.read` | Inpatient stay accounts (one per admission, opened by the worker) |
| `GET /v1/billing/accounts/:id/statement` | `billing.read` | Interim statement: charges so far, deposits, due/credit, deposit-low flag |
| `POST /v1/billing/accounts/:id/deposits` 🔑 | `billing.collect` | Deposit (advance) with receipt; s.269ST also per stay |
| `POST /v1/billing/accounts/:id/final-invoice` 🔑 | `billing.invoice` | Final bill (discharge must be planned): bed days to now, every open charge, deposits applied; settled → finance clearance |
| `GET /v1/billing/deposit-alerts?facilityId` · `PUT /v1/billing/deposit-rules` 🔑 | `billing.read` · `billing.settings` | Stays below the alert threshold; set the clinic's deposit rule |

### Inpatient (switchable module `inpatient`; needs billing on)
Every route answers 422 `module_inactive` until inpatient is switched on. Beds are locations under a ward; a bed has one occupant at a time.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/bed-categories` · `POST` 🔑 | `inpatient.read` · `catalog.manage` | Bed categories (what a bed is billed as) |
| `PUT /v1/bed-categories/:id/price` 🔑 | `pricing.manage` | Daily bed price from a date (new default price-list version) |
| `POST /v1/facilities/:id/wards` 🔑 · `POST /v1/wards/:id/beds` 🔑 · `PATCH /v1/beds/:id` | `facility.manage` | Wards and beds |
| `GET /v1/inpatient/bed-board?facilityId` | `inpatient.read` | Wards → beds: status, occupant (no clinical detail), counts; bed-pending count |
| `POST /v1/beds/:id/ready` · `/block` · `/unblock` · `/maintenance` | `inpatient.manage` | Housekeeping and bed availability |
| `GET /v1/admissions?facilityId[&status&open&patientId]` · `GET /v1/admissions/:id` | `inpatient.read` | Admissions; one with beds, encounter, discharge clearances, stay account |
| `POST /v1/admissions` 🔑 | `inpatient.manage` | Admit (IP number per facility per FY) into a ready bed, or bed-pending |
| `POST /v1/admissions/:id/assign-bed` 🔑 · `/transfer` 🔑 · `/cancel` 🔑 | `inpatient.manage` | Place a bed-pending patient, move beds (optionally retaining the old one), cancel an admission made in error |
| `POST /v1/admissions/:id/discharge` 🔑 | `inpatient.discharge` | Plan the discharge; opens clinical, nursing, pharmacy, finance clearances |
| `POST /v1/discharges/:id/clearances/:kind/clear` · `/waive` | `inpatient.discharge` (doctor: clinical, nurse: nursing) · `pharmacy.dispense` · `inpatient.discharge.override` | Clear or waive a clearance; finance clears when the final bill settles |
| `POST /v1/discharges/:id/depart` 🔑 | `inpatient.manage` | The patient leaves (every clearance done); beds go to cleaning; the encounter finishes |

### Inventory and pharmacy (switchable module `pharmacy`, which carries `inventory`)
Quantities are in each item's base unit; MRP and cost are per base unit. Medicines are sold at most at MRP, and billed GST-inclusive.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET/POST /v1/inventory/stores` 🔑 | `inventory.read` · `inventory.manage` | The clinic's pharmacy store (drug licence required) |
| `GET/POST /v1/inventory/items` 🔑 · `PATCH /v1/inventory/items/:id` | `inventory.read` · `inventory.manage` | Items and drug profiles (schedule H/H1/X, NDPS, high alert), with stock on hand |
| `GET/POST /v1/inventory/suppliers` 🔑 | `inventory.read` · `inventory.manage` | Suppliers (GSTIN, drug licence) |
| `GET /v1/inventory/stock?storeId[&itemId]` · `/alerts` · `/ledger` | `inventory.read` | Stock by batch; low/expiring/expired; an item's movements |
| `GET/POST /v1/inventory/receipts` 🔑 | `inventory.read` · `inventory.receive` | Goods received against a supplier bill (once per bill); creates or tops up batches |
| `POST /v1/inventory/adjustments` 🔑 | `inventory.receive` (opening) · `inventory.adjust` | Opening stock, corrections, consumption, damage, expiry disposal, vendor returns |
| `POST /v1/inventory/batches/:id/status` | `inventory.manage` | Quarantine, recall, expire or release a batch |
| `GET/POST /v1/encounters/:id/prescriptions` 🔑 | `prescriptions.read` · `prescriptions.write` (doctor with care access) | A visit's prescriptions; draft one (inpatient orders may omit quantity; `discharge: true`) |
| `GET/PUT /v1/prescriptions/:id` · `/sign` · `/cancel` | `prescriptions.read` · `prescriptions.write` | Detail with what is left; edit a draft; sign (registration; allergy override reason); cancel |
| `POST /v1/prescription-items/:id/hold` · `/resume` · `/stop` | `prescriptions.write` | Inpatient order changes |
| `GET /v1/pharmacy/queue?facilityId` | `pharmacy.read` | Signed outpatient prescriptions still to fill |
| `POST /v1/pharmacy/dispenses` 🔑 | `pharmacy.dispense` · `pharmacy.sell` (OTC) | Dispense a prescription or an indent, or sell over the counter (FEFO batches; OTC refuses Schedule H/H1/X/NDPS) |
| `GET /v1/pharmacy/dispenses[/:id]` | `pharmacy.read` | Dispenses and counter sales with lines and their charges |
| `POST /v1/pharmacy/returns` 🔑 | `pharmacy.dispense` | Take medicine back (restock or not); an unbilled charge is re-charged |
| `GET /v1/pharmacy/registers/controlled?facilityId&from&to` | `pharmacy.registers` | Schedule H1/X and NDPS register |
| `POST /v1/admissions/:id/indents` 🔑 · `POST /v1/pharmacy/indents/:id/cancel` · `GET /v1/pharmacy/indents` | `pharmacy.indent` · `pharmacy.read` | Ward indents for admitted patients |
| `GET /v1/admissions/:id/mar?date` · `POST /v1/admissions/:id/mar` 🔑 | `prescriptions.read` · `medication.administer` | The day's dose schedule and charting; witness for H1/X/NDPS/high-alert; a dose charted given once |

Billing a counter sale: `POST /v1/billing/invoices` with `dispenseId` (the sale's charges are posted by the worker a moment after the sale).

### HR (switchable module `hr`)
Payroll amounts are paise. Statutory values (PF/ESI rates and ceilings, professional-tax slabs) are settings to confirm with the clinic's CA; TDS is entered per person when computing.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/hr/employees?facilityId` · `GET /v1/hr/employees/:staffId` | `hr.read` (statutory, bank and salary only with `payroll.read`) | Directory; one employee |
| `PUT /v1/hr/employees/:staffId` · `POST …/status` | `hr.manage` | Employment profile; notice and exit (exit ends the staff record's active period) |
| `PUT /v1/hr/employees/:staffId/statutory` | `payroll.manage` | PAN, UAN, ESIC, bank, PF/ESI applicability, PT state (never Aadhaar) |
| `GET/POST /v1/hr/shifts` 🔑 · `GET/PUT /v1/hr/roster` | `hr.read` · `hr.manage` | Shifts; roster days (shift or week off) |
| `GET /v1/hr/attendance?facilityId&date` · `GET /v1/hr/employees/:id/attendance?month` | `hr.read` | A clinic's day; a person's month |
| `POST /v1/hr/employees/:id/punches` · `POST /v1/hr/attendance/compute` | `attendance.manage` | Record a punch for someone (with a reason); recompute a range |
| `POST /v1/hr/regularisations/:id/decision` | `attendance.manage` | Decide a regularisation (not your own) |
| `GET/POST /v1/hr/leave-types` 🔑 · `POST /v1/hr/employees/:id/leave-grants` 🔑 | `leave.request` · `hr.manage` | Leave types; grants and corrections on the balance |
| `GET /v1/hr/leave-requests?facilityId` · `POST …/:id/decision` · `POST …/:id/cancel` | `leave.approve` | Decide (not your own; reports booked appointments for doctors) and cancel leave |
| `PUT /v1/hr/payroll-settings` · `PUT /v1/hr/professional-tax/:state` · `GET/POST /v1/hr/salary-components` 🔑 · `POST /v1/hr/employees/:id/salary` 🔑 | `payroll.manage` (`payroll.read` to list) | Payroll setup and salary structures (versioned from a month) |
| `GET/POST /v1/hr/payroll-runs` 🔑 · `GET …/:id` · `POST …/:id/compute` | `payroll.read` · `payroll.manage` | Monthly runs; compute (attendance → paid days → payslips) |
| `POST /v1/hr/payroll-runs/:id/approve` · `/mark-paid` · `/lock` | `payroll.approve` | Approve (not who computed), paid with bank refs, lock (freezes attendance) |
| `GET /v1/hr/payslips/:id` | `payroll.read` | One payslip |
| `POST /v1/me/attendance/punch` · `GET /v1/me/attendance?month` · `POST /v1/me/regularisations` 🔑 | `attendance.self` | Clock in/out; own month; ask to correct a day |
| `GET /v1/me/leave` · `POST /v1/me/leave-requests` 🔑 · `POST /v1/me/leave-requests/:id/cancel` | `leave.request` | Own balances and requests |
| `GET /v1/me/payslips[/:id]` | `leave.request` | Own approved payslips |

🔑 = requires `Idempotency-Key`.

## Worker
`pnpm worker:dev` delivers outbox events (exactly once per consumer, retries with exponential backoff, dead-letters after 10 attempts), expires lapsed slot holds every 30 s, keeps monthly audit/outbox partitions ahead daily, and purges expired idempotency records hourly. Registered consumers: `appointment.checked_in` → open encounter; `appointment.cancelled` → cancel a not-yet-started encounter; `encounter.finished` → complete the appointment and its queue token; `appointment.confirmed` (virtual) → create the teleconsultation; `appointment.cancelled`/`no_show` → close it and revoke the link; `teleconsult.patient_waiting` → check the appointment in; `appointment.checked_in` → charge the consultation and `appointment.cancelled` → reverse it while unbilled (billing, only while the module is on). `admission.admitted` → open the stay's encounter and billing account; `admission.discharged`/`cancelled` → finish/cancel that encounter; `invoice.paid`/`billing.account_settled` → settle the stay and clear finance. `dispense.completed` → charge each line (stay account for inpatients); `dispense.returned` → re-charge an unbilled line. `leave.approved`/`cancelled` → close/reopen a doctor's bookable days; `employee.exited` → end the staff record. Bed days are charged hourly (idempotent per occupancy per date). Consumers of a switched-off clinic module skip their events.

## Try it
```bash
pnpm pg:start && pnpm db:reset && pnpm api:dev
TOKEN=$(pnpm -s dev:token ravi)
curl -s localhost:3000/v1/me -H "authorization: Bearer $TOKEN"
curl -s "localhost:3000/v1/practitioners/01920000-0000-7000-8000-000000000401/slots?from=2026-10-19&to=2026-10-19" -H "authorization: Bearer $TOKEN"
```

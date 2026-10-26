# Missing backend work ledger

**Current follow-up, 13 October 2026:** all seven audit backend items UXA01–UXA07 are implemented and verified in isolated PostgreSQL; see [hardening evidence](AUDIT_BACKEND_HARDENING.md). Managed WhatsApp/Sarvam onboarding is active, with live provider work still open in [channel onboarding](MANAGED_CHANNEL_ONBOARDING.md). Public webpage integration remains on hold.

**Historical checkpoint, 12 October 2026:** the product owner closed the original local staff implementation phase. The module inventory below preserves that checkpoint; it does not supersede the current follow-up. [Operations review](STAFF_OPS_REVIEW.md).

Schema/workflow review: [frontend/backend contract decisions](FRONTEND_BACKEND_CONTRACT_DECISIONS.md). Preserve the original design while resolving incompatible semantics before enabling writes.

Starting commit: `6713e01`. Third phase verified locally on 12 October 2026: 20 backend files / 252 tests; 54 frontend tests; typechecks/build pass; lint 0 errors / 16 warnings. [Current progress](STAFF_MODULE_PROGRESS.md); [first checkpoint](STAFF_MODULE_IMPLEMENTATION_CHECKPOINT.md) is historical.

**Scope: original staff UI only.** 29 of 31 active requirements are DONE locally. G19 and G20 remain PARTIAL for actual provider transport and production storage. G21/G22/G25 are implemented; all seven WhatsApp tabs are mounted. G23 is concept-only, G10 not required, G09 dropped and G28–G33 OUT OF SCOPE. [Completion guide](BACKEND_COMPLETION_GUIDE.md), [regression/flow tests](REGRESSION_AND_FLOW_TESTS.md).
## Resolved module decisions, 12 October

[STAFF_MODULE_DEVELOPMENT_DECISIONS.md](STAFF_MODULE_DEVELOPMENT_DECISIONS.md) records the ERD-based release choices delegated by the product owner. G10 is not required; G23 is concept-only. G19–G22 require the documented scoped comms implementation, and G25 contracts accompany each new slice. Provider readiness is not established by this decision pass.

## Connected frontend status

Source is imported into `HMS_NEW/apps/staff-web`, with monochrome styles/components and original modules preserved. The new entry point calls `/v1` directly using typed frontend DTOs; legacy Python API calls remain disconnected. Original scheduling components now use a frontend presentation adapter; other full modules still await porting/wiring. Sign-in, facility context, patient search/registration, strict-slot booking/rescheduling/cancellation/check-in, queue, consultation worklist, physician notes/finish, patient chart and read-only directory/slots are connected. A synthetic visit and walk-in were verified in the browser and isolated PostgreSQL; see [integration checkpoint](STAFF_FRONTEND_INTEGRATION_CHECKPOINT.md). Teleconsultation worklist/link and patient consent-document display are also connected. Allergy add/status, problem status, vital correction, note templates, note entered-in-error (author only), break-glass emergency access and queue start-serving are connected and were round-tripped on synthetic data on 11 October.

Status convention: **DEFERRED** means backend implementation has not started. A frontend workaround does not close a backend issue. Close an item only after its contract, authorization, persistence, worker/race checks, and appropriate UI acceptance pass.

## Open backend work

| ID | Priority | Required work | Current frontend handling |
| --- | --- | --- | --- |
| G01 | P0 | **DONE (Phase 1)** Facility authorization of scheduling reads/writes: every calendar route resolves the facilities it affects (rule facility, doctor's affiliations for leave/blocks, day-plan reach) and requires the permission for each; facility-scoped readers see only their facilities' sessions/slots. Tests in `api.test.ts` | Schedule writes can now be wired (Phase 2). |
| G02 | P0/P1 | **DONE (Phase 7)** `GET /v1/session-context` (tenant, staff, facilities with names, permissions); a multi-tenant sign-in's 400 lists `tenantIds` and `tenantNames` (`platform.tenants_for_identity`) | Tenant chooser shows clinic group names. |
| G03 | P0 | **DONE (Phase 4)** `GET /v1/appointments` takes `q` (patient/booker name, phone digits, MRN, confirmation code; wildcards literal) and keyset `cursor`/`nextCursor` in visit order | Appointments page searches on the server and pages 100 at a time. Schedules board still reads one day up to 500. |
| G04 | P1 | **DONE (Phase 7)** `GET /v1/calendar-board?facilityId&from&to` — per affiliated doctor: sessions, slots, appointments, live holds, exceptions, holidays, counts, `asOf` | Schedules timeline reads one board call plus appointments. |
| G05 | P1 | **DONE (12 October acceptance)** Server previews and saves recheck affected appointments. Resolve opens the original appointment actions; cancelling/moving refreshes only the board, preserving the proposed weekly draft for a fresh review. Holiday editor is out of scope | Browser verified cancel through Resolve retained 10:00–13:00, then fresh review enabled Save. |
| G06 | P1 | **DONE** Schedule exceptions/revocation and holiday reads remain connected. Extra hours persist visitMode in_person/virtual; virtual slots use a matching service and normal booking creates exactly one tele session | Original extra-hours sheet supports virtual and in-person hours. |
| G07 | P1 | **DONE (Phase 2)** `GET weekly-sessions`, `POST weekly-plan/preview`, `PUT weekly-plan` (withdraws/trims replaced rules, keeps service/room/walk-in, cross-clinic collisions → 409), `GET day-plans/:date`; day-plan save takes `baseRevision` → 409 `stale_revision` | Weekly editor reads, previews and saves. |
| G08 | P1 | **DONE (persisted acceptance)** Exact range holds are used for moves; a replacement appointment links the cancelled predecessor, releases its old reservation, preserves idempotency and rejects overlap | Exact-time move adapter verified; HTTP test reads back predecessor and replacement. |
| G09 | — | **DROPPED** (user decision 11 Oct): no ERD table; appointment reason and clinical notes cover the need | Staff-note field removed from the UI inventory. |
| G10 | P1 conditional | **NOT REQUIRED (release decision)** No archive command | Reasoned cancellation retains history. No new endpoint or deletion flow. |
| G11 | P1 | **DONE (Phase 6)** `GET/POST /v1/waitlist`, `POST /v1/waitlist/:id/offer` (15-minute hold owned by the offer), `POST /v1/waitlist-offers/:id/accept|decline`, `POST /v1/waitlist/:id/withdraw`; see `docs/prd/waitlist.md` | Original Waitlist mounted on it with add, offer, accept/decline and withdraw. Patient self-service join/accept waits on G33; automatic offers on G19. |
| G12 | P1 | **DONE (Phase 5)** `GET /v1/operations/summary?facilityId&date` (`appointments.read` at that clinic): totals, status/channel mix, doctors with published hours, live holds, 14 clinic-local days of bookings, ten latest bookings; local unexpired notification counts for comms.read; otherwise null; persisted Voice session totals require voice.read | Original Overview mounted on it; labels distinguish local jobs from delivery. `GET /v1/operations/events` (latest 100 outbox events, metadata only, `audit.read` for every clinic) feeds the original Operations page with `/ready`. |
| G13 | P0 read/P1 write | **DONE (editable workspace)** Reads: `GET /v1/facilities/:id`, `…/directory?includeInactive`, `…/price-book`, `GET /v1/specialties`. Writes: clinics (`POST /v1/facilities`, `PATCH /v1/facilities/:id` incl. directions link and arrival instructions, migration `m01_facility_info`), departments, consult rooms and bookable services (create/edit/switch off with `in_use` guards), optimistic `version`. Observation definitions remain with G29 | Hospital catalogue edits clinic details, departments, services (with default fee) and rooms. |
| G14 | P1 | **DONE (editable workspace)** Doctor booking profile (`PUT /v1/practitioners/:id/profile`), clinic affiliations (add, end with `future_appointments`/`published_hours` guards), staff name/phone (`PATCH /v1/staff/:id`), service and doctor fees (`PUT …/fee`, `PUT /v1/practitioners/:id/fees`) published as a new default price-list version so bookings keep their fee. Staff council registrations remain | Doctors page saves profile, name/phone, clinics and fees; "Set up calendar" for doctors without one. |
| G15 | P0 | **DONE (Phase 7)** `encounter.started` puts the patient's queue token in service (consumer); finishing the encounter completes it; queue complete while open is refused | Token and consultation stay in step. |
| G16 | P1 | **DONE (Phase 7)** Adds council registrations (`GET/POST /v1/staff/:id/registrations`, `PATCH /v1/staff-registrations/:id`, verification by someone else), care assignments (`GET/POST /v1/care-assignments`, `POST …/:id/end`), invites expire after 14 days and renew (`POST /v1/staff/:id/invite/renew`) | Settings: registrations, expired-invite renew; patient record: care team. |
| G17 | P1 | **DONE (Phase 7)** `GET /v1/modules`, `PUT /v1/modules/:module` (`tenant.manage` everywhere; core modules refused; version-checked transitions) | Settings → Optional modules switches. |
| G18 | P1 | **DONE (Phase 7)** Adds `GET /v1/break-glass` (with chart views from the audit) and `POST /v1/break-glass/:id/review` (`break_glass.review` at every clinic, not one's own, once) | Activity log → break-glass review queue. |
| G19 | P1 manual/P2 provider | **PARTIAL (local UI/workflows complete)** All seven visit-rule controls, waitlist lifecycle, contacts/purpose consent/STOP, history/summary and signed inbound/receipt evidence. Remaining: real template sync/send claims/unknown outcomes/receipt correlation and live acceptance | Original controls/readback restored. Local queues never claim delivery. |
| G20 | P2 | **PARTIAL (all seven tabs integrated)** Conversations/cases/assignment/local replies, private local doctor content, campaigns/test/approval/budget/pause, clinic details and signed callbacks. Remaining: Meta outbound/templates/media and production object storage/scanner adapters | Original module layouts retained; provider operations visibly unavailable. |
| G21 | P2 | **DONE (local implementation)** Normalized external-runtime ingestion, bounded last-30-days history, transcript review, consent/expiry-controlled private recording proxy, append-only consent/transcript/access evidence and replay ordering | Original staff Voice mounted. Live Sarvam/runtime/recording-host and retention acceptance remain unverified. No launcher/telephony. |
| G22 | P2 | **DONE (local implementation)** Approved-host manual clinic links/history, clinic-time logical-visit growth aggregates and optional scoped PostHog adapter | Original Google Business/Growth mounted; Google publication manual, attribution unavailable, real provider acceptance unverified. |
| G23 | P2 conditional | **CONCEPT ONLY (release decision)** No operational membership/discount backend | Retain the labelled original concept; no records, payment or benefit application. |
| G24 | P1 | **DONE (Phase 7)** Adds identifiers (add; remove retires the row with a reason), related people, consents (record/withdraw, guardian/representative checks), flags (set/clear; sensitive reasons hidden), no-known-allergies, duplicate proposals with second-person merge decision and third-person unmerge (`/v1/patient-links`) | Patient record registry panels and duplicate queue. |
| G25 | P1 | **DONE (scoped contracts)** Shared Zod notification, WhatsApp, Voice and growth schemas used by API/frontend; typed scoped adapters and fail-closed response validation | No database imports into browser code; extend contracts with future provider work. |
| G26 | P0/P1 | **DONE (Phase 7)** `GET /v1/request-outcomes/:key` reports `unknown`/`in_progress`/`completed` for an idempotency key; staff schedule writes use stable per-intent keys | Retries after a lost response reuse the key. |
| G27 | P0 when nursing notes enabled | **DONE (Phase 7)** `clinical.sign_nursing` lets nurses sign nursing notes only (doctor notes still need `clinical.sign`) | Nurse notes are created and signed as `nursing`. |
| G28 | **OUT OF SCOPE** (not in the original UI) | Prescriptions and medication reconciliation | No prescribing controls; clinical note is not a prescription |
| G29 | **OUT OF SCOPE** (not in the original UI; M06 removed in `0aaff77`) | Lab/imaging orders and results | No ordering or result-review controls |
| G30 | **OUT OF SCOPE** (not in the original UI) | Billing/invoices/payments | Booked fee shown only; no invoice or paid-state claims |
| G31 | **OUT OF SCOPE** (not in the original UI; WhatsApp upload needs are handled under G20) | Document uploads | No attachment/upload controls |
| G32 | **OUT OF SCOPE** (not in the original UI) | Inpatient/admission/bed operations | No admission or bed-allocation controls |
| G33 | **OUT OF SCOPE** (not a staff screen) | Separate public website booking API | Old public book/talk entry points excluded from staff build |
| G34 | P1 before real video pilot | **DONE (Phase 7)** `GET/POST /v1/consent-documents`, `PATCH /:id` (draft only), `POST /:id/publish` (retires the previous published one for the language), `POST /:id/retire` — `consent_documents.manage` everywhere | Settings → consent documents. |
| G35 | P0 nursing workflow | **DONE (Phase 1)** Self-join is idempotent; repeat is harmless, one participant row | Self-join control can return. |
| G36 | P1 | **DONE (Phase 3)** Per-clinic overbooking: `config_setting` key `booking.overbooking` (facility, default off, `PUT /v1/facilities/:id/overbooking` needs `config.manage` there); `appointments.overbook` (tenant_admin, front_desk); `POST /v1/appointments/overbook` into a taken, unblocked slot of a published session; reservation status `overbooked` outside the EXCLUDE, reason required and audited; at most 3 per session under the resource lock (concurrency-tested) | Schedules: clinic switch for administrators; "Add another appointment at this time" on a booked visit asks for a reason. |
| G37 | P1 | **DONE (Phase 2)** `closed`/`block` exceptions may carry `facility_id`; a clinic block hides only that clinic and is authorized there; omitting it keeps the all-clinic rule (G01) | Timeline blocks apply to the current clinic. An all-clinics option in the sheet is not offered yet. |
| G38 | P1 | **DONE (Phase 1)** An encounter linked to an appointment is cancelled through the appointment (which cascades); direct cancel returns 422 `cancel_appointment`. Unscheduled encounter cancel now checks care access | Encounter cancel not exposed. |
| G39 | P2 | **DONE (Phase 4)** System templates v2 carry `propertyOrder`; v1 retired (published versions stay immutable, old notes still validate) | SOAP renders S, O, A, P. |
| G40 | P1 | **DONE (Phase 1)** Only the author may mark a note entered in error (403 otherwise) | Entered-in-error offered to the author only. |

## Next backend tranche

Continue the provider/production work for G19/G20 in the [completion guide](BACKEND_COMPLETION_GUIDE.md). G21/G22/G25 local implementation is complete. Provider delivery, production storage and real-runtime acceptance remain separate from local workflow evidence.

## Deferred frontend/provider acceptance

- Original WhatsApp, Voice, Google Business and Growth forms still need typed adapters and their scoped routes. Their navigation remains pending; Loyalty stays labelled concept.
- Provider credentials, signed callbacks, unknown-send handling and real delivery acceptance remain unverified.
- Production OIDC, deployment, approved clinical consent and real video calls remain unverified.
- Diagnostics and general documents are outside this release. Billing, pharmacy, inpatient and HR are being built as switchable clinic modules (2026-10-21, [CLINIC_OPERATIONS_MODULES.md](CLINIC_OPERATIONS_MODULES.md)).

## Change log

- 2026-10-21: product owner reversed the out-of-scope decision for G28 prescriptions, G30 billing and G32 inpatient (M07/M09/M10/M11) and added an HR module; all are tenant-switchable (`platform.module_state`, off by default). Plan and progress: [CLINIC_OPERATIONS_MODULES.md](CLINIC_OPERATIONS_MODULES.md).

- 2026-10-12 (phase 3): all seven WhatsApp tabs, staff Voice, Google/growth, feedback/no-show and immediate controls integrated; 252 backend / 54 frontend tests PASS, lint 16 warnings / 0 errors, six migrations rollback/reapply PASS. 29 active requirements DONE, two PARTIAL. No live provider activity.

- 2026-10-12 (phase 2): restored three original WhatsApp tabs; versioned reminder rules, completed-visit follow-ups, waitlist offer lifecycle, timestamp-precise history pagination and truthful summary counts. CSV statuses synchronized to current Markdown ledger. Full backend suite 222 tests passing; see STAFF_MODULE_PROGRESS.md for frontend/browser evidence and remaining scope.

- 2026-10-12: product owner authorized development using two subagents. Closed G05/G06/G08; implemented first G19/G25 slice. Verified 217 backend and 31 frontend tests, typechecks/build and unchanged 18 lint warnings on isolated Postgres 54349. No provider messages sent.

- 2026-10-12: delegated module choices recorded in STAFF_MODULE_DEVELOPMENT_DECISIONS.md; G10 not required, G23 concept-only, private content storage and staff communications/growth slice selected. No backend implementation, migration or provider activation performed.

- 2026-10-12: scope narrowed to the original staff UI. M06 diagnostics, M09 pharmacy and M10 inventory were reverted (`0aaff77`). G28–G33 marked out of scope. Added [BACKEND_COMPLETION_GUIDE.md](BACKEND_COMPLETION_GUIDE.md) and [REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md); rewrote [HANDOFF.md](HANDOFF.md).

- 2026-10-11 (editable workspace, `docs/prd/editable-workspace.md`): G13 and G14 done, G24 partial, G16 role retirement. Booking regressions fixed: new doctors can be affiliated and given a calendar (R1); weekly hours without earlier hours now get the clinic's service so bookings are priced (R2); the booking sheet picks a doctor once the list loads (R3) and books unregistered callers (R4). User flows and their tests: `STAFF_USER_FLOWS.md`, `flows.test.ts`, route coverage `coverage.test.ts`.

- 2026-10-11 (Phase 1): G01, G35, G38, G40 done; G15 partial; G09 dropped; request logs no longer record query strings. Plan: `docs/prd/backend-integration-phases.md`.
- 2026-10-11 (later): user decisions recorded (overbooking admin toggle, clinic-specific blocks, read-only fee, schedule writes wait for G01). Wired every remaining safe existing route; added G36–G40. No backend code changed.

- 2026-10-10: 27 source-audited gaps recorded in the master plan.
- 2026-10-11: imported selected dirty staff source; began connecting existing APIs; added UI-handling/status fields and G28–G33 future-domain/public API gaps. No backend domain behavior changed.

- 2026-10-11: connected core daily operations, walk-in and teleconsultation surfaces; synthetic browser/database visit passed. Added G34 from the staff verbal-consent/document publication integration gap. All 35 backend areas remain deferred.

- 2026-10-11: reproduced G35 in the browser/API/database; self-join rolled back. Removed its failing UI control and recorded [the reproduction](staff-integration-audit/nursing-self-join-receipt.json). All 35 backend areas remain open.

- 2026-10-11: user assigned backend implementation to a dedicated agent. This task restored original frontend schedule/editor details and pending navigation; recorded 53 UI feature groups. Backend implementation remains deferred.

### New UX review follow-ups (12 October 2026)

The accepted implementation phase remains closed. New comments are recorded in [UX_AND_CHANNEL_TODO.md](UX_AND_CHANNEL_TODO.md#backend-ledger-carried-forward-from-these-comments): indefinite/any-doctor waitlist preferences, optional clinic-wide queue aggregation, longitudinal repeat-patient care-access policy, and ABHA external record retrieval. Facility-wide doctor booking is supported through custom roles, but the requested **own-doctor** booking/blocking needs resource-based server enforcement; no permission grant or schema change was made. These are explicit deferred decisions/work, not missing frontend save simulations. Public webpage/Voice integration stays on hold.

### UX-B01 — own-doctor booking and time blocks — DEFERRED

Built-in Doctor can read appointments/schedules but cannot book or block. Existing facility-scoped `appointments.book` / `schedules.manage` authorizes other practitioners too. Own-row buttons remain disabled for that role. Implement server-derived actor/practitioner checks for `/v1/holds`, `/v1/holds/range`, reservation-to-appointment creation, exception preview/create/revoke and any block impact-resolution boundary. Cover cross-clinic, another doctor, forged practitioner/actor and expired/changed reservation cases. Preserve resource locks, atomic conflict handling, idempotency and audit attribution. Own blocking must not grant weekly-hours edits or other-doctor scheduling implicitly. Add positive own-doctor round trips plus forbidden other-doctor/other-clinic regression tests before enabling UI.

### UX-B02 — routine repeat-patient chart access — DECISION / DEFERRED

Keep clinical role permission and care relationship checks. Decide whether treating doctors retain longitudinal access and for how long. Move explicit assignment administration to a clinic-admin workflow after removing it from routine patient Overview. Do not silently grant every doctor every chart or use emergency break-glass as normal access. Existing active-visit attending participation and explicit ongoing assignments remain supported; no backend change here.

### UX-B03 — independently opened visit policy — DECISION / DEFERRED

The frontend now uses existing idempotent `POST /v1/encounters` for present patients. Doctor UI fixes attendingStaffId to their own identity; this is not server self-scope enforcement. Decide and test actor/attending affiliation, multiple active visits and concurrency policy. Stable idempotency prevents replay of one identical request; it does not prevent two independently created visit intents. No future booking, slot reservation or queue token is implied by opening this encounter.

Second desktop UX review: 58 frontend tests PASS, TypeScript/build PASS, 17 lint warnings /0 errors. Doctor synthetic visit creation→start→draft→sign→finish and completed worklist readback passed in isolated local preview. Provider, deployment and clinical acceptance remain unverified. [Current UX decisions](UX_AND_CHANNEL_TODO.md#second-annotated-desktop-review--implemented).

### UX-B04 — seeing a future appointment early / linking an existing unbooked visit — DEFERRED

Reproduced the owner’s case: a future appointment remains confirmed because the completed encounter was opened with `appointmentId: null`. `POST /v1/encounters` always creates an unbooked encounter; finishing one cannot complete unrelated bookings. Check-in explicitly requires the appointment’s clinic-local date. No frontend date/patient/doctor guess, arbitrary status update or retroactive link was added.

Existing supported path: front desk moves the confirmed appointment to a real available slot today, checks it in, then the doctor opens the exact appointment→encounter link. Finish emits the linked appointment ID and the worker completes that appointment/token. If early arrivals must retain the original booking/time, add an explicit server command: actor/care/facility/practitioner checks; lock appointment and encounter/reservation; enforce permitted date/status/consent/mode transitions; preserve reservation/queue/audit/history and notification behavior. Decide whether already-finished unbooked visits can ever be linked retrospectively. Do not overwrite the original record or infer the association from patient/time alone. Required concurrency, other-doctor/clinic, already-completed, duplicate-link and idempotent replay tests.

### UX-B05 — appointment/visit duplication policy — DEFERRED

Frontend now checks all pages of today-and-future bookings for the exact registered patient in the selected clinic, excludes cancelled/no-show/completed and the appointment being moved, shows a duplicate alert, requires acknowledgement for an additional booking, and rechecks before confirmation. New unbooked visits show existing bookings and completed visits; another active visit with the same doctor is routed to that visit. This is advisory UX, not an atomic database uniqueness rule.

Decide which duplicates should be forbidden versus valid (different doctor, follow-up, different clinic, family booking contact). Enforce chosen rules under server locks for booking and encounter creation with explicit override reasons/audit where allowed. Include two concurrent independent requests, alias/merged patient identity, booking-party-only requests, restricted-clinic visibility and opt-out/consent boundaries. A shared phone is not proof of patient identity. Broad permissions are unchanged; early-arrival work does not grant self-schedule privileges implicitly.

### UX-B06 — overbooking an arbitrary exact range — DEFERRED

`POST /v1/appointments/overbook` accepts `slotStart` and persists the entire published slot; it does not accept an end time. A partial or multi-slot occupied range (for example 11:15–12:00 across booked slots) therefore cannot be saved truthfully through that route. Frontend now identifies a whole published booked slot, automatically selects the reasoned overbooking flow when clinic policy and permissions allow it, and offers explicit whole-slot choices for unsupported ranges. Selecting a choice replaces both displayed endpoints; no silent range shortening occurs. The adapter rechecks the full chosen endpoints and rejects held/blocked ranges before posting.

If arbitrary overlap ranges are required, add a separate typed server command accepting both endpoints. Decide overlap and per-session cap semantics, clinic/doctor/mode/session containment, expected booking versus live-hold distinctions, reason and permissions, reservation/linkage rules, notifications and audit. Keep the resource lock and atomic checks, stable idempotency and replay. Required tests: partial and multiple published slots, another doctor/clinic, blocking and held reservations, caps, concurrent booking/hold/overbook, and exact persisted start/end readback. Existing slot-based overbooking also needs an atomic server distinction between an actual booked reservation and a live hold: its current `taken` status check includes both. Frontend rejection of observed holds does not close a hold arriving after preflight. No backend changes or wider grants were made here.

## Desktop audit follow-ups — 13 October 2026

The original [admin dashboard audit implementation](STAFF_UX_AUDIT_IMPLEMENTATION.md) was frontend-only. This follow-up adds backend contracts, migrations and permission changes on codex/audit-backend-hardening. All seven additional contracts are implemented. See AUDIT_BACKEND_HARDENING.md for verification and deployment boundaries.

| ID | Required backend decision/work | Current UI boundary / acceptance requirement |
| --- | --- | --- |
| UXA01 | IMPLEMENTED: typed server visitMode filter before pagination; cursors bind actor, tenant and all filters. | Mixed-mode pagination, later-page matches, scope/cursor refusal covered in booking-read-contracts.test.ts. |
| UXA02 | IMPLEMENTED: zero/inaccessible clinic evidence, real organisation-wide bootstrap authority, atomic bounded creator grant. | Parallel/replayed creation and permissions after migration covered in admin-guarantees.test.ts. |
| UXA03 | IMPLEMENTED: numeric role version and immutable policy-row version token (null when unset). | Concurrent reviewed changes refuse stale versions. Roles/policy recheck live authority under access locks. |
| UXA04 | IMPLEMENTED: keyed decline and authorised closed-offer outcome including actor/version. | Discarded committed response, expiry, accept/decline race and revoked-authority replay covered in command-recovery.test.ts. |
| UXA05 | IMPLEMENTED: typed /v1/booking/readiness for exact clinic/doctor/slot/mode/service/effective fee. | Configuration, occupancy and unchecked provider/consent/signing remain distinct; not a reservation or activation certificate. |
| UXA06 | IMPLEMENTED: tenant timezone and exact half-open filter bounds in audit read/export responses. | DST 23-hour day, midnight boundaries, clinic mismatch and invalid dates covered in audit-boundary.test.ts. |
| UXA07 | IMPLEMENTED for active inventoried operational routes: required actor-bound keys and original receipts; legacy actorless records fail closed. | Admin, catalogue, cancellations/revocations and waitlist adapters preserve keys. Unknown outcomes cannot be cleared by blind refresh. See mutation inventory. |

Public webpage remains deferred. Managed Sarvam/WhatsApp onboarding is now active work: see MANAGED_CHANNEL_ONBOARDING.md. Live delivery, provider binding/approval and carrier-routing acceptance remain unfinished.

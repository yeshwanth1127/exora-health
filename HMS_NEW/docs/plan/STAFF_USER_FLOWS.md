# Staff user flows

**Phase closed by the product owner on 12 October 2026.** Local staff implementation is accepted. Active focus is UX/UI and operations review; webpage/Voice-bot integration is on hold. Provider work below is carried forward in [UX_AND_CHANNEL_TODO.md](UX_AND_CHANNEL_TODO.md), not silently marked implemented. [Current operations review](STAFF_OPS_REVIEW.md).

How each person uses the staff workspace, the screen and API calls behind every step, and the test that proves the flow end to end over HTTP. PRD: [editable workspace](../prd/editable-workspace.md).

Two guards run in CI on every change:
- **Flows**: `apps/api/src/http/flows.test.ts` runs F1–F9 in order against an empty hospital (only a tenant, one clinic and the people exist), so setup gaps such as "a new doctor can't be booked" fail a test.
- **Route coverage**: `apps/api/src/http/coverage.test.ts` reads every `/v1/…` path in `apps/staff-web/src` and fails if any has no backend route.

Browser walkthroughs are performed locally; the first implementation wave also verified Resolve and explicit contact/consent entry on an isolated preview. These tests cover the API each screen calls, not the rendering.

Remaining communications/growth flows F10–F14 are specified in [REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md), under the resolved [module development decisions](STAFF_MODULE_DEVELOPMENT_DECISIONS.md). They are implementation targets, not passing flows yet. The patient bot, public call launcher, telephone infrastructure and operational Loyalty backend are outside this release.

## People

| Person | Built-in role | Scope |
|---|---|---|
| Hospital administrator | `tenant_admin` | every clinic |
| Clinic administrator | `tenant_admin` | one clinic |
| Front desk | `front_desk` | one clinic |
| Doctor | `doctor` | their clinics |
| Nurse | `nurse` | one clinic |
| Auditor | `auditor` | every clinic |

## Setting up (administrators)

| # | Flow | Screen | API, in order | Test |
|---|---|---|---|---|
| F1 | Open a clinic and fill in its catalogue | Hospital catalogue → Add clinic, Edit details, Add department / service / room | `POST /v1/facilities` → `PATCH /v1/facilities/:id` → `POST …/departments` → `POST …/consult-rooms` → `POST /v1/departments/:id/services` (with opening fee) → `GET …/directory` | flows F1; catalog "clinic details", "departments, rooms and services" |
| F2 | Bring a doctor on | Workspace settings → Add staff member (doctor role); Doctors → Add doctor to this clinic, Doctor details; Schedules → Weekly hours | `POST /v1/staff-accounts` → doctor signs in (invite links) → `POST /v1/practitioners/:id/affiliations` → `PUT …/profile` → `POST …/calendar` → `PUT …/weekly-plan` → `GET /v1/practitioners`, `GET …/fees` | flows F2; catalog "doctor profile and clinics", "weekly hours offer a service" |
| F4 | Set a doctor's own fee from a date | Doctors → Doctor details → Fees | `PUT /v1/practitioners/:id/fees` (and `feeMinor: null` to return to the service fee) | flows F4; catalog "concurrent fee changes" |
| — | Change a service's default fee | Hospital catalogue → service Edit | `PUT /v1/healthcare-services/:id/fee` | catalog "creates a bookable service…" |
| — | Rename staff, change their phone | Workspace settings → Manage; Doctors → Name and contact | `PATCH /v1/staff/:id` | catalog "renames staff…" |
| — | Grant, remove, deactivate; copy, edit and retire roles | Workspace settings | `POST /v1/staff/:id/grants`, `POST /v1/role-grants/:id/revoke`, `POST /v1/staff/:id/status`, `POST /v1/roles`, `PUT /v1/roles/:id/permissions/:code`, `POST /v1/roles/:id/retire` | access.test; catalog "custom roles" |
| — | Council registrations, expired invites, module switches, consent documents | Workspace settings | `/v1/staff/:id/registrations`, `…/invite/renew`, `PUT /v1/modules/:module`, `/v1/consent-documents…` | records "M01 administration" |
| — | Clinic booking policy (overbooking) | Workspace settings → Booking policy | `PUT /v1/facilities/:id/overbooking` | api "overbooking per clinic" |
| — | Blocks, leave, extra hours, holidays, day plans | Schedules (timeline, Weekly hours) | `POST …/exceptions` (+ `/preview`), `POST /v1/facilities/:id/holidays`, revoke routes, `PUT …/day-plans/:date` | api "facility scope of schedule changes", "schedule scope, reads and reversals", "weekly plan replacement" |
| F8 | A doctor leaves a clinic | Appointments (cancel/move), Schedules (end hours), Doctors → Stop working here | `POST …/cancel` → `PUT …/weekly-plan` with no sessions → `POST /v1/practitioner-affiliations/:id/end` | flows F8 |
| F9 | Switch a clinic off | Hospital catalogue → Edit details → Active | `PATCH /v1/facilities/:id` `{status: inactive}` (refused while visits/hours remain, or for the last clinic) | flows F9; catalog "opening a clinic…" |

## Running the day (front desk, nurse, doctor)

| # | Flow | Screen | API, in order | Test |
|---|---|---|---|---|
| F3 | Register a patient and book them | Appointments → Book appointment (Register a new patient) | `GET /v1/patients?q` → `POST /v1/patients` → `GET …/slots` → `POST /v1/holds` → `POST /v1/appointments` | flows F3 |
| F3 | Book a phone caller who isn't registered | Appointments → Book appointment → Book for a caller who isn't registered | `POST /v1/holds` → `POST /v1/appointments` with `bookingParty` | flows F3 |
| — | Book from the timeline | Schedules → drag a slot → Appointment | `GET …/slots` → `POST /v1/holds` → `POST /v1/appointments` (same idempotency key on retry) | api "the booking journey"; schedule adapter |
| F5 | Correct a patient's details | Patients → patient → Edit details | `GET /v1/patients/:id` → `PATCH /v1/patients/:id` (version) | flows F5; catalog "patient details (G24)" |
| F6 | Move a visit; cancel one | Appointments → Open → Move appointment / Cancel appointment | `POST /v1/holds` → `POST …/reschedule`; `POST …/cancel` (reason) | flows F6 |
| — | Waitlist: add, offer a slot, accept/decline, withdraw | Waitlist | `POST /v1/waitlist` → `POST …/offer` → `POST /v1/waitlist-offers/:id/accept|decline`; `POST …/withdraw` | api "waitlist (G11)" |
| F7 | Arrival: link the caller to a record, check in, consult, finish | Appointments → Check in; Queue; Consultations | `POST /v1/patients` → `POST …/check-in` (patientId) → worker opens encounter → `GET /v1/encounters` → `POST …/start` → `POST …/finish` → worker completes the appointment | flows F7; clinical.test (vitals, notes, diagnoses, allergies) |
| — | Walk-in | Queue → Walk-in | `POST /v1/walk-ins` | api "walk-ins join the queue" |
| — | Video consultation | Teleconsultations | `POST …/teleconsult/link`, `POST /v1/teleconsults/:id/start|join|end` | telehealth.test |
| — | Daily overview, operations events | Overview, Operations | `GET /v1/operations/summary`, `GET /v1/operations/events` | api "operations summary" |
| — | Activity log and export | Activity log | `GET /v1/audit-events`, `POST /v1/audit-events/export` | access "activity log (G18)" |
| — | Review emergency (break-glass) access | Activity log → Break-glass review | `GET /v1/break-glass` → `POST /v1/break-glass/:id/review` | records "M01 administration" |
| — | Patient overview: details, related people, duplicates; history: flags/NKA and read-only external identifiers | Patients → patient → Overview / Medical history | Patient and registry reads; related/duplicate/flag routes. Consent/identity-entry/care-assignment controls removed in desktop UX review; backend APIs retained | records "M02 registry" |
| — | Find and merge duplicates | Patients → Duplicate queue | `POST /v1/patient-links` → second person `…/decide` → third person `…/unmerge` | records "duplicates" |
| — | Triage, immunizations, care plans, referrals, MLC, births and deaths | Consultations → encounter | `/v1/encounters/:id/triage|immunizations|care-plans|referrals|mlc|births|death` and their follow-ups | records "M05 records" |
| — | Nurse writes and signs a nursing note | Consultations (nurse) | `POST …/notes` (`nursing`) → `POST /v1/notes/:id/sign` | records "nursing notes (G27)" |
| — | Explicit messaging contact and consent; withdraw or STOP | Patients → patient; Appointments → Open | GET/POST /v1/contact-points → POST /v1/contact-points/:id/consents; GET /v1/comms/capabilities | comms.test.ts; frontend comms contract tests; synthetic browser contact/opt-in readback |
| — | Configure local reminder rules | WhatsApp → Follow-ups → Configure | GET /v1/comms/followup-rules → PUT …/:kind (version, facility, Idempotency-Key) | comms rules tests; browser save/reopen |
| — | Requested follow-up for completed visit | WhatsApp → Follow-ups → completed visit and clinic contact date | GET /v1/appointments (explicit clinic dates) → POST …/:id/followup (version, dueAt, Idempotency-Key) → GET /v1/outbound-messages | comms follow-up tests; browser persisted readback |
| — | Local notification history and counts | WhatsApp → Overview / Delivery history | GET /v1/comms/summary; GET /v1/outbound-messages (filters/cursor) | comms paging/summary tests; browser history |
| — | Appointment notification history | Appointments → Open; Schedules → Resolve | GET /v1/appointments/:id/messages | comms.test.ts; browser showed missing-consent and scheduled local states |
| — | Virtual extra hours and exact-time moves | Original Schedules sheets | POST …/exceptions with visitMode → GET …/slots → holds/booking; range hold → reschedule | schedule-acceptance.test.ts; frontend schedule-source.test.ts |
| — | Exact-time booking | Schedules → drag any range | `POST /v1/holds/range` → `POST /v1/appointments`; `GET /v1/request-outcomes/:key` after a lost response | records "board, range holds" |

## Remaining module UI and excluded domains

WhatsApp now mounts all seven original tabs through typed scoped routes: conversations/cases/local replies, doctor content/private uploads, campaign preparation, rules/history and clinic details. Voice, Google Business and Growth original bodies are mounted; no operational PendingModule remains. Loyalty and Patient journey remain labelled concepts. The new flow cases are exercised in `comms.test.ts`, `whatsapp.test.ts` and `voice-growth.test.ts`; original `flows.test.ts` retains F1–F9. Provider delivery, production storage and real runtime/analytics acceptance remain documented in [current progress](STAFF_MODULE_PROGRESS.md) and [completion guide](BACKEND_COMPLETION_GUIDE.md). G28–G33 remain out of scope. Browser walkthroughs: [REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md).

## Additional staff module flows

| Person / flow | Typed routes | Evidence boundary |
|---|---|---|
| Front desk reception, assign/close/local reply or issue/feedback case | `/v1/conversations`, `/v1/support-cases` | Signed inbound opens the reply window; case creation never invents inbound. Local queue only |
| Administrator private content and campaign review | `/v1/comms/assets`, `/v1/message-templates`, `/v1/campaigns` | Private local bytes, declared marketing interests/consent, reviewed configured local test, atomic budget. No Meta approval/send |
| Staff Voice history/transcript; administrator private recording/access | `/v1/voice-calls`, `/:id/transcript`, `/:id/recording`, `/v1/voice-recording-access` | Scope, separate consent/expiry and audit; normalized external runtime, no telephony |
| Administrator manual booking destination | `/v1/booking-links`, `/v1/facilities/:id/booking-link`, `/v1/booking-links/changes` | Approved host, version/actor audit; Google publishing manual |
| Staff Growth review | `/v1/growth/summary`, `/v1/growth/website-activity` | Logical visits/clinic time, empty ratios null, acquisition unavailable, PostHog optional scoped aggregates |

Desktop UX update (12 October): registered patients can use **Start visit now** with existing encounters.manage + clinical.read + patients.read to open an outpatient clinical visit. For a doctor, the UI selects their own identity. It creates no future reservation or queue token. Existing idempotent POST /v1/encounters and start/notes/sign/finish routes are retained. Own-doctor schedule booking/blocking remains a server-authorization TODO, UX-B01 in BACKEND_WORK_LEDGER.md.

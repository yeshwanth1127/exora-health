# First staff-module implementation checkpoint

12 October 2026, local working tree from `6713e01` on `codex/staff-frontend-integration`. The product owner authorized implementation with two subagents. This is the first bounded wave of the [module decisions](STAFF_MODULE_DEVELOPMENT_DECISIONS.md), not completion of all communications modules.

## Completed

- **G05:** original weekly-hours Resolve actions retain the proposed draft. Cancelling/moving refreshes the board without unmounting the editor; a fresh server review controls Save.
- **G06:** extra-hours exceptions carry `in_person` or `virtual`. Slot generation selects a matching service; booking virtual extra hours follows normal teleconsultation creation.
- **G08:** exact-range rescheduling has persisted HTTP acceptance for predecessor cancellation/reservation release, replacement linkage/readback, idempotent replay and overlap refusal. The original frontend adapter is tested.
- **G19 first slice:** tenant/facility-scoped WhatsApp contacts with exactly one patient/caller owner; explicit purpose/evidence consent; address-wide STOP across duplicate and later contacts; withdrawals persist while suspended. Phone possession never grants consent.
- Booking confirmation, reschedule, cancellation and day-before jobs persist with deduplication and stale-event checks. The worker rechecks appointment, contact, consent, expiry and module state. Current outbound records are **local only**: zero provider attempts, no sent/delivered states and no provider credentials involved.
- **G25 first slice:** shared Zod request/response/event schemas in `packages/contracts`, used by routes and frontend decoders. Invalid responses fail closed.
- Existing Appointments and Patients expose authorized contact/consent controls. Appointment details and the original Schedules appointment-actions sheet show notification history, with scheduled, cancelled, skipped and queued-locally states. Existing monochrome components are retained.

## Implemented routes

| Route | Permission / behavior |
|---|---|
| `GET /v1/comms/capabilities?facilityId` | `comms.read`; module readiness, log transport, `liveSending=false` |
| `GET /v1/contact-points?facilityId&patientId` or `bookingPartyId` | `comms.read` plus owner-domain access; full address only with scoped `comms.reply` |
| `POST /v1/contact-points` | `comms.reply` plus owner-domain access; idempotent; no implicit consent |
| `POST /v1/contact-points/:id/consents` | Care/reminder opt-in or any withdrawal: `comms.reply`; marketing opt-in: `comms.manage`; owner-domain access required |
| `GET /v1/appointments/:id/messages` | Both `appointments.read` and `comms.read` at the actual facility |
| `GET /v1/outbound-messages?facilityId` | `comms.read`; current bounded notification-job projection with optional local outbound record, at most 100 rows; status filters/cursor pagination remain pending |

Patient owners additionally require `patients.read`; caller owners require `appointments.read` and a booking at that facility. The server derives the actor. New role `mod_comms` follows forced tenant RLS, composite tenant foreign keys, append-only consent evidence and existing audit/outbox transactions.

## Still remaining

**G19 stays PARTIAL:** waitlist-offer events/readback, same-day/follow-up configuration, templates, channel accounts, real sending, claim/unknown-outcome handling, signed webhooks/receipts, delivery-history filtering/pagination and Overview/Operations counts. Enabling a future provider must not flush old local records automatically.

**G20–G22 stay pending:** original WhatsApp seven tabs and their inbox/cases/content/campaigns; staff Voice history/runtime ingestion; manual Google links/internal growth and optional PostHog. Storage and provider readiness will be implemented with the owning slice. **G25 stays PARTIAL:** add shared schemas with each new route.

Loyalty remains a labelled concept. No billing, pharmacy, inventory, diagnostics, inpatient, general documents, public booking bot, public Voice launcher or telephone infrastructure was added. Full status is in [BACKEND_WORK_LEDGER.md](BACKEND_WORK_LEDGER.md); remaining requirements are in [BACKEND_COMPLETION_GUIDE.md](BACKEND_COMPLETION_GUIDE.md).

## Verification and limits

- Backend: **18 files / 217 tests pass** (199 existing + 3 schedule acceptance + 13 communications + 2 shared-contract tests).
- Frontend: **31 tests pass** (25 existing + 2 schedule-source + 4 communications tests, including cancelled/scheduled local-record labels).
- Backend/frontend TypeScript and frontend production build pass. Lint: **0 errors, 18 existing warnings**. Existing bundle-size warning remains.
- Both new migrations applied; both rolled back on the dedicated test database and reapplied successfully. Database types regenerated. A verification schema dump is saved outside the checkout at `/tmp/hms-new-module-proof/schema.sql`; migrations remain the versioned source.
- Separate Postgres on **54349** with synthetic fixtures; no reset of the existing preview database. API **3049**, Vite **5198**, worker running. The browser verified explicit contact creation with all consent purposes initially false, affirmative reminders opt-in with persisted readback, and front-desk marketing opt-in restrictions.
- Browser Resolve → cancel → fresh review retained **10:00–13:00** and enabled Save. The reviewed weekly draft was not committed during this check. Appointment cancellations were synthetic fixtures on the isolated database.
- No live provider sends, production deployment, OIDC/provider acceptance or real video call verification. No commit or push performed.

Reproduce automated checks from the app root using the existing package scripts and a verified disposable database URL; see [REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md). The local test server uses its own `PG_PORT`, data directory and admin/app/test URLs. Do not run `db:reset` against an existing workspace or deployed database.

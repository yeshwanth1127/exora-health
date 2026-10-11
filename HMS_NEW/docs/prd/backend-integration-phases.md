# PRD: Backend work for the staff frontend, in phases

Status: approved for execution by the product owner on 2026-10-11 ("plan out the backend work in phases … execute these phases").
Source of gaps: `docs/plan/BACKEND_WORK_LEDGER.md` (G01–G40). Schema authority: `docs/design/erd-v2`.

## Problem

The staff frontend is connected to every existing route, but the backend still has:
- security holes: schedule changes authorized without the affected facility
- lifecycle gaps: an encounter can be cancelled while its appointment and queue token stay open
- missing contracts the original UI needs: clinic blocks, overbooking, schedule reads and reversals, fee reads

## Goal

Close the security and lifecycle gaps first, then add the missing scheduling and booking contracts, and connect each one to the frontend. Every phase keeps the rules the rest of the backend already enforces.

## Rules every phase follows

| Rule | How it is applied |
|---|---|
| RBAC by facility | Each route authorizes the permission for the facility the change affects, never "any grant". A change that reaches several facilities needs the permission for every one of them (`authorizeEvery`). |
| Care relationship | Chart reads and writes still go through `assertChartAccess` / `ensureEncounterAccess`; break-glass is still audited. |
| One write path | Writes go through `runCommand` (tenant and actor context, module write role, audit and outbox in one transaction). Creating commands take `Idempotency-Key`. |
| ERD first | Schema changes update `docs/design/erd-v2` in the same commit as the migration. Migrations are forward-only. |
| Tests | Each fix has an HTTP test that fails without it. The full suite (`PG_PORT=54339 npx vitest run`), root typecheck and the frontend checks pass before each commit. |
| Commits | One local commit per phase on `codex/staff-frontend-integration`. No push. |

## Phases

### Phase 1: Security and lifecycle (no schema change)

| Gap | Change |
|---|---|
| G01 | Every calendar route resolves the facilities it affects before authorizing. Covered routes: create calendar, weekly sessions, end session, leave, blocks, extra hours, holidays, day plans, and session and slot reads. Facility-scoped readers only see their facilities' sessions and slots. |
| G35 | Nurse self-join is idempotent; there's no 409 or rollback. |
| G38 | An encounter that belongs to an appointment is cancelled through the appointment, which already cascades to the encounter and token. Cancelling an unscheduled encounter now checks care access. |
| G40 | Only the author can mark a note entered in error. |
| G15 | A queue token can't be completed while its consultation is open; finishing the encounter completes it. |
| Privacy | API request logs keep the path only, so patient names and phones in search queries never reach the logs. |

### Phase 2: Schedule contracts (migration and ERD m04 update)

| Gap | Change |
|---|---|
| G37 | `schedule_exception` `closed` and `block` may carry `facility_id`. A clinic block hides only that clinic's slots and is authorized against that clinic. An all-clinic block keeps the Phase 1 rule. |
| G06 | List a practitioner's exceptions and a facility's holidays. Revoke either with a reason (`revoked_at`, `revoked_by`, `revoke_reason`; revoked rows are ignored by `sessions()` and `available_slots()`). The change is audited. |
| G07 | Read the weekly plan and the current day plan with its revision. Saving a day plan accepts `baseRevision` and returns 409 when it's stale, so retries can't append duplicate revisions. |
| G05 (read part) | Preview the appointments a proposed closure or block would affect, without saving anything. |
| Frontend | Connect the Schedules page writes, which stayed unwired until G01 was fixed. |

### Phase 3: Overbooking per clinic (migration, seeds and ERD m01/m04 update)

| Item | Decision |
|---|---|
| Switch | `platform.config_setting` key `booking.overbooking`, scoped to a facility, default off. Only administrators (`config.manage`) can turn it on or off for their clinic. |
| Permission | New permission `appointments.overbook`, held by `tenant_admin` and `front_desk`. Both the clinic switch and the permission are needed. |
| Cap | At most 3 overbooked appointments per doctor session. The cap is enforced under the resource row lock, so concurrent requests can't exceed it. |
| Allocation | Reservation status `overbooked` sits outside the `EXCLUDE` predicate, so the no-double-booking guarantee for held and booked slots is unchanged. Overbooking needs a reason (NOT NULL) and is allowed only into a taken slot of a published session at that clinic, never into a blocked or closed slot. It's audited. |
| Lifecycle | Cancel, reschedule and no-show work as for a normal booking. |
| Frontend | The overbook action appears only when the clinic switch is on and the user holds the permission. |

### Phase 4: Directory and read contracts

| Gap | Change |
|---|---|
| G13 / G14 read | Read departments, services and consult rooms. Get a booking quote (fee from the active price list for a doctor, service and date). The Doctors page shows that fee read-only. |
| G39 | Note templates carry `propertyOrder`. |
| G03 | Appointment search across name, phone, MRN and confirmation code, with cursor paging. |

### Deferred (each needs its own PRD)

| Gaps | Reason |
|---|---|
| G11 waitlist | Offers need patient delivery (G19), which doesn't exist yet. |
| G16–G18 | Staff, roles, settings and audit administration. |
| G20–G23 | Communications and growth modules. |
| G24 | Patient demographics updates. |
| G27 | Nursing attestation. |
| G28–G33 | Prescriptions, labs, billing, uploads, inpatient care and the public booking API. |
| G34 | Teleconsult consent document administration. |

Dropped:
- G09 staff notes: the original appointment annotation has no ERD table, and the appointment reason plus clinical notes cover the need.
- G10 archive: cancellation covers it.

## Out of scope

Changing role bundles beyond `appointments.overbook`, and production identity provider setup.

## Acceptance criteria

- Phase 1: a branch-scoped admin can't change another branch's sessions, leave, blocks or day plans; facility-scoped readers see only their facilities; the four lifecycle rules are enforced; tests prove each.
- Phase 2: a clinic-A block leaves clinic-B slots bookable; revoked exceptions and holidays stop applying; a stale day-plan save returns 409.
- Phase 3: with the switch off, overlap is rejected. With it on and the permission held, overlap is accepted with a reason and audited, and the fourth overbook in a session is rejected (including under concurrency). With it on but no permission, overlap is rejected.
- Phase 4: the fee shown equals the booked `fee_snapshot_minor`; SOAP fields render S, O, A, P; search pages deterministically.

## Security review of this session's frontend changes

Scope: `ClinicalRecords.tsx`, `Consultations.tsx`, `Patients.tsx`, `Queue.tsx`, `Doctors.tsx`, `model.ts`, `types.ts`.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | UI checks such as `can("clinical.write")` and `can("break_glass.use")` are hints only. The backend enforces the permission, care access and the author rule (now also for voiding, G40). | Info | No change needed |
| 2 | No HTML injection: all clinical text renders through React text nodes, with no `dangerouslySetInnerHTML` or `innerHTML`. | Info | No change needed |
| 3 | Tokens are kept in memory only; only the OIDC state uses `sessionStorage`. No patient data is written to browser storage. | Info | No change needed |
| 4 | Patient search puts names and phones in the query string. The browser keeps it out of history because this is a fetch, not a navigation, but the API request log recorded it. | Medium | Fixed in Phase 1 (log redaction) |
| 5 | Break-glass sends a reason of at least 10 characters and 1–24 hours, the same limits as the server. The request is idempotency-keyed, so a retry can't create two grants. | Info | No change needed |
| 6 | A vital correction isn't keyed, but a retry is safe: the server rejects correcting an observation that's already amended. | Low | No change needed |
| 7 | Allergy and problem status changes are PATCHes that set a state, so a retry is harmless. Each one asks for confirmation first. | Info | No change needed |
| 8 | The embedded chart in Consultations is read-only (`editable={false}`); edits happen only in the active encounter. | Info | No change needed |
| 9 | The fee input is read-only and never sent, so there's no client-side fee tampering path. Fees come from the server price list at booking. | Info | No change needed |

No high-severity issues were found in the frontend changes. The backend issues the review surfaced are G01, G15, G35, G38 and G40, all fixed in Phase 1.

## Security review of Phase 2

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Clinic blocks, extra hours and their previews are authorized at that clinic. Blocks without a clinic need `schedules.manage` at every clinic the doctor works at that day (`authorizeReach`). | Info | As designed |
| 2 | Revoking uses the stored row's scope, never the request body, so a guessed id can't widen reach. Cross-tenant ids are hidden by RLS (404). | Info | Tested |
| 3 | Weekly plans need `schedules.manage` at the target clinic and a practitioner affiliation on the start date. Replaced rules are withdrawn, never deleted. | Info | Tested |
| 4 | Weekly preview lists the doctor's hours at other clinics (clinic name, weekday, times), including clinics outside the caller's grant, so overlaps can be explained. It contains no patient data. | Low | Accepted |
| 5 | Exception, weekly-session and day-plan reads are filtered to the caller's facilities. All-clinic rows stay visible to any reader, the same as the Phase 1 rule for leave. | Info | As designed |
| 6 | The frontend enables saves only when the source can write. The backend still authorizes every call. Each click mints a new idempotency key; an in-flight request disables the button. Retrying after an unknown outcome is still open under G26. | Low | Open (G26) |

## Security review of Phase 3

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Overbooking needs `appointments.book` and `appointments.overbook` at the slot's clinic. The clinic is resolved from the slot on the server, and the command rejects the slot if it has moved to another clinic since authorization. | Info | Tested |
| 2 | The clinic switch is checked inside the booking transaction, against the slot's clinic. Turning it on or off needs `config.manage` at that clinic; a branch administrator can't change another branch. Each change is a new versioned row, and audited. | Info | Tested |
| 3 | The cap of 3 per session is counted under the doctor's resource row lock. Removing the lock lets 5 concurrent requests through, which the concurrency test catches. | Info | Tested |
| 4 | `overbooked` sits outside the `EXCLUDE` predicate, so holds and normal bookings still can't overlap. Overbooking is refused into free, blocked or unpublished time. | Info | Tested |
| 5 | Overbook requests require `Idempotency-Key`, so a retry can't use up two places. The frontend reuses one key per unchanged form. | Info | As designed |
| 6 | Overbook reasons are limited to 3–500 characters by both the API and a database CHECK, and render as React text. | Info | No change needed |
| 7 | `holdSlot` has the same gap as #1: it authorizes the slot's clinic, then re-reads the slot. A weekly-plan change that moves the slot to another clinic in between could let a hold land there. This is pre-existing and needs a concurrent schedule change at the same instant. | Low | Open, follow-up |

## Security review of Phase 4

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Directory and fee reads need `catalog.read` at the requested clinic. A branch-scoped user can't read another branch. | Info | Tested |
| 2 | Search terms are bound parameters. `%` and `_` are escaped, so a search can't widen into match-all. Request logs keep the path only (Phase 1), so names and phones in `q` aren't logged. | Info | Tested |
| 3 | The cursor is opaque but carries no authority: it is validated, and each page re-applies the caller's facility filter and permission. A tampered cursor returns 400. | Info | Tested |
| 4 | The fee read reuses booking's price lookup, so the quote can't drift from what is charged. Fees stay read-only in the UI. | Info | As designed |
| 5 | Template v2 is a new published version, not an edit, so signed notes keep the schema they were validated against. | Info | As designed |

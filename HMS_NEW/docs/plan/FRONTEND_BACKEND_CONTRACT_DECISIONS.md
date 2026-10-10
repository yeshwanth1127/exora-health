# Original UI and HMS_NEW contract decisions

11 October 2026. Scope: frontend work and documentation only. Backend implementation is owned by the user's dedicated agent.

## Assessment

The original visual design can mostly stay: monochrome/shadcn layout, timeline, sheets, filters, split shifts and navigation. Some data and workflow assumptions differ substantially. Full behavior parity is not established by making the old component render, and the backend must not be reshaped blindly to match old request payloads.

Most mismatches need explicit frontend translations or missing API/read models over existing domain tables. A smaller set requires product/domain decisions and potentially schema changes, especially overlapping reservations and clinic-specific blocks. No such decision is implemented in this pass. Existing API paths in the master plan marked “proposed” are proposals, not agreed or available contracts.

## Decision map

| Area | Original UI assumption | Verified HMS_NEW behavior | Preserve visually / change in flow | Contract or schema implication | Ledger |
| --- | --- | --- | --- | --- | --- |
| Weekly hours | Monday=0; Repeat until includes selected last day; grouped split shifts | Monday=1; effectiveTo excludes its date; weekly rules have service, room, mode, capacity and facility | Keep day groups and split ranges. Translate weekdays/end dates explicitly; do not discard fields not shown in the old editor | Translation is small; lossless typed read plus versioned atomic preview/commit is missing. No bulk replacement through separate end/add calls | G07, G25, G26 |
| Alternative offerings | Overlapping published hours can describe alternative clinics/modes | schedule_rule_no_overlap excludes overlapping rules for the same resource, weekday and effective dates across modes/facilities | Timeline lanes can stay; publishing overlapping alternatives is an unresolved capability | Domain/schema decision if alternative offerings are required. Preserve reservation/attendance protection | G07 |
| Exact-minute range booking | Drag any start/end, optionally overbook with a reason | /holds accepts slotStart; derives end from published availability; held/booked reservation periods cannot overlap for the resource | Keep range draft. Standard booking remains explicit slot selection; exact range needs its own checked command | New command for exact ranges; overlap is a separate capacity/allocation policy and may require schema changes. Never drop the no-double-booking constraint | G08, G26 |
| Blocking a clinic row | Block the selected doctor's hours at the selected clinic | Closed/block schedule exceptions require no facility and affect the resource across facilities; extra hours require a facility | Keep block sheet but explicitly show actual affected scope | Decide clinic-specific block model or explicit all-clinic leave flow. Current clinic-only label must not submit a practitioner-wide closure silently | G01, G06 |
| Schedule conflict review | Resolve affected visits before saving | Current exception/holiday commands return affected IDs after save; day-plan revisions lack client base revision | Keep review sheet and affected-visit list; keep Save disabled until review is meaningful | Atomic preview/commit with revision and conflict-token semantics; server validates again. Define whether commit rejects unresolved bookings | G05, G07, G26 |
| Patient and booking contact | Appointment carries patient name/phone directly | Appointment may have no patient yet; bookingPartyName/Phone identify the caller; check-in requires patient linkage | Show patient and booking contact separately, with link/register step when needed | Mostly frontend adaptation; narrowly scoped patient/contact read projection may be added. Never relabel caller demographics as verified patient data | G03, G24 |
| Rescheduling | Update the existing appointment row's time | New appointment replaces the old one; new ID links through rescheduledFromId | Keep edit sheet, show old-to-new history, refetch and follow returned ID | Preserve audited replacement semantics. Notes and teleconsultation links must follow the correct record | G08, G09, G19 |
| Virtual visits | Special virtual branch | visitMode on an appointment/session at a real facility | Keep visit-type selector and actual clinic selector | Frontend mapping/read completeness; do not fabricate a virtual facility to satisfy old filtering | G04, G07, G13 |
| Doctor fee | One editable rupee fee on a doctor | Booking fee snapshot is integer minor units from service/price-list rules; practitioner read has no fee | Preserve profile/pricing affordance, but identify service/mode/effective price if needed. Unknown is not zero | Existing pricing model needs quote/admin APIs; doctor fee must not become an unrelated mutable column or overwrite historical booking price | G13, G14 |
| Directory and affiliations | Doctor object contains departments and branches with IDs | Current directory gives facility affiliation and department names; full catalogue metadata is incomplete | Keep columns and filters. Current department-name keys are display-only | Stable department/service/room identifiers and affiliation/profile contracts before saving; no inferred IDs | G13, G14 |
| Permissions and accounts | Global role/allowed flags; built-in passwords | Facility-scoped permission lists, external OIDC and care-relationship checks | Keep account/permission layout, adapt login/password ownership and facility scope | Identity/grant and capabilities contracts; admin title cannot grant clinical access | G01, G02, G16, G17, G25 |
| Notes and visit completion | Reception notes and direct appointment completion | Clinical notes have authored signed versions; clinical encounter finish governs visit completion; operational notes lack API | Keep operational notes separately; clinicians finish care; reception manages arrival/queue | Administrative annotation contract and backend lifecycle fixes. Do not store reception notes as clinical narratives | G09, G15, G27, G35 |
| Delivery/readiness | Staff change may imply WhatsApp sent; modules may appear operational | Events alone do not establish a notification consumer or delivery result | Keep communication layouts, show actual manual/queued/delivered/failed state when available | Durable task/provider receipt contracts. Pending pages contain no fabricated activity or provider state | G19–G22 |

## User decisions, 11 October 2026

| Area | Decision | Backend ledger |
| --- | --- | --- |
| Overbooking | Overlapping bookings are allowed only when an administrator enables it **per clinic** (`platform.config_setting`, facility-scoped key, already in ERD M01). Default off; reasoned and audited; the no-double-booking path stays the default. | G36 |
| Clinic blocks | Both single-clinic and all-clinic blocks must exist, with the scope shown before saving. | G37, G01, G06 |
| Doctor fee | Read-only in the staff UI. Administrators change it through the price list; historical booking fees are never rewritten. | G13, G14 |
| Schedule writes | Stay unwired until G01 facility authorization is fixed. | G01 |
| Voiding another author's note | Not allowed: only the author marks a note entered in error; anyone else amends via the author or a future records-officer role. | G40 |
| Weekly hours, patient identity, rescheduling | Frontend translation only (no decision needed). | G07, G03, G08 |

## ERD v2 alignment check (11 October 2026)

Compared `docs/design/erd-v2` M01–M05 with `db/migrations` and the frontend.

**Aligned:** booking party vs patient, replacement appointments (`rescheduled_from_id`), walk-ins as `booking_kind='walk_in'` with a queue token, fee snapshot from pricing (doctor fee read-only), tenant-wide practitioner calendar, care assignment + break-glass (`emergency_access_grant`), versioned notes, waitlist tables (built, no API yet), `module_state` / `config_setting` for module switches and per-clinic settings.

**Decisions that need the ERD updated before backend work:**

| Item | ERD / schema today | Required change |
| --- | --- | --- |
| Overbooking (G36) | `reservation` EXCLUDE on (`resource`, `period`) for `held`/`booked` is a core invariant. The practitioner calendar is tenant-wide, so it also stops a doctor being booked at two branches at once | Keep the EXCLUDE. Add an explicit overbook reservation state outside the predicate (e.g. `status='overbooked'`, reason NOT NULL, facility NOT NULL), allowed only when the facility's `config_setting` enables it, and **never overlapping a booking at a different facility** (a doctor cannot be in two clinics). Document in m04-booking.md |
| Clinic-only block (G37) | ERD lists no facility on `schedule_exception`; migration CHECK forces `facility_id` NULL unless `extra_hours` | Allow `facility_id` on `block`/`closed` (NULL = all clinics). Update ERD and CHECK |
| Staff/reception notes (G09) | No ERD table. Clinical notes must not hold them | Add an administrative appointment note table to M04 (author, text, visibility, audit), or drop the feature |
| Overbooking/settings permissions | `appointments.overbook` not in permission seed | Add permission and seed |

**Minor schema-vs-ERD drift (document, no action needed):** `waitlist_entry` uses `preferred_from`/`preferred_to` plus `facility_id` instead of `preferred_dates daterange[]`; `schedule_exception` has `facility_id`, `healthcare_service_id`, `slot_minutes`; teleconsult added `tele_consent`, `tele_consent_document`, `tele_session_event` (documented in VIRTUAL_OPD_PLAN, not in ERD). Update the ERD to match.

**ERD tables not built yet (M05, planned in SCHEMA_PLAN phase 5+):** `triage_assessment`, `mlc_record`, `referral`, `care_plan`/`care_plan_activity`, `immunization`, `birth_record`, `death_record`. The UI has no screens for these; they are new backend scope, not divergence.

## Existing routes intentionally not wired

| Route | Reason |
| --- | --- |
| Seven calendar writes and `GET /v1/practitioners/:id/sessions` | G01 facility-scope hole; G05–G07 contract gaps |
| `POST /v1/encounters/:id/cancel` | G38: no consumer reconciles appointment/queue |
| `POST /v1/queue-tokens/:id/complete` | G15: bypasses the doctor's finish step |
| `POST /v1/encounters/:id/participants` | G35: self-join fails |
| `POST /v1/teleconsults/:id/consent` | G34: staff cannot read the consent document version |
| `POST /v1/encounters` | Encounters are opened by the check-in worker; a manual open would duplicate them |
| `GET /v1/appointments/:id/encounter`, `GET /v1/appointments/:id/teleconsult` | Covered by existing list/detail reads; no screen needs them |

## Required integration discipline

1. Tie each form/action to a UI parity ID and backend ledger ID. Preserve the original UI intent before choosing DTO shape.
2. Agree request, response and error examples with explicit units, nullability, timezone, IDs, facility/care scope, status transitions and replacement-record behavior. Publish shared runtime-validated schemas; packages/contracts currently contains a README, not an implemented shared contract package.
3. For schedule edits, specify preserved service/room/capacity/mode fields, base revision, affected records, atomic commit, replay/idempotency and conflict behavior. UI-local types are not a substitute for this contract.
4. Record domain choices for overlap, alternative offerings, clinic-only versus all-clinic blocks, doctor pricing and account ownership before enabling their controls. A missing route is different from a schema mismatch; label both accurately.
5. Test accepted/rejected examples and real persisted round trips, including concurrent booking/schedule edits and cross-facility occupancy. A successful build or partial timeline is insufficient evidence for write integration.
6. Restore full module bodies and connect them incrementally against those accepted contracts. Pending navigation is not full UI parity. Keep unknown saved state explicit and unsupported writes blocked until their backend contract is delivered.

Frontend adapters may translate presentation, names, dates and units; they must not synthesize clinical identity, authorization, saved state, delivery outcomes or reservation capacity. The current timeline adapter is a temporary partial read projection, not the final calendar contract.

## Source evidence

- apps/staff-web/src/modules/weekly-hours.tsx and clinic-types.ts: original weekday, repeat-date and split-range behavior.
- apps/staff-web/src/modules/schedule-range-actions.tsx and appointment-actions.tsx: arbitrary range, overbooking and move assumptions.
- apps/staff-web/src/hms/types.ts: current frontend DTOs mirror the available API projection; they remain frontend-local.
- db/migrations/20261010100800_m04_booking_kernel.sql: exclusive effective_to, schedule_rule_no_overlap, exception facility constraint and reservation_no_double_booking.
- apps/api/src/http/routes/calendar.ts and booking.ts: actual route inputs; apps/api/src/modules/booking/calendar.ts, appointments.ts and read.ts: calendar mutations, replacement appointments and current read fields.
- packages/contracts/README.md and file inventory: intended shared contracts package has no implemented schemas yet.
- [Master plan](STAFF_FRONTEND_INTEGRATION_MASTER_PLAN.md): independently audited detailed contract/lifecycle findings.
- [Backend ledger](BACKEND_WORK_LEDGER.md): implementation ownership and all 40 open backend areas.
- [UI parity ledger](ORIGINAL_UI_PARITY_LEDGER.md): 53 feature groups and the current restoration boundary.

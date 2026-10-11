# Missing backend work ledger

Schema/workflow review: [frontend/backend contract decisions](FRONTEND_BACKEND_CONTRACT_DECISIONS.md). Preserve the original design while resolving incompatible semantics before enabling writes.

Last reviewed: 11 October 2026 (Asia/Kolkata).

**All 40 backend work areas remain open.** This frontend integration does not implement or close backend gaps. Existing APIs are used where possible; limitations below are intentional until the matching work is completed.

**Current task boundary:** frontend work only. Backend implementation belongs to the dedicated backend agent; this task documents gaps without changing backend code or schema. [Original UI parity ledger](ORIGINAL_UI_PARITY_LEDGER.md) tracks 53 feature groups and their restoration.

Canonical machine-readable ledger: [backend-gap-backlog.csv](staff-integration-audit/backend-gap-backlog.csv). Architecture/source audit: [master plan](STAFF_FRONTEND_INTEGRATION_MASTER_PLAN.md).

## Connected frontend status

Source is imported into `HMS_NEW/apps/staff-web`, with monochrome styles/components and original modules preserved. The new entry point calls `/v1` directly using typed frontend DTOs; legacy Python API calls remain disconnected. Original scheduling components now use a frontend presentation adapter; other full modules still await porting/wiring. Sign-in, facility context, patient search/registration, strict-slot booking/rescheduling/cancellation/check-in, queue, consultation worklist, physician notes/finish, patient chart and read-only directory/slots are connected. A synthetic visit and walk-in were verified in the browser and isolated PostgreSQL; see [integration checkpoint](STAFF_FRONTEND_INTEGRATION_CHECKPOINT.md). Teleconsultation worklist/link and patient consent-document display are also connected. Allergy add/status, problem status, vital correction, note templates, note entered-in-error (author only), break-glass emergency access and queue start-serving are connected and were round-tripped on synthetic data on 11 October.

Status convention: **DEFERRED** means backend implementation has not started. A frontend workaround does not close a backend issue. Close an item only after its contract, authorization, persistence, worker/race checks, and appropriate UI acceptance pass.

## Open backend work

| ID | Priority | Required work | Current frontend handling |
| --- | --- | --- | --- |
| G01 | P0 | **DONE (Phase 1)** Facility authorization of scheduling reads/writes: every calendar route resolves the facilities it affects (rule facility, doctor's affiliations for leave/blocks, day-plan reach) and requires the permission for each; facility-scoped readers see only their facilities' sessions/slots. Tests in `api.test.ts` | Schedule writes can now be wired (Phase 2). |
| G02 | P0/P1 | Session context metadata; proposed GET `/v1/session-context`, GET `/v1/me/tenants` | Memory-only identity and permissions; single-tenant context works. Multi-tenant fallback lists authorized IDs until names API exists. |
| G03 | P0 | **DONE (Phase 4)** `GET /v1/appointments` takes `q` (patient/booker name, phone digits, MRN, confirmation code; wildcards literal) and keyset `cursor`/`nextCursor` in visit order | Appointments page searches on the server and pages 100 at a time. Schedules board still reads one day up to 500. |
| G04 | P1 | Proposed GET `/v1/calendar-board?facilityId&date&staffId` | Original timeline restored with scoped free slots and loaded bookings; complete board/holds/closures/history remain missing. |
| G05 | P1 | **PARTIAL (Phase 2)** Block/closure preview (`POST /v1/practitioners/:id/exceptions/preview`) and weekly-plan preview return affected appointments without saving; saves recheck and return 409 `affected_appointments`. Holiday preview and in-sheet conflict resolution remain | Block and weekly sheets show affected visits from the server before saving. |
| G06 | P1 | **DONE (Phase 2)** `GET /v1/practitioners/:id/exceptions`, `GET /v1/facilities/:id/holidays`, `POST /v1/schedule-exceptions/:id/revoke`, `POST /v1/facility-holidays/:id/revoke` (reason, audited; revoked rows ignored by slots). Virtual extra hours still need a visit mode on exceptions | Timeline shows blocks/closures/holidays; unblock asks for a reason. Virtual extra hours stay disabled. |
| G07 | P1 | **DONE (Phase 2)** `GET weekly-sessions`, `POST weekly-plan/preview`, `PUT weekly-plan` (withdraws/trims replaced rules, keeps service/room/walk-in, cross-clinic collisions → 409), `GET day-plans/:date`; day-plan save takes `baseRevision` → 409 `stale_revision` | Weekly editor reads, previews and saves. |
| G08 | P1 | Proposed POST `/v1/staff-bookings/check`, POST `/v1/staff-bookings`, POST appointment `/move-range` | Strict-slot holds/book/move connected; original exact-minute form is draft only, with Save disabled. |
| G09 | — | **DROPPED** (user decision 11 Oct): no ERD table; appointment reason and clinical notes cover the need | Staff-note field removed from the UI inventory. |
| G10 | P1 conditional | Optional appointment archive/entered-in-error command and filter | Cancel with retained history; no Delete or fabricated archive. |
| G11 | P1 | Proposed `/v1/waitlist`, entry offers/withdrawal and accept/decline | Waitlist controls deferred. |
| G12 | P1 | **DONE (Phase 5)** `GET /v1/operations/summary?facilityId&date` (`appointments.read` at that clinic): totals, status/channel mix, doctors with published hours, live holds, 14 clinic-local days of bookings, ten latest bookings; message/voice counts `null` until G19/G21 | Original Overview mounted on it. Operations (event outbox, readiness) still pending. |
| G13 | P0 read/P1 write | **PARTIAL (Phase 4)** `GET /v1/facilities/:id/directory` (departments, services, consult rooms) and `GET /v1/practitioners/:id/fees` (booking quote). Observation definitions and directory writes remain | Fee read connected on Doctors. The directory read is available to screens but not yet consumed. |
| G14 | P1 | **PARTIAL (Phase 4)** Fee read per practitioner/service/mode, priced as booking prices it (equals `fee_snapshot_minor`). Profile, affiliation, registration and price-list administration remain | Doctors page shows fees read-only. Profile changes are local drafts. |
| G15 | P0 | **PARTIAL (Phase 1)** Queue complete is refused while the consultation is open (`encounter_open`); finishing the encounter completes the token. Remaining: start sync between token and encounter, nurse/admin completion authority | No queue-complete shortcut; doctor finishes clinical encounter. |
| G16 | P1 | Proposed staff accounts, roles/grants and care-assignment administration | Workspace permissions read-only; account/grant editors deferred. |
| G17 | P1 | Proposed GET/PUT module/config settings | Original navigation restored with Pending status pages; unsupported module/config writes remain unavailable. |
| G18 | P1 | Proposed GET `/v1/audit-events`, bounded export, break-glass review | Audit/export/review controls deferred. |
| G19 | P1 manual/P2 provider | Patient-change notification/readback contract and communications worker | Manual-contact notice after booking/move/cancel; no queued/delivered claim or durable backend task yet. |
| G20 | P2 | WhatsApp administration/inbox/assets/campaign module | Original WhatsApp/inbox/campaign source preserved but not mounted. |
| G21 | P2 | Voice session/config/transcript/recording/access module | Original voice source preserved but not mounted. |
| G22 | P2 | Google/growth read and admin module | Original growth source preserved but not mounted. |
| G23 | P2 conditional | Membership/benefits module | Original membership concept preserved but not mounted. |
| G24 | P1 | Patient demographics/contact updates, flags and general consent | Patient registration/search/detail connected; updates/flags/general-consent editor deferred. |
| G25 | P1 | Machine-readable/shared request/response contracts | Frontend-local safe DTOs implemented; shared backend contract package still missing. |
| G26 | P0/P1 | **PARTIAL (Phase 2)** Calendar creates accept `Idempotency-Key`; day plans are revision-checked. Outcome-unknown lookup for calendar writes remains | Calendar writes send a key per attempt; retry after an unknown outcome still mints a new key. |
| G27 | P0 when nursing notes enabled | Note-type-scoped nursing attestation or explicit co-sign contract | Nurse vitals enabled; nursing-note creation/signing deferred. |
| G28 | P2 / separate scope | Prescriptions and medication reconciliation | No prescribing controls; clinical note is not a prescription |
| G29 | P2 / separate scope | Lab/imaging orders and results | No ordering or result-review controls |
| G30 | P2 / separate scope | Billing/invoices/payments | Booked fee shown only; no invoice or paid-state claims |
| G31 | P2 / separate scope | Document uploads | No attachment/upload controls |
| G32 | P2 / separate scope | Inpatient/admission/bed operations | No admission or bed-allocation controls |
| G33 | P2 / separate scope | Separate public website booking API | Old public book/talk entry points excluded from staff build |
| G34 | P1 before real video pilot | Staff consent-document metadata and audited publication/retirement administration | Patient reads exact backend document; staff verbal-consent UI deferred. Sample seed consent is for local preview. |
| G35 | P0 nursing workflow | **DONE (Phase 1)** Self-join is idempotent; repeat is harmless, one participant row | Self-join control can return. |
| G36 | P1 | **DONE (Phase 3)** Per-clinic overbooking: `config_setting` key `booking.overbooking` (facility, default off, `PUT /v1/facilities/:id/overbooking` needs `config.manage` there); `appointments.overbook` (tenant_admin, front_desk); `POST /v1/appointments/overbook` into a taken, unblocked slot of a published session; reservation status `overbooked` outside the EXCLUDE, reason required and audited; at most 3 per session under the resource lock (concurrency-tested) | Schedules: clinic switch for administrators; "Add another appointment at this time" on a booked visit asks for a reason. |
| G37 | P1 | **DONE (Phase 2)** `closed`/`block` exceptions may carry `facility_id`; a clinic block hides only that clinic and is authorized there; omitting it keeps the all-clinic rule (G01) | Timeline blocks apply to the current clinic. An all-clinics option in the sheet is not offered yet. |
| G38 | P1 | **DONE (Phase 1)** An encounter linked to an appointment is cancelled through the appointment (which cascades); direct cancel returns 422 `cancel_appointment`. Unscheduled encounter cancel now checks care access | Encounter cancel not exposed. |
| G39 | P2 | **DONE (Phase 4)** System templates v2 carry `propertyOrder`; v1 retired (published versions stay immutable, old notes still validate) | SOAP renders S, O, A, P. |
| G40 | P1 | **DONE (Phase 1)** Only the author may mark a note entered in error (403 otherwise) | Entered-in-error offered to the author only. |

## Next backend tranche

Start with G35 nursing self-join (reproduced), G01 facility scope, G03 server worklist query/paging, G13 directory/quote/observation definitions, G15 queue/encounter consistency, and G27 nursing attestation. Then G04–G09 unlock the selected advanced timeline and its editor sheets. G26 requires server support as well as frontend handling.

## Deferred frontend/provider acceptance

- Production OIDC requires a registered client, issuer/audience/scopes and callback origin matching the API. Wiring can be present while provider sign-in remains unverified.
- Original timeline and weekly/range controls are visible again. Complete board data and persisted edits still require G04–G09.
- Admin user/grant/config/audit screens need G16–G18.
- Virtual OPD requires separate real-provider/video acceptance; local token/state tests are not proof of a completed video visit.
- Existing observation correction, allergy/problem editing, note entered-in-error, emergency access and template APIs still need their respective frontend flows and acceptance. These are UI work remaining, not newly missing backend endpoints.
- Prescriptions, billing, labs and inpatient workflows need the separate backend work listed above.
- Production deployment, real OIDC, consent approval and real video calls remain unverified.

## Change log

- 2026-10-11 (Phase 1): G01, G35, G38, G40 done; G15 partial; G09 dropped; request logs no longer record query strings. Plan: `docs/prd/backend-integration-phases.md`.
- 2026-10-11 (later): user decisions recorded (overbooking admin toggle, clinic-specific blocks, read-only fee, schedule writes wait for G01). Wired every remaining safe existing route; added G36–G40. No backend code changed.

- 2026-10-10: 27 source-audited gaps recorded in the master plan.
- 2026-10-11: imported selected dirty staff source; began connecting existing APIs; added UI-handling/status fields and G28–G33 future-domain/public API gaps. No backend domain behavior changed.

- 2026-10-11: connected core daily operations, walk-in and teleconsultation surfaces; synthetic browser/database visit passed. Added G34 from the staff verbal-consent/document publication integration gap. All 35 backend areas remain deferred.

- 2026-10-11: reproduced G35 in the browser/API/database; self-join rolled back. Removed its failing UI control and recorded [the reproduction](staff-integration-audit/nursing-self-join-receipt.json). All 35 backend areas remain open.

- 2026-10-11: user assigned backend implementation to a dedicated agent. This task restored original frontend schedule/editor details and pending navigation; recorded 53 UI feature groups. Backend implementation remains deferred.

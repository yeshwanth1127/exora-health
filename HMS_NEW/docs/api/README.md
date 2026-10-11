# HMS_NEW API (v1)

Backend only; no UI yet. JSON over HTTP. Start locally with `pnpm api:dev` (port 3000) and `pnpm worker:dev`.

## Authentication
Every `/v1` request needs `Authorization: Bearer <token>`.

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
Each endpoint needs one permission, checked **for the facility involved** (a role granted for one branch doesn't work at another). `GET /v1/me` shows the caller's permissions and their facility scope (`*` = all facilities).

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
| `POST /v1/practitioners/:staffId/exceptions` | `schedules.manage` | Leave (`closed`), `block`, `extra_hours`; returns clashing appointments |
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

### Diagnostics (orders, laboratory, imaging)
ERD [m06-diagnostics](../design/erd-v2/m06-diagnostics.md). An optional module: while `diagnostics` is suspended (`PUT /v1/modules/diagnostics`) every write below is refused with 422 `module_inactive`; reads keep working. "+ care" = the caller also needs a care relationship with the patient. Reads that return results are audited (`view`).

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/orderables?facilityId&q&category` | `orders.place` @ facility | Orderable services (lab tests, panels, imaging, procedures…; not consultations, bed days, packages) |
| `GET /v1/order-sets?facilityId` | `orders.place` @ facility | Your personal sets and the clinic's department sets, with items |
| `POST /v1/order-sets` 🔑 | `orders.place` (personal) · `order_sets.manage` @ department's clinic | Create a set (`departmentId` null = personal) |
| `PATCH /v1/order-sets/:id` · `POST /v1/order-sets/:id/retire` | same as create (owner only for personal sets) | Rename / replace items (`version`); retire (never deleted) |
| `POST /v1/encounters/:id/orders` 🔑 | `orders.place` @ facility + care | Requisition `RQ/{year}/{n}` with items (or `orderSetId`), `priority` (`routine`/`urgent`/`stat`), `clinicalIndication`. Panels expand into child tests; imaging items get a study (accession `{modality}{yy}{n}`, DICOM study UID). Emits `order_item.placed`. Encounter must be open |
| `GET /v1/encounters/:id/orders` | `results.read` @ facility + care | Orders → items (panel tests nested) → specimens, current results, report (current version + acknowledgements), imaging study |
| `POST /v1/order-items/:id/cancel` | `orders.cancel` @ facility + care | Cancel (reason) before any result; a panel cancels its tests; the last item cancels the order. Emits `order_item.cancelled`. 422 `already_resulted` after results |
| `POST /v1/specimens` | `lab.collect` @ every clinic of the items | One specimen for one or more lab tests of one patient: accession `{clinic}-{yy}-{n}`, barcode (unique per tenant). `specimenType` needed when the tests differ |
| `POST /v1/specimens/:id/recollect` | `lab.collect` @ facility | New specimen for a rejected one (`recollection_of_id`), same tests |
| `POST /v1/specimens/:id/receive` | `lab.process` @ facility | Received; its tests go in progress |
| `POST /v1/specimens/:id/reject` | `lab.process` @ facility | `reason` (`haemolysed`, `clotted`, `insufficient`, `mislabelled`, `wrong_container`, `delayed`, `other` + note); tests go back to waiting |
| `GET /v1/lab/worklist?facilityId&stage` | `collect`: `lab.collect` · `receive`/`result`: `lab.process` · `verify`: `lab.verify` | To collect (incl. recollections), specimens to receive, tests to result, reports to verify — by priority |
| `GET /v1/order-items/:id/lab` | `lab.process` or `lab.verify` @ facility | Entry/verification view: tests, parameters with the patient's reference range and coded answers, current results with critical-call logs, isolates, report |
| `POST /v1/order-items/:id/results` | `lab.process` @ facility | Preliminary values per observation definition (`valueNum` / `valueText` / `valueOptionId`). Reference limits are snapshotted by sex and age in days; `abnormalFlag` and `isCritical` computed (critical emits `critical_result.flagged`). The test is `resulted` when every reportable parameter has a value |
| `POST /v1/result-items/:id/correct` | `lab.process` @ facility | New value supersedes the current one (status `corrected`, reason); says whether the released report needs amending |
| `POST /v1/result-items/:id/critical-alerts` | `lab.process` or `lab.verify` @ facility | Who was told (staff or name), `channel` (`phone`/`in_person`/`app`), `readBackConfirmed` |
| `POST /v1/order-items/:id/isolates` · `POST /v1/micro-isolates/:id/susceptibilities` | `lab.process` @ facility | Culture organisms; AST per antibiotic (`disc` + `zoneMm` or `mic` + `micValue`, `S`/`I`/`R`) |
| `POST /v1/order-items/:id/report` | `lab.process` (lab) · `imaging.report` (imaging) @ facility | Create or save a draft report version (`registered`/`preliminary`) with a snapshot of results or `findings`/`impression`; panels are reported as a whole |
| `POST /v1/diagnostic-reports/:id/release` | `lab.verify` (lab) · `imaging.report` (imaging) @ facility | Sign out (`version`): new `final` version, results verified, items `released`, imaging study `reported`, `result.released`. Refused: someone who entered any of the results (403 `four_eyes`), unlogged critical values (`critical_not_notified`), missing results (`results_incomplete`), stale `version` |
| `POST /v1/diagnostic-reports/:id/amend` | as release | `reason` required; new `amended` version; corrected values verified by a second person; `result.amended` |
| `POST /v1/diagnostic-reports/:id/cancel` | as draft | Cancel an unreleased report (`version`, `reason`) |
| `POST /v1/diagnostic-reports/:id/acknowledge` | `results.acknowledge` @ facility + care | Once per clinician, with `actionTaken` (409 `already_acknowledged`) |
| `GET /v1/results/unacknowledged?facilityId` | `results.acknowledge` | Released reports on your orders you haven't acknowledged, critical first |
| `GET /v1/patients/:id/results` | `results.read` + care | Released reports and verified result trends across visits and merged records (audited) |
| `GET /v1/imaging/worklist?facilityId&status` | `imaging.manage` or `imaging.report` @ facility | Studies with Form F and report state |
| `POST /v1/imaging-studies/:id/status` | `imaging.manage` @ facility | `scheduled → arrived → in_progress → completed`, or `cancelled` (reason; cancels the item); same status to change `isObstetric` (ultrasound only), dose, PACS link. An obstetric ultrasound can't be completed without Form F with both declarations (422 `form_f_required`) |
| `PUT /v1/imaging-studies/:id/form-f` | `pcpndt.manage` @ facility | PC-PNDT Form F (`formData`, `patientDeclared`, `doctorDeclared`, `version` when updating); kept 2 years (`retainUntil`), never deleted, frozen once submitted |
| `GET /v1/form-f?facilityId&month=YYYY-MM` · `POST /v1/form-f/submit` | `pcpndt.manage` @ facility | Month's register (audited); mark complete forms submitted to the Appropriate Authority |

Built-in roles: `doctor` (orders, order sets, results, acknowledge), `nurse` (`lab.collect`, `results.read`), `lab_technician` (collect, process), `pathologist` (+ `lab.verify`), `radiographer` (`imaging.manage`, `pcpndt.manage`), `radiologist` (+ `imaging.report`); `tenant_admin` has all.

### Inventory (stores, stock, indents, purchasing, counts)
ERD [m10-inventory](../design/erd-v2/m10-inventory.md). An optional module: while `inventory` is suspended every write is refused with 422 `module_inactive`. Stock lives in a ledger: `inventory.stock_movement` is append-only and `stock_balance` is maintained by a trigger; on-hand can never go negative (409 `insufficient_stock`, also under concurrent issues). Outward picks are first-expiry-first-out over available, unexpired batches. Quantities are in the item's base unit.

| Method & path | Permission | Purpose |
|---|---|---|
| `GET/POST /v1/inventory/items` · `GET/PATCH /v1/inventory/items/:id` | `inventory.read` / `inventory.manage` | Item master (type, base UOM, pack UOMs, batch/expiry/serial tracking, reorder level, HSN/GST); drugs carry a `drugProfile` (generic, strength, form, schedule, controlled/high-alert flags). PATCH needs `version` |
| `GET/POST /v1/inventory/item-groups` | `inventory.read` / `inventory.manage` | Item groups |
| `GET/POST /v1/inventory/suppliers` · `PATCH …/:id` | `inventory.read` / `inventory.manage` | Suppliers (GSTIN checked against state code, payment terms) |
| `GET /v1/inventory/stores?facilityId` · `POST` · `PATCH …/:id` | `inventory.read` / `inventory.manage` @ facility | Stores on a location; a pharmacy store needs a drug licence; parent store in the same clinic |
| `PUT /v1/inventory/stores/:id/levels/:itemId` | `inventory.manage` @ facility | Min / reorder / max for an item in a store |
| `GET /v1/inventory/stores/:id/stock` · `…/ledger` | `inventory.read` @ facility | Per-item on hand, usable, low flag and batches; movement history newest first |
| `GET /v1/inventory/low-stock?facilityId` · `GET /v1/inventory/expiring?facilityId&days` | `inventory.read` @ facility | Below reorder level (store level, else the item's for central/pharmacy stores); batches expiring within `days` |
| `POST /v1/inventory/batches/:id/status` | `inventory.manage` | `available` / `quarantine` (reason) / `recalled` (emits `inventory.batch_recalled`; can't be released) |
| `POST /v1/inventory/stores/:id/opening` 🔑 | `inventory.issue` @ facility | Opening stock by batch (batch, expiry, MRP for drugs, cost) |
| `POST /v1/inventory/stores/:id/adjustments` 🔑 | `inventory.issue` · kind `adjustment` needs `inventory.approve` | `consumption` (FEFO or a named batch), `damage`, `expiry_disposal`, signed `adjustment`; reason required. Emits `inventory.stock_adjusted` |
| `GET/POST /v1/inventory/requisitions` · `POST …/:id/approve` · `…/cancel` | read / `inventory.indent` @ requesting store · approve: `inventory.approve` (not one's own indent) | Indents between stores of one clinic (`IND/…`); approve per line (≤ requested) |
| `GET/POST /v1/inventory/transfers` · `POST …/:id/receive` | `inventory.issue` @ issuing store · receive: `inventory.receive` | Dispatch against an approved indent (FEFO, ≤ approved) or ad hoc; receive with short-receipt reasons → `partially_received`/`received` |
| `GET /v1/inventory/counts?facilityId` · `GET …/:id` · `POST /v1/inventory/stores/:id/counts` · `POST …/:id/record` · `…/submit` · `…/approve` | `inventory.count`; approve: `inventory.approve` (not the counter) | Physical count: snapshot, record by line or batch, submit (all counted), approve posts variances (refused if stock moved since, 422 `stock_moved`) or reject back to open. One open count per store |
| `GET/POST /v1/inventory/purchase-orders` · `POST …/:id/{approve,send,cancel,close}` | `inventory.purchase`; approve: `inventory.approve` (not the creator) | PO `PO/{year}/{n}` with pack UOMs and GST; send emits `inventory.purchase_order_sent` |
| `GET/POST /v1/inventory/goods-receipts` 🔑 | `inventory.receive` @ store | GRN against a sent PO or direct: batch, expiry (expired on arrival refused), MRP for drugs, free qty; can't exceed the PO. Emits `inventory.goods_received` |
| `GET/POST /v1/inventory/supplier-invoices` · `POST …/:id/approve` | `inventory.purchase` / `inventory.approve` @ every GRN's clinic | Three-way match against received value (±₹1); a variance needs a reason to approve; not by who recorded it |
| `POST /v1/inventory/purchase-returns` 🔑 | `inventory.purchase` @ store | Return batches to the supplier (`PRN/…`) |

Built-in roles: `store_keeper` (everything except `inventory.approve`), `nurse` (+ `inventory.read`, `inventory.indent`, `inventory.receive`); `tenant_admin` has all.

### Pharmacy (prescriptions, verification, dispensing, MAR, register)
ERD [m09-pharmacy](../design/erd-v2/m09-pharmacy.md). An optional module: while `pharmacy` is suspended every write is refused with 422 `module_inactive`. A prescription is written as a draft and frozen once signed (database trigger). Dispensing goes through `inventory.post_patient_movement`, which checks the store, batch, quantity and patient against the dispense line and posts each line once; the stock ledger refuses overselling (409 `insufficient_stock`). The bill for a dispense is M11's job (it consumes `pharmacy.dispensed` / `pharmacy.medication_returned`).

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/pharmacy/drugs?q` | `prescriptions.read` | Search active drugs (generic or brand) with schedule and high-alert flags |
| `POST /v1/encounters/:id/prescriptions` 🔑 · `GET` | `prescriptions.write` / `prescriptions.read`, chart access | Draft prescription on an open encounter; setting follows the encounter class. Lines need a route (or the drug's default) and, outside inpatient, a quantity. GET also returns the visit's patient indents |
| `POST /v1/prescriptions/:id/sign` 🔑 | `prescriptions.write`, prescriber only | Needs a medical registration. Checks allergies and duplicate therapy; warnings need an `overrides` reason per line (422 `override_required` lists them). Teleconsultation can't carry Schedule X, NDPS or tele-prohibited drugs. Emits `prescription.signed` |
| `POST /v1/prescriptions/:id/cancel` 🔑 | `prescriptions.write`, prescriber only | Cancel with a reason; once dispensing has started, stop the lines instead |
| `POST /v1/prescription-items/:id/{stop,hold,resume}` 🔑 | `prescriptions.write`, chart access | Change one line; reason required to stop or hold |
| `POST /v1/prescriptions/:id/verify` 🔑 | `pharmacy.verify` (not one's own prescription) | `approved` → verified; `query`/`rejected` (notes required) → on hold |
| `GET /v1/pharmacy/queue?facilityId&stage` | `pharmacy.verify` or `pharmacy.dispense` @ facility | `verify`, `dispense` or `indents` work list |
| `GET /v1/prescriptions/:id/dispensing?storeId` · `GET /v1/patient-indents/:id/dispensing` | `pharmacy.verify` or `pharmacy.dispense` | Patient, allergies, lines, stock and batches at the store, generic alternatives, earlier dispenses |
| `POST /v1/dispenses` 🔑 · `GET /v1/dispenses?facilityId` | `pharmacy.dispense` @ store | Dispense against a verified prescription or a ward indent from a dispensing store (`DSP/{year}/{n}`). FEFO or a named batch; price ≤ MRP; substitutes only when allowed and equivalent; never more than prescribed. Emits `pharmacy.dispensed` |
| `POST /v1/dispenses/:id/hand-over` 🔑 | `pharmacy.dispense` | Record who collected a prepared dispense |
| `POST /v1/dispense-lines/:id/returns` 🔑 | `pharmacy.dispense` | Return (≤ dispensed − returned); restockable returns go back to the batch. Emits `pharmacy.medication_returned` |
| `GET /v1/pharmacy/register?facilityId&from&to` | `pharmacy.registers` @ facility | Schedule H1 / X / NDPS register (audited) |
| `POST /v1/encounters/:id/patient-indents` 🔑 · `POST /v1/patient-indents/:id/cancel` | `pharmacy.indent` (cancel also `pharmacy.dispense`) | Ward request to the pharmacy for a patient; drugs must be on an active line of this patient's prescription |
| `GET /v1/encounters/:id/mar` · `GET /v1/pharmacy/witnesses?facilityId` | `prescriptions.read` / `medication.administer` | Medication chart; staff who can witness a dose |
| `POST /v1/prescription-items/:id/administrations` 🔑 | `medication.administer`, chart access | Chart a dose: a scheduled slot is charted as given once; PRN needs an indication and respects the minimum interval (422 `too_soon`); NDPS, Schedule X and high-alert drugs need a witness at the clinic (not oneself). Emits `medication.administered` |

Built-in roles: `pharmacist` (verify, dispense, registers, plus stock read/indent/issue/receive/count), `doctor` (+ `prescriptions.read/write`), `nurse` (+ `prescriptions.read`, `pharmacy.indent`, `medication.administer`); `tenant_admin` has all.

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

🔑 = requires `Idempotency-Key`.

## Worker
`pnpm worker:dev` delivers outbox events (exactly once per consumer, retries with exponential backoff, dead-letters after 10 attempts), expires lapsed slot holds every 30 s, keeps monthly audit/outbox partitions ahead daily, and purges expired idempotency records hourly. Registered consumers: `appointment.checked_in` → open encounter; `appointment.cancelled` → cancel a not-yet-started encounter; `encounter.finished` → complete the appointment and its queue token; `appointment.confirmed` (virtual) → create the teleconsultation; `appointment.cancelled`/`no_show` → close it and revoke the link; `teleconsult.patient_waiting` → check the appointment in. Still to come: notifications (comms) and charges (billing).

## Try it
```bash
pnpm pg:start && pnpm db:reset && pnpm api:dev
TOKEN=$(pnpm -s dev:token ravi)
curl -s localhost:3000/v1/me -H "authorization: Bearer $TOKEN"
curl -s "localhost:3000/v1/practitioners/01920000-0000-7000-8000-000000000401/slots?from=2026-10-19&to=2026-10-19" -H "authorization: Bearer $TOKEN"
```

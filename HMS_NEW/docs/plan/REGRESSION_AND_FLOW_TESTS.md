# Regression and user-flow tests

**Phase closed by the product owner on 12 October 2026.** Local staff implementation is accepted. Active focus is UX/UI and operations review; webpage/Voice-bot integration is on hold. Provider work below is carried forward in [UX_AND_CHANNEL_TODO.md](UX_AND_CHANNEL_TODO.md), not silently marked implemented. [Current operations review](STAFF_OPS_REVIEW.md).

How to prove nothing broke, and how each person uses the staff workspace. Updated 12 October 2026 after the third local implementation phase from `6713e01`. It goes with [BACKEND_COMPLETION_GUIDE.md](BACKEND_COMPLETION_GUIDE.md); the flow-to-API map is in [STAFF_USER_FLOWS.md](STAFF_USER_FLOWS.md).

Release decisions and additional acceptance cases: [STAFF_MODULE_DEVELOPMENT_DECISIONS.md](STAFF_MODULE_DEVELOPMENT_DECISIONS.md). No patient bot, telephone infrastructure or operational Loyalty backend in this release. G25 shared schemas start with the first comms slice.

## 1. Automated suites: run all of them before every commit

From `HMS_NEW/` (the folder with `pnpm-workspace.yaml`):

```bash
pnpm install
pnpm pg:start                      # embedded Postgres on 54329 (or docker compose up -d)
pnpm db:reset && pnpm db:codegen   # dev database, migrations, reference + dev seeds, Kysely types
pnpm typecheck
pnpm test                          # builds a fresh hms_test database itself
cd apps/staff-web && npx tsc -b && npm test && npm run lint && npx vite build
```

**Verified third-phase baseline (12 October). A change must not lower these assertions or counts. Historical baseline was 199 backend / 25 frontend tests.**

| Suite | Baseline |
|---|---|
| `pnpm test` (vitest, files run one at a time against `hms_test`) | 20 files, 252 tests, all pass |
| staff-web `npm test` (`node --test tests/*.test.ts`) | 54 tests, all pass |
| staff-web `npm run lint` (oxlint) | 0 errors, **16 warnings**. Don't add warnings. |
| `npx tsc -b`, `npx vite build` | pass. The bundle-size warning already exists. |

Using another Postgres port? Set `PG_PORT`, for example `PG_PORT=54339 pnpm test`. Every URL is derived from it (`db/scripts/config.mjs`).

**What each backend file guards:**

| File | Guards |
|---|---|
| `db/tests/conventions.test.ts` | Every table has RLS, tenant id and audit columns. Module roles can't DELETE. New schemas must be registered (see the guide's six places). |
| `db/tests/environment.test.ts`, `m01-platform`, `m02-patient`, `m03-catalog` | Schema-level rules: tenancy isolation, system roles, patient and catalogue constraints. |
| `apps/api/src/modules/booking/booking.test.ts` | Booking kernel: holds, no double booking, slots. |
| `apps/api/src/http/api.test.ts` | Booking journey, schedule scope (G01), overbooking (G36), waitlist (G11), walk-ins, operations summary, weekly plan. |
| `apps/api/src/http/flows.test.ts` | **F1–F9 end to end against an empty hospital.** See section 2. |
| `apps/api/src/http/coverage.test.ts` | Fails if any `/v1/...` string in `apps/staff-web/src` has no route. |
| `apps/api/src/http/access.test.ts` | Staff, grants, roles, activity log (G18). |
| `apps/api/src/http/catalog.test.ts` | Clinics, departments, services, fees, doctor profile. |
| `apps/api/src/http/clinical.test.ts`, `records.test.ts` | Encounters, notes, vitals, allergies, M02 registry, M05 records, the board and exact-time holds. |
| `apps/api/src/http/telehealth.test.ts` | Video visit tokens, consent, join window. |
| `apps/api/src/http/schedule-acceptance.test.ts` | Extra-hours mode/service validation, virtual booking → exactly one tele session, exact-range move/readback/replay/overlap refusal. |
| `apps/api/src/http/comms.test.ts` | Contacts/owner scope, consent/STOP and aliases, suspension, event dedupe/reordering, log-only worker and permission refusals (21 tests, including feedback/no-show and immediate rules, completed follow-up, waitlist lifecycle and timestamp-precise pagination). |
| `apps/api/src/http/whatsapp.test.ts` | Signed ingestion/STOP, scope/permissions, reply window/cases, private assets, campaign audience/budget/test/pause (9 tests). |
| `apps/api/src/http/voice-growth.test.ts` | Runtime binding/replay, separate consent/expiry/withdrawal, private review/audit, link hosts/versions, clinic-time chain metrics and optional PostHog and Overview scoped count (17 tests). |
| `packages/contracts/src/contracts.test.ts` | Shared schema ownership, affirmative evidence and response validation (2 tests). |
| `apps/worker/src/worker.test.ts` | Outbox dispatch, inbox dedupe, consumers. |

**Rules when adding features:**
- Every new route gets an allowed test **and** a refused test: wrong permission, wrong clinic, and suspended module where it applies.
- Every new frontend `/v1` call needs a route, or `coverage.test.ts` fails. Don't weaken that test.
- A new flow a person does in the UI gets a step in `flows.test.ts` and a row in `STAFF_USER_FLOWS.md`.
- Concurrency-sensitive writes (claims, sends, holds) get a two-parallel-requests test. `api.test.ts` "at most 3 per session" is the model.
- Use the test kit (`apps/api/src/http/test-kit.ts`): personas such as `p.frontDesk` and `p.doctor`, `k.call(...)`, and the `X-Test-Now` clock override. Don't hit the dev database from tests.

## 2. The end-to-end flows already automated

`flows.test.ts` runs these in order on an empty hospital. After any change to booking, catalogue, access or clinical code, **they must all still pass unchanged**. Changing an assertion to make a test pass is a regression, not a fix.

| # | Who | Flow |
|---|---|---|
| F1 | Administrator | Open a clinic and fill in its catalogue (departments, rooms, services with fee) |
| F2 | Administrator | Bring a doctor on: invite, clinic, profile, calendar, weekly hours |
| F3 | Front desk | Register a patient and book them. Book a phone caller without registering. |
| F4 | Administrator | A doctor-specific fee from a later date leaves earlier bookings as booked |
| F5 | Front desk | Correct a patient's phone. The appointment shows the new contact. |
| F6 | Front desk | Move a visit to another slot. Cancel another with a reason. |
| F7 | Front desk → doctor | Check-in links the caller to a record. The doctor starts and finishes. The worker completes the appointment. |
| F8 | Administrator | A doctor leaves a clinic only after their visits and hours are dealt with |
| F9 | Administrator | A clinic is switched off only when nothing is booked there, and never the last clinic |

**F10–F14 acceptance:** local cases are now exercised across `comms.test.ts`, `whatsapp.test.ts` and `voice-growth.test.ts`, plus typed frontend adapter tests and the browser walkthrough below. The original `flows.test.ts` still contains F1–F9; do not claim these new cases live in that file. External delivery/runtime/provider evidence remains unverified. See [current progress](STAFF_MODULE_PROGRESS.md).

| # | Who | Flow |
|---|---|---|
| F10 | Front desk | Book with reminders consent: a `day_before` job exists. Move the visit: old unsent jobs cancel and replacement jobs are deduplicated. Cancel it: the job is cancelled. Book without consent: a skipped job/state, no sendable message (`skipped_no_consent`). |
| F11 | Front desk | Inbound WhatsApp message (signed webhook) → conversation appears → assign to self → reply inside 24 h → close. Replying after 24 h is refused; local reply never proves provider delivery. |
| F12 | Administrator | Draft campaign → preview → local test using a configured allowlisted alias → approve with the preview's hash. A STOP contact is never a recipient. |
| F13 | Administrator | Voice: authenticated external-runtime fixture runs the normal booking command (`origin_channel = voice`), then links its verified result to the call. Admin plays a consented, unexpired recording (logged); front desk cannot. No public call launcher or live telephone call is required. |
| F14 | Administrator | Set a clinic's booking link (https only), see it in change history. Growth summary counts the booking, and a move isn't counted as a cancellation. |

## 3. Running the app for browser checks

Three processes, from `HMS_NEW/`:

```bash
PORT=3038 AUTH_MODE=dev pnpm api:dev
```

```bash
pnpm worker:dev
```

```bash
cd apps/staff-web && VITE_HMS_DEV_LOGIN=true npx vite
```

Then:
- Open `http://127.0.0.1:5188/staff/`. Vite proxies `/v1`, `/dev`, `/health` and `/ready` to `HMS_API_PROXY_TARGET`, default `http://127.0.0.1:3038`.
- **The worker must be running** for check-in to open an encounter, for finishing an encounter to complete the appointment, and for virtual bookings to get a video session.
- Sign in with the **Staff identity** picker. These are dev seeds in `db/seeds/dev/010_demo_tenant.sql`:

| Pick | Person | Role | Scope |
|---|---|---|---|
| Ravi · Front desk | Ravi Shankar | `front_desk` | Demo Health Bengaluru |
| Dr Asha · Doctor | Dr Asha Rao | `doctor` | Bengaluru. General Medicine, Mon–Sat 09:00–13:00 (15-min slots), walk-in tokens Mon–Fri 17:00–19:00 |
| Meena · Nurse | Meena Kumari | `nurse` | Bengaluru |
| Priya · Administrator | Priya Nair | `tenant_admin` | every clinic (Bengaluru, Chennai) |

Dr Vikram Iyer (Paediatrics, Bengaluru Mon/Wed/Fri and Chennai Tue/Thu) is bookable but has no sign-in.

**Browser rules:**
- Move between pages with the **sidebar only**. The session lives in memory, so typing a URL or reloading signs you out.
- Use a clean database: `pnpm db:reset` before a full walkthrough.
- Check the browser console and the API log for errors on every page.

## 4. Browser walkthroughs by person

Each step gives what to do, then **expected** results. Anything else is a regression.

### Front desk (Ravi)

1. **Sign in.**
   - The sidebar shows Overview, Appointments, Patients, Waitlist, Queue, Consultations, Teleconsultations, Hospital catalogue, Doctors, Schedules, and WhatsApp/Voice with a Pending label.
   - Workspace settings is listed; Design & UX guide was removed by the owner. Appointments contains Appointments/Waitlist/Queue tabs; Catalogue and Doctors are under Workspace.
   - **No Operations and no Activity log**: both need `audit.read` at every clinic.
2. **Overview.**
   - Today's totals, status and channel mix, and 14 days of bookings for Bengaluru.
   - Local notification jobs show known counts only with comms.read; they are labelled not sent. Voice session totals count persisted clinic calls only with voice.read; otherwise unavailable.
3. **Appointments → Book appointment → Register a new patient.**
   - Pick Dr Asha and a free slot, then save.
   - A confirmation code appears and the visit is in the list.
   - Search the list by patient name, phone digits and confirmation code: each finds it.
4. **Book for a caller who isn't registered:** name and phone only. It books. The visit shows the caller's name.
5. **Open the visit → Move appointment** to another free slot.
   - The old visit is cancelled ("Rescheduled") and the new one is confirmed.
   - The "contact the patient" notice shows. It never claims a message was sent.
6. **Cancel another visit.** A reason is required, and the status becomes cancelled.
7. **Schedules.**
   - Dr Asha's day shows sessions, booked and free slots, and blocks.
   - Drag a free range → Appointment → book.
   - Ravi can book but **cannot** block time or edit weekly hours (needs `schedules.manage`).
8. **Waitlist.**
   - Add a request.
   - Offer a slot: it is held for 15 minutes.
   - Record accept: an appointment is booked. Record decline: the slot is freed.
   - Withdraw another request.
9. **Arrival: Appointments → Check in** on today's visit. For a caller booking, link or register the patient first. The patient appears in **Queue**.
10. **Queue → Walk-in.**
    - On a weekday, a token is added. Dr Asha takes up to 20 a day.
    - On Saturday or Sunday it is refused with "the doctor is not taking walk-ins today".
    - When the day is full it is refused with "walk-in tokens for today are full".
11. **Patients.**
    - Open a patient → Edit details → change the phone → save. The appointment sheet shows the new phone.
    - Editing the same patient in two tabs: the second save is refused as stale and asks to reload.
12. **Teleconsultations.** Virtual visits are listed.
    - "Confirm new patient link", then "Copy patient link".
    - Without a configured video provider, the page says real calls aren't set up. Nothing claims a video visit happened.

### Doctor (Dr Asha)

1. **Sign in.**
   - Consultations, Queue, Teleconsultations, Appointments and Schedules are visible.
   - Doctors can't book (no `appointments.book`), so booking controls are hidden or refused.
2. **Consultations.** Today's checked-in patients, after the worker opens their encounters.
   - Start an encounter.
   - Record vitals, an allergy and a diagnosis.
   - Write a SOAP note (sections S, O, A, P in that order) and sign it.
   - Finish.
3. **After finishing:**
   - The appointment becomes completed and the queue token is done (worker).
4. **Note entered in error.** Offered only on Asha's own note. Another person's note has no such control (403 from the API).
5. **Video.** A virtual visit in Teleconsultations: Start video consultation → Confirm patient identity → End call with this outcome.

### Nurse (Meena)

1. **Sign in.** Consultations and Queue are visible.
2. **Consultations.**
   - Triage and vitals on a checked-in patient.
   - A **nursing** note can be written and signed by Meena.
   - A doctor's consultation note can't be signed by her.
3. **Check-in.** Meena can check a patient in (`appointments.check_in`), but can't book or cancel.

### Administrator (Priya, every clinic)

1. **Sign in.** Everything is visible, including Operations, Workspace settings and Activity log. The clinic switcher has Bengaluru and Chennai.
2. **Hospital catalogue.**
   - Add a clinic. Edit the address, directions link (https only) and arrival instructions.
   - Add a department, a consult room and a service with a default fee.
   - Switch a service off: refused while it's in use, with the reason shown.
3. **Workspace settings → Add staff member** (doctor role, email invite).
   - The invite appears.
   - Renew an expired invite.
   - Grant and remove access with a reason. Deactivate and reactivate.
   - Copy a built-in role, edit its permissions, retire it.
   - Built-in roles are read-only.
4. **Doctors.**
   - Add the new doctor to a clinic. Edit the profile (specialty, languages, video visits).
   - Set a doctor fee from a later date: earlier bookings keep their fee.
   - "Set up calendar" for a doctor without one.
5. **Schedules (as admin).**
   - **Weekly hours:** edit, preview, save. Affected visits are listed and Save stays disabled until each is resolved with **Resolve** (move or cancel).
   - **Block time:** the preview lists affected visits; save. **Unblock** asks for a reason.
   - **Extra hours:** choose in-person or virtual, review and save. Virtual slots must use the virtual service; a booked virtual slot creates exactly one tele session.
   - **Booking policy:** switch overbooking on. A booked visit offers "Add another appointment at this time", asks for a reason, and allows at most 3 per session.
6. **Operations.** Live holds, readiness, and the latest outbox events. Refresh works.
7. **Activity log.**
   - Filter by person, record, action and date. Show more pages.
   - Export CSV: audited, maximum 5,000 rows.
   - Break-glass review: Priya can review others' emergency access, not her own, and only once.
8. **Settings → Optional modules.**
   - Core modules can't be switched.
   - Suspending an optional module asks for a reason. Its business writes are then refused while reads still work. Future comms acceptance must also prove that authenticated STOP/withdrawals and already-sent receipts still persist while suspended.
   - The list includes modules that are out of scope (diagnostics, pharmacy…). That is expected: switches only, no screens.
9. **Patients → Duplicate queue.** Propose a merge as one person. A second person decides. A third can unmerge. The same person can't do two steps.
10. **Doctor leaves (F8).** "Stop working here" is refused while future visits or published hours remain. Cancel or move them and end the hours, then it succeeds.
11. **Switch a clinic off (F9).** Refused while visits or hours remain, and always for the last active clinic.

### Pending pages and retained concept (all roles)

- WhatsApp: all seven tabs render. Configure/save/reopen all seven visit-rule kinds; feedback/no-show default off, immediate reschedule/cancel delay zero. Create a synthetic support case, assign/close, inspect authenticated local content and campaign draft; approval stays blocked without a reviewed configured local test. Delivery history must say local/not delivered.
- Voice: open history; review a consented persisted synthetic transcript and see the audit. Recording without consent is unavailable. Front desk can review authorized transcripts but cannot access recordings/access history. Test actual playback via an injected private mock in the backend suite; browser/live playback acceptance remains separate.
- Google Business: configure an approved HTTPS destination in the server allowlist, save it and reopen change history; actor must be the authenticated staff. Without growth.manage the UI is read-only and server writes refuse.
- Growth: current clinic/date/cohort filters use persisted logical visits. Empty ratios are unavailable, moved predecessors do not inflate cancellations, booking channel is not acquisition. Missing PostHog configuration shows unavailable data, never invented zeros.
- Loyalty shows a "Concept" label and sample data.
- No scoped operational page remains a PendingModule placeholder; Design is removed; labelled Loyalty/Patient journey concepts retain their boundaries.

## 5. Regression checklist after any backend change

Tick each before committing:

- [ ] Verify database URLs refer to a disposable local environment before reset. The first wave used a separate server on 54349, leaving the existing preview database unchanged.
- [ ] All four automated suites in section 1 pass, with the baseline numbers or higher (lint warnings ≤ 18), retaining invariant assertions and adding the decision document's consent, scope, unknown-send, upload and reschedule-chain cases.
- [ ] `flows.test.ts` F1–F9 pass with **unchanged** assertions.
- [ ] `coverage.test.ts` passes, with no route removed that the frontend still calls.
- [ ] A new migration has a working `-- migrate:down`. Check it with `pnpm db:rollback` then `pnpm db:migrate` on the dev database.
- [ ] A new schema is registered in all six places (the guide, section 2).
- [ ] New writes are refused for the wrong permission, the wrong clinic, and a suspended module.
- [ ] No secret, token or full phone number appears in an API response, log line or audit diff. Request logs never include query strings; this is already enforced, so keep it.
- [ ] The browser walkthrough for each person whose pages the change touches (section 4), with no console errors.
- [ ] `BACKEND_WORK_LEDGER.md`, `STAFF_USER_FLOWS.md` and `docs/api/README.md` are updated in the same commit.

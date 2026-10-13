# Staff operations review — 12 October 2026

**PASS for covered local workflows; external channel and production acceptance remain UNVERIFIED.** Scope is the accepted staff workspace, excluding billing, pharmacy, inpatient, diagnostics and operational Loyalty. This is an independent code/test/runtime review, not a claim that a clinical pilot or provider deployment has been accepted.

## Coverage and boundaries

| Daily operation | Evidence | Assessment |
|---|---|---|
| Clinic/service/fee/doctor onboarding and safe departure/deactivation | `flows.test.ts` F1/F2/F4/F8/F9; catalogue/access tests | PASS local persisted commands and permissions |
| Appointment discovery, patient/caller booking, contact correction, reasoned move/cancel | F3/F5/F6; booking/API tests | PASS; identity stays separate, immutable fee snapshots and idempotency/concurrency guards retained |
| Published hours, split shifts, blocks, extra hours, virtual visits and exact-time moves | `schedule-acceptance.test.ts`, calendar/API tests, schedule source/presentation tests | PASS local; no schedule UI removed by consolidation |
| Waitlist request → consented offer → accept/decline/withdraw/expiry | `comms.test.ts`, booking/API waitlist tests | PASS local; existing hold/offer/appointment commands retained |
| Arrival, walk-in, queue call and clinical handoff/completion | F7, `clinical.test.ts`, queue/API tests | PASS local; encounter starts token service, completion reconciles appointment/token; open encounter prevents queue shortcut completion |
| Clinical privacy, signed doctor/nurse notes and access escalation review | Clinical/records/access tests | PASS local; role/care access/signing constraints remain |
| Teleconsultation booking/link/consent/reissue/cancel/join window | `telehealth.test.ts`, schedule acceptance | PASS local tokens/domain; real call/media/provider acceptance UNVERIFIED |
| Administrative messaging rules and contact consent/STOP | 21 `comms.test.ts` tests | PASS local jobs/readback; no actual patient delivery |
| Reception cases/inbox/private content and campaign preparation | 9 `whatsapp.test.ts` tests plus typed adapter suites | PASS local; outbound Meta and production storage/scanner deferred |
| Voice call history/private review and Google/internal Growth | 17 `voice-growth.test.ts` tests plus adapters | PASS normalized/local; actual Voice bot, recordings and PostHog integration UNVERIFIED |
| Who changed what, export and emergency access review | `access.test.ts`, ActivityLog adapter, existing staff activity browser page | PASS local audit; consolidated Activity retains its stricter all-clinic permission |
| Background orchestration | Worker tests; isolated worker runtime on Postgres54349 | PASS local: preview worker started, processed 10 queued events with zero failures; due local reminder evaluated without external delivery |

## Verified this review

- Full backend regression: **20 files / 252 tests PASS**. Original F1–F9 remain in `flows.test.ts`; additional channel cases live in their dedicated suites.
- Frontend: **54 tests PASS**, TypeScript and production build PASS, lint **0 errors / 16 warnings**. Existing bundle-size warning remains.
- Browser administrator: Appointments/Waitlist/Queue tabs select the right existing routes and records; Activity has Staff activity and System status; catalogue/doctors appear under Workspace; guide is absent. Queue displays the persisted completed token and consultation handoff. System status shows database Ready and actual processed events after the worker starts. Front-desk browser access retains appointment tabs and hides Activity; found and fixed a misleading sidebar label that called all administrative staff clinic administrators. Phone-width 390 px has no page overflow; arrow/Enter tab navigation works.
- Preview worker was absent during inspection. Started only the isolated local/log worker using the existing 54349 environment; old preview databases and unrelated processes were not reset. API3049 and frontend5198 remain active.
- No backend schema/domain changes in this UX review. No live patient message, public booking, Voice call, provider upload or account action. No commit/push.

## Operational limits and next UX checks

The database readiness card is not a worker heartbeat/provider health check. Processed outbox events are internal orchestration, not WhatsApp delivery receipts. Persisted test data and passing HTTP suites do not prove usability for every staff persona, real clinical acceptance, provider delivery, live recordings or production deployment. Complete owner/team persona walkthroughs and worker backlog/dead-letter monitoring in the next phase. Channel target integration is on hold per owner instruction. [Next-phase TODO](UX_AND_CHANNEL_TODO.md).

## First annotated verification — historical, superseded by second review below

Frontend typecheck/build pass; 54 frontend tests and 20 backend files /252 tests pass. Lint has 0 errors /17 warnings (one additional effect warning from initial patient preselection); the known bundle-size warning remains. Changed forms preserve the existing booking/clinical command contracts. No new backend work or access grants in this slice.

Local browser checked: full-page three-step booking with synthetic Module Review patient; future slots load on date input, real hold counts down in review, backing out releases it (the same slot was available on the waitlist offer afterward); completed appointment links to exact full patient record; the Consents tab displays explicit treatment/signature controls; clinic-wide queue defaults All doctors; waitlist offer displays fixed Dr Asha plus actual time range; request displays Name and the bounded Anytime window. Past chart/consultation access correctly refuses the administrator without a care relationship. Full clinical write/completion persona browser acceptance still needs an active assigned visit or an authorised care assignment; no emergency or synthetic blanket access was granted to bypass this boundary. Existing persisted clinical tests cover start, notes/signing, completion and queue/appointment reconciliation.

Owner steering: the current UX scope is normal desktop only. Mobile optimisation is deferred. Temporary browser viewport override was reset; no mobile-specific layout changes were made in this annotated slice.

## Second desktop UX verification — 12 October 2026

**PASS local frontend and persisted doctor visit flow.** Frontend: **58 tests PASS**, TypeScript and Vite build PASS, lint **0 errors /17 warnings** (unchanged from previous annotated slice); existing bundle-size warning remains. Four new exact-range regression tests reject occupied, wrong-mode and wrong-clinic requests and accept free ranges spanning slots. Backend source and permissions were not changed or re-granted; the prior 252-test backend baseline is historical, not re-run for this frontend-only slice.

Browser, as seeded Dr Asha: Overview / Medical history only; details, related people and duplicates on Overview; removed consent/identity/care-team tabs/forms. Test record labels are explicit. Appointment navigation shows three prominent choices and visible filter captions. Completed appointment action opened its exact `OP-000001` clinical record (`01a12ef5-840f-739e-b7b3-912df327fa19`), without a patient/date guess.

Created a **synthetic** new outpatient visit from the patient-record Start visit now action. Persisted encounter `01a13072-9ced-750b-9a66-42a23baa2725` / `OP-000002`: arrived → started → free-text draft saved → signed by seeded doctor → discharged-home test completion. Confirmation rendered only after command success; worklist showed Finished, and reopening showed the saved signed test note. No real patient care, messaging or external provider action. Forms clearly separate new notes from completed history and preserve their mounted inputs across section navigation.

Doctor schedule: own row labelled Your schedule. Book/Block correctly disabled without the corresponding current server permission; no fake save or broad clinic grant. Routine chart access messaging now describes treating-doctor/assigned-staff access plainly. Missing self-scope and longitudinal policy remain in UX-B01–B03. ABHA identifiers do not imply imported records. Hospital-paper consents are not fabricated or erased.

Desktop screenshots: `/tmp/hms-new-module-proof/simplified-patient-overview.png`, `simplified-appointments-workspace.png`, `simplified-visit-completion.png`, and `simplified-visit-summary.png`. Check logs use `simplified-ux-*` in that folder. Public webpage / Voice targets remain on hold. Mobile work remains deferred.

Preview recovery after the next Continue: API3049 and Vite5198 restarted against the same existing Postgres54349 (no reset/reseed), with the same explicit local seeded-sign-in mode. Finished OP-000002 and its signed note reopened successfully. Processes are detached so the review page remains available between turns. Nurse note signing now displays the existing clinical.sign_nursing permission correctly; no new signing authority was introduced.

## Booking context and visit-status repair — 12 October 2026

Independent source check confirmed `openEncounter` writes `appointment_id = null`, check-in enforces clinic-local session date, and `encounter.finished` only completes the exact linked checked-in booking via the worker. The owner’s completed visit was therefore distinct from tomorrow’s confirmed booking. Preserved both records; did not falsely mark a future appointment completed.

Frontend regression: **63 tests PASS** (five new mode/pagination/duplicate checks), TypeScript/build PASS; final lint retains **0 errors /17 warnings**. Read tests include later-page failure and repeated cursor, so incomplete results cannot be called a clear duplicate check. Virtual mode excludes in-person/held/booked slots.

Local browser: front-desk registration displays explicit teleconsultation choice and matching next-action label; virtual booking shows only virtual availability/clear empty state. The existing tomorrow booking triggers an alert with doctor/time/type/status, opens the exact appointment, and prevents final confirmation without duplicate acknowledgement. Held a free slot for review and released it; it was available again. No extra patient or appointment was saved. Doctor patient overview shows completed visits and links, and another unbooked visit requires an explicit separate-visit acknowledgement. A future booking retains its status and explains same-day check-in.

Restarted the existing isolated log-only worker after finding it stopped: 12 internal outbox events processed, zero failures in the observed recovery. These are internal consumer receipts, not provider delivery. API3049/Vite5198/Postgres54349 unchanged; no reset or reseed.

Evidence: `register-teleconsultation-choice.png`, `duplicate-appointment-review.png`, `patient-completed-visit-context.png` and `booking-context-*` logs under `/tmp/hms-new-module-proof`. Backend early-start/linking and atomic duplicate policies are UX-B04/B05. External channel/clinical/production acceptance remains unverified.

## Three annotated issue fixes — 12 October 2026

**PASS local frontend, waitlist persistence and published-slot overbooking.** Frontend 70 tests PASS, TypeScript/Vite build PASS; lint remains 0 errors /17 warnings. The new regressions cover the reported invalid phone, normalization to the actual E.164 contract, enabled/disabled overbooking authorization, observed holds/blocks, explicit slot options and preventing silent range truncation. Backend baseline was not rerun because no backend source changed.

Browser checks at 5198 using existing seeded roles: an unprefixed 14-digit phone shows a field error and disables Add request. A synthetic valid Dr Vikram request with the reported Anytime date range saved, remained after reload/fresh login, then was withdrawn normally. The original 11:15–12:00 occupied selection now offers explicit full published-slot choices instead of the generic refusal. Selected 11:15–11:30, entered an extra-appointment reason, saved and read back a distinct overlapping appointment, including the reason and exact interval. Cancelled only that synthetic appointment after validation; the original booking and blocks remained. Patient identity was visually checked inline at the right of Patient record in the doctor desktop view.

Arbitrary exact overlap ranges remain unsupported by the current slotStart-only backend command and are UX-B06. Frontend observed-hold rejection is not an atomic concurrency guarantee. Provider delivery, production acceptance and mobile optimization remain unverified/deferred.

Screenshots under `/tmp/hms-new-module-proof`: `patient-inline-header.png`, `waitlist-valid-request.png`, `overbooking-range-options.png`, `overbooking-saved-slot.png`. Final frontend test output: `annotated-issues-tests.log`.

## Teleconsultation calendar and scheduling discovery — 12 October 2026

**PASS local frontend and existing virtual-slot hold/release.** 72 frontend tests PASS; TypeScript/build PASS; lint 0 errors /17 warnings. Calendar regression checks include leap months/year rollover, API range bounds, clinic-local date grouping, future-only times, clinic/mode isolation and occupied-slot exclusion.

Booking's month calendar reads real free/occupied slots for one doctor and clinic. Browser: Asha's 17, 24 and 31 October Saturday dates each showed six free virtual slots. Selected 17 October at 14:00 → real hold → review showed exact date/time and Teleconsultation → returned and released → six free times again. No new appointment. Schedules' teleconsultation action and booking shortcut opened Asha's existing Saturday 14:00–16:00 virtual-hours editor. Closed without publishing and confirmed it did not reopen. Vikram's disabled-video guard opened his exact Doctor details sheet and showed the existing off switch. No profile or published-hours mutation, role grant, backend source/schema change or provider interaction.

To configure as an authorized administrator: enable Accepts video consultations in the doctor's saved booking profile if needed; set up their calendar if missing; open Schedules → Teleconsultation hours; select doctor/clinic, repeat days, start/end times, booking-slot duration and effective dates; Review weekly hours, resolve conflicts, then save. In-person and virtual hours remain separate records. This is availability/booking configuration, not proof that an external video provider is connected.

Evidence: `/tmp/hms-new-module-proof/teleconsultation-calendar.png`, `teleconsultation-hours.png`, `teleconsultation-calendar-tests.log`, `teleconsultation-calendar-build.log`, `teleconsultation-calendar-lint.log`. Desktop only; public webpage/Voice integration remains on hold.

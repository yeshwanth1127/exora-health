# Website and appointment readiness test plan

Prepared 2 October 2026. Scope: the latest website and backend appointment journey. Older deployment complaints are background only; the user asked to find what can block the current version. This document is an execution plan plus an initial baseline, not a claim that deployment or every journey has passed.

Execution is now authorized, including merging the related booking, mobile and test changes after validation. See [implementation and test results](website-test-results.md) for current work; the baseline below records the initial inspection.

## 1. Current evidence and blockers

| Target | Evidence checked in this chat | Status and limit |
| --- | --- | --- |
| Website main `cc968e2` | Fresh `npm test`: 45 passed across five files. Fresh production build passed, with a large bundle warning. | PASS for component tests/build. Ordinary scheduling remains a local preview with sample slots and simulated verification; it cannot register a clinic appointment. |
| Website draft PR #2, `b7d7235` | Fresh `npm test`: 46 passed. Fresh production build passed. Inspected `LiveBookingEntry.tsx` and routing changes. | PASS for component tests/build. The jsdom run reports document navigation is not implemented, so it does not establish actual browser redirects. PR remains OPEN/DRAFT and has no listed CI checks at inspection. |
| Backend draft PR #4, `677e19f` | Inspected `BOOKING_FLOW_VERIFICATION.md`, `BOOKING_JOURNEY.md`, API tests, booking UI and CI. | Local report records 91 backend tests, 37 bot tests, HTTP integration and database evidence. These backend checks were reported by the implementing chat; this chat has not rerun the full backend suite. |
| Backend PR #4 CI | GitHub run `36976979735`: PostgreSQL integration stage has 18 failures and 26 passes. Failures primarily return 401 at service verification/voice boundaries. | FAIL: must resolve and rerun before release. A mismatch between test fixture service credentials and `.env.example` settings is the likely explanation; confirm through a reproduction. |
| Deployed release | No current deployment target or release identity verified. | UNVERIFIABLE. Deferred until release testing; an old URL is unnecessary for the present plan. |
| Real WhatsApp/voice, PostHog and Google | Related chats and verification report distinguish local simulations from actual provider activity. | UNVERIFIABLE for live acceptance. They are not implied by local tests. |

Related changes: [website PR #2](https://github.com/Sachinskz/hospital-webpage/pull/2), [backend PR #4](https://github.com/yeshwanth1127/hms-backend/pull/4), [failed CI run](https://github.com/yeshwanth1127/hms-backend/actions/runs/36976979735).

Existing test coverage to reuse:

- Website: `src/test/bookingFlow.test.tsx`, `routing.test.tsx`, `dataResilience.test.tsx`, `posthog.test.ts`, `posthog-sdk.test.ts`. These cover preview validation, route rendering, error recovery and analytics contracts.
- Backend appointment branch: `tests/test_booking_journey.py` covers verified sessions, ownership, CSRF, persistence, replay, fee/schedule changes, cancellation, rescheduling, waitlist offers, consent, staff actions and PostgreSQL hold races.
- Backend: retain existing migration, staff access, nurse desk, voice and WhatsApp tests. Reuse signed-webhook/worker HTTP integration in `whatsapp-bot/test/integration.http.mjs`.
- The missing layer is a repeatable real-browser suite joining website entry, backend patient booking, staff visibility and independently checked saved state.

## 2. Order of execution

1. **Resolve the existing CI failure.** Reproduce the credential/environment issue in a disposable test setup; fix test configuration without weakening service authentication. Run the complete backend suite and PostgreSQL integration successfully on the same PR head. Do not count skipped concurrency tests as passing.
2. **Add browser automation on the appointment branches.** Create Playwright configuration, isolated fixtures and the seed below. Test the built website together with the built backend patient/staff UI through one local reverse proxy. Start with desktop Chromium and one phone viewport.
3. **Prove the critical booking path.** Exercise verification, live database availability, confirmation, staff list/schedule, reload, cancellation and rescheduling. Use a separate database connection as the persistence oracle. Run API race tests against disposable PostgreSQL.
4. **Exercise failure and mobile paths.** Add network failures, expiry, stale schedules, permission failures, deep links, storage variants, keyboard use, mobile navigation and cross-browser cases. Coordinate layout defects with the mobile chat.
5. **Check a release candidate on its actual HTTPS origin.** Verify versions, migrations, routing, build-time environment, cookies and worker health. Run non-mutating browser smoke checks. Then perform a controlled test-patient booking with a designated test phone/slot and verify actual provider delivery if it is part of the launch promise.

Product changes belong on the relevant existing branches; do not duplicate appointment implementation or rewrite the mobile chat's CSS. The mobile patch is integrated on the website appointment branch. Deployment/provider activation remains outside this merge request.

## 3. Test setup and evidence

Browser seed: `tests/e2e/seed.spec.ts` using `tests/e2e/fixtures.ts`, implemented with `playwright.config.ts`. The implementation uses flat scenario filenames under `tests/e2e/`; the grouped names below remain the planning map. See the execution report for actual coverage and reproduction commands. Vitest remains the component runner.

Each scenario starts with a fresh browser context, a unique fictional patient and isolated clinic records. Seed approved-format doctor/branch identifiers, a known fee and predictable future schedule. Backend integration uses disposable PostgreSQL with independent connections. Preserve existing preview processes, databases and untracked files.

For repeatable automated verification, drive the signed synthetic WhatsApp webhook and worker against the isolated backend. A direct service-only verification call may help a narrow UI test, but must not substitute for webhook/worker coverage. Outbound transport remains simulated in automation; real phone acceptance is a separate release check.

Use Chromium desktop first, then Chromium at 390 × 844 and WebKit at a phone viewport for the critical path. Add Firefox desktop once that path is stable. Include 320px and 430px widths for small/large-phone layout checks. Real-device WhatsApp app switching still needs a phone walkthrough.

Evidence per run: frontend/backend commit IDs, environment label, browser/viewport, scenario IDs, timestamps with timezone, assertion results, request IDs, failure screenshots/traces and an independent database result. Use fictional data, redact credentials/cookies/challenges, and avoid placing patient contact or symptoms in analytics artifacts.

Evidence levels stay separate: component test, API/database test, real browser with synthetic provider, deployed HTTPS check, and actual phone/provider result. A 200 response, success toast, reminder queue row or build alone does not prove an appointment or delivered message.

## 4. Browser scenarios

All filenames below are proposed under `tests/e2e/`. Each scenario is independent and uses the seed/fixtures described above. Existing API tests are referenced rather than duplicated at browser level unless browser wiring matters.

### A. Public pages and booking entry

**Seed:** `tests/e2e/seed.spec.ts` — fresh visitor on the built website.

**A1 — public-routes-and-recovery** (`public/public-routes-and-recovery.spec.ts`, P1)

1. Open homepage, doctor directory/profile, departments/detail, locations/detail, FAQ, insurance, pricing, contact, policies and article routes using valid roster/content IDs.
   - expect: meaningful page content, working images and intended navigation; no uncaught page errors or broken critical requests.
2. Refresh a deep link, use browser back/forward and open an invalid route.
   - expect: deep links survive host routing; unknown content has a recoverable not-found screen. Record HTTP status separately from SPA content.
3. Use search/filter controls with results and with no matches.
   - expect: correct doctor/specialty/location results, an actionable empty state and successful filter reset.

**A2 — every-booking-entry-reaches-authority** (`public/every-booking-entry-reaches-authority.spec.ts`, P0)

1. Start booking from header, hero search, doctor card, selected doctor profile, department/location and quick-slot CTA where present.
   - expect: ordinary booking ultimately reaches backend `/book/` and authoritative availability; a generic CTA may first request doctor selection.
2. Open `/schedule`, `/schedule/<website-doctor-id>`, legacy query routes and source/branch deep links. Resolve website doctor names against the real backend roster.
   - expect: no redirect loop; intended clinician/branch and acquisition source survive. Missing/ambiguous roster matches do not silently book another clinician.
3. Repeat with saved old design settings and explicit `booking_preview=true`.
   - expect: saved design choice cannot restore a prototype as ordinary booking. Explicit preview remains clearly labelled and creates no reservation.
4. Select a date/time in an old quick-slot UI before proceeding.
   - expect: backend revalidates or asks for a current time; sample/stale slot data is never treated as a saved reservation.

### B. Patient verification and saved appointment

**Seed:** `tests/e2e/seed.spec.ts` — backend `/book/` with isolated clinic data.

**B1 — verified-booking-persists-and-appears-for-staff** (`booking/verified-booking-persists-and-appears-for-staff.spec.ts`, P0)

1. Enter the test WhatsApp number, accept the actual privacy notice and request verification. Send the prepared message through the signed synthetic webhook; let the worker process it.
   - expect: correct-sender verification unlocks the original cookie-owned browser session. No demo six-digit-code shortcut is used.
2. Choose doctor, clinic, visit type, date and an available time; review the current fee; enter fictional patient information and choose reminder preference explicitly.
   - expect: selections match the backend roster, slot timezone is visible, and a valid temporary hold precedes confirmation.
3. Confirm the visit.
   - expect: receipt contains the backend appointment/reference, intended doctor/branch/time/fee and the correct test/production label.
4. Query the test database independently, then sign in as named reception staff and open the appointment list and schedule on that date.
   - expect: exactly one appointment and booked reservation; one confirmation event; reminder job presence matches consent. Staff can find the same reference, patient and time.
5. Reload and reopen the patient's visits while verification is valid; reload the staff view.
   - expect: saved appointment persists independently of React state and is not duplicated.

**B2 — verification-and-form-failures-recover** (`booking/verification-and-form-failures-recover.spec.ts`, P0)

1. Try missing privacy consent, invalid phone, wrong sender, expired challenge and absent verification.
   - expect: clear error/retry or reception fallback; no hold/appointment is created without authorized verification.
2. Leave WhatsApp unopened or stop the synthetic worker; retry without completing verification.
   - expect: no premature verification/success message; timeout or pending state remains usable.
3. Submit missing/invalid required patient fields; correct them and continue.
   - expect: actionable validation, retained valid values, no extra booking from failed attempts. Do not assume the old preview's DOB/email/gender fields are required in the new contract.
4. Expire the verified session and try viewing/managing visits; sign in again.
   - expect: safe re-verification path, no other patient's data and no stuck loading screen.

**B3 — retry-and-conflict-do-not-double-book** (`booking/retry-and-conflict-do-not-double-book.spec.ts`, P0)

1. Double-click confirmation and replay the same operation; simulate a lost response after the server commits.
   - expect: the original reference is recovered, exactly one appointment/event/reminder is stored, and retry does not allocate another slot.
2. Open two patient contexts competing for one slot; combine browser conflict handling with existing independent-connection PostgreSQL race tests.
   - expect: one successful allocation; the loser receives a recoverable conflict and refreshed availability.
3. Allow the hold to expire, change the fee or block the schedule before confirmation.
   - expect: no stale confirmation; user must choose/review again. Existing booked appointments remain intact.

### C. Scheduling and appointment management

**Seed:** `tests/e2e/seed.spec.ts` — unique verified fictional patient and reception user.

**C1 — availability-reflects-schedules-and-timezone** (`schedule/availability-reflects-schedules-and-timezone.spec.ts`, P0)

1. Set known doctor working hours, breaks, dated exceptions, blocked time and branch/visit-type constraints in the test backend.
   - expect: public availability reflects those rules; unavailable days have an explanatory empty state.
2. Test today/past time boundaries, next month/year, and a browser whose timezone differs from the clinic.
   - expect: no past/out-of-hours appointment; receipt, staff schedule and calendar export identify the same instant in the clinic timezone.
3. Hold/book/release/cancel a slot and refresh availability.
   - expect: booked or valid held capacity disappears; expired/released/cancelled capacity returns according to rules.

**C2 — cancel-and-reschedule-preserve-correct-state** (`schedule/cancel-and-reschedule-preserve-correct-state.spec.ts`, P0)

1. Cancel a future website visit, reload both patient and staff views and query persisted state.
   - expect: consistent cancelled status, capacity released and pending reminder handled according to its state; unrelated visits unchanged.
2. Reschedule another visit to an available time and retry the operation.
   - expect: one authoritative replacement, old capacity released and patient/staff time and fee review consistent.
3. Attempt a conflicting or expired replacement.
   - expect: original visit remains booked; no partial cancellation or orphaned capacity.

**C3 — staff-block-checkin-and-permissions** (`schedule/staff-block-checkin-and-permissions.spec.ts`, P0)

1. Sign in with named reception credentials, find the visit and check the patient in.
   - expect: persisted status and audit actor are correct; staff date/search filters still find it.
2. Preview a block affecting a confirmed visit; acknowledge the exact affected list and save.
   - expect: existing visits remain visible for staff resolution; outstanding incompatible holds are invalidated.
3. Attempt schedule/appointment writes while unauthorized or with an expired staff session.
   - expect: access denied and usable sign-in recovery; no unauthorized changes or data exposure.

**C4 — waitlist-calendar-and-directions** (`schedule/waitlist-calendar-and-directions.spec.ts`, P1)

1. Join a dated waitlist with consent; staff prepare a real capacity-holding offer; accept, replay, expire or withdraw it in separate tests.
   - expect: offer/appointment capacity is consistent, expiry returns the correct state and STOP ALL blocks prohibited outreach.
2. Download the appointment calendar file and use arrival/directions links.
   - expect: event matches confirmed time/timezone, correct destination and no broken link. Calendar download is distinct from external calendar synchronization.
3. Inspect messaging state.
   - expect: manual waitlist contact and queued reminders are not labelled as delivered. Automatic waitlist messaging remains outside implemented scope.

### D. Failure handling, phones and other public controls

**Seed:** `tests/e2e/seed.spec.ts` — fresh visitor; fixture state as needed per test.

**D1 — api-failures-and-disabled-booking-recover** (`resilience/api-failures-and-disabled-booking-recover.spec.ts`, P0)

1. Fail availability with timeout/500, return zero slots, and disable/unconfigure website booking.
   - expect: helpful loading/error/empty/unavailable state with retry or reception contact; no endless spinner or sample availability fallback.
2. Fail confirmation before commit and separately drop its response after commit.
   - expect: no false success; committed-state recovery is duplicate-safe.
3. Run with restricted storage and returning visitor design/consent settings.
   - expect: no crash or unauthorized account access; session/cookie loss has a clear recovery path.

**D2 — phone-and-keyboard-critical-journey** (`mobile/phone-and-keyboard-critical-journey.spec.ts`, P0)

1. Complete navigation, doctor selection, booking entry, verification return, date/time selection, confirmation and visit management at 320/375/390/430px widths. Exercise both design variants, open menu/submenu/login, sticky filters, date picker and preview OTP cells where present.
   - expect: menus/buttons can be tapped, dialogs can close, keyboard/focus are usable, controls remain visible and no essential action is obscured or clipped.
   - expect: no horizontal body overflow, including long doctor names and search cards; fixed headers, sticky controls and device safe areas do not cover essential actions.
2. Switch orientation/resize and use browser back; exercise keyboard-only navigation and reduced motion.
   - expect: state remains coherent, focus reaches labelled controls and no focus trap or broken overlay blocks completion.
   - expect: Escape closes the menu, focus returns to its trigger, and opening login from navigation does not leave competing modal/focus states. Check the real phone keyboard and WhatsApp app return separately from viewport emulation.
3. Record responsive failures with route, width, screenshot and reproduction.
   - expect: defects go to the mobile chat; test assertions remain in this testing scope.
4. Repeat critical navigation at 1440px desktop and on WebKit/real Safari.
   - expect: mobile changes preserve desktop layout, menu behavior and actual booking forwarding.

Initial mobile coordination update (before integration): the mobile chat completed its local QA and committed `2015478` on `codex/mobile-layout`, based on main `cc968e2`. The same fixes are now present as unstaged source changes in the primary checkout; preserve them. Its [QA report](mobile-responsiveness-qa.md) records 45 tests/build passing, width/interaction checks in both designs, a corrected 320px search-card overflow, and iPhone simulator Safari homepage visual evidence. This testing chat inspected the report and observed the changed files; it has not independently repeated those browser checks. Physical-phone keyboard, pinch zoom, orientation and simulator touch remain unverified. Integration with appointment PR #2 is still required: apply the mobile changes selectively, preserving `/book/` forwarding and clinic/source context rather than replacing `App.tsx` from the older main base. The mobile checks exercised preview booking/login, not saved appointments or live delivery.

**D3 — login-contact-voice-and-analytics-boundaries** (`public/login-contact-voice-and-analytics-boundaries.spec.ts`, P1)

1. Exercise patient sign-in/register controls, reception contact/WhatsApp links and legacy `/admin` entry.
   - expect: advertised actions function or are honestly identified as previews. Do not claim an account is registered from client-only state. Legacy admin reaches the authenticated backend workspace.
2. Open `/talk/` and consent controls with voice disabled, unavailable and locally simulated.
   - expect: usable unavailable/fallback behavior and no unintended call. Actual Sarvam calls, booking, recording and transcripts require separate live acceptance if enabled for launch.
3. Reject/accept/revoke analytics consent, book a test visit and inspect allowed events.
   - expect: no collection before consent, no patient/health data in payloads, no preview counted as confirmed booking. A real PostHog query is required to prove ingestion when configured.

## 5. Deployed release checklist

Use the new release's actual URL once it exists. First run read-only checks; destructive/concurrency testing stays in disposable staging.

- Record the deployed frontend/backend revisions and CI result; ensure both companion changes and migration `0011_booking_journey` are present.
- Route `/book`, `/book/`, `/api/v1/`, `/staff/` including assets, and `/talk/` to the intended backend on the same HTTPS origin. Verify redirects preserve query parameters and deep links do not return the wrong SPA shell.
- Check the actual build uses intended backend/voice URLs; no request may go to the visitor's `127.0.0.1`/localhost. Vite development proxy success does not prove production proxy configuration.
- Configure booking enablement, exact origin, clinic WhatsApp number, signed webhook, active module and healthy worker. Confirm production Secure cookie and CSRF requests through the real reverse proxy.
- Use the intended database and approved clinic roster/fees/schedules; verify backed-up storage and staff access. Do not reset an existing database to make tests pass.
- On a designated test phone/slot, complete one real verification and booking, verify the saved reference in staff and authoritative storage, reload, then cancel the designated test visit. Test data must be identifiable and cleanup restricted to that data.
- If promised at launch, verify actual reminder/confirmation delivery, voice call results and analytics ingestion independently. Queue acceptance and provider API acceptance have different evidence from phone receipt.
- Verify reception fallback when a dependency is unavailable. Google booking links should reach working clinic booking; native Google slot publishing, payments, automatic waitlist messages and external calendar synchronization are not features proven by these PRs.

## 6. Completion criteria and output

Report every scenario as **PASS**, **FAIL** or **UNVERIFIABLE**, with its evidence level and reason. Keep an issue list with severity, route, browser, observed/expected result and reproduction. Unsupported launch requirements become explicit blockers rather than skipped green tests.

Release acceptance requires green CI on the intended revisions; all P0 browser/API cases passing with no skipped PostgreSQL races; a booking independently saved and visible to staff; correct schedule/cancel/reschedule behavior; no unauthorized patient access, duplicates or false confirmations; and deployed HTTPS/provider evidence for every enabled launch promise.

Proposed run cadence once implemented: component/API tests and Chromium smoke per PR; complete booking/PostgreSQL integration for booking changes; phone/WebKit critical path before release; read-only HTTPS smoke immediately after deployment. A recurring production monitor has not been requested or created.

Initial report (superseded by implementation): local website baselines passed and backend PR CI failed. That failure has been reproduced and fixed. The integrated mobile, booking and browser work is documented in [the execution report](website-test-results.md); use its validation record and final PR checks. Deployed HTTPS and real-provider acceptance remain separate checks.

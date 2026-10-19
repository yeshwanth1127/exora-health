# Takeover review after Claude — DOB, registration and dashboard refinements

Reviewed baseline `9893190` on branch `codex/admin-dashboard-arc`. Continue in `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW`, staff application `HMS_NEW/apps/staff-web`. The user explicitly requested takeover and these refinements. No new component-selection wave was started.

## Changes requested by the user

| Before | After | Why |
| --- | --- | --- |
| DOB calendar required repeated month navigation or an undiscoverable keyboard shortcut | Searchable Month and Year columns above the existing Arc calendar, in registration and demographic edits | Jump directly to a birth year; year choices cover 130 years and retain older persisted years |
| Registration appeared below patient search and an empty-state Focus search button | Registration replaces patient lookup; the first name receives focus; Focus search removed | Give one clear task at a time |
| Walk-in and check-in patient-link forms could also show search and registration together | Those flows switch between lookup and registration with a Back to patient search action | Consistent behavior without dropping draft protection |
| Appointment search occupied a full extra row | Bounded search beside the date controls, with a soft Arc field, clear control and concise search/result state | Reduce space and clarify that the date and filters bound the results |
| Chart tables used browser-native View data triangles | Labeled View data table controls with table and chevron icons | Keep exact-value tables accessible without native marker styling |

Month/year selection changes only the displayed month; it never writes a DOB until a day is chosen. Optional/required/bounds/native-constraint behavior remains. The feature is opt-in, leaving ordinary operational date pickers unchanged. Switching away from registration still uses `requestLeave` and preserves pending/unknown-command blocking. The user explicitly authorized these refinements to the reference presentation; they are recorded in the source manifest.

## Review of Claude's work

The baseline includes Pro Split bar, Skeleton morph, Team directory, Release readiness, My alerts with persisted marks, and the booking Availability picker. Those additions were preserved. Review concentrated on application bindings, alert state/permissions/dates, booking selection and hold state, and the current runtime. This was not a fresh exhaustive visual audit of every component or a deployment/security acceptance review.

| Before | After | Why |
| --- | --- | --- |
| Dashboard 5198 still proxied to primary API 3079, whose GET /v1/me/alerts returned 404 | Dashboard 5198 now proxies to the isolated worktree API 3080; verified GET /v1/me and /v1/me/alerts both return 200 | Make Claude's real alert routes available on the URL the user uses |
| Bell could momentarily show all clear while enabled sources were loading | Bell shows Checking alerts; My alerts uses the existing loading component when no alert data has resolved | Loading is not evidence that nothing needs attention |
| Mark failures were exposed only on the Alerts page; rapid Read/Done/Undo writes could overlap | Failure toast plus bell/page feedback; mark operations saved in order; My alerts has Refresh alerts | Make failures visible and prevent older operations from overwriting newer intent |
| Staff invite alert source loaded once per mount | Invite source uses the same polling interval as other alert sources | Keep expiring invite status current |
| Registration expiry used the end of the UTC day | Expiry is compared as a clinic calendar date; own alerts link to My account rather than the restricted Team section | Respect clinic date boundaries and give staff an accessible destination |
| Snooze midnight relied on locale-string offset guessing | Existing clinic-time conversion handles next midnight, tested across US DST changes | Preserve the actual clinic midnight |
| Any scoped staff.manage grant could retrieve all tenant team-registration alerts | Team registrations restricted to staff whose active clinic grants are fully covered by the manager | Match the existing registration-management scope boundary |
| AvailabilityPicker disabled only its final action | Pending holds/releases disable both day and time selection, including keyboard movement | The displayed selected time must not change while its hold is being created |

The team-registration read fix preserves tenant RLS and requires no migration. Its API regression test includes staff in the permitted clinic, an unrelated clinic, both clinics and an every-clinic grant. The existing six tests still cover own marks/registrations, manager visibility, read/dismiss/snooze, bulk read, validation and sign-in. Tests use `hms_test`; no clinic/patient/fee/appointment data was written to the running `hms` database during this takeover. Dev login creates only an ephemeral token.

## Verification

- PASS: 196 frontend tests, including two DOB navigation-model tests, DOB caption rendering, pending-hold disabled controls, registration expiry at clinic midnight and DST snooze boundaries.
- PASS: 7 API alert tests, with isolated test-database fixtures (`PG_PORT=54339 node_modules/.bin/vitest run apps/api/src/http/alerts.test.ts` from the nested app root).
- PASS: frontend TypeScript/production Vite build and backend TypeScript check.
- PASS: focused lint with no errors; inherited reference Fast Refresh/render-purity and Booking effect warnings remain.
- PASS: source-manifest digests and `git diff --check`.
- PASS: readonly HTTP authentication and alert-state reads through the normal 5198 dashboard proxy; no tokens logged or persisted.
- UNVERIFIED: this wave's rendered appearance, interactive pointer/focus behavior and motion parity. The user retains visual verification; no browser automation was used.

## Current runtime

Use `http://127.0.0.1:5198/staff/`, seeded local subject `priya` (Priya Nair, admin). A full reload may require Open workspace again because tokens remain in memory.

- Vite 5198: isolated staff app; `HMS_API_PROXY_TARGET=http://127.0.0.1:3080 VITE_HMS_DEV_LOGIN=true VITE_HMS_DEV_SUBJECT=priya node_modules/.bin/vite --port 5198 --host 127.0.0.1`.
- API 3080: isolated nested root `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW`; `PG_PORT=54339 PORT=3080 node_modules/.bin/tsx apps/api/src/main.ts`.
- Existing Vite 5199 also uses API 3080. The old primary API 3079 remains running but is no longer 5198's target.
- Worktree-only ignored `.env.local` now records the 3080 proxy target and Priya default; primary configuration is unchanged. Database and catalog servers are reused.

The component count remains Claude's current **32 adopted + 5 support = 37 folders**. The new date-caption helper and chart-table disclosure are application refinements, not newly surveyed Arc components. Earlier survey counts and evidence levels must remain distinct from integrated-folder counts.

Remaining visual review: direct birth-year selection, switching between registration/search with a dirty draft, appointment toolbar search, both Overview table disclosures, bell failure/loading state and pending booking selection. Claude's previously documented reduced-motion, doctor/front-desk and busy-slot browser gaps remain unverified here. Do not treat this source/API review as closing those browser-review gaps.

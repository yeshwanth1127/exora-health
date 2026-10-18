# Desktop review fixes — 18 October 2026

Implements the user's four browser comments plus DOB, permissions, doctor-panel and feedback requests. No new patient, doctor, fee or clinical data was submitted for verification. Visual verification remains with the user.

| Before | After | Why |
| --- | --- | --- |
| Search, Clinic and Local preview clustered at the header's right; repeated page name at left | Centered workspace command-search trigger; duplicate name and preview badge removed; desktop collapse control moved into the left sidebar below its brand | Keep the header focused and retain the page's existing title |
| Clinic switching in header | Workspace settings → My account → Current clinic | Preserve permitted-clinic switching, including its leave guard |
| Header/content could shrink in the sidebar flex layout, letting headings slide under the header | Stable 72px header and non-shrinking content inside the existing scrolling page | Keep title/content below the header |
| Schedule doctor search used a native label with leading-none | Arc SearchField with the same 20px label line, 8px gap and 44px control as adjacent choices | Align baselines, height and spacing |
| Patient matches rendered as oversized centered buttons | Arc Combobox using the existing debounced server query; result labels include name, MRN and phone | Keyboard-selectable, identifiable results with the demonstrated listbox behavior |
| Native visible DOB inputs in registration and patient edits | Shared DateField backed by Arc DatePicker/Calendar | Preserve optional empty values and YYYY-MM-DD calendar-day values |
| Doctor sheets capped at narrow default sizes | Both Add doctor and Doctor details use up to 960px width, capped at viewport minus 80px, with larger header padding | Give profile, permissions and fee forms room |
| Role review showed comma-separated permission codes | Backend permission descriptions grouped by module; unknown future codes get readable fallbacks | Preserve every actual grant without exposing raw API keys as the explanation |
| Important direct HMS saves had no toast | Arc success feedback after confirmed patient registration/edit, doctor affiliation, calendar, profile, contact, fee and prerequisite creation results | Confirm the actual completed step |

The calendar keeps the selected demo's month navigation and keyboard support; Shift+PageUp/PageDown navigates years. A dedicated DOB year/month dropdown or typed-date editor has not been added. Disabled/required/bounds validation remains in a screen-reader-hidden native constraint control; the visible picker is Arc.

Patient search remains server-backed and permission-filtered. Fewer than two characters does not query the API. While a new debounced query is pending, old results cannot be selected. Inactive patients remain disabled. Server matches are not filtered again by the display label, preserving normalized phone/MRN matches. All patient IDs and registration bindings are unchanged.

The sidebar's optional `togglePlacement` retains the original header placement by default. The application explicitly opts into the user's new left-sidebar placement; the existing narrow-screen navigation fallback is retained without a phone redesign.

Toast success messages are inside existing confirmed-result branches. No toast claims invitation delivery, provider connection, available appointments, successful recovery of an unknown write, or completion of the entire multi-step doctor setup. Existing persistent error/recovery alerts remain.

## Checks

- PASS: TypeScript and production Vite build; the existing large-chunk advisory remains.
- PASS: 178 staff tests, including DOB shared-label/native-constraint checks and exact permission-description coverage with an unknown future permission.
- PASS: focused lint without errors; inherited App effect and reference DatePicker render-purity warnings remain.
- PASS: `git diff --check` and source manifest digest verification.
- UNVERIFIED: rendered appearance, pointer/keyboard interactions, toast visibility and latest Arc parity. User retained visual verification; no browser automation was performed for this wave.

The earlier login repair is local runtime configuration: worktree `.env.local` defaults to seeded `priya` (Priya Nair, admin). The former `sri-lakshmi-admin` default had no active local account and returned 403 from `/v1/me`. Both direct API and Vite-proxied Priya authentication were verified; no access token was written to documentation or persisted in browser storage.

# Desktop Arc component rollout

Implemented in `codex/admin-dashboard-arc` after the sidebar pass, in the isolated HMS_NEW worktree. The primary checkout's unrelated work is untouched. No phone optimisation, larger analytics blocks, scheduling calendar or roles matrix work was included.

## Placement

| Component | Dashboard placement | Application binding |
| --- | --- | --- |
| Tabs | Appointments / Waitlist / Queue; Staff activity / System status | Existing routes, permissions and leave guard |
| Combobox | Appointment doctor filter; header clinic picker | Stable doctor and permitted clinic IDs; searchable labels |
| Filter toolbar | Appointments, below date/doctor controls | Server-side doctor, status and visit-mode filters, removable chips and clear-all |
| Input | Patient registration given name, family name and phone | Existing registration command; validation after interaction, no synthetic saves |
| Metric card | Overview and numeric system-status metrics | Existing metric values and explanatory text; unknown values remain explicit |
| Bar chart | Overview daily bookings | Existing 14-day clinic-date booking counts, accessible data and scrubbing |
| Line chart | Website analytics visitors each day | Existing selected-range visitors; development sample-data notice retained |
| Date-range picker | Staff activity report filters | Organisation calendar dates, atomic from/to update, presets, apply/cancel and all-dates reset |
| Command palette | Header Search / Cmd-K or Ctrl-K | Permission-filtered existing routes and booking action; existing leave guard |

## Fidelity and integration

The local recreated Arc demos remain the reference. Component TSX and CSS were copied directly from that local library; `component-source-manifest.json` records original and integrated SHA256 values. The date-range picker has one data-binding extension: an optional `today` value so reporting presets follow the server's organisation timezone. One inherited trailing space in command-palette CSS was removed; all other newly copied component files retain their source bytes. The scoped foundation preserves the reference light neutral tokens and original font assets instead of inheriting dashboard overrides.

Host integration changes preserve floating menus: appointment filters and report controls use cards with visible overflow. The command modal delegates Escape from the search field to Arc: clear the query first, then close. Required clinic context changes only after a valid selection; clearing the picker starts a draft with an explicit 'Still viewing…' description, while source search/clear/selection behavior remains intact. Clearing a doctor selection maps to the existing all-doctors API filter.

Report day strings round-trip without UTC conversion. Unknown organisation timezone retains the existing explicit fallback; a filter refresh retains the last server-confirmed timezone in the mounted clinic workspace. A stable day snapshot follows organisation midnight and focus/visibility changes.

## Verification

- PASS: TypeScript project compilation and production Vite build.
- PASS: 167 staff-web tests, including four new tests for exact filter identities, duplicate doctor labels, ambiguous labels, calendar-day round trips across timezones/DST, and organisation-relative Today.
- PASS: focused lint for the integration files (one existing App.tsx set-state-in-effect warning); no lint errors.
- PASS: desktop browser navigation with the local API and development identity. Doctor search and keyboard selection; booking-status chip addition and clear-all; automatic keyboard tab activation; command search, first Escape clearing and Enter navigation; registration blur validation; dirty-form cancellation and subsequent clean navigation; calendar preset selection and atomic Apply were exercised.
- PASS: expanded date panel visibly fits above surrounding cards after the overflow fix. Overview metrics, booking chart and visitors chart render with existing data; the visitors chart exposes date scrubbing and an accessible data table.
- PASS: `git diff --check`.
- Scope: local desktop implementation and browser evidence only. Existing website analytics is a labelled UI preview with sample numbers, not a provider connection. No patient was registered or clinical record saved during verification. Full reduced-motion/assistive-technology coverage and exhaustive frame-by-frame parity of every demo state are not claimed.
- Build retains the existing large-chunk warning; bundle splitting was not added to this focused UI change.

Screenshots: `rollout-appointments.jpg`, `rollout-overview.jpg`, `rollout-registration.jpg`, `rollout-visitors.jpg`, `rollout-date-range.jpg`, `rollout-command-palette.jpg`.

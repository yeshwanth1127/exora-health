# Overview KPI reporting — 19 October 2026

The user approved the recommended KPI drilldown after the four-explorer selection review. This implements **KPI drilldown on Overview**. Metric explorer remains an alternative; Revenue and Choropleth remain deferred. No other explorer is installed by this wave.

## Before / after

| Before | After |
| --- | --- |
| All-time appointment/retained-confirmation/voice tiles plus a separate 14-day creation chart | Six Arc cards with 7/30/90-day totals, daily trends and equal-length previous-period comparisons |
| No range-specific breakdown contract | Exact current/previous counts by stable doctor ID or originating channel |
| Reference headline takes the last daily value; its breakdown estimates values from shares | Exact period totals and exact breakdown values supplied by the application |
| All-time status/channel mix and current operations | Those sections remain explicitly all-time/current; doctor-hours and local-job cards remain. Recent appointments and setup remain |

## What the numbers mean

The report is a read-only view of stored booking records, **not proof of comprehensive historical collection, attendance, revenue, delivery or provider activity**. Dates use the selected clinic's timezone. Today is explicitly partial. It is the current database snapshot, not a historical status-as-of reconstruction.

| Metric | Date basis / inclusion |
| --- | --- |
| New bookings | `created_at`; original records only (`rescheduled_from_id IS NULL`). A replacement is not a second new booking |
| Visits due | `session_on` of currently non-cancelled appointments. Includes current no-shows; this is not attendance |
| Check-ins | `checked_in_at`, including visits later completed |
| Completed visits | `completed_at`, including completions of replacement appointments |
| Cancellations | `cancelled_at` of currently cancelled appointments, excluding records with a reschedule successor |
| No-shows | `session_on` of appointments currently marked `no_show`; not the day the mark was applied |

The earlier assessment had not yet inspected all event timestamp columns. This wave confirms `checked_in_at`, `completed_at` and `cancelled_at` in `20261010100900_m04_appointments.sql`, and binds those actual fields. No attendance/conversion rate is added. No department dimension: a practitioner can have multiple affiliations and a naive join would double-count appointments.

Each range includes its end date. A 7-day current period compares with the immediately preceding 7 days; similarly 30/30 and 90/90. Headlines are sums. Each doctor's/channel's row is an exact independent sum, including previous-only groups with current value zero. Equal doctor names retain different IDs. Shares are presentation only and never used to recover counts.

History starts at the earlier of clinic creation and its earliest stored appointment creation, converted to clinic date. The response has 180 calendar positions; positions before that boundary are **null**, rendered as chart gaps. Known dates with no stored events are zero. A partial current period reports only recorded counts with a visible incomplete-period warning. Incomplete previous periods have null totals/deltas. Positive current counts against a zero previous count show an unavailable percentage; zero against zero is 0.0%. Current/prior periods are not extrapolated or seeded.

## Implementation map

Paths are relative to the nested `HMS_NEW/` app root unless stated otherwise.

- `packages/contracts/src/operations-kpis.ts`: shared runtime schema, six metric IDs, three ranges, 180 nullable daily positions, exact totals and rows.
- `apps/api/src/modules/booking/operations-kpis.ts`: one tenant-scoped read transaction; stored-event aggregation, history boundary, range summaries. No patient identifiers, phone, MRN, visit reason or clinical notes in the response.
- `apps/api/src/http/routes/booking.ts`: `GET /v1/operations/kpis?facilityId=<uuid>&date=<YYYY-MM-DD>`. Requires `appointments.read` at that clinic. Validates real calendar dates and rejects ends after clinic-local today. Tenant RLS remains active; no new grant/module role or write operation.
- `apps/staff-web/src/hms/Overview.tsx`: existing scoped query lifecycle and refresh; response clinic/date/timezone validation; loading/error/stale handling. The enclosing workspace already remounts on tenant/staff/clinic change. Existing setup, summary permissions and operations page remain.
- `src/hms/overview-kpis.ts`: validated app adapter, integer formatting and calendar range caption helper.
- `src/hms/OverviewReporting.tsx`: range/date/history/update captions and scoped Arc placement.
- `src/modules/operations.tsx`: optional reporting/refresh slots. Active HMS Overview replaces three legacy all-time cards and the redundant 14-day chart; retains current doctor-hours/jobs, all-time health mix and recent appointments. Other mounts keep their existing fallback.
- `src/components/arc/kpi-drilldown/`: captured JSX engine ported to ESM JavaScript with a typed public declaration, isolated CSS module and an explicit period-delta binding. This follows the prior Kanban port approach; no original TSX claim.

## Reference fidelity / adaptations

Local reference: `/Users/deepakonda/Downloads/test/arc-components/components/pro/kpi-drilldown/` → `src/Component.cjs`, `src/dependencies/79780.cjs` (CSS map), `dist/styles.css` and `docs.md`. [Demo](http://localhost:4477/components/pro/kpi-drilldown/demo/?theme=light).

The component's measured expansion/fold-back engine, range indicator, comparison switch, chart pointer/keyboard cursor, Escape handling, close focus/return-to-card behavior, springs, reduced-motion handling, card/table layout and original width remain sourced from the demo. Existing React, Motion, Lucide, Animated counter and motion tokens replace captured dependency bundles. Only matching CSS-map rules are extracted; conditional nesting is preserved and the captured global stylesheet is not copied.

Application/data extensions are documented in `component-source-manifest.json`: required supplied data (all SaaS sample generators/defaults removed), exact per-range totals/rows, an optional controlled-range callback for the external caption, missing-baseline semantics and null-history chart paths/tooltips. Daily trends retain the source's interpolated plotting; their tooltips use actual daily values. Partial-history area paths begin at the first known position. Rounded visual shares do not change row counts.

No dependency additions, phone optimisation, new browser sweep or visual acceptance claim. Source-parity and SSR/build checks do not establish rendered/motion parity; the user retains that review.

## Verification

- `apps/staff-web`: `npm test` — **234/234 pass** (seven new reporting tests); `npm run build` — pass, existing large-chunk warning.
- Nested root: `corepack pnpm typecheck` — pass.
- Nested root: `PG_PORT=54339 node_modules/.bin/vitest run apps/api/src/http/operations-kpis.test.ts apps/api/src/http/api.test.ts` — **51/51 pass**, including nine new reporting/aggregation tests. Test setup resets only the configured **test database**, not local `hms` data.
- Cases include clinic-local midnight, actual event dates, original/replacement/reschedule cancellation accounting, exact row sums, 90-day history, leap-day boundaries, zero/missing comparisons, equal-name doctors, previous-only groups, malformed/impossible/future dates, authentication, clinic permissions, tenant RLS and aggregate-only responses.
- Read-only local smoke through dashboard **5198** → API **3080**: HTTP 200; schema-valid six metrics, 180 daily positions and matching clinic/date/timezone. No patient/provider/domain writes used for the smoke. No production/deployment claim.

## Counts and continuation

**48 integrated folders = 44 adopted + 4 support; 201 unintegrated local catalog entries.** Documentation screening remains 249/249 (133 free + 116 Pro); zero remain for first-pass documentation screening. Historical named rendered observations remain 40; none added this wave. Folder counts are not full-screen migration or visual-verification counts.

Runtime remains `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW`, dashboard `http://127.0.0.1:5198/staff/overview`, isolated API3080, local DB54339. Restart only this worktree's API if needed:

```sh
PG_PORT=54339 PORT=3080 node_modules/.bin/tsx apps/api/src/main.ts
```

API source changes require a restart: this command is not watch mode. Vite remains on5198 and uses `HMS_API_PROXY_TARGET=http://127.0.0.1:3080`. User visual review is outstanding. Resume from this document, current source and catalog ledger; do not rescan the catalog or add Metric/Revenue/maps without a new request.

# Admin dashboard Arc handoff

> **Latest controls/confirmation follow-up (19 Oct):** read `growth-controls-confirmation-wave.md`. Growth switches/checkboxes now use Arc; all seven native growth confirmations use the existing Arc Dialog with current-permission and reviewed-record checks. **47 folders: 43 adopted + 4 support; 227 tests.** Source/reference provenance and current catalog ledger are updated. User retains visual verification; no provider/backend writes or browser sweeps.

> **Latest screen-coverage correction (19 Oct):** read `growth-screens-wave.md`. Active WhatsApp, Google Business and Website analytics now use scoped Arc tabs, metric cards, badges and appropriate charts; WhatsApp setup/search and growth date/time fields are migrated. Voice and Loyalty summaries/tabs are included. **46 component folders still; 219 tests.** The old count described copied components, not complete migration of every placement. Provider previews remain previews. Visual verification stays with the user.

> **Latest selection/count audit (19 Oct):** read `catalog-audit-2026-10-19.md` and `catalog-coverage.json`. Local catalog: **249 entries = 133 free + 116 Pro**. All have first-pass documentation screening after reviewing the remaining 83; no docs remain unscanned. **46 integrated / 203 not integrated**. **40** named historical rendered-demo observations are recorded; this is not exhaustive visual verification. Recommended small next wave: Tag input, compact hold Countdown and one confirmed-result Action button. Resizable panels and advanced audit JSON viewer are options. No dashboard code changed in this pass.

> **Latest implementation + screenshot fixes (19 Oct):** read `whatsapp-queue-settings-wave.md` first. WhatsApp Inbox uses the themed Arc Support conversation; **Queue** now has Arc Kanban / Table with reviewed, guarded status moves; Settings is full-page rather than an embedded frame. Refresh alignment and unscoped Board/Table styling were corrected from the user’s screenshots. **46 folders (41 adopted + 5 support), 214 tests**. Dashboard5198 → API3080; visual verification remains with the user. This supersedes the next-turn notes below.

> **Latest phase (19 Oct):** read `context-and-setup-wave.md` first. Extra patient hover context, staged doctor setup and Arc Settings navigation/scoped save bar are implemented. **44 Arc folders (39 adopted + 5 support), 207 frontend tests**. User retains visual review. Dashboard5198 → API3080. The user requested WhatsApp-themed Arc chat and Kanban **next turn**; source findings and continuation packet: `next-whatsapp-kanban.md`. This supersedes older counts/FYI status below.

> **Current approved wave (19 Oct):** read `arc-five-verification.md` first. Stepper, Dropdown menu, Timeline, Hover card and Radio cards are implemented; 42 Arc folders and 202 frontend tests. Runtime remains dashboard 5198 → worktree API 3080. Visual verification is retained by the user. The five FYI Pro suggestions are assessed in that document; Inbox triage was already built and the others were not added.

> **Latest takeover update:** read `takeover-review.md` first. Current normal dashboard 5198 uses the worktree API **3080**. DOB now has direct Month/Year columns; registration replaces search; appointment search and chart-table disclosures are refined. 196 frontend tests and 7 alert API tests pass. This supersedes the earlier runtime commands and DOB keyboard-only limitation below. Claude's 37 component folders are preserved.

Updated 18 October 2026 after the approved desktop component waves, local login repair and browser-comment refinements. This file is the continuation entry point. Read the repository-root `AGENTS.md`, then this file and `desktop-review-fixes.md` before changing anything. The latest UI work is complete at source/build/test level; the user retained visual verification.

## Exact target

| Item | Current value |
| --- | --- |
| Git worktree root | `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW` |
| Nested application root | `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW` |
| Staff app | `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW/apps/staff-web` |
| Branch | `codex/admin-dashboard-arc` |
| Dashboard | `http://127.0.0.1:5198/staff/` |
| Local API | `http://127.0.0.1:3079` |
| Local database | PostgreSQL on `127.0.0.1:54339`, database `hms` |
| Reference library | `/Users/deepakonda/Downloads/test/arc-components` |
| Reference catalog | `http://localhost:4477/portable/review.html` |
| Free reference demos | `http://localhost:4478/free-previews/<slug>/?theme=light` |
| Pro reference demos | `http://localhost:4477/components/pro/<slug>/demo/` |

The API process currently runs from `/Users/deepakonda/Documents/antigravity/HMS_NEW/HMS_NEW`; the Vite process runs from the isolated staff worktree above. No backend code was changed in these UI waves. `brave-mendel` is the chat's initial directory, not this dashboard implementation. Other Capture/Medplum/marketing previews and the primary staff checkout are separate targets. Preserve unrelated dirty primary-checkout work and reuse this worktree.

## Coverage: what has actually been run through

See `component-inventory.md` for the deduplicated ledger and demo links.

- 82 distinct candidates assessed: 24 first rendered survey, 22 additional first-pass documentation candidates, 33 second-pass documentation/source candidates, Date picker, Button, and initial Sidebar. Select/Search field revisits do not add to the unique count.
- 29 unique rendered references are documented across earlier passes, including Sidebar and the four later controls. Most candidates were screened at documentation/source level. This is not exhaustive behavioral verification.
- 25 adopted candidates plus 3 integrated support components = 28 current `src/components/arc/` component folders. The supporting copies are Animated counter, Calendar and Textarea.
- The latest 11-component wave and current desktop refinements have no rendered visual verification. The user specifically asked to handle that themselves and to minimize browser use.

## Implementation method and rules

1. The user's local recreated Arc demo is the authority for appearance, motion, dimensions, expanded states, hover/focus/disabled/error behavior, keyboard handling and dismissal. These are local recreations, not a claim to original proprietary Arc source.
2. Copy the selected component's TSX/CSS and necessary shared assets/helpers under `src/components/arc/`. Preserve the source's behavior. Use scoped reference tokens through `arc/demo-scope.css`; global dashboard styles must not silently restyle the selected demo.
3. Bind actual app values, stable entity IDs, callbacks and existing server operations through adapters. Extend an optional binding prop only when needed for app context; default reference behavior stays intact. Record it in `component-source-manifest.json`.
4. The user explicitly approved shared desktop field geometry: 44px height, 18px radius, 12px horizontal padding, 20px label line and 8px label gap. Required/disabled/error/hint semantics, native submit constraints and focus associations remain. Compact controls/calendar cells retain their source sizes.
5. Entity selection uses Combobox, short fixed choices use Select, record filtering uses SearchField. Patient lookup is now an actual server-backed entity picker, so Combobox is appropriate. Appointment doctor filtering stays in the filter toolbar, without a duplicate field.
6. The API remains authoritative for permissions, identity, date/time validation, fees and command outcomes. Preserve `requestLeave`, unsaved drafts, idempotency keys, version checks, recovery, stale reads and pending/unknown-write blocks. Do not infer successful writes from UI state.
7. Preserve domain values: YYYY-MM-DD calendar days without UTC conversion; HH:mm minute precision in clinic time; fees as integer paise/null with fixed INR; E.164/empty phone values. Unsupported or parser-truncated persisted phones use a native fallback to preserve the exact value.
8. Successful empty results, loading, stale data and failed reads remain distinct. No demo numbers, fake clinic records, provider connections, invitation delivery or availability claims should enter the real dashboard.
9. Desktop only. No phone optimization, broad page redesign or unapproved large replacement. Existing narrow-screen fallback behavior is retained where already present.
10. Do not drive the browser or capture screenshots to verify these newest waves unless the user changes their review preference. Use source/build/tests, report visual parity as awaiting the user's review, and avoid repeating catalog exploration already recorded here.

## Integration map

Paths below are relative to the staff app unless otherwise noted.

| File or area | Role |
| --- | --- |
| `src/App.tsx` | Real permission-filtered sidebar routes, command search, clinic selection binding, auth and directory context |
| `src/components/arc/sidebar/` | Typed sidebar adapter, local font and motion; app opts into left-sidebar collapse-control placement |
| `src/components/WorkspaceCommands.tsx` | Base UI modal/focus wrapper around Arc CommandPalette; Cmd/Ctrl-K; existing guarded routes/actions |
| `src/components/ClinicPicker.tsx` | Permitted clinic IDs; clearing is a draft, valid selection changes context through leave guard |
| `src/hms/Settings.tsx` | API-bound original settings; Appearance theme picker; My account now hosts Current clinic |
| `src/components/WorkspaceChoice.tsx` | Both existing Choice APIs share Select/Combobox, external labels and validation |
| `src/components/shared-field.tsx`, `field-context.ts` | Field ID, label, required/invalid state and description/error association |
| `src/components/WorkspaceFields.tsx` | Phone/Money/Time/Date adapters, existing value contracts and hidden native validation controls |
| `src/components/date-controls.tsx` | Arc day navigation; existing date/time bounds and clinic-day semantics |
| `src/hms/arc-report-range.ts`, `arc-filter-data.ts` | Calendar-day conversion and exact filter-label-to-ID bindings |
| `src/hms/WorkflowWorkspace.tsx` | Arc workflow tabs with current route/leave semantics |
| `src/hms/Patients.tsx` | Registration, demographic DOB, remote patient Combobox; confirmed registration/edit toasts |
| `src/hms/Doctors.tsx` | Wider Add/Details sheets, profile/contact/fee fields and actual-result feedback |
| `src/hms/role-permissions.ts` | Backend descriptions for every granted role permission; readable future-code fallback |
| `src/modules/schedule-timeline.tsx` | Arc doctor SearchField aligned with Time scale and Department |
| `src/hms/ui.tsx`, `src/components/workspace.tsx` | Shared Badge/Alert/LoadingState/Resource and existing action notifications |
| `src/hms/WorkspaceEmpty.tsx`, `src/components/WorkspaceLoading.tsx` | Actual-empty and loading adapters |
| `src/components/toast-events.ts`, `src/components/ui/sonner.tsx` | Result-message adapter and Arc ToastStack provider; legacy module path remains for compatibility |
| `src/hms/LeaveDialog.tsx` | Arc Dialog presentation around the existing leave state machine; longer workflows retain their own surfaces |
| `tests/arc-adapters.test.ts`, `arc-wave-two.test.ts`, `role-permissions.test.ts` | Binding/date/constraint/toast/permission regression checks |

The source manifest contains original and current integrated SHA256 values for copied free components plus documented optional bindings. The original Sidebar is a typed application adapter, not an unchanged free-component copy; its reference and deliberate placements are documented separately. Do not use source-byte similarity as a substitute for browser parity.

## Current refinements and manual review queue

All requested code changes are implemented. `desktop-review-fixes.md` records details. Review locations:

1. Any page: search centered in header, no duplicated page name, no header Clinic/Local preview cluster. Collapse control in the left sidebar below the brand. Check headings stay below the header when scrolling.
2. `/staff/settings?section=account`: Current clinic switch; confirm a valid permitted choice still respects an unsaved draft. Theme is `/staff/settings?section=appearance`.
3. `/staff/schedules`: Time scale, Department and Doctor labels/control tops align. The doctor control is free-text filtering, not a duplicated appointment doctor selector.
4. `/staff/patients`: patient search uses Arc Combobox; identify patients by name + MRN + phone; keyboard selection uses the source listbox. Inactive records cannot be selected and stale query results are hidden.
5. Patient registration and Edit details: visible DOB is Arc DatePicker. The selected source supports month navigation and Shift+PageUp/PageDown year navigation; no additional year dropdown or typed-date editor was invented.
6. `/staff/doctors`: Add doctor and Doctor details are up to 960px wide. In Create doctor staff account, Review role permissions lists backend descriptions grouped by module, including every grant.
7. Feedback: patient registration/edit; doctor clinic affiliation, calendar, profile, contact, fee, staff-account creation and department creation. Toasts report only confirmed saved steps. Errors/recovery remain persistent. Do not create disposable clinical/fee records merely to demonstrate a toast; use a user-authorized real edit or a future test fixture.
8. The rest of the prior specialist/feedback wave still awaits the user's review: time/phone/money, badges, tooltips, empty/skeleton, clipboard feedback, alerts, toast stack and unsaved-change dialog. Latest automated results do not establish visual/keyboard/motion parity.

## Pro wave (18 Oct 2026): Split bar, Skeleton morph, Team directory, Release readiness

Selection and conflicts: `pro-wave-shortlist.md`. Pro packages ship compiled reconstructions (`src/*.cjs` + captured `dist/styles.css`), not TSX, so each one was hand-ported to TSX. Logic, markup and motion follow the source. CSS was extracted from the captured stylesheet with class hashes removed. Digests and the binding notes are in the manifest (`kind: "pro-port"`).

| Placement | Component | Data binding |
| --- | --- | --- |
| Overview › Appointment health | `arc/split-bar` | Two bars, `by_status` and `by_channel`, from `/api/v1/admin/analytics` (`src/modules/split-segments.ts`). A zero total shows the existing Empty state; the View data tables stay. |
| Overview loading | `arc/skeleton-morph` | Wraps the metric cards, Daily bookings, Appointment health and Recent appointments. `Resource` no longer swaps Overview for `WorkspaceLoading`; errors and stale data are unchanged. Blocks get `width:100%` because they wrap cards, charts and a table rather than fit-content text. |
| Workspace settings › Team | `arc/team-directory` (+ `arc/avatar`) | Staff rows are mapped in `src/modules/staff-directory.ts`: team is the staff type, status text comes from the server status, and facts are Employee no. and Access. The email row appears only when an email exists. The existing Manage dialog is the profile action, and Add staff member is unchanged. |
| Overview booking setup guide | `arc/release-readiness` (+ `arc/checkbox`) | Approved adaptation: checks are read-only and come from `deriveSetup` evidence (`readinessTasks` in `setup-readiness.ts`). The final action is "Recheck saved setup", which reports an error if any active read fails. There is no notify switch, owner avatars or Start release. Hide guide, the visit type and Setup doctor go in the header/toolbar slots, and each check keeps its Continue/Review button. |

Shared additions in `arc/demo-scope.css`:

- the `--series-1..4` chart tokens;
- `.arc-section-frame`, which reproduces the demo frame's full-width stretch (the doubled class outranks the module width caps);
- `.arc-morph-tokens`, the two skeleton tokens, so shadcn content keeps its own tokens.

Browser check at 1440×900 light against the demos:

- **Release readiness:** layout, progress fill and the Recheck loading → success message.
- **Split bar:** mounted with sample-shaped data in a scratch container, because the seed DB has zero appointments, so the live card shows the empty state. Checked inside/short/outside labels with leaders, hover expansion with readout swap, and the legend toggle with total recompute.
- **Skeleton morph:** skeleton boxes match the content boxes (metric 368×194, chart 522×304), and blocks resolve in document order at 40 ms steps.
- **Team directory:** search, Escape-to-clear, team filter, selection, the empty state with Clear filters, and Manage opening the existing dialog.

Not verified:

- reduced-motion paths;
- Split bar keyboard navigation;
- copy-to-clipboard success in a real browser;
- a visual capture of the skeleton frame, because local data resolves in about 80 ms.

The deferred Doctor details skeleton was not done.

## Wave 3 (18 Oct 2026): My alerts, and the Availability picker in Booking

PRD: `docs/prd/staff-alerts.md` (approved; "As built" lists the real sources). Shortlist: `wave-3-shortlist.md`.

| Placement | Component | Data binding |
| --- | --- | --- |
| Header bell, beside search | `arc/notification-center` (free) | Open *Now* alerts from `src/hms/alerts.ts`, plus one "Some alerts could not be checked" item when a source failed. Read and dismiss go to `PUT /v1/me/alerts/:key` and `POST /v1/me/alerts/read`; the added Open action goes to the alert's page. |
| Sidebar footer › My alerts (`/staff/alerts`) | `arc/inbox-triage` (pro-port) | Every alert, in Open / Snoozed / Done (the component's Inbox / Snoozed / Archive). S snoozes until the clinic's next midnight, E marks done, U and Undo move back. The detail action is "Open <page>". |
| Booking › Doctor & time | `arc/availability-picker` (pro-port, approved by the user 18 Oct 2026) | Replaces the month calendar and slot buttons in `src/hms/Booking.tsx` (the old `AvailabilityCalendar` was removed; the teleconsultation-hours guidance is kept below the picker). A "Start date" Arc date picker (the existing `DayNavigator`) sits above it. The picker shows one doctor's first 10 open days in the 30 days from that date (`src/hms/booking-picker.ts`, `BookingPicker.tsx`). At the user's request, day numbers are smaller (`--text-lg`), the strip shows 10 square days, and times use the Booking pill's time step: chips with a sliding highlight, taken times struck through and arrow-key movement. The Booking pill was looked at as an alternative and not chosen: its date step is also a fixed 5-day strip and it begins with a guest count. "Hold this time" places the real hold; "Held" follows it; choosing another time releases it. |

Server: migration `db/migrations/20261018100000_m01_staff_alert_state.sql` (applied to the shared dev DB `hms`), routes in `apps/api/src/http/routes/alerts.ts`, own and team registrations in `apps/api/src/modules/access/alerts.ts` (team needs staff.manage). Client polling is `src/hms/use-alerts.ts` (60 s while visible), shared through `AlertsProvider` in `App.tsx`.

Browser check at 1440×900 light against the demos:

- **Bell:** trigger, badge, panel (424 px, radius 26) and item (63 px) match. Expand, Mark read (PUT 200, badge clears), Clear read → "All clear", and no requests while idle for 10 s.
- **My alerts:** row 48 px and the 6/28/132/1fr/64 grid match. U restore, S snooze (saved as the IST midnight), Undo with focus back on the row, and the status line.
- **Availability picker:** day tile 84 px, slot 48 px, heading 15.4 px line height, and the selected-day fill, slot check and footer match. Day switch, slot select, Hold (POST /v1/holds 201) → Held, and reselect → release (DELETE 200). Width follows the container (1136 vs the demo's 1312). Neither demo nor port has custom key handling.

Not verified:

- doctor and front-desk sessions (the seed DB has no appointments, so appointment, queue and waitlist alerts are unit-tested only, in `tests/alerts.test.ts`);
- reduced motion;
- the picker with busy slots, because only free slots are bound.

The user's API on 3079 runs the primary checkout without these routes, so its bell may say alerts are unavailable. The worktree API on 3080 (`hms-arc-api` in `.claude/launch.json`, Vite on 5199) has them.

## Local runtime and login

At handoff the dashboard, API, database and reference viewers are already listening. Inspect listeners first; do not start duplicate servers. PIDs are transient. Check with:

```sh
lsof -nP -iTCP:5198 -iTCP:3079 -iTCP:54339 -iTCP:4477 -iTCP:4478 -sTCP:LISTEN
```

If Vite needs restarting, use the isolated staff app as cwd:

```sh
HMS_API_PROXY_TARGET=http://127.0.0.1:3079 VITE_HMS_DEV_LOGIN=true VITE_HMS_DEV_SUBJECT=priya node_modules/.bin/vite --port 5198 --host 127.0.0.1
```

The worktree-local ignored `apps/staff-web/.env.local` is now a regular file selecting `VITE_HMS_DEV_SUBJECT=priya`. It previously symlinked to the primary checkout and defaulted to missing `sri-lakshmi-admin`. That identity minted a dev token but `/v1/me` returned 403/no active account. Seeded `priya` succeeds directly and through Vite and represents Priya Nair, admin at Demo Health Bengaluru. The primary configuration was left unchanged. Select Open workspace; no password is required for this local dev path. Auth tokens remain in memory; a full reload may require signing in again. Never write tokens into handoff files or introduce persisted browser tokens to work around this.

If the API needs restarting, use `/Users/deepakonda/Documents/antigravity/HMS_NEW/HMS_NEW` as cwd, matching the current process:

```sh
PG_PORT=54339 PORT=3079 node_modules/.bin/tsx apps/api/src/main.ts
```

The existing PostgreSQL cluster belongs to `/Users/deepakonda/.codex/worktrees/hms-dashboard-integrations/HMS_NEW/.pgdata`. If stopped, use that integration directory as cwd and `PG_PORT=54339 node db/scripts/local-pg.mjs start`. Reuse `hms`; do not reset/reseed the cluster or point at a nonexistent `hms_staff_integration` database. These UI tasks do not need a schema migration.

Reference viewer 4477 serves the `arc-components` directory. Viewer 4478 serves `/Users/deepakonda/Downloads/test/dnd/runtime-previews` with shared free-demo font fallback to `free-previews/tabs/public/_next/static/media/`. The current 4478 process was launched from a Python stdin script, not a checked-in service. If it is gone, reconstruct this read-only mapping before comparing fonts; a bare static server can leave some archived demos missing fonts. `font-rebase.css` for the 11 selected free previews was copied from the existing Combobox archive; the reference component TSX/CSS was not redesigned.

## Verification and commands

Run from the isolated staff app:

```sh
corepack pnpm test
corepack pnpm build
node_modules/.bin/oxlint src/App.tsx src/components/WorkspaceFields.tsx src/components/arc/combobox/combobox.tsx src/components/arc/date-picker/date-picker.tsx src/components/arc/sidebar/sidebar.tsx src/hms/Doctors.tsx src/hms/Patients.tsx src/hms/Settings.tsx src/hms/role-permissions.ts src/modules/schedule-timeline.tsx
```

- PASS (wave 3): 190 staff tests incl. `tests/alerts.test.ts` and `tests/booking-picker.test.ts`; API `apps/api/src/http/alerts.test.ts` 6/6 (run with vitest from the repo root, PG_PORT=54339); build; oxlint with no new warnings.
- PASS (Pro wave): 182 staff tests incl. `tests/arc-pro-wave.test.ts`; build; focused oxlint (only the reference measure-cache purity warning in split-bar).
- PASS (earlier): 178 staff tests; TypeScript project compilation and production Vite build; focused lint without errors; whitespace and copied-component digest checks.
- Existing large JS chunk advisory, App effect warning and reference render-purity warnings remain. Bundle splitting and reference animation rewrites were outside scope.
- Tests use `tests/register-assets.mjs` before tsx for CSS-module SSR. Use `corepack pnpm test`; running raw `tsx --test` without the loader breaks CSS imports. Vite builds the real styles.
- `pnpm` may not be in PATH; `corepack pnpm` works. Node is available and dependencies are installed. Do not reinstall dependencies just because bare pnpm fails.
- There was no browser automation or save/write verification for the latest wave. No deployment, production acceptance, clinical acceptance or full exact visual parity is claimed.
- Logged summaries for this session are `/tmp/arc-dashboard-refinements-tests.log`, `-build.log`, `-lint.log`; temporary logs may disappear, so use the checked-in results and rerun only when needed.

## Git history and continuation

Earlier completed milestones:

- `3da44d1`: initial Arc sidebar.
- `4b2c58b`: first nine selected component types.
- `a6496c2`: shared desktop controls, date/filter alignment, theme in Appearance.
- `1b38b6e`: next-wave selection report.
- `7bef558`: 11 specialist/feedback component wave.

The next commit on this same branch contains the current desktop review fixes and this handoff. Resolve it with `git log -1 --oneline` rather than assuming a copied SHA. Inspect `git status --short` before starting; local `.env.local` runtime configuration is intentionally ignored. There is no new PR or deployment for this handoff.

Resume from the user's new visual comments. Do not repeat the first/second catalog survey, reopen every demo, redesign phone layouts, or begin a new batch automatically. If the user wants more components, use the candidate ledger and rationale to shortlist a bounded next wave first. Dropdown menu, chronology-only Timeline, and uploads tied to real existing endpoints were possible next choices, not approved work. Roles permissions, Week calendar, notification center and provider-integration overviews remain deferred because their demo data/interaction contracts do not yet map directly to the app.

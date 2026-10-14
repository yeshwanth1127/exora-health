# Desktop audit implementation — 13 October 2026

Source audit: `/Users/deepakonda/Documents/antigravity/brave-mendel/docs/admin-dashboard-ux-audit/README.md`, snapshot `a3f320f`. Original implementation checkout: `HMS_NEW/apps/staff-web` on `codex/staff-frontend-integration`, merged via PR #1. Subsequent backend hardening is on `codex/audit-backend-hardening`.

Three agents worked in separate shared-UI, settings/recovery and setup/empty-state areas; root owned navigation, booking, scheduling, integration and desktop verification. Original neutral shadcn/Base UI/Geist design remains. The original desktop audit made no backend changes. The follow-up now adds backend contracts, migrations and persisted regressions for UXA01–UXA07; see [hardening record](AUDIT_BACKEND_HARDENING.md). Mobile, production and provider acceptance remain separate.

## Implementation packet status

| Packet | Status | Delivered / boundary |
| --- | --- | --- |
| W01 | Implemented | Compact workflow tabs preserve active text/background on hover, focus and pressed states. Actual hovered appointment tab measured white text on dark background. |
| W02 | Implemented pilots | Both field wrappers share IDs, visible labels, hint/error associations, blur/submit client feedback and immediate explicit server errors. Save predicates still decide validity. Failed initial reads are terminal; retained stale data is visibly read-only, lost authorization hides it. |
| W03 | Implemented active desktop flows | One in-app discard dialog for sidebar, workflow navigation, clinic change, local Back and indexed browser Back/Forward. Meaningful booking/walk-in/registration/settings/waitlist/schedule drafts guarded. Pending/unknown commands block discard. Native beforeunload remains the browser's page-unload warning. Holds claimed before asynchronous release to avoid double cleanup. |
| W04 | Implemented with UXA01 | Visit mode filters before server pagination. Cursor validation includes the mode; adapter removes page-local filtering. |
| W05 | Implemented date pilots; remaining capability boundary | Shared DayNavigator, DateRangeField and TimeRangeField preserve date-only/HH:mm values; Appointments, Queue, Activity and Schedules use task-specific date controls. Booking availability calendar already exists. Audit dates and exact bounds now use authoritative organisation timezone metadata (UXA06). Large entity choices now offer accessible search with stable selected IDs, supplied context and unchanged small enums; no new entity values are fabricated. |
| W06 | Implemented desktop | Shared field contract, compact workflow hierarchy, Settings section URLs, doctor fee ranges/details, clear action column, chart data disclosure and metric basis, capability owner notices. |
| W07 | Implemented desktop | One global clinic selector; doctor-first full-page recurrence editor instead of stacked choosing/editing sheets. Ongoing/final date, tomorrow rule/today one-off route, split-shift overwrite guard, slot presets, plain summary, existing server review/conflict semantics. Initial timeline stays on working hours; Now and Show working hours are explicit. Row actions use Book appointment plus Manage time. |
| W08 | Implemented inventoried recovery and backend guarantees | Frozen request snapshots, original intent keys, blocked changed intent and context changes, impact review, bounded dialogs and unknown-state recovery/readback. Keyed decline and authorised outcome lookup are implemented; policy/permission compare-and-set and actor-bound receipts have persisted regressions (UXA03/04/07). Outcome lookup remains limited to supported booking/waitlist scopes. |
| W09 | Partial with explicit contract boundaries | Authorised persisted read evidence for clinic, selected doctor/calendar, compatible current service/fee and future hours. Reads distinguish loading/unknown/known zero. Fully booked configuration stays configured. First-clinic bootstrap and exact session/service/date fee quote are implemented (UXA02/05). Video/signing/provider routing remain unchecked capabilities. |
| W10 | Implemented supported states; E19/E31 deferred | Progressive setup guide, useful permission-gated empty actions, no patient/booking/hold/provider data created to demonstrate setup. Unsupported full video readiness and full booking readiness remain explicitly unverified. See state map below and setup evidence map. |
| W11 | Local verification; deployment acceptance incomplete | Unit/SSR/adapter regressions, desktop walkthroughs and isolated persisted backend mutation/concurrency tests pass. Production, provider, mobile and retained-database upgrade acceptance remain unverified. |

## Findings closure

“Implemented” refers to code plus listed local evidence, not deployment or persisted-write acceptance.

| Findings | Status |
| --- | --- |
| F01, F07, F09, F11–F13, F15–F17, F19 | Implemented within desktop scope. |
| F03, F04, F08, F18 | Active desktop flows implemented; browser and uncertainty fixtures cover the shared paths. Full fault-injected persisted mutation acceptance remains unverified. |
| F02 | Resolved server mode filtering and cursor binding via UXA01; persisted HTTP pagination regressions. |
| F05 | Authorised first-clinic creation and bounded creator access implemented via UXA02; persisted concurrency and access regressions. |
| F06 | Doctor prerequisite paths, explicit partial affiliation/calendar completion and calendar-only resume implemented. Same-sheet staff-account and department prerequisite editors preserve the affiliation draft, reread/select actual saved IDs and resume read failures without creating again. Persisted multi-step acceptance remains unverified. |
| F10 | Shared date pilots complete; organisation timezone metadata and non-IST scheduling remain bounded/deferred. |
| F14, F20 | Supported contextual states/owner requirements implemented; complete provider readiness and full setup certification remain deferred. |

## Empty/onboarding state map

| IDs | Implementation |
| --- | --- |
| E01 | Zero-clinic evidence plus permission-gated bootstrap creation; atomic bounded creator grant. |
| E02 | Missing clinic access guidance and Refresh access. |
| E03–E07 | Same-sheet doctor staff/department prerequisites plus successful-load service/calendar prerequisites; permission-gated actions and partial calendar resume. |
| E08 | Setup future-hours check and doctor/mode schedule route. |
| E09/E10 | Booking calendar distinguishes returned published-but-occupied slots from no returned upcoming bookable slots; future hours are not inferred absent from a failed read. |
| E11 | Missing fee action; blank is not zero and failed price reads are unavailable. |
| E12/E13 | Dated appointment quiet state versus filters/page-local mode; clear filters keeps date. |
| E14/E15 | Find patient first, focus/edit search, explicit permitted registration after no match. |
| E16/E17 | Queue quiet/current versus historical empty; current-day/doctor/permission-gated walk-in action. |
| E18 | Waitlist known-zero request action. |
| E19 | Full video readiness deferred; no fabricated connection or clinical consent claim. |
| E20 | Dated video-worklist empty state with permitted booking route preselecting virtual mode; does not certify provider readiness. |
| E21 | Consultation quiet/filter mismatch and appointment/arrival action. |
| E22/E23 | Existing provider/runtime capabilities and integration-owner requirements; saved readable records preserved. |
| E24/E25 | Growth observed-zero cohort and activity filter mismatch with real review/clear action. |
| E26 | Successful empty review queue retains quiet “no reviews waiting” state; no mandatory create action. |
| E27 | Terminal initial errors/retry; stale readback explicitly read-only; permission loss hides rows. |
| E28 | Frozen unknown command; actor-bound original keyed replay. Declines have keyed recovery and an exact closed-offer outcome. Failed/forbidden recovery retains uncertainty. |
| E29/E30 | Existing server/adapter permission and suspended-module gating retained; no grants/module states changed. |
| E31 | Full “ready to accept bookings” claim deferred. Recorded configuration and exact booking eligibility are separate. |

O00–O07 coverage and precise read contracts: [setup evidence map](STAFF_SETUP_EVIDENCE_MAP.md). Recovery methods: [mutation inventory](STAFF_MUTATION_RECOVERY_MAP.md). New shared conventions: [UI conventions](STAFF_UI_CONVENTIONS.md). Backend additions: [ledger UXA01–UXA07](BACKEND_WORK_LEDGER.md#desktop-audit-follow-ups--13-october-2026).

## Verification record

Latest check results and desktop walkthrough are recorded below after integration. Existing data was not reset/reseeded. No staff grants, provider messages, clinical records or production records were written by this walkthrough. The only POSTs in browser verification were development sign-in and read-only schedule preview.


### Integrated local checks

- PASS: TypeScript project typecheck; frontend unit/SSR/adapter suite and Vite production bundle generation. Final counts are recorded below.
- PASS: lint has 0 errors and 17 warnings, matching the pre-change warning count. Bundle generation retains its large-chunk warning; no runtime/deployment performance acceptance is inferred.
- PASS: actual desktop walkthrough verified selected-tab hover contrast, pristine forms without premature errors, blur-triggered invalid phone/end-time feedback, preserved caller drafts after repeated browser Back, a single discard decision for nested schedule close, retained block reason while the range is invalid, read-only weekly-hours review, full-page doctor-first weekly editor, durable settings sections, staged booking-policy review, and waitlist doctor/time identity.
- PASS: compact doctor fee/action table fits the observed desktop viewport (1507 px page width, 1197 px table width). Setup progress counts four configuration checks separately from exact booking confirmation.
- Corrected during browser integration: the root doctor query was moved under a bootstrap workspace provider. The current signed-in waitlist, appointments, schedules, overview and doctor screens render after correction. Settings is independent of the doctor-directory loading gate. Denied-directory role acceptance has not been tested by altering real grants.
- UNVERIFIABLE in this pass: persisted timeout-after-commit writes, permission races, actual provider delivery, production deployment and mobile. No records were reset or seeded; no new business write was submitted.

Browser verification used the existing local API/database through the desktop preview. Synthetic form values were discarded without creating appointments, patients, holds or schedule changes. Development sign-in and read-only schedule preview were the only submitted browser POSTs.


### Final bounded pass results

- PASS: **123 frontend tests**, TypeScript typecheck, production bundle generation, and `git diff --check`. Lint: **0 errors / 17 warnings**, matching the baseline warning count.
- PASS: state-selector browser search focused the search input, filtered to Tamil Nadu while keeping the original trigger label, moved focus with Arrow Down, selected with Enter and reset its query on reopen. The changed clinic draft was discarded, without saving.
- PASS: same-sheet Add department opened with an existing unsaved affiliation role title; returning from a pristine prerequisite preserved that title without asking to discard it. Closing the parent still required one discard decision. No department/account was created.
- PASS: adapter regressions prove a confirmed weekly save performs no later conflict hydration, while unreadable conflict details still reject the read-only preview. Unblock now uses guarded non-keyed recovery; uncertain outcomes stay frozen rather than being replayed.
- Final desktop screenshot: `/Users/deepakonda/.codex/visualizations/2026/10/13/hms-ux-audit/desktop-overview.png`. Agent-created verification tab was closed; user tabs retained.

The supported desktop implementation is integrated. Backend-dependent closures and persisted/provider/production acceptance remain explicitly deferred; the packet/state tables above remain the authoritative boundaries.


### Restrained visual follow-up after rejected redesign

The broad redesign was reverted after user review. The original global stylesheet, native button component and neutral theme remain. Local accents identify booking/check-in next actions, statuses and destructive controls; added coloured panels, numbered cards and oversized default controls are removed. Weekly hours uses plain separated sections and the timeline toolbar aligns its labels and controls. Appointment controls are at the top, with no notification-job/messaging-preference sections. Medical history access refusal suppresses clinical registry/allergy/flag actions; the no-known-allergies action is an explicit native outline button on accessible records. Pristine fields no longer receive error-border styling before feedback is shown.

Local verification: 123 frontend tests passed; typecheck passed; production bundle generated; lint remained 0 errors / 17 warnings. Desktop browser inspection verified neutral appointment layout, schedule editor and the reported denied-chart case (no allergy/flag controls). These checks created no appointment, hold, clinical record or schedule write.


## Backend follow-up verification

UXA01–UXA07 are implemented with real isolated Postgres HTTP tests, including discarded committed responses and simultaneous administrators. Historical browser/unit counts above describe the original frontend pass only. Current combined evidence and migration requirements live in [AUDIT_BACKEND_HARDENING.md](AUDIT_BACKEND_HARDENING.md). This does not complete provider, production or clinical acceptance.

# Approved five-component wave — 19 October 2026

Implements Stepper, Dropdown menu, Timeline, Hover card and Radio cards after the user's approval of the complete shortlist, including the optional two. Branch `codex/admin-dashboard-arc`, isolated worktree `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW`. The five additional Pro links were supplied as FYI; their current status is assessed below, without starting another page replacement.

## Placements

| Before | After | Why |
| --- | --- | --- |
| Plain numbered booking labels | Arc Stepper at the top of Booking: Patient → Doctor & time → Review & confirm | Show current/completed progress; it is read-only, so the indicator cannot bypass prerequisites |
| In-person/video toggle buttons | Arc Radio cards under Booking → Appointment type | Explain the mutually exclusive choice and preserve exact in_person/virtual values |
| Several appointment-detail secondary buttons | Arc More actions menu for Move appointment, Cancel appointment and Mark no-show | Keep the primary Check in/Open consultation action and Patient details visible while reducing secondary-button clutter |
| Activity table only | Table and Feed presentation tabs, with Arc Timeline in Feed | Scan events by organisation day and expand full changes/identifiers; keep comparison and export |
| Patient names without identity previews | Read-only Arc Hover cards in Queue and Appointments | Show recorded name, initials, MRN, primary patient phone and status without opening clinical history |

## Application bindings

- Booking progress binds directly to the existing `step - 1`. Current Back/Continue buttons and the booking state machine retain ownership of navigation, duplicates, readiness, real holds, confirmation and unknown outcomes. No step-click navigation was added.
- Radio cards bind directly to `visitMode`. Both choices are disabled for an existing hold, busy/unknown command or pending release. Text describes visit mode only; it does not promise fees, availability, duration or a provider connection. The later optional Patients → After registration placement is not part of this implementation.
- More actions supplies the original guarded callbacks and permissions. Selecting Cancel or No-show opens the existing reason/confirmation flow; it does not submit a lifecycle command. Move still enters the existing rescheduling flow. The trigger and items carry the existing locked/move state. The main Appointments table retains its simple Open action; no redundant row menu was added. Waitlist Accept/Decline remain visible.
- Activity presentation uses the existing Arc Tabs with panels as direct children of the tabs root, preserving its panel measurement and motion. The existing filter state, single audit read, date boundaries, Show more cap, CSV export/truncation warning, stale/error handling and Break-glass review are retained. Table is the initial view. Feed requires the reported organisation timezone; if unavailable it tells staff to use Table rather than guessing the browser's timezone. New rows do not force-scroll a user reading older entries (`scrollToNew=false`, an existing source prop).
- Feed events carry original audit IDs, timestamps, actor and action/subject text. Expanded details retain the exact raw action, actor type, records, JSON changes/reason and request ID. No synthetic event, success classification or clinical data fetch is added. Relative time ticks once a minute while visible.
- Queue reuses its existing authorized PatientDetail read, passing the result to the hover content. Appointments mounts its PatientDetail query only inside the opened source HoverCard; closed cards do not start per-row contact queries. Hover navigation still uses the existing guarded `go` route. Without patients.read, the preview is absent. Registered patient phone comes from PatientDetail.contacts, preferring the recorded primary phone; bookingPartyPhone is never relabeled as patient phone. Missing phone is explicit. No next-appointment query, diagnosis, allergies, history or active controls are in the card.
- `arc/hover-card` retains its source hover/focus behavior, first-open delay, warm-card handoff, Escape and close grace. Preview content stays read-only. Visual/browser verification remains with the user.

## Sources and dependency

The five free TSX/CSS packages were copied from `/Users/deepakonda/Downloads/test/arc-components/free-source/components/arc/`. The source manifest records original and integrated hashes. Stepper, Radio cards and Timeline retain source bytes. Dropdown menu adds an optional disabled trigger binding and the scoped portal class; Hover card adds only the scoped portal class. No new component skin overrides were added.

Added the source Dropdown menu dependency `@radix-ui/react-dropdown-menu`; existing Radix Popover and Motion cover the other new components. Dependency installation skipped scripts. The inherited Sarvam SDK missing-node-bin warning did not block installation, compilation or tests.

Primary integration files (relative to staff app):

- `src/hms/Booking.tsx`, `src/hms/Appointments.tsx`, `src/hms/Queue.tsx`.
- `src/hms/PatientHover.tsx`, `patient-preview.ts`.
- `src/modules/settings.tsx`, `ActivityFeed.tsx`, `activity-feed-data.ts`.
- `tests/arc-next-wave.test.ts`, `arc-next-fixtures.ts`.

## Verification

- PASS: 202 frontend tests, including six new tests for read-only booking progress, exact/disabled mode choices, locked menu trigger, exact audit metadata, primary patient phone mapping/missing phone, and permission-gated closed hover cards.
- PASS: TypeScript and production Vite build. Existing large-bundle advisory remains; no bundle-splitting project was added.
- PASS: focused lint has no errors; the inherited Booking effect warning remains.
- PASS: copied-component manifest digests, 42-folder inventory and `git diff --check`.
- UNVERIFIED: rendered layout, frame-by-frame motion, interactive pointer/focus/menu behavior and browser hover requests. User retained visual verification. No browser automation, patient/appointment/fee writes, provider messages or deployments were performed.

## FYI Pro suggestions

| Component | Current assessment | Specific fit / conflict |
| --- | --- | --- |
| [Multi-step form](http://127.0.0.1:4477/components/pro/multi-step-form/demo/?theme=light) | Later: Add doctor is the strongest placement | Its fieldset wizard owns navigation and completion. Doctor account/invitation, affiliation, calendar and fees are separately saved steps with recovery, so it needs an explicit staged design rather than wrapping them in a final Submit. The current Booking flow only needed Stepper. |
| [Settings page](http://127.0.0.1:4477/components/pro/settings-page/demo/?theme=light) | Later, with scoped save semantics | Its gliding nav/save bar is attractive, but the demo simulates one settings save. Current team/role/policy/configuration writes have separate permissions, versions and confirmations. A shared Save all would misrepresent that contract. |
| [Support conversation](http://127.0.0.1:4477/components/pro/support-conversation/demo/?theme=light) | Later: potential WhatsApp conversation presentation | Retain the current distinction between local UI preview and real provider-backed operations. Typing, send/delivery, attachments and resolve state must come from supported thread endpoints, not the demo's simulated responses. No new message workflow was authorized in this batch. |
| [Inbox triage](http://127.0.0.1:4477/components/pro/inbox-triage/demo/?theme=light) | Already integrated | My alerts uses it with persisted Read/Done/Snooze marks. A separate WhatsApp adoption would need its own truthful archive/snooze/assignment bindings. |
| [Kanban board](http://127.0.0.1:4477/components/pro/kanban-board/demo/?theme=light) | Defer for clinic Queue | The demo allows dragging/reordering cards and editing checklist/detail state. Queue transitions have explicit call/check-in/skip/consultation commands; drag-to-column is not a substitute for them. There is no chosen persisted board-order contract. |

## Continuation

Current integrated inventory: **37 adopted + 5 support = 42 Arc component folders**. This is not a count of exhaustive browser verification or newly surveyed unique candidates. Reference selection coverage remains in the earlier shortlist documents.

The runtime remains the existing dashboard `http://127.0.0.1:5198/staff/` and isolated API 3080; no backend schema/route/configuration change was needed for this wave. A full reload may require Open workspace with the seeded `priya` identity. Resume from the user's visual comments; do not implement the FYI Pro blocks automatically.

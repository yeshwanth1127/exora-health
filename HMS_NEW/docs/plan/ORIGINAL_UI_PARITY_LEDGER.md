# Original staff UI parity ledger

Schema/workflow review: [frontend/backend contract decisions](FRONTEND_BACKEND_CONTRACT_DECISIONS.md). Preserve the original design while resolving incompatible semantics before enabling writes.

11 October 2026, Asia/Kolkata. User-directed scope: **frontend restoration and backend documentation only**. The dedicated backend agent owns API/schema/domain changes. No backend implementation is authorized for this frontend task.

## Why the interface looked incomplete

The first connected tranche retained the original source but mounted simplified replacements and hid backend-dependent screens. That did not preserve the original product detail in the active workspace. The source comparison identifies **53 feature groups across 16 original screens**. These are grouped UI requirements, not an endpoint count or a claim that every group is now complete.

The original current source is `/Users/deepakonda/.codex/worktrees/hms-monochrome/staff-web`. All 73 import-manifest file hashes still match that external source. That checkout remains untouched. The imported original app is preserved in `apps/staff-web/src/legacy/OriginalApp.tsx`.

## Restored in this frontend pass

- The actual original `ScheduleTimeline`, `WeeklyHours`, range and appointment-note components are mounted again. Doctor rows, original time scales, current-time marker, department/clinic/name filters, date navigation, drag selection, detail sheets, day groups, split shifts and the split-shift example are retained.
- The timeline projects existing scoped free-slot and appointment reads into the original presentation. It is explicitly partial: no inferred holds, blocked periods, full closure history or historical free time. Walk-ins do not get invented start/end times. Counts cover loaded records, capped at 500 appointments.
- Weekly/range/staff-note forms remain local drafts. Saved weekly rules and administrative notes are not interpreted as empty records. All original `Action` saves/previews under this presentation are disabled; no legacy mutation is sent. Normal connected strict-slot booking remains in the Appointments screen.
- Doctor directory regains specialty/clinic/fee/status/action layout and its booking-profile dialog. Unknown fee stays unknown. Profile changes are local drafts; Save is disabled.
- WhatsApp, voice, Google Business, growth and settings entries are visible with Pending labels/status pages. Their complete original form bodies remain in source; they are **not yet fully ported or wired**. Status-page tabs do not imply functioning provider modules.
- Design & UX guide now shows the source-derived integration map. Sidebar initials/role and page breadcrumb detail are restored.

## Feature-level inventory

| UI ID | Screen | Original detail | Current state | Backend ledger |
| --- | --- | --- | --- | --- |
| UI-overview-01 | Overview | Five clinic metrics and status/channel breakdowns | connected (Phase 5) | G12 |
| UI-overview-02 | Overview | Daily booking charts and recent appointments | connected (Phase 5) | G12 |
| UI-appointments-01 | Appointments | IST and all-date browsing, server search and paging | partial connected | G03; G09; G10; G19 |
| UI-appointments-02 | Appointments | Doctor/clinic/status filters and patient detail sheet | partial connected | G03; G09; G10; G19 |
| UI-appointments-03 | Appointments | Reasoned cancellation/no-show and patient-contact readback | partial connected | G03; G09; G10; G19 |
| UI-appointments-04 | Appointments | Administrative staff notes, exact-time moves and archive/delete policy | partial connected | G03; G09; G10; G19 |
| UI-doctors-01 | Doctors | Specialties and clinic affiliations in the directory | restored read or local draft | G13; G14 |
| UI-doctors-02 | Doctors | Consultation fee, active-in-booking and virtual-consultation editor | restored read or local draft | G13; G14 |
| UI-schedules-01 | Schedules | Doctor-day rows, date navigation and clinic/department/doctor filters | restored partial data or local draft | G04; G05; G06; G07; G08; G26 |
| UI-schedules-02 | Schedules | Compact/meeting/extra-space scales, sticky headers, current-time marker and overlap lanes | restored partial data or local draft | G04; G05; G06; G07; G08; G26 |
| UI-schedules-03 | Schedules | Click details, drag time selection and keyboard/pointer cancellation | restored partial data or local draft | G04; G05; G06; G07; G08; G26 |
| UI-schedules-04 | Schedules | Available/booked/blocked/held periods, reasons and hold expiry | restored partial data or local draft | G04; G05; G06; G07; G08; G26 |
| UI-schedules-05 | Schedules | Weekly doctor picker and repeat-day groups with split shifts | restored partial data or local draft | G04; G05; G06; G07; G08; G26 |
| UI-schedules-06 | Schedules | Effective dates, slot length and split-shift example | restored partial data or local draft | G04; G05; G06; G07; G08; G26 |
| UI-schedules-07 | Schedules | Review affected appointments, other published hours and resolve-before-save | source retained backend preview pending | G04; G05; G06; G07; G08; G26 |
| UI-schedules-08 | Schedules | Range appointment/open/block actions with exact start/end | book one slot connected; free-form range G08 | G04; G05; G06; G07; G08; G26 |
| UI-schedules-09 | Schedules | Virtual/in-person choice, clinic choice and explicit overbooking | restored partial data or local draft | G04; G05; G06; G07; G08; G26 |
| UI-schedules-10 | Schedules | Saved staff notes, exact-time move and unblock/reversal | move to a free slot and cancel connected; staff notes dropped | G04; G05; G06; G07; G08; G26 |
| UI-waitlist-01 | Waitlist | Waitlist requests and active filters | connected (Phase 6): status and doctor filters, add request | G11 |
| UI-waitlist-02 | Waitlist | Check availability and offer a slot with notification readback | connected (Phase 6): offer holds the slot 15 minutes, staff record accepted/declined; no message is sent until G19 | G11; G19 |
| UI-catalogue-01 | Hospital catalogue | Clinic locations and active status | connected read-only (Phase 5): permitted clinics | G13; G14 |
| UI-catalogue-02 | Hospital catalogue | Departments and doctor coverage | connected read-only (Phase 5): selected clinic departments and doctor counts | G13; G14 |
| UI-catalogue-03 | Hospital catalogue | Address, directions and arrival instructions in channel editors | navigation restored full design retained pending wiring | G13; G14 |
| UI-operations-01 | Operations | Notification outbox, temporary holds and API readiness | connected (Phase 5): live holds, readiness; messages "—" until G19 | G12; G19 |
| UI-operations-02 | Operations | Event delivery history and refresh | connected (Phase 5): outbox events, refresh | G12; G19 |
| UI-whatsapp-01 | WhatsApp | Overview and module readiness | navigation restored full design retained pending wiring | G20; G19 |
| UI-whatsapp-02 | WhatsApp | Conversation assignment and staff replies | navigation restored full design retained pending wiring | G20; G19 |
| UI-whatsapp-03 | WhatsApp | Doctor content, photos, guides and assets | navigation restored full design retained pending wiring | G20; G19 |
| UI-whatsapp-04 | WhatsApp | Campaign budgets, audience preview and approval | navigation restored full design retained pending wiring | G20; G19 |
| UI-whatsapp-05 | WhatsApp | Follow-up rules and manual triggers | navigation restored full design retained pending wiring | G20; G19 |
| UI-whatsapp-06 | WhatsApp | Delivery history and clinic contact/details | navigation restored full design retained pending wiring | G20; G19 |
| UI-voice-01 | Voice | Call readiness and versioned configuration | navigation restored full design retained pending wiring | G21 |
| UI-voice-02 | Voice | Call history, filters, metrics and appointment handoff | navigation restored full design retained pending wiring | G21 |
| UI-voice-03 | Voice | Consented recordings with expiry and access audit | navigation restored full design retained pending wiring | G21 |
| UI-voice-04 | Voice | Original/English transcript review and search | navigation restored full design retained pending wiring | G21 |
| UI-voice-05 | Voice | Live voice demo and provider interaction | navigation restored full design retained pending wiring | G21 |
| UI-google_business-01 | Google Business | Branch booking links and capability/readiness status | navigation restored full design retained pending wiring | G22 |
| UI-google_business-02 | Google Business | Link change history | navigation restored full design retained pending wiring | G22 |
| UI-google_business-03 | Google Business | Patient journey and website activity | navigation restored full design retained pending wiring | G22 |
| UI-growth_analytics-01 | Growth analytics | Acquisition/source filters and date range | navigation restored full design retained pending wiring | G22 |
| UI-growth_analytics-02 | Growth analytics | Conversion and engagement charts | navigation restored full design retained pending wiring | G22 |
| UI-growth_analytics-03 | Growth analytics | Journey, website activity and attribution limits | navigation restored full design retained pending wiring | G22 |
| UI-settings-01 | Workspace settings | Staff accounts and role selection | navigation restored full design retained pending wiring | G16; G17 |
| UI-settings-02 | Workspace settings | Password/account flow (must adapt to OIDC) | navigation restored full design retained pending wiring | G16; G17 |
| UI-settings-03 | Workspace settings | Permission controls and optional module switches | navigation restored full design retained pending wiring | G16; G17 |
| UI-settings-04 | Workspace settings | Demo controls separate from daily operations | navigation restored full design retained pending wiring | G16; G17 |
| UI-activity-01 | Activity log | Filtered activity with paging | connected: person, record, action, date filters, Show more; outcome filter dropped (only completed changes are audited) | G18 |
| UI-activity-02 | Activity log | CSV export and permission/care-access review | CSV export connected (audited, 5,000 rows); care-access review pending | G18 |
| UI-design-01 | Design and UX guide | Markdown design guide and product decisions | navigation restored full design retained pending wiring | G17 |
| UI-teleconsultations-01 | Teleconsultations | Original upcoming/waiting/needs-link/all concept tabs | live workflow connected concept design not fully ported | G34 |
| UI-teleconsultations-02 | Teleconsultations | Call-experience and patient-detail concept sheets; adapt to actual telehealth contracts | live workflow connected concept design not fully ported | G34 |
| UI-loyalty-01 | Loyalty program | Program, members and patient-view tabs | original concept not live feature | G23 |
| UI-loyalty-02 | Loyalty program | Sample membership editor and member details (original design concept) | original concept not live feature | G23 |

Machine-readable [parity records](staff-integration-audit/original-ui-parity.json) include the original module path. Original modules and nested forms are preserved even where their active integration is pending.

## Completion order after backend contracts

1. G04/G07: replace the partial board projection and unknown weekly template with authoritative scoped data. Preserve the original timeline and weekly sheet, not a new rule-editor page.
2. G05/G06/G08/G09/G26: connect original range previews, conflict resolution, commit/reversal, exact-time moves/overlap and administrative notes. Enable saves only after scope, revision and replay guarantees pass. Keep strict `/holds` booking separate from exact-range commands.
3. G03/G10/G11/G19: restore server search/all-date/cursor worklists, reasoned archive policy, waitlist offers and durable notification/manual-contact readback.
4. G12–G18/G24: wire overview metrics, operational events, full catalogue, profile/pricing, accounts/grants, module controls, audit and demographics. Password controls must be reconciled with OIDC; do not restore Python passwords against the new API.
5. G20–G23/G34: wire communications/growth modules and the remaining concept designs using actual provider and consent state. Loyalty was an original design concept, not an already operational backend feature.

## Backend agent handoff

The canonical [backend ledger](BACKEND_WORK_LEDGER.md) still has 40 open areas. The [master plan](STAFF_FRONTEND_INTEGRATION_MASTER_PLAN.md) defines evidence and acceptance requirements. No entries are closed by restoring a view. **Do not implement guessed `/api/v1/admin` compatibility endpoints just because an old component used them.** Settle typed `/v1` DTOs against the frontend workflow, then replace the frontend projection with those contracts.

Important payload differences: clinic/facility identity, patient versus booking party, replacement appointment IDs on move, minor-unit/unknown fees, nursing attestation, care access, consent versions, exact-time versus strict-slot reservations, and versioned atomic schedule changes. The original UI assumes IST; additional timezones still require frontend adaptation before acceptance. Department-name keys in the partial presentation are local filters, not IDs to write to the backend.

## Verification boundary

Frontend typecheck/build and tests, original source preservation and browser walkthrough results are recorded in `staff-integration-audit/ui-restoration-validation.json`. No database reset, schema migration, backend edit, provider messaging or real patient change is part of this pass. Full design parity is still pending; this ledger makes each omission explicit so it cannot silently disappear again.

Executed checks: **18/18 frontend tests, TypeScript/build PASS**, lint has 19 warnings and zero errors. All 73 selected-source hashes match; tracked backend/domain diff is empty and the eight sampled backend snapshot hashes match. Browser verified the partial timeline, split-shift draft, visit details, blocked notes save, range editor and doctor profile. Main JS is 647.20 kB (202.02 kB gzip); bundle warning remains. Native draft-discard confirmation is not claimed as a browser pass after a control timeout.

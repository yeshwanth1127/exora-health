# Pro component wave — shortlist

18 October 2026, on `codex/admin-dashboard-arc` after `e90fe90`. Selection report only; no dashboard code changed.

## Coverage

- All 116 Pro components screened from their docs (`arc-components/docs/<slug>.md`) against the 15 live dashboard screens.
- Rendered and exercised in light theme at 1440×900 (`?theme=light`): Release readiness (check all → action unlocks), Settings page (edit → floating save bar), Sheet stack (open), Split bar (hover widen + readout), Support conversation, Skeleton morph (load → resolve), Glass menu, Inbox triage, Team directory, Multi-step form, Invite people.
- Earlier passes already rendered Metric explorer, KPI drilldown, Metrics dashboard, Team directory, Roles permissions, Settings command, Settings page, Week calendar, Integrations and Sidebar.

## Porting cost (applies to every Pro pick)

Pro packages ship only `src/Component.cjs` reconstructed from browser JavaScript plus a ~500 KB compiled stylesheet. There is no TSX/CSS-module source. Sample data is hard-coded inside the component. Each pick must be hand-ported to `src/components/arc/<slug>/<slug>.tsx` + `.module.css`, as Sidebar was, with the demo's sample constants turned into props. Parity is then checked against the rendered demo instead of a source digest.

## Recommended wave

| Pro component | Placement | Real data | Conflicts to resolve |
| --- | --- | --- | --- |
| **Split bar** | Overview → Appointment health: one bar for *By status* and one for *By channel* | `GET /v1/operations/summary` `byStatus` / `byChannel` (all-time label/value pairs) | Demo's 7/30/90-day pills are page chrome, not `SplitBar` props; omit them because the summary is all-time. With zero bookings every segment is dropped; keep the existing empty state there. |
| **Skeleton morph** | Overview metric cards and Appointment health; Doctor details panel | Existing `loading` flags of those reads | None for these placements. Arc Skeleton stays everywhere else; failed reads stay errors. |
| **Team directory** | Workspace settings → Team (staff accounts) | Staff list: name, staff code, roles, clinic scope, account status, work email | No portraits, so use initials. No "Working on", location or time zone data, so hide those rows. Team filters become role filters (Doctor, Nurse, Front desk, Admin) with counts. Availability dot shows account status (Active, Invited, No sign-in). The existing *Manage* flow and permissions stay as they are. |
| **Release readiness** | Overview → Booking setup guide | `setup-readiness` checks per doctor and visit type | The server decides whether checks pass, so users can't tick them. Checkboxes would only show state, and each row keeps its Continue/Review action. There is no "Start release"-style final action. Notify switch and avatars have no app meaning. **Needs your decision:** accept read-only checks plus a final action of *Recheck saved setup*, or defer. |

Suggested order: Split bar → Skeleton morph → Team directory → Release readiness.

## Later, once data or decisions exist

- **Multi-step form**: the Add doctor setup (profile → clinic → calendar → fee) is the natural fit. Its steps must keep the current per-step server writes and recovery. It cannot become one submit at the end.
- **Settings page**: its gliding section nav fits Workspace settings' 8 sections. The save bar does not, because those sections save through individual guarded commands (e.g. *Change policy*). Adopting only the nav would be a partial use, so it needs your approval.
- **Support conversation / Inbox triage**: these would suit the WhatsApp inbox. Today that inbox runs on preview data with simulated Meta statuses, so wait for the inbound backend. Archive/snooze also need real support.
- **Kanban board**: Queue columns would fit, but dragging between statuses bypasses the guarded call-next/check-in commands, so it stays deferred.
- **KPI drilldown / Metric explorer**: still need more than the fixed 14-day booking series.

## Ruled out

Glass menu is an overlay for photos. Sheet stack is a small stacked-dialog pattern that would cramp the 960 px doctor forms. Invite people needs a seat meter and plan limits that don't exist. Week calendar and Roles permissions stay deferred for the reasons in `component-shortlist.md`. The remaining Pro catalog is commerce, billing, AI, marketing, 3D or decorative and maps to no staff task.

# Desktop Arc component shortlist

Reviewed on 18 October 2026 against the HMS_NEW staff dashboard at sidebar commit `3da44d1`. This is a selection report; no additional dashboard component was implemented.

## Recommendation

Start with **Tabs** for Appointments / Waitlist / Queue in `src/hms/WorkflowWorkspace.tsx`. It is a focused, visible upgrade with existing route/data support. Keep the current navigation guard and use the demo's selection motion, keyboard navigation and panel transitions. The existing Arc Tabs source is already present under `src/components/arc/tabs/`, but the workflow currently imports the shadcn tabs. Presence of that source does not establish demo parity.

Second choice: **Combobox** for the Doctor filter on Appointments, followed by the Clinic picker. Third choice: **Filter toolbar** for Doctor / Booking status / Appointment type above the appointment table, retaining the day navigator and a separate search field.

## Placements and alternatives

| Area | Preferred component | Alternative | Exact placement and reason |
| --- | --- | --- | --- |
| Appointment workflow | Tabs | Segmented control | Replace the three top workflow buttons on `/staff/appointments`, `/staff/waitlist`, `/staff/queue`. Tabs is appropriate for panels; segmented control is better for compact view/value selection. |
| Searchable choices | Combobox | Select / Morph select | Start with Doctor in Appointments; later Clinic in the header and doctor assignment fields. Combobox supports long lists and search. Morph select suits short status/priority lists; use it as a filter, never as an unguarded lifecycle mutation. |
| Active filters | Filter toolbar | Existing explicit fields | Above the appointment table: removable Doctor, Booking status and Appointment type chips, two-step Add filter, Clear all. Keep date and search separate. This trades visible dropdowns for a quieter bar. |
| Form fields | Input | Inline edit, for names only | Start with one registration/settings field and its focus, hint, error and disabled states. Expand after review. Inline edit is only a later option for simple editable labels, not a whole patient form. Inline edit was documentation-screened, not rendered in this survey. |
| Overview numbers | Metric card | Metric explorer | Replace existing number cards in Overview. Metric card accepts plain values/context without requiring historical series. Omit optional comparison chips when no comparison exists. Metric explorer needs daily series for every metric and each displayed range. |
| Booking trend | Bar chart | Line chart | Replace Daily bookings in Overview, using clinic-date booking counts. Bar columns communicate discrete daily counts. Preserve the existing 14-day reporting truth; do not copy unsupported demo week/month controls as working application ranges. |
| Website trend | Line chart | Metrics dashboard | Replace Visitors each day in Website analytics. A scrubbable crosshair and series toggles improve the existing chart. Metrics dashboard is a larger page-level option only after its four metrics, date ranges, comparison data, top pages/sources and Export action are supported. |
| Breakdown charts | Donut chart | Existing ranked rows | By channel / status in Overview, or sources in Website analytics. Use real categories and totals; no fabricated dates, percentages or period controls. Ranked rows remain clearer for exact comparisons across many categories. |
| Report dates | Date range picker | Existing from/to controls | Activity log report filters first; website analytics later if arbitrary ranges are supported. Keep draft/apply/cancel behavior. Clinic timezone and supported query bounds must be supplied; the demo's browser-local today must not silently change reporting dates. |
| Fast navigation | Command palette | Settings command | Add a desktop Search / command trigger to the header. Begin with permission-filtered destinations and existing actions; no pretend global patient search. Settings command is reserved for searching within settings. |
| Account controls | User menu | Current static profile footer | A later explicit replacement for the sidebar profile footer, or a separate header account control. The Arc sidebar demo has a static footer: this would intentionally extend that selected demo and should be chosen separately. Billing/theme destinations need real application support. |
| Empty results | Empty state | Skeleton for loading | Replace successful-empty content in Appointments/Patients/Doctors individually. Copy/icon/CTA come from actual state and permissions. Failed reads stay errors; loading stays loading. Skeleton was documentation-screened, not rendered in this survey. |
| Workspace settings | Settings page | Settings command | Settings page is better for focused forms and a dirty save bar. Settings command is better once many scalar settings need search. Team/roles and command-specific writes do not automatically fit one blanket Save changes operation. |
| Staff permissions | Roles permissions | Current role editor | `/staff/settings?section=roles`: matrix columns become actual roles, groups become actual modules. Defer implementation until its bulk review/save behavior can map truthfully onto the current per-permission review/write flow and fixed built-in roles. |
| Doctor directory | Team directory | Current doctor table | A searchable master/detail option for `/staff/doctors`. Defer under strict data-only parity: the demo includes availability, focus, location and identity fields that cannot all be inferred from current doctor data. Fees/booking controls also need a deliberate fit. |
| Schedules | Week calendar | Existing schedule timeline | A larger, later option for `/staff/schedules`. Its drag-create/move/resize event model needs scheduling, holds, conflicts, hours and visit semantics. This is not a direct data-only replacement. |
| Provider setup | Integrations | Existing dedicated setup pages | Later connection overview for WhatsApp, Google Business and PostHog. Do not make a simulated Connect→Connected animation authoritative. Existing provider state and authorization flows must drive it. |

## Best next choices

1. **Tabs** — best first follow-up: small, visible and already backed by real routes.
2. **Combobox** — best daily-use improvement: doctor selection/search.
3. **Filter toolbar** — best appointment-page cleanup, with a more noticeable change in filtering interaction.
4. **Metric card** — best small reporting polish with the current summary data.

## Survey coverage

Rendered desktop demos inspected (24 unique components):

- Tabs, Segmented control, Filter toolbar, Input, Combobox, Morph select, Sortable data table, Date range picker, Command palette, User menu, Empty state.
- Metric card, Bar chart, Line chart, Donut chart, Metric explorer, KPI drilldown, Metrics dashboard.
- Team directory, Roles permissions, Settings command, Settings page, Week calendar, Integrations.

Selected interactions exercised: tab switching, combobox expansion, filter-menu expansion, date-range expansion and KPI detail expansion. This was comparative inspection, not exhaustive interaction/accessibility validation of all 24 components.

Additional documentation screened: Select, Multi-select, Search field, Phone input, Number field, Inline edit, Skeleton, Skeleton morph, Team members, Invite people, Availability picker, Booking pill, Data grid, Search results, Revenue explorer, Funnel chart, Small multiples, Multi-step form, Cancel flow, Sheet stack, Action morph, Support conversation.

Not recommended for this tranche: Data grid (spreadsheet editing/fill semantics), Booking pill (restaurant party-size flow), Cancel flow (subscription-retention offers), and visually decorative components without a concrete staff task. KPI drilldown is a later reporting option: its 7/30/90-day comparisons and dimension breakdowns need enough actual history, not the current fixed 14-day booking summary.

## Local demo links

Pro demos: `http://localhost:4477/components/pro/<slug>/demo/`.

Archived free demos: `http://localhost:4478/free-previews/<slug>/?theme=light`. A read-only local viewer maps their shared font paths to the existing local font files; no source files or dashboard code were changed for that viewer.

Preserve exact selected-demo behavior and styling. A candidate that requires unsupported data or changed interaction is deferred until that conflict is explicitly resolved.

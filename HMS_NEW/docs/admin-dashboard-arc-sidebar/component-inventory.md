# Component inventory

Latest targeted browser follow-up: [kpi-browser-fit-review.md](kpi-browser-fit-review.md). Compact full-width Overview placement and reporting interactions checked; **235 frontend tests/build pass; 48 folders unchanged**. This supersedes the visual-pending note below for the explicitly checked KPI states.

Latest implementation: [kpi-reporting-wave.md](kpi-reporting-wave.md). User-approved KPI drilldown is on Overview with exact scoped reporting. **48 folders: 44 adopted + 4 support; 234 frontend tests.** Metric explorer remains an alternative; Revenue/Choropleth are deferred. Visual review remains with the user.

Previous implementation: [growth-controls-confirmation-wave.md](growth-controls-confirmation-wave.md). **47 folders: 43 adopted + 4 support.** Checkbox is now a directly adopted form control as well as supporting readiness; Switch is newly copied. **Folder count does not imply every screen/state is migrated.**

Current catalog coverage is reconciled in [catalog-audit-2026-10-19.md](catalog-audit-2026-10-19.md), with all per-entry evidence in [catalog-coverage.json](catalog-coverage.json).

## Current counts and evidence levels

- **249 local catalog entries:** 133 free + 116 Pro, excluding two infrastructure entries. This counts registry/demo names, including shared-source variants, not unique original implementations.
- **249 / 249 first-pass documentation screens complete:** 166 previously recorded + 83 in the latest pass. **0 remain for first-pass docs screening**.
- **48 integrated component folders:** 44 adopted + 4 support. **201 catalog entries are not integrated**, including deliberate exclusions and deferred candidates.
- **40 named references have recorded historical rendered-demo observations**; 209 do not. These are not exhaustive behavioral/fidelity checks, and this latest scan used no browser automation.
- Documentation screening, source/API assessment, rendered observation and actual integration are separate evidence levels. The old 82/83 counts describe earlier subsets and must not be added to the later all-Pro survey.
- Previous implementation: [growth-controls-confirmation-wave.md](growth-controls-confirmation-wave.md). The preceding [growth-screens-wave.md](growth-screens-wave.md) expanded charts/metrics/tabs. The original catalog scan was documentation-only.

## Earlier candidate ledger

| Component | Evidence recorded | Current disposition | Demo |
| --- | --- | --- | --- |
| Tabs | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/tabs/?theme=light) |
| Segmented control | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/segmented-control/?theme=light) |
| Filter toolbar | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/filter-toolbar/?theme=light) |
| Input | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/input/?theme=light) |
| Combobox | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/combobox/?theme=light) |
| Morph select | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/morph-select/?theme=light) |
| Sortable data table | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/sortable-data-table/?theme=light) |
| Date range picker | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/date-range-picker/?theme=light) |
| Command palette | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/command-palette/?theme=light) |
| User menu | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/user-menu/?theme=light) |
| Empty state | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/empty-state/?theme=light) |
| Metric card | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/metric-card/?theme=light) |
| Bar chart | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/bar-chart/?theme=light) |
| Line chart | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/line-chart/?theme=light) |
| Donut chart | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/donut-chart/?theme=light) |
| Metric explorer | Historical rendered reference + source/data-contract revisit | Alternative later trend surface; fixed history/formatting/snapshot aggregation requires binding work | [Demo](http://localhost:4477/components/pro/metric-explorer/demo/) |
| KPI drilldown | Historical rendered reference + current source/build/API checks; user visual review pending | Implemented on Overview: six recorded metrics, exact 7/30/90 totals and doctor/channel breakdowns | [Demo](http://localhost:4477/components/pro/kpi-drilldown/demo/) |
| Metrics dashboard | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/metrics-dashboard/demo/) |
| Team directory | Pro wave: rendered reference, states exercised and integrated placement compared at 1440×900 light | Integrated: Workspace settings › Team | [Demo](http://localhost:4477/components/pro/team-directory/demo/) |
| Roles permissions | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/roles-permissions/demo/) |
| Settings command | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/settings-command/demo/) |
| Settings page | Rendered reference; selected interactions only | Integrated in context/setup wave; visual review retained by user | [Demo](http://localhost:4477/components/pro/settings-page/demo/) |
| Week calendar | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/week-calendar/demo/) |
| Integrations | Rendered reference; selected interactions only | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/integrations/demo/) |
| Select | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/select/?theme=light) |
| Multi-select | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/multi-select/?theme=light) |
| Search field | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/search-field/?theme=light) |
| Phone input | Initial documentation screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/phone-input/?theme=light) |
| Number field | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/number-field/?theme=light) |
| Inline edit | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/inline-edit/?theme=light) |
| Skeleton | Initial documentation screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/skeleton/?theme=light) |
| Skeleton morph | Pro wave: rendered reference, states exercised and integrated placement compared at 1440×900 light | Integrated: Overview loading | [Demo](http://localhost:4477/components/pro/skeleton-morph/demo/) |
| Team members | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/team-members/demo/) |
| Invite people | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/invite-people/demo/) |
| Availability picker | Wave 3: rendered reference, states exercised and integrated placement compared at 1440×900 light | Integrated: Booking › Doctor & time (user-approved adaptations: Start date calendar, 10 square days, Booking pill time chips) | [Demo](http://localhost:4477/components/pro/availability-picker/demo/) |
| Booking pill | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/booking-pill/demo/) |
| Data grid | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/data-grid/demo/) |
| Search results | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/search-results/demo/) |
| Revenue explorer | Documentation/source/data-contract revisit | Defer for clinic finances: SaaS MRR model and no exposed collection series | [Demo](http://localhost:4477/components/pro/revenue-explorer/demo/) |
| Choropleth explorer | Documentation/source/data-contract revisit | Defer: no visitor locality data or actionable regional question; custom local boundaries would be needed | [Demo](http://localhost:4477/components/pro/choropleth-explorer/demo/?theme=light) |
| Funnel chart | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/funnel-chart/demo/) |
| Small multiples | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/small-multiples/demo/) |
| Multi-step form | Initial documentation screening | Integrated in context/setup wave; visual review retained by user | [Demo](http://localhost:4477/components/pro/multi-step-form/demo/) |
| Cancel flow | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/cancel-flow/demo/) |
| Sheet stack | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/sheet-stack/demo/) |
| Action morph | Initial documentation screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/action-morph/demo/) |
| Support conversation | Initial documentation screening; current WhatsApp source checked | Integrated: WhatsApp preview Inbox with WhatsApp theme; visual review retained by user | [Demo](http://localhost:4477/components/pro/support-conversation/demo/) |
| Kanban board | Earlier Pro documentation screening; current source/API review | Integrated: Queue Board, guarded commands and Table fallback; visual review retained by user | [Demo](http://localhost:4477/components/pro/kanban-board/demo/?theme=light) |
| Badge | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/badge/?theme=light) |
| Alert | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/alert/?theme=light) |
| Tooltip | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/tooltip/?theme=light) |
| Dialog | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/dialog/?theme=light) |
| Dropdown menu | Second documentation/source screening | Integrated in the approved five-component wave; visual review retained by user | [Demo](http://localhost:4478/free-previews/dropdown-menu/?theme=light) |
| Context menu | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/context-menu/?theme=light) |
| Copy button | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/copy-button/?theme=light) |
| Pagination | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/pagination/?theme=light) |
| Timeline | Second documentation/source screening | Integrated in the approved five-component wave; visual review retained by user | [Demo](http://localhost:4478/free-previews/timeline/?theme=light) |
| Progress | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/progress/?theme=light) |
| Stepper | Second documentation/source screening | Integrated in the approved five-component wave; visual review retained by user | [Demo](http://localhost:4478/free-previews/stepper/?theme=light) |
| Radio cards | Second documentation/source screening | Integrated in the approved five-component wave; visual review retained by user | [Demo](http://localhost:4478/free-previews/radio-cards/?theme=light) |
| Time picker | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/time-picker/?theme=light) |
| Money input | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/money-input/?theme=light) |
| File upload | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/file-upload/?theme=light) |
| File dropzone | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/file-dropzone/?theme=light) |
| Toast | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/toast/?theme=light) |
| Toast stack | Second documentation/source screening | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/toast-stack/?theme=light) |
| Notification center | Wave 3: rendered reference, states exercised and integrated placement compared at 1440×900 light | Integrated: header Alerts bell (My alerts PRD) | [Demo](http://localhost:4478/free-previews/notification-center/?theme=light) |
| Breadcrumb | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/breadcrumb/?theme=light) |
| Accordion | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/accordion/?theme=light) |
| Hover card | Second documentation/source screening | Integrated in the approved five-component wave; visual review retained by user | [Demo](http://localhost:4478/free-previews/hover-card/?theme=light) |
| Hold to confirm | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4478/free-previews/hold-to-confirm/?theme=light) |
| Switch | Documentation/source review; no new rendered verification | Adopted: immediate growth preferences | [Demo](http://localhost:4478/free-previews/switch/?theme=light) |
| Checkbox | Documentation/source review; reused existing source | Adopted: setup eligibility, test confirmation, enrolment and staged Google choices; also readiness support | [Demo](http://localhost:4478/free-previews/checkbox/?theme=light) |
| Security settings | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/security-settings/demo/) |
| Release readiness | Pro wave: rendered reference, states exercised and integrated placement compared at 1440×900 light | Integrated: Overview booking setup guide (approved read-only adaptation) | [Demo](http://localhost:4477/components/pro/release-readiness/demo/) |
| Share access | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/share-access/demo/) |
| Inbox triage | Wave 3: rendered reference, states exercised and integrated placement compared at 1440×900 light | Integrated: My alerts page | [Demo](http://localhost:4477/components/pro/inbox-triage/demo/) |
| Help center | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/help-center/demo/) |
| Support widget | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/support-widget/demo/) |
| Activity terrain | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/activity-terrain/demo/) |
| Realtime stream | Second documentation/source screening | Considered; not adopted in current scope | [Demo](http://localhost:4477/components/pro/realtime-stream/demo/) |
| Date picker | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/date-picker/?theme=light) |
| Button | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4478/free-previews/button/?theme=light) |
| Split bar | Pro wave: rendered reference, states exercised and integrated placement compared at 1440×900 light | Integrated: Overview › Appointment health | [Demo](http://localhost:4477/components/pro/split-bar/demo/?theme=light) |
| Sidebar | Rendered reference; selected interactions only | Integrated in current scope; newest placements await user review | [Demo](http://localhost:4477/components/pro/sidebar/demo/) |


## Additional integrated support code

| Support component | Used by |
| --- | --- |
| Animated counter | Metric values |
| Calendar | Date picker and date ranges |
| Textarea | Existing multiline fields, through the shared adapter |
| Avatar | Team directory rows and profile |

## Integrated folder inventory

`alert`, `animated-counter`, `availability-picker`, `avatar`, `badge`, `bar-chart`, `button`, `calendar`, `checkbox`, `combobox`, `command-palette`, `copy-button`, `date-picker`, `date-range-picker`, `dialog`, `dropdown-menu`, `empty-state`, `filter-toolbar`, `hover-card`, `inbox-triage`, `input`, `kanban-board`, `line-chart`, `metric-card`, `money-input`, `multi-step-form`, `notification-center`, `phone-input`, `radio-cards`, `release-readiness`, `search-field`, `select`, `settings-page`, `sidebar`, `skeleton`, `skeleton-morph`, `split-bar`, `stepper`, `support-conversation`, `switch`, `tabs`, `team-directory`, `textarea`, `time-picker`, `timeline`, `toast-stack`, `tooltip`.

Selection rationale and deferred data/interaction conflicts remain in `component-shortlist.md` and `next-wave-shortlist.md`. In particular, Donut chart was assessed but not integrated. Roles permissions and Week calendar remain deferred (Team directory was adopted in the Pro wave, see `pro-wave-shortlist.md`); readable role descriptions and a wider doctor panel do not constitute those larger replacements.

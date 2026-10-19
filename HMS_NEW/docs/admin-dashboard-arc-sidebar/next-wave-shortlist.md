# Next desktop Arc wave

Selection pass after desktop control consistency commit `a6496c2`, 18 October 2026. No dashboard code changed in this pass. The earlier survey inspected 24 rendered demos and screened 22 more components from documentation. Subsequent implementation also examined Date picker, Select, Search field and Button. This pass screened 33 additional candidates through their local documentation/source and revisited relevant earlier candidates. These are candidate assessments, not claims of rendered-demo parity.

## Recommended small wave

| Component | Placement | Fit with existing application |
| --- | --- | --- |
| Time picker | Shared Start time / End time controls in weekly hours, breaks and scheduling forms | Accepts HH:mm strings, 24-hour display and minute steps of 1/5/10/15/30. Preserve existing values, minute precision, validation and clinic timezone; no slot-availability claim. |
| Phone input | Patient registration/contact editing, then doctor phone editing | Its controlled value is E.164 and supports an empty string. Matches the API format; start with the existing country context rather than guessing from a typed national number. Preserve optional fields and validation. |
| Money input | Service/catalogue fees and doctor fee overrides | Controlled minor-unit amounts and null for empty. Use INR, preserve paise and the existing meaning of blank/default/unpriced. Keep currency fixed where the backend contract is INR. |
| Badge | Appointment, queue, consultation and staff status labels | Preserve the exact server status text and existing status meaning; improve small labels and changing values consistently. Start through the shared Status component. |
| Tooltip | Icon-only refresh, date navigation, edit and copy controls | Short labels on hover and keyboard focus; existing accessible names remain. No essential instructions hidden solely in a tooltip. |
| Empty state | Shared successful-empty results for Appointments, Patients, Queue and Consultations | Reuse the existing title and authorized action. A failed request stays an error; initial loading stays loading. |
| Skeleton | Shared LoadingState/Resource blocks | Replace generic rectangles with placeholders that match the expected rows/fields. Preserve stale-data and error behavior; no invented completion percentage. |
| Copy button | Booking confirmation code, patient MRN and existing booking/clinic links | The source handles copied/failure feedback and keyboard focus. Copy only on the user's action and report actual clipboard success. |

Recommended rollout: specialist fields first, then shared statuses/help/loading/empty states, followed by copy feedback. Keep the current desktop layout and the 44px / 18px standard field geometry. Preserve each selected component's demo motion and interaction contract. Inspect only the selected demos immediately before implementation, with focused browser checks after integration.

## Strong alternatives

- Alert: existing ErrorMessage/Hint and persistent recovery notices. Keep authorization errors, unknown write outcomes and recovery controls visible and actionable.
- Toast stack: application-wide transient action feedback, replacing the current Sonner presentation through a compatible adapter. Requires auditing existing toast calls so a UI animation cannot imply a successful backend save, provider connection or delivery.
- Dialog: shared discard/confirmation panels. Retain the leave guard's distinction between an ordinary dirty draft and a pending/unknown write. Keep longer booking and patient workflows in their current page context.
- Dropdown menu: a later compact menu for existing secondary row actions. Keep the primary clinical workflow action visible and every action permission-filtered.
- Timeline: appointment/record history where chronological events already exist. Activity's comparison/export table should retain its table view.
- File upload / File dropzone: existing document/photo attachment flows. Bind real upload/cancel/failure outcomes; plain selection remains plain selection where no upload endpoint exists.

## Defer or restrict

- Pagination expects a known page count. Appointments currently has cursor navigation and no total-page contract; do not invent numbered pages.
- Number field is useful for bounded counts; do not substitute it for blank/unknown monetary values when Money input supports those explicitly.
- Notification center needs actual notification records plus persisted read/dismiss state. A new header bell without those bindings would be misleading.
- Progress requires actual measurable progress; skeleton is the fit for an indeterminate data read.
- Stepper and Radio cards can later refine existing booking choices without changing step prerequisites, permissions or recovery.
- Multi-select needs a field whose backend accepts multiple values; the current single-doctor filter is not that field.
- Breadcrumb and Accordion are useful only where they clarify an existing hierarchy or disclosure. Avoid adding them throughout the dashboard as decoration.
- Hover card should use minimal already-authorized staff metadata; do not create patient-information previews by default.
- Hold to confirm is not a blanket replacement for explicit clinical/security confirmations or reason/evidence requirements.
- Switch and Checkbox are small future replacements. Preserve immediate-save versus submit-to-save behavior.

## Newly screened inventory: 33

Free components (25): Badge, Alert, Tooltip, Dialog, Dropdown menu, Context menu, Copy button, Pagination, Timeline, Progress, Stepper, Radio cards, Time picker, Money input, File upload, File dropzone, Toast, Toast stack, Notification center, Breadcrumb, Accordion, Hover card, Hold to confirm, Switch, Checkbox.

Pro components (8): Security settings, Release readiness, Share access, Inbox triage, Help center, Support widget, Activity terrain, Realtime stream.

The Pro candidates are larger product work: account security requires the identity provider's supported operations; release gating/share-link access do not currently map directly to the clinic model; inbox archive/snooze requires actual messaging support; help/support blocks need real staff-facing content and support bindings; terrain/streaming visualisations require suitable hourly or live data. None is recommended merely for appearance.

Revisited: Empty state, Skeleton, Phone input, Number field and Multi-select. Existing selection report: `component-shortlist.md`. Source library: `/Users/deepakonda/Downloads/test/arc-components/components/free/` and `components/pro/`.

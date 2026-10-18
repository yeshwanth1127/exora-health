# Admin dashboard polish: Arc UI demo parity

## Required fidelity

- For every Arc UI component selected for the admin dashboard, the corresponding local rendered demo is the authoritative reference for both appearance and behavior. Reproduce it exactly; do not reinterpret, simplify, restyle, or introduce deviations without an explicit user instruction.
- Reference library: `/Users/deepakonda/Downloads/test/arc-components/`. Demo catalog: `http://localhost:4477/portable/review.html`. Individual demos: `http://localhost:4477/components/pro/<component-name>/demo/` (for example, `data-flow`). These are local recreations used as the reference, not a claim to the original Arc source code.
- Preserve the demo's layout, spacing, dimensions, typography, colors, borders, icons, shadows, responsive behavior, and expanded/collapsed geometry.
- Preserve the complete interaction and state behavior: hover, focus, selection, disabled states, validation, loading, empty/error/success states where demonstrated, menus, tooltips, keyboard navigation, focus management, dismissal, scrolling, sorting/filtering, and chart interactions.
- Match animation triggers, timing, easing, springs, transitions, and reduced-motion behavior. Do not replace demonstrated motion with an approximation or remove it for convenience.

## Allowed substitutions

- Swap only the demo data for the corresponding application data: labels, values, records, identities, assets, and chart series. Connect the existing demonstrated actions to the real application routes, callbacks, and data operations while retaining their demonstrated interaction behavior.
- Keep application data and status truthful. Never retain fabricated demo records or claim a save, connection, delivery, or successful operation without the corresponding application result.
- Adapt through data mapping and application bindings; do not change the component's visual or interaction contract to make integration easier. If a product requirement or application state cannot fit that contract, surface the specific conflict to the user before introducing a deviation.
- Do not use dashboard-wide styling conventions as permission to override the selected demo. Explicit user instructions are required for changes beyond data and application bindings.

## Verification

- Inspect the rendered demo and exercise its relevant states before implementation; a screenshot or component name alone is insufficient.
- Compare the integrated component with that demo at matching viewport sizes and states. Verify appearance, interaction, keyboard/focus behavior, and motion. Treat unapproved deviations as defects and fix them before declaring completion.
- Report any unverified states or fidelity limits explicitly; do not claim exact parity from a successful build alone.

## Current rollout scope

- The approved rollout covers desktop sidebar, workflow tabs, searchable choices, filter toolbar, registration fields, metric cards, individual charts, report date range and command palette. Keep changes focused on these small components. Do not expand into phone optimization, full analytics blocks, scheduling calendar, permissions matrix or other larger replacements.

## Desktop control consistency refinements

- Use the catalog's matching controls for shared desktop forms and filters: 44px standard control height, 18px control radius, 12px field horizontal padding, and one 20px label line with an 8px gap. Keep explicit compact buttons and calendar day cells at their demonstrated sizes.
- Keep the appointment doctor selection in the filter toolbar; do not add a duplicate doctor field. Place report date range alongside the other report fields. The theme picker belongs under Workspace settings / Appearance.
- Use comboboxes for searchable entity selections, selects for short fixed lists, and search fields for free-text record filtering. Preserve IDs, validation, permissions, timezone boundaries and existing command recovery.
- Prefer source inspection and automated checks; keep browser verification to a small set of targeted checks and one final review capture.

## Current approved wave

- Integrate Time picker, Phone input, Money input, Badge, Tooltip, Empty state, Skeleton, Copy button, Alert, Toast stack and Dialog with existing application data and guarded actions.
- The user explicitly retained visual verification for this wave. Do not drive the browser or capture comparison screenshots; use source review, compilation and meaningful automated tests. Report visual parity as awaiting user review.

## Latest desktop review and continuation

- Current implementation/handoff: `HMS_NEW/docs/admin-dashboard-arc-sidebar/HANDOFF.md`; deduplicated selection ledger: `component-inventory.md`. Read these before repeating component exploration or continuing this branch.
- User-approved header: centered command search, no duplicate page name or Local preview badge; desktop collapse control in the left sidebar; clinic switching under Settings / My account. Keep routing, permissions and unsaved guards intact.
- Latest refinements include aligned schedule search, patient entity Combobox, Arc DOB picker, wider doctor panels, readable permission descriptions and confirmed-result toasts. Preserve their actual value/permission/command bindings.
- The user retains visual verification and asked to minimize usage. Finish source/automated checks and hand off; do not start further component waves automatically.

## Takeover refinements

- Read `HMS_NEW/docs/admin-dashboard-arc-sidebar/takeover-review.md` before using older runtime instructions. The normal dashboard on 5198 now uses the isolated API on 3080, including the alert routes.
- User explicitly requested direct Month/Year DOB choices, registration replacing patient lookup, removal of Focus search, improved appointment search and replacement of native chart-data triangles. These are approved refinements; keep ordinary date pickers' default behavior unchanged.
- Preserve Claude's Pro/alerts/availability additions; current adopted/support folder count is 37. Review and verification boundaries are recorded in the takeover review. No new wave or phone optimization is authorized by these fixes.

## Approved five-component implementation

- User approved Stepper, Dropdown menu, Timeline, Hover card and Radio cards, including the optional two. Read `HMS_NEW/docs/admin-dashboard-arc-sidebar/arc-five-verification.md` for current placements and checks; the current Arc folder count is 42.
- Keep booking progress read-only and mode choices locked for holds/pending commands. More actions opens existing guarded appointment flows; primary check-in/consultation remains visible. Activity Feed and Table share the same filtered records and export.
- Patient previews require patients.read, use actual patient contacts (never the booking caller phone), and contain no clinical history or inferred next appointment. Queue reuses its detail read; Appointment detail reads start only while the source hover card is open.
- Multi-step form, Settings page, Support conversation and Kanban were FYI suggestions, not additional implementation approval. Inbox triage is already used for My alerts. Preserve the user's retained visual verification preference.

## Approved context and setup phase / next-turn scope

- The user has now approved Multi-step form for staged doctor setup and Settings page with scoped save semantics. This supersedes the FYI-only status above. Read `HMS_NEW/docs/admin-dashboard-arc-sidebar/context-and-setup-wave.md`; current inventory is 44 folders (39 adopted + 5 support).
- Patient hover must show extra recorded context (visit reason, language, DOB/age with estimated flag), not repeat table identifiers/phone/status. No general-note field exists on PatientDetail: do not fabricate notes or read clinical charts for hover. Queue's lazy appointment context requires appointments.read and matching patient/clinic.
- Keep staff account, clinic affiliation, calendar and fees as separately saved/recoverable operations. Resume from actual records; no unguarded backward navigation across saved writes, fake setup-complete/bookability claim or PII draft storage. Working hours remain in Schedules.
- Settings navigation uses only existing permitted sections. The save bar applies only to the current name/phone editor; policy/access/security/configuration actions retain their own commands, versions and review dialogs. Never introduce a blanket Save all.
- User explicitly requested WhatsApp-themed Arc Support conversation and Kanban **next turn**. Read `HMS_NEW/docs/admin-dashboard-arc-sidebar/next-whatsapp-kanban.md`. Current WhatsApp chat is custom UI with Arc controls, not yet Support conversation. Preserve real provider vs browser-preview truth and actual guarded queue transitions. User retains visual verification; no phone optimization or repeated catalog browsing.

## Implemented WhatsApp / Queue wave and user layout corrections

- Read `HMS_NEW/docs/admin-dashboard-arc-sidebar/whatsapp-queue-settings-wave.md`. Kanban is on **Queue**, as explicitly clarified by the user; there is no WhatsApp Kanban. Current inventory is 46 component folders (41 adopted + 5 support).
- Queue Board/Table use the same scoped records. Preserve call-next priority order, actual token start/skip/complete commands and completion's open-consultation refusal. Drops propose reviewed moves; keyboard arrows are a temporary preview, Escape writes nothing. No doctor reassignment, local saved queue reordering or generic task editing/creation. Explicitly bind the moved token ID across polling updates.
- WhatsApp preview Inbox uses the Arc Support conversation with the user-requested WhatsApp theme. Preserve browser-preview vs provider truth, reply permissions/window/template rules, existing drafts and real supplied statuses. Do not bring back the reference's fake agent replies, typing or attachments.
- User explicitly requested Settings to look like a full professional dashboard. HMS Settings opts into full available width and normal page scrolling, with sticky navigation and no embedded frame; preserve individual command/save semantics. This supersedes the standalone reference frame only for this opted-in placement.
- Queue Refresh belongs inside DayNavigator's aligned action row. Scope Board/Table to arc-demo-scope so the actual reference tabs render correctly. User retains visual verification; no further catalog/browser sweep is requested.


## Growth screen coverage correction

- The user explicitly identified legacy charts, metrics, tabs/indicator bars and controls on WhatsApp, Google Business and Website analytics. This authorizes migration of these existing placements using already adopted Arc components; preserve data and operations. Read `HMS_NEW/docs/admin-dashboard-arc-sidebar/growth-screens-wave.md`.
- Current placements include scoped Arc tabs and panels, numeric metric cards, source/device/review Split bars, daily/category Bar charts, growth badges, setup Stepper and compatible date/time/search controls. Voice and Loyalty summary tiles/tabs follow the same presentation. The component-folder count stays 46; it is not a screen-completion metric.
- Preserve browser-preview/sample/provider distinctions, zero versus unavailable values, exact category counts, comparison baselines, guarded WhatsApp navigation and local date/time strings. Conversion stages overlap and must not be treated as parts of a Split bar. Existing Google/WhatsApp patient-facing visual previews keep their recognizable brand presentation.
- User retains visual verification. No browser sweeps, phone optimization, fabricated analytics/provider data, automatic catalog waves or dependency additions are needed for this correction.

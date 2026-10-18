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

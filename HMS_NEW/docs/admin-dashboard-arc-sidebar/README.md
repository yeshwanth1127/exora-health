# Desktop sidebar: first Arc component

Scope: the HMS_NEW staff dashboard's desktop sidebar only. Subsequent components and phone optimization are outside this tranche.

- Branch: `codex/admin-dashboard-arc`, based on `b2cf1a5`.
- Workspace: `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW`.
- Preview: `http://127.0.0.1:5198/staff/appointments`.
- Reference: `http://localhost:4477/components/pro/sidebar/demo/?theme=light` in the user's local recreated Arc library.

The typed component adapter retains the reference's sidebar styles, font asset and motion presets. It supplies clinic navigation, permission-filtered sections, appointment subroutes and the current staff identity instead of sample workspace data. Routing and sign-out still pass through the existing unsaved-change guard. The application supplies the viewport and retains its existing page content and header controls; the demo's outer showcase frame and sample pages are not installed.

## Verification

- PASS: production build, TypeScript build, sidebar lint, `git diff --check`, and all 163 existing frontend tests.
- PASS: observed desktop open/folded widths of 240px/64px, 32px navigation rows, 13px type, matching padding, colors and the same Inter font asset. Browser zoom introduces subpixel rounding under 0.01px.
- PASS: desktop collapse/expand, opening a nested group from the folded rail, route selection and current-item indication, keyboard tooltips and the `[` toggle.
- PASS: `[` remains ordinary text inside a form field. An unsaved patient registration draft blocked sidebar navigation; Keep editing preserved the draft. The verification text was cleared without saving a record.
- Visual review: [open sidebar](sidebar-desktop.jpg), [folded sidebar](sidebar-desktop-folded.jpg), captured at a 1280x900 CSS viewport.
- Limits: motion presets match the local reference; frame-by-frame animation identity and OS reduced-motion behavior have not been independently measured. This is local frontend verification, with no deployment performed.

The primary checkout's existing onboarding edits were not modified. No other Arc component was migrated in this change.

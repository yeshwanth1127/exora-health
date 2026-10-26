# Local Arc combobox

Copied from `/Users/deepakonda/Downloads/test/arc-components/free-source/components/arc/combobox/` with its original module styles and shared motion tokens. Foundation variables are scoped to `.business-arc-scope`, preserving the rest of the marketing page.

The running Arc library's Jump to component combobox was exercised before integration (filter, ArrowDown/Enter, clear, no matches, Escape). Its local library catalog was served through a temporary adapter because the reference checkout's `catalog-all.json` is missing; original files were unchanged.

Application bindings add `onQueryChange`, optional external filtering, a hidden-label option for the requested compact bar, and a footer slot for Google attribution. The original control/list geometry, icons, selection animation, springs and pointer/keyboard navigation remain. Tab also dismisses the async menu. The user's homepage wrapper and neutral light theme are intentional adaptations.

See `docs/business-visibility-check/verification.json` for executed checks and limits.

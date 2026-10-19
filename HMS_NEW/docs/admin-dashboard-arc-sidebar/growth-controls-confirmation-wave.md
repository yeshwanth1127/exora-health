# Remaining growth controls and confirmations — 19 October 2026

Completed the user's follow-up to `growth-screens-wave.md`: implement the remaining switches, checkboxes and browser confirmations. Work resumed from the interrupted dependency/source preparation. No browser sweep, provider action or database write was used to verify it.

## What changed

| Before | After | Binding preserved |
| --- | --- | --- |
| Legacy immediate toggles in WhatsApp setup, Overview/Settings, Automations and Google Reviews | Copied Arc Switch through `GrowthSwitch` | Existing checked values, callbacks, accessible names, permission/disabled controls and enclosing fieldsets |
| Legacy WhatsApp setup eligibility/test and Loyalty enrolment checkboxes | Existing Arc Checkbox through `GrowthCheckbox` | Original selected eligibility indices, test/live dependency and selected program IDs; source label/description slots provide their control association |
| Staged Google profile on/off choices, including opening days | Arc Checkbox | Draft values still wait for Publish; this follows the reference distinction between immediate Switch preferences and submitted Checkbox choices |
| Seven blocking browser confirmations | Existing Arc Dialog through `GrowthConfirm` | Each operation's reviewed context, current permission/eligibility and original local state transformation |

`src/components/arc/switch/switch.tsx` and `switch.module.css` are copied byte-for-byte from the local `free-source/components/arc/switch/` reference. `@radix-ui/react-switch` **1.4.1** is installed and locked as its required dependency; no source substitution or new toggle geometry was introduced. The source manifest records both digests. The already copied Checkbox/Dialog/Button sources are unchanged.

`GrowthControls.tsx` supplies reference token scope. Its checkbox adapter maps this application's binary choices to true/false; the underlying Arc Checkbox still supports its original indeterminate state elsewhere.

## Seven confirmations

| Placement | Explicit action | Checks while the dialog is open and at mutation |
| --- | --- | --- |
| WhatsApp → booking flow → switch template | Switch template | `comms.manage`, unchanged reviewed setup, captured destination shape; unchanged setup is checked again in `update(old => ...)` |
| WhatsApp → Settings → Disconnect | Disconnect setup | Current manage permission and unchanged reviewed number/setup; only browser setup is reset |
| WhatsApp → Promotions → eligible campaign | Cancel promotion | Current manage permission, exact reviewed campaign, still in review/scheduled, and no sent messages; sending/sent/changed records cannot be removed |
| Google Business → Profile → checked-field changes | Publish preview | Current manage permission, same reviewed baseline and draft, original checked-field list; preview toast waits for the resulting listing to appear in state |
| Google Business → Reviews → existing reply | Delete reply | Current manage permission, exact reviewed review/reply and a reply still present; the review itself is retained |
| Google Business → Posts | Delete post | Current manage permission and exact reviewed post; a changed status/content/view count requires a fresh review |
| Website analytics → Websites → own website | Remove website | Current manage permission, exact reviewed website and `kind === "own"`; the automatically counted booking site cannot be removed |

Opening a dialog stores data, never an executable old callback. Handlers use the current render and recheck the reviewed row in functional state updaters, so polling cannot silently redirect an action to a new array position or changed record. Identical polling copies are accepted; changed or removed items require closing and reviewing again.

`GrowthConfirm.tsx` uses the existing Arc Dialog appearance/motion, and Arc secondary/danger/primary buttons. Cancel receives initial focus. Escape, outside dismissal, the close button and Cancel call dismissal only. On close it restores the opener when still present, or its surviving tab panel after removal. A consumed-action guard prevents repeated activation, including during the exit transition; it resets only when opened again. Source inspection establishes these bindings; browser keyboard/focus/motion behavior still awaits the user's visual review.

Confirmation copy explicitly identifies browser-preview operations. No live Google reply/post is deleted, provider number disconnected, site code removed, campaign sent or profile published by this UI wave. Existing storage keys, provider gates and real backend command contracts are unchanged.

## Inventory and continuation

- **249 local catalog entries** still have first-pass documentation screening; **0** remain for that first pass.
- **47 integrated folders: 43 adopted + 4 support.** Switch adds one folder. Checkbox moves from a supporting copy to an independently adopted form control; no second Checkbox copy was added.
- **202 catalog entries remain unintegrated.** This includes deliberate exclusions/deferred components, not a required migration queue.
- Supporting folders are now Animated counter, Avatar, Calendar and Textarea.
- The current counts are in `component-inventory.md` and `catalog-coverage.json`. Older wave reports retain their historical counts and point here.
- This follow-up does not authorise the earlier suggested Tag input, Countdown or Action button wave. Native operating-system file choosers and ordinary page/card/table layouts remain appropriate existing infrastructure. No unrelated legacy app or clinical workflow was restyled.

## Validation

- **227 frontend tests pass**, including eight new confirmation/control checks: polling copies/reordering, replaced replies/setup, campaigns starting to send, permission refusal, duplicate activation, retry after synchronous refusal, accessible disabled controls, and no action during render.
- **Production frontend build passes**. The existing large-bundle warning remains.
- Oxlint reports **0 errors and 0 warnings** for the new confirmation/control adapters, hook, helper and tests. Existing unrelated screen warnings are not treated as a new verification claim.
- Switch source/CSS hashes, the 47-folder inventory and current ledger counts are checked. The scoped growth files contain no remaining `window.confirm` or imports of legacy Switch/Checkbox controls.
- The user retains rendered visual verification. No browser screenshots or automation, outgoing messages, live provider tests, database changes or deployment were performed. Existing dashboard **5198** and API **3080** routing is unchanged.

Manual review locations: WhatsApp setup and flow editor, WhatsApp Settings/Automations/Promotions, Google Profile/Reviews/Posts, Analytics own-websites list and Loyalty enrolment. Check cancellation, focus return, disabled permissions and the stale-record message while preview status changes.

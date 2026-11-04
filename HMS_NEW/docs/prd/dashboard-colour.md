# Dashboard colour and hierarchy

Status: **approved to start** (4 Nov 2026), screen by screen. Branch `codex/admin-dashboard-arc`.

## Problem

The staff dashboard still reads as two-tone: black on white, with grey for everything else.

- **Nothing stands out.** The sidebar, page and cards are all white. The main action on a page looks like any other black element.
- **Colour modes don't work.** Lagoon, Iris, Terracotta and Sage were built before the Arc components. Arc has its own neutral colours, so a mode only tints the page background and some text. Buttons, the sidebar and charts stay black and grey.
- **Monochrome is still the default**, so every clinic sees two-tone unless they find Workspace settings › Appearance.
- **It sends the wrong signal.** The product should feel modern and considered, not unfinished.

## Goal

One modern colour system across the whole dashboard, where colour shows what matters and what to do next.

## Scope

**In**

1. **One brand colour by default.** No picker. Every clinic gets the same look.
2. **Three surface layers:** tinted page, white cards and white sidebar, brand colour for the main action.
3. **Arc components recoloured** through their shared colour tokens (`foundation.css`, `demo-scope.css` and the Sidebar skin). Explicitly approved by the user on 4 Nov 2026 as a deviation from the Arc demos' neutral palette.
4. **Hierarchy rules** (below), applied to every page.
5. **Sidebar stays as it is.** Its green, blue, violet and channel icon colours keep full strength. A theme must not wash them out.
6. **Remove the colour modes:** `ModePicker`, `modes.css` and the Appearance section in Workspace settings.
7. **Update `AGENTS.md`** to record this colour approval, so the demo-parity rule stays accurate.

**Out**

- Layout, spacing, geometry, motion and interaction. These stay exactly as in the Arc demos.
- Copy changes.
- Phone layout.
- A dark theme. Arc is light-only in the dashboard today.
- The website, onboarding pages and super admin.

## Colour system

| Layer | Role | Blue (recommended) | Teal (alternative) |
| --- | --- | --- | --- |
| Page | Background behind cards | `#f4f6fb` | `#f1f7f6` |
| Card | Content | White | White |
| Sidebar | Navigation | White, unchanged | White, unchanged |
| Brand | Main action, selected state, links, charts | Blue, hue 262 | Teal, hue 195 |
| Text and borders | Reading | Neutrals with a slight brand tint | Same |

**Why blue:** the approved setup guide, welcome slides and coach marks already use blue. Teal would need those changed as well, or the two colours would compete.

## Hierarchy rules

| Element | Rule |
| --- | --- |
| Main action on a page | Filled brand colour. One per page or section. |
| Other actions | White with a border. |
| Quiet actions | Text only. |
| Selected (sidebar row, tab, segment) | Brand tint with brand text. |
| Charts | Brand colour for the main series. Comparison series stay quieter. |
| Destructive actions | Red, never brand colour. |

**Status colours** are the same on every page, and each status always keeps its text label:

| Status | Colour |
| --- | --- |
| Confirmed | Blue |
| Checked in, waiting | Amber |
| Completed, ready, connected | Green |
| Cancelled, failed | Red |
| No-show, draft, not started | Grey |

## User flows

No flow changes. Every page, action and route works as it does today.

Staff open the dashboard and see the new colours straight away, with nothing to configure. Anyone who picked a colour mode in their browser gets the new look too.

## Acceptance criteria

1. **Default:** a fresh browser shows the brand look with no setting to change.
2. **No leftovers:** no black primary button, grey chart line or grey selected state remains on any sidebar page, and no colour mode code remains.
3. **Every page checked:** all sidebar pages, plus dialogs, sheets, menus, the command palette, alerts, login, welcome slides and coach marks.
4. **States:** hover, focus, disabled, loading, empty and error states stay clear in the new colours.
5. **Status:** each status uses the colour above everywhere it appears, and never relies on colour alone.
6. **Readable:** text keeps 4.5:1 contrast. Keyboard focus is visible on brand buttons.
7. **Parity:** geometry, motion and behaviour still match the Arc demos. Only colour differs.
8. **Checks:** staff tests, typecheck and build pass.
9. **Local review before main:** the user reviews it locally first, then it goes to main through a PR.

## Decisions (4 Nov 2026)

1. **No theme layer or picker.** The dark sidebar preview washed out the navigation colours, so the sidebar stays white and untouched.
2. **Screen by screen.** Each screen is inspected and recoloured on its own. The first three are Overview, Appointments (with its Waitlist and Queue tabs) and Schedules. The user reviews those before any others change.
3. **Brand colour:** blue for now, matching the approved setup guide. The user can still change this.
4. **All screens done locally (5 Nov 2026).** The per-screen gate and colour modes are gone, so the colours apply everywhere in staff-web. `StateBadge` now shares `Status` colours.

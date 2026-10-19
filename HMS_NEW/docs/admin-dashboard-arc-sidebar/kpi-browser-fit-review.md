# Overview KPI browser fit review — 19 October 2026

The user explicitly requested browser checks because the latest KPI block looked wrong and did not fit the dashboard. This supersedes the earlier instruction to leave visual verification entirely to them **for this targeted Overview review**.

Observed active dashboard: `http://127.0.0.1:5198/staff/overview`. Compared the existing local KPI demo at `http://localhost:4477/components/pro/kpi-drilldown/demo/?theme=light`, in collapsed and expanded states. No catalog-wide sweep or provider/domain writes.

| Before | After |
| --- | --- |
| Standalone 1000px-wide frame inset from the page edges | Explicit `embedded` placement fills the Overview content width, with no extra outer frame |
| About 268px-high cards with large empty plot areas for sparse clinic history | 168px-high cards with 56px sparkline slots; measured desktop columns about 431px wide |
| Five explanatory lines above the block | Range/timezone caption under the title, one history status line, detailed help in the existing Arc Tooltip |
| A large setup guide above all reporting | Reporting first; the same setup guide and its behavior remain immediately below |
| Default 30-day span despite only four known dates in this clinic | Dashboard defaults to 7 days; 30 and 90 remain selectable, with genuine missing-history gaps |
| Two operational cards filled two of three columns | Those two cards share the available row equally |
| “vs — the 30 days before”; red unavailable table delta | “Previous period unavailable” and a neutral unavailable delta |
| Sparse count spikes were interpolated down by the demo's fixed 72-point detail sampling; count-axis labels could repeat | Detail plots use every actual day, morph prior geometry to the new sample length, and show meaningful nonnegative count guides (including 0 / 0.5 / 1 for an all-zero series) |

## Bounded component changes

`KpiDrilldown` adds optional `embedded` and `caption` props. Embedded layout is selected only by HMS Overview; the original component's standalone width, frame and card density remain the default. The user-requested fit correction authorises this placement exception. Expansion/fold-back, measured panel layout, motion tokens/springs, range indicator, compare control, keyboard cursor, close focus and focus return retain the reference engine.

Exact daily-count data requires raw daily vertices rather than the demo's snapshot resampling. `countFrame` in `period-data.ts` preserves null history and daily extrema. Only animation's starting geometry is interpolated when changing the number of points; final paths use actual daily values. Keyboard Left/Right now moves exactly one actual calendar day even in the 90-day range. Axis labels permit half-count guides without rounding them into duplicate integer labels; headlines/rows remain integer counts.

A browser console check caught a React static-children warning introduced when unavailable comparison text replaced a fixed array. The dynamic label now uses `jsx`, and the final expanded-state interaction produced **zero new console errors**. Older console history contained duplicate-key warnings; these were not reproduced by the current scoped interaction sequence, and this review does not claim an app-wide console audit.

## Observed browser checks

- Collapsed layout: measured card height 168px, first card and report section share their left edge, report section width about 1316px; no narrow embedded frame.
- Selected 7 / 30 / 90 days and observed matching date captions and values.
- Opened New bookings by click and Enter; inspected the local reference's expansion and return states.
- Changed Doctor → Channel: the actual Front desk row remained exactly 2 bookings and 100% share in this local dataset.
- Toggled Compare. No fabricated previous-period totals when history was unavailable.
- Chart Left arrow: actual Oct 18 value 2; detail axis labels 2 / 1 / 0. Unknown dates stayed gaps.
- Escape first cleared the chart cursor; Escape again folded the panel; focus returned to the original New bookings card.
- Keyboard Tab opened About this activity report; help included updated time, history coverage and dash/zero-baseline meanings.
- Settled expanded panel: content fit inside its measured width/height and no document horizontal overflow. Earlier in-transition screenshots are not clipping defects.
- Final state restored to the 7-day Overview. No real appointments, patient details, configuration or provider records were changed to conduct these checks.

Screenshots: [Overview](verification/overview-kpi-fit.jpg), [expanded report](verification/overview-kpi-expanded.jpg). These capture the actual local dashboard and synthetic/local preview context, not production acceptance. This is a targeted desktop check, not exhaustive verification of every theme, viewport, reduced-motion preference or metric/data history.

## Automated checks and continuation

`npm test`: **235/235 pass**. `npm run build`: pass (existing large-chunk warning). The prior backend report tests remain 51 passing from the reporting wave; backend code and contracts were not changed or rerun in this UI-only correction.

Inventory remains **48 integrated folders (44 adopted + 4 support), 201 unintegrated, 249/249 first-pass documentation screens**. One existing catalog entry received a current rendered check; this does not add a unique component or a new historical reference count. Source provenance hashes and catalog evidence flags are updated. Continue from this review before the older source-only KPI notes.

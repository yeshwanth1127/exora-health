# Local Arc report components

Gauge, DonutChart, MetricCard, AnimatedCounter and their module CSS originated from `/Users/deepakonda/Downloads/test/arc-components/components/free/`. The shared motion token export is copied to `lib/motion-tokens.ts` so the original relative imports work. DonutChart, MetricCard, AnimatedCounter and motion tokens remain unchanged.

The original local sources were rendered together in a temporary reference page before integration. Verified the Gauge at its initial 72 and updated 100 values, MetricCard/AnimatedCounter number changes through 72/99/100/9, Donut legend selection and keyboard ArrowDown/Enter, and the empty dataset.

## Requested report adaptation, 23 October

The user explicitly requested a red/amber/green semicircular scale matching their supplied reference, removal of score tiles, and a concise issues view. Gauge now has an opt-in `variant="scale"`: a three-band half-circle and moving marker, with threshold colors and number/label matching score severity. The default Arc ring geometry remains intact. Both variants share the original count animation, threshold state changes, springs, reduced-motion handling and accessible meter semantics. The scale intentionally differs from the original Arc ring in geometry, size, bands, marker and readout position.

The report supplies danger below 50, warning from 50, and success from 80. Category scores are an inline definition list instead of MetricCards. A 160px DonutChart uses its existing size/thickness/color/selection APIs and filters the issue list. Its source, interactions and geometry are unchanged. All issues needing attention appear first by default, sorted by checklist weight; native details rows expose evidence and points. Unassessed scores remain dashes and never become fabricated zeros.

The parent stylesheet supplies layout and scoped foundation variables. Arc components are kept separate from marketing-wide styles. Verification details are saved in `docs/business-visibility-check/reach-report-visual-revision.json`. Browser checks covered report scores 76 (amber) and 80 (green), plus a temporary isolated gauge harness at 30 (red), 0 and 100. OS reduced-motion switching has not been exercised in-browser; the shared original reduced-motion code remains intact.

## Brighter palette and synchronized scale

The scale variant owns vivid coral `#ff4d57`, amber `#ffb020` and emerald `#10b981` bands, with deeper readable text companions. The marker now derives from the count MotionValue, and the state follows the rounded on-screen count throughout the entrance and subsequent changes. This avoids different springs moving the marker ahead of the digits. The original default ring behavior remains unchanged. Report category scores and DonutChart data bindings use the corresponding palette. Verified the report at 76 and the isolated scale through 30 → 100 → 50 → 80. Public build/type checking and 12 web tests pass.

## Reorganized report and category donuts

The user requested four small donut progress numbers in place of the category scores. `ProgressDonut` is a new single-value adaptation alongside the original Arc DonutChart, using the existing Motion library, original shared spring/timing tokens, intersection-based reveal, reduced-motion handling, and accessible meter semantics. The original multi-segment DonutChart is unchanged and no longer used on the report. The four category meters show a neutral dash for an unassessed category. These circles intentionally differ from the original multi-segment chart; this is the user-requested progress presentation.

The report now uses status filters, one issues list and a clinic/location widget inspired by the estimate flow. Preview banners and state controls were removed; fictional data remains explicitly identifiable by the clinic name/address and never replaces a live API error. The partial preview is reachable with `?state=partial` for verification.

## Compact checklist and score help, 23 October

`bottom-sheet/` and `popover/` are byte-for-byte copies of the corresponding local Arc free sources and module CSS. Their original motion, focus, dismissal and panel geometry are preserved. The report uses the supported single `.68` sheet detent, trigger, title, description and children APIs. Each trigger owns its sheet so Escape returns focus to the correct opener. Application content supplies the checklist, source/status filters and evidence rows. The inline list is limited to four attention items; the sheet contains all 17 checks. The question-mark Popover contains score methodology formerly displayed below the report.

Reference and integration were inspected in the browser. The reference harness uses the site's border-box reset and shared scoped foundation variables. The standalone reference sources are unchanged; the user's prior gauge and progress-donut adaptations remain separate.

Latest verification: desktop popover opening/Escape/focus return, source filtering, all 17 checks and contained sheet scroll; mobile popover bounds, no horizontal overflow, all-checks sheet, drag dismissal and return to Read all. The unavailable opener returned focus to itself. Reference/app panel width (576px), radius (34px), typography and responsive height formula were inspected. Exact screenshot parity at the same viewport remains unverified because the browser applied different viewport sizes to the reference and app tabs despite overrides. OS reduced-motion preference switching remains unverified; original reduced-motion branches are unchanged. Evidence is in `reach-compact-verification.json`.

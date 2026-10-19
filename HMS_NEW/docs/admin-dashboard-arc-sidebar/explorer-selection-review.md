# Explorer selection review — 19 October 2026

The user asked whether KPI explorer, Revenue explorer, Metric explorer and Choropleth explorer belong in the clinic dashboard. The local catalog calls the first component **KPI drilldown**. This is a selection/source/data-contract review only; no explorer was approved or implemented by this request.

## Recommendation

**Prefer KPI drilldown for a later Overview reporting feature. Keep Metric explorer as an alternative for a trend-focused analytics page. Defer Revenue explorer for the clinic dashboard, and skip Choropleth for the current city-focused website view.** Do not put KPI drilldown and Metric explorer around the same metrics in the same section: their expanding-card/chart interactions overlap.

| Component and local demo | Before | Proposed placement/after | Decision and useful question |
| --- | --- | --- | --- |
| [KPI drilldown](http://localhost:4477/components/pro/kpi-drilldown/demo/?theme=light) | Overview has plain Arc Metric cards plus the 14-day booking chart | Overview: a selected card expands into a detailed trend/comparison and a permitted doctor/department/channel breakdown | Best product fit after reporting work. Helps explain a change in bookings, completed visits, cancellations or explicitly defined attendance/no-show rates |
| [Metric explorer](http://localhost:4477/components/pro/metric-explorer/demo/?theme=light) | Website analytics has separate metric cards and a visitors chart | Website analytics Overview: one expandable trend surface switching Visitors, Booking starts, Bookings and conversion, provided those metrics are correctly defined and aggregated | Alternative to the KPI approach. Useful for moving between a small set of trends; the current component has no runtime data props and hard-coded SaaS formatting/math |
| [Revenue explorer](http://localhost:4477/components/pro/revenue-explorer/demo/?theme=light) | No clinic collections/payment reporting contract is exposed by the reviewed dashboard/API | A future Finance/Collections screen should start with actual collections, refunds, outstanding amounts and period totals | Defer this specific component. Its stock/flow model is subscription MRR with new/expansion/churn; clinic consultation fees and collections do not map to that model. It fits the platform operator's SaaS billing dashboard better |
| [Choropleth explorer](http://localhost:4477/components/pro/choropleth-explorer/demo/?theme=light) | Website analytics has sources/devices and no visitor-area field | If a real catchment question arises, begin with a ranked locality/postcode table and actual enquiry/booking counts. A map can follow for recognised adjacent areas or a multi-branch network | Skip for the current clinic website dashboard. A city-focused clinic gains little from a country/state heat map; geography needs to lead to an actual service-area, branch or campaign decision |

## Current application evidence

- `apps/api/src/modules/booking/read.ts` → `operationsSummary`: one clinic's **14 daily booking-creation counts**, all-time status/channel mix, current doctor/hour/hold state and recent appointments. These are different time bases; they cannot be silently presented as one selected-period report.
- `apps/api/src/http/routes/booking.ts` → `/v1/operations/summary`: date and permitted clinic scope are bound to the existing summary. No arbitrary reporting-range/breakdown response is added here.
- `apps/staff-web/src/hms/Overview.tsx` and `src/modules/operations.tsx`: the UI explicitly labels all-time booking metrics and retained confirmations; retained is **not attendance**. Do not relabel it as attendance or conversion without an explicit numerator/denominator/cohort definition.
- `apps/staff-web/src/hms/website-analytics.ts`: the active page model has day-level visitors, views, booking starts, bookings, source/device counts and clicks. Its seed produces **120 synthetic days**. It has no visitor city/locality/postcode geography. `regions` identifies the PostHog hosting region, not visitor location.
- `apps/staff-web/src/hms/WebsiteAnalytics.tsx`: the active website page persists its existing browser-preview data. That preview is not evidence of live PostHog/site collection.
- The reviewed active booking summary/directory/API route surface has configured consultation prices and billing-item references, but no exposed collections/refund/payment series supporting this explorer. Configured fee × appointment count is not recorded collected revenue. This is a statement about the reviewed application contracts, not a claim that billing can never be added.

## Source-level integration conflicts

The local packages are compiled recreations, not the original TypeScript sources. Their documentation alone understates some binding work:

### KPI drilldown

`components/pro/kpi-drilldown/src/Component.cjs` exposes `kpis`, `dimensions`, `end`, `defaultRange`, `selected` and `onSelectedChange`. The demonstrated ranges are **7/30/90 days**, and the docs request twice the longest range for comparison: **180 days** for the full range set.

However, the summary takes the final value of the current slice and compares it with the final value of the preceding slice. Even `kind: "total"` is not a period sum. The demonstrated breakdown uses supplied shares/deltas to derive values, with a synthetic formula for rate rows; it does not consume exact per-range breakdown totals and rate numerators/denominators.

For clinic flow metrics, bind exact current/prior period totals, weighted rates and range-specific dimension rows. Do not feed daily counts directly into a last-value headline or manufacture rate breakdowns. Preserve the reference card expansion, controls, keyboard/focus, motion and table presentation. The required data/aggregation extension is a concrete implementation concern, not a completed drop-in adapter.

### Metric explorer

`components/pro/metric-explorer/src/Component.cjs` defines a fixed **730-day** calendar with **30D/90D/12M** controls, four SaaS metrics and no data props on `MetricExplorer()`. Its headline is the latest snapshot compared with an earlier snapshot. Currency/count/percentage formatting depends on the sample metric IDs.

The displayed 12-month range uses 364 days; full previous-period support reaches roughly two years. Current 120-day website preview data cannot fill those ranges truthfully. A runtime data/format/range binding and correct period aggregation would be needed. Visitor-to-booking conversion should be the period's booked count divided by the period's visitors, rather than an unweighted mean of daily percentages. The actual dataset/end date and missing-history behavior must be explicit; no invented older days or fabricated zero history.

### Revenue explorer

`components/pro/revenue-explorer/src/RevenueExplorer.cjs` has no runtime data props and a generated 48-month subscription series: the visible 24-month window plus comparison history. It computes ending MRR from starting MRR plus new/expansion less churn. Renaming those series to consultations/procedures/refunds would preserve the wrong financial relationship. For future clinic finance, use the existing Arc Line/Bar chart with a real collection ledger first, or explicitly specify a different financial model before considering this block.

### Choropleth explorer

The component does accept custom `regions`, metrics, view-box geometry and optional subregions. Its bundled country maps are not an India/locality map; local adoption requires actual recognised city/postcode/ward boundaries in addition to data.

A map is useful when comparing geography changes an action: actual booking/enquiry concentration, service reach, or branch coverage across areas. A large filled area can attract attention without representing a large or useful audience. A short ranked table is easier to act on when only a few localities matter. No visitor-location collector, geocoding workflow or patient catchment dataset is introduced by this review.

## Proposed next feature boundary

If KPI drilldown is selected later, implement it as one bounded reporting feature: clinic-local current/prior ranges, exact scoped metric definitions, real breakdowns, unavailable/zero-denominator handling, and the reference UI. Start with metrics supported by stored records; add attendance/no-show/revenue only when their contracts and definitions exist. Keep the clinic operational Overview clear of unsupported dimensions, SaaS subscription vocabulary and fake history.

Metric explorer remains an alternative; choosing it requires the same truthful history/aggregation work. The current source does not support a simple data-only 120-day website swap while retaining every demonstrated range.

## Evidence and counts

- Four previously screened entries were revisited, not four newly discovered components.
- Catalog coverage remains **249/249 documentation-screened**, **47 integrated folders (43 adopted + 4 support)** and **202 unintegrated**.
- Source/doc/application inspection only. No new browser observations, source integration, backend writes, build/test runs or runtime changes. Historical rendered observations remain historical.
- `catalog-coverage.json` records these updated selection decisions. The prior implementation baseline remains `abe547e` with 227 frontend tests/build verified in its own wave.

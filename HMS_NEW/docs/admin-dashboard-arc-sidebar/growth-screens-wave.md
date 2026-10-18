# Growth screen coverage correction — 19 October 2026

The user correctly identified incomplete migration on the active WhatsApp, Google Business and Website analytics screens. The catalog audit counted available/copied components and screened documents; it did not establish migration of every placement. This wave expands existing Arc components into those screens, plus the remaining Voice and Loyalty summary tiles and tabs.

## Counts and evidence

- **46 component folders: 41 adopted + 5 support, unchanged.** No new catalog component or dependency was added.
- **249/249 first-pass documentation screens, unchanged.** This implementation does not add newly explored entries.
- **34 summary metric placements** now use the shared Arc Metric card binding across WhatsApp Overview/Message log, Google Overview/Insights, Website analytics, Voice and Loyalty. This includes Google's existing weighted profile score; its weights/calculation are unchanged.
- Six tab sets use the scoped Arc Tabs: WhatsApp, Google Business, Website analytics, website installation platform, Voice and Loyalty. Panels remain controlled by existing selection/navigation state.
- Six additional charts use existing Arc Bar chart / Split bar. The existing Analytics Line chart and the main Overview's Arc charts remain in place.
- **219 frontend tests pass.** Production frontend build passes. Visual/pointer/motion verification remains with the user; no browser automation or screenshots were used.
- Dashboard **5198** was confirmed listening from this isolated staff checkout. Existing dashboard/API routing remains dashboard5198 → isolated API3080. No runtime restart or backend writes were needed.

## Changes and exact placements

| Before | After | Existing binding preserved |
| --- | --- | --- |
| Underlined growth workspace tabs, legacy Voice/Loyalty tabs and installation-platform tabs | Arc Tabs + TabsContent, with scoped reference tokens and inline unread counts | Current tab IDs, URL updates, callbacks, permitted panels and WhatsApp `requestLeave` |
| Custom summary tiles | Arc Metric cards through `GrowthMetric.tsx` | Original counts, ranges and comparison baselines; no generated trends/history |
| Google Overview custom score ring | Arc Metric card above the existing Profile checklist | Original weighted `score(tasks(...))`, /100 denominator and quick-fix actions |
| Google Insights daily CSS bars | Arc Bar chart, daily average, day scrubber and exact-value table | `data.daily[].day/views`, last 30 days |
| Google Insights keyword CSS bars | Arc Bar chart and exact-value table | Existing keyword terms/counts; rank numbers keep the axis short, full terms appear in scrubber/table |
| Google Reviews rating distribution bars | Arc Split bar and exact-value table | Actual counts in each mutually exclusive 1–5-star bucket |
| Website analytics source/device CSS bars | Arc Split bars and exact-value tables | Existing source/device totals for the selected range |
| Website analytics booking-stage CSS bars, including a minimum visible fill for zero | Arc Bar chart and exact-value table; existing conversion percentages remain textual | Visited → opened booking → booked counts. Stages overlap, so they are not summed as partition shares |
| Native growth badges and triangle trend text | Arc Badge via `GrowthBadge.tsx`; signed comparison values | Existing status/content and preview labels. No baseline means no fabricated percentage increase |
| WhatsApp setup progress strip | Read-only Arc Stepper | Original current/reached setup stage; existing locked/completed step navigation remains below |
| Custom chat/message-log search inputs | Arc SearchField | Original query/filter state; message-log entity/type choices still use existing Arc-backed `Pick` |
| Native WhatsApp reception/quiet-hour and Google opening-hour controls | Existing Arc TimeField | Exact HH:mm strings and existing disabled fieldsets/callbacks |
| Native holiday and Google post date controls | Existing Arc DateField | YYYY-MM-DD values, event end-date minimum and original actions |
| Native scheduled-post/promotion datetime control | Two existing Arc date/time controls through `GrowthDateTime.tsx` | Same local minute-precision `dateTtime` string; no UTC conversion. Partial drafts stay visible and emit an empty scheduled value until complete |

## Source and adapter method

New application bindings live in `src/hms/GrowthMetric.tsx`, `GrowthCharts.tsx`, `GrowthBadge.tsx`, `GrowthDateTime.tsx` and `growth-metrics.ts`. They reuse the already copied Arc components rather than rebuilding their geometry or changing global dashboard styles.

`arc/metric-card/metric-card.tsx` has two explicit data-binding extensions:

1. `decimals` passes to the existing AnimatedCounter, retaining fractional conversion percentages.
2. A nullable value renders an accessible unavailable dash with existing counter typography. An absent WhatsApp delivery denominator remains unavailable, distinct from a measured 0%.

Numeric default demo output, CSS and motion are unchanged. The source manifest records the adaptation and current SHA256. The other Arc component sources/CSS are unchanged.

Metric comparisons use a signed percentage for a nonzero baseline, `New` for a positive count against zero, and no change percentage for absent baseline/data. No fake increase, timer or provider state is introduced.

## Data and workflow boundaries

- Active WhatsApp, Google Business, Website analytics and Loyalty continue using their pre-existing browser-preview/sample models where applicable. Their preview badges and provider availability gates remain. This is not evidence of live Meta/Google/PostHog connection, delivery or persistence.
- Voice continues reading the existing scoped backend history/summary. Recording/transcript permissions, audited access and playback behavior are unchanged.
- Permission checks, real API operations, local-storage keys, seeded data and existing command/leave guards are unchanged. No provider sign-in, patient mutation, live message, campaign or external email was sent for verification.
- The reference patient-facing Google listing/post and WhatsApp conversation previews retain their recognizable brand presentation. Dashboard controls around those previews use the migrated components.
- `App.tsx` routes to `hms/WhatsApp.tsx`, `hms/GoogleBusiness.tsx`, `hms/WebsiteAnalytics.tsx`, `hms/Voice.tsx` and `hms/Loyalty.tsx`. Old metric markup still exists in `modules/whatsapp.tsx` and `modules/whatsapp-notifications.tsx`, used by the separate legacy app; it is not the active WhatsApp workspace and was not edited here.

## Remaining scope, explicitly not claimed complete

- Native provider file choosers, ordinary page/card/table layouts and existing switches/checkboxes still exist. Arc Switch is catalog-screened but not copied; it needs its own source/dependency review before adoption.
- Existing browser confirmation dialogs in growth actions were not replaced as part of this chart/control correction. They are a useful follow-up for the already adopted Dialog, preserving each action's exact confirmation/permission semantics.
- No Pro Funnel chart, full metrics-dashboard block, new integration backend, Rich text editor or signature workflow was added. The booking-stage Bar chart compares the actual stage counts without inventing segment data.
- Some prior controls already used Arc adapters, while others remain custom. Do not claim full-page or all-state demo parity from this wave or from the folder count.

## Verification and continuation

- `npm test`: **219 passed, 0 failed**. Five new checks cover signed/missing baselines, unavailable versus measured zero, fractional percentages, exact zero-valued chart rows, empty category charts and local scheduling values.
- `npm run build`: **PASS**. Existing large-bundle warning remains; it does not establish visual parity.
- Oxlint on changed TypeScript files: **0 errors**, with 26 warnings in the existing screen/helper files (mixed exports, render-time clock reads and an existing array key). New adapter/test files have no reported warnings.
- No screenshots, browser sweeps, provider tests or database changes. The user retains visual verification.
- Inspect WhatsApp Overview/Inbox/Message log/Settings/setup, Google Overview/Reviews/Insights/Profile/Posts, Analytics Overview/Websites installation instructions, Voice summary and Loyalty Programs.
- Follow up only on selected remaining placements; do not start another catalog adoption wave automatically. The three previously recommended small components (Tag input, Countdown, Action button) are still recommendations, not implementation in this wave.

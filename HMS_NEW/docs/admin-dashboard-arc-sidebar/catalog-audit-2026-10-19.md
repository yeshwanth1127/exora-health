# Local Arc catalog coverage and next fits — 19 October 2026

> Historical wave snapshot. Current counts and the completed switch/checkbox/confirmation follow-up are in [growth-controls-confirmation-wave.md](growth-controls-confirmation-wave.md); the current machine-readable ledger has 47 integrated folders.
Selection/documentation pass only, after implementation `e7b9f80`. No dashboard code, dependency, runtime or patient/provider data changed. The user asked to scan further components and reconcile explored/remaining counts, while retaining their browser/visual review preference.

## Reconciled counts

| Measure | Count | Meaning |
| --- | ---: | --- |
| Local UI catalog entries | **249** | **133 free + 116 Pro** distinct registry/demo names; shared-source variants are counted as catalog entries, not unique original implementations |
| Previously documentation-screened | **166** | 116 Pro from the recorded all-Pro survey + 50 distinct free entries linked in earlier assessments |
| Newly documentation-screened now | **83** | Remaining free docs, including four support copies whose standalone docs were not previously assessed |
| First-pass documentation coverage now | **249 / 249** | Description and intended-use screening is complete for this local catalog |
| Remaining first-pass docs | **0** | This does not mean all interactions or implementation fits have been exhaustively verified |
| Current integrated component folders | **46** | 41 adopted + 5 support; unchanged by this pass |
| Entries not integrated | **203** | Many are deliberately unsuitable, redundant, blocked on a contract, or marketing-only |
| Named references with historical rendered-demo observations | **40** | Deduplicated from the candidate ledger and Pro survey; not 40 exhaustive fidelity passes |
| Without a recorded rendered-demo observation | **209** | No new browser verification was performed in this pass |

Authoritative local inputs:

- `/Users/deepakonda/Downloads/test/arc-components/free-source/source-index.json`: 135 entries. Exclude `arc-foundation` and `arc-motion-tokens` infrastructure. Include `segmented-control`, which has its own UI/docs even though the index labels it a dependency: **133 UI entries**.
- `/Users/deepakonda/Downloads/test/arc-components/portable/index.json`: **116 Pro entries**, matching the local packages/docs.
- Earlier `component-inventory.md`, `next-review-shortlist.md`, and `pro-wave-shortlist.md` at `e7b9f80` establish prior screening/rendered observations. Historical Pro coverage is attributed to that recorded survey, not falsely claimed as a new full source audit here.
- `catalog-coverage.json` contains one row per entry, hashes of both indexes, prior/new review evidence, integration status, disposition, local docs and demo links.

The old 82/83 count belonged to earlier smaller passes and was not updated to deduplicate the later all-116-Pro survey. It cannot be added to 116. These are **local catalog counts**, not a fresh count of the upstream website.

## Strongest next choices

| Priority / component | Exact placement | Before | After / real binding | Integration limit |
| --- | --- | --- | --- | --- |
| 1. [Tag input](http://localhost:4478/free-previews/tag-input/?theme=light) | Doctors → Doctor details → Profile → Languages and Qualifications | Comma-separated text fields | Individual removable values using the already supported string arrays | Keep original strings/validation/permissions, disabled fieldsets and the raw uncommitted tag draft in unsaved protection. Do not silently normalise existing data away. |
| 2. [Countdown](http://localhost:4478/free-previews/countdown/?theme=light) | Booking → Review & confirm → hold-expiry line | Manually formatted `m:ss remaining` | Compact minutes/seconds from the actual `hold.holdExpiresAt` and current booking clock | Set `completeLabel` to Hold expired. Existing expiry/confirm/release/unknown-outcome logic remains authoritative; the timer must not auto-confirm or create a hold. |
| 3. [Action button](http://localhost:4478/free-previews/action-button/?theme=light) | Doctors → Profile → Save booking profile, initially one save action | Ordinary saving button plus feedback | Save → Saving → Saved feedback tied to the real command result | The reference treats a resolved callback as success. `useCommand.run` returns undefined on failure/unknown, so the binding must reject that case and retain the existing visible recovery/error. No fake timed success. |
| 4. [Resizable panels](http://localhost:4478/free-previews/resizable-panels/?theme=light) | WhatsApp preview Inbox → list / conversation / patient-context panes | Fixed 300px and 260px side panes | Staff can give the chat more width or widen context, with keyboard-operable dividers | A larger layout refinement, not a small field swap. Use the current full-height workspace, stable pane IDs and real draft guards; no fixed demo-sized embedded window. Persist only harmless width preferences if used. |
| Optional: [JSON viewer](http://localhost:4478/free-previews/json-viewer/?theme=light) | Activity → Feed → expanded event → Changes | Long raw JSON preformatted text | Read-only searchable/collapsible changes with copy value/path | Advanced detail only. Preserve the understandable event summary, full identifiers, already-authorised payload, current filtering/export and exact values. Do not introduce a general backend/debug console. |

Recommended next small wave: **Tag input + Countdown + one Action button**. Treat Resizable panels as a separate larger layout refinement; JSON viewer is optional for admins who need the full audit details. No component is implemented or newly approved by this scan.

These five preview URLs responded locally. An HTTP response verifies availability only; no new visual, pointer, motion or keyboard testing is claimed.

## Other useful options, and deliberate exclusions

- **Sparkline** is a compact alternative for the Overview booking metric using the existing 14-day `dailyBookings` series. Keep the current full Line chart unless there is a reason to reduce its space; do not add redundant charts or invented history.
- **Chip group** could replace Consultations' Visit status dropdown, with single selection and empty selection meaning All visits. **Radio group** is another option for a short fixed form choice, but existing Radio cards already cover the Booking choice. Neither warrants another parallel selector.
- **Scroll area** can refine a long chat/history pane. Its `viewportRef` supports the existing scroll-follow binding; avoid creating a second nested scroll region. It is not a reason to put Settings back into an embedded window.
- **Number field**, revisited from the old shortlist, accepts numbers rather than nullable values. Doctor experience currently distinguishes blank/unknown from zero, so it is **not** a drop-in fit there. The same caution applies to blank/default monetary fields already handled by Money input.
- **Confirm morph** offers Undo, while clinical/security operations may require reasons and lack a reverse command; retain those review dialogs. **Signature pad**, **Rich text editor**, **Mentions** and **Comment thread** need actual storage/evidence/format/permission contracts before adoption.
- **Password / OTP / sign-in** components do not add identity-provider capabilities. **Usage meter / Gauge** need real denominators; dense/annual chart types need actual historical datasets. No synthetic quotas, clinical scores or histories.
- Keep the centered command search, System theme option and Settings theme placement already chosen by the user. Do not add marketing blocks, touch-first controls or extra animated presentation just because they are available.

## Evidence and continuation

This pass screened the descriptions/intended-use sections of the 83 remaining free documents, with targeted API/source/application checks for Tag input, Countdown, Action button, Resizable panels, JSON viewer, Scroll area, Chip group, Radio group, Sparkline and the earlier Number field. Existing source placements were checked in Doctors.tsx, Booking.tsx, WhatsAppInbox.tsx, Consultations.tsx, Overview.tsx and ActivityFeed.tsx.

No tests/build were run for this docs-only pass. The application baseline remains the preceding 214-test/build-verified implementation, 46 component folders, branch `codex/admin-dashboard-arc`, dashboard5198 → isolated API3080. No browser automation, runtime restart, API writes, deployments or outgoing messages were performed.

## Newly screened entries: 83

The per-entry first-pass decisions below include support entries already used by other components. Detailed future integration still requires the selected reference/API/state review.
| Component | Screening result | Fit or reason |
| --- | --- | --- |
| [action-button](http://localhost:4478/free-previews/action-button/?theme=light) | recommend | Doctor profile Save: confirmed save feedback on the button. Adapter must reject failed or unknown useCommand results; undefined is not confirmed success. |
| [activity-heatmap](http://localhost:4478/free-previews/activity-heatmap/?theme=light) | requires-data | The Overview supplies a fixed 14-day booking series, not a year/dense multi-range history; no invented historical data. |
| [animated-counter](http://localhost:4478/free-previews/animated-counter/?theme=light) | already-support | Already integrated as shared support; this pass records their independent document screening rather than counting them as new adoptions. |
| [announcement-bar](http://localhost:4478/free-previews/announcement-bar/?theme=light) | requires-content | Needs an actual organisation-wide notice source, dismissal rules and audience; no promotional/maintenance notices should be fabricated. |
| [avatar](http://localhost:4478/free-previews/avatar/?theme=light) | already-support | Already integrated as shared support; this pass records their independent document screening rather than counting them as new adoptions. |
| [avatar-group](http://localhost:4478/free-previews/avatar-group/?theme=light) | defer | Could show a real team/assignment set, but there is no current crowded collaborator strip needing it. Do not infer presence. |
| [billing-toggle](http://localhost:4478/free-previews/billing-toggle/?theme=light) | exclude-commerce | Pricing-plan/marketing comparison patterns do not map to current staff administration data. |
| [blog-grid](http://localhost:4478/free-previews/blog-grid/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [bottom-sheet](http://localhost:4478/free-previews/bottom-sheet/?theme=light) | exclude-desktop-scope | Mobile/touch-first pattern; user explicitly retained desktop-only scope. |
| [brush-chart](http://localhost:4478/free-previews/brush-chart/?theme=light) | requires-data | The Overview supplies a fixed 14-day booking series, not a year/dense multi-range history; no invented historical data. |
| [calendar](http://localhost:4478/free-previews/calendar/?theme=light) | already-support | Already integrated as shared support; this pass records their independent document screening rather than counting them as new adoptions. |
| [card](http://localhost:4478/free-previews/card/?theme=light) | defer-duplicate | Existing cards, Empty state, Copy button, Badge and Toast already cover these jobs; another presentation layer adds little current workflow value. |
| [card-stack](http://localhost:4478/free-previews/card-stack/?theme=light) | exclude-no-task | Deck throwing, galleries and visual comparisons do not improve the current clinic record workflows. |
| [carousel](http://localhost:4478/free-previews/carousel/?theme=light) | exclude-no-task | Deck throwing, galleries and visual comparisons do not improve the current clinic record workflows. |
| [changelog-feed](http://localhost:4478/free-previews/changelog-feed/?theme=light) | requires-content | No maintained staff-facing release-note feed/subscribe destination is connected; audit events are not product releases. |
| [chat-thread](http://localhost:4478/free-previews/chat-thread/?theme=light) | defer-duplicate | Support conversation has just been adopted for WhatsApp; this adds reactions/typing/attachments without matching capabilities and would redo the current thread. |
| [chip-group](http://localhost:4478/free-previews/chip-group/?theme=light) | optional | Consultations Visit status filter: single-select chips with empty selection mapped to All visits; replaces the current select rather than adding a second filter. |
| [code-block](http://localhost:4478/free-previews/code-block/?theme=light) | defer | Activity has structured audit changes rather than source-code snippets; JSON viewer is the more suitable optional detail inspector. |
| [color-picker](http://localhost:4478/free-previews/color-picker/?theme=light) | defer | Appearance currently offers light/dark/system; arbitrary branding colours are not a saved supported preference. |
| [comment-thread](http://localhost:4478/free-previews/comment-thread/?theme=light) | requires-contract | Clinical notes and consent currently use existing text/field contracts; structured markup, mention targets, threaded editing and resolve need corresponding persistence and permissions. |
| [comparison-table](http://localhost:4478/free-previews/comparison-table/?theme=light) | exclude-commerce | Pricing-plan/marketing comparison patterns do not map to current staff administration data. |
| [confirm-morph](http://localhost:4478/free-previews/confirm-morph/?theme=light) | defer-contract-conflict | Existing destructive/security/clinical flows require reasons and guarded confirmations; demo Undo has no general reverse-command contract. |
| [contact-section](http://localhost:4478/free-previews/contact-section/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [cookie-consent](http://localhost:4478/free-previews/cookie-consent/?theme=light) | defer | Cookie/tracking preferences are a separate real application policy and persistence feature, not a cosmetic replacement for patient consent. |
| [countdown](http://localhost:4478/free-previews/countdown/?theme=light) | recommend | Booking review: compact minutes/seconds bound to the actual holdExpiresAt and existing clock; display Hold expired without creating a booking or replacing expiry guards. |
| [cta-section](http://localhost:4478/free-previews/cta-section/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [drawer](http://localhost:4478/free-previews/drawer/?theme=light) | defer | Current wide doctor panel and full-page patient flows already preserve recovery/leave guards. Another panel replacement is not a small polish change. |
| [elastic-slider](http://localhost:4478/free-previews/elastic-slider/?theme=light) | exclude-value-fit | No current approximate-value setting needs a slider; clinical amounts, dates and bounded exact values retain precise inputs. |
| [empty-states](http://localhost:4478/free-previews/empty-states/?theme=light) | defer-duplicate | Existing cards, Empty state, Copy button, Badge and Toast already cover these jobs; another presentation layer adds little current workflow value. |
| [expandable-card](http://localhost:4478/free-previews/expandable-card/?theme=light) | defer | Possible read-only patient/admin summary later; do not hide separately dirty editable forms or replace current explicit save boundaries. |
| [expanding-button-group](http://localhost:4478/free-previews/expanding-button-group/?theme=light) | defer | Moving labels and in-place success need guarded command bindings; the current primary actions/More menu already address clutter. |
| [expanding-search](http://localhost:4478/free-previews/expanding-search/?theme=light) | defer-duplicate | The user explicitly requested a centered, visible search panel. Do not collapse that approved search into an icon. |
| [faq-section](http://localhost:4478/free-previews/faq-section/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [floating-button-group](http://localhost:4478/free-previews/floating-button-group/?theme=light) | exclude-no-task | Canvas/editor tool tray has no current staff workflow requiring it. |
| [gauge](http://localhost:4478/free-previews/gauge/?theme=light) | requires-data | No confirmed allowance, capacity denominator or meaningful score is supplied for a truthful meter; do not invent quota or clinical health scores. |
| [hero-section](http://localhost:4478/free-previews/hero-section/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [icon-morph](http://localhost:4478/free-previews/icon-morph/?theme=light) | defer-duplicate | Existing cards, Empty state, Copy button, Badge and Toast already cover these jobs; another presentation layer adds little current workflow value. |
| [image-compare](http://localhost:4478/free-previews/image-compare/?theme=light) | exclude-no-task | Deck throwing, galleries and visual comparisons do not improve the current clinic record workflows. |
| [in-view-title](http://localhost:4478/free-previews/in-view-title/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [json-viewer](http://localhost:4478/free-previews/json-viewer/?theme=light) | optional-advanced | Activity Feed expanded Changes: searchable read-only inspection/copy of already-authorised audit JSON; retain readable summary, full IDs, filtering and export. |
| [login-centered](http://localhost:4478/free-previews/login-centered/?theme=light) | requires-auth-contract | Staff authentication/passwords are managed by the existing identity-provider flow; a local UI cannot add password or code verification contracts. |
| [logo-marquee](http://localhost:4478/free-previews/logo-marquee/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [mention-input](http://localhost:4478/free-previews/mention-input/?theme=light) | requires-contract | Clinical notes and consent currently use existing text/field contracts; structured markup, mention targets, threaded editing and resolve need corresponding persistence and permissions. |
| [newsletter-signup](http://localhost:4478/free-previews/newsletter-signup/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [otp-input](http://localhost:4478/free-previews/otp-input/?theme=light) | requires-auth-contract | Staff authentication/passwords are managed by the existing identity-provider flow; a local UI cannot add password or code verification contracts. |
| [page-header](http://localhost:4478/free-previews/page-header/?theme=light) | defer-large-replacement | Its project/actions/count chrome needs a separately designed record header; do not reintroduce duplicate page names or simulated Follow/Share/Archive actions. |
| [password-field](http://localhost:4478/free-previews/password-field/?theme=light) | requires-auth-contract | Staff authentication/passwords are managed by the existing identity-provider flow; a local UI cannot add password or code verification contracts. |
| [password-strength](http://localhost:4478/free-previews/password-strength/?theme=light) | requires-auth-contract | Staff authentication/passwords are managed by the existing identity-provider flow; a local UI cannot add password or code verification contracts. |
| [plan-comparison](http://localhost:4478/free-previews/plan-comparison/?theme=light) | exclude-commerce | Pricing-plan/marketing comparison patterns do not map to current staff administration data. |
| [popover](http://localhost:4478/free-previews/popover/?theme=light) | defer-duplicate | Existing date/select/filter components already own their anchored panels; no additional standalone popover job is currently needed. |
| [radio-group](http://localhost:4478/free-previews/radio-group/?theme=light) | optional | A short fixed form choice such as registration follow-up; reuse the already adopted Radio cards when descriptions are needed. Do not expand every select into rows. |
| [reactions](http://localhost:4478/free-previews/reactions/?theme=light) | exclude-no-contract | No staff comment/reaction persistence or workflow is present; do not invent social acknowledgements on patient data. |
| [resizable-panels](http://localhost:4478/free-previews/resizable-panels/?theme=light) | recommend-larger | WhatsApp Inbox: let desktop staff resize conversation list, chat and patient context within the current full-height workspace; stable panes and draft guards, no nested demo window. |
| [rich-text-editor](http://localhost:4478/free-previews/rich-text-editor/?theme=light) | requires-contract | Clinical notes and consent currently use existing text/field contracts; structured markup, mention targets, threaded editing and resolve need corresponding persistence and permissions. |
| [ridgeline](http://localhost:4478/free-previews/ridgeline/?theme=light) | defer-chart-fit | Needs an appropriate distribution, two-period, layered or hierarchical dataset; current simple operational summary does not justify another chart format. |
| [scroll-area](http://localhost:4478/free-previews/scroll-area/?theme=light) | optional | Long WhatsApp list or read-only history: edge fades and native scrolling; bind viewportRef to existing scroll-follow logic and avoid nested scrolling. |
| [shortcut-recorder](http://localhost:4478/free-previews/shortcut-recorder/?theme=light) | defer | No keyboard-remapping preference contract exists; current fixed shortcuts and accessible labels remain. |
| [sign-in](http://localhost:4478/free-previews/sign-in/?theme=light) | requires-auth-contract | Staff authentication/passwords are managed by the existing identity-provider flow; a local UI cannot add password or code verification contracts. |
| [signature-pad](http://localhost:4478/free-previews/signature-pad/?theme=light) | requires-contract | A drawn signature needs an actual capture/storage/evidence workflow; the exportable canvas alone does not establish recorded clinical consent. |
| [signup-form](http://localhost:4478/free-previews/signup-form/?theme=light) | requires-auth-contract | Staff authentication/passwords are managed by the existing identity-provider flow; a local UI cannot add password or code verification contracts. |
| [site-footer](http://localhost:4478/free-previews/site-footer/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [site-header](http://localhost:4478/free-previews/site-header/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [slider](http://localhost:4478/free-previews/slider/?theme=light) | exclude-value-fit | No current approximate-value setting needs a slider; clinical amounts, dates and bounded exact values retain precise inputs. |
| [slope-chart](http://localhost:4478/free-previews/slope-chart/?theme=light) | defer-chart-fit | Needs an appropriate distribution, two-period, layered or hierarchical dataset; current simple operational summary does not justify another chart format. |
| [slot-text](http://localhost:4478/free-previews/slot-text/?theme=light) | exclude-unnecessary-motion | Existing truthful loading/status/count feedback is sufficient; avoid slot-machine or simulated AI-working decoration. |
| [sparkline](http://localhost:4478/free-previews/sparkline/?theme=light) | optional | Overview bookings metric: use the existing 14-day dailyBookings series only. Avoid adding duplicate decorative charts or implying a longer history. |
| [split-button](http://localhost:4478/free-previews/split-button/?theme=light) | defer | Would fit multiple real export formats; Activity currently exposes CSV only, so there is no meaningful alternate action yet. |
| [stats-band](http://localhost:4478/free-previews/stats-band/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [streamgraph](http://localhost:4478/free-previews/streamgraph/?theme=light) | defer-chart-fit | Needs an appropriate distribution, two-period, layered or hierarchical dataset; current simple operational summary does not justify another chart format. |
| [swipe-actions](http://localhost:4478/free-previews/swipe-actions/?theme=light) | exclude-desktop-scope | Mobile/touch-first pattern; user explicitly retained desktop-only scope. |
| [tag-input](http://localhost:4478/free-previews/tag-input/?theme=light) | recommend | Doctor details: Languages and Qualifications are existing string arrays currently entered as comma-separated text; retain pending raw draft, disabled state and validation. |
| [text-morph](http://localhost:4478/free-previews/text-morph/?theme=light) | defer-duplicate | Existing cards, Empty state, Copy button, Badge and Toast already cover these jobs; another presentation layer adds little current workflow value. |
| [text-reveal](http://localhost:4478/free-previews/text-reveal/?theme=light) | exclude-marketing | Landing-page/content/marketing presentation; preserve the operational dashboard shell and record workflows. |
| [text-shimmer](http://localhost:4478/free-previews/text-shimmer/?theme=light) | exclude-unnecessary-motion | Existing truthful loading/status/count feedback is sufficient; avoid slot-machine or simulated AI-working decoration. |
| [textarea](http://localhost:4478/free-previews/textarea/?theme=light) | already-support | Already integrated as shared support; this pass records their independent document screening rather than counting them as new adoptions. |
| [theme-switch](http://localhost:4478/free-previews/theme-switch/?theme=light) | defer-duplicate | Keep theme selection in Settings and preserve System mode; these light/dark animation variants are not another required dashboard feature. |
| [theme-switch-eclipse](http://localhost:4478/free-previews/theme-switch-eclipse/?theme=light) | defer-duplicate | Keep theme selection in Settings and preserve System mode; these light/dark animation variants are not another required dashboard feature. |
| [theme-switch-rise](http://localhost:4478/free-previews/theme-switch-rise/?theme=light) | defer-duplicate | Keep theme selection in Settings and preserve System mode; these light/dark animation variants are not another required dashboard feature. |
| [theme-switch-split](http://localhost:4478/free-previews/theme-switch-split/?theme=light) | defer-duplicate | Keep theme selection in Settings and preserve System mode; these light/dark animation variants are not another required dashboard feature. |
| [tree-view](http://localhost:4478/free-previews/tree-view/?theme=light) | defer | No existing folder-like clinical navigation task needs this hierarchy; do not invent parent-child relationships for flat records. |
| [treemap](http://localhost:4478/free-previews/treemap/?theme=light) | defer-chart-fit | Needs an appropriate distribution, two-period, layered or hierarchical dataset; current simple operational summary does not justify another chart format. |
| [usage-meter](http://localhost:4478/free-previews/usage-meter/?theme=light) | requires-data | No confirmed allowance, capacity denominator or meaningful score is supplied for a truthful meter; do not invent quota or clinical health scores. |
| [waffle-chart](http://localhost:4478/free-previews/waffle-chart/?theme=light) | defer-chart-fit | Needs an appropriate distribution, two-period, layered or hierarchical dataset; current simple operational summary does not justify another chart format. |

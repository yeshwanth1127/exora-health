# PostHog analytics plan for Avocado Health

Status: implementation plan, 30 September 2026. No PostHog SDK, project, or live tracking has been configured by this document.

## What we need to learn

The first release should answer four product questions:

1. Which entry pages and calls to action move a visitor toward finding a doctor or requesting a visit?
2. Where do visitors go after a department, doctor, location, blog, or search page?
3. Which of the three booking UI steps loses people, and do validation errors explain the loss?
4. Does the Original or Light Green mode help visitors reach the booking UI? Compare like for like pages and traffic sources; the modes currently have different page coverage, so a simple overall conversion comparison would be misleading.

These are **prototype engagement** questions. The current appointment slots, OTP, and confirmation screens are demo UI. No event should be named `appointment_booked` or counted as a clinical/operational booking until a backend confirms a persisted reservation.

## Current app wiring

- `src/App.tsx` holds the page state and uses `history.pushState` plus `popstate`, with `?page=...` query routes. Track page changes at one central point after the settled route state changes, including first load and browser back/forward. Suppress duplicate views on React rerenders and development Strict Mode. Do not send the raw URL.
- Both visual modes use the same `Page` union. Attach `design_mode` to events; record the **effective** page mode as well as the selected preference when they differ, because Original mode currently falls back to Light Green on some pages.
- `ScheduleAppointmentPage` and `OriginalScheduleAppointmentPage` each contain appointment details, patient information, and confirmation. Shared instrumentation should give both the same event names and step semantics.
- Search can contain symptoms or care concerns. Do not send raw query text, selected form data, `care` query values, or free text from the AI search flow.
- There is no analytics SDK in the present frontend. Keep the integration in one typed adapter, not scattered direct `posthog.capture()` calls.

## Data boundary and launch gate

Start with **anonymous, consented, minimum necessary** product analytics. Do not call `identify`, set person properties, or join events to patient/account records. Do not send names, phone numbers, email, birth dates, OTPs, insurance information, appointment reason, symptoms, search text, chat messages, chosen date/time, or query strings. Even a doctor's or department's exact ID can disclose health intent when linked to a browser; start with route family and coarse source only. Revisit finer breakdowns only after a privacy review and a clear product decision that needs them.

Do not load or initialize PostHog until the visitor opts in under an approved analytics notice. Provide a visible way to change that choice. Revoke tracking immediately when consent is withdrawn, and test that a fresh visitor generates no PostHog request before consent. The exact notice, retention policy, cloud region, contract, and jurisdictional obligations require the clinic's privacy owner to approve them before live collection. PostHog says the customer controls what is collected and describes its DPA/BAA options; a vendor setting alone is not a compliance decision.

Configuration for phase 1: disable autocapture, automatic pageviews/pageleave, session replay, heatmaps, error payload collection, surveys, feature flags, and form capture. Use a small allowlist of custom events and properties. Strip SDK-added URL, referrer, and campaign values if they may carry free text or patient data; verify the **actual outgoing payload** in a browser network test. Capture only a coarse channel (`direct`, `organic_search`, `paid`, `referral`, `unknown`) after sanitization. Never put personal information in UTMs.

For test isolation, prefer distinct PostHog projects for test and production if the account is on pay-as-you-go. PostHog's current Free plan includes one project; pay-as-you-go includes more projects but requires a card. A no-card start can use a local event inspector/mock for development, send no test traffic to the production project, and use the single project only after payload QA. Do not initialize in localhost, preview, or demo builds by default; enable only on an explicitly approved HTTPS deployment with a project token and the correct ingestion host. The browser project token can be public; an account/personal API key must never ship to the client.

## Event contract, version 1

All events carry `schema_version: 1`, `page_family`, `effective_design_mode`, `selected_design_mode`, `device_class`, `environment`, and `is_demo: true`. Values are enumerated. No arbitrary objects, DOM text, user-entered strings, or full URLs. A consented anonymous distinct ID is enough for session funnels; no person profile is needed.

| Event | Fire once when | Allowed extra properties | Decision enabled |
| --- | --- | --- | --- |
| `page_viewed` | A settled app route becomes visible, including back/forward | `page_family`, `entry_channel` on the first view | Navigation and entry analysis |
| `navigation_used` | A primary header/footer link moves the visitor | `navigation_area`, `destination_family` | Which navigation helps discovery |
| `doctor_profile_opened` | A doctor card opens a profile | `source_family` only | Whether lists lead to profiles |
| `booking_intent_clicked` | A Book/Request action is pressed | `source_family`, `cta_placement` enum | Which CTA creates intent |
| `booking_flow_started` | The schedule UI is entered with a selected doctor | `source_family`, `entry_step` | Funnel denominator |
| `booking_step_viewed` | Step 1, 2, or 3 first becomes visible in this attempt | `step` | Drop-off location |
| `booking_step_completed` | A step successfully advances | `step` | Distinguish progress from views |
| `booking_validation_failed` | A submit attempt fails validation | `step`, `field_group` enum, no value/error text | Which fields block progress |
| `booking_preview_completed` | Demo confirmation is shown | `entry_source_family` | UI completion only |
| `search_used` | Search results are opened | `search_surface`, `result_count_bucket` if trustworthy | Whether search helps visitors |
| `contact_intent_clicked` | A call/WhatsApp/contact action is pressed | `source_family`, `contact_channel` | Alternate conversion paths |

Use a single `attempt_id` generated only for a booking UI attempt if repeated attempts in one session make funnels ambiguous. Keep it random and short-lived, not based on patient or clinician data. `booking_flow_started` should fire once per attempt. Do not emit a client-side `booking_abandoned` event on tab close; infer incomplete attempts from the funnel and a fixed conversion window.

## Reports to build first

1. **Discovery path:** first `page_viewed` by page family and channel; next page family; percent reaching doctors, doctor detail, or scheduling. Build a custom insight or a Paths SQL expression over the allowlisted `page_family` property; a default custom-event path would collapse every `page_viewed` into the same step, while a default pageview path would use raw URLs.
2. **Booking intent funnel:** consented sessions with a public page view → `booking_intent_clicked` → `booking_flow_started` → step 2 viewed → step 3 viewed → `booking_preview_completed`. Show both overall and step-to-step rates, with a 24-hour window. Report the count of eligible sessions next to every percentage.
3. **CTA placement:** `booking_intent_clicked` by placement and source page, then the share that reaches `booking_flow_started`. Do not rank a CTA only by click count; exposure differs between pages.
4. **Form friction:** failed submissions per attempt and `field_group`, compared with successful step completion. Use groups such as `identity`, `contact_verification`, and `other`; avoid logging detailed error text.
5. **Mode comparison:** compare only pages that have both variants, segmented by device and entry channel. This is observational while users choose their own mode. A causal A/B claim requires random assignment and adequate sample later.
6. **Weekly review:** top three drop-offs, suspected causes, one proposed UI change, owner, and a follow-up measurement date. Keep a change log so shifts can be tied to releases.

Use `booking_preview_completed` as the current primary **UI** success metric. Secondary measures are doctor-profile reach, booking starts per eligible session, and call/contact intent. Add `appointment_confirmed` only as a **server event** after the future scheduling backend commits a reservation; reconcile it against backend records, not against client confirmation screens.

## Cost and signal discipline

PostHog currently lists 1 million product analytics events per month free, then usage pricing on pay-as-you-go. The Free plan stops ingesting events at its limit; pay-as-you-go supports a billing limit but drops events when that limit is reached. That is ample for a deliberately small event contract, but it is not a reason to record every click. Illustrative planning: 10,000 consented visits × 8 events = 80,000 events/month; 50,000 × 8 = 400,000. Real use may differ, especially if visitors browse many pages. Review the PostHog usage screen weekly and set a billing/usage limit before production traffic.

Keep a budget of roughly 5–10 meaningful events per ordinary session; avoid keystroke, scroll, hover, slot-grid impression, and repeated validation events. Deduplicate one-off milestones per attempt. If volume rises, first remove noisy events and inspect implementation loops before sampling core funnel events. Anonymous events are sufficient for these decisions and avoid person-profile overhead. Do not turn on replay simply because its free allowance exists: booking, insurance, login, and search can expose sensitive information. If a specific issue later requires visual diagnosis, design a separate consented, heavily masked recording policy for approved public pages and validate it with synthetic sensitive data before enabling it.

PostHog's standard Web Analytics dashboard may use autocapture/pageleave for some metrics, including bounce rate. With this privacy-first setup, use the custom route and funnel dashboards above; do not present its bounce rate or scroll metrics as complete.

## Delivery sequence and acceptance

| Phase | Work | Exit check |
| --- | --- | --- |
| 0. Decision and setup | Name analytics owner; approve notice/consent, data list, retention, region, and test/prod projects; set usage limit | Written event contract and owner approval |
| 1. SDK adapter | Add `posthog-js` behind a single typed adapter and explicit opt-in gate; keep SDK disabled in preview | No PostHog network calls before consent or in unapproved builds |
| 2. Route and CTA events | Instrument one route observer plus shared navigation and booking entry handlers; include both modes | One page event per real route transition, including popstate; no duplicates on rerender |
| 3. Booking funnel | Instrument both schedule variants with identical step events and preview completion | A scripted journey produces exactly one ordered funnel; no false `appointment_booked` |
| 4. Privacy and payload QA | Use synthetic names, OTPs, symptoms, search text, query parameters, and insurance data; inspect network payloads | None of those values, full URLs, or raw referrers leave the browser |
| 5. Dashboard and review | Create the six reports above; exclude staff/test traffic; document weekly review | Counts reconcile with scripted journeys and owners can explain each denominator |
| Later, with backend | Add server-side confirmed booking/cancellation events and reconcile against persisted records | Measured confirmed bookings match backend source of truth |

Do not use the analytics launch as evidence that the clinic, availability, or booking is live. This plan complements `SEO_LAUNCH_PLAN.md`, whose public-indexing gate remains separate.

## Official references checked for this plan

- [PostHog pricing](https://posthog.com/pricing)
- [Product analytics and funnels](https://posthog.com/docs/product-analytics) and [funnel definitions](https://posthog.com/docs/product-analytics/funnels)
- [Privacy controls and DPA/BAA guidance](https://posthog.com/docs/privacy)
- [Anonymous events and person profiles](https://posthog.com/docs/data/persons)
- [Autocapture scope](https://posthog.com/docs/data/actions)
- [Session replay data and privacy controls](https://posthog.com/docs/session-replay)
- [Web analytics metric dependencies](https://posthog.com/docs/web-analytics/dashboard)

# PRD: Website analytics, self-serve

Status: approved 14 October 2026 (two options: Paperwhale analytics or the clinic's own PostHog) · UI next

## Problem

Clinics can't see how their website is doing: how many people visit, where they come from, and how many go on to book.

What exists today doesn't help them:
- **Website:** the Sri Lakshmi site (`brave-mendel`) sends events to PostHog. Paperwhale configures the project key at build time.
- **API:** the PostHog reader (`websiteActivity` in `apps/api/src/modules/comms/voice-growth.ts`) is bound through env vars (`POSTHOG_TENANT_ID`, `POSTHOG_FACILITY_ID`) to **one** clinic. Adding a clinic means a deploy.
- **The two don't match.** The site sends `page_viewed` and `booking_flow_started` with `is_demo`/`environment`. The reader counts `$pageview`, `booking_started` and `booking_completed`, filtered on `hms_traffic`, `hms_surface` and `hms_analytics_consent`. Even once configured, it would return nothing.
- **Dashboard:** Growth analytics shows a "Website activity · PostHog" card that says *Not connected* for every clinic.
- **Clinic-owned websites:** sites on WordPress, Wix or custom builds have no way in.

## Goal

Every clinic gets website numbers without talking to us:
- Websites and booking pages Paperwhale runs have analytics **on from day one**, with no setup.
- A clinic with its own website pastes **one line**, presses **Check**, and is done.
- Numbers are in plain words: visitors, where they came from, top pages, and how many went on to book.

## Decision: two options, the clinic picks

| Option | What it is | Who pays |
| --- | --- | --- |
| **Paperwhale analytics** (default, recommended) | Paperwhale counts visits itself. Every visit already passes through Paperwhale's `/ingest` endpoint, which adds to daily totals per clinic in our Postgres. Nothing to sign up for, and the data stays with Paperwhale. | Included. Close to zero extra cost for us, even at scale. |
| **PostHog** | The clinic connects **its own** PostHog project. `/ingest` forwards their visits there, and Paperwhale reads daily totals back with their read-only key. For clinics that already use PostHog or want to dig deeper there. | The clinic pays PostHog: 1M events a month free, then from $0.00005 per event. |

Nothing else is offered: no Umami, Plausible or GA4. Either way the clinic sees the **same screens** in Paperwhale, and switching never requires re-pasting the snippet.

Why not a Paperwhale-owned PostHog for everyone: at about 25,000 events per clinic a month, it costs about $65 a month at 100 clinics, $410 at 500 and $1,500 at 2,000. For fixed totals, our own counters do the same job for almost nothing.

## How "automatic" works

1. **Paperwhale loader, never a raw provider snippet.** Every site loads `https://<exora>/a.js` with `data-site="<site key>"`. The loader:
   - stores no cookies and no visitor IDs;
   - never captures form fields and never records sessions;
   - strips query strings from URLs.

   Because we own the loader, clinics never re-paste anything when they switch options or we change settings.
2. **Every visit goes through Paperwhale** (`/ingest`). The API:
   - looks up the site key and checks the page's host is one of that clinic's registered domains;
   - stamps `tenant_id`, `facility_id` and `traffic` (production or demo) **server-side**;
   - then **either** adds to Paperwhale's daily totals **or** forwards to the clinic's PostHog project, depending on the option chosen.

   A copied snippet can't pollute another clinic's numbers, and ad-blockers block it less often.
3. **Paperwhale-run surfaces are pre-wired.** The clinic website app and the public booking page (`book.html`) include the loader with the clinic's site key. A site key is created automatically for every clinic.
4. **A clinic's own website:** Website analytics → *Add a website* → enter the URL. Paperwhale shows the one-line snippet with steps for WordPress, Wix, Google Tag Manager and "send to my developer". *Check installation* looks for a visit from that domain and confirms or says what's wrong.
5. **Connecting PostHog** (only for that option): choose the region (US or EU), then paste the project ID, the project API key (`phc_…`) and a personal API key with read-only query access (`phx_…`).
   - Paperwhale tests both keys, then keeps them on the server.
   - The browser never gets them back; only the last 4 characters are shown.
6. **Reading the numbers.**
   - **Paperwhale analytics:** the totals are already in our database.
   - **PostHog:** a worker job pulls daily totals from the clinic's project. Their query API is rate-limited, so we never query it live from the dashboard.

   Either way the dashboard reads our database.

## Scope

**In:**
- Choice of option: Paperwhale analytics or PostHog. Switching keeps past numbers and sends new visits to the new option.
- Site key per clinic, created automatically. Registered domains per clinic.
- The loader (`a.js`) and the `/ingest` endpoint, with server-side clinic stamping, a domain check, and routing to Paperwhale's counters or PostHog.
- PostHog connection: region, project ID, keys (stored server-side only), a connection test, and disconnect.
- A single event vocabulary shared by the website, the booking page and the API reader:
  - `page_viewed` with a page type (home, doctor, department, booking, other);
  - `booking_started`;
  - `booking_completed`, counted from Paperwhale's own appointments, not the browser;
  - `call_clicked`, `whatsapp_clicked`, `directions_clicked`.
- Fixing the website/reader mismatch above so they use that vocabulary.
- Per-clinic daily totals in Postgres: filled directly for Paperwhale analytics, and by a daily pull for PostHog.
- Bot filtering, and counting unique visitors without cookies (a daily salted hash, thrown away each day).
- **Website analytics** page, replacing the old Growth analytics screen:
  - not set up → "Add your website";
  - waiting for the first visit;
  - live.
- Live view:
  - visitors and page views with the change from last month;
  - where visitors came from (Google, Google Maps, WhatsApp, Instagram/Facebook, direct, other), from the referrer and UTM;
  - top pages;
  - device split;
  - a booking funnel: visited → started booking → booked;
  - clicks on call, WhatsApp and directions.
- UTM tagging on links Paperwhale creates: the Google Business Book button, WhatsApp messages and posts, so they show by name under "where they came from".
- Demo traffic kept separate and never mixed into real numbers.

**Out:**
- Session replay and heatmaps. Too risky with health pages.
- Per-visitor journeys or tying visits to patients. No identify, no person profiles.
- Importing GA4 or Search Console data. A later option; Search Console could reuse the Google sign-in.
- A/B tests and ads tracking.
- Real-time "people on the site now".

## Privacy rules

- **Nothing that identifies a patient** is stored or forwarded, whichever option is chosen. That means no names, phones, booking references, form values or clinical text. URLs are sent without query strings.
- **Cookieless and no stored IDs**, so no cookie banner is required for analytics. The website's existing consent banner can stay for anything else.
- **Fixed aggregate queries only, server-side.** The browser never sends query text and never holds a PostHog key after it is saved.

## User flow

```
Website analytics
├─ not set up → "See how people find your clinic online" → pick Paperwhale analytics (recommended) or PostHog
│     · PostHog → region, project ID, keys → Test connection → connected
│     → websites: the Paperwhale booking page is already included; "Add a website" → URL → snippet + steps → Check installation
│         · check fails → shows the likely cause (snippet not found, different domain, no visits yet)
└─ live → Overview (visitors · where they came from · booking funnel · top pages · clicks · devices)
          · Websites (status of each site, add or remove)
          · Settings (option in use, switch, PostHog connection, disconnect)
```

## Acceptance criteria

1. A new clinic needs no action for its Paperwhale booking page to show visits within a day.
2. A clinic with its own website can go from *Add your website* to *Live* without contacting Paperwhale. The check confirms a real pageview from that domain.
3. Events from a domain not registered to the clinic are dropped and never counted.
4. No visit stored by Paperwhale or forwarded to PostHog contains a name, phone number, booking reference, query string or form value. A test asserts this on the ingest path.
5. The dashboard never calls PostHog from the browser. PostHog keys are never returned to the browser after saving.
6. A clinic can switch between the two options without changing the snippet on its website. Numbers from before the switch stay visible.
7. Bookings in the funnel match Paperwhale's appointment count for web bookings in the same period.
8. Demo traffic never shows in production numbers.
9. No technical terms on screen (no "events", "distinct IDs" or "HogQL"), except the key names PostHog itself shows.
10. Staff without `growth.manage` see the numbers but can't change anything.

## Open questions

1. Which domain serves `a.js` and `/ingest` in production: the staff domain or a separate one?
2. Should clinics with their own website be nudged to use Paperwhale's booking page for the Book button? That makes their booking funnel complete.

## Sources

- PostHog cookieless tracking: https://posthog.com/docs/privacy/cookieless-tracking
- PostHog API rate limits: https://posthog.com/docs/api
- PostHog pricing (third-party summary; confirm on posthog.com/pricing): https://costbench.com/software/product-analytics/posthog/free-plan/

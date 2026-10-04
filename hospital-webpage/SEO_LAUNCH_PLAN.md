# Search and AI discovery launch plan for the clinic UI

## Audit on 1 October 2026

| Question | Current state | Next action |
| --- | --- | --- |
| Sitemap | `scripts/generate-seo.mjs` knows the department, doctor, and location IDs; the normal build publishes **no sitemap**. | Generate one only after each canonical URL has verified, prerendered HTML. Submit the live URL in Search Console. |
| `robots.txt` | `public/robots.txt` allows crawling. This lets crawlers read the preview's `noindex` directive. It also allows `OAI-SearchBot`; there is no separate ChatGPT rule to add. | Check the deployed file, CDN/WAF access, and bot logs. Add the sitemap line only when the launch gate passes. |
| Rate limits | Static pages have no application rate limiter. The frontend cannot enforce one. | Put limits on live backend actions and public availability at the API gateway; cache public reads. Do not blanket-throttle HTML, CSS, or JS. |
| Backlinks | No backlink campaign or referring-domain inventory is established in this repository. | Earn links from verified real-world relationships and useful original resources; measure referral traffic. |
| Keywords | Route titles/descriptions exist, but there is no validated keyword map or Search Console demand data. | Research intent and actual queries for a real clinic, then assign one primary intent to each page. |
| Google AI Overviews / ChatGPT | Preview pages are `noindex`; there is no first-response page content. Inclusion is therefore unverified and should not be promised. | Publish verified, useful, crawlable HTML and allow Googlebot and OAI-SearchBot through the CDN. Measure citations after launch. |

The build now fails closed if the SEO approval flag is set before every public route has its own HTML with visible `<main>`/`<h1>`, an `index,follow` directive, and a matching canonical. The current Vite build does **not** meet this gate. Merely setting environment variables cannot publish a sitemap or switch the generic SPA shell to indexable.

## Current architecture and boundary

This is a React/Vite single-page prototype. The URL uses `?page=...` and optional IDs; most information is bundled local data. The current doctors, credentials, portraits, prices, reviews, branch addresses, insurer relationships, legal documents, testimonials, clinical outcomes, and booking slots are **demo data**. There is no scheduling backend. Search engines and AI systems must not be offered these as verified facts.

The preview defaults to `noindex,nofollow`. `robots.txt` allows the crawler to read that directive. A sitemap is generated only for an explicitly approved production build with a real HTTPS origin. Google may render this JavaScript app, but the launch should add server rendering or static prerendering for public content so the first HTML response includes the page's actual title, content, links, canonical, and structured data.

## Implemented in this pass

- Six original, practical editorial drafts replaced fabricated physician posts. Their list and article pages label them as unreviewed previews; the homepage teaser cards use the same content. There are no invented author names, publication dates, statistics, or clinical outcomes in these new pieces.
- Route-aware title, description, Open Graph, robots, and canonical handling was added. Search, scheduling, login, and article drafts remain `noindex` even after the production gate opens.
- The original footer now links to the article list, and article titles and related articles are real crawlable anchors.
- The build can emit `sitemap.xml` and a sitemap-linked `robots.txt` from department, doctor, and branch IDs, but only after the explicit launch gate below and route-specific prerendering. The sitemap uses clean canonical paths such as `/departments/cardiology/`.
- `/availability.json` truthfully reports that there is no live slot feed. It does not turn placeholder slots into a count.

## Before the public indexing switch

1. Verify the real business name, address, phone, opening hours, and each physical branch. Replace demo data and remove locations that do not exist.
2. Verify every doctor and qualification, all fees, insurance participation, reviews, accreditations, service claims, legal text, and images. Remove any unsupported statement. Ensure no user-facing flow claims a reservation unless the backend confirms it.
3. Assign an accountable author and clinical reviewer to each article where appropriate. Fact-check, add a real publication date and review date, then move approved articles out of draft status. Keep a change log and a review cadence.
4. Confirm the public HTTPS domain and hosting behavior. Prerender each verified public route into its own `dist/<route>/index.html` (and the homepage into `dist/index.html`) with matching visible content, title, canonical URL, and robots directive. Configure permanent redirects from old query URLs, update internal anchors to the canonical clean paths, and return real HTTP 404s for unknown routes. Add a server/CDN `X-Robots-Tag: noindex` for admin and private actions. Split route bundles and compress images as needed.
5. Only after steps 1–4, run `VITE_SEO_APPROVED=verified-content-and-clinic VITE_SITE_URL=https://your-real-domain.com npm run build`. The generator rejects example/local origins, missing prerendered pages, and generic SPA shells. Do not use the example domain literally.
6. Verify the real domain in Google Search Console, submit the sitemap, inspect representative department, doctor, location, and article URLs, and check indexed HTML plus Core Web Vitals. Confirm Googlebot and OAI-SearchBot receive 200 HTML without a JavaScript challenge; use their published IP lists rather than trusting user-agent strings alone. Monitor search queries, citations, and booking conversions separately.

### Keyword and page map to validate with a real clinic

| Page | Search intent to research | Content needed |
| --- | --- | --- |
| Department | `[verified specialty] in [actual service area]`, symptoms and services | Care scope, when to seek care, tests, fees if verified, clinicians, location and booking link. |
| Doctor | `[actual clinician name]`, specialty and area | Verified credentials, registration, real portrait, practice location, accepted visit types and next step. |
| Location | `[actual clinic name] [area]`, access and hours | Address, directions, hours, accessibility, parking/transit, phone and clinicians. |
| Practical guide | A patient question tied to a genuine service | Specific answer, reputable sources, accountable author, clinical reviewer, review date and relevant care link. |

Use Search Console queries, actual patient questions, and a manually reviewed competitor SERP to prioritize this map. No search-volume or ranking claims are inferred from the placeholder clinic data. Keep one useful canonical page per distinct intent; avoid city/specialty permutations with near-identical copy.

### API protection without hiding public pages

- Serve public HTML/assets through CDN caching. Exempt verified search crawlers from generic browser challenges, and monitor their response codes and crawl volume. `robots.txt` is a crawl instruction, not a rate limiter; Google does not support `crawl-delay`.
- Rate-limit account/OTP, booking, admin and contact mutations by relevant identity plus IP with abuse detection. Return `429` and `Retry-After` when throttled; keep emergency and human contact paths accessible. Set numeric limits after observing legitimate traffic and load-testing the backend.
- For a future public availability endpoint, cap date-range and page-size inputs, cache short-lived responses, use an endpoint-specific quota, and never expose patient data. A crawler-visible count must agree with the site's visible count and expire safely.

### How to earn citations

Google says AI Overviews and AI Mode use the same Search foundations: an indexed page eligible for a snippet, useful original content, and a crawlable technical structure. There is no special AI schema or `llms.txt` requirement. ChatGPT search eligibility depends on `OAI-SearchBot` access, including CDN/WAF access to OpenAI's published IP ranges; placement is not guaranteed. A page that only returns an empty SPA shell is a weak candidate for either system. For health topics, put verified authorship, review, scope and sources on the visible page. Publish evidence and clear answers that a search system can quote accurately, rather than writing for a supposed model prompt.

Track Search Console's generative AI performance when available, organic landing pages, `chatgpt.com` referrals, server-side bot requests, and a small monthly sample of target questions checked manually. Treat those as observations, not guaranteed citation counts.

## Appointment availability for agents and search

The future scheduling backend should expose a **public, read-only, no-patient-data** summary, for example `GET /api/public/availability?locationId=...&departmentId=...&from=YYYY-MM-DD&to=YYYY-MM-DD`. Return a count only after the scheduling system has computed genuinely bookable slots, excluding holds and already reserved times. Suggested response:

```json
{
  "status": "live",
  "availableAppointments": 12,
  "from": "2026-10-01",
  "to": "2026-10-07",
  "timezone": "Asia/Kolkata",
  "asOf": "2026-09-29T10:00:00+05:30",
  "expiresAt": "2026-09-29T10:05:00+05:30",
  "bookingUrl": "https://your-real-domain.example/?page=doctors"
}
```

For agents that need actual choices, add a paginated `GET /api/public/availability/slots` with clinician ID, location ID, visit type, ISO start/end, timezone, booking URL, and the same `asOf`/`expiresAt` fields. It must omit patient names, existing bookings, and internal capacity rules. The booking action must re-check the slot and return a confirmed reservation ID; a feed snapshot is never a hold.

Validate IDs and date range, rate-limit requests, cache briefly, and return `status: unavailable` with a null count during outages or stale feeds. Show the same count and freshness timestamp on the site. Only add appointment-related structured data if a supported consumer accepts it and the markup matches live visible data. A sitemap or an AI text file cannot make a nonexistent booking inventory discoverable.

## Discovery and backlinks

- Publish one useful page per verified service and location, with local details that actually help patients: directions, accessibility, visit types, preparation, price range where verified, and clinician links.
- Keep internal links descriptive: homepage → departments → clinician → booking; location → clinicians; articles → relevant care and cost information.
- For a **real eligible clinic**, claim and verify its Google Business Profile, keep name/address/phone consistent, and ask actual patients for reviews without incentives or scripts.
- Earn external links through legitimate relationships: hospital or insurer partner directories where an affiliation is real, professional biographies, local health organizations, and original resources worth citing. Track referring domains and actual referral traffic. Do not buy links, create fake clinics, or post reciprocal directory spam.
- Measure qualified organic visits, non-brand queries, calls, booking starts, **backend-confirmed** appointments, and cancellations. A ranking screenshot alone is not proof of useful results.

## Official guidance

- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [AI features in Search](https://developers.google.com/search/docs/appearance/ai-features)
- [Link spam policy](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google Business Profile eligibility](https://support.google.com/business/answer/3038177)
- [Google generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [OpenAI crawler overview](https://developers.openai.com/api/docs/bots)
- [ChatGPT search eligibility](https://help.openai.com/en/articles/9237897-chatgpt-search)
- [Google local ranking guidance](https://support.google.com/business/answer/7091)
- [Google robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)

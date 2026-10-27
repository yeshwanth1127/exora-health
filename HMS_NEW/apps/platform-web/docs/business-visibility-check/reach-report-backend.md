> Current operational implementation: [operational-report.md](./operational-report.md), 24 October 2026. The notes below describe the original implementation and old quota snapshot.

# Reach readiness backend

Implemented in `business_lookup.py`, `reach_report.py` and `website_fetch.py`. The local Python service now handles `GET /business-lookup?mode=report&id=<place-id>&session=<autocomplete-session>`. The existing search selection opens `/business-report` in a separate window; that page requests the combined report once.

## What is scored

Version `reach-readiness-1.0` has 17 checks and 100 weighted points:

- Google public profile, 40: name (4), category (4), address (8), phone (8), hours (8), operational status (8).
- Website basics, 20: HTTPS (5), successful HTML response (5), device-width viewport (5), non-script page text (5).
- Search signals, 20: title (5), meta description (5), H1 (5), no explicit indexing block in checked robots/meta/header signals (5).
- Contact paths, 20: call/WhatsApp link (8), recognisable booking/enquiry link (6), contact/email route (6).

Every check returns pass/review/unknown, its weight, observed evidence, source URL and a suggested next step. The numeric score is earned assessed weight / total assessed weight × 100. Unknown checks are excluded, and both weighted coverage and counts are returned. If only Google checks can be assessed, the main gauge is labelled Google profile score. Other incomplete reports are explicitly partial. No linked website produces unassessed website categories rather than fabricated zeros.

Omitted Google fields lower the score for *observed public-profile completeness*, but the evidence explicitly says a field can be missing, hidden or unsupported and must be verified by the owner. Ratings and review count are displayed as attributed facts; they are not scored. The rubric is a product heuristic, not a validated predictor of reach, rank, traffic, revenue, accessibility compliance or completed bookings. JavaScript execution, actual indexing and linked booking/contact flows are outside this version.

## Website requests and safety

The selected Google website or a website link supplied from the report can be audited. A supplied link never clears the missing Google website issue. The fetcher uses a named audit user agent, reads robots.txt only as a Googlebot visibility signal, and inspects the homepage HTML. It follows at most three redirects, revalidating every target. Private, loopback, metadata, multicast, reserved and mixed public/private DNS targets are rejected. Only default HTTP/HTTPS ports are accepted; credentials, control characters, backslashes and HTTPS downgrades are rejected. DNS answers are pinned to the actual connection while HTTPS retains original-host certificate verification. No ambient proxies, cookies, credentials, JavaScript, forms or embedded assets are used. Responses are bounded to 1 MiB, robots to 64 KiB, with connection/read timeouts and a shared network deadline. DNS resolution itself depends on the operating system resolver timeout. Two reports may run concurrently; excess work returns a busy error.

Website denial, bot protection, timeout, unsupported content or unsafe redirects produce unassessed checks. An observed HTTP error is reported as an availability issue, not as proof that every site feature fails. Robots rules do not prevent the public-page audit. Googlebot-specific restrictions remain an indexing issue; robots retrieval failure affects only that signal.

## Data and cost boundaries

The API key remains server-only. Google profile data and fetched HTML are not written to a database, file or application cache. API responses use `Cache-Control: no-store`; submitted query strings are omitted from request logs. No AI, PageSpeed or additional paid API is called. Each live report consumes one Places details request; project quotas and API-key restrictions remain unchanged. Reopening or refreshing a live report requests fresh data and may hit the existing one-report-per-day quota.

## Arc and review preview

`/demo/reach-report` is explicitly fictional and uses generated fixtures passed through the real scoring functions. `scripts/generate-reach-example.py` regenerates the complete and website-unavailable examples without any network calls. The demo exists to inspect the Gauge, four category panels, Donut selection/filtering and partial states without spending Google quota. It must not be presented as an audit of a real clinic.

## Public launch boundary

This backend is integrated into the loopback Python preview service. Static Hostinger output alone cannot execute Python; a hosted backend and same-origin routing are still required before production deployment. A public service also needs deployment-specific authentication/abuse controls and monitoring; the loopback preview is not a claim of production acceptance.

Google's current [Maps terms, 3.2.3(c)](https://cloud.google.com/maps-platform/terms) restrict creating content based on Maps content. A derived public-profile score needs permission/terms review before public launch. This implementation is a technical prototype and does not establish that Google has approved the scoring use. [Places attribution/caching requirements](https://developers.google.com/maps/documentation/places/web-service/policies) also apply; Google Maps facts and third-party attributions remain identified in the report.

# Operational report and Bengaluru observations

Implemented 24 October 2026. This is a public-data audit, not a Google Business
Profile owner connection, clinical quality assessment, traffic measurement or
Search Console indexing verification.

## Report

The existing homepage Places combobox opens `/business-report` in a new tab.
The same-origin `/business-lookup` proxy calls the Python backend. One Place
Details request supplies the selected public profile. Website and area checks
then run concurrently. No score is created if the profile lookup fails.

Rubric 1.1 has 18 weighted checks, totalling 100 points: Google public fields 40,
website basics 20, search signals 20, contact paths 20. The Google category now
includes an 8-point linked-website check. A missing website is a major finding;
the inaccessible website checks stay unassessed. Severity precedes weight when
ordering issues. The page shows at most four issues; the existing Arc sheet
contains the full checklist, source filters, evidence and fixes.

Website checks retrieve bounded homepage HTML, robots.txt as a Googlebot visibility signal, and at most one
booking/enquiry and one contact destination. Robots rules and robots retrieval failures do not block public HTML or destination audits. Redirects retain public-address and TLS validation. Valid gzip/deflate responses are decoded
under the same output size limit. SSL failures, broken destinations, noindex,
Googlebot restrictions and invalid call links are flagged. Requests cannot use
private IPs, credentials, nonstandard ports, ambient cookies or proxy settings.
A blocked bot, time limit or JavaScript-only signal is unavailable rather than
a fabricated failed check. Nothing submits forms, sends email, books a visit or
claims an actual Google index status.

## Bengaluru ranking

`rank_cities.json` defines independent representative search origins and initial
samples. Bengaluru has 120 neighbourhood groups from the existing OSM design,
with nine initial observations nearest to the selected business coordinates. If Google omits coordinates, nine configured city origins are used and labelled as a fallback. The optional geometry is registered in the live
map component. Add another city's configuration and optional geometry to expand;
the provider/query/budget/scoring code does not require another city-specific
implementation. Healthcare query selection uses the returned Google primary
type/types, never a randomly inferred prominence score.

Each observation is one Google Places Text Search request with RELEVANCE order,
a 5 km circle bias, English, India and at most 20 results. Only Pro fields are
allowed at the adapter boundary; adding rating, hours, reviews or websites to
this mask is rejected so the 5,000-request global free cap is not silently
replaced with an Enterprise cap. The query omits an explicit city name so it
does not override the selected location bias. Bias is not a geographic boundary.

Each neighbourhood's reported position is the target place ID's position in that
response. Results above equals position minus one only when the target appears.
Absence means not returned among the returned results, not a fabricated #21.
Unavailable and not-yet-checked points are separate states and have no rank.
The cross-location comparison averages `(21-position)/20`, assigns zero for a
checked absence and excludes unavailable/unchecked points. Average position is
reported only where the business appeared. This is a Places discovery sample,
not the consumer Google Maps SERP or a city-wide rank, revenue or care quality.
Google result order within each observation is preserved.

The live map uses a Google Static Maps base returned through the server, with
independent OSM neighbourhood overlays. The key never reaches the browser.
The static Google overview uses a square frame with muted roads and no POI labels; it is not an interactive Maps SDK. Google attribution in the base image must remain visible. The current hex terrain and choropleth explorer are consolidated into this repository. Both share live observation data; the hex chart uses a categorical layout. The choropleth keeps a Google base image and its attribution through zoom. Design routes use illustrative data explicitly. The choropleth's ranked area list provides the keyboard alternative. A user can request one neighbourhood
or the next batch of up to nine nearest unchecked areas. Expensive scans have one concurrency slot;
profile reports have two. A quota error in ranking does not discard the audit.

## Request protection

Cloud project `capture-512419`: autocomplete 250/day, details 25/day, Text Search
125/day; Static Maps signed and unsigned request quotas each 25/day. The server
key permits only Places API (New) and Maps Static API. Other prior Places method
zero quotas remain unchanged.

`maps_budget.py` enforces persistent, atomic counters across processes/restarts:

| Kind | Daily | Calendar-month maximum | Global free allowance used for guard |
|---|---:|---:|---:|
| Autocomplete | 250 | 7,750 | 10,000 |
| Details, including non-Essentials session termination | 25 | 775 | 1,000 |
| Text Search Pro | 125 | 3,875 | 5,000 |
| Static Maps | 25 | 775 | 10,000 |

Counters include attempts and are never refunded on failure. The application
fails closed if the budget database is unavailable. Cloud quotas are the outer
project guard; the counters protect only calls through this application. Do not
add other projects/keys/services or higher-cost fields to this billing account
without reviewing shared allowances. Dollar budget alerts are not spending caps.

## Cache

A shared SQLite cache reuses successful independent website findings for seven
days, keyed by URL, rubric and source. Fresh entries show their original checked
time. Expired entries refresh on the next request, with a cross-worker lease to
avoid duplicate refreshes. No background Google refresh job is enabled. Partial
or blocked website audits are not persisted as successful weekly snapshots.

Google Places responses, result order, profile records and map image bytes are
not persisted. The cache source allowlist rejects Google Places and unapproved
providers. Place IDs have a separate storage exception, but this is not used to
claim permission to retain ordered Google result snapshots. A reusable weekly
city-ranking snapshot needs a source with suitable retention rights and a
separate explicit integration. This is not currently connected.

Persist `.state/` on one backend host (or set `CAPTURE_USAGE_DB` and
`CAPTURE_AUDIT_CACHE_DB` to persistent volume paths). Do not put that directory,
secrets or backend source in the public export. Multiple hosts need a shared
transactional counter/cache service; separate local files are not a global
application budget. Google Cloud project quotas still apply across keys.

Sources:
- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/session-pricing
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/billing-and-pricing/pricing
- https://developers.google.com/maps/billing-and-pricing/manage-costs

## Report clarity correction (27 October 2026)

Partial reports now show checklist coverage beside the main gauge. A profile-only
80/100 can cover just 40% of the full rubric; it is not an 80% full audit.
No linked website means the eleven website checks cannot run. Initial area
selection is based on the chosen clinic location instead of fixed distant
Bengaluru locations. Each additional user action scans at most nine locations,
not all remaining 111 in one click. Provider order remains an observation and
may change between requests; no artificial stable ranking or Google cache is added.

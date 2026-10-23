# Public profile data and analytics boundary — 23 October 2026

## Current implementation

The report uses one Place Details (New) request after selection. It requests identity, address, primary category, Google Maps link, website, national phone, regular opening hours, average rating, rating count, business status and provider attributions. This revision adds `location`, `currentOpeningHours` and `accessibilityOptions` to that same request. Those additions fall at or below the Enterprise tier already triggered by phone/hours/rating. No additional request, photo fetch, wildcard mask, higher-tier review field, API enablement or quota increase was added. The new fields are wired and covered by mocked backend tests; fresh live Google retrieval was not run because of the existing cost quotas.

The clinic widget displays only returned values. Optional unknown values are omitted, including `openNow`; an explicit false remains false. Current open/closed status is labeled as the state at check time. Missing accessibility data is not interpreted as accessible/inaccessible. The widget links to the actual Google listing; it does not draw a fictional map or request another Maps product. Existing rating/count are displayed as listing facts, not as a trend or full rating histogram.

## What unavailable means

There are six profile checks and eleven website checks. For the blocked-site preview, the six profile checks were assessed and all eleven website checks were unknown. The four website basics are HTTPS, homepage availability, mobile viewport and HTML text. The four search checks are title, meta description, H1 and explicit indexing blocks. The three contact checks are call/WhatsApp link, booking/enquiry link and contact/email route. Unknown checks contribute neither earned nor possible points; their score is a dash, not zero. The 40% coverage shown there is the rubric's Google-profile weight, not a measure of data quality or customer reach.

Other reasons for unknown checks include no linked website, network/time limits, blocked robots rules, a site refusing inspection, JavaScript-only content whose HTML cannot settle a check, or missing Google business status. Google fields such as missing hours are presently a prompt to review the returned profile and can lower the checklist score; they do not prove the owner never supplied hours.

## Useful data beyond this request

| Data | Public Places availability | Proposed use / constraint |
| --- | --- | --- |
| Coordinates, current hours, accessibility | Available when returned; now wired | Location actions and practical visitor information |
| Rating and review count | Already wired | A current reputation snapshot, not growth or distribution |
| Photos | References available, separate media retrieval | Clinic identity once photo cost/attribution is deliberately integrated |
| Reviews and review summary | Enterprise + Atmosphere tier | Optional later; max five relevant reviews is not the full review population |
| Search/Maps impressions, call clicks, direction requests, website clicks | Business Profile Performance, not public Places | Owner OAuth connection and access to the location; then real date-range trends |
| Search keyword impressions | Business Profile Performance | Owner-authorized monthly search terms, subject to API availability/thresholds |
| Actual website sessions/conversions | Not in public Places | Owner analytics connection or first-party instrumentation |
| Google rank, missed calls, lost revenue | Not established by these public fields | Do not infer or fabricate them |

A sensible next analytics phase is an owner-connected performance section: Search/Maps impressions over time, call and website clicks, and directions, with dates and clear missing-data states. Avoid charts that imply actual customer behavior from a public checklist.

## Official references verified

- Field availability and SKU tiers: https://developers.google.com/maps/documentation/places/web-service/data-fields
- Place response and five-review limit: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places
- Business Profile OAuth: https://developers.google.com/my-business/content/implement-oauth
- Performance metrics: https://developers.google.com/my-business/reference/performance/rpc/google.mybusiness.performance.v1
- Performance authorization scope: https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries
- Places attribution, caching and terms: https://developers.google.com/maps/documentation/places/web-service/policies

Field availability does not by itself authorize every derived analytics use. The previously documented Google Maps terms review for publishing a score based on Maps content remains a production prerequisite; this local UI work is not Google policy approval.

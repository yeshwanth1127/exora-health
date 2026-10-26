# Search launch: first seven days

## Outcome and limits

The first-week target is a technically accessible, correctly described website with verified search properties, submitted URLs, useful product pages and the first relevant mentions. Indexing, organic rankings and AI citations are three separate outcomes. Neither a sitemap nor a crawler allow rule proves any of them. Broad top rankings are not a credible one-week commitment. Google says crawling can take days to weeks and requests do not guarantee inclusion: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl

## Shipped in the website

- Production-domain indexing configuration, with local/invalid-origin builds staying noindex.
- Canonical URLs, distinct titles/descriptions, Open Graph/Twitter cards, verification-token slots and English-language metadata.
- Organization/WebSite, Article, SoftwareApplication and breadcrumb structured data reflecting visible content. No invented reviews, awards, certifications, customers, offices or prices.
- Public sitemap. Setup, quote and fictional dashboard pages remain noindex. Robots allows public assets and search crawlers while excluding staff/admin/control routes.
- Four product-intent pages, visible FAQ answers, a useful front-desk checklist and editable download, plus internal links from every shared footer.
- A readable llms.txt. It is a convenience for readers/tools, not a required Google ranking file or an AI-citation guarantee.
- Optional PostHog and anonymous funnel instrumentation; disabled until configured and opted in.
- IndexNow preparation/submission helper. Nothing has been submitted to search engines by this code change.

## Day 1 — publish and verify

1. Review the company/product name and use one consistent identity in the website and any external profiles. Canonical production origin currently configured in Docker: `https://health.exora.solutions`. If moving to a final domain, change build configuration and plan redirects before publishing both copies.
2. Deploy the production build with `NEXT_PUBLIC_SITE_ORIGIN=https://health.exora.solutions` and `NEXT_PUBLIC_SEARCH_INDEXING=true`. Runtime-only env changes do not change a static build.
3. Confirm the public homepage, four solution pages and blog work without login or JavaScript. Check real HTTP 200s, canonical tags, robots and sitemap. Unknown URLs must return 404, not the homepage. Ensure no reverse-proxy `X-Robots-Tag: noindex`, firewall challenge, geo-block or crawler block overrides the page. Keep WAF/security protections; allow legitimate crawlers using the providers’ documented verification rather than turning protections off.
4. Add/verify the site in Google Search Console and Bing Webmaster Tools. Prefer a DNS domain property if you control DNS; HTML verification fields are also wired into build config. Submit `/sitemap.xml` once. Inspect homepage and the priority solution URLs, then request indexing where available.
5. Check the rendered output with Google Rich Results Test and Search Console URL Inspection. Structured data eligibility does not imply a rich result will be shown.

Google essentials: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
Bing tools: https://learn.microsoft.com/en-us/bingwebmaster/

## Day 2 — measure a qualified funnel

Configure the PostHog project token and its US/EU ingestion region. Verify events only after opt-in, then build:

- Pages: landing page → pricing/product → quote → onboarding.
- Setup funnel: account → workspace → facility → launch → review → request accepted → server status ready.
- Operational failure trend: workspace_request_failed / workspace_request_submitted. This is a frontend request metric, not delivered provider activation or revenue.
- Discovery: consented referrals grouped as Google, Bing, ChatGPT, Perplexity, Claude, other/direct. These count identifiable referral categories; no-referrer traffic cannot be assumed to be AI search.

Exclude internal testing in PostHog reports. Search Console measures impressions/clicks, PostHog measures consented onsite behaviour, and the control API measures actual provisioning. Consent/ad blockers mean those counts will differ. Do not call a click a lead or a queued request a successful deployment.

## Days 2–3 — focus on a small set of buyer questions

These keyword targets are hypotheses, not search-volume research or ranking forecasts:

| Page | Primary intent | Supporting questions to answer with evidence |
| --- | --- | --- |
| `/solutions/ai-receptionist` | AI receptionist for clinics; hospital call handling | What routine calls can it handle? How do staff take over? What must be configured? |
| `/solutions/whatsapp-outreach` | WhatsApp patient reminders and clinic outreach | Who monitors replies? What counts as a booking? What permissions/templates are required? |
| `/solutions/google-business-management` | Google Business Profile management for clinics | Who owns the listing? What can be updated? How are enquiries handled? |
| `/solutions/clinic-analytics` | clinic booking and enquiry analytics | What does each metric mean? Which sources/history are actually available? |
| `/teams`, `/enterprise` | clinic software vs hospital/group workflow | What differs for a small front desk and a multi-facility team? |
| checklist + blog | practical front-desk operating advice | What can a clinic use today, independent of buying the product? |

Validate wording from actual provider interviews and Search Console queries. Add country/city/language-specific pages only where there is genuinely distinct information or service support; do not create near-duplicate location doorway pages.

## Days 3–5 — earn relevant backlinks

A backlink exists when another independently managed site publishes a link to us. Adding outbound links on our site cannot create those inbound links.

Start with a small, real set:

1. Existing company/product profiles: update the company website, legitimate LinkedIn company profile and founder bios to the canonical product URL if the owners agree. Keep name/description consistent.
2. Actual integration/technology partners: request a partner directory or factual integration story only where eligibility, authorisation and current support are established. Do not claim official Google/Meta/PostHog partnership because their products are used.
3. Clinic pilot participants: with written approval, publish a specific case study describing the workflow, dates, actual measured baseline/results and limitations. Ask whether their own team wants to link to it. Never add patient data or an unapproved clinic endorsement.
4. Professional communities and healthcare operations newsletters: offer the front-desk checklist as a useful resource. The editor decides whether and how to link; do not send mass spam or pay for ranking credit.
5. Accurate relevant software directories: create one complete profile where the product category and eligibility fit. No invented reviews, bulk directory submissions or duplicate listings. Sponsored listings need appropriate disclosure/qualification.

Track in `backlink-opportunities.csv`: owner, audience fit, source URL, proposed resource, permission, outreach date and actual published URL. No outreach or external profile write has been performed here.

Do not buy dofollow links, exchange reciprocal links at scale, force links into patient website footers, or auto-generate low-value articles for links. Google explicitly treats ranking-oriented link schemes as spam: https://developers.google.com/search/docs/essentials/spam-policies

## Days 5–6 — make answers easy to verify

- Lead each page with the product, intended provider and actual workflow, then answer specific questions in visible HTML.
- Use genuine screenshots, working product explanations and accountable editorial review. Publish measured outcomes only with a real source and agreed dates; label product illustrations and avoid healthcare outcome claims.
- Maintain clear entity information, descriptive internal links and concise explanations of limitations. Add confirmed company/contact/security documents when the responsible owners provide them; do not invent them for schema completeness.
- Let OAI-SearchBot and other search crawlers fetch public pages. OpenAI documents its search crawler separately from its training crawler: https://developers.openai.com/api/docs/bots . Current wildcard crawl policy allows public crawling; it is not a bespoke training opt-out policy.
- Google AI features use ordinary search eligibility and quality fundamentals; no special AI markup guarantees visibility: https://developers.google.com/search/docs/appearance/ai-features . Do not hide keyword blocks, add fake FAQs or implement bot-only cloaked copy.

## Day 7 — inspect, report, prioritise

Record separately: submitted URLs, successful crawls, indexed URLs, query impressions, clicks, consented product visits, qualified conversations, accepted workspace requests and confirmed ready deployments. For AI answers, use a fixed small set of real buyer prompts and record date, engine, prompt, cited URL and wording; an occasional mention is not stable rank.

Investigate excluded pages from Search Console reports: accidental noindex, duplicate canonicals, rendering problems, poor content and weak discovery. Improve the best-supported pages rather than publishing dozens more. Submit new/changed URLs through IndexNow only after deployment. Do not repeatedly resubmit unchanged sitemaps hoping for higher priority.

## Still needs the site owner

- PostHog public project token and correct regional host; no personal/admin API key is needed in frontend code.
- Google/Bing property verification and submission access.
- Confirmed company identity/contact/legal details and permitted external profiles.
- Approved pilot evidence and counterpart permission for third-party links.
- Deployment and live checks; code and local tests do not establish Google indexing or AI citation.

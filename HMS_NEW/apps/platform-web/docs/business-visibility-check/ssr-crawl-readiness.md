> Imported ClinicSheet preview evidence. Exora keeps its real signup/control-API integration and existing static deployment. This historical preview document is not Exora deployment verification; see `ARCHITECTURE.md`.

# SSR and crawler readiness — 23 October 2026

## Implemented locally

The normal build/start path now runs a standalone Next.js server, with request-time rendering selected in the root layout. Public HTML routes are absent from the pre-render cache; metadata and plain-text resources stay static. A separate explicit `build:public` target preserves static preview compatibility. Local port 4490 now serves the SSR build, and the server-only Places adapter runs on loopback port 4500 through the same-origin proxy. Existing Maps quotas and key restrictions were not changed.

The public crawler policy allows all agents once a valid final HTTPS origin is configured, with explicit entries for Google/Bing, OpenAI, Claude and Perplexity crawlers. Metadata stays in the initial document for all agents. Canonical tags, sitemap and llms.txt use the configured origin. Personalized reports, report previews and lookup responses remain noindex; robots excludes the paid lookup endpoint. The prior blanket noindex proxy header remains only in the legacy static-preview deployment config; the SSR runtime supplies route-specific response headers.

CSP uses fresh per-response nonces; no broad unsafe-inline script permission was introduced. The sanitized standalone package excludes the server-only key file and filters public source artifacts. Internal workspace paths, source/archive paths and POST requests are blocked by the marketing runtime. The contact-sales page now has its own title/description/canonical metadata instead of inheriting the homepage's.

## Verification

- SSR and explicit static production builds passed.
- 16 web tests and 29 backend tests passed.
- Real local HTTP checks: 22 public routes with body copy, H1 and title in initial HTML, without JavaScript execution.
- Homepage HTTP checks under 11 representative browser/crawler user agents; initial content and nonce-bearing hydration scripts passed.
- Private noindex headers, protected-route 404s, POST 405, stylesheet serving, llms.txt, sitemap and same-origin lookup `mode=status` passed. No paid API mode was invoked.
- The no-website preview's priority notice exists in initial SSR HTML. Browser report and homepage hydrated without console errors.
- Detailed machine-readable evidence: `ssr-crawl-verification.json`.

## Website priority issue

A missing returned website link now produces a compact amber notice above the score, with expandable details, explaining the risk of losing website visits and booking enquiries and directing the owner to add or verify the link in its expanded details. The numeric score remains labelled as a Google-profile-only score when the site cannot be assessed; unknown website metrics remain dashes rather than invented zeros.

Observed homepage HTTP failures also create a prominent review issue. Network failures are prominent but say that the audit does not prove a universal outage. A bot-blocked homepage remains unassessed and is not automatically called broken for human visitors. No lost-traffic percentage or revenue figure is claimed.

Preview: `/demo/reach-report?state=no-website`.

## Remaining production boundary

The user confirmed that the public domain is not decided. Preview robots/noindex protection stays enabled. Once the final domain is chosen, build with `NEXT_PUBLIC_SITE_ORIGIN` and indexing enabled, deploy the SSR runtime on a Node-capable host and rerun `scripts/verify-crawl.py` against that HTTPS origin. This work does not deploy the site, validate a live CDN/WAF or guarantee a provider crawl/index/rank/citation. Permissive robots makes content eligible for access, not selected for inclusion.

See `deploy/ssr/README.md` for the exact runtime and migration instructions. The previous shared-hosting static configuration cannot execute request-time SSR and must not be mistaken for this Node runtime.

Official references checked:
- https://nextjs.org/docs/app/api-reference/functions/connection
- https://developers.openai.com/api/docs/bots
- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://docs.perplexity.ai/docs/resources/perplexity-crawlers

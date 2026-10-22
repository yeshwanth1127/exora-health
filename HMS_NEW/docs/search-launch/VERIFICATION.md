# Search and analytics verification

Local implementation and checks, 22 October 2026. No production deployment or search submission was performed as part of these checks.

- Production-mode export built with canonical origin `https://health.exora.solutions` and search enabled.
- Export audit: 18 public pages, 5 private/noindex pages, valid unique metadata, canonical URLs, parseable JSON-LD, existing internal destinations/media, crawler allow rules and sitemap; no issues.
- 16 platform tests passed, including input/identifier filtering, PostHog `before_send` filtering, analytics inert before setup, route/domain allowlists, request recovery and shared-brand behavior.
- Desktop 1440×1000 and mobile 390×844: AI reception page rendered, FAQ opened, no horizontal overflow or broken images. Checklist rendered on mobile with a valid download link.
- Browser resource inspection with no PostHog token: zero PostHog requests. Live PostHog ingestion and configured-token browser delivery remain unverified until the project token is supplied.
- Build configuration accepts optional PostHog and Google/Bing verification tokens. PostHog project token is public; no personal/admin token is used. Frozen pnpm lock validation passed.
- IndexNow public proof file prepared and dry-run payload inspected. No URLs submitted.
- Live `https://health.exora.solutions/robots.txt` returned HTTP 200 with `Disallow: /` during the check. The deployed website therefore still needs the new search-enabled build. This is distinct from local export eligibility.
- No inbound backlink, external profile, partner endorsement, search ranking or AI citation was created or claimed. See WEEK-ONE.md and backlink-opportunities.csv for the launch work.

Screenshots: ai-reception-desktop.png and ai-reception-mobile.png.

Integrated with main’s concurrent voice-agent changes. The incremental Docker image now installs the updated frozen workspace dependencies before building and accepts the same public analytics/search build args as the clean image. No Docker image or production deployment was run locally.

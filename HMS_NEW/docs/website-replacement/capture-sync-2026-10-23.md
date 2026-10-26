# Capture website sync — 23 October 2026

Synced the public website updates from `Sachinskz/ClinicSheet` source `f7f683c98a145f3babdcad052e25bd0efcdda7c7` into `apps/platform-web`: day/night story, Google business search, public-profile/homepage report backend, Arc score help and compact checklist, category donuts, city-ranking concept, solution/specialty pages and supporting assets/evidence.

## Integration retained

- Exora quote, onboarding routes, capture-account, workspace-onboarding client, request recovery, template validation and provisioning contracts are preserved. Their source files are unchanged by this sync.
- Existing quote entry links, consented analytics events, social card and explicit indexing opt-in are retained.
- The static `pnpm platform:build` contract still produces `out` and `dist` for existing hosting/control-API asset serving.
- Optional `build:server` produces request-time SSR with monorepo-aware packaging. `start:server` runs `.next/standalone/apps/platform-web/server.js`. Deploy the entire standalone directory, including workspace dependencies, when adopting that runtime.
- SSR passes `/control/*` to the existing control API and the business lookup to a separate backend. Marketing mutations remain blocked. No control API, patient/staff/admin app, tenant configuration or database was changed.
- Python lookup runtime/credential configuration is separate; no API key was committed or quota increased. City rankings remain a clearly labeled concept. No provider scan was run.

## Executed verification

- Production static export, including real quote/onboarding routes: PASS.
- Existing SEO audit: 22 public pages, five private pages, configured origin `https://health.exora.solutions`, no issues.
- Production SSR compilation and standalone packaging: PASS. Local Node runtime starts on loopback 4492.
- Platform tests: 25 passed, including signup/recovery and new control/lookup proxy and middleware checks. Python backend tests: 29 passed.
- Platform TypeScript check and Git whitespace check: PASS.
- Frozen workspace lockfile validation: PASS. Local build reused existing dependencies; clean CI dependency installation is not established by this check.
- Real HTTP checks for 22 public pages and 11 browser/crawler agents passed; no paid lookup calls. See `apps/platform-web/docs/business-visibility-check/exora-ssr-crawl-verification.json`.
- Quote/onboarding and demo routes return HTTP 200 and noindex; lookup mode=status returns HTTP 200. No workspace/provisioning write was made during this sync.

No production deployment, live Google lookup, provider activation, public indexing/citation result or end-to-end tenant provisioning is established by this source push. Browser visual parity and the wider monorepo suites were not rerun for this synchronization. Imported ClinicSheet preview documents describe historical preview behavior and do not supersede Exora's integrated deployment/signup contract.

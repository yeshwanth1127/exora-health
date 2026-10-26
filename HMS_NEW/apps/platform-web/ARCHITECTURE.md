# Platform website

The public platform site is the ClinicSheet marketing website imported from `Sachinskz/ClinicSheet` at `debfa6b`. It replaces the previous platform landing page and onboarding UI. Tenant patient websites, staff workspace, superadmin app and provisioning worker remain separate applications.

- `src/lib/brand.ts`: change `BRAND_NAME` on one line to rename the product.
- `src/app`: home, product, pricing, clinics, hospitals, blog, help, releases and setup pages.
- `src/app/components/capture-account.tsx`: illustrated production account/workspace setup, using the existing control API.
- `src/lib/workspace-onboarding.ts`: payload validation, quote mapping, request recovery, status polling and credential-safe storage.
- `src/lib/capture-onboarding.ts`: short-lived quote handoff; this is intake, not authentication.
- `src/app/components/hero-dashboard/arc`: unchanged illustrative dashboard components.
- `public`: original and optimized illustration assets.

`pnpm platform:dev` serves port 5190 and forwards `/control` to the local control API on 3040. `pnpm platform:build` exports static pages into `dist`, preserving the existing platform Docker image and control-API asset-serving path. `pnpm --filter @hms/platform-web preview` is a static-only local preview; it cannot provision workspaces. Run the control API with `SERVE_PLATFORM_ASSETS=1` to exercise same-origin setup against the backend.

The control API resolves extensionless exported pages and returns genuine 404s for missing pages/assets. The separate `/admin/` app remains owned by its existing build and routes. Existing `/#onboarding` and `/onboarding/welcome`/`workspace` links lead to the new setup.

## Setup contract

The quote hands name, contact, facility, city and website preference into setup. Setup collects the required administrator email, organisation address, facility/timezone, real plan/channel entitlements, and a registered patient-site template (`standard`, `sri-lakshmi`, `hospital-editorial`, or `swastikaa`). Explicit confirmation gates POST `/control/v1/onboarding`; no pretend OTP or authenticated browser-only account remains.

The exact payload, idempotency key and recovery access token are saved before POST. A timeout retries those same values. Validation/address conflicts unlock editing. Other errors retain the request for safe recovery. GET status requires the bearer access token; queued/provisioning requests poll every 2.5 seconds and stop at a terminal state. Reload re-fetches the server result before showing ready links.

Temporary administrator passwords stay in React memory, never browser storage. Old persisted result objects are reduced to request ID/token/status during migration. Only server-confirmed HTTPS deployment links are enabled. Failed or unreachable provisioning remains visible with the request ID and refresh action. Provider-specific activation is not inferred from a ready website.

The three registered templates replace the old nine placeholder layout choices. The live API now imports its existing shared `onboarding.ts` schema; the prior duplicate inline schema discarded `websiteTemplate`.

The selected template, facility type and timezone are forwarded through local and production provisioning commands. Compose supplies the facility settings to the tenant database bootstrap. Defaults preserve existing callers.

## Search and website analytics

`src/lib/site.ts` validates the build-time canonical origin and gates indexing. Production Docker/Compose supplies the configured HTTPS origin and search-enabled flag; local builds without it remain noindex. `src/lib/seo.ts` owns public route metadata; sitemap excludes setup/quote/dashboard routes. Static metadata, article/application/entity/breadcrumb JSON-LD and visible content share the same data. The original illustration galleries remain noindex. `scripts/audit-search.mjs` validates exported metadata and local destinations in CI.

`website-analytics.tsx` loads PostHog only with a configured public project token, allowed cloud host, known route and consent. Explicit events use a property allowlist and before-send filtering. No SDK loads with a missing token. See `docs/search-launch/ANALYTICS-SETUP.md` for activation and `WEEK-ONE.md` for search submission/backlink work. IndexNow is prepared but requires a deliberate post-deployment submission.

## Capture website sync — 23 October 2026

The public website visual/features were synced from ClinicSheet `f7f683c`: day/night story, business search, reach-report backend and evidence UI, category donuts, score-help popover and city-rank concept. Exora's real quote/onboarding routes, control API client, request recovery, provider states, consented analytics events and explicit indexing opt-in remain intact. The patient, staff, admin and provisioner applications were not replaced.

The existing `pnpm platform:build` still emits `out` and `dist` for the current control-API/static deployment. `pnpm --filter @hms/platform-web build:server` produces the optional request-time SSR runtime; `start:server` runs it. SSR rewrites `/control/*` to `CAPTURE_CONTROL_ORIGIN` (default loopback 3040) and `/business-lookup` to `CAPTURE_LOOKUP_ORIGIN` (default loopback 4500). Control-API POST requests remain owned by that API; marketing mutations stay blocked. The Python lookup service and credentials must be configured separately before live business searches are available. No Maps key is committed or quota changed.

The imported `deploy/` files and `docs/PUBLIC_WEBSITE_SECURITY.md` describe the separate ClinicSheet preview. They are not replacements for Exora's current Docker/control-API deployment or signup contract. SSR deployment and live provider verification are separate from this source synchronization.


The editorial hospital template (`hospital-editorial`) is a separate tenant app for NDR or another hospital. Quote selection and workspace setup retain its ID. Saved facility branding is loaded at runtime; selecting this design does not copy Sri Lakshmi clinical or marketing data. See `apps/hospital-editorial-web/README.md`.

The Swastikaa template (`swastikaa`) follows the same provisioned tenant runtime. Its public profile carries saved demo/live mode and content; default demo data remains frontend-only. Workspace settings → Website manages content and general enquiries. Live availability and automated appointment handling reuse the HMS booking and managed voice services. See `apps/hospital-community-web/README.md`.

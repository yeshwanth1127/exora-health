# Paperwhale website on the VPS

The `paperwhale-website` Docker project serves the existing Next.js site at
https://paperwhale.health. Caddy obtains HTTPS certificates and redirects www.
Only Caddy publishes ports 80 and 443. Next runs as an unprivileged user on the
private Docker network, using the sanitized standalone public assets.

Build from the HMS_NEW directory with its frozen pnpm lockfile. The Dockerfile-specific ignore file restricts uploads to build inputs. The Docker
context must contain package.json, pnpm-lock.yaml, pnpm-workspace.yaml and
apps/platform-web and packages/platform/onboarding-modules.{mjs,d.mts} (exclude node_modules, .next, out, dist, artifacts, Python
caches, credentials and local environment files). Do not upload the whole checkout.

```sh
PAPERWHALE_RELEASE=<full-source-commit> docker compose -f apps/platform-web/deploy/compose.yaml build
PAPERWHALE_RELEASE=<full-source-commit> docker compose -f apps/platform-web/deploy/compose.yaml up -d --wait
```

The deployed image is labelled with that commit. Keep previous release images
and source directories for rollback; rerun compose from the earlier release.
The marketing site is available first; control API calls and unconfigured
business reports return explicit unavailable results. Lookup status reports
configured=false. No backend credentials or provider keys are bundled.

Public marketing pages enable search indexing; onboarding, account and demo
pages and website examples retain noindex. The canonical URL and social metadata use paperwhale.health. Internal CSS,
storage and asset identifiers intentionally retain their compatible names.

The older nginx.conf remains a reference for the retired static preview; it is
not used by this SSR deployment. See ssr/README.md for backend integration.

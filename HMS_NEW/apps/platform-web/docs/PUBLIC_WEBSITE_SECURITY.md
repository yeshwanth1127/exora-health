> Imported ClinicSheet preview evidence. Exora keeps its real signup/control-API integration and existing static deployment. This historical preview document is not Exora deployment verification; see `ARCHITECTURE.md`.

# Website-only public preview — 22 October 2026

## Deployment boundary

This branch deploys the standalone ClinicSheet marketing website. The Exora workspace/backend repository is excluded. No signup, OTP, tenant creation, staff/admin service, contact submission or database is deployed. The hero dashboard is frontend-only synthetic showcase data. All previous account-entry calls to action now open product information. The contact page explicitly states that online requests and account creation are closed.

## Changes

- Removed quote and onboarding routes from this website-only build; the full flows remain in the original repository history/main.
- Removed the unconnected email collection form.
- Updated the vulnerable transitive PostCSS build dependency to 8.5.31 using an npm override.
- Added `npm run build:public`, producing `dist` from the Next static export. Deploy **dist**, never `public`, `out`, the repository or node_modules.
- Excluded 46 asset source/review artifacts: prompt notes, JSON manifests, source ZIPs, reference folders and illustration review HTML. Original files remain on disk/in Git.
- Each exported HTML file receives CSP hashes for its exact inline hydration scripts. Scripts permit self and these hashes; no script unsafe-inline/unsafe-eval. Inline styles remain permitted for React/motion. External image origins remain allowed for existing imagery; connections/frames are self-only. No submission target is permitted.
- Included Apache/LiteSpeed `.htaccess`: directory listing off, GET/HEAD only, workspace/API paths denied, extensionless page routing, noindex header, same-origin framing, MIME sniffing protection, referrer/permissions policies and static caching. Same-origin framing preserves the hero dashboard.
- Temporary preview remains noindex. Sitemap is empty until a site origin is configured, avoiding invented domains.
- Local preview serves sanitized `dist` on loopback only, with matching security headers and no directory listings. It is not a production server.

## Verification

- Static production build and TypeScript check pass.
- Twelve tests pass, including exclusion rules, exact CSP hashes and hosting-rule contracts.
- `npm audit --json` reports zero known vulnerabilities at verification time (all dependencies).
- Export scan finds no matches for private-key blocks, AWS access keys, GitHub tokens, Stripe live secret keys, or active SVG script/onload handlers. This is a targeted scan, not proof that arbitrary secrets cannot exist.
- Local HTTP checks: marketing pages 200; quote/onboarding/API/hidden/source-prompt/directory/unknown paths 404; POST to root 405.
- Browser checks of twelve marketing/resource pages found no forms, broken images or horizontal overflow at desktop size. The 390px mobile homepage hero grid was corrected and visually checked. The earlier analytics and SEO frontend foundations are retained, with PostHog inactive until a project token and consent are provided. Browser confirms hydration and the overview-to-schedule showcase work under the CSP. Local browser evidence does not establish Hostinger deployment.

## Public-hosting checks still required

Hostinger MCP registration/restart/sign-in and account inspection must precede deployment. No public URL or TLS result is claimed yet. Choose an existing eligible plan and a free Hostinger hostname; do not purchase services or alter existing websites.

After upload, verify the real hostname's certificate, HTTP-to-HTTPS redirect, all public routes, unknown-page 404, denied paths/methods, CSP/security headers and dashboard animation. Hostinger must support the included Apache/LiteSpeed directives. Enable HTTPS redirect and HSTS only after TLS is confirmed; no redirect is blindly configured before knowing the host's proxy/TLS behavior.

## Flood protection boundary

A static website has no exposed application process, query endpoint or write operation to rate-limit. Denying mutation methods removes form/API spam targets. This does **not** prevent traffic floods or guarantee DDoS immunity. Provider/CDN edge filtering and request limits, bandwidth ceilings and availability controls must be inspected on the actual Hostinger plan. If that plan cannot supply suitable edge controls, record that gap before calling the preview hardened. No backend rate limiter or VPS firewall has been installed or claimed.

## Reproduce

From `web`: `npm ci --ignore-scripts`, `npm test`, `npm run typecheck`, `npm run build:public`, `npm audit`. The ignored `artifacts/public-manifest.json` records included/excluded files. The ZIP contains `index.html` and `.htaccess` at its root. Keep audit notes, manifests and source outside the published ZIP.

## Verified Hostinger deployment

Public URL: https://srv2086263.hstgr.cloud/

Deployed to the existing KVM 2 VPS (ID 2086263), using Hostinger Connector project `capture-website`. No plan/domain was purchased, and no Exora workspace/backend services were deployed. This is VPS hosting; the shared-hosting `.htaccess` is not used. Active configurations are in `deploy/nginx.conf`, `deploy/Caddyfile` and `deploy/compose.yaml`.

- Deployed static release: `/opt/capture-site/releases/20261022T1600`, with `/opt/capture-site/current` pointing to it. All 702 uploaded files (including the unused `.htaccess`) matched local SHA-256 checksums.
- Source/configuration files on the VPS are outside the public document root. The site mount and Nginx root filesystem are read-only. Nginx runs as UID/GID 101. Both services have CPU, memory, process and log-size limits. No Docker socket is mounted. Images are pinned by digest.
- Hostinger deployment action 121347872 completed successfully; both services are running and the web health check is healthy.
- Trusted public TLS verified using the system trust store, hostname SAN and TLS 1.3. Certificate expiry observed: 20 January 2027. Caddy stores certificates persistently and handles renewal; future renewal is configured, not yet observed.
- Plain HTTP returns 308 to the HTTPS URL. HTTPS returns the actual Capture homepage, not a provider placeholder.
- Home, product, pricing, clinic, hospital, blog, help, releases, privacy and showcase routes returned 200. Quote, onboarding, signup API, hidden files, source prompts and unknown paths returned 404. POST returned 405.
- Live browser: desktop and 390px mobile rendering checked; no console errors, broken homepage images or horizontal overflow. Hero iframe rendered Overview. Local earlier checks also observed the schedule animation.
- Live HTTP headers confirmed CSP frame ancestry, MIME protection, same-origin framing, permissions/referrer policies, one-day HSTS and preview noindex.
- Nginx request limits: 20 requests/second per client IP, burst 100; aggregate 500 requests/second, burst 250. Connection limit: 40 per IP. Caddy overwrites untrusted forwarding headers; the Nginx listener is unpublished and trusts only private Docker peers for real-IP resolution.
- Bounded live rate-limit probe: 160 small favicon requests in 310 ms; 105 returned 200 and 55 returned 429. Nginx logged the per-IP limiter and services stayed healthy. This tests a short request burst, not volumetric DDoS resilience.
- Hostinger firewall 383588 `capture-website-public` is attached and synced. It allows TCP 22, 80 and 443 plus ICMP/ICMPv6; other ingress is dropped. The host UFW firewall is enabled with SSH connection-rate limiting and HTTP/HTTPS allowances. Docker-published web traffic is also protected by the Hostinger firewall; UFW alone is not relied upon for Docker isolation.
- External probes reached 22/80/443; 8080, 2019, 3306 and 5432 were not reachable. Caddy admin is disabled.
- The owner's existing local SSH public key was added to this VPS through the connector for deployment. No password was requested, changed or committed.

No CDN/WAF service or independent upstream DDoS mitigation was configured or certified. These application/firewall controls reduce abuse but cannot guarantee availability during a sufficiently large distributed traffic flood. Add a final domain and suitable edge protection before a broader production launch. Preview noindex remains intentional until that domain is selected.

Manage the VPS/project through https://hpanel.hostinger.com. For an update, build `dist`, upload to a new versioned release outside the config directory, verify file hashes, change the `current` link, then restart/recreate the web service to refresh the read-only bind mount. Do not replace the original Exora repository or expose its APIs.

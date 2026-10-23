# Request-time SSR runtime

The opt-in `build:server` Next build produces a standalone Node server. RootLayout awaits `connection()` for request-time HTML. Public route content, headings, links and metadata are delivered before JavaScript. `htmlLimitedBots: /.*/` keeps metadata in the initial document for every user agent. Interactive visualizations/search hydrate afterwards. Business reports remain private to search and are fetched on demand; crawler visits never initiate a paid report.

## Build and run locally

1. `CAPTURE_DISABLE_BUILD_CACHE=1 npm run build:server`
2. `CAPTURE_WEB_ORIGIN=http://127.0.0.1:4490 python3 preview.py --api-only --port 4500`
3. `HOSTNAME=127.0.0.1 PORT=4490 npm run start:server`

The Python service is loopback-only. Node proxies `/business-lookup` to it. The key stays server-only in the ignored `.env.maps.local` or `CAPTURE_GOOGLE_MAPS_API_KEY`. No quotas or provider permissions were raised.

Exora’s default `npm run build` preserves the existing static `dist` deployment and real signup routes. Use `npm run preview` for that static preview. That target is build-time pre-rendering, not request-time SSR. The existing parent deploy/compose.yaml and Nginx configuration describe that static preview and intentionally remain noindex. Do not use them as an SSR deployment.

## Production configuration

Preserve Exora’s operator-configured origin and explicit indexing opt-in. A future SSR deployment must use the actual deployed origin and validated control/lookup services. Build with `NEXT_PUBLIC_SITE_ORIGIN=https://<actual-domain>` and `NEXT_PUBLIC_SEARCH_INDEXING=true`. Without a valid HTTPS origin, or with indexing explicitly false, robots and response headers keep the preview out of search. This is intentional. The production configuration permits public pages for all user agents, plus explicit known AI crawlers. Private/admin routes, paid lookup and noindex reports/previews remain excluded. Robots directives are not access control.

`npm run build:server` copies only sanitized public assets into `.next/standalone/apps/platform-web/public`; it does not copy the original public source directories wholesale. Deploy the entire `.next/standalone` directory, including its traced workspace dependencies; run `node apps/platform-web/server.js` from it. Node serves `.next/static` from the packaged copy. Deploy the four Python backend files (`preview.py`, `business_lookup.py`, `reach_report.py`, `website_fetch.py`) separately with the credential mounted read-only. In separate containers, the Python backend should share the Node container's network namespace or the build-time `CAPTURE_LOOKUP_ORIGIN` must be the exact internal service URL. The backend origin allowlist must contain the final public HTTPS origin in `CAPTURE_WEB_ORIGIN`.

Use a Node-capable host/VPS and HTTPS reverse proxy. Remove the old proxy's blanket `X-Robots-Tag: noindex, nofollow` for the public SSR site: the app supplies route-specific headers. Preserve noindex on report/demo routes. Keep provider/admin APIs private, allow only GET/HEAD on marketing paths and retain the scoped control-API proxy, and do not introduce a general AI-crawler challenge or deny rule. If a CDN/WAF is later added, validate its bot policy separately using official IP ranges; a spoofed user-agent test is not proof that the actual bot can pass the edge.

## Security and verification

SSR responses use a fresh server-generated CSP nonce; client nonce headers are overwritten. No broad unsafe-inline script permission is added. Marketing mutations, source maps and internal staff/admin app routes remain blocked. Exora’s quote/onboarding pages remain accessible with noindex, and `/control/*` is forwarded to the existing control API, which owns authentication, validation and write permissions.

`python3 scripts/verify-crawl.py --origin http://127.0.0.1:4490 --preview` checks real HTTP responses without executing JavaScript, for browser, Google, Bing, OpenAI, Claude and Perplexity user agents. It checks body headings/content, head metadata, nonce-bearing scripts, noindex on reports, assets, and safe lookup proxy operation using only `mode=status`. It never creates a paid Google request. Run without `--preview` against the final HTTPS domain after deployment to verify canonical origin, sitemap, robots and indexing headers. Neither a local pass nor permissive robots guarantees that a provider will crawl, index, rank or cite the site.

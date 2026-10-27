# Existing Paperwhale VPS website release

ClinicSheet is the website source. This bounded integration preserves Exora control API, real quote/onboarding flows, privacy policy and the VPS brand overlay. No clinical services are rebuilt.

1. Push this repository to main, then on the existing VPS run `git pull --ff-only` in `/var/www/exora-health`. Preserve the VPS local brand/navigation/dockerignore files and `deploy/paperwhale` configuration. Save a private backup before pulling.
2. Provision `/opt/paperwhale-platform/private/reach/maps.env` (one `CAPTURE_GOOGLE_MAPS_API_KEY` line, owner 10001, mode 600) and `state/` (owner 10001, mode 700). Never commit, print or bake the credential into an image. Keep these persistent across releases; never replace or reset the usage SQLite database.
3. Build the existing `deploy/paperwhale/Dockerfile.website` and this `Dockerfile.lookup` from the HMS_NEW context, tagging both with the new commit and passing `SOURCE_COMMIT`. Set `PAPERWHALE_RELEASE` in the existing private `.website-release.env` to that commit.
4. Merge existing `deploy/paperwhale/website.compose.yaml` with this `lookup.compose.yaml` using `docker compose --env-file deploy/paperwhale/.website-release.env -f deploy/paperwhale/website.compose.yaml -f deploy/production/website-reach/lookup.compose.yaml up -d --no-deps web lookup`. Do not redeploy clinical/control/identity services.
5. Replace only the old disabled `/business-lookup` Caddy handlers with `handle /business-lookup { reverse_proxy lookup:4500 { transport http { response_header_timeout 120s } } }`. Keep all other domains/routes unchanged. Validate the full configuration before an edge-only restart (admin API is disabled).
6. Verify the image revision, HTTPS quote-only pricing, SSR headers, configured status, bounded live report and clinic/control health. Retain prior image tags and private config backups for rollback.

Google response content is not stored. Only counters and independent website audits persist. Application guards fail closed and enforce daily/monthly limits; Google project quotas remain the outer limit. Neighbourhood positions describe a Places query sample, not guaranteed consumer Google Search ranks.

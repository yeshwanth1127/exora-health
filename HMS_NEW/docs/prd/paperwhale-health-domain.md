# Move to paperwhale.health

Status: **proposed 26 Oct 2026, awaiting approval.** Nothing has been changed or deployed.

## Problem

Production runs on `exora.solutions`. The company is Paperwhale and the new domain is
`paperwhale.health`. The old domain is hardcoded in about 12 deploy files: nginx, Keycloak, the
platform and tenant compose files, the provisioning scripts, the platform Dockerfile and CI.

## Proposed hostnames

| Today | New |
| --- | --- |
| `health.exora.solutions` (website, control plane) | `paperwhale.health` |
| `{slug}.health.exora.solutions` (each clinic) | `{slug}.paperwhale.health` |
| `auth.health.exora.solutions` (Keycloak) | `auth.paperwhale.health` |
| `support@exora.solutions` (sign-in email) | `support@paperwhale.health` |
| none (private Umami) | `analytics.paperwhale.health`, company-only |

## Plan

1. **Code (one commit).** Replace the hardcoded host with one setting, `PLATFORM_DOMAIN`, used by
   nginx templates, compose, provisioning and the Dockerfile. Default it to `paperwhale.health`.
2. **DNS and TLS (needs you).** Point `paperwhale.health` and `*.paperwhale.health` at the VPS.
   Issue a wildcard certificate with a DNS-01 challenge. Set up mail (SPF, DKIM) for `support@`.
3. **Cut over on the VPS.**
   - Change Keycloak's hostname and each clinic's redirect URIs.
   - Changing the issuer signs everyone out once.
4. **Outside services.** Update the URLs registered with each provider:
   - Google OAuth redirect URIs;
   - Meta (WhatsApp) webhook and callback URLs;
   - Sarvam voice callbacks;
   - Search Console: add a new property, then submit the sitemap.
5. **Keep the old domain.** It 301-redirects every path to the new host for at least 90 days, so
   saved links and Google listings keep working.

## Out of scope

Renaming internal identifiers (`exora-healthctl`, service names, the Sarvam agent ID). These are
not visible to clinics.

## Acceptance

- Every clinic's dashboard, booking page and sign-in work on `*.paperwhale.health`.
- Old URLs redirect to them.
- `git grep exora.solutions` finds only the redirect config.

## Open questions

1. Who manages DNS for `paperwhale.health`? I can't change DNS.
2. Which branch: `codex/paperwhale-single-vps`, the branch production deploys from? Or this branch?

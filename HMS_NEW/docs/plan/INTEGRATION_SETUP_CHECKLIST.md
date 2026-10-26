# Dashboard integration activation checklist

Status: local implementation and permission testing; live customer/provider acceptance is pending.
Use this for the current HMS_NEW tenant runtime, not the separate Avocado application.

Current local verification, provider registration steps and ordered blockers:
[24 October 2026 operational readiness](OPERATIONAL_READINESS_2026-10-24.md).
The dated Meta inspection below is historical; consult the current report before activation.

## What you need to arrange

| Item | Company setup | Clinic user does |
| --- | --- | --- |
| Dashboard hosting | Choose the real HTTPS dashboard/clinic domain, DNS and certificate; deploy API, worker, PostgreSQL and private media storage; apply migrations and back up secrets/database. | Opens their clinic's dashboard. |
| Staff login | Configure one company OIDC provider with a browser client and HMS API audience. Build the staff image with those public OIDC settings, development login disabled, `openid profile email`. Access tokens must contain verified `email` and `email_verified=true` for first invite acceptance. Register each exact `/staff/callback` URL and allowed browser origin. | Signs in with the invited work email; completes the identity provider's email verification. |
| WhatsApp | Reuse the company Meta app after checking its Business portfolio, app review and Embedded Signup configuration. Configure a v4 Login for Business configuration with the appropriate WhatsApp products, supported Graph version, server app secret and webhook verify token. Approve the required WhatsApp permissions for customer assets; subscribe `messages`, and the coexistence fields below if using the Business app. | An authorized business administrator chooses their business/number in Meta, grants access and completes phone verification. A payment method may need to be attached to their WABA. |
| Google Business | Create a Google Cloud project, request/obtain Business Profile API access, enable the used APIs, configure an OAuth web client and external consent screen, and complete the required verification/publication for external customers. Register each exact dashboard `/integrations/google/callback` URL. | Signs in as an owner/manager of the clinic's verified listing and selects that listing. |
| Website analytics | Host a company-controlled Umami v3 release supporting persistent API keys. Set a private HTTPS API origin and a server API key with website creation/read rights. Optionally use one company team. Keep the Umami console private. | Adds the website address. The Exora-hosted website's default clinic loads tracking automatically on the next visit; a separate website needs the one installation snippet. |
| PostHog (optional) | Create one company project; choose US/EU ingestion and store the project ingestion key on the server. It receives only the limited analytics mirror, without autocapture, replay or person profiles. | Nothing. No separate account or key. |
| Pilot clinic | Prepare one facility, an invited administrator, a reception test user and a real owner/manager for the provider accounts. Publish a doctor, consultation fee and schedule before enabling WhatsApp booking. Use a consenting test phone and synthetic appointment details. | Connects accounts, tests a booking and enables notices only after approval/readback. |

Google currently requires the API-access applicant to manage a verified Business Profile active for
at least 60 days, with its business website listed. An unprovisioned Google project alone will not
unlock the API. See [Google prerequisites](https://developers.google.com/my-business/content/prereqs)
and [basic setup](https://developers.google.com/my-business/content/basic-setup). The implementation
uses Account Management, Business Information, Google My Business reviews/posts and Business Profile
Performance APIs. Google has no general Business Profile sandbox; a local provider harness does not
prove that Google will authorize the project or listing.

For Umami, see [API authentication](https://docs.umami.is/docs/api/authentication). This adapter targets
self-hosted `/api` endpoints. It does not accept an Umami Cloud API key as a substitute for the
self-hosted service configuration. `deploy/production/analytics.compose.yml` supplies a private stack
template; choose a pinned official image, change the initial admin password and create its API key.
Use a URL-safe database password and retain its application secret and database backups.

## Existing Meta app checked on 2026-10-17 (India)

The connected Meta tool exposes **Hospital-WA-booking**, app ID `1132802439734841`, with administrator
access. Read-only provider results show:

- App mode: development; `is_live=false`.
- An enabled `whatsapp_business_account` subscription for `messages`, pointing at
  `https://avocado.exora.solutions/...` (the connector masks the remaining path).
- No App Review submission recorded; the privileges response is empty.
- Contact email not verified; privacy policy, terms, deletion and support URLs are unset.
- The owning business portfolio is not granted to this connector. It cannot establish which live
  WABA/phone numbers, billing setup or message delivery are working from this app inspection.

Your existing flow is acknowledged. These findings do not establish customer-onboarding approval,
and do not establish that the dashboard uses the same live phone/account. No live subscription,
callback, account, phone number or app mode was changed during this inspection. If the working
Exora flow uses another Meta app, it is not among the apps currently exposed to this connector.

For independent clinic customers, finish the company app's public business/contact/privacy/deletion
settings, Tech Provider/app review requirements and Advanced Access for the required
`whatsapp_business_management` and `whatsapp_business_messaging` permissions; confirm any additional
permission requested by the chosen Login for Business configuration. Use a real customer who is
not an app administrator for final acceptance.

References: [Meta partner requirements](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview),
[Embedded Signup versions](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions),
[webhook overrides](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/override/),
[Business app onboarding](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).

## What is wired automatically

- Tenant provisioning generates persistent encryption/signing secrets and a dedicated booking
  system identity scoped to that facility. Customers never create service accounts or enter keys.
- The production bootstrap creates an owner invitation. A verified first sign-in binds it to the
  identity provider; the development `admin` identity cannot sign in to the production issuer.
  Existing bootstrap development owners are converted to invitations on OIDC bootstrap; already
  linked real identities remain intact. Invitations expire after 14 days and can be renewed by an
  authorized administrator.
- The production image rejects mismatched OIDC settings and development browser builds. Both API
  and worker receive the provider settings. The runtime restarts if either process exits.
- Google exchanges/refreshes tokens on the server; the user sees consent and listing choice.
- WhatsApp v4 completion accepts a WABA-only Business app event only when provider lookup resolves
  exactly one verified phone. Multiple numbers require an explicit selection. Already registered
  Cloud numbers are not registered again. Business app status is checked with Meta.
- Existing WABA subscriptions are preserved. The explicit phone selected in dashboard signup gets
  its own callback; the callback is read back before success. This leaves the app's shared callback
  in place for other phones/integrations. Connecting a number already used by another application
  still needs a deliberate migration/pilot; it is not a passive read-only action.
- Coexistence initiates Meta's contact/history synchronization requests within onboarding. Subscribe
  the app to `history`, `smb_app_state_sync` and `smb_message_echoes` in addition to `messages` before
  offering that option. Signed sync callbacks for a connected account are acknowledged without
  importing old chats/contacts, creating patients or granting messaging consent. Replies sent from
  the Business app remain there in this minimal release; the dashboard stores new inbound messages
  and its own replies. Historical chat import and cross-app outbound mirroring are not offered.
  Sync requests are claimed durably before sending; renewing a connection does not repeat them.
  Unknown acceptance needs operator reconciliation rather than automatic resubmission.
- For the Exora-hosted patient website, the bootstrap exposes only the default clinic's public tracker identifier.
  No snippet needs to be pasted by the clinic. Saved web bookings are attributed once to the
  matching clinic/origin, with DNT/GPC respected. External websites need their public snippet once.

## Operator configuration

Keep all of the following in company secret management/private deployment configuration. Never
request them in clinic forms or put provider secrets in `VITE_*` variables.

| Setting group | Names |
| --- | --- |
| Login | `AUTH_MODE=oidc`, `NODE_ENV=production`, `OIDC_ISSUER`, `OIDC_JWKS_URL`, `OIDC_AUDIENCE`, `OIDC_CLIENT_ID`, `OIDC_SCOPE` |
| Public browser build | `VITE_HMS_DEV_LOGIN=false`, `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_AUDIENCE`, `VITE_OIDC_SCOPE` matching the runtime |
| Private connections | `INTEGRATIONS_PUBLIC_ORIGIN`, persistent `INTEGRATIONS_ENCRYPTION_KEY` |
| Meta | `WA_APP_ID`, `WA_APP_SECRET`, `META_SIGNUP_CONFIG_ID`, `WA_GRAPH_VERSION`, `WA_VERIFY_TOKEN`; explicitly set `WA_MANAGED_SENDING_ENABLED=true` only for the intended pilot/live runtime |
| Google Business | `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET`; exact OAuth web-client redirect is `<INTEGRATIONS_PUBLIC_ORIGIN>/integrations/google/callback` |
| Analytics | `UMAMI_ORIGIN`, `UMAMI_API_KEY`, optional `UMAMI_TEAM_ID` |
| Optional mirror | `MANAGED_POSTHOG_ORIGIN`, `MANAGED_POSTHOG_KEY` |
| Booking authority (generated) | `MANAGED_BOOKING_STAFF_ID`, `BOOTSTRAP_FACILITY_ID`, `PUBLIC_BOOKING_ENABLED`, `PUBLIC_BOOKING_SIGNING_SECRET`, `PUBLIC_BOOKING_SITES_JSON` |
| Edge | exact `CORS_ORIGINS`, `TRUSTED_PROXY_CIDRS`, DNS/TLS and ingress for API/callback/tracker routes |

The production provisioner reads the company OIDC/provider settings from its private configuration
and retains tenant secrets across runs. Existing tenants need their normal migration/bootstrap
and an updated image/environment. Do not reset their databases. Per-tenant callback URLs must be
registered with the identity provider and Google before sending the customer their dashboard link.

Run `pnpm integrations:check` inside the deployed runtime. It emits boolean checks and no secrets;
exit 2 means configuration, browser auth, schema or booking identity setup remains incomplete.
This check performs no provider writes and is not evidence of external approval or message delivery.

## Required customer permissions

| Action | HMS permission at the clinic | External permission |
| --- | --- | --- |
| Connect/manage WhatsApp and notices | `comms.manage` (plus `comms.read` to see the page) | Business portfolio/WABA/phone access accepted by Meta |
| Read/reply to WhatsApp | `comms.read`, `comms.reply` | Already connected clinic account; care consent and current message window |
| Prepare/approve promotions | `campaigns.manage` / `campaigns.approve` | Approved marketing template and current explicit recipient opt-in |
| Connect/manage Google and websites | `growth.manage` (plus `growth.read`) | Google listing owner/manager for Google; website installation access for external sites |

The built-in clinic administrator role supplies these permissions within its grant scope. Reception
can read/reply within its clinic; it cannot connect accounts or approve promotions. An administrator
can invite a narrower role from Workspace settings without giving global tenant administration.
Provider account access never substitutes for an HMS permission, or the reverse.

## Acceptance evidence and remaining live test

The new test `apps/api/src/http/managed-onboarding.test.ts` uses real HTTP, signed RSA OIDC tokens,
a local JWKS endpoint, restricted database credentials, actual invitations, permissions and saved
connection records. External provider transports are controlled responses. It checks unverified
email/wrong audience, owner invite binding, new staff onboarding, all three setup paths, facility
and tenant denial, revocation during consent, private credentials, hosted-site discovery and real
bootstrap booking identity provisioning. Production auth metadata has separate negative tests.

Seven browser checks run through the actual local dashboard API and PostgreSQL: administrator
WhatsApp connection/persisted reload, website creation, no credential fields, administrator Google
setup enabled, reception Google setup disabled and reception WhatsApp setup read-only. Meta's SDK
window and remote provider responses are synthetic. Screenshots: `/tmp/hms-onboarding-owner.png`
and `/tmp/hms-onboarding-reception.png`.

Reproduce after the normal local DB test setup (never use a customer database):

```sh
PG_PORT=54339 node_modules/.bin/tsx apps/staff-web/tests/browser/managed-api-harness.ts
# In apps/staff-web, another terminal:
VITE_HMS_DEV_LOGIN=true VITE_HMS_DEFAULT_SUBJECT=owner HMS_API_PROXY_TARGET=http://127.0.0.1:3067 node_modules/.bin/vite --host 127.0.0.1 --port 5197
# From HMS_NEW, another terminal:
playwright-cli -s=managed-permissions open http://127.0.0.1:5197/staff/whatsapp
playwright-cli -s=managed-permissions run-code --filename=apps/staff-web/tests/browser/managed-account-permissions.cjs
```

Do not run a database-resetting test suite while the browser harness is using its disposable test
database. The local harness has its own development sign-in; the OIDC test separately verifies
signed tokens/invite binding. Neither proves a real identity provider's hosted consent screen.

Live acceptance still requires the deployed URL/company settings above, a non-app-admin clinic
owner completing actual Meta/Google consent, an inbound/outbound message with a delivery receipt,
a persisted test booking, approved notice readback, Google listing/performance readback and a real
Umami visit from the installed website. No real patient message or public listing write was sent.
Container execution could not be tested locally because the Docker daemon is unavailable; Compose
configuration and application builds are separate validation layers.

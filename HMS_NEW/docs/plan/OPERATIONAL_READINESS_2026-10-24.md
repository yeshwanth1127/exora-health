# HMS staff dashboard: operational readiness, 24 October 2026

## Outcome and evidence boundary

The local HMS staff dashboard is running. It is not yet fully operational with live providers.
Meta/Google registration is part of the remaining work; Loyalty, unsupported Google capabilities,
production identity/hosting and voice/video acceptance also need attention.

Target confirmed by the user: local HMS staff dashboard first. Active source is
`/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW`, branch
`codex/admin-dashboard-arc`, baseline `930526f`. The dirty primary checkout was preserved.
This is the tenant staff workspace, not the separate platform/admin-web application or Avocado bot.

Local services:

- Staff: <http://127.0.0.1:5198/staff/overview>; local seeded administrator subject `priya`.
- API: <http://127.0.0.1:3080>; readiness `/ready`.
- PostgreSQL: port 54339, existing `hms` database. This database contains synthetic demo data.
- Worker: same database; managed WhatsApp sending remains disabled.

The current readback is saved in [the sanitized local receipt](operational-readiness/2026-10-24-local.json).
No real provider consent, phone registration, campaign, listing write or message delivery was tested.
An HTTP 200 for an integration endpoint means its status can be read, not that the provider is connected.
No browser visual, keyboard or motion parity claim is made.

## Progress made in this pass

1. Located the current Arc dashboard checkout and reused its existing local database without resetting it.
2. Started PostgreSQL, API, worker and Vite.
3. Found a broken `@fastify/static` dependency link pointing at a deleted temporary directory.
4. Found shared cross-checkout dependencies causing missing-package typecheck errors and Vite font access denials.
5. Replaced only this checkout's dependency links with its own frozen-lockfile installation, using
   `corepack pnpm install --frozen-lockfile`. No manifest or lockfile change was needed.
6. Verified local sign-in, scoped operational/integration reads and font delivery; reran automated checks.
7. Inspected the real Meta app through the connected Meta developer tool, read-only.
8. Added the missing Google credential row to the operator checklist.

## Executed verification

- PASS: independent frozen-lockfile dependency installation; manifests and lockfile unchanged.
- PASS: root TypeScript check.
- PASS: full backend/database suite, **453 tests in 44 files**.
- PASS: staff suite, **246 tests**, and production build. Existing large-chunk advisory remains.
- PASS: local authenticated operational reads, unavailable provider status reads, CSS and font delivery.
- EXPECTED FAIL: integration configuration check exits **2**, `ready=false`; database schema passes.
- UNVERIFIED: real provider consent/delivery/readback, real calls, deployment and rendered Arc parity.

Raw execution logs are local temporary files under `/tmp/hms-operational-*-20261024.log`.
The sanitized receipt retains results without tokens, credentials or patient records.

## Working versus blocked

| Area | Current evidence | Remaining gate |
| --- | --- | --- |
| Local runtime and development login | PASS: dashboard, database readiness and seeded administrator sign-in; independent dependencies and font request work | Production OIDC and deployment are separate |
| Clinic, doctor and staff setup | Local scoped reads plus automated staff-flow coverage | Configure the actual clinic, verified staff identities, doctor affiliations, service fees and schedules |
| Appointments, patients, queue and overview | Local persisted-data reads and automated booking/registration/arrival/reporting flows | Real clinic setup and operational user acceptance; counts in this DB are synthetic |
| Alerts | Local authenticated read and automated permission/state coverage | Source-specific provider alerts still depend on connected providers |
| WhatsApp workspace | API-backed setup/inbox/automation/promotion code exists; current `available=false`, `connected=false`, sending/booking disabled | Meta company setup, HTTPS callbacks, server settings, clinic consent and real delivery acceptance |
| Google Business | Server OAuth, listing selection and profile/review/post/performance adapters exist; current `available=false`, `not_connected` | Google project/API access, OAuth settings, server credentials and authorized clinic listing |
| Google photos and automated review requests | Explicitly unsupported capabilities in the current adapter | Backend/provider implementation; credentials alone do not enable them |
| Website analytics | Server adapter exists; current `available=false`, `unavailable` | Provision private self-hosted Umami, configure its key, install tracker and observe a real visit |
| Voice | Local history/read routes and runtime integration exist; empty local history | Tenant-bound runtime/provider configuration, number/account acceptance and consented real call/transcript verification |
| Teleconsultation | Local session workflow exists | Real video host/token configuration and a successful patient/doctor call |
| Loyalty | `Loyalty.tsx` stores its preview in browser localStorage; no operational `/v1/loyalty` implementation | Backend design/implementation and real persisted enrollment/reward ledger; separate from Meta/Google |
| Public/WhatsApp booking | Core booking operations exist; public site mapping and managed booking identity are absent in this runtime | Approved website origin, provisioned facility-scoped booking identity and signed site binding |
| Production readiness | Local checker returns `ready=false`; database integration schema passes | Production sign-in, secure connections, provider/analytics configuration and booking authority |

The old phase ledgers contain historical gaps. This report uses current source, local reads and
executed checks; it does not treat every historical TODO as still open or mark provider work complete.

## Meta: current Paperwhale app and historical old-app inspection

Update, 25 October: the user chose a new company account. The active setup is now
**Paperwhale Health**, app `1680242293467371`, portfolio `2362243331179547`.
See [current Meta progress](META_SETUP_PROGRESS_2026-10-24.md) for its onboarding gate.
The old-app findings below are historical and must not be used to configure or modify the
new Paperwhale integration. Preserve the old bot and its phone/webhook.

The connected account exposes **Hospital-WA-booking**, app ID `1132802439734841`.
Do not create another app unless a separate business/application genuinely requires one.
Open [this app's dashboard](https://developers.facebook.com/apps/1132802439734841/dashboard/).

Read-only findings on 24 October:

- App is in development mode (`is_live=false`).
- Contact email is not verified. Privacy policy, terms, deletion, support and base domains are unset.
- Allowed OAuth redirects and JavaScript SDK domains are unset in the exposed advanced settings.
- Review status is `NO_SUBMISSION`; privileges list is empty.
- Review requirements report `business_verification_passes=false` and no privacy policy.
  The generic `can_submit=true` flag is also returned; it does not establish approval for any permission.
- An enabled `whatsapp_business_account` subscription includes only `messages`, with a masked callback
  at `https://avocado.exora.solutions/...`. Delivery and ownership of a particular phone are unverified.
- The connector was not granted the owning portfolio. WABA/phone/billing ownership and full business
  verification evidence cannot be established from these app reads.

Steps for the company operating this dashboard:

1. Use the existing developer app and connect the appropriate business portfolio. Complete Tech Provider
   business verification with matching legal/business details and the evidence Meta requests.
2. Verify the app contact email and publish truthful privacy, deletion and support information on the
   real company domain. Complete the app settings requested by the onboarding/review screen.
3. Configure Facebook Login for Business with WhatsApp Embedded Signup v4; register the actual HTTPS
   dashboard origin/redirects. Save its configuration ID. Select only products/assets this service uses.
4. Complete Tech Provider App Review for Advanced Access to `whatsapp_business_management` and
   `whatsapp_business_messaging`. Prepare reproducible reviewer instructions and videos demonstrating
   message sending/receipt and template creation. Follow any additional current access-verification tasks.
5. Configure the server-held app secret, app ID, signup configuration, supported Graph version,
   encryption key, public origin and webhook verification secret. Never put secrets in `VITE_*`.
6. Validate the onboarding callback/subscriptions. Current Meta v4 implementation guidance also calls
   for `account_update`; the inspected app subscribes only to `messages`. Business-app coexistence
   additionally needs its documented history/state-sync/echo fields and an explicit supported pilot.
7. After the required approvals, publish the app for the intended customers. A clinic business administrator
   then completes Connect WhatsApp, selects/creates its WABA and phone, verifies the number and completes
   required billing. Read back the subscription before enabling sending for that pilot.

Do not replace the existing Avocado webhook or migrate its phone just to test dashboard setup.
The implemented managed flow supports a phone-specific callback. Confirm phone ownership and the
intended integration before connecting an already-used number.

Acceptance: a consenting clinic owner who is not an app admin completes signup; one inbound message,
one permitted reply and its delivery receipt persist; a synthetic appointment is saved exactly once.
Verify template approval and recipient consent before testing notices/promotions.

Official references: [Tech Provider onboarding](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers),
[Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview),
[v4 implementation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/).
Meta documentation was obtained through the connected Meta documentation tool; direct web fetches were rate limited.

## Google: company project, then clinic consent

Google Cloud account/project and approval state were not accessible in this session. Missing local
credentials do not prove that the company has no existing approved project. Check for one before
creating a duplicate.

1. Use a company-controlled Google account and [Google Cloud project](https://console.cloud.google.com/).
   Record its project number. Arrange a Business Profile organization account as required for the platform.
2. Obtain owner/manager access to a legitimate verified Business Profile that has been active for at
   least 60 days and lists its real website. This can be an authorized client's profile. This eligibility
   requirement can block API access even when an OAuth client already exists.
3. Submit the [Business Profile API access request](https://support.google.com/business/contact/api_default)
   using the project number and an owner/manager email. API project approval and OAuth verification
   are separate steps. Check the quota after review; zero quota is not usable API access.
4. Enable the APIs used by this implementation: Account Management, Business Information, Google My
   Business for reviews/posts, and Business Profile Performance, alongside Google's required API setup.
5. Configure Google Auth Platform branding, audience and data access; create a Web application OAuth
   client. Request `https://www.googleapis.com/auth/business.manage`. Register exactly
   `<INTEGRATIONS_PUBLIC_ORIGIN>/integrations/google/callback`. Add pilot test users while testing;
   complete the verification/publication required before external production onboarding.
6. Store `GOOGLE_BUSINESS_CLIENT_ID` and `GOOGLE_BUSINESS_CLIENT_SECRET` only on the server, with a
   persistent `INTEGRATIONS_ENCRYPTION_KEY` and the chosen `INTEGRATIONS_PUBLIC_ORIGIN`.
7. The clinic owner/manager uses dashboard Connect Google, consents and selects its listing. Verify
   actual listing, reviews and available performance readbacks before calling the integration live.

Use an approved HTTPS pilot origin for external callbacks. Localhost-only HTTP cannot receive Meta's
public webhook or satisfy its Embedded Signup HTTPS requirement. Register exact callback URLs rather
than guessing the final company/clinic domain.

Official references: [prerequisites](https://developers.google.com/my-business/content/prereqs),
[basic setup](https://developers.google.com/my-business/content/basic-setup),
[OAuth](https://developers.google.com/my-business/content/implement-oauth),
[authorized listing access](https://developers.google.com/my-business/content/faq).

## What information authorization provides

- Meta setup here is for WhatsApp business assets: the authorized WABA/phone, templates, new supported
  message events and delivery statuses. It does not grant general access to people's Facebook,
  Instagram or WhatsApp accounts. Historical chat/contact import is not implemented in this release.
- Google setup here is for the clinic's authorized Business Profile: listing details, reviews/posts and
  supported aggregate performance. It does not provide patient medical records or the identities of
  everyone who searches the clinic. Ordinary Google sign-in is not Business Profile API approval.
- Website activity is the separate Umami integration. Search Console, Google Ads, Gmail and GA4 are
  separate products/scopes and are not connected by this Business Profile OAuth flow.

## Ordered next work and ownership

| Priority | Work | Owner / dependency | Done when |
| --- | --- | --- | --- |
| P0 | Keep local stack and dependencies reproducible | Engineering | Locked install, runtime and scoped automated checks pass |
| P0 | Select a real HTTPS pilot/dashboard origin | Company owner + engineering | DNS/TLS and exact callbacks resolve to the intended runtime |
| P0 | Finish Meta business/app review and Google API access | Company account owner; engineering supplies reviewer flows | Provider account evidence confirms eligibility/permissions |
| P0 | Configure private runtime secrets and booking authority | Engineering after account/domain setup | `corepack pnpm integrations:check` passes required configuration checks |
| P0 | Connect one consenting clinic and execute provider acceptance | Clinic owner + engineering | Persisted Meta delivery, Google readback, tracker visit and booking evidence |
| P1 | Close implementation gaps | Engineering + product scope | Loyalty server persistence; supported Google photo/review-request functionality or explicit exclusion |
| P1 | Voice/video acceptance and production release | Provider accounts + engineering + clinic | Real calls, retention/consent behavior, OIDC and deployed smoke acceptance |

This is an ordered work list, not an unattended monitor. No provider configuration or public business
information was changed, and no credentials were requested in chat.

## Restart the local stack

Keep the existing database; do not run `db:reset` on it. Start PostgreSQL from its existing owner root:

```sh
cd /Users/deepakonda/.codex/worktrees/hms-dashboard-integrations/HMS_NEW
PG_PORT=54339 node db/scripts/local-pg.mjs start
```

Use separate terminals for API and worker in the active inner app root:

```sh
cd /Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW
PG_PORT=54339 PORT=3080 WA_MANAGED_SENDING_ENABLED=false corepack pnpm api:dev
```

```sh
cd /Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW
PG_PORT=54339 WA_MANAGED_SENDING_ENABLED=false corepack pnpm worker:dev
```

Vite:

```sh
cd /Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW/apps/staff-web
HMS_API_PROXY_TARGET=http://127.0.0.1:3080 VITE_HMS_DEV_LOGIN=true VITE_HMS_DEV_SUBJECT=priya corepack pnpm dev --host 127.0.0.1 --port 5198
```

Operator-only readiness check (expected exit 2 until configured):

```sh
cd /Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW/HMS_NEW
PG_PORT=54339 corepack pnpm integrations:check
```

Test suite setup recreates only the configured local test database. Never point tests at a customer database.

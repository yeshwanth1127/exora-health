# Paperwhale Health Meta setup — 24 October 2026

## Current result

### Hosting correction and test-sender attempt — 25 October 2026

The user explicitly clarified that Paperwhale has its own VPS and is unrelated to the Paperwhale
deployment. **Use only `root@201.18.196.230` (`srv2086263`) for Paperwhale hosting.** Live SSH
confirms the healthy `paperwhale-website-web-1` and Caddy `paperwhale-website-edge-1` containers.
The website release is `5dc30b0f16957c871b1f5a72d54382a72eca31c1`, under
`/opt/paperwhale-site/releases/`, with `/opt/paperwhale-site/current` pointing to it.
The release contains only the marketing deployment subset, not the HMS API/database/identity stack.
The VPS has approximately 8 GB RAM and 87 GB free disk. Both app.paperwhale.health and
auth.paperwhale.health resolve to this VPS; DNS resolution alone is not a deployed service.

The earlier Paperwhale inspection was read-only: no tenant, deployment or server configuration was
changed. Its hosted production identity and booking checks are evidence about Paperwhale only and
must not be attributed to Paperwhale. Do not copy Paperwhale's credentials, tenants or clinical data.

The user approved the WhatsApp Business Platform and Cloud API terms and test-credential
generation. Meta's **Claim test number** failed twice, including after a reload, with
"An error occurred while creating the test account. Please try again." No test sender/token
was created; the requested Indian test recipient has not been added or verified. No message
was sent. Preserve this approval for the same retry and scope.

Meta's Publish screen explicitly lists privacy policy, business verification and access
verification; Publish is disabled. The production webhook screen states unpublished apps
receive dashboard-generated test webhooks only. Business verification is now eligible after
Tech Provider onboarding, but no legal information or verification documents were submitted.

The public Paperwhale homepage and /privacy are reachable. Browser inspection confirms /privacy
covers marketing website analytics/setup only and explicitly excludes provisioned clinic data.
It cannot be represented as the completed integration-app policy. /data-deletion returns 404.

Local-only progress: created a mode-0600 gitignored `.env` with encrypted storage, a signed
loopback booking site binding and a dedicated facility-scoped system booking identity. API and
worker restarted with it. secureConnections, whatsappBooking and bookingIdentity now pass;
sending remains disabled. Public bootstrap/catalogue return 200, the catalogue has two
published doctors, and an unapproved origin returns 403. The three targeted integration suites
pass: 36 tests. These changes have not been deployed to Paperwhale's VPS.

### Update — 25 October 2026

Live browser inspection confirms the user created both resources:

- **Paperwhale Health** portfolio: `2362243331179547`.
- **Paperwhale Health** app: `1680242293467371` (unpublished).
- Contact: hello@paperwhale.health. WhatsApp use case is present.

The Independent Tech Provider option is selected in the onboarding modal. The next button,
**Start onboarding**, explicitly accepts Meta's Tech Provider Terms. Specific approval was
requested; it has not been clicked. No permission review or business verification submission
has been observed. The generic Security Center message that the organisation does not need
verification is not evidence of Tech Provider verification or Advanced Access approval.

Local runtime was restarted on 25 October: API 3080, staff dashboard 5198 and worker,
using the existing synthetic database on 54339. API `/ready` returns ready. Browser login
as the seeded development administrator succeeds; WhatsApp displays its connection wizard,
the provider-preparation notice and disabled Continue with Facebook button. The operator
integration checker still returns exit 2, `ready=false`: secure connection settings and
Meta signup credentials are absent. Sending remains explicitly disabled. No clinic number,
consent or message delivery has been tested.

Pending operator setup after onboarding: Embedded Signup configuration ID, app credentials,
encrypted credential storage, public HTTPS origin and verified webhook. Do not enter a dummy
configuration ID or represent the local API readiness response as Meta connectivity.

The prior account-age blocker below is historical; portfolio existence now supersedes it.

### Original observation — 24 October 2026

The new Sachin Mittapally Facebook account is signed in and developer enrollment is complete.
The new account's developer Apps page showed no apps.

The new app wizard was prepared with:

- App name: Paperwhale Health.
- App contact: hello@paperwhale.health.
- Use case: Connect with customers through WhatsApp.
- Intended new portfolio: Paperwhale Health.
- Portfolio owner/contact: Sachin Mittapally, hello@paperwhale.health.
- Official company domain selected by the user: paperwhale.health (replaces paperwhale.tech).

The user approved portfolio creation and its displayed policy/full-control consequence. The actual
Create portfolio attempt failed with Meta's response:

> Facebook Account Too New To Create A Business
>
> Your Facebook account is too new to create a business account. Try again in an hour.

The error was observed around 21:27 IST on 24 October 2026. Retry after approximately 22:30 IST,
subject to Meta lifting the restriction. This is not an automatic retry or reminder.

**Not created:** new business portfolio, new developer app, app ID, signup configuration, WABA or phone.
**Not submitted:** business verification, permission review or live-mode publication.
**Not performed:** any live message, phone migration or change to the existing Hospital-WA-booking app.

Chrome unexpectedly restarted during setup. Restoring the browser lost the first unsaved draft;
the same details were re-entered before the rejected creation attempt. Do not assume draft fields
will survive another restart. Inspect the Apps/portfolio lists before retrying to avoid duplicates.

## Resume sequence

1. Reuse the existing Paperwhale app and portfolio above; do not create duplicates.
2. Resume Independent Tech Provider onboarding after approval of its displayed terms.
3. Ask at the final action if a new legal agreement or security-sensitive credential/access step
   requires confirmation. Previously approved identical actions need no repeat confirmation.
4. Complete the actual app settings: company domain, verified contact, app icon, public privacy policy,
   deletion instructions and support information. Confirm the website/pages actually exist before using them.
5. Open WhatsApp Tech Provider onboarding. Complete business verification using the company's real legal
   details and accepted documents. Do not reuse the example Avocado hospital identity/address as legal proof.
6. Prepare Advanced Access review for `whatsapp_business_management` (clinic onboarding/assets/templates)
   and `whatsapp_business_messaging` (clinic messaging). Request additional permissions only if the selected
   documented flow requires them.
7. Configure Embedded Signup v4 with the real HTTPS application origin and matching callback/webhook
   setup. Keep secrets private and preserve the existing bot's shared webhook/phone.
8. Produce genuine reviewer evidence of test-message sending/receipt and template creation, with review
   credentials/instructions. Submit only after Meta's requirements are satisfied.
9. Verify real clinic consent, subscription readback and permitted message delivery before enabling live
   dashboard sending. New app creation or submitted review is not live-provider acceptance.

Official references:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/

The connected Meta MCP tool was previously authorized for the old Hospital-WA-booking app/account;
do not assume it automatically has access to this new Facebook account or the future Paperwhale app.

# Paperwhale Apple Messages account setup

Checked 24 October 2026. Local source branch: `codex/apple-messages-foundation`.

## Business and account state

- The owner selected the **HMS software company**, with website
  `https://paperwhale.health/`, rather than an operating clinic.
- The website is user-supplied; the research browser could not retrieve its public
  page or independently verify the business/contact details.
- Safari is signed into Apple Business Register. The owner accepted the service
  terms. Messages for Business was added to the organization's connections.
- A new application was started and is at **Messages for Business Policies**.
  Its five declarations remain unchecked and Next is disabled. There is no submitted
  Messages account, Apple business ID, linked MSP or approved tester invitation.
- A corporate contact email has not been supplied. No email address was invented.
  Apple’s [registration guide](https://register.apple.com/resources/messages/messaging-documentation/register-your-acct)
  calls for a corporate-email Apple Account and technical contact information.
- No AWS CLI/profile/configured credentials were found on this Mac. No AWS resources
  were deployed or paid services provisioned.

## Eligibility requires clarification

[Apple's current channel policies](https://register.apple.com/resources/messages/messaging-documentation/policies)
(version 3.1, updated 21 July 2026) say Apple is not onboarding businesses that
primarily offer medical or health-related services or products. Registering the
software company accurately does not establish approval for the proposed clinic
booking use case. No exemption for an internal synthetic medical-booking demo was
established in the reviewed documentation.

The [deployment guide](../../infra/apple-connect/README.md#eligibility-blocker-found-during-registration)
contains a ready-to-send clarification request for Apple/the selected MSP. It has
**not been sent**. Keep the actual intended use case visible when seeking guidance;
do not represent the demo clinic as an approved brand or hide its medical purpose.

## Executed tests

Fresh run on the current implementation:

- **52/52** focused backend/database/transport tests passed (7 files): Apple booking,
  AWS bootstrap and SDK request mapping, Apple/generic onboarding, public booking
  and database conventions. Restricted database roles exercise permission checks.
- **245/245** staff-dashboard tests passed.
- Actual local HTTP acceptance passed: API readiness; authenticated owner inbox;
  persisted appointment confirmation; reception reply queueing and human takeover;
  identical retry returning one receipt/message; unauthenticated access rejected
  with 401; mismatched clinic access rejected with 404. Provider credentials are
  absent from the inbox response. Queued replies remain queued in this local demo.
- The private local HTTP evidence is saved in the ignored
  `.apple-demo/local-http-acceptance.json` file. No Apple/AWS calls are part of it.
- The earlier full API/database run had **533 passes and 2 failures**. Both failures
  were independently reproduced on unchanged main `2c773da`: September payroll
  expectations and pre-existing voice-route coverage. It is not an all-green suite.
- API/dashboard TypeScript and dashboard production build passed in the preceding
  implementation verification. Full Arc appearance, keyboard/focus and motion
  parity remain unverified; the final browser reopen was blocked by URL policy.

**Unverified:** cloud IAM/template validation; live Connect participant creation;
Apple eligibility/approval; account linking; real message lifecycle and deletion
events; delivery/read receipts; physical iPhone booking and receptionist replies.

## Exact remaining steps

1. Supply the corporate contact email and confirm the business details used for
   Paperwhale's application. Review the policy declarations against the actual
   planned operation; the generic setup request is not acceptance of these specific
   declarations.
2. Obtain Apple/MSP eligibility guidance for the disclosed software-company internal
   clinic-booking test and any later production clinic rollout.
3. Create/login to the company AWS account and complete billing/verification.
4. When eligible, complete the internal test account, deploy the prepared bridge,
   configure Connect's chat flow and link the Apple account to Amazon Connect.
5. Add the iPhone's Apple Account as a tester and complete the physical-device
   acceptance run in the deployment guide. Observe actual provider results.

The local English/plain-text pilot remains available at
<http://127.0.0.1:5209/staff/apple_messages>. Native Apple pickers/Quick Replies,
support-hours enforcement and the other deferred experience features are not
production-ready claims. Company credentials stay outside the clinic dashboard.

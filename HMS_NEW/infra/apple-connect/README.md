# Apple Messages demo with Amazon Connect

The user selected Amazon Connect on 24 October 2026. AWS and Apple Business Register
accounts do not exist yet, so cloud deployment and a real iPhone test are pending.
The local build does not simulate Apple approval or external message delivery.

## Run the local clinic now

From the `HMS_NEW` application root:

```sh
PG_PORT=54349 corepack pnpm pg:start
PG_PORT=54349 corepack pnpm apple:demo prepare
PG_PORT=54349 corepack pnpm apple:demo smoke
corepack pnpm apple:dashboard
```

Dashboard: <http://127.0.0.1:5209/staff/apple_messages>.
The launcher starts an API on 3089 and a dashboard on 5209, bound to loopback.
It signs into the synthetic demo owner automatically. Existing dashboards are untouched.
The separate `hms_apple_demo` database contains a synthetic clinic, Dr Demo, New York
time zone, a USD 125 consultation, daily schedules and a dedicated booking identity.
The demo's state/env files are private and ignored under `.apple-demo/`.

`smoke` runs the consent → doctor → slot → name → contact → confirmation sequence.
It commits a real **local database** appointment. It makes no AWS/Apple API call.
Messages remain queued rather than acquiring a fabricated provider acknowledgement.
To continue the current local conversation, for example:

```sh
PG_PORT=54349 corepack pnpm apple:demo send AGENT
```

Reception can then reply in the dashboard. A local demo reply remains queued.
The actual cloud worker refuses demo-only bindings, including in production config.

## Account steps the owner must complete

1. Create the company [AWS account](https://aws.amazon.com/), complete billing and
   verification, and arrange a company-administered local AWS login. Use a dedicated
   Connect demo instance in `us-east-1`, which [supports Apple messaging](https://docs.aws.amazon.com/connect/latest/adminguide/regions.html).
   No telephone number purchase is required for this chat-only proof.
2. Create the organization/account in [Apple Business Register](https://register.apple.com/).
   Use a **Messages for Business internal test account** for the demo where the
   portal permits it. Represent the actual company truthfully; the synthetic doctor
   and local clinic are not evidence of a licensed real clinic or verified brand.
3. Select Amazon Connect / Connect Customer as the Messaging Service Provider.
   The documented provider URL is `https://messagingintegrations.connect.amazonaws.com/applebusinesschat`.
   Follow [AWS's Apple onboarding](https://docs.aws.amazon.com/connect/latest/adminguide/apple-messages-for-business.html)
   for account linking, readiness/use-case documents and any required support request.
   Company secrets belong in the approved provider/account tools, not chat or HMS forms.
4. Add the Apple Account used on the iPhone to **Account Testing** and send the test
   invitation when the account is ready. [AWS's test guide](https://docs.aws.amazon.com/connect/latest/adminguide/send-test-message.html)
   describes the tester email link and readiness checks. Non-allowlisted users cannot
   use the test link. Portal review or provider linking may still be required for testing.

These steps are not replaced by an Xcode simulator, TestFlight or the local webpage.
Registration, account linking and public commercial approval are separate states.

## Deploy the prepared AWS bridge after login

Generate the template without provisioning anything:

```sh
node infra/apple-connect/template.mjs > .apple-demo/cloudformation.json
```

Deploy it in the same Region as the Connect instance, supplying `ConnectInstanceArn`.
It creates a restricted Lambda integration, private SNS topic, encrypted SQS inbox
and dead-letter queue, and an encrypted DynamoDB session table with TTL. It also
outputs a narrowly scoped worker policy. IAM creation and service usage incur the
normal AWS account/plan obligations. The template is locally checked; it has not
been validated or deployed by AWS in this run.

Lambda's bundled Node.js runtime provides its AWS SDK modules. Before production,
bundle/pin those dependencies rather than depending on runtime SDK versions.

Create a dedicated Connect inbound **chat** flow using the documented
[custom-participant flow](https://docs.aws.amazon.com/connect/latest/adminguide/chat-customize-flow.html):

1. Play prompt, then invoke the generated Bootstrap Lambda, using its ARN from stack
   outputs. A prompt must precede Lambda when it would otherwise be the first block.
2. Continue to a Wait block for `CUSTOM_BOT`, with an explicit finite timeout.
3. Wire timeout/error paths to clear assistance/closure rather than claiming booking
   success. Disconnect the participant on the ending path as documented by AWS.
4. Keep Lex and Connect agent participants out of this pilot flow. A human replies
   through HMS using the existing custom participant; an AWS agent joining disconnects
   that bot, and the application conservatively closes that transport session.

The Lambda reads the AWS **system** subtype using DescribeContact and refuses
anything other than `connect:Apple`. User-defined attributes cannot turn web chat
into an Apple booking. It creates/connects the bot promptly, stores its credentials
privately in DynamoDB and wakes the local worker. The bootstrap is retry-safe and
does not log transcripts or tokens.

Use stack outputs to configure one server-owned real clinic binding:

```json
{
  "tenantId": "the demo tenant UUID",
  "facilityId": "the demo facility UUID",
  "instanceArn": "stack InstanceArn output",
  "topicArn": "stack TopicArn output",
  "queueUrl": "stack QueueUrl output",
  "sessionTable": "stack SessionTable output"
}
```

This is a shape example, not a usable configuration. Set
`APPLE_CONNECT_ENABLED=true` and `APPLE_CONNECT_BINDINGS_JSON` to an array of real
bindings in the API/worker's private environment; retain the demo's public-booking
site binding/signing secret. Remove `localDemo` for the real transport. A pending
local demo session cannot be promoted into a real Apple session: new real contacts
have their own Connect identifiers.

Attach the stack's WorkerPolicy to the company worker identity and sign in locally
using the AWS default credential chain/profile. Never use root credentials. Start:

```sh
corepack pnpm apple:worker
```

The worker uses IAM-authenticated SQS/DynamoDB and outbound HTTPS. No public tunnel
to the Mac is needed. SNS source, AWS account, instance and stored Apple subtype are
checked before any transcript is processed. AWS transcript reconciliation handles
duplicate or out-of-order notifications. Stable reply ClientTokens are reused when
a response is lost. Acknowledgement is labelled **accepted**, not delivered/read.
The application currently caps automatic transcript reconciliation at 500 entries.

## iPhone acceptance run

Use only synthetic contact details and appointment data for this demo:

1. On the allowlisted iPhone, open Apple's invitation link and send HI in Messages.
2. Reply YES, choose Dr Demo and an actual free time, provide a synthetic name and
   contact, then inspect the review message and reply CONFIRM.
3. Verify the returned reference matches exactly one appointment in HMS, with Apple
   origin, USD 125, New York local time and an unverified booking contact.
4. Replay a queued notification and verify no second appointment or reply appears.
5. Reply AGENT; verify automation pauses, reception sees the thread and a dashboard
   reply arrives on the same iPhone.
6. Test STOP, closing/deleting the thread, expired times, another booking taking the
   slot, lost network responses, unavailable support and a revoked staff permission.
7. Observe real provider receipts before claiming delivery/read. Confirm how this
   AWS/Apple setup reports thread deletion and contact lifecycle; local event fixtures
   alone do not establish those real-device semantics.

The pilot currently uses plain-text numbered booking choices. Native Apple time/list
pickers, Spanish dialogue, rescheduling/cancellation automation and proactive reminders
are not implemented. Saved support-hours and after-hours preferences are not yet
enforced by the pilot dialogue. Only the first ten published doctors are offered.
Reception handles changes. Collecting English/Spanish setup
preferences does not establish Spanish automation. Review provider experience rules
before public launch and confirm applicable healthcare contractual requirements before
introducing real patient information.

Operational cleanup: stop the local worker when done; inspect the DLQ for failed
events; delete demo AWS resources when no longer needed. The session table has a
Retain policy to prevent accidental credential/data loss and requires deliberate
cleanup. DynamoDB TTL expiry is asynchronous, not a promise of immediate deletion.

## Executed verification — 24 October 2026

- Full API/database suite: **533 passed, 2 failed (535 total)**. Both failures were
  reproduced independently against unchanged main `2c773da` in a temporary checkout:
  September payroll paid-day expectations (`hr.test.ts`), and missing existing voice
  agent-settings/request routes (`coverage.test.ts`). This is not an all-green suite.
- The Apple booking, bootstrap, SDK adapter, onboarding, public-booking and database
  convention tests passed. They exercise restricted PostgreSQL, permissions, clinic
  isolation, duplicate input, last-slot contention, explicit confirmation, unverified
  US contacts/USD, human handoff, STOP during handoff, revoked staff permissions and
  retry-safe reply intents. AWS SDK calls use controlled test responses, not live AWS.
- Dashboard: **245 tests passed**; API and dashboard TypeScript checks passed;
  dashboard production build passed (existing bundle-size warning remains).
- Local smoke created appointment reference **WB4AL3TT** in `hms_apple_demo` at
  USD 125. The local dashboard returned HTTP 200; API `/ready` returned ready.
  No Apple/AWS delivery was asserted. Earlier targeted local browser interaction
  queued a reception reply; no real messaging provider accepted it.
- The template generator produced 12 resource definitions. No AWS validation,
  provisioning, billing change or Apple account registration was performed.
- The final browser reopen was blocked by the browser URL policy. Full matching-size
  Arc appearance, keyboard/focus and motion parity remain unverified/user review.

AWS account creation/login, Apple registration/linking and an allowlisted physical
iPhone acceptance run are still required. A green local check does not substitute
for them. The conversation inbox is usable locally; a complete self-service Apple
setup form and the deferred pilot experience features are not claimed complete.

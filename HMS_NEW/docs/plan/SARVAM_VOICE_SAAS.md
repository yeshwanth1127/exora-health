# Exora Health managed Sarvam voice platform

Status: implementation blueprint
Scope: configurable Sarvam agents, tenant-specific HMS backends, website voice, inbound telephony,
unanswered-call forwarding, tenant administration and Exora superadmin operations.

## 1. Product outcome

Exora is the management wrapper and source of truth for every tenant's Sarvam voice agent. A clinic
administrator configures the assistant from the Exora Voice screen. Publishing those settings must
change the actual Sarvam draft, create an immutable Sarvam version, test it, and move the tenant's
browser and telephone deployments onto that version. The clinic never needs to open Sarvam.

Every Voice-enabled tenant receives:

- its own isolated HMS backend and database;
- one separate Sarvam agent;
- one separate HMS Voice service identity and credential;
- a website voice assistant connected only to that tenant backend;
- zero or more inbound phone deployments;
- a dedicated overflow number per tenant or facility when call forwarding is used;
- tenant-scoped calls, transcripts, recordings and appointment outcomes;
- versioned configuration, safe publishing and rollback.

The existing hospital number remains public. Where supported, the clinic configures conditional
forwarding so calls that are busy, unanswered or unreachable continue to its dedicated Sarvam number
and tenant agent.

## 2. Non-negotiable tenant boundary

Each generated Sarvam agent is permanently bound to exactly one tenant runtime:

```text
Tenant A Sarvam agent ── credential A ──> https://a.example.com/api/v1/integrations/voice
Tenant B Sarvam agent ── credential B ──> https://b.example.com/api/v1/integrations/voice
Tenant C Sarvam agent ── credential C ──> https://c.example.com/api/v1/integrations/voice
```

Rules:

1. Every tool URL in an agent uses that tenant's own public backend origin.
2. Every tenant gets a unique high-entropy tool credential and signing secret.
3. The tenant backend fixes `PUBLIC_TENANT_ID` at container startup. Sarvam never submits a tenant id.
4. The Voice service account exists only in that tenant database and has only the permissions needed
   for directory, scheduling and booking operations.
5. The control plane provisions and monitors agents but never serves hospital facts to a voice call.
6. Doctors, branches, schedules, availability and appointments are read from the bound tenant backend
   at call time.
7. Credentials, tool URLs, callback deployment ids and agent ids are checked as one binding. A
   mismatch fails closed.
8. Rotating or disabling Tenant A cannot affect Tenant B.

This remains true even though all agents are managed from the same Exora Sarvam organization or
workspace. Provider workspace membership is not the clinical-data boundary; the per-agent backend
origin, credential, fixed runtime tenant id and separate tenant database are the boundary.

## 3. Core decisions

1. Exora is authoritative for desired configuration. Sarvam is authoritative for runtime ids and
   interactions.
2. Use one Sarvam agent per tenant, never a shared multi-tenant agent.
3. Use a dedicated inbound/overflow number per tenant. Use one per facility when a call must resolve
   to a facility without asking the caller.
4. Keep changing hospital data out of prompts and knowledge bases; fetch it through live HMS tools.
5. Treat a Sarvam draft as mutable preparation and a committed version as an immutable release.
6. Existing calls stay on their starting version; new calls use the promoted version.
7. A shared Exora phone number is not the default. Forwarding networks do not reliably preserve the
   originally dialled number, and one phone number routes to one inbound deployment at a time.
8. Use Sarvam APIs/service authentication for unattended production automation. MCP is for
   development and supervised operations, not an approval-dependent background worker.
9. Store credentials in a secret manager and persist only opaque references.

## 4. Existing foundation

### Tenant HMS tool API

Each tenant already exposes these authenticated routes beneath `/api/v1/integrations/voice`:

| Method and route | Purpose |
|---|---|
| `GET /branches` | List this tenant's branches |
| `GET /doctors` | Search this tenant's doctors |
| `GET /availability` | Read live in-person or virtual slots |
| `GET /schedules` | Read published doctor sessions |
| `POST /slot-holds` | Hold an exact slot for seven minutes |
| `DELETE /slot-holds/:id` | Release a signed hold |
| `POST /appointments` | Confirm a held appointment |
| `GET /appointments` | Lookup by phone and confirmation code |
| `POST /appointments/:id/cancel` | Verify and cancel |
| `POST /appointments/:id/reschedule` | Verify and reschedule with a new hold |

The tenant is fixed by the container. Holds are signed and write operations are idempotent.

### Browser calling

The website creates a short Exora session after explicit consent. The tenant backend proxies only the
Sarvam signed-WebSocket-URL request. The Sarvam API key never reaches the browser, and the SDK is
pinned to the active committed agent version.

### Call history

The HMS has facility-scoped call history, transcript revisions, recording permissions, consent and
audit logging. Its callback boundary must gain a Sarvam webhook adapter instead of assuming Sarvam
sends Exora's internal event shape.

### Current gap

`voice-manifest` only generates a specification and `voice-binding` only records ids. Nothing applies
the manifest to Sarvam. Tenant setup ends in `requested`; there is no provisioning worker, publish
action, reconciliation or automatic rollback.

## 5. Target architecture

```text
Tenant Voice UI                    Exora superadmin UI
       |                                   |
       +------------ Control API ----------+
                           |
                  desired configuration
                           |
                    outbox / job queue
                           |
                 Voice Provisioning Worker
                  |         |          |
          Config compiler  Sarvam     Secret manager
                  |       provider         |
                  +---------+--------------+
                            |
                 committed agent version
                    /                 \
          browser voice          inbound deployments
               |                       |
        tenant website       provider / overflow number
               \                       /
             that tenant's HMS Voice tool API
                            |
           that tenant's database, doctors and bookings
```

The control plane owns desired and observed state. Tenant containers remain the execution and
clinical-data plane. Only the provisioning worker may mutate Sarvam.

## 6. Control-plane model

Replace the single binding row with explicit resources.

### `control.voice_agent`

- customer id and provider;
- provider organization, workspace and agent ids;
- template id;
- tenant API origin and opaque service-secret reference;
- desired and active Exora revisions;
- active and previous Sarvam versions;
- lifecycle state, last error and reconciliation timestamp.

### `control.voice_configuration_revision`

- immutable revision number and normalized tenant settings;
- compiled provider configuration hash;
- author and audit correlation id;
- state: `draft`, `validating`, `ready`, `publishing`, `active`, `failed`, `superseded`;
- committed Sarvam version;
- validation and evaluation results.

### `control.voice_endpoint`

One browser row and one row per inbound facility/number:

- tenant and optional facility;
- type: `browser`, `managed_number`, `existing_provider`, `forwarding_destination`;
- provider connection, phone number and deployment ids;
- active agent version;
- inbound hours/timezone and webhook metadata;
- health and lifecycle state.

### `control.voice_provider_connection`

- tenant and provider type;
- Sarvam connection id;
- secret reference;
- verification and health state.

### `control.voice_provisioning_operation`

- tenant, revision, operation and idempotency key;
- stage, attempts and next retry time;
- provider request ids;
- redacted result/error and timestamps.

### `control.voice_forwarding_verification`

- endpoint and existing clinic number;
- no-answer/busy/unavailable choices and ring duration;
- test interaction ids and per-condition results;
- verifier and verified timestamp.

Tenant environment variables and callback registries become generated deployment configuration, not
independent sources of truth.

## 7. Configurable versus protected settings

### Tenant-configurable

- assistant name, hospital pronunciation and greeting;
- enabled/default languages, voice, speed and tone;
- interruption, silence and maximum-duration behaviour;
- hours and timezone;
- appointment types and permitted booking actions;
- human-transfer number and rules;
- after-hours, busy and failure behaviour;
- consent wording subject to Exora policy;
- number strategy and forwarding conditions.

### Exora-protected

- tenant/facility binding and backend origin;
- tool URLs, schemas and credentials;
- webhook URLs and signing configuration;
- idempotency and hold rules;
- safety and emergency constraints;
- audit, consent and retention enforcement;
- instructions prohibiting invented doctors, times or confirmation codes.

Tenants edit typed controls, never raw Sarvam JSON or an unrestricted system prompt.

## 8. Configuration compiler

The compiler converts a complete Exora revision into a complete Sarvam desired configuration:

1. Start from a versioned Exora base template.
2. Render branding, greeting, language and permitted behaviour.
3. Add trusted facility/timezone variables.
4. Generate all tool definitions using only the bound tenant backend origin.
5. Reference the masked tenant credential stored in Sarvam Secrets.
6. Add interaction id to write-tool idempotency where supported.
7. Add lifecycle hooks where available.
8. Validate against Sarvam's schema.
9. Produce a deterministic hash for drift detection.

Sarvam merges nested objects but replaces lists. The provider client must fetch the current draft,
merge protected sections, and send complete tool/language/state lists. Partial list updates are
prohibited.

## 9. Initial provisioning

1. Validate plan entitlement, HTTPS tenant URL, runtime health and facilities.
2. Verify at least one bookable published schedule before advertising booking.
3. Create the tenant Voice service account, credential and signing secret.
4. Store secrets in the production secret manager.
5. Clone the reviewed Exora template or create an agent.
6. Bind the agent immediately to that tenant's backend origin and secret references.
7. Compile revision 1 and configure the real Sarvam draft.
8. Create/reconcile tools and Sarvam secrets.
9. Test calls to the expected tenant and assert returned facility ids belong to it.
10. Commit immutable Sarvam version 1.
11. Run the Exora Voice regression suite.
12. Create the browser endpoint.
13. Provision the chosen telephone path.
14. Configure a signed completion webhook.
15. Run browser, telephone and cross-tenant-negative tests.
16. Mark active only after all required checks pass.

Every stage uses stable idempotency keys and discovers existing Sarvam resources before creation.

## 10. Updating the actual Sarvam agent

The tenant sees **Save draft** and **Publish changes**.

### Save draft

- validate and store an Exora revision;
- show a before/after summary;
- do not change Sarvam or live calls.

### Publish changes

1. Take a per-agent distributed lock.
2. Confirm the revision is still current.
3. Read the Sarvam draft and deployments.
4. Compile and apply the complete draft.
5. Re-read it and verify its hash and protected tenant backend binding.
6. Test read tools, then a safe hold/release flow.
7. Commit a new immutable Sarvam version.
8. Recreate evaluation variable mappings for that version.
9. Run branch/doctor lookup, availability, booking, verification, safety, failure and language tests.
10. Patch every tenant deployment to the committed `app_version` only if tests pass.
11. Update the browser active-version binding.
12. Run a post-promotion health check and mark active.

Pre-promotion failures leave the old deployment untouched. A post-promotion failure patches every
endpoint back to `previous_provider_version`. Existing calls remain pinned to their starting version.

## 11. Sarvam provider adapter

Implement a typed server-only adapter:

```text
get/create/clone agent
get/configure/validate draft
list/upsert/delete HTTP tool
upsert/rotate secret
commit/list version
create mapping, run/read evaluation
list/create/verify provider connection
list/import/rent number
create/get/update/pause/resume deployment
get interaction/transcript
```

It requires deadlines, bounded retries, exponential backoff, redacted logs, correlation ids,
per-tenant locks, idempotent discovery, rate-limit handling and provider circuit breaking.

Use an interface so MCP can act as a supervised development adapter while production uses Sarvam's
supported API/service-auth surface. Confirm production authoring API access before implementation;
never automate the Sarvam web console.

## 12. Telephone strategies

### A. Existing number with unanswered-call forwarding

Default for an ordinary mobile, landline or PBX:

```text
patient -> clinic public number -> reception rings
        -> busy / no answer / unavailable / after hours
        -> dedicated tenant/facility Sarvam number
        -> tenant Sarvam agent -> tenant HMS backend
```

Steps:

1. Allocate or import a dedicated Sarvam-compatible destination number.
2. Create its inbound deployment for the tenant agent's active version.
3. Capture existing number, carrier/provider and forwarding conditions.
4. Show provider-specific forwarding instructions. The tenant/carrier performs ordinary carrier
   forwarding; Exora must not assume universal USSD codes.
5. Store ring duration, normally 15-25 seconds.
6. Test busy, no-answer and unavailable independently.
7. Assert each call reached the expected tenant/facility deployment and backend.
8. Mark verified and periodically recheck.

The human-transfer target must be another number, extension or SIP destination. Transferring to the
same public number that forwards to Sarvam would create a loop. The UI must disclose forwarding
charges and provider-dependent caller-id, DTMF, transfer and recording behaviour.

### B. Existing programmable provider number

Supported provider options currently include Exotel, Twilio, Smartflo, Pulse, Intalk, Vobiz and
Plivo, subject to the Sarvam plan.

1. Collect provider credentials through masked write-only fields into the vault.
2. Create a tenant-specific Sarvam provider connection.
3. List and import only the selected number.
4. Show any required provider-console routing instructions.
5. Create an inbound deployment with connection id, number, agent id, active version, schedule and
   completion webhook.
6. Place a verified test call.

For Exotel, the tenant creates an App Bazaar flow with Sarvam's Voicebot endpoint and assigns it to
the Exophone. Other providers use their documented webhook/media-stream setup.

### C. New managed number

1. Show region, availability and recurring cost before purchase.
2. Require authorized approval of the billable action.
3. Rent through Sarvam or an approved Exora telephony account.
4. Record ownership and renewal metadata.
5. Create the inbound deployment and verify it.
6. Alert before low credit or renewal failure can release it.

### Shared number policy

Never route unrelated tenants through one shared Sarvam number unless Exora first owns a verified
telephony router that receives trusted original-destination metadata and selects the tenant before
Sarvam. Caller speech, caller id and unverified forwarding headers are not routing boundaries.

## 13. Webhook ingestion

Each deployment gets an Exora completion webhook with an opaque endpoint reference. The adapter:

1. authenticates provider and rejects replay;
2. locates endpoint by deployment id and signed metadata;
3. verifies tenant, agent and version;
4. transforms Sarvam payload into internal Voice events;
5. upserts by interaction id;
6. stores transcript revisions and final variables;
7. links only appointments created by the bound Voice service account;
8. applies consent/retention before exposing recordings;
9. emits usage and outcome events.

Unknown or crossed deployment/version combinations are quarantined, never guessed.

## 14. APIs to add

### Tenant staff API

- `GET /v1/voice/settings`
- `PUT /v1/voice/settings/draft`
- `POST /v1/voice/settings/publish`
- `GET /v1/voice/releases`
- `POST /v1/voice/releases/:revision/rollback`
- `GET /v1/voice/readiness`
- `POST /v1/voice/tests/browser-session`
- `POST /v1/voice/tests/phone-call`
- `GET /v1/voice/endpoints`
- `PUT /v1/voice/endpoints/:id/forwarding`
- `POST /v1/voice/endpoints/:id/verify-forwarding`
- existing call-history/transcript/recording routes

Tenant APIs submit desired state; they never call Sarvam directly.

### Superadmin API

- list all Voice tenants and lifecycle states;
- read desired/observed state and drift;
- retry/cancel operation and force reconciliation;
- pause/resume endpoint and rotate credentials;
- attach/detach/import number;
- publish/rollback with audit reason;
- inspect redacted provider operations and tests.

### Internal outbox events

- `voice.agent.requested`
- `voice.configuration.publish_requested`
- `voice.endpoint.requested`
- `voice.forwarding.verify_requested`
- `voice.credential.rotate_requested`
- `subscription.suspended`
- `subscription.reactivated`

## 15. Product screens

### Tenant Voice menu

1. Overview: status, version, endpoints, health and usage.
2. Agent: greeting, language, voice and behaviour.
3. Appointments: allowed actions and consultation modes.
4. Phone setup: existing provider, forwarding or managed number.
5. Routing: hours, overflow and human transfer.
6. Test and publish: browser preview, phone test, diff, validation, publish and rollback.
7. History: calls, transcript, recording, tool failures, transfer and appointment result.
8. Usage: minutes, concurrency, allowance and overage.

Provider ids, secrets and raw JSON are hidden from tenant staff.

### Exora superadmin

- tenant/state/plan list;
- desired versus observed provider state;
- agent/version/deployment/connection and masked number;
- provisioning timeline and redacted errors;
- retry, reconcile, pause, resume, rotate and rollback;
- tool/evaluation/webhook health;
- renewal/credit warnings;
- usage, failure rate, booking conversion and transfers;
- immutable audit history.

Paid purchases, deletion, rotation and rollback require explicit confirmation and authorization.

## 16. Security and privacy

- unique credential and signing/callback secret per tenant;
- vault/KMS storage and reference-only database fields;
- HTTPS-only tools and callbacks;
- fixed tenant/facility context derived from endpoint;
- callback authentication, replay protection and idempotency;
- Sarvam outbound IP allowlisting where required;
- CAPTCHA/device/IP throttling and concurrent-call limits for anonymous web voice;
- durable consent/session row before issuing a browser URL;
- recording/transcript retention and deletion policy;
- audited recording/transcript access;
- OTP or equivalent step-up verification for cancellation/rescheduling;
- automatic deployment pause when subscription is suspended;
- no clinical diagnosis or treatment advice.

## 17. Reliability and observability

Measure provisioning stages, drift, signed-URL success, call completion, tool latency/errors, booking
outcomes, handoffs, webhook delay/duplicates, minutes, spend and rollback count. Alert on provider
outages, authentication failures, tool error spikes, stale callbacks, renewal risk and version drift.

A scheduled reconciler reads every active Sarvam agent/deployment. It automatically repairs safe
drift and opens a reviewed operation for dangerous differences.

## 18. Test strategy

### Unit and contract

- compiler, protected-policy preservation and full-list merges;
- state transitions, idempotency and rollback;
- all HMS tools against seeded tenants;
- Sarvam configuration/deployment/webhook schemas;
- provider failure and rate-limit behaviour.

### Isolation

- Tenant A credential cannot read/write Tenant B;
- Tenant A agent contains no Tenant B URLs or secrets;
- a facility endpoint cannot claim another facility;
- crossed agent/deployment/version callbacks fail closed;
- tenant inputs cannot replace protected URLs or policy;
- every provisioning test asserts expected backend origin and tenant-owned facility ids.

### End to end

- onboarding creates an actual tenant Sarvam agent;
- publishing a greeting changes the real Sarvam version;
- browser call books an isolated appointment;
- no-answer forwarding reaches the correct tenant;
- direct provider number reaches the correct facility;
- failed evaluation leaves old version live;
- rollback restores every endpoint;
- suspension stops new calls.

## 19. Delivery phases

### Phase 0 — Sarvam feasibility

- confirm production authoring API/service-auth access;
- confirm telephony, tool and evaluation features for the workspace;
- obtain a sandbox number/connection;
- review and commit the generic Exora template.

Exit: a backend process can create, modify and commit an agent without browser automation.

### Phase 1 — canonical control model

- add models, migrations, state machine and audit;
- migrate current binding data;
- make runtime/callback bindings generated state;
- add transactional outbox jobs;
- rename `assertWhatsAppActive` to reflect that it checks the communications module generally.

Exit: one authoritative view explains desired, active and observed state.

### Phase 2 — real agent wrapper

- provider adapter and configuration compiler;
- agent/tool/secret reconciliation;
- Save draft, Publish and rollback;
- tool tests and Sarvam evaluations;
- deployment version promotion.

Exit: changing Test Hospital's settings in Exora changes its actual Sarvam agent and is reversible.

### Phase 3 — browser production path

- public HTTPS tenant deployment;
- centralized active binding delivery;
- durable sessions, throttling and consent;
- Sarvam callback adapter and call history.

Exit: Test Hospital completes a website call and isolated appointment.

### Phase 4 — unanswered-call forwarding

- dedicated destination-number allocation;
- forwarding wizard and provider instructions;
- busy/no-answer/unavailable verification;
- transfer-loop protection and periodic routing health.

Exit: an unanswered Test Hospital call reaches only its agent and backend.

### Phase 5 — direct provider numbers

- vault-backed provider credentials;
- connection and number import;
- Exotel first, then providers based on demand;
- deployment and test-call automation.

Exit: tenants bring supported numbers without Exora staff manually configuring Sarvam.

### Phase 6 — operations and scale

- complete tenant/superadmin screens;
- minutes, concurrency, entitlements and billing;
- suspension/reactivation;
- monitoring, reconciliation, retention and load tests.

Exit: routine multi-tenant Voice operation requires no provider-console work.

## 20. Test Hospital pilot

1. Give Test Hospital stable public/staff HTTPS URLs.
2. register its backend origin and move its Voice secrets to the control-plane secret registry.
3. Clone/create its tenant-specific Sarvam agent.
4. Compile and publish its first configuration using only its backend URLs.
5. Test all reads, hold/release and one controlled booking.
6. Run a deliberate cross-tenant request and verify rejection.
7. Commit/evaluate version 1 and activate browser calling.
8. Allocate a dedicated overflow number and inbound deployment.
9. Configure the existing reception number to forward when selected conditions occur.
10. Verify every forwarding condition and human handoff to a separate destination.
11. Change the greeting in Exora, publish version 2 and test rollback.

## 21. Acceptance criteria

- every tenant has a distinct Sarvam agent, backend origin, service identity and credential;
- no agent tool can select or override its tenant;
- publishing in Exora changes the actual Sarvam configuration and creates a traceable version;
- validation failure never changes live deployments;
- rollback is a supported one-action operation;
- all hospital facts come from the bound tenant HMS backend;
- browser clients receive no provider/HMS secrets;
- an unanswered existing-number call reaches the correct tenant deployment;
- shared-number cross-routing is impossible by default;
- unknown/crossed callbacks fail closed;
- sensitive actions and transcript/recording access are audited;
- subscription suspension stops new calls;
- the isolation, end-to-end and failure suites pass.

## 22. External dependencies

- Sarvam must enable required authoring, tool, evaluation and telephony APIs for Exora.
- Provider onboarding can require tenant action in an external console.
- Forwarding availability and charges vary by carrier.
- Exotel live transfer may require Sarvam enablement.
- Number rental is billable and requires recorded authorization.
- The generic template is currently uncommitted and must not be deployed until reviewed and
  committed.
- Localhost cannot receive Sarvam tool/webhook requests; public HTTPS is mandatory for activation.

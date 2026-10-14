# Company-managed provider bindings

13 October 2026. This phase implements clinic-separated callback configuration. It does not provision numbers, activate automation, submit templates or establish receptionist-first routing.

Current development is WhatsApp only; Voice/Sarvam work is paused. The Voice section records earlier implementation and future acceptance boundaries.

## WhatsApp

`WA_CLINIC_BINDINGS_JSON` is an explicit server-only list of descriptors. Each has `tenantId`, `facilityId`, `phoneNumberId`, `businessAccountId`, and `accessTokenEnv` (a named `HMS_WA_TOKEN_*` environment reference). A phone can occur once; a tenant/clinic can have one descriptor. Unknown properties, invalid identifiers and ambiguous duplicates fail startup without printing supplied configuration.

The company app uses `WA_APP_SECRET` for raw-byte HMAC verification and `WA_VERIFY_TOKEN` for the GET subscription challenge. Named per-clinic tokens remain outside the repository, dashboard DTOs and browser. `WA_GRAPH_VERSION` is a pinned version string; format validation does not certify provider support. Missing outbound credentials do not block properly signed inbound control requests. Missing GET verification token leaves handshake readiness false while signed STOP/human requests from an existing subscription still work.

The callback checks Meta's WABA entry ID, message change type and phone metadata against the server descriptor, then checks the database account against the pinned tenant and clinic. Administrators cannot claim another descriptor's number. The whole batch receives shape/configuration preflight before writes. Clinic transactions remain independent: a later operational failure can leave earlier transactions committed, and a whole-batch retry relies on persisted deduplication. This is not a cross-tenant atomic transaction.

New accepted events retain original clinic, phone and WABA identity. Account updates and ingestion share a clinic lock; ingestion rechecks after waiting. Once provider history exists, a normal settings edit cannot replace the number. Historical rows keep unknown routing metadata rather than inventing original evidence. Number migration/offboarding needs a dedicated reviewed workflow. Removing a descriptor refuses subsequent callbacks; active account changes require API restart and review.

Production rejects the unpinned single-number fallback. Local compatibility still accepts the old `WA_PHONE_NUMBER_ID` configuration only when the explicit registry is absent. An explicit empty list disables that fallback.

Envelope reference checked against [Meta's messages webhook documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages). Coexistence echo/history/contact events are not handled by this message endpoint and must be added before Business app coexistence is activated. Shared ingress currently has an IP rate limit of 120 requests/minute; review authenticated rate limiting before multi-clinic live scale.

## Voice

`VOICE_CLINIC_BINDINGS_JSON` descriptors have `tenantId`, `facilityId`, `accountId`, `agentVersion`, and `secretEnv` (a named `HMS_VOICE_SECRET_*` reference). Accounts, clinics, secret references and populated credential values cannot be duplicated. Configuration responses never include secret values. The parser refuses partial legacy configuration and explicit malformed registries without falling back.

The internal runtime sends `x-voice-account` to select its configured deployment, plus its dedicated `x-voice-secret`, to `POST /integrations/voice/events`. Both match before persistence. Event bodies cannot select a tenant/clinic. Managed events require the exact pinned agent version; stale sequence and receipt paths cannot bypass version validation. Identical provider session/event IDs in different accounts remain separate. Explicit empty registry disables callbacks even if old single-runtime configuration remains present.

The legacy single-runtime configuration already requires explicit tenant/facility/account/version and a strong secret, so it remains compatible. Registry entries without usable secrets are not loaded as authenticated runtimes. Configuration readiness in call history means the internal receiver has credentials; it does not prove a native Sarvam callback or a deployed call flow.

## Sarvam adapter decision

The [documented inbound completion payload](https://docs.sarvam.ai/voice-agents/api/deployments/webhooks/webhook-payload) carries agent/deployment/interaction identifiers, optional timestamps and transcript turns. It does not match the internal sequenced event model. The [deployment configuration](https://docs.sarvam.ai/voice-agents/api/deployments/create) documents webhook URL and metadata but does not establish our internal account/secret headers as native callback authentication. Do not expose an unsigned payload endpoint that trusts deployment IDs from the body. Verify supported authentication with the account/provider, or use authenticated provider retrieval to verify a notification before mapping it.

Keep caller numbers and transcript data out of URLs and logs. Missing provider timestamps are incomplete evidence; do not synthesize successful call dates. Transcript presence is not recording/transcript consent. An agent's extracted booking ID is not a persisted HMS appointment. A deployed Sarvam line can answer AI directly; upstream carrier/PBX routing must still ring reception first and forward only the requested overflow conditions.

## Evidence and remaining work

- Full isolated backend suite: **31 files / 331 tests passing**; **133 frontend tests passing**. New managed WhatsApp and Voice HTTP tests cover tenant separation, exact credentials, refusal paths, replay and configuration readiness. A 20-way booking test failed once during an earlier full run; its isolated rerun and the final full run passed. That transient failure is not hidden as an initial clean run.
- Database test target: `hms_channel_bindings_test` on isolated local port 54359. The user's preview database was preserved; callback-binding migration 20261013070000 was applied separately to the synthetic preview.
- Desktop annotation: booking registration/caller actions moved beside “Choose the patient”; browser inspected without changing booking semantics.
- Subsequent WhatsApp-only status phase: [read-only Meta template lookup](WHATSAPP_TEMPLATE_PROVIDER_STATUS.md) and immutable observations are implemented; template-check history now also prevents ordinary number replacement. Latest combined suite is **348 backend / 137 frontend tests passing**. The 331/133 totals above remain the earlier ingress checkpoint.
- Remaining: durable company provisioning/assignment history and offboarding; Embedded Signup and account verification; native Sarvam adapter; shared booking tools; real template sync/transport; WhatsApp automation; receptionist-first carrier routing; controlled live acceptance. All live/provider states remain unverified.

# WhatsApp and Sarvam integration — next phase

**Current turn: WhatsApp only. Sarvam is paused at the owner's request.** Retain the Voice items as future work; do not implement them during this phase. Current WhatsApp progress is tracked in [WHATSAPP_INTEGRATION_PROGRESS.md](WHATSAPP_INTEGRATION_PROGRESS.md).

Reviewed 13 October 2026 after PR #1 merged into main (`9de2340`). This is an implementation map, not a claim of live connectivity. No provider configuration, messages, calls or business records were changed in this review.

## Audit prerequisite status

UXA01–UXA07 are implemented on codex/audit-backend-hardening with typed adapters and isolated persisted regression tests. See AUDIT_BACKEND_HARDENING.md. They are not applied to the existing preview/production database yet. Mobile is outside current scope; clinical/ABHA/own-doctor ledger decisions remain separate.

Managed WhatsApp/Sarvam onboarding is now the active goal. Number choice, saved setup requests, local template editing and explicit human handoff are being built; the current implementation and actual provider evidence are in MANAGED_CHANNEL_ONBOARDING.md. No live activation is claimed.

Managed ingress follow-up adds per-clinic server registries and callback identity/credential isolation. Current evidence and remaining lifecycle/provider work are in [MANAGED_PROVIDER_BINDINGS.md](MANAGED_PROVIDER_BINDINGS.md).

## Current integration evidence

| Component | What exists | What is missing |
| --- | --- | --- |
| Staff WhatsApp | Typed `/v1` adapter, conversations/handoff, local templates/campaigns and notification history; clinic-scoped Meta status lookup and immutable submission queue/uncertain-attempt reconciliation | Real provider acceptance, creation rate limits/operator resolution/status callbacks and patient delivery; bulk sync remains unavailable; saved settings report `liveSending: false` and `transport: log` |
| WhatsApp inbound | Signed callback route in `apps/api/src/http/routes/whatsapp.ts`, clinic/account mapping and callback processing | Actual account configuration and observed provider round trip are unverified |
| Existing WhatsApp bot | Repository-root `hospital-webpage/whatsapp-mvp`, Meta client and booking workflow | Uses `/api/v1/integrations/whatsapp` with an older service-key contract. Changing its base URL to HMS_NEW is insufficient |
| Staff Voice | Call list, transcript/recording access and typed `/v1/voice-calls` reads | Real runtime ingestion and provider recording access are unverified |
| HMS voice ingestion | `/integrations/voice/events`, secret plus tenant/facility/account binding, pinned version, sequenced events, consent and retention | This is an internal event contract, not a native Sarvam webhook endpoint |
| Existing voice runtime | Repository-root `voice-agent-runtime`; booking client, browser voice interface | Calls older `/api/v1/integrations/voice` routes and uses Whisper/Kokoro. It is not a Sarvam integration |

Both staff navigation entries exist and are permission-gated: WhatsApp requires `comms.read`, Voice requires `voice.read`. An absent entry is an access/preview issue to investigate; an empty worklist does not establish a missing frontend. Browser inspection in this review could not complete because the existing tab's CDP command timed out.

## Implementation order

### C01 — Receive real WhatsApp conversations in HMS

- Confirm the provider account/phone belongs to the intended clinic and assign one owner for inbound webhook handling. Do not send the same provider event independently through both the old bot and HMS.
- Configure server-held secrets and signed inbound callbacks against HMS_NEW.
- Persist/deduplicate provider event IDs, route to the verified clinic and surface real incoming conversations in the existing inbox.
- Preserve STOP/withdrawal precedence, module suspension and contact permissions.
- Acceptance: a controlled inbound event survives readback, appears only in the authorised clinic, and a duplicate callback creates no second message. Local fixtures and actual provider evidence must be reported separately.

### C02 — Staff replies and appointment messages

- Read-only Meta template status lookup, exact draft matching, immutable submission revisions and uncertain-attempt reconciliation are implemented locally. Complete fleet safeguards and real transport against a pinned supported API version. Keep provider-approved templates separate from local drafts. See WHATSAPP_TEMPLATE_SUBMISSIONS.md.
- Persist outbound intent before sending. Track provider acceptance independently from delivered/read callbacks. Do not automatically replay an uncertain send.
- Recheck contact eligibility and STOP before dispatch; credentials stay off the frontend.
- Existing staff controls should derive readiness from server capability evidence rather than the adapter's hard-coded local flags.
- Acceptance: a controlled recipient receives one message; its provider ID and callbacks reconcile in HMS. Replies, template messages and notification scheduling retain their different eligibility rules.

### C03 — Sarvam call history and transcripts

- Confirm whether the selected product is hosted Sarvam Voice Agents or Sarvam STT/TTS embedded into the existing runtime. These need different adapters; an app-version variable alone does not select a product.
- For hosted Voice Agents, bind the trusted agent/app version/deployment to tenant/facility server-side. Authenticate incoming events using the configured provider mechanism.
- Map Sarvam interaction IDs, timestamps and transcript roles to the internal event model, with replay protection and ordering. Do not invent successful timestamps or consent when fields are absent.
- Store transcript/recording access only with the existing consent, retention and permission evidence. A recording URL is not permission to retain or expose it.
- Acceptance: one controlled call appears in Voice; duplicate delivery does not create a second call; unauthorised clinic/app/version and expired/withdrawn access are refused.

### C04 — Booking tools shared by channels

- Define a narrowly scoped service identity and channel-facing contracts for approved doctor/service reads, real availability, hold, confirm, release, and later cancel/move.
- Delegate to existing HMS domain commands; never create a parallel appointments store or write booking tables directly.
- Derive clinic, channel and caller ownership from trusted integration context. Provider-extracted appointment IDs/confirmation text are not proof that a booking exists.
- Keep atomic holds, stable retry keys, ownership, timezone and conflict semantics intact. Both channels' persisted bookings must appear in the existing staff list with their actual origin.
- Acceptance: a controlled hold→confirm survives fresh staff readback; expired holds and another caller's booking are refused; conflicting attempts cannot bypass HMS rules.
- The owner has now requested automation-first WhatsApp with human handoff and receptionist-first Sarvam overflow. Shared booking tools and controlled end-to-end provider activation are part of that ongoing goal.

## Inputs still needed

- Confirm exact integration targets. Candidate existing folders above were found in code, but their selection is not yet confirmed by the owner.
- Meta account/phone status, approved template availability, server secret references and webhook environment.
- Hosted Sarvam agent versus custom speech runtime; agent/deployment identity or runtime target, account status and server secret references.
- Intended test environment and controlled recipient/call path. Do not ask for secret values in chat or store them in documentation.
- Public webpage integration remains deferred until its target is selected.

## Official provider references checked

- Sarvam inbound deployment payload: https://docs.sarvam.ai/voice-agents/api/deployments/webhooks/webhook-payload
- Sarvam HTTP booking tools: https://docs.sarvam.ai/voice-agents/build/tools/https-tool
- Sarvam analytics/transcripts/recordings: https://docs.sarvam.ai/voice-agents/api/analytics/overview

Direct Meta web fetch was throttled; the Meta documentation connector subsequently verified Embedded Signup v4 and Business app Coexistence. See MANAGED_CHANNEL_ONBOARDING.md for sources, observed app readiness and ownership semantics. Send/template transport still requires exact provider contract implementation and observed acceptance.

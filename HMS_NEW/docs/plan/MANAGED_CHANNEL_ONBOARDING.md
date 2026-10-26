# Managed WhatsApp and Sarvam onboarding

13 October 2026. Goal: Paperwhale manages service for clinics; reception answers normal calls and AI handles overflow; WhatsApp automation leads until a requested human takes over; templates editable in the dashboard. Desktop only. Public webpage remains deferred.

**Current turn scope: WhatsApp only. Sarvam implementation is paused at the owner's request.** Voice descriptions below retain earlier work and future requirements; they are not an instruction to continue it now.

## Implemented phase

- Voice → Call setup and WhatsApp → Channel setup persist validated number strategy, languages, greeting and routing preferences, then a setup request. Shared save/submit lock and expected version prevent one reviewed intent overwriting another. Requests emit a durable setup_requested event; no automatic provisioning consumer exists yet. State is not_started/draft/requested and live=false, separate from provider activation.
- WhatsApp → Templates creates/edits local drafts with actor-bound keys, version checks, strict numbered parameters and draft preview. Approved/scheduled campaign content is locked; draft edits invalidate campaign tests/review. No Meta submission or approval is claimed.
- Inbox automation/handoff_requested/human ownership, takeover and explicit resume are persisted/versioned/keyed. Exact human commands pause synchronously at signed ingestion. STOP, closure, suspension and expired windows block automation eligibility. Historical threads stay paused after migration. See WHATSAPP_HANDOFF_CONTRACT.md; no bot orchestration or real sending is active yet.

Local acceptance: 299 backend and 133 frontend tests pass. In the isolated desktop preview (5208/API 3059), voice and WhatsApp preferences saved/submitted and template creation/editing persisted through fresh reads. No provider traffic occurred. Human handoff has persisted HTTP and frontend regression coverage; a live WhatsApp handoff remains unverified.

Subsequent managed-ingress phase: explicit server-only WhatsApp/Voice clinic registries, isolated credentials, callback routing pins and account-history protection are implemented. Combined acceptance is now **331 backend / 133 frontend tests**. See [provider binding evidence and deployment instructions](MANAGED_PROVIDER_BINDINGS.md). Registry configuration is not provider verification or activation.

Latest WhatsApp-only phase adds read-only Meta template status lookup, exact draft matching and durable attributed observations. **348 backend / 137 frontend tests** pass locally; actual Meta lookup/submission/sending remains unverified. See [template status contract](WHATSAPP_TEMPLATE_PROVIDER_STATUS.md) and the [current WhatsApp ledger](WHATSAPP_INTEGRATION_PROGRESS.md). The preceding counts are historical phase checkpoints.

## Number options

| Option | Intended path | Acceptance boundary |
| --- | --- | --- |
| Existing voice mobile/landline | Reception answers current line; carrier/PBX conditionally forwards busy/no-answer/unreachable calls to dedicated AI line. | Carrier support, charges, voicemail precedence, original caller ID and forwarding loops require real tests. This upstream routing is separate from Sarvam agent-to-human transfer. |
| Existing cloud telephony | Connect supported provider numbers to Sarvam; configure receptionist-first flow on provider/PBX. | Sarvam supports existing Exotel/Twilio/Smartflo/Pulse/Intalk/Vobiz connections. Not every routing feature/number is automatically verified. |
| New managed voice number | Telephony front door rings reception then bridges overflow to Sarvam. | A line directly assigned to a Sarvam inbound agent answers AI immediately. Rental alone does not provide reception-first routing; use it as overflow destination or implement a front door. |
| Voice number porting | Possible future carrier migration. | Number type, region, continuity and eligibility unverified; not offered as a working route. |
| New WhatsApp number supplied by Paperwhale | Clinic completes Embedded Signup using supplied number; delegates company app access. | Number verification, display name, business/billing setup and authorization required. |
| Existing WhatsApp Business app | Coexistence retains eligible app+number alongside Cloud API. | Actual Meta eligibility; additional contacts/history/echo webhook processing and synchronization required. Current callback does not implement Coexistence echo/history events. App-origin human replies must also pause automation. |
| Existing WhatsApp Cloud API | Authorized WABA connection or partner migration. | Reconcile old partner access, asset grants and subscriptions; selection is not migration. |
| Personal WhatsApp | Business conversion/migration review or separate number. | No promise of keeping personal app unchanged with automation. Do not deregister an existing number without an accepted migration plan. |

Company-managed is delegated operation, not ownership of every customer's Meta assets. Embedded Signup customers own generated WhatsApp assets and retain WhatsApp Manager access. Phone supply/contract and platform asset ownership are separate. Avoid putting unrelated clinics into one Paperwhale-owned WABA. Require ownership/authority/offboarding records and exclusive active number bindings before provider activation.

## Primary sources and actual account evidence

Read 13 October using web and Meta documentation connector; direct Meta webpage fetch returned 429, connector supplied official contents.

- [Sarvam telephony](https://docs.sarvam.ai/voice-agents/deploy/telephony), [managed rental](https://docs.sarvam.ai/voice-agents/deploy/telephony/rent-from-sarvam): existing supported account/number or Sarvam-managed Vobiz rental.
- [Sarvam transfer](https://docs.sarvam.ai/voice-agents/build/tools/call-transfer): PSTN/SIP destinations, self-serve Vobiz/Plivo transfers; actual phone test required. Other provider transfer support needs confirmation. Use a staffed alternate destination that cannot forward back to AI; take a callback on failure.
- [Exotel status](https://support.exotel.com/support/solutions/articles/27323-call-status): receptionist-leg busy/no-answer/failed distinctions. Proposed overflow routing is an architecture inference, not verified clinic configuration.
- [Meta Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview): customer-owned assets, company app authorization, existing or supplied number.
- [Meta Coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users): eligible Business app numbers, synchronization and additional webhooks.
- [Meta v4 implementation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/): HTTPS allowed domains, configuration and server-side code exchange. Docs state v2 deprecation 15 October 2026. Flow version, session-event version and Graph API version are distinct.

Read-only connector inspection: Hospital-WA-booking accessible with admin/read/manage; dev_mode and is_live=false. Business portfolio was not granted to connector. Basic settings showed no privacy/terms/deletion URLs or base domains, and contact email unverified. This is evidence of unfinished setup, not a full App Review audit. No provider configuration, subscriptions, purchases, messages or calls changed.

## Remaining in order

1. Company provisioning queue and lifecycle: explicit per-clinic server callback registries and credential references now exist. Durable provider verification, assignment history, suspension/offboarding and reviewed number migration remain. Environment configuration alone is not fleet lifecycle management.
2. Embedded Signup v4 and verified WABA/phone binding: production/staging HTTPS domain and Tech Provider/Solution Partner configuration, exact-origin events and one-time state/code exchange, subscriptions and resumable provisioning. Coexistence echo/history/contact sync before enabling app-shared automation.
3. Template fleet safeguards and real Meta transport: read-only status lookup, immutable submission requests and uncertain-attempt reconciliation are implemented locally; see WHATSAPP_TEMPLATE_SUBMISSIONS.md. Local draft, submitted revision and provider-approved revision remain separate. Provider-account rate limiting, operator resolution, signed callbacks and delivery are still to build; sender rechecks STOP and human ownership under lock. Uncertain send must reconcile evidence, never blindly replay.
4. WhatsApp multilingual orchestration/shared HMS booking tools: current exact human commands are not natural-language detection. Explicit escalation, ownership guard and staff-controlled resume precede activation; no parallel booking store.
5. Hosted Sarvam adapter: trusted agent version/inbound deployment, actual booking tools, authenticated native callback mapping. Dashboard preferences must become a verified deployed revision before calling them applied.
6. Carrier/PBX reception-first overflow: test answered/busy/no-answer/unreachable, voicemail, concurrent callers, caller hangup, bot failure and alternate human destination without loops. Saved ring seconds are desired policy until carrier applies them.
7. Controlled end-to-end acceptance: clinic-authorized incoming WhatsApp and call, persisted booking visible through fresh staff read, duplicate callbacks, human pause and STOP, wrong-clinic/account/version refusals. Recording/transcript consent and retention remain guarded.

Pending inputs: first clinic's carrier/number type and WhatsApp account type; company Sarvam/Meta business access; HTTPS staging domain; server secret references and controlled test contact. Keep secrets/OTP in provider/secret UI, never chat or repository. Independent development can continue meanwhile.

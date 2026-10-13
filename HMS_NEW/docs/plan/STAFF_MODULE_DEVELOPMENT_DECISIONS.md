# Staff module development decisions

12 October 2026. Reviewed against local commit `6713e01`, the current source, [M13 ERD](../design/erd-v2/m13-comms.md), [conventions](../design/erd-v2/00-conventions.md) and [completion guide](BACKEND_COMPLETION_GUIDE.md).

The user delegated the remaining module design decisions and reaffirmed the original staff-UI scope. This document resolves those choices for the backend implementer. The owner subsequently authorized development with two subagents. The first implementation wave is recorded in [STAFF_MODULE_IMPLEMENTATION_CHECKPOINT.md](STAFF_MODULE_IMPLEMENTATION_CHECKPOINT.md). These decisions do not establish provider readiness or delivery.

## 1. Scope and resolved choices

Build the documented G19–G22 communications/growth slice and G25 contracts, after the small schedule checks. Keep the existing patient, queue, consultation, walk-in and teleconsultation flows intact. The full hospital ERD is a reference for ownership and integrity, not a build checklist.

| Decision | Choice for this release | Consequence |
|---|---|---|
| File storage | Implement the Doctor content and campaign-image features. Local filesystem adapter for development; private S3-compatible object storage for production | Only module-specific content metadata in `comms`; no M14 document module, clinical uploads or public bucket |
| Patient-facing WhatsApp bot | Defer | Build the staff inbox, replies, handoff/cases, content, campaigns and follow-ups. No booking conversation engine or new public booking API |
| Voice | Build history, transcript review, recording access audit and authenticated runtime ingestion. Keep the separate public talk launcher as reference source outside this release | No live telephone-number provisioning, PSTN/SIP integration or outbound dialling in this release |
| Loyalty | Keep the original concept, explicitly labelled and isolated from operational records | No membership migrations, charges, discount application or benefit-use accounting. Do not remove the design |
| Google Business | Manual booking-link management, change history and truthful capability state | No profile publishing, Google OAuth project or Google performance API work |
| Growth | Internal appointment metrics first; optional PostHog website aggregates | Website data is unavailable until configured. Journey preview stays illustrative. No invented acquisition attribution or conversion rate |
| Provider readiness | Separate local/module readiness from provider readiness | Missing accounts do not block database/contracts/UI work. Live sends and provider acceptance stay disabled/unverified until configured |
| Shared contracts | Define new communications schemas before implementing their routes and adapters, alongside each slice | G25 is part of the first comms slice, not a final cleanup. Do not migrate unrelated existing APIs |
| G10 archive | Not needed | Keep reasoned cancellation/history; no new archive/delete command |
| G37 all-clinics option | No new UI control | Keep current clinic-specific blocks. Preserve and test existing server all-clinic authorization without adding a screen |

Do not build M06–M12, M14–M17, prescriptions, pharmacy, inventory, billing, insurance, inpatient, laboratory/imaging, general documents, general work tasks or ABDM. G28–G33 remain out of scope. Campaign spend estimates and existing consultation prices do not authorize a billing module.

## 2. Use the ERD with narrow additions

| Slice | ERD entities to implement | Small additions needed by the actual UI |
|---|---|---|
| Notifications | `contact_point`, `messaging_consent_event`, `message_template`, `outbound_message`, `delivery_receipt`, `reminder_job` | Facility scope, provider/account binding, purpose-scoped consent evidence, delivery correlation and safe job cancellation |
| WhatsApp inbox | `conversation`, `inbound_message`, existing outbound messages | `support_case` for issue/feedback status; expose both incoming and outgoing thread entries |
| Content | Reuse catalogue practitioner/department/facility identity | `comms.asset` metadata for doctor photos, department guides and campaign headers. Immutable storage objects, hash, MIME, size, availability/scan state, owner and retirement |
| Campaigns | `campaign`, `campaign_recipient` | Approval snapshot/hash, scheduled time, pause state, budget reservations and explicitly declared interests; no clinical-condition-derived marketing audience |
| Voice | `voice_call`, `voice_transcript` | `voice_recording_access` append-only log; consent/expiry and controlled recording references within comms, not a documents schema |
| Google/growth | `booking_link`; appointment read projections | Audit-backed link history. Defer `attribution_event` writes until a real trusted source exists; do not scaffold a public tracking/booking service |
| Provider routing | Not explicit in the small M13 table list | Minimal `comms.channel_account` binding: tenant, facility, provider, external account ID and readiness. Unique provider/account binding; secrets remain environment references |

Outbound source relationships are limited to the documented appointment, waitlist-offer and campaign/case flows, using tenant-safe references. Do not enable invoice/result/medication source types from the full ERD.

Add each table only when its slice is implemented. Use UUIDs, composite tenant FKs, forced RLS, optimistic versions, audit/outbox transactions and the existing module-role conventions. Register `mod_comms` in the six places listed in the guide. Cross-module writes use an owner-module command or narrow SECURITY DEFINER bridge; comms must not acquire general write access to booking or patient tables.

### Contacts and identity

Keep the ERD's exactly-one patient/booking-party owner for a contact point. An inbound sender who is not a registered patient is a booking contact, not an automatically created patient. Add a narrowly scoped booking-owned operation for an unregistered caller if needed; record an unknown-name label as unverified and update it only from evidence. A provider message proves channel interaction, not clinical identity.

Never choose a patient by phone number alone. Shared family phones can refer to several people; staff link the correct patient through the existing authorized flow. Do not automatically merge booking parties, patient records or consent purposes. Use the authorized patient's contact or the selected booking party when routing a visit message; record which identity/contact was selected.

### Tenant and facility scope

Map provider account IDs to tenant/facility on the server before processing callbacks. Never trust tenant, facility, actor, assignee or appointment IDs in an external body as authorization. A callback's appointment link requires a verified booking/tool result in the same tenant and facility; `outcome=booked` is not evidence by itself.

Persist facility scope on conversations, calls, campaigns, link records and outbound messages. Reads and writes require the permission at that facility. Multi-facility audiences require authority for every included facility. Unscoped incoming messages route to the account's configured facility, not whichever clinic a browser selected. RLS alone does not enforce facility permissions.

## 3. Notifications and consent first: G19

Use the existing platform outbox/inbox worker. Do not add M16 or a second queue framework.

- Implement booking confirmation, reschedule, cancellation, waitlist-offer readback and the original reminder/follow-up controls. Booking events carry IDs; workers obtain the current authorized booking/contact data. Do not copy clinical narratives into event payloads or message history lists.
- Default automated follow-up kinds are `day_before`, `same_day` and `follow_up` where configured by the retained UI. Do not enable medication/vaccination scheduling merely because the broad ERD enumerates them.
- A day-before reminder that is already due is skipped with a reason, not sent immediately as a second confirmation. Same-day timing is a separate configured rule. Never send a stale reminder after the visit, after cancellation, or after a replacement appointment exists.
- On reschedule, use the existing `fromAppointmentId`/`toAppointmentId` payload to cancel the predecessor's unsent jobs and create jobs for the replacement ID; preserve sent history. Deduplicate by logical appointment/message kind as well as event ID: rescheduling also emits cancellation and confirmation events. Recheck active appointment, contact, consent, module state and expiry immediately before dispatch. Delayed/reordered events must not revive the old visit's reminders.
- Persist a skipped job/state for no consent, with no sendable outbound message. This resolves the guide's inconsistent “no job” versus `skipped_no_consent` language and gives the UI an honest reason.
- Messaging consent is separate from treatment/teleconsult consent. Record purpose, source and evidence; possession of a phone, a booking or an inbound enquiry is not marketing opt-in.
- Apply STOP across matching normalized tenant/channel/address contacts, including duplicate records for shared phones. Re-enable only the purpose supported by a fresh explicit opt-in after STOP. Delayed provider events or a staff toggle cannot revive a prior opt-in. Preserve provider occurrence time and server receipt/order evidence.
- Suspension stops staff business writes, new automated jobs and outbound dispatch. Authenticated provider STOP/consent withdrawals and receipts for already sent messages still ingest while suspended. Treat this as a narrow control-plane exception and test it; otherwise suspension could lose opt-outs or delivery history.

### Safe sending and simulation

Claim rows with locks and claim tokens. Commit a send-attempt marker before crossing the provider boundary. If a process crashes or a provider times out after that point, mark `unknown`; lease expiry must not cause a blind resend. Reconcile through receipts/provider evidence or explicit review. Database idempotency and a claim lock cannot guarantee exactly-once delivery by an external provider.

Allow retries only for an evidenced failure before provider acceptance, using the same logical message identity. Keep receipts append-only and deduplicated; late receipts must not regress a read/delivered state to queued/sent. Where a provider has no event ID, derive a stable receipt key from account/message/status/provider-time rather than inventing one.

The development log adapter leaves simulated messages queued with `transport=log` and a visible reason; it never claims sent/delivered. It must not log bodies, contacts or tokens. Production permits an unconfigured module to remain readable, but refuses live send activation with missing credentials. Enabling a provider does not automatically flush an old simulated backlog: review/revalidate or expire it first.

## 4. WhatsApp and content: G20

Mount the original seven tabs and nested forms. Use the guide's typed `/v1` route map, facility permissions and current `OriginalResourceSource` pattern. Refactor direct legacy `api` calls to the source/domain transport as well: a context provider alone does not intercept imported `api()` or raw fetch calls. No `/api/v1/admin` server compatibility endpoints.

Start with one configured channel account per clinic; leave room for more through account identity. Implement the signed webhook, inbox/thread, assign-to-self, close, replies, support cases and receipt history. Do not advertise “the bot will resume” when closing a conversation because the bot is deferred. Preserve the handoff layout and change that sentence to the actual inbox state.

Webhook validation uses the raw body, verifies the configured account, durably stores deduplicated accepted events and acknowledges after that storage succeeds. Process business work asynchronously. Apply free-text reply-window policy on the server; templates and purpose consent govern other sends. Treat provider IDs as scoped to account, never universally unique across tenants.

### Storage boundary

Photos/images: JPEG/PNG up to 5 MB. Guides: PDF up to 10 MB. Stream through an authenticated API upload first; validate actual bytes, dimensions/size and owner access. Store a new opaque object key for each version, server-calculated SHA-256 and scan/validation state. Use quarantine; never distribute unvalidated content. Production upload activation requires a configured validation/scan path. Do not permit HTML/SVG or general clinical attachments.

Store bytes outside PostgreSQL. Keep objects private; authorize every read before proxying or issuing a short-lived download URL. Protect paths from traversal and never accept a client-chosen storage key. Public educational/doctor content sent to WhatsApp is uploaded by the worker through the provider's media API; do not make the bucket public or expose a reusable staff download URL. Retirement does not silently erase historical campaign references.

S3 presigned URLs have bounded access but can overwrite an existing key; immutable server-issued keys and checksums are deliberate parts of this design. See [AWS object-access documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html). This is a storage interface choice, not a purchase or deployment of AWS.

### Campaigns

Keep draft → preview → test → approve → scheduled/running → paused/completed/failed semantics visible in the original UI. The ERD's smaller status list is extended for the actual scheduling/pause workflow.

Preview selects explicit marketing opt-in only. Specialty interest must be voluntarily declared in a small consent-backed contact preference, not inferred from diagnoses, medications, notes or sensitive patient flags. A caller's declared interest does not describe every patient sharing their phone.

Bind approval to the server-computed recipient set/count, template version, parameters, asset hash, schedule, estimate/rate version and budget. The authenticated approver is recorded by the server. `test_received=true` from a form is a staff acknowledgement, not a provider delivery receipt. Front desk can reply but cannot approve a campaign. Pause prevents new claims; it cannot retract an already sent message.

Reserve estimated budget atomically per recipient before dispatch; an unknown send retains its reservation until reconciled. Deduplicate logical recipients by destination for that campaign, respecting STOP across contact aliases. Rates are configured/versioned on the server. Label the cap and cost as estimates; do not imply verified provider charges or build invoices. Campaign “bookings” remains unavailable until trusted attribution exists.

## 5. Voice: G21

Implement the original staff history, recordings, original/English transcript review and access-history layouts. The live launcher is in the separate public `src/talk.tsx` entry point, not the staff Voice module. Retain that source as reference; do not deploy it or add a new live-call launcher in this release. Normalized ingestion can accept authenticated events from an existing configured external runtime without building its calling interface or telephone infrastructure.

Keep Sarvam behind an adapter and pin a configured app version. Confirm the real provider/runtime callback shape before parsing it; callback fixtures prove local integration only. Use authenticated, account-scoped, deduplicated runtime events. Staff browser requests use normal authenticated API access, never a provider API key or callback secret. Existing trusted booking-tool results must come from the bounded booking-agent permissions and ordinary booking APIs, with no clinical write authority; ingestion does not itself build a booking conversation engine.

Keep voice-call list metadata separate from transcript content. Transcript access is sensitive and audited. Store the original transcript; corrections/translation/review retain version and provenance, not an overwrite of the source text. Do not send full transcripts to PostHog or include symptoms in ordinary call history.

Recording defaults to off. Playback requires affirmative recording consent, configured retention/expiry, `voice.recordings.read`, facility scope and allowed storage/provider host. No indefinite default retention. Log every permitted or refused attempt in a separate transaction so a denial is not rolled back with the request. Stream/proxy recordings or issue short-lived authorized access; never hand the UI an arbitrary provider URL. The storage reference belongs within comms; no full documents module.

Sarvam documents separate web-widget and telephony transports; neither transport is being launched by this staff slice. See [Sarvam runtime documentation](https://docs.sarvam.ai/conversations/build/run-time). Runtime identity and callback details still require verification against the actual configured account before accepting real provider events.

## 6. Google Business and growth: G22

Build manual clinic booking links and their audit history first. Accept only an approved HTTPS booking destination without URL credentials or sensitive tokens. Reuse an existing patient-facing destination; do not build G33 or falsely label an unverified link as a working booking integration. Any URL validation must not fetch arbitrary hosts. Actual Google publication stays a manual external step.

Compute growth from booking records. Declare the unit as a logical visit: follow a reschedule chain and count its current successor once. The created cohort uses the root creation date; the visit cohort uses the successor's clinic-local visit date. A cancelled predecessor with a successor is a move, not an independent cancellation. Cover chains crossing the filter window. Preserve existing Overview metric definitions rather than silently changing that page.

Reuse the guide's retained-confirmation and resolved-attendance definitions with explicit denominator/clock tests. Handle untimed walk-ins through their session date and known status rather than fabricated timestamps. Empty denominators give null. `origin_channel` is a booking channel, not acquisition proof. No funnel/conversion claim without independently measured eligible visits/events.

PostHog is an optional server-side, project-scoped read adapter for aggregate website events only. Missing credentials return `not_configured`; unavailable service returns `unavailable`; no network call for an unconfigured project. Keep demo traffic separate. Exclude patient names, phones, identifiers, clinical screens, session tokens and medical text from telemetry; do not enable session replay as part of this slice. Cached aggregates include scope/filter/as-of metadata. PostHog's private query API uses server-side authentication: [query API documentation](https://posthog.com/docs/api/query).

Preserve the Patient journey tab as a clearly labelled simulation. Leave acquisition/campaign-booking totals unavailable until existing trusted booking commands can carry validated attribution. Do not add an unrelated public event endpoint to make a chart appear populated.

## 7. Contracts, permissions and implementation order

1. Prove G08 exact-range rescheduling and browser-check G05 Resolve. Complete G06 virtual extra hours using an explicit exception visit mode and virtual-only slot/tele-session test. G10 has no new implementation; G37 has no new UI scope.
2. Define shared Zod request/response/event schemas for the first G19 slice; then add scoped comms foundation, consent/readback and worker tests. Continue contracts alongside every later slice.
3. G20 inbound/replies/cases and receipts; then content/uploads and follow-up rules; then campaigns. Sending requires provider readiness, but draft/read/local tests can proceed without real sends.
4. G22 manual links and internal metrics can follow the foundation without provider credentials. Add optional website aggregates afterward.
5. G21 history/runtime ingestion, transcripts and audited recordings. No public talk-page deployment, new call launcher or PSTN deployment.
6. Restore all retained module form bodies with typed adapters and role/facility checks. PendingModule is a feature-status page, not the original full design, and is not completion of a module.

Use the guide's permission codes, with two corrections: conversation-content reads are sensitive even if the proposed seed table calls `comms.read` non-sensitive; and full contact/body access must follow explicit field-level permissions. Front desk receives scoped inbox/reply authority, not recordings or campaign approval. Google/growth navigation requires scoped `growth.read`. Loyalty concept navigation does not confer operational access. Server authorization remains authoritative.

Provider account facts remain unknown: Meta account/number/app, Sarvam workspace/app, object-storage endpoint/bucket and optional PostHog project/region. Their IDs, secret references and readiness must be confirmed/configured by the deployment owner. No keys are needed in planning documents or browser code. Do not claim that these accounts exist, buy them, connect them or send messages during this documentation task.

## 8. Acceptance and handoff

Keep F1–F9 and the reported `0aaff77` baseline (199 backend tests, 25 frontend tests, no lint errors and at most 18 warnings). Those are the previous report, not a rerun in this documentation pass. Test counts cannot replace the actual invariant assertions.

- F10: confirmation/reminder readback; skipped-no-consent; STOP between enqueue/send; reschedule/cancel races; no stale or duplicate send; suspension still records STOP/receipts; log mode never delivers.
- F11: new unregistered contact, signed account-scoped inbound, self-assignment/version conflict, thread/reply/close, wrong facility/permission, expired reply window, duplicate receipt and late status.
- F12: draft/preview/test/approval binding, recipient opt-out after approval, atomic budget/pause, no arbitrary test destination; upload validation/quarantine and cross-tenant access. Fake-adapter acceptance is separate from real template/delivery acceptance.
- F13: authenticated external-runtime fixture → actual normal booking command → call linked to its verified appointment; transcript review; consent/expiry; recording allowed/refused audit persists. No telephone call is required by this release.
- F14: HTTPS clinic link and history; empty and rescheduled-chain cohort math; untimed walk-ins; wrong scope; absent PostHog and separated demo traffic; acquisition remains unknown without evidence.
- Add provider send/crash tests showing unknown outcomes are not automatically replayed, and contract tests that old literal API calls cannot escape the adapters. Do not weaken coverage.test.ts.

Implementation DONE, retained-UI acceptance, configured-provider readiness and real provider acceptance are separate statuses. A local fixture or log adapter cannot pass live delivery/voice acceptance. Changes in this document are decisions only; they close no unverified implementation item.

Linked instructions: [handoff](HANDOFF.md), [completion guide](BACKEND_COMPLETION_GUIDE.md), [regression/flow tests](REGRESSION_AND_FLOW_TESTS.md), [ledger](BACKEND_WORK_LEDGER.md). These decisions supersede the unresolved-choice section of the guide. Older broad hospital roadmaps and the 11 October contract map are historical where later implementations changed them.

# WhatsApp integration checkpoint

13 October 2026. Current implementation focus is WhatsApp. Voice work is paused.

At the user's request, Sri Lakshmi's public website was connected to HMS before the next provider step. Its 17 published doctor profiles now come from HMS and its booking form uses the existing transactional Web appointment flow. See [website integration and hosted requirements](SRI_LAKSHMI_WEBSITE_INTEGRATION.md). The latest combined regression is 378 backend tests, 139 staff tests and 70 website tests passing. This adds website coverage; it does not establish live WhatsApp delivery. Actual Sri Lakshmi hours/fees and hosted verification remain outstanding. Setup actions also have a visible thin outline.

## Implemented and locally verified

- Clinic setup preferences save and submit as a durable request; existing/new number choices do not claim ownership, coexistence eligibility or activation.
- Server-only company registry pins tenant, clinic, Meta phone and WABA identifiers. Per-clinic token references never reach dashboard responses. Production refuses unpinned legacy phone configuration.
- Raw-byte signatures and bounded provider envelopes are checked before writes. Mixed invalid batches refuse before storing valid entries. Independent clinic transactions use persisted retry deduplication.
- Accepted callback routing identity is retained. Ingestion rechecks after the account lock; normal settings edits cannot change a number after provider history exists.
- Explicit human requests pause automation synchronously. Staff takeover/resume are attributed and version checked. STOP works without a GET verification token and is isolated to its tenant; losing handshake readiness cannot suppress authentic existing-subscription control messages.
- Dashboard template drafts can be created and edited. Numbered placeholders are validated; stale edits, approval races and approved/scheduled campaign content are guarded. Edits invalidate draft campaign review. Meta submission/approval is still separate.
- Templates now have a clinic-scoped **Check Meta status** action. It reads the configured WABA and records the observed status separately from the local draft. Approval applies only when the supported provider content exactly matches that draft. Edited drafts make earlier observations stale; a failed provider read does not invent a new status. The action stays disabled without the clinic's server-held credentials.
- Desktop template columns wrap long content so Edit, Check Meta status and the connection requirement remain visible without horizontal scrolling at the checked 1280-pixel viewport.
- Template submission now has an immutable reviewed revision, fictional examples, dedicated durable worker and one creation attempt. Lost responses/crashed attempts reconcile through GET and never automatically repeat POST. New aliases, sample values or keys cannot bypass the same-content guard. It is disabled by default; no live Meta creation occurred. See [submission contract](WHATSAPP_TEMPLATE_SUBMISSIONS.md).
- Booking annotation: patient registration and unregistered-caller actions now sit beside “Choose the patient.” Booking behavior is unchanged.

## Verification

Latest combined acceptance: **35 backend files / 368 tests passing**, against the separate `hms_whatsapp_submission_test` database on local port 54359; **139 frontend tests passing**. Backend TypeScript and frontend TypeScript/production build pass. The submission phase adds 10 creation-client tests and 10 persisted HTTP tests; frontend tests cover malformed receipts and replay of the same frozen request/key. The final combined run includes status identity guards and draft reversion to an earlier provider revision without another creation attempt. The desktop template screen and booking placement were checked in the browser. These are local checks, not provider acceptance.

Earlier WhatsApp ingress/handoff/template checkpoint: 45 focused backend tests and 133 frontend tests passed. The later combined total includes previously completed audit and channel work; it does not mean Sarvam development resumed.

No actual Meta template lookup, provider callback, message, template submission or activation was performed in this phase. Provider tests use injected responses. Preview data and existing provider accounts were preserved. The isolated preview is available at http://127.0.0.1:5208/staff/whatsapp; real sending remains disabled.

## Remaining work

1. Company-managed provisioning lifecycle and verified clinic asset ownership, with assignment history, offboarding and a reviewed number-migration path.
2. Embedded Signup v4 on the confirmed HTTPS destination; exact-origin events, state/code exchange, verified WABA/phone grants and subscriptions. Eligible Business app coexistence also needs echo/history/contact handling before activation.
3. Template fleet readiness: read-only status lookup, immutable revision creation and uncertain-attempt reconciliation are implemented. Signed status callbacks, provider-account rate limits, operator resolution and real-provider acceptance remain. Existing Meta assets are not edited in place; local edits submit new revisions. The old bulk sync endpoint remains unavailable.
4. Actual outbound transport with consent/STOP/ownership rechecks, durable attempt tracking and reconciliation after uncertain delivery. Never blindly resend an uncertain message.
5. Multilingual WhatsApp assistant using existing HMS availability/hold/booking commands. Human escalation must cover normal language as well as exact commands.
6. Controlled end-to-end clinic acceptance: inbound conversation, human takeover, one real delivered message, provider callback replay and a persisted booking visible through a fresh staff read.

Still needed for live setup: authorized clinic/number/WABA, company Meta business access, approved HTTPS environment and server-held credential references. Keep tokens and OTPs in provider/secret interfaces.

Detailed boundaries: [template status contract](WHATSAPP_TEMPLATE_PROVIDER_STATUS.md), [managed provider bindings](MANAGED_PROVIDER_BINDINGS.md) and [handoff contract](WHATSAPP_HANDOFF_CONTRACT.md).

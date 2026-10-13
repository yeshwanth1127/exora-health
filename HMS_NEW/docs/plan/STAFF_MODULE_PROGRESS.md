# Staff-module progress: local implementation complete

**Phase closed by the product owner on 12 October 2026.** Local staff implementation is accepted. Active focus is UX/UI and operations review; webpage/Voice-bot integration is on hold. Provider work below is carried forward in [UX_AND_CHANNEL_TODO.md](UX_AND_CHANNEL_TODO.md), not silently marked implemented. [Current operations review](STAFF_OPS_REVIEW.md).

12 October 2026. Working tree from `6713e01`, branch `codex/staff-frontend-integration`. Three implementation phases completed using two subagents plus integration review. No commit or push. The [first checkpoint](STAFF_MODULE_IMPLEMENTATION_CHECKPOINT.md) is historical.

## Completion and remaining work

**29 of 31 active ledger requirements are DONE for local implementation; G19 and G20 are PARTIAL. No active item is pending.** This is a requirement count, not an effort or production-readiness percentage. Six items remain out of scope, one dropped, one not required, and Loyalty concept-only.

All **14 operational module bodies** are integrated. The owner removed Design and consolidated Appointments/Waitlist/Queue and Activity/System status; Loyalty remains a labelled concept. WhatsApp retains all seven original tabs. Patients, Queue, Consultations and Walk-in integration pages remain intact. Original components/layouts are preserved, with truthful labels, scoped permissions and typed adapters.

| Requirement | Completed locally | Remaining boundary |
|---|---|---|
| G19 notifications — PARTIAL | Confirmation, day-before, same-day, requested completed-visit follow-up, feedback, missed-visit, immediate reschedule/cancellation controls, waitlist lifecycle, consent/STOP and filtered history | Actual provider claims/send attempts, unknown-outcome reconciliation, approved templates, outbound receipt correlation and live acceptance |
| G20 WhatsApp — PARTIAL | All seven tabs: inbox/assign/close/local reply/cases, private local doctor content, campaign draft/preview/local test/approve/budget/pause, clinic details, signed inbound/receipt ingestion | Meta outbound transport/template synchronization/media publishing and production object storage/scanner implementation; real-provider acceptance |
| G21 Voice — DONE locally | Authenticated normalized external-runtime ingestion, account/session/event ordering and replay, bounded history/paging/summary, original/English transcript review, consent/expiry-controlled private recording proxy and audit | Real Sarvam/runtime callback normalization and account/recording-host acceptance, retention/purge policy and live validation |
| G22 Google/growth — DONE locally | Approved-host manual links with optimistic version/history, reschedule-chain metrics, optional scoped PostHog aggregate adapter and unavailable states | Approved real booking destination; PostHog account plus public consented event instrumentation/acceptance. Google publishing stays manual |
| G25 contracts — DONE | Shared runtime schemas for every new comms/WhatsApp/Voice/growth slice, response validation and adapters | Extend alongside future provider implementation; no broad unrelated API migration |

## Phase 3 implementation

- Original WhatsApp reception, issue and feedback layouts are mounted. UUID conversation identity stays separate from phone and clinical identity. Assignment uses the authenticated staff name; replies require explicit care consent and a verified inbound within 24 hours. A local case never invents an inbound message.
- Signed Meta raw-body verification and account-bound deduplication persist before acknowledgement. STOP is immediate across matching address aliases even while suspended. Receipts remain append-only provider evidence; they cannot turn a local record into a delivered message.
- JPEG/PNG doctor portraits and campaign images (5 MiB), PDF guides (10 MiB) use immutable opaque private local keys, hashes, structural checks and authenticated blob previews. Production uploads refuse until a private object-storage and quarantine/scanner adapter is built.
- Campaign approval binds audience, content, rate and budget, deduplicates addresses, checks explicit marketing consent and declared interests, reserves budget atomically and supports pause. Local content is never labelled Meta-approved. Test aliases and review are required before local approval; nothing sends externally.
- All seven original visit-rule controls are restored. Feedback defaults off, 24 hours after persisted completion; missed-visit defaults off, 24 hours after the authoritative no-show transition. Reschedule/cancellation remain immediate (zero delay). Version changes cancel stale work, with send-time consent/STOP/status/expiry checks.
- Voice callbacks are bound to server-configured tenant, clinic, account and pinned runtime version. Recording and transcript consent are separate. Withdrawal applies before business ordering/suspension checks; a later-arriving stale opt-in cannot revive withdrawn content. Transcript revisions and consent/access evidence are append-only. History never exposes private recording URLs.
- Overview now reads persisted all-time clinic Voice session totals with voice.read; otherwise null.
- Voice retains the original last-30-days history with 25-row offset pages (bounded offset), summaries and review layouts. Arbitrary date filters/keyset paging were not added because the original screen does not request them. Transcript readers need `voice.read`; recordings/access history need `voice.recordings.read`.
- Google links require configured exact public HTTPS hosts, no embedded credentials and approved query parameters. Changes are server-authored and versioned. Publishing to Google is manual.
- Growth counts logical reschedule chains once, uses clinic time and current visit status, and returns null for unknown/empty ratios. Booking channel is shown separately from unavailable acquisition attribution. PostHog is a fixed aggregate read with server-only project/tenant/clinic binding, public consented traffic filters and bounded network responses; missing configuration never fabricates zeros.

## Verification

- **20 backend files / 252 tests PASS**, including new WhatsApp (9), Voice/growth (17), and notifications (21) suites. Backend TypeScript PASS.
- **54 frontend tests PASS**, TypeScript and production build PASS. Lint **0 errors / 16 warnings**, down from the previous 18. Existing bundle-size warning remains.
- All migrations applied on isolated Postgres54349; types regenerated from **110 tables**. Six phase-3 migrations successfully rolled back/reapplied on empty `hms_module_migration_check`. Rollbacks that would remove consent/outbound/post-visit history deliberately refuse. The migration verification caught and fixed a leftover lookup function. Schema proof lives outside Git at `/tmp/hms-new-module-proof/phase3-schema.sql`.
- Browser: all seven WhatsApp tabs render; synthetic case assignment/closure and campaign draft persisted; feedback rule saved/read back; clinic details and delivery records render. Google link/history round trip persisted the authenticated staff actor. Voice history/transcript review rendered a persisted synthetic call, with recording disabled when consent was absent. Growth shows real local cohort counts and unavailable provider data; Overview reads one persisted synthetic Voice session.
- Preview: `http://127.0.0.1:5198/staff/whatsapp`, API3049, isolated Postgres54349. Existing preview databases were not reset. Acceptance records are synthetic. No external messages, calls, account provisioning or provider tests were performed.

## Remaining backend ledger

1. **Meta transport:** real template sync/approval freshness, media upload, free-text/template window rules, durable claim/lease/send-attempt markers, bounded retry, unknown-outcome reconciliation, duplicate prevention and account-scoped receipt correlation. Do not flush old local queues on activation. Quiet hours and pricing/provider policy must be implemented before live sending.
2. **Production content:** private S3-compatible storage, scanner/quarantine, authorized lifecycle/retention and deployment configuration. Current filesystem validation is local acceptance only.
3. **Voice acceptance:** actual runtime/Sarvam event normalization and verified recording response/host mapping, configured pinned app/account, retention/purge rules and consented live review validation. No PSTN/SIP or public launcher in scope.
4. **Growth acceptance:** approved booking destination, configured PostHog read project/key, consented public event instrumentation with no clinical payload, project-to-clinic binding and live aggregate validation. No acquisition conversion claims or Google API publishing.
5. **Release:** production OIDC, deployment/provider secrets, signed real callbacks, and existing real video-call acceptance remain unverified.

Remaining work is substantive backend/provider work, not just entering credentials. Details: [completion guide](BACKEND_COMPLETION_GUIDE.md), [backend ledger](BACKEND_WORK_LEDGER.md), [regression and browser checklist](REGRESSION_AND_FLOW_TESTS.md). Billing, pharmacy, diagnostics, inpatient, general documents, public bot and operational Loyalty stay excluded.

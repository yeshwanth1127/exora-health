# Staff mutation review and recovery map

Updated 13 October 2026 for backend hardening. Covers mounted staff operations; not every dormant prototype route. Original receipts prove one request, while refreshed records describe current state.

## Shared recovery

- Every newly hardened mounted mutation requires Idempotency-Key at HTTP. The domain runner stores request and full-actor hashes within the same transaction as audit/outbox and business changes.
- Replay preserves body, key, actor, tenant and command scope. Changed payload/actor is a conflict; legacy receipts without actor attribution fail closed. Existing receipt retention remains the bound, not indefinite recovery.
- Request-outcomes reads only explicit supported booking/waitlist scopes, exact actor and current facility permission; unknown/cross-tenant keys return 404, other actor/unsupported scopes refuse access. Generic admin recovery replays its original command rather than reading this restricted endpoint.
- Role permissions carry reviewed numeric version; booking overlap policy carries reviewed immutable configuration row ID, null for unset. Stale changes return conflict. Current authority is rechecked under access locks for policy and role changes.
- Pending/unknown writes freeze input and navigation. Abort/context-change after a write remains uncertain. Blind refresh cannot clear uncertainty. A retry refused for revoked authority does not prove an earlier attempt failed.
- Clinical/queue/video commands lacking an attributable receipt remain paused after uncertain outcomes; no safe replay is invented.

## Keyed active inventory

| Area | Commands | Additional boundary |
| --- | --- | --- |
| Staff/access | Create staff, edit staff, renew invitation, grant/revoke role, set status, copy/retire role, change role permission | Creator/last-admin/built-in-role safeguards remain. Revoked grant lookup preserves scope so its original receipt is reachable. Invitation state does not prove email delivery. |
| Admin | Module state, registration add/edit, care assignment/end, break-glass review, consent draft/edit/publish/retire | Publication/retirement serialized to one current document per language. Clinical access requirements remain. |
| Catalogue/doctors | Facility/department/room create/edit; service create/edit/fee; practitioner affiliation/end/fees/profile | Service details and fee writes remain two commands: confirmed first step is preserved, uncertain second step replays its original key. Doctor/calendar onboarding is similarly partial and explicit. |
| Booking | Hold, range hold, confirm, overbook, reschedule, cancel | Composite adapters retain original parent and hold suffix keys. Preflight can become unavailable and block reaching replay; uncertainty remains frozen. A temporary successful hold with a refused booking expires normally; no invented rollback. |
| Schedules | Weekly save, exception create/revoke, holiday create/revoke | Previews remain reads. Revocation receipt includes original actor/time. Confirmed weekly save performs no extra booking read that could reclassify success. |
| Waitlist | Create, offer, accept, decline, withdraw | Exact closed-offer GET distinguishes pending, expired, declined, accepted; carries actor/version and accepted appointment. Replay remains possible after offer expiry within receipt retention. |
| Managed channels | Onboarding save/submit, templates create/edit/check provider status/queue immutable submission, conversation assign/reply/close/handoff/resume | Version/CAS, actor keys, clinic scope. Draft and handoff state do not imply provider delivery. Status checks replay the original observation without another provider lookup; malformed write responses remain frozen as uncertain. Queue receipts recover the original snapshot; provider attempts commit separately and uncertain POST outcomes only reconcile through GET. |

## Evidence and remaining limits

Persisted HTTP tests use an isolated Postgres cluster, not a mock DB. They discard a committed response and replay, race distinct reviewed intents, revoke permission, switch tenant/actor and inspect effects/audit/outbox. Frontend pure tests cover frozen request/key, cancellation and context-change uncertainty, route classification and adapter key forwarding.

These do not simulate every real browser disconnect, prove production migrations, activate messaging/calls, or establish clinical acceptance. The original user preview database was not reset or migrated; the separate synthetic preview received managed-channel migrations while preserving its records. See AUDIT_BACKEND_HARDENING.md for the audit checkpoint and WHATSAPP_TEMPLATE_PROVIDER_STATUS.md for the latest WhatsApp checkpoint. In-flight authorization against concurrent revocation is serialized for hardened role/policy/bootstrap paths and the final template status check; do not extrapolate it to every existing domain command.

Dormant ScheduleBlocks, RescheduleVisit and old staff prototypes remain outside this mounted inventory. Their existence does not justify exposing them or claiming repaired flows.

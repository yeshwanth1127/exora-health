# Audit backend hardening — UXA01 through UXA07

Implemented on codex/audit-backend-hardening, 13 October 2026. Seven audit contracts closed in code with isolated persisted regressions. This does not close separate clinical/ABHA/own-doctor decisions, mobile, production or provider acceptance.

| ID | Result | Evidence |
| --- | --- | --- |
| UXA01 | Server visitMode filtering before SQL pagination; fully scoped cursor validation | booking-read-contracts.test.ts, mixed pages and scope changes |
| UXA02 | Zero/inaccessible clinic evidence; genuine all-clinic bootstrap authority; atomic bounded creator role | admin-guarantees.test.ts; migration seeds permissions before role assignment |
| UXA03 | Numeric role CAS and immutable policy-row token including unset null; under-lock live authority checks | Concurrent stale intent and revoked-principal regressions |
| UXA04 | Actor-keyed decline and exact closed-offer outcome | Discarded commit response, expiry distinction, concurrent accept/decline |
| UXA05 | Exact doctor/clinic/session/mode/service/effective fee read-only quote | Typed readiness tests; occupancy does not imply missing configuration; provider/signing/consent unchecked |
| UXA06 | Tenant timezone and exact half-open read/export bounds | DST 23-hour day, midnight boundary, facility timezone mismatch, invalid date 400 |
| UXA07 | Actor-bound original command receipts across mounted operational inventory | Admin, catalogue, cancel/revoke/withdraw and frontend frozen-key regressions; legacy actorless receipts fail closed |

Additional administrative review serialized consent publication/retirement. New channel setup, template edit and handoff use the same receipt/CAS infrastructure. See STAFF_MUTATION_RECOVERY_MAP.md and MANAGED_CHANNEL_ONBOARDING.md.

## Verification

- 27 backend/database test files, **299 tests passing**, against real isolated PostgreSQL on port54359, database hms_audit_hardening_test. Includes all new migrations, persisted HTTP effects/audit/outbox and concurrent/lost-response regressions.
- **133 frontend tests passing**; backend/frontend TypeScript and Vite production build pass. Existing large bundle warning remains. Lint passes with existing warnings; no production deployment claim.
- Lost response means the test discards a successful committed HTTP response and replays its original request. This is meaningful persisted recovery coverage, not every browser/network/provider failure scenario.
- Desktop browser verification used the separate synthetic preview on port 5208/API 3059: voice and WhatsApp setup were saved and submitted, a template was created and edited, and a fresh page read retained the setup request and edited draft. These writes touched only the isolated test database; they did not activate either provider.

## Apply before running updated API

New migrations: 20261013020000_uxa_clinic_setup.sql; 20261013040000_idempotency_actor_identity.sql. Channel phase also requires 20261013050000_managed_channel_onboarding.sql and 20261013060000_whatsapp_handoff.sql. Role permission and booking-policy clients must send the new reviewed version token. Newly hardened mutation routes require keys. Actorless old receipts cannot be trusted/replayed after this change.

Existing preview cluster54349 was not reset or migrated: it has an unrelated checkpoint/missing-directory failure. Tests ran on a separate cluster, preserving preview records. Apply reviewed migrations through the normal database deployment path before restarting updated API against a retained database. Do not equate a successful isolated rebuild with retained-database upgrade acceptance.

No production/provider calls, messages, activation or live credentials changed. Managed channel work remains active beyond the saved onboarding/handoff/template phase.

# WhatsApp conversation handoff contract

This is a durable ownership and eligibility guard. It does not activate a bot, Meta delivery, or an LLM. Current sending remains the existing log transport.

| State | Owner | Automation |
| --- | --- | --- |
| `automation` | None | Eligible only while every current guard passes |
| `handoff_requested` | Waiting for staff | Paused |
| `human` | `assignedStaffId` | Paused |

New signed inbound threads start in automation. Exact whole-message commands `human`, `agent`, `receptionist`, or `speak to a human` (case and whitespace normalized) pause automation synchronously inside the signed callback transaction. Other language is not classified. Existing human threads remain human. Inbound messages preserve explicit closure.

New staff-created or explicitly reopened closed threads are human owned. Opening an already-open thread leaves its ownership and version unchanged; claiming it requires the versioned assignment command. Migration intentionally keeps historical threads paused: assigned threads become human and unassigned threads become handoff requested.

`POST /v1/conversations/:id/assign`, `/handoff`, `/resume`, and `/close` require current clinic `comms.reply`, `{version}`, and an Idempotency-Key. Assignment claims the signed-in actor. Handoff clears assignment and pauses. Resume clears assignment and requires an open conversation, an active communications module, active contact, fresh care-messaging permission, and an unexpired inbound reply window. STOP wins until a fresh, evidenced opt-in is recorded; resume never creates consent. Closed conversations cannot resume without an explicit staff reopen.

Conversation DTOs include `automationState`, `automationAllowed`, and `automationBlockedReasons`. Reasons distinguish closure, human ownership, inactive module/contact, unavailable messaging permission, and an expired reply window. Eligibility reflects the read transaction, not a promise of delivery. Future automated dispatch must lock the address and re-read these guards in the same transaction as sending; never authorize sending from a cached UI DTO. The future worker must also enforce provider readiness and actual transport support.

Focused verification: `apps/api/src/http/whatsapp-handoff.test.ts` covers signed control ingestion, callback de-duplication, ownership/version conflicts, actor-scoped replay, tenant/clinic/role boundaries, STOP, closure, suspension, and expiry. Root runs it with the migrated isolated test database; no production or live provider verification is implied.

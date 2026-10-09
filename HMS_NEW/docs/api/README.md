# HMS_NEW API (v1)

Backend only; no UI yet. JSON over HTTP. Start locally with `pnpm api:dev` (port 3000) and `pnpm worker:dev`.

## Authentication
Every `/v1` request needs `Authorization: Bearer <token>`.

| Mode | When | Tokens |
|---|---|---|
| `AUTH_MODE=dev` (default) | Local development only (refused when `NODE_ENV=production`) | `pnpm dev:token <subject>` — e.g. `ravi` (front desk), `asha` (doctor), `meena` (nurse), `priya` (tenant admin), `whatsapp-bot` (booking channel) |
| `AUTH_MODE=oidc` | Real environments | From your identity provider; verified against `OIDC_JWKS_URL`, with `OIDC_ISSUER` and `OIDC_AUDIENCE` |

The token's issuer + subject must match an active `platform.user_account`. If one identity has accounts in several tenants, send `X-Tenant-Id`. Integrations (WhatsApp bot, voice agent) use **service accounts**: a staff row flagged `is_system_account` with the `booking_agent` role, so their actions are permission-checked and attributed like a person's.

## Authorization
Each endpoint needs one permission, checked **for the facility involved** (a role granted for one branch doesn't work at another). `GET /v1/me` shows the caller's permissions and their facility scope (`*` = all facilities).

Not yet enforced (comes with the clinical module): care-relationship checks on clinical data. Patient-portal accounts are rejected for now.

## Conventions
| Topic | Rule |
|---|---|
| Idempotency | Creating commands require `Idempotency-Key` (8–128 chars). A retry with the same key and body returns the first result; a different body with the same key → 409 |
| Request id | Send `X-Request-Id` (UUID) to trace a request; it is echoed back and stored on audit and outbox rows |
| Times | Instants are ISO-8601 with offset (`2026-10-19T09:30:00+05:30`); dates are `YYYY-MM-DD` in the facility's local calendar; money is integer paise (`feeMinor: 50000` = ₹500) |
| Lists | `{ "items": [...] }` |
| Errors | `{ "error": { "code", "message", "details" }, "requestId" }` |

| Status | `error.code` | Meaning |
|---|---|---|
| 400 | `validation` | Bad input (`details.issues` lists fields) or missing `Idempotency-Key` |
| 401 | `unauthenticated` | Missing, invalid or expired token |
| 403 | `forbidden` | No account, or missing permission (`details.permission`, `details.facilityId`) |
| 404 | `not_found` / `route_not_found` | Unknown record (including other tenants' records) or route |
| 409 | `conflict` / `idempotency_conflict` | e.g. `details.reason: slot_unavailable`, `walk_ins_full` |
| 422 | `precondition_failed` | Valid request, wrong state: `hold_expired`, `patient_required`, `no_walk_ins`, `no_session` |

## Endpoints

### Service
| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | none | Process is up |
| `GET /ready` | none | Database reachable |
| `GET /v1/me` | any | Caller, tenant, permissions |

### Directory
| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/facilities` | `catalog.read` | Active facilities |
| `GET /v1/practitioners?facilityId&specialty` | `catalog.read` | Doctors with current affiliations |

### Patients
| Method & path | Permission | Purpose |
|---|---|---|
| `POST /v1/patients` 🔑 | `patients.register` @ `registeredFacilityId` | Register; returns `patientId`, `mrn` |
| `GET /v1/patients?q|phone|abhaNumber` | `patients.read` | Search (name typo-tolerant, MRN, phone, ABHA) |
| `GET /v1/patients/:patientId` | `patients.read` | Patient with identifiers and contacts |

### Doctor calendars
| Method & path | Permission | Purpose |
|---|---|---|
| `POST /v1/practitioners/:staffId/calendar` | `schedules.manage` | Create the doctor's calendar (idempotent) |
| `POST /v1/practitioners/:staffId/weekly-sessions` | `schedules.manage` @ facility | Weekly session (slots and/or walk-in tokens) |
| `POST /v1/weekly-sessions/:id/end` | `schedules.manage` | End a weekly session from a date |
| `POST /v1/practitioners/:staffId/exceptions` | `schedules.manage` | Leave (`closed`), `block`, `extra_hours`; returns clashing appointments |
| `POST /v1/facilities/:facilityId/holidays` | `schedules.manage` @ facility | Facility holiday; returns clashing appointments |
| `PUT /v1/practitioners/:staffId/day-plans/:date` | `schedules.manage` @ each block's facility | One-day plan (new revision) |
| `GET /v1/practitioners/:staffId/sessions?from&to` | `appointments.read` | Effective sessions per day |
| `GET /v1/practitioners/:staffId/slots?from&to&facilityId&includeUnavailable` | `appointments.read` | Bookable slots (≤ 31 days) |

### Booking
| Method & path | Permission | Purpose |
|---|---|---|
| `POST /v1/holds` 🔑 | `appointments.book` @ slot's facility | Hold a slot for a few minutes |
| `DELETE /v1/holds/:reservationId` | `appointments.book` | Release a hold |
| `POST /v1/appointments` 🔑 | `appointments.book` @ facility | Book a held slot for a patient and/or a booking party |
| `GET /v1/appointments?from&to&facilityId&staffId&patientId&status` | `appointments.read` | List (facility-scoped staff must pass `facilityId`) |
| `GET /v1/appointments/:id` | `appointments.read` @ facility | One appointment with patient, booker and token |
| `POST /v1/appointments/:id/cancel` | `appointments.cancel` @ facility | Cancel (reason required); frees the slot |
| `POST /v1/appointments/:id/reschedule` 🔑 | `appointments.reschedule` @ both facilities | Move to a newly held slot |
| `POST /v1/appointments/:id/no-show` | `appointments.check_in` @ facility | After the slot ends |
| `POST /v1/appointments/:id/check-in` 🔑 | `appointments.check_in` @ facility | On the day; links `patientId` if needed; issues a token |
| `POST /v1/walk-ins` 🔑 | `appointments.check_in` @ facility | Walk-in straight into today's queue (capacity-limited) |

### Queue
| Method & path | Permission | Purpose |
|---|---|---|
| `GET /v1/queue?staffId&facilityId&date` | `appointments.read` @ facility | The doctor's queue in calling order |
| `POST /v1/queue/call-next` | `queue.manage` @ facility | Next patient (emergency → VIP → senior → normal, then token); 204 when empty |
| `POST /v1/queue-tokens/:id/start` · `/complete` · `/skip` | `queue.manage` @ facility | Consultation progress; complete also completes the appointment |

🔑 = requires `Idempotency-Key`.

## Worker
`pnpm worker:dev` delivers outbox events (exactly once per consumer, retries with exponential backoff, dead-letters after 10 attempts), expires lapsed slot holds every 30 s, keeps monthly audit/outbox partitions ahead daily, and purges expired idempotency records hourly. No event consumers are registered yet: notifications (comms module) and encounter creation (clinical module) will subscribe to `appointment.*` events.

## Try it
```bash
pnpm pg:start && pnpm db:reset && pnpm api:dev
TOKEN=$(pnpm -s dev:token ravi)
curl -s localhost:3000/v1/me -H "authorization: Bearer $TOKEN"
curl -s "localhost:3000/v1/practitioners/01920000-0000-7000-8000-000000000401/slots?from=2026-10-19&to=2026-10-19" -H "authorization: Bearer $TOKEN"
```

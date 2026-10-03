# Exora HMS Virtual OPD — source-grounded implementation plan

Status: end-to-end production implementation plan  
Prepared: 2 October 2026  
Repositories inspected:

- Backend: `/Users/ysw/EXORA/hospital-backend`
- Hospital web frontend: `/Users/ysw/EXORA/hospital-webpage`
- Voice agent: `/Users/ysw/EXORA/voice-agent`

The supplied brief refers to `hms-backend` and `hms-website`, but those directories do not exist under `/Users/ysw/EXORA`. This plan uses the three repositories above, which are the matching working codebases. The repositories contain existing uncommitted work; implementation must preserve it.

## 1. Decision and boundary

Virtual OPD will be an HMS-owned appointment workflow with Jitsi used only for media. An existing appointment whose reservation has `consultation_type == "virtual"` may have exactly one HMS teleconsultation. The HMS backend decides who can see, start, join, and end it. It records consent and lifecycle events, then returns a short-lived, appointment-scoped Jitsi join credential. The browser embeds Jitsi and never receives a reusable Jitsi signing secret.

The voice agent remains an appointment channel. It can discover virtual-capable doctors, find virtual slots, place a hold, and create the appointment through existing service-authenticated routes. It does not create rooms or issue join credentials.

```text
Patient UI / Doctor UI / Voice Agent
                 |
                 | HMS identity or service identity
                 v
       Existing FastAPI HMS backend
       - appointment authorization
       - consent and lifecycle
       - room identity and Jitsi JWT
       - audit and outbox events
                 |
                 | short-lived JWT after every join check
                 v
              Jitsi Meet
       audio/video/device UI only
```

## 2. What actually exists

### Backend

The backend is Python 3.11+ with FastAPI, synchronous SQLAlchemy 2, Pydantic 2 settings and schemas, Alembic migrations, PostgreSQL 17 in Compose, and SQLite for lightweight development/tests. Hatchling builds the package and `uv.lock` is present. Uvicorn starts `app.main:app`; the container runs `alembic upgrade head` first (`pyproject.toml`, `Dockerfile`, `app/main.py`).

The application is a compact module rather than a layered package:

- `app/api.py`: public catalogue, availability, hold, booking, appointment lookup, and cancellation routes.
- `app/admin.py`: administrator-key operations for appointments, schedules, catalogue, analytics, and voice sessions.
- `app/integrations.py`: voice-agent service routes protected by `X-Service-Key`.
- `app/whatsapp.py` and `app/whatsapp_admin.py`: WhatsApp service and operational routes.
- `app/services.py`: booking/hold/cancellation business rules and transaction boundaries.
- `app/models.py`: all SQLAlchemy models.
- `app/schemas.py`: Pydantic request/response models.
- `app/db.py`: engine, declarative base, and session dependency.
- `app/config.py`: environment configuration.

The backend already contains these useful Virtual OPD anchors:

- `Branch.is_virtual` (`app/models.py:30-38`).
- `Doctor.accepts_virtual` (`app/models.py:52-66`).
- `ScheduleRule.consultation_type` and `Reservation.consultation_type` (`app/models.py:69-82`, `95-111`).
- A one-to-one reservation-to-appointment link and basic patient contact fields (`app/models.py:114-129`).
- Appointment status history and transactional outbox records (`app/models.py:132-151`).
- Availability and hold creation already accept `in_person|virtual` (`app/api.py:54-64`, `app/schemas.py`).
- Voice integration already distinguishes in-person and virtual branches and passes the consultation type through availability, holds, and bookings (`app/integrations.py`; voice `app/hospital.py:74-150`).
- Domain errors already use `{ "error": { "code", "message", "request_id" } }` (`app/main.py`).
- Pydantic provides request validation; pytest/httpx provide API tests (`tests/`).
- FastAPI supplies OpenAPI and Swagger at `/docs`.
- Request IDs are assigned and returned, but there is no configured structured application logger.

Database migrations have an immediate issue: both `0003_schedule_dates.py` and `0003_whatsapp_integration.py` descend from `0002_voice_operations.py`. There are two Alembic heads. A merge revision is required before the Virtual OPD migration.

Deployment is Docker Compose with API, PostgreSQL, Redis, and a durable media volume (`compose.yaml`). Redis is configured but not used by the current application code. There is a transactional outbox table, but no general outbox worker.

### Frontend

The hospital site is React 19 + TypeScript on Vite 6, styled with Tailwind CSS v4. It uses component-local React state and direct `fetch`; it has no React Router, global state library, server-state query library, or form library (`package.json`, `src/App.tsx`, `src/lib/hospitalApi.ts`).

Routing is a manual `Page` union synchronized to `?page=...` in `src/App.tsx`. The booking workflow lives in `src/components/booking/ScheduleAppointmentPage.tsx` and calls the shared `hospitalApi`. The API helper knows doctors, availability, holds, and booking, uses the backend error message, and stores a browser owner key in `localStorage` (`src/lib/hospitalApi.ts`).

`AaveLoginFlow.tsx` is a visual preview: it accepts entered details and calls `onLoginSuccess`, while `App.tsx` keeps the resulting user only in component state. It is not backend authentication. `AdminDashboard.tsx` asks for a raw admin key and sends it as a header. It is an operations console rather than a doctor workspace and is not mounted through the normal `App.tsx` page union.

There are no automated frontend test dependencies or test scripts. The build check is `npm run build`.

### Voice agent

The voice agent is another Python FastAPI service with its own local SQLite knowledge/runtime store, local/cloud inference, Whisper STT, Kokoro TTS, and a static browser UI. Its typed `HospitalClient` calls only the HMS backend and sends `X-Service-Key` (`app/hospital.py:1-150`). It already supports virtual doctor discovery and virtual appointment booking. Hospital operational data is not written directly by the voice service.

No Virtual OPD media integration belongs in this service for the MVP. Only appointment language and an optional confirmation response need adjustment after the backend adds a safe patient access-link mechanism.

## 3. Architectural conflicts and prerequisites

The requested end state assumes capabilities that are absent from the inspected source:

| Required concept | Actual repository state | Required resolution |
|---|---|---|
| Existing user authentication | No users, credentials, sessions, bearer-token validation, or patient/staff login exists. Production public booking is simply disabled by `require_public_booking_pilot()` in `app/api.py:19-22`. | Implement first-party identity/session support inside this backend, or integrate the real Exora auth module if it exists in an unprovided repository. Do not ship join endpoints behind browser owner keys or the current admin key. |
| Authorization/RBAC | Voice and WhatsApp use shared service keys; admin uses one shared admin key. | Add actor-aware dependencies and roles (`patient`, `doctor`, `staff_admin`, `service`) and enforce resource relationships in every Virtual OPD query. |
| Hospital/tenant isolation | There is no hospital/tenant table or `hospital_id`. Branch, doctor, reservation, and appointment are global. | Add a hospital root and propagate `hospital_id`; scope unique keys and every query. This must precede multi-hospital release. |
| Doctor identity | `Doctor` is catalogue data and is not linked to a login. | Link an authenticated user membership to a doctor record; deny doctor actions unless the appointment reservation has that doctor. |
| Patient identity | Appointment stores name/phone/email strings only. | Add a patient record and patient membership/login link; backfill/link appointments. An appointment-scoped signed access flow may be used during migration, but it must resolve to backend-owned patient authorization. |
| Encounters, notes, prescriptions, investigations, documents | None of these models/routes exist in this backend. | Treat links as integration interfaces until the actual clinical module is supplied. Do not create duplicate clinical records inside the teleconsultation tables. |
| Audit system | Appointment history and voice tool calls are narrow event logs, not a general security/clinical audit trail. | Add append-only audit events for access decisions, consent, join grants, start/end, and staff actions. Never store Jitsi JWTs in audit payloads. |
| Feature entitlement | Only doctor and branch booleans exist; no hospital feature flags. | Add a `virtual_opd_enabled` hospital setting/entitlement. |
| Migration graph | Two Alembic heads exist. | Merge the heads before adding schema migrations. |
| Jitsi deployment details | No Jitsi host, tenant/app ID, issuer, audience, or signing keys exist. | Choose self-hosted/JaaS-compatible JWT claims in environment configuration and validate them in staging. Jitsi remains replaceable behind one token-minting service. |

Phase 0 is therefore a release gate, not optional cleanup. A UI mock could be built sooner, but a real patient or doctor join flow cannot safely ship on the current identity model.

### 3.1 Current admin dashboard: retain the UI, replace the security model

The current dashboard is functional, but its login is one shared secret rather than an account system. `/admin` selects `AdminDashboard` in `src/main.tsx`; the component stores `avocado_admin_key` in browser `localStorage` and sends it as `X-Admin-Key`. `app/admin.py::require_admin` compares that header to one environment value and returns the hardcoded actor `local-admin`. This is acceptable only as a local bootstrap mechanism.

Production migration:

1. Add named staff accounts and hospital memberships through the backend-owned identity model.
2. Add roles and permissions rather than UI-only checks: `hospital_admin`, `doctor`, `nurse_or_coordinator`, `patient`, and narrow service principals.
3. Replace the dashboard key form with the normal first-party login and an HttpOnly, `Secure`, `SameSite` session cookie. Do not store bearer credentials in `localStorage`.
4. Change every `/api/v1/admin/*` endpoint to use the authenticated actor and explicit permission dependencies. Scope every database query to the actor's hospital.
5. Record the real membership/user ID in appointment history and audit events instead of `local-admin`.
6. Add session listing/revocation, forced logout after password reset or role removal, idle and absolute expiration, login throttling, and MFA for privileged staff.
7. Keep `ADMIN_API_KEY` only as a time-limited, disabled-by-default break-glass/bootstrap path. Restrict it at the network layer, rotate it after bootstrap, audit each use, and remove browser support for it.
8. Migrate existing operational screens—analytics, appointments, doctors, schedules, catalogue, outbox operations, and voice sessions—to permission-aware APIs without changing their useful UI behavior.

Required permission examples:

| Action | Permission | Additional resource rule |
|---|---|---|
| View hospital analytics | `analytics:read` | Same hospital only |
| Manage schedules | `schedule:write` | Doctor and branch belong to same hospital |
| View an appointment | `appointment:read` | Same hospital; doctor view additionally requires assignment unless elevated clinical role |
| Change appointment status | `appointment:write` | Allowed transition and same hospital |
| Start/end Virtual OPD | `teleconsultation:conduct` | Assigned doctor only; an audited reassignment must happen first otherwise |
| View audit events | `audit:read` | Privileged hospital role; sensitive payloads filtered |
| Manage staff/roles | `membership:admin` | Cannot grant permissions beyond own administrative scope |

The admin migration must be complete before production Virtual OPD activation because the current shared key can read every patient's details and cannot prove which clinician performed an action.

## 4. Target data model and migration

### 4.1 Migration graph repair

Create `migrations/versions/0004_merge_schedule_whatsapp.py` with:

```python
revision = "0004_merge_schedule_whatsapp"
down_revision = ("0003_schedule_dates", "0003_whatsapp_integration")
```

It contains no schema operations. Verify `alembic heads` returns one head before continuing.

### 4.2 Foundation migration

Create `migrations/versions/0005_identity_tenancy.py`. If the actual Exora identity module is later supplied, replace this migration with mappings to its tables rather than duplicating them.

- `hospitals`: `id`, `slug`, `name`, `timezone`, `virtual_opd_enabled`, timestamps.
- `users`: `id`, normalized email/phone, status, timestamps. Credential/session implementation stays in the auth module and never in Virtual OPD services.
- `hospital_memberships`: `id`, `hospital_id`, `user_id`, role, status; unique `(hospital_id,user_id,role)`.
- `patients`: `id`, `hospital_id`, `user_id nullable`, existing external/MRN reference nullable, name/contact fields, timestamps.
- Add `hospital_id` to branches, departments, doctors, reservations, appointments, media, and operational records. Initially nullable for backfill; seed one hospital for current data; then make non-null and replace global slug uniqueness with `(hospital_id, slug)`.
- Add `user_id` to doctors through a membership-safe mapping (prefer `doctor_memberships(doctor_id,membership_id)` if a clinician can work at more than one hospital).
- Add `patient_id` to appointments, backfill patient rows from normalized contact details under the seeded hospital, then require it for new authenticated bookings.
- Add indexes on all tenant foreign keys and compound indexes used by appointment listings.

### 4.3 Virtual OPD migration

Create `migrations/versions/0006_virtual_opd.py`:

`teleconsultations`

- `id` UUID string primary key.
- `hospital_id` foreign key and index.
- `appointment_id` unique foreign key to appointments.
- `room_key` unique, opaque, random, non-PHI value; do not derive it from patient name, phone, or confirmation code.
- `status`: `scheduled`, `waiting`, `ready`, `in_progress`, `completed`, `cancelled`, `no_show`.
- `doctor_started_at`, `started_at`, `ended_at`, `last_activity_at`, nullable timezone-aware timestamps.
- `ended_by_actor_type`, `ended_by_actor_id`, `end_reason`, nullable.
- `version` integer for optimistic lifecycle updates.
- created/updated timestamps.

`teleconsultation_consents`

- `id`, `hospital_id`, `teleconsultation_id`, `patient_id`.
- `document_version`, `accepted_at`, `withdrawn_at nullable`.
- `captured_by_actor_type`, `captured_by_actor_id`.
- `ip_address_hash nullable`, `user_agent_hash nullable`; store minimized evidence, not raw device fingerprints.
- Only one active consent per patient/consultation/document version.

`teleconsultation_events`

- Append-only `id`, `hospital_id`, `teleconsultation_id`, `event_type`, actor type/id, safe JSON metadata, request ID, created timestamp.
- Index `(teleconsultation_id, created_at)` and `(hospital_id, created_at)`.

Do not put prescriptions, notes, investigations, or recordings in these tables. If recording is later enabled, it requires a separate consent, retention, storage, access, and deletion design; it is out of MVP scope.

## 5. Backend design

Refactor only enough to keep the current conventions understandable:

### Existing files to modify

- `app/main.py`: include auth and teleconsultation routers; add safe structured logging hooks; retain request IDs and error envelope.
- `app/config.py`: Jitsi host/app/issuer/audience/private-key path or secret reference, JWT TTL, early-join/late-join windows, consent version, feature default. Reject development defaults in production.
- `app/models.py`: foundation and Virtual OPD models/relationships. A later cleanup may split the model file, but do not mix that refactor into the MVP unless necessary.
- `app/schemas.py`: identity-safe appointment summaries, consent, lifecycle, waiting-room status, and join-grant schemas.
- `app/api.py`: authenticated patient appointment access and creation linkage; remove owner-key authorization from production paths after migration.
- `app/admin.py`: keep operational administration; do not use the admin key as doctor identity.
- `app/services.py`: preserve booking behavior; create a teleconsultation in the same transaction when a virtual appointment is confirmed, including history and outbox events.
- `app/integrations.py`: voice booking continues unchanged at the route boundary; response may add a safe appointment delivery indicator, never a reusable join token.
- `app/seed.py`: seed one hospital, memberships/test identities, and virtual schedules for development only.
- `.env.example`, `compose.yaml`, `README.md`, `pyproject.toml`, `uv.lock`: document/configure Jitsi JWT settings and add the smallest maintained JWT/crypto dependency needed by the chosen Jitsi deployment.

### New backend files

- `app/auth.py`: current-actor dependency, first-party session validation, role checks, and tenant context. If real Exora auth is supplied, this becomes its adapter.
- `app/authorization.py`: reusable appointment/patient/assigned-doctor/hospital policy checks. Resource queries must include `hospital_id`; avoid fetch-then-check patterns that can expose cross-tenant existence.
- `app/teleconsultation_api.py`: HTTP routes only.
- `app/teleconsultation_service.py`: state transitions, consent rules, join eligibility, idempotency, and event/outbox writes.
- `app/jitsi.py`: room name derivation and short-lived JWT minting. Unit-test claims and expiry independently.
- `app/audit.py`: append-only audit helper with sensitive-field filtering.
- `tests/test_auth.py`, `tests/test_tenant_isolation.py`, `tests/test_teleconsultations.py`, `tests/test_jitsi_tokens.py`.

### API contract

All browser routes require an authenticated HMS actor and infer hospital/user identity from the session. They must not accept actor IDs, patient IDs, hospital IDs, or doctor IDs from the request body when those values are determined by authentication.

Patient routes:

- `GET /api/v1/me/appointments?consultation_type=virtual&from=...`
- `GET /api/v1/me/appointments/{appointment_id}`
- `GET /api/v1/me/appointments/{appointment_id}/teleconsultation`
- `POST /api/v1/me/appointments/{appointment_id}/teleconsultation/consent` with `document_version` and `accepted=true`.
- `POST /api/v1/me/appointments/{appointment_id}/teleconsultation/check-in` transitions `scheduled -> waiting` after valid consent and time-window checks.
- `GET /api/v1/me/appointments/{appointment_id}/teleconsultation/status` for low-frequency polling. Return `retry_after_seconds`.
- `POST /api/v1/me/appointments/{appointment_id}/teleconsultation/join-grant` returns `{domain, room_name, jwt, expires_at, display_name, role}` only when assigned patient, consent, appointment status, time window, entitlement, and consultation state all permit it.
- `POST /api/v1/me/appointments/{appointment_id}/teleconsultation/leave` records departure without ending the clinical consultation.

Doctor routes:

- `GET /api/v1/doctor/appointments?consultation_type=virtual&date=...`
- `GET /api/v1/doctor/appointments/{appointment_id}` after tenant and assignment checks.
- `POST /api/v1/doctor/appointments/{appointment_id}/teleconsultation/start` changes `scheduled|waiting|ready -> in_progress`, is idempotent, and creates an audit/outbox event.
- `POST /api/v1/doctor/appointments/{appointment_id}/teleconsultation/join-grant` returns a moderator credential only to the assigned doctor.
- `POST /api/v1/doctor/appointments/{appointment_id}/teleconsultation/end` changes `in_progress -> completed`, requires a reason only for exceptional endings, and is idempotent.

Clinical links returned by the doctor appointment detail should be capability URLs or frontend route metadata supplied by the existing clinical module. Until that module exists, return `null` capabilities and hide the actions. Never emulate clinical notes or prescriptions in browser storage.

### Lifecycle rules

```text
virtual appointment confirmed -> scheduled
patient accepts current consent + checks in -> waiting
doctor opens/acknowledges queue (optional) -> ready
assigned doctor starts -> in_progress
doctor explicitly ends -> completed

scheduled|waiting|ready -> cancelled  (appointment cancelled)
scheduled|waiting|ready -> no_show    (staff reconciliation after time window)
```

- Appointment `status` remains the scheduling status; teleconsultation `status` represents the call workflow.
- Patient join is denied before consent and before doctor start. The waiting-room page is HMS UI, not a Jitsi lobby.
- Doctor can receive a moderator join grant as part of/start immediately after `start`.
- A disconnect does not end the consultation. A fresh grant can be minted while `in_progress`; all grants are short-lived.
- Ending the Jitsi iframe does not automatically mark the clinical workflow complete. Only the backend `end` action does so.
- Every mutation uses database locking or optimistic `version` checks, validates allowed transitions, emits `teleconsultation.*` outbox events in the same transaction, and returns the current resource on an idempotent retry.

### Jitsi token policy

- JWT lifetime: 5 minutes for entry; active Jitsi sessions follow server policy. Mint a new token for reconnect.
- Claims bind tenant/app, opaque room name, stable HMS actor ID, display name, role/moderator flag, `iat`, `nbf`, and `exp`.
- Patient tokens never receive moderator privileges.
- The signing key exists only in backend secrets. Rotate by key ID where supported.
- Permit join only within a configured window (proposed default: 15 minutes before to 60 minutes after scheduled end) and only while the appointment is confirmed and Virtual OPD entitlement is enabled.
- Apply rate limits to consent, check-in, status, start/end, and join-grant endpoints. Redis can support distributed limits once wired; tests must not rely on in-memory process state.
- Use exact allowed origins in production and a CSP whose `frame-src`, `connect-src`, camera, and microphone permissions cover only the selected Jitsi domain.

## 6. Frontend design

The MVP can follow the existing manual routing to minimize churn. A later move to React Router is sensible but not required for Virtual OPD.

### Existing frontend files to modify

- `src/App.tsx`: add `virtual-opd` patient page and `doctor-virtual-opd` workspace to the `Page` union, URL synchronization, rendering, and authenticated route gates.
- `src/lib/hospitalApi.ts`: replace browser owner-key access for authenticated flows; add session credentials, typed error codes, appointment/teleconsultation calls, and abort support.
- `src/components/auth/AaveLoginFlow.tsx`: replace preview-only completion with the backend session flow or wrap it with an auth adapter. Rename when product naming is finalized.
- `src/components/booking/ScheduleAppointmentPage.tsx`: clearly label virtual slots, persist the returned appointment through backend identity, and route successful virtual bookings to the appointment detail/waiting-room page.
- `src/components/admin/AdminDashboard.tsx`: add operational visibility only (status, failures, audit reference). The doctor workflow should be a distinct authenticated view.
- `src/styles/index.css`: shared responsive/video/waiting-room states.
- `.env.example`, `README.md`, `package.json`, `package-lock.json`: Jitsi domain/config and test dependencies.

### New frontend files

- `src/lib/auth.ts`: session bootstrap, current actor, logout, and role gates.
- `src/lib/teleconsultationApi.ts`: typed Virtual OPD API facade.
- `src/components/virtual-opd/PatientVirtualOpdPage.tsx`: appointment summary, consent, device check, waiting status, call, reconnect, completion, and clinical output links.
- `src/components/virtual-opd/DoctorVirtualOpdWorkspace.tsx`: assigned queue, patient summary, consent state, start/join/end, and clinical capability links.
- `src/components/virtual-opd/ConsentCard.tsx`.
- `src/components/virtual-opd/DeviceCheck.tsx`: browser permission/device enumeration and local preview; do not upload media.
- `src/components/virtual-opd/JitsiConsultation.tsx`: isolated wrapper around the Jitsi External API with cleanup, event mapping, and reconnect controls.
- `src/components/virtual-opd/ConsultationStatus.tsx`.
- `src/components/virtual-opd/VirtualOpdErrorBoundary.tsx`.
- `src/components/virtual-opd/*.test.tsx` plus test setup after adding Vitest, Testing Library, and Mock Service Worker.

### Patient screen behavior

1. Load session and appointment from HMS; an unauthorized user gets a generic not-found/unauthorized screen without resource details.
2. Show doctor, schedule in branch timezone, reason, appointment status, and Virtual OPD state.
3. Show versioned consent. Record it in the backend before enabling check-in.
4. Run camera/microphone checks with clear permission guidance and allow selecting devices. Device checks are advisory; no media leaves the browser.
5. Check in and poll the HMS status with server-provided intervals, pause polling in background tabs, and back off on errors.
6. When `in_progress`, request a fresh join grant and create the embedded Jitsi instance.
7. On transient disconnect, show reconnect and request a new grant. Do not reuse an expired JWT.
8. On local hangup, call `leave`; remain able to reconnect until the doctor ends the consultation.
9. On `completed`, remove the iframe and show prescription/investigation/follow-up/document actions only when the backend reports those existing capabilities.

### Doctor screen behavior

The queue lists only appointments assigned to the logged-in doctor. Opening one shows the existing patient/appointment context and consent status. Start is disabled until consent is present unless an explicitly audited staff-assisted consent policy is implemented. Starting calls the backend, then requests a moderator join grant. Jitsi occupies a resizable panel so the doctor can use the clinical workflow alongside it. End requires an explicit click and confirms the final state from the backend.

Use Jitsi iframe events only for UI feedback and telemetry. They are not authoritative lifecycle transitions.

## 7. Voice-agent changes

Existing virtual booking should be retained and regression-tested. Modify only:

- `app/hospital.py`: accept any new safe response fields from virtual appointment confirmation; never call browser join-grant endpoints and never store Jitsi credentials.
- `app/workflows.py` and `app/agent.py`: after a virtual booking, explain that the patient will use the authenticated hospital website/access message and must provide consent before joining. Do not claim the doctor has started until the HMS reports that state.
- `tests/test_hospital.py`, `tests/test_workflows.py`, `tests/test_agent.py`: virtual booking and language tests.
- `.env.example`/`compose.yaml`: no Jitsi signing configuration belongs here. Ensure `HOSPITAL_API_URL` and `HOSPITAL_SERVICE_KEY` are actually included in Compose; they currently are present in Python config but absent from the shown service environment.

If appointment access links are sent, the backend/outbox notification worker owns generation and delivery. The voice agent may say where the patient will receive the link, but must not construct one.

## 8. Delivery order

### Phase 0 — unblock the architecture

1. Resolve the two Alembic heads and add a migration CI check.
2. Locate and integrate the real Exora identity/clinical modules if they exist outside these repositories. If they do not, implement backend-owned identity, sessions, memberships, and tenant scoping described above.
3. Link doctor logins and patient identities to current records; migrate existing appointments safely.
4. Replace preview login/admin-key doctor access with real sessions and actor-aware dependencies.
5. Establish clinical capability interfaces without duplicating records.

Exit: cross-tenant, wrong-patient, and wrong-doctor API tests pass; no Virtual OPD join can be authorized with an owner key or shared admin key.

### Phase 1 — backend Virtual OPD core

1. Add teleconsultation/consent/event models and migrations.
2. Create a teleconsultation transactionally for every newly confirmed virtual appointment; write a backfill command for existing confirmed virtual appointments.
3. Implement lifecycle and patient/doctor endpoints.
4. Implement Jitsi JWT minting and claim tests.
5. Add audit and outbox events.

Exit: complete API state-machine tests and authorization matrix pass on PostgreSQL as well as SQLite-compatible unit tests.

### Phase 2 — patient experience

1. Add authenticated appointment detail, consent, device check, waiting room, embedded Jitsi, reconnect, and completion states.
2. Add accessible keyboard/focus behavior, mobile layout, permission-denied guidance, and graceful unsupported-browser handling.
3. Add component/API tests and production build validation.

### Phase 3 — doctor experience and clinical wiring

1. Add assigned Virtual OPD queue and call workspace.
2. Wire real patient chart, notes, prescription, investigation, and follow-up routes through capabilities from the existing clinical module.
3. Add explicit end/no-show flows and operational visibility.

### Phase 4 — voice, operations, and rollout

1. Update virtual-booking confirmations and tests in the voice service.
2. Deploy Jitsi/config in staging; validate CSP, camera/mic permissions, JWT issuer/audience, moderator behavior, and reconnect on mobile networks.
3. Enable the hospital entitlement for internal accounts, then a pilot hospital.
4. Monitor join-grant denials, time-to-doctor-start, reconnects, abandoned waiting rooms, no-shows, and completion reconciliation using non-PHI identifiers.

### Phase 5 — production platform and operations

1. Build immutable backend/frontend/voice images in CI, generate an SBOM, scan dependencies and containers, sign release artifacts, and promote the same artifact through staging and production.
2. Run PostgreSQL as a managed or properly operated production database with encrypted storage, point-in-time recovery, automated backups, restore drills, connection pooling, restricted database roles, and migration credentials separate from runtime credentials.
3. Deploy at least two stateless backend instances behind TLS termination and health checks. Use Redis for distributed rate limiting and short-lived coordination only; never make Redis the system of record.
4. Deploy the frontend behind a CDN/origin with HTTPS, strict security headers, controlled caching, and an SPA fallback for `/admin` and Virtual OPD paths.
5. Deploy or contract a production Jitsi environment with TLS, JWT-required room creation, anonymous room creation disabled, geographic/data-residency choice recorded, capacity testing, monitoring, TURN service, and documented upgrade/rollback procedures.
6. Put all secrets in a secrets manager: database credentials, session signing/encryption keys, Jitsi signing keys, service keys, notification credentials, and break-glass credentials. Define rotation, revocation, ownership, and expiry.
7. Add centralized structured logs, metrics, traces, dashboards, and paging. Filter PHI and credentials at the application and collector; define retention by data class.
8. Add notification delivery workers for appointment confirmation, consent/access instructions, reminders, doctor-running-late notices, cancellation, and follow-up availability. Workers consume the transactional outbox with idempotent delivery and dead-letter/retry handling.
9. Complete privacy, telemedicine, accessibility, clinical safety, incident-response, business-continuity, and vendor reviews before enabling real patients.
10. Establish support ownership, runbooks, on-call escalation, status communication, and a pilot-to-general-availability rollout.

Exit: production readiness review is signed off, restore and regional/Jitsi failure exercises pass, operational dashboards and alerts are live, and a rollback has been rehearsed.

## 9. Full production workstreams

### 9.1 Identity, authentication, and session lifecycle

The same HMS backend remains the identity authority. No Keycloak, Auth0, Firebase, Clerk, or separate auth backend is introduced.

- Staff onboarding: hospital administrator invites a staff member; invitation is single-use, hashed at rest, scoped to a hospital/role, and expires. Activation verifies contact details, sets credentials, enrolls MFA where required, and records acceptance of staff policies.
- Patient onboarding: verified phone/email OTP or an approved existing patient-portal credential links the account to a patient record. OTP values are hashed, short-lived, attempt-limited, and delivered through the notification subsystem. Contact matching alone never silently merges patients.
- Sessions: opaque random session ID in an HttpOnly cookie; store only a hash server-side with user, membership, creation, last activity, absolute expiry, device label, and revocation time. Rotate the session at login and privilege changes and protect state-changing requests with SameSite plus CSRF defense appropriate to the deployment.
- Passwords, if used: a modern password hash, breached-password screening where approved, reset tokens that are hashed/single-use/short-lived, no security questions, and no password material in logs.
- MFA: required for hospital administrators and recommended/rollout-controlled for doctors; recovery codes are hashed and one-time use.
- Account controls: rate limits, progressive delays, generic account-recovery responses, lock/recovery audit events, disablement, membership suspension, and emergency revocation.
- Service principals: voice, WhatsApp, notification worker, and migration/operations identities get separate credentials, narrow scopes, rotation dates, and network restrictions. Replace equality-to-one-global-key dependencies with scoped service-principal validation.

New supporting tables should include `credentials` (if passwords are used), `sessions`, `login_challenges`, `mfa_methods`, `invitations`, `service_principals`, and `service_credentials`. Sensitive tokens are stored hashed; encryption keys and signing keys remain in the secrets manager.

### 9.2 Authorization and tenant isolation

- Define permissions centrally and enforce them in backend dependencies/services. Frontend role gates improve UX but never grant access.
- Carry `hospital_id` from the authenticated membership, not request data. All repositories/queries require tenant context.
- Use compound foreign-key or service-layer invariants so an appointment cannot connect a patient, doctor, reservation, and branch from different hospitals.
- Add negative tests for every endpoint using valid identifiers from another tenant.
- Introduce an explicit, audited clinician reassignment workflow. Starting a consultation is never the reassignment mechanism.
- Separate support/operator access from hospital access. Any vendor support impersonation requires a case, reason, expiry, visible banner, audit trail, and least privilege.
- Review response schemas to prevent patient phone/email/reason leakage in analytics, logs, browser errors, and list endpoints.

### 9.3 Patient, clinical, and document foundations

The current repository does not include a complete EHR/clinical workflow. Production delivery must either integrate the actual Exora clinical modules or build them in the same backend under a separately approved clinical design:

- Patient identity and MRN/external-ID mapping with merge/unmerge controls and audit.
- Encounter/visit created or linked from the appointment and teleconsultation.
- Clinical note with author, encounter, version history, signed/final state, amendment workflow, and access controls.
- Prescription with prescriber identity, medication coding/validation appropriate to the jurisdiction, signature/finalization, printable patient artifact, and amendment/cancellation handling.
- Investigation/order with ordering clinician, status, result/document relationship, and patient visibility rules.
- Follow-up appointment relationship to the originating encounter.
- Patient documents with metadata, malware scanning, encrypted object storage, short-lived download URLs, retention, and access audit.

Virtual OPD stores only foreign-key relationships/capabilities to these records. Clinical content is never copied into Jitsi metadata, teleconsultation event JSON, analytics, or the voice agent.

### 9.4 Jitsi, TURN, and media operations

- Decide and document self-hosted Jitsi versus an approved managed Jitsi offering. Record data flow, regions, subprocessors, retention, telemetry, and support SLA.
- Require JWT authentication for protected rooms. Disable public room creation and validate issuer, audience, tenant/app ID, room, expiry, and moderator claims.
- Generate opaque room identifiers with sufficient entropy. Never expose patient/doctor names, appointment confirmation codes, phone numbers, or MRNs in room names.
- Operate TURN with time-limited credentials if supported, TLS, capacity monitoring, and egress-cost alarms. Test restrictive corporate and mobile networks.
- Size conference bridges for expected concurrent calls and test overload behavior. Define admission limits and a patient-friendly capacity error path.
- Monitor signaling, bridge health, join time, packet loss, reconnects, and failed media permissions without collecting clinical content.
- Disable recording, streaming, transcription, dial-out, unauthenticated guests, and unneeded integrations for MVP.
- Pin and regularly upgrade Jitsi components in staging first. Maintain a rollback and a browser-compatibility matrix.

### 9.5 Notifications and patient access

- The backend creates notification intents in the transactional outbox in the same transaction as appointments/lifecycle changes.
- A dedicated worker claims events with `FOR UPDATE SKIP LOCKED` or an equivalent safe mechanism, sends through approved email/SMS/WhatsApp providers, stores provider message IDs and delivery state, retries transient failures with backoff, and dead-letters permanent failures for operations.
- Messages contain minimal information. Access URLs use one-time, short-lived, hashed tokens that lead to backend verification/session establishment; URLs never contain Jitsi JWTs or PHI.
- Consent, marketing, transactional, and reminder preferences remain separate. Delivery failure never changes the appointment's authoritative state.
- Provide staff resend/revoke actions with throttling and audit.

### 9.6 Security engineering

- Create a threat model covering account takeover, shared/admin-key leakage, appointment enumeration, cross-tenant access, token replay, malicious iframe events, room guessing, moderator escalation, CSRF/XSS, webhook forgery, uploaded-document malware, denial of service, insider access, and log leakage.
- Set CSP, Permissions-Policy (`camera`, `microphone`, `display-capture` as needed), HSTS, frame policy, content-type, referrer, and cache headers per frontend/backend/Jitsi origin.
- Restrict CORS to exact production origins. Never use wildcard origins with credentials.
- Validate request sizes/types; rate-limit login, OTP, booking, consent, polling, join grants, and administration. Add global abuse protection at the edge.
- Encrypt transport everywhere and sensitive storage at rest. Document application-level encryption needs for especially sensitive fields.
- Run SAST, secret scanning, dependency/container scanning, migration linting, and license policy in CI. Patch critical issues under a defined SLA.
- Commission an independent penetration test before general availability and after material identity/media changes.
- Define security-contact, vulnerability disclosure, incident severity, containment, credential rotation, evidence preservation, notification, and post-incident procedures.

### 9.7 Privacy, consent, retention, and audit

- Legal/clinical owners approve telemedicine consent text and versioning for the operating jurisdictions. Store who consented, what version, when, how, and any withdrawal.
- Publish clear privacy and telemedicine notices before device permission or call entry.
- Complete data inventory and flow diagrams across browser, HMS, Jitsi, TURN, notification providers, logs, analytics, object storage, and backups.
- Define retention/deletion schedules separately for sessions, consent, audit, appointments, clinical records, notification delivery, and infrastructure logs. Apply legal-hold rules where required.
- Implement patient access/correction/export/deletion workflows to the extent permitted for clinical records, with identity verification and audit.
- Audit events are append-only, time-synchronized, access-controlled, exportable, and protected against casual modification. Audit reads as well as writes for sensitive clinical data.
- Keep analytics de-identified/minimized and prohibit session replay or third-party trackers on consultation pages.

### 9.8 Reliability, database, and disaster recovery

- Production PostgreSQL uses high availability appropriate to the service target, encrypted backups, point-in-time recovery, replica/backup monitoring, and capacity alerts.
- Set and test RPO/RTO with business owners. Run scheduled restore drills into isolated infrastructure and record evidence.
- Use expand/migrate/contract database changes so old and new application versions can overlap during deployment. Backfills are resumable, observable, tenant-safe, and do not hold long locks.
- Make all externally retried mutations idempotent. Outbox delivery is at-least-once and consumers deduplicate.
- Add database timeouts, connection-pool limits, graceful shutdown, health/readiness checks that reflect dependencies without causing restart storms, and circuit breakers/timeouts around Jitsi/notification providers.
- Define degraded behavior: appointments and clinical records remain available when Jitsi is down; join shows a clear service message; no fake consultation start/completion is recorded.
- Reconcile stuck consultations and pending outbox messages with safe scheduled jobs and operator tooling.

### 9.9 Observability and support

- JSON logs include timestamp, service, environment, release, request ID, tenant ID surrogate, actor surrogate, route, status, latency, and safe error code. They exclude names, contacts, reasons, clinical text, cookies, auth headers, OTPs, and Jitsi tokens.
- Metrics include request/error/latency, database pool, auth failures, OTP delivery, appointment creation, consent/check-in, waiting duration, join grants and denial reasons, doctor start latency, call reconnect, explicit completion, outbox lag, worker failures, and Jitsi/TURN health.
- Distributed traces propagate request IDs through backend and workers with sensitive attributes filtered.
- Dashboards serve engineering, hospital operations, and security with appropriate access separation.
- Alerts use symptom-based thresholds and include runbook links. Test alert routing and after-hours escalation.
- Support tools show safe diagnostic status, allow audited notification resend/revocation, and never reveal secrets or join tokens.

### 9.10 CI/CD and environments

- Environments: isolated local, automated test, staging, and production accounts/networks/databases/secrets. Never clone production PHI into lower environments; use synthetic fixtures.
- Pull requests run formatting/linting, type checks, unit/API/component tests, tenant authorization tests, migration upgrade checks, frontend build, voice regression tests, security scans, and image builds.
- Staging runs real browser patient/doctor journeys against protected Jitsi/TURN and notification sandboxes.
- Production deploys require reviewed migrations, backup confirmation, automated smoke tests, health/error monitoring, and a rollback decision window.
- Use canary or rolling deployment for stateless services. Feature entitlement controls Virtual OPD activation by hospital independently of code deployment.
- Record release, schema version, configuration revision, approver, and rollback in a deployment audit trail.

### 9.11 Product and accessibility completeness

- Patient and doctor views meet WCAG 2.2 AA targets: keyboard operation, focus management, semantic status announcements, color contrast, captions/support information, zoom/reflow, and accessible permission/error guidance.
- Localize user-facing dates, time zones, consent versions, and notifications. Persist UTC and render the appointment/hospital timezone explicitly.
- Provide clear empty, loading, delayed-doctor, no-show, cancelled, device-denied, unsupported-browser, capacity, Jitsi-down, session-expired, and reconnect states.
- Add a pre-call help path and emergency warning appropriate to the hospital; Virtual OPD is not presented as emergency care.
- Define operational policies for late doctor, late patient, reassignment, cancellation during waiting, technical failure, failed consent, no-show, and manual completion correction.

### 9.12 Ownership and required decisions

Before implementation locks the design, assign named owners and deadlines for:

- Product/clinical: lifecycle, no-show, reassignment, clinical output workflow, emergency wording.
- Legal/privacy: consent copy/version, data residency, retention, vendors, patient rights.
- Security: identity/session/MFA policy, threat model, penetration test, break-glass access.
- Platform: hosting, PostgreSQL/Redis, secrets, Jitsi/TURN, backup/restore, on-call.
- Operations: appointment support, notification failures, doctor delays, reconciliation.
- Engineering: backend, frontend, voice, clinical integration, QA automation, release.

Unresolved choices must be recorded as architecture decision records. The largest blocking decision is whether the real Exora identity and clinical modules exist elsewhere; if they do, their APIs and schema must replace the provisional foundation described here.

## 10. Verification matrix

Backend tests must cover:

- Patient can read/join only their own appointment in their hospital.
- Doctor can read/start/join/end only an appointment assigned to their doctor identity.
- Staff/admin roles do not automatically receive Jitsi moderator access.
- Cross-hospital IDs return a non-enumerating response.
- In-person appointments cannot create or join a teleconsultation.
- Consent version and withdrawal rules; no join before active consent.
- Early/late join windows, cancelled appointment, disabled entitlement, inactive membership.
- Every lifecycle transition, invalid transition, duplicate request, and concurrent start/end.
- Token room, subject, role, issuer/audience, expiry, and absence of PHI.
- Reconnect issues a fresh short-lived credential without changing lifecycle.
- Virtual booking creates appointment, teleconsultation, history, and outbox atomically.
- Migration upgrade from both former heads through merge and downgrade in a disposable database.

Frontend tests must cover consent gating, device denial, waiting-to-live polling, Jitsi load failure, reconnect, doctor end, session expiry, and clinical actions hidden when capabilities are unavailable. Run `npm run build`, backend `pytest`, voice-agent `pytest`, and a two-browser end-to-end scenario with separate patient and doctor accounts.

Manual acceptance requires Chrome/Safari/Edge on desktop and iOS/Android browsers, camera/mic switching where supported, background/foreground recovery, weak-network reconnect, doctor and patient hangup in both orders, and confirmation that Jitsi never grants a patient moderator controls.

Additional production verification:

- Restore a production-format encrypted backup and meet the agreed RPO/RTO.
- Fail a backend instance, Redis, a notification provider, Jitsi signaling, a bridge, and TURN independently; verify defined degraded behavior and alerts.
- Load-test catalogue/booking APIs, waiting-room polling, join grants, concurrent consultations, database connections, Jitsi bridges, and TURN relay traffic at forecast peak plus safety margin.
- Run DAST and independent penetration testing with explicit cross-tenant and role-escalation scope.
- Verify session revocation, MFA recovery, staff removal, signing-key rotation, service-key rotation, and break-glass audit.
- Verify retention/deletion jobs, audit export, patient data export, and legal-hold exceptions using synthetic data.
- Conduct clinical and support tabletop exercises for wrong-patient selection, doctor reassignment, dropped call during prescription, consent dispute, and Jitsi outage.
- Validate accessibility with automated tools and manual keyboard/screen-reader testing.

## 11. MVP scope and release gates

Included: scheduled virtual appointment, authenticated appointment view, versioned consent, HMS waiting room, device check, assigned-doctor start, embedded Jitsi, reconnect, explicit doctor completion, and links into real clinical outputs where available.

Deferred: recording, transcription, group consultations, guest participants, instant/on-demand matching, payments/refunds, remote examination devices, AI clinical summaries, and replacement clinical record modules.

The feature is ready for production only when:

- identity and tenant isolation are real and tested;
- Jitsi signing secrets remain backend-only and rotate safely;
- consent and lifecycle events are auditable;
- the assigned doctor and patient authorization matrix passes;
- the actual clinical workflow is linked or absent actions are honestly hidden;
- PostgreSQL migrations have one linear head and pass on a production-like backup restore;
- legal/privacy review approves the consent copy, retention, and selected Jitsi deployment region/configuration;
- no recording is enabled by default.

Production release additionally requires:

- named staff authentication, tenant-scoped RBAC, MFA for privileged roles, and retirement of browser admin-key login;
- the real patient/encounter/prescription/investigation/document workflow integrated and clinically approved;
- notification delivery, access-link recovery, and operations tooling running with measurable delivery status;
- Jitsi/TURN capacity, security configuration, monitoring, and failure behavior validated;
- CI/CD, artifact provenance, vulnerability management, secret rotation, backup/restore, observability, incident response, and on-call processes operating in staging;
- legal/privacy/security/vendor and accessibility sign-offs recorded;
- a limited pilot completed with agreed success/error thresholds before general availability.

## 12. Concrete repository change inventory

In addition to the feature files listed earlier, production work is expected to add or change:

Backend:

- New: `app/auth_api.py`, `app/auth_service.py`, `app/permissions.py`, `app/session.py`, `app/notifications.py`, `app/outbox_worker.py`, `app/jobs.py`, `app/clinical_capabilities.py`, `app/logging_config.py`.
- New migrations after the head merge: identity/tenancy, session/MFA/service principals, patient/appointment linkage, Virtual OPD, notification delivery/audit, and later constraint-hardening migrations.
- Modify: `app/admin.py` for account/RBAC authorization and tenant-scoped queries; `app/whatsapp*.py` and `app/integrations.py` for scoped service principals; `app/media.py` for production object-storage/malware-scan integration where clinical documents use it; health endpoints for safe readiness behavior.
- New commands/scripts using the project's Python package conventions for tenant backfill, patient linkage review, virtual-appointment backfill, reconciliation, and safe bootstrap administration.
- New tests for admin migration, sessions/MFA, service principals, tenancy, notification/outbox, migrations/backfills, clinical capabilities, audit filtering, and failure modes.

Frontend:

- New: account activation/login/MFA/recovery/session-management screens; role-aware admin shell; staff/membership management; notification/access recovery; support-safe diagnostics.
- Modify `AdminDashboard.tsx` to remove `localStorage` admin keys and consume current-actor/permission APIs.
- Add test/lint/typecheck scripts and browser E2E configuration; add CSP-compatible Jitsi loading rather than an unrestricted runtime script injection.

Voice agent:

- Replace its global service key with a scoped/rotatable service principal contract when the backend supports it.
- Add structured redacted logging, release metadata, health/dependency metrics, and production secrets injection.
- Keep it outside consultation media and clinical-record authorization.

Infrastructure/repository operations:

- Add environment-specific deployment manifests or infrastructure-as-code for backend, frontend, worker, PostgreSQL, Redis, object storage, secrets, Jitsi, JVB, and TURN.
- Add CI workflows, image definitions with pinned bases, migration job, smoke tests, monitoring/alert rules, dashboards, backup policies, and operational runbooks.
- Add architecture decision records, data-flow/threat models, API/OpenAPI publication, incident/restore/Jitsi outage runbooks, and a production readiness checklist.

Exact infrastructure file paths depend on the deployment platform, which is not represented in the inspected repositories. They must be chosen once the hosting target is confirmed rather than inventing Kubernetes, ECS, or another platform in advance.

## 13. First implementation slice

The safest first pull request should contain only the Alembic merge revision, an architecture decision for the actual Exora identity/clinical modules, the production identity and tenant schema/API contract, an authorization test harness, and Virtual OPD API contract types. It must also define how the existing admin dashboard migrates from `X-Admin-Key` to named staff sessions.

The second pull request should implement identity/session/membership foundations and convert admin endpoints/UI to tenant-scoped RBAC. The third should add the teleconsultation schema/state machine and Jitsi token service. Patient and doctor UI follows after those authorization guarantees are executable. Notifications, worker reliability, production infrastructure, observability, security validation, and operational readiness then progress as first-class release workstreams rather than post-launch cleanup.

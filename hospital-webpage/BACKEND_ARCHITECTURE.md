# Avocado Health Platform — Backend and Voice Architecture Plan

**Document status:** Proposed implementation plan  
**Audience:** Engineering, product, operations, security, and clinical governance  
**Frontend:** `hospital-webpage`  
**Existing voice prototype:** `voice-agent`  
**Last updated:** 24 September 2026

---

## 1. Executive summary

Avocado Health should be built as a small set of independently deployable services connected through stable, authenticated APIs:

1. **Core Backend** — owns doctors, branches, schedules, slot holds, appointments, patient accounts, content, consent, staff operations, and audit records.
2. **Voice Agent** — owns real-time audio, speech recognition, speech synthesis, conversational orchestration, retrieval, and voice-session state.
3. **Background Worker** — performs notifications, reminders, document processing, retries, and other asynchronous work.
4. **Hospital Web App** — consumes the Core Backend and optionally starts a voice session through a short-lived ticket.

The Core Backend is the only source of truth for appointment and schedule state. The website, staff tools, and voice agent all call the same booking application services. The Voice Agent may explain availability or confirm a booking only from a successful Core Backend response; it must not maintain a separate schedule or infer that a booking succeeded.

The recommended starting point is a **modular FastAPI monolith for the Core Backend**, not a large microservice estate. The Voice Agent remains a separate deployment because its WebSocket lifecycle, compute profile, model dependencies, scaling behavior, and failure modes are materially different from ordinary API traffic.

---

## 2. Current system assessment

### 2.1 Hospital frontend

The current React 19/Vite frontend is a high-fidelity static application. It already contains user journeys for:

- Hospital discovery and department browsing
- Doctor search and doctor profiles
- Appointment scheduling and a booking modal
- Branch and location discovery
- Health packages and insurance information
- FAQs, blog content, and legal documents
- Simulated login
- AI-assisted department selection
- WhatsApp-based appointment follow-up

At present:

- Doctors, departments, branches, packages, hospital details, and much of the content are TypeScript constants.
- Authentication is held only in React state.
- Appointment submission is not persisted.
- Availability shown by the interface is not connected to a shared scheduling system.
- Client-side symptom matching is based on keywords.
- No staff workflow exists for managing schedules or bookings.

These static structures are useful seed data, but the database must become authoritative once backend integration begins.

### 2.2 Existing voice-agent backend

The current FastAPI voice prototype already implements valuable capabilities:

- Real-time voice communication over WebSockets
- Voice activity detection and interruption handling
- Speech-to-text and text-to-speech
- Local/cloud language-model routing
- Hospital document ingestion and hybrid retrieval
- Conversation transcripts, sources, latency metrics, and enquiry extraction
- Safety-oriented prompting that avoids diagnosis and unsupported claims

It is not yet the production hospital backend because it currently:

- Uses local SQLite storage
- Enforces a single active conversation through a process-level lock
- Assumes local-host origins and deployment
- Contains demo hospital data and configuration
- Captures pending enquiries instead of performing real schedule transactions
- Stores knowledge, settings, sessions, and audit records in the same local database
- Does not authenticate calls to a separate booking platform

The voice pipeline should be retained and evolved, but it should call the new Core Backend for transactional operations.

---

## 3. Goals and non-goals

### 3.1 Goals

- Make the database the authoritative source for doctors, locations, schedules, and appointments.
- Provide one booking implementation shared by web, staff, and voice channels.
- Prevent double-booking during concurrent requests.
- Support authenticated patient and staff experiences.
- Support appointment creation, cancellation, and rescheduling with a complete audit history.
- Let the Voice Agent check live availability and safely complete permitted booking workflows.
- Keep clinical and personal data exposure to the minimum needed for each workflow.
- Allow independent scaling and deployment of HTTP API traffic and voice inference traffic.
- Define stable versioned contracts and generate the frontend API client from OpenAPI.
- Provide observability, recovery, and operational controls suitable for production use.

### 3.2 Initial non-goals

- A full electronic medical record system
- Clinical notes, prescriptions, or medication management
- Autonomous diagnosis or treatment recommendations
- Automated interpretation of laboratory or imaging reports
- Insurance claim adjudication
- Complex inpatient bed management
- A broad event-driven microservice platform
- Direct integrations with every hospital information system in the first release

These can be considered later behind explicit governance and security reviews.

---

## 4. Architecture principles

1. **One source of truth:** schedule and appointment state exists only in the Core Backend database.
2. **Channel neutrality:** web, voice, and staff workflows call the same application services.
3. **Transactional booking:** a booking is confirmed only by a committed database transaction.
4. **Bounded service ownership:** the Voice Agent owns conversation delivery, not healthcare operations data.
5. **Least privilege:** service identities and user roles receive only the permissions they require.
6. **Privacy by design:** collect less data, retain it intentionally, and exclude sensitive values from logs.
7. **Idempotent mutations:** retries must not create duplicate appointments or notifications.
8. **Explicit state machines:** holds, appointments, notifications, and voice sessions have controlled transitions.
9. **Graceful degradation:** if voice AI is unavailable, website booking remains operational; if notifications fail, bookings remain committed and retries occur asynchronously.
10. **Modular first:** use clear internal boundaries before extracting additional services.

---

## 5. High-level system design

```text
 Public users                Hospital staff
      │                            │
      ▼                            ▼
 Hospital React App         Staff/Admin Web App
      │                            │
      └─────────── HTTPS ──────────┘
                     │
                     ▼
          Reverse Proxy / API Gateway
                     │
       ┌─────────────┼─────────────────┐
       │             │                 │
       ▼             ▼                 ▼
  Core Backend   Voice Agent      Background Worker
  REST/OpenAPI   WebSocket/API    jobs and events
       │             │                 │
       │     authenticated API calls   │
       └─────────────┼─────────────────┘
                     │
        ┌────────────┼───────────────┐
        ▼            ▼               ▼
   PostgreSQL       Redis       Object Storage
        │                            │
        └──── outbox/events ─────────┤
                                     ▼
                           SMS / Email / WhatsApp
```

### 5.1 Core Backend responsibilities

- Identity, sessions, and role enforcement
- Patient profiles and consent
- Doctors, departments, branches, fees, and consultation types
- Schedule rules and exceptions
- Availability calculation and slot holds
- Appointment state and status history
- Public content and health packages
- Staff administration APIs
- Notification event creation
- Audit records
- Voice-service tool APIs

### 5.2 Voice Agent responsibilities

- WebSocket connection and session lifecycle
- Audio ingestion and streaming responses
- Voice activity detection and interruption
- Speech-to-text and text-to-speech
- Conversation history and short-lived dialogue state
- Knowledge retrieval for approved hospital information
- Safe tool selection
- Calling the Core Backend for schedules and booking actions
- Reporting tool results accurately to the caller

The Voice Agent does **not** own:

- Doctor schedules
- Appointment records
- Patient account credentials
- Confirmation numbers
- Slot locking rules
- Final authorization decisions

### 5.3 Background Worker responsibilities

- Appointment confirmations and reminders
- OTP delivery
- Notification retries and provider failover
- Knowledge-document parsing and embedding
- File scanning and post-processing
- Expired-data cleanup
- Outbox event consumption
- Scheduled operational tasks

---

## 6. Technology choices

### 6.1 Core Backend

- Python 3.12+
- FastAPI
- Pydantic
- SQLAlchemy 2
- Alembic migrations
- PostgreSQL
- Redis
- A durable worker library selected during implementation; the code should hide it behind application interfaces
- OpenAPI-generated TypeScript client

FastAPI aligns with the existing voice codebase, allows shared schemas and tooling, and supports both ordinary API endpoints and internal service clients.

### 6.2 Data and infrastructure

- **PostgreSQL:** transactional system of record
- **Redis:** OTP state, rate limits, caching, short-lived coordination, and optional job transport
- **S3-compatible object storage:** uploaded documents and durable artifacts
- **PostgreSQL outbox:** durable events written in the same transaction as business changes
- **Optional pgvector:** scalable knowledge retrieval after the voice prototype is migrated

### 6.3 Frontend integration

- Use TanStack Query or an equivalent server-state library.
- Generate API request and response types from the backend OpenAPI specification.
- Keep UI-only state in React; do not duplicate appointment truth in global browser state.
- Provide loading, empty, expired-hold, conflict, and retry states for every transactional journey.

---

## 7. Core domain modules

The Core Backend should be one repository and one deployable application initially, divided into modules with explicit interfaces.

### 7.1 Identity and access

Capabilities:

- Patient OTP login by phone or email
- Secure browser sessions using HTTP-only, secure cookies
- Staff identity with stronger authentication requirements
- Role-based authorization
- Service-to-service authentication for the Voice Agent and Worker
- Session revocation and account recovery

Initial roles:

- `patient`
- `receptionist`
- `doctor`
- `content_editor`
- `administrator`
- `service_voice`
- `service_worker`

Authorization must be checked server-side. Hiding buttons in the frontend is not an access-control mechanism.

### 7.2 Hospital catalogue

Entities:

- Branches
- Departments and specialties
- Doctors
- Doctor qualifications
- Doctor–department relationships
- Doctor–branch relationships
- Consultation types
- Fees
- Health packages
- Insurance providers

The existing TypeScript data becomes seed/import input. Once imported, the frontend reads from APIs.

### 7.3 Scheduling

Scheduling must distinguish planned working time from actual bookable availability.

Inputs include:

- Recurring weekly schedule rules
- Effective date ranges
- Branch and consultation type
- Slot duration
- Preparation and cleanup buffers
- Doctor leave and exceptions
- Branch closures
- Existing holds and appointments
- Minimum booking lead time
- Maximum advance-booking window

The API returns generated availability, but only a slot hold protects a chosen time from concurrent users.

### 7.4 Appointments

Recommended status model:

```text
held
  └── pending_confirmation
        ├── confirmed
        │     ├── checked_in
        │     │     └── completed
        │     ├── cancelled
        │     └── no_show
        ├── cancelled
        └── expired
```

Not every deployment needs manual confirmation. When automated confirmation is allowed, the Core Backend can transition directly from a valid hold to `confirmed` in one transaction.

Every status change must record:

- Previous and new status
- Actor type and actor ID
- Channel: web, voice, staff, or system
- Timestamp
- Reason code and optional note
- Correlation/request ID

### 7.5 Patient intake and consent

Initial patient information should be limited to what booking operations require:

- Name
- Phone and/or email
- Date of birth or age when necessary
- Preferred communication channel
- Appointment reason in a constrained text field
- Consent records

Do not request card data, passwords, OTP values through the Voice Agent, or unnecessary medical-record content.

### 7.6 Content

Backend-managed content should include:

- FAQs
- Blog posts
- Legal documents
- Hospital details
- Announcements
- Package descriptions
- Insurance information

Public content can be cached aggressively and invalidated when editors publish a new revision.

### 7.7 Notifications

Notification responsibilities include:

- OTP delivery
- Booking confirmation
- Reminder delivery
- Cancellation and rescheduling updates
- Staff escalation for incomplete enquiries

Provider calls must not occur inside the appointment database transaction. Instead, write an outbox event in the same transaction; the Worker later delivers and retries it.

### 7.8 Audit

Audit events are append-only and should cover:

- Staff access to sensitive records
- Appointment creation and changes
- Schedule changes
- Authentication and authorization events
- Consent changes
- Document access and administration
- Voice booking tool calls and their outcomes

Application logs and audit events are different: logs help operate the system; audit events establish who did what and when.

---

## 8. Data model

### 8.1 Identity and patient tables

#### `users`

- `id` UUID primary key
- `user_type`
- `status`
- `phone_normalized` nullable, uniquely indexed where present
- `email_normalized` nullable, uniquely indexed where present
- `created_at`, `updated_at`, `last_login_at`

#### `patient_profiles`

- `user_id` foreign key
- `display_name`
- `date_of_birth` nullable
- `gender` nullable
- `preferred_channel`
- encrypted sensitive fields as required

#### `roles` and `user_roles`

Role definitions and scoped assignments. Staff roles may be limited by branch.

#### `consents`

- `id`
- `patient_id`
- `consent_type`
- `version`
- `granted`
- `captured_at`
- `channel`
- `evidence_metadata`

### 8.2 Catalogue tables

#### `branches`

- `id`, `slug`, `name`, `timezone`
- Address and contact fields
- Active state
- Operating metadata

#### `departments`

- `id`, `slug`, `name`
- Tagline and description
- Active state and display order

#### `doctors`

- `id`, `slug`, `display_name`
- Title, biography, experience
- Profile image reference
- Active state

#### Relationship tables

- `doctor_departments`
- `doctor_branches`
- `doctor_qualifications`
- `doctor_consultation_types`

#### `consultation_types`

Examples: in-person, virtual video, follow-up.

#### `doctor_fees`

- Doctor, branch, and consultation type
- Currency and amount
- Effective dates

### 8.3 Scheduling tables

#### `schedule_rules`

- Doctor
- Branch
- Consultation type
- Day of week
- Local start and end time
- Slot duration
- Buffer duration
- Effective date range
- Active state

#### `schedule_exceptions`

- Doctor and optional branch
- Start/end timestamp
- Exception type: unavailable, replacement hours, or branch closure
- Reason

#### `slot_holds`

- `id`
- Doctor, branch, consultation type
- `starts_at`, `ends_at`
- Patient/session owner reference
- `expires_at`
- Status: active, consumed, released, expired
- Idempotency key
- Created channel

Holds should be short-lived, normally several minutes. Expiry must be enforced during confirmation even if asynchronous cleanup has not yet run.

### 8.4 Appointment tables

#### `appointments`

- `id`
- Human-readable confirmation code
- Patient
- Doctor, branch, department, consultation type
- `starts_at`, `ends_at`, timezone
- Current status
- Reason-for-visit text
- Origin channel
- Created/updated timestamps
- Version number for optimistic concurrency where useful

#### `appointment_status_history`

Append-only transition history with actor and reason metadata.

#### `appointment_contacts`

Optional snapshot of the contact details used for the appointment, allowing the patient profile to change without rewriting history.

### 8.5 Content and operations tables

- `health_packages`
- `insurance_providers`
- `content_pages`
- `content_revisions`
- `notification_jobs`
- `outbox_events`
- `audit_events`
- `idempotency_records`

### 8.6 Voice and knowledge tables

- `voice_sessions`
- `voice_turns`
- `voice_tool_calls`
- `knowledge_documents`
- `knowledge_chunks`
- `retrieval_audit`

Raw audio should not be retained by default. If a later product requirement introduces recording, it needs explicit consent, restricted storage, access auditing, and a defined deletion schedule.

---

## 9. Booking consistency design

### 9.1 Availability search

`GET /api/v1/availability` accepts:

- Department or doctor
- Branch
- Consultation type
- Date range
- Optional patient timezone

The Core Backend expands schedule rules, applies exceptions, and subtracts active holds and blocking appointments.

Availability responses are advisory. They may become stale immediately, so the UI must request a hold before collecting final confirmation.

### 9.2 Slot hold

`POST /api/v1/slot-holds` attempts to reserve a candidate slot.

Requirements:

- Run in a database transaction.
- Reject overlapping active holds or blocking appointments.
- Return an opaque hold ID and expiry timestamp.
- Bind the hold to a patient session, authenticated user, or voice session.
- Support an idempotency key.
- Never extend a hold silently beyond configured limits.

### 9.3 Confirmation

`POST /api/v1/appointments` consumes a hold.

Within one transaction, it must:

1. Lock and validate the hold.
2. Confirm it has not expired and belongs to the caller.
3. Revalidate doctor and branch state.
4. Insert the appointment.
5. Mark the hold consumed.
6. Insert appointment status history.
7. Insert an outbox event.
8. Commit.

Only after commit may any client display or speak a confirmation.

### 9.4 Database protection

Application checks alone are insufficient. The implementation must add a database-level exclusion or equivalent conflict constraint protecting occupied doctor time ranges. The exact constraint depends on whether variable-length appointments are supported, but it must cover concurrent transactions.

### 9.5 Idempotency

All externally initiated mutations should accept `Idempotency-Key`.

The backend stores:

- Caller/service identity
- Endpoint and normalized request hash
- Result status and response reference
- Expiration time

Reusing a key with the same request returns the original result. Reusing it with a different request returns a conflict.

---

## 10. API design

### 10.1 Conventions

- Prefix public APIs with `/api/v1`.
- Use UUIDs in API payloads.
- Return timestamps in ISO 8601 with timezone.
- Include a request/correlation ID in every response.
- Use stable machine-readable error codes.
- Use cursor pagination for growing collections.
- Validate all filters and text lengths.
- Do not expose internal database errors.

Example error:

```json
{
  "error": {
    "code": "SLOT_NO_LONGER_AVAILABLE",
    "message": "That appointment time is no longer available.",
    "request_id": "req_...",
    "details": {
      "suggested_action": "refresh_availability"
    }
  }
}
```

### 10.2 Public catalogue

```text
GET /api/v1/branches
GET /api/v1/departments
GET /api/v1/departments/{slug}
GET /api/v1/doctors
GET /api/v1/doctors/{slug}
GET /api/v1/health-packages
GET /api/v1/content/{slug}
GET /api/v1/insurance-providers
```

### 10.3 Scheduling and booking

```text
GET    /api/v1/availability
POST   /api/v1/slot-holds
GET    /api/v1/slot-holds/{id}
DELETE /api/v1/slot-holds/{id}

POST   /api/v1/appointments
GET    /api/v1/appointments/{id}
GET    /api/v1/me/appointments
PATCH  /api/v1/appointments/{id}/cancel
POST   /api/v1/appointments/{id}/reschedule-hold
POST   /api/v1/appointments/{id}/reschedule
```

### 10.4 Authentication and patient account

```text
POST /api/v1/auth/otp/request
POST /api/v1/auth/otp/verify
POST /api/v1/auth/logout
GET  /api/v1/me
PUT  /api/v1/me/profile
GET  /api/v1/me/consents
PUT  /api/v1/me/consents/{type}
```

OTP request endpoints must avoid confirming whether an account exists and must be rate-limited by identity, IP, and device/session signals.

### 10.5 Staff APIs

```text
GET  /api/v1/admin/appointments
PATCH /api/v1/admin/appointments/{id}/status
POST /api/v1/admin/schedule-rules
PATCH /api/v1/admin/schedule-rules/{id}
POST /api/v1/admin/schedule-exceptions
POST /api/v1/admin/doctors
PATCH /api/v1/admin/doctors/{id}
POST /api/v1/admin/content
POST /api/v1/admin/content/{id}/publish
GET  /api/v1/admin/audit-events
```

### 10.6 Voice APIs

The browser may request a short-lived session ticket:

```text
POST /api/v1/voice/tickets
```

The Voice Agent then accepts:

```text
WS /api/v1/voice/sessions/{session_id}?ticket=...
```

The Voice Agent uses internal Core Backend endpoints or the same application APIs under a service identity. Separate internal routes are appropriate only when they express a truly service-specific workflow rather than bypassing authorization.

---

## 11. Voice-to-Core integration

### 11.1 Authentication

The Voice Agent receives a dedicated service identity. Recommended controls:

- Short-lived service tokens or workload identity
- Audience-restricted credentials
- Private network path where available
- Narrow scopes such as `catalog:read`, `availability:read`, `holds:write`, and `appointments:write`
- Credential rotation
- Per-service rate limits

Do not place a long-lived administrator key in frontend code or voice-session payloads.

### 11.2 Voice tools

The conversational model receives constrained tools rather than arbitrary HTTP access.

#### `search_doctors`

Inputs: department, branch, consultation type, optional date.  
Returns: matching doctors and identifiers from the Core Backend.

#### `get_availability`

Inputs: doctor or department, branch, date range, consultation type.  
Returns: a small set of current candidate slots.

#### `create_slot_hold`

Inputs: exact selected slot and voice-session owner.  
Returns: hold ID, expiry, and normalized slot details.

#### `create_appointment`

Inputs: hold ID, verified patient details, consent state, and idempotency key.  
Returns: confirmed appointment ID/code or a controlled failure.

#### `request_cancellation` and `request_reschedule`

These require sufficient identity verification. If verification is incomplete, create a staff-reviewed request instead of altering an appointment.

#### `search_hospital_knowledge`

Searches approved, versioned hospital content. It cannot alter operational data.

### 11.3 Voice booking dialogue

```text
Caller requests a cardiology appointment
  → Voice Agent identifies requested department
  → get_availability
  → Agent reads a limited set of options
  → Caller selects an exact time
  → create_slot_hold
  → Agent collects only required details, one question at a time
  → Agent repeats critical details for confirmation
  → create_appointment with an idempotency key
  → Core Backend commits and returns confirmation code
  → Agent speaks the confirmed details
```

If the hold expires during intake, the agent must explain that the slot is no longer held and fetch new availability. It must not silently substitute another time.

### 11.4 Failure behavior

- **Core API unavailable:** do not claim live availability; offer to capture a pending callback request.
- **Hold conflict:** apologize briefly and fetch alternatives.
- **Notification failure:** booking remains confirmed; explain that confirmation delivery may be delayed only if the API exposes that status.
- **Voice model failure:** preserve the Core Backend transaction result and allow retrieval through the web/staff channel.
- **Caller interruption:** cancel in-flight speech and model work, but never roll back an already committed booking.
- **Ambiguous identity:** do not disclose appointment information; move to verification or staff escalation.

### 11.5 Migrating the current voice prototype

Retain:

- Audio/WebSocket loop
- Interruption behavior
- STT and TTS adapters
- Provider-routing abstraction
- Retrieval pipeline concepts
- Transcript and latency instrumentation
- Safety prompt approach

Change:

- Replace Meridian demo content with approved Avocado Health content.
- Move durable voice sessions and audits to PostgreSQL.
- Remove the process-level single-call lock.
- Add shared/distributed concurrency controls where needed.
- Authenticate WebSocket sessions with expiring tickets.
- Replace enquiry-only booking behavior with Core API tools.
- Ensure appointment confirmation wording depends on a successful tool result.
- Separate administrative knowledge ingestion from the public voice endpoint.
- Move document embeddings to a scalable store when required.
- Make all stored session data tenant-aware even if only one hospital is initially deployed.

---

## 12. Frontend migration plan

### 12.1 Data sources

Replace direct imports from frontend data files in this order:

1. Branches and hospital information
2. Departments
3. Doctors and doctor profiles
4. Health packages and insurance providers
5. FAQs, blogs, and legal content
6. Availability and appointment state

Retain temporary fallback fixtures only in tests and Storybook-like isolated development scenarios.

### 12.2 Appointment UI changes

The scheduling UI must understand:

- Availability loading and refresh
- A slot becoming unavailable
- Hold creation and countdown
- Hold expiration
- Idempotent submission
- Authentication/OTP continuation
- Confirmed, pending, and failed outcomes
- Cancellation and rescheduling rules

The current modal can evolve into a backend-connected journey, but appointment confirmation must no longer be triggered by local form submission alone.

### 12.3 Authentication

Replace simulated React user state with:

- Session bootstrap from `GET /api/v1/me`
- OTP request and verification
- Cookie-backed authenticated requests
- Explicit logout
- Session-expired handling

### 12.4 AI search

The client-side keyword matcher may remain temporarily for navigation, but it should be treated as presentation assistance, not a clinical or scheduling authority. Longer term, department recommendations should come from a versioned backend endpoint with safety controls and analytics.

---

## 13. Security, privacy, and governance

Before production, the organization must obtain a jurisdiction-appropriate legal and healthcare privacy review. The engineering design should support that review rather than assume that a particular checklist alone establishes compliance.

### 13.1 Data minimization

- Collect only what the current workflow needs.
- Keep reason-for-visit fields bounded and warn users not to submit emergency information through ordinary booking forms.
- Avoid retaining raw audio unless explicitly required.
- Separate public analytics from patient-linked events.

### 13.2 Encryption and secrets

- TLS for every external connection and service-to-service link.
- Encrypted managed disks and backups.
- Field-level encryption for selected sensitive values where the threat model requires it.
- Secrets stored in a managed secret store, never repository files or images.
- Regular key and credential rotation.

### 13.3 Logging

Structured logs should contain:

- Request ID
- Route template
- Status and latency
- Service identity or pseudonymous actor ID
- Safe error classification

They should not contain:

- OTPs
- Access tokens
- Full patient messages or transcripts
- Full phone numbers or emails
- Appointment reasons
- Uploaded document contents

### 13.4 Authorization

- Deny by default.
- Enforce branch and role scope in the backend.
- Require stronger checks for cancellation, rescheduling, and record access.
- Give service identities narrower rights than administrators.
- Record sensitive staff access in the audit trail.

### 13.5 Retention and deletion

Create a data inventory with retention rules for:

- Authentication events
- Patient profiles
- Appointment history
- Voice transcripts
- Raw voice recordings, if ever enabled
- Audit events
- Knowledge documents
- Backups

Deletion jobs must account for replicas, caches, object storage, and backup policies. Some records may require retention; those decisions belong to legal and operational governance.

### 13.6 Abuse protection

- Per-IP and per-identity rate limiting
- OTP attempt and resend limits
- WebSocket connection quotas
- Input length and upload size limits
- File-type validation and malware scanning
- Bot and enumeration resistance
- Notification-spam controls
- Emergency-abuse and prompt-injection tests for the Voice Agent

---

## 14. Reliability and observability

### 14.1 Service objectives

Define measurable targets before launch for:

- Core API availability
- Availability-search latency
- Booking confirmation latency
- Voice first-response and first-audio latency
- Notification delivery time
- Booking conflict rate
- Error and retry rates

### 14.2 Metrics

Core metrics:

- Requests, latency, and errors per endpoint
- Database pool saturation and query latency
- Slot hold creation, expiry, and conversion
- Appointment confirmations and conflicts
- Outbox backlog and notification retries
- Authentication and rate-limit failures

Voice metrics:

- Concurrent sessions
- STT, LLM, retrieval, and TTS latency
- First-audio latency
- Interruptions and disconnects
- Tool calls, failures, and retries
- Booking success and escalation rates
- Safety-trigger frequency

### 14.3 Tracing

Propagate a correlation ID across:

- Browser request
- Core Backend request
- Voice tool call
- Database transaction
- Outbox event
- Notification delivery

Trace metadata must be redacted and must not include transcript or patient-message content by default.

### 14.4 Health endpoints

Each deployable exposes:

- Liveness: process is functioning
- Readiness: dependencies required to serve traffic are available
- Startup: long model initialization or migration state

Readiness failures should remove an instance from service without automatically destroying useful diagnostic state.

### 14.5 Backups and recovery

- Automated PostgreSQL backups with point-in-time recovery where supported
- Object-storage versioning or equivalent recovery controls
- Regular restore tests
- Documented recovery time and recovery point objectives
- Runbooks for database failover, credential compromise, and notification-provider outage

---

## 15. Deployment design

### 15.1 Local development

Recommended Compose services:

```text
frontend       localhost:5567
core-api       localhost:8000
voice-agent    localhost:8765
worker
postgres
redis
minio          development object storage
```

Suggested local routing:

- Frontend calls `/api` through the Vite proxy to avoid inconsistent CORS behavior.
- Voice WebSocket calls `/voice` through a proxy or uses a configured local URL.
- The Voice Agent calls `http://core-api:8000` over the Compose network.

### 15.2 Production

The services may run on the same platform or different infrastructure:

- Core API and Worker on general-purpose compute
- Voice Agent on compute optimized for its inference mode
- Managed PostgreSQL and Redis where available
- Private service networking
- CDN for static frontend assets and public images
- Central secret management
- Independent autoscaling policies

Separate hosting is intentional. It allows voice inference to scale or fail independently without changing the booking source of truth.

### 15.3 Environments

Maintain at least:

- Development
- Staging
- Production

Staging should use synthetic patient data and production-like service boundaries. Never copy unrestricted production patient data into development environments.

---

## 16. Suggested repository organization

The existing repositories can remain separate initially.

### 16.1 Core Backend repository

```text
hospital-backend/
  app/
    api/
      v1/
    modules/
      auth/
      patients/
      catalogue/
      scheduling/
      appointments/
      content/
      notifications/
      audit/
    integrations/
      voice/
      messaging/
      object_storage/
    db/
    security/
    observability/
  migrations/
  tests/
    unit/
    integration/
    contract/
    concurrency/
  scripts/
  compose.yaml
  pyproject.toml
```

### 16.2 Voice Agent repository

```text
voice-agent/
  app/
    api/
    audio/
    conversation/
    tools/
      core_api.py
      knowledge.py
    inference/
    persistence/
    security/
    observability/
  tests/
    audio/
    dialogue/
    tool_contracts/
    safety/
    load/
```

### 16.3 Frontend repository

```text
hospital-webpage/
  src/
    api/
      generated/
      client.ts
    features/
      auth/
      doctors/
      scheduling/
      appointments/
      content/
    components/
    pages/
```

Migration to this frontend structure should be incremental, not a prerequisite for the first API integration.

---

## 17. Testing strategy

### 17.1 Unit tests

- Schedule expansion
- Exception application
- Hold expiry
- Appointment state transitions
- Authorization policies
- Idempotency logic
- Voice tool result interpretation

### 17.2 Database integration tests

- Migrations from an empty database
- Conflicting concurrent holds
- Concurrent appointment confirmation
- Transaction rollback
- Outbox atomicity
- Timezone and daylight-boundary behavior
- Unique and exclusion constraints

### 17.3 Contract tests

- OpenAPI compatibility with the generated frontend client
- Voice tool schemas against Core Backend responses
- Backward-compatible response evolution
- Stable error codes

### 17.4 End-to-end tests

- Browse department → select doctor → hold slot → OTP → confirm
- Booking from voice and immediate display on the website
- Website and voice competing for the same slot
- Expired hold recovery
- Cancellation and rescheduling
- Staff schedule exception removing future availability
- Notification failure after successful booking

### 17.5 Voice safety tests

- The agent never confirms without a successful appointment response.
- The agent never invents doctors, times, fees, or confirmation codes.
- Emergency language produces the approved escalation message.
- Prompt injection in caller speech or knowledge documents cannot change system rules.
- Identity ambiguity does not expose an existing appointment.
- Tool timeout results in an honest failure or pending-enquiry path.

### 17.6 Performance tests

- Peak availability searches
- High-contention bookings for the same doctor and time
- OTP and notification bursts
- Concurrent voice sessions
- Long-running WebSocket stability
- Model cold-start and instance replacement behavior

---

## 18. Implementation phases

### Phase 0 — Decisions and contracts

Deliverables:

- Confirm MVP booking rules and staff roles.
- Define appointment and hold state machines.
- Approve the initial entity model.
- Publish initial OpenAPI schemas.
- Define privacy, retention, and consent requirements.
- Decide infrastructure targets and notification providers.

Exit criteria:

- Booking semantics and error codes are agreed.
- Web and voice teams can build against versioned mock contracts.

### Phase 1 — Backend foundation

Deliverables:

- Core Backend scaffold
- PostgreSQL and Redis integration
- Alembic migration pipeline
- Configuration and secret-loading strategy
- Structured logs, request IDs, health endpoints, and base metrics
- Test infrastructure
- Service-to-service authentication foundation

Exit criteria:

- Application deploys in development and staging.
- Migrations, rollback policy, tests, and health probes run in CI.

### Phase 2 — Catalogue and content

Deliverables:

- Catalogue schema and APIs
- Import of current doctors, departments, branches, packages, and insurance providers
- Content APIs for FAQ, blog, legal, and hospital information
- Generated TypeScript client
- Frontend migration away from static data imports

Exit criteria:

- Public frontend content is rendered from the Core Backend.
- Administrative changes appear without a frontend rebuild where intended.

### Phase 3 — Scheduling and appointment MVP

Deliverables:

- Schedule rules and exceptions
- Availability endpoint
- Transactional slot holds
- Booking confirmation
- Cancellation and rescheduling
- Appointment history and audit events
- Outbox and basic confirmation notifications

Exit criteria:

- Concurrency tests demonstrate that a slot cannot be double-booked.
- The website completes a real booking and retrieves it afterward.

### Phase 4 — Authentication and staff operations

Deliverables:

- Patient OTP flow
- Secure session management
- Patient appointment list
- Staff roles and branch scoping
- Staff appointment management
- Schedule administration
- Consent capture and audit views

Exit criteria:

- Patients access only their own appointments.
- Staff access is role- and branch-scoped and audited.

### Phase 5 — Voice integration

Deliverables:

- Voice service identity and client
- Voice session tickets
- Live catalogue and availability tools
- Slot hold and appointment tools
- Avocado Health knowledge migration
- Durable voice session/audit storage
- Removal of the single-session process lock
- Voice booking, concurrency, failure, and safety tests

Exit criteria:

- A voice-created booking is immediately visible in the website and staff tools.
- Voice cannot confirm a booking when the Core Backend rejects or times out.

### Phase 6 — Hardening and launch readiness

Deliverables:

- Load, resilience, and recovery testing
- Monitoring dashboards and actionable alerts
- Backup restore exercise
- Security review and remediation
- Privacy and retention controls
- Incident and operations runbooks
- Progressive rollout plan

Exit criteria:

- Operational owners approve launch readiness.
- Rollback and recovery procedures have been tested.

---

## 19. Delivery order for maximum value

The recommended critical path is:

```text
Catalogue APIs
  → Schedule rules
  → Availability
  → Slot holds
  → Appointment confirmation
  → Frontend booking integration
  → Patient/staff authentication
  → Voice tools
  → Production hardening
```

Voice booking should not be implemented before the shared scheduling source of truth exists. Otherwise, the project risks creating two incompatible booking systems that later need reconciliation.

---

## 20. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Web and voice maintain separate schedules | Conflicts and false confirmations | Core Backend is the only scheduling authority |
| Concurrent booking race | Double-booked doctor | Holds, transactions, and database-level overlap protection |
| Voice invents operational facts | Patient harm and loss of trust | Constrained tools, grounded responses, and confirmation gating |
| Notification provider outage | Patients miss confirmations | Transactional outbox, retries, provider abstraction, staff visibility |
| Sensitive content enters logs | Privacy incident | Structured redaction and prohibited-field tests |
| Long-lived voice credentials leak | Unauthorized bookings | Workload identity or short-lived audience-scoped tokens |
| Model/inference outage | Voice channel unavailable | Web remains independent; voice offers controlled callback capture |
| Static frontend and backend drift | Incorrect display | Generated client, contract tests, and database-backed catalogue |
| Schedule rules become too complex early | Delivery delay | Start with explicit MVP rules and version the scheduling model |
| Timezone errors | Incorrect appointment time | Store UTC timestamps plus originating timezone; test boundaries |
| Retained voice data exceeds purpose | Privacy and storage risk | No raw recording by default; formal retention policy |

---

## 21. Architecture decisions to record

Create short Architecture Decision Records for:

1. Modular monolith for the Core Backend
2. Voice Agent as a separate deployment
3. PostgreSQL as the appointment source of truth
4. Slot-hold and transactional confirmation model
5. Database-level overlap protection
6. Outbox pattern for notifications
7. Cookie-based patient web sessions
8. Service identity for voice-to-core calls
9. OpenAPI-generated frontend client
10. No raw voice recording by default
11. Knowledge storage and future pgvector migration
12. Data retention and audit-event policy

---

## 22. Definition of the first production-capable milestone

The first production-capable milestone is complete when:

- Doctors, branches, departments, and fees come from the Core Backend.
- Staff can configure a basic recurring schedule and exceptions.
- The website displays live availability.
- A user can hold and confirm a slot.
- Concurrent requests cannot double-book it.
- The appointment can be retrieved, cancelled, and rescheduled under authorization.
- Status changes are audited.
- Confirmation notifications are delivered asynchronously and retried.
- Logs exclude sensitive payloads.
- Backups and restore procedures have been tested.

Voice integration follows this milestone and uses these exact application services.

---

## 23. Immediate next actions

1. Create the Core Backend repository beside the frontend and voice repositories.
2. Write the first ADRs and finalize the MVP appointment state machine.
3. Define the PostgreSQL schema and first Alembic migration.
4. Publish an initial OpenAPI contract for catalogue, availability, holds, and appointments.
5. Import the current frontend fixtures as seed data.
6. Implement catalogue APIs and generate the frontend client.
7. Implement scheduling and concurrency-safe slot holds.
8. Connect the website booking flow.
9. Add patient and staff authentication.
10. Adapt the Voice Agent only after the Core booking flow passes concurrency and end-to-end tests.

This sequence produces a coherent platform: the website and voice experience remain independently deployable, while every operational action converges on one secure and consistent backend.

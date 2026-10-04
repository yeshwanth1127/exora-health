# WhatsApp booking MVP: contract and rollout plan

Updated 2026-09-29. The picture-led menu and fictional, backend-free phone demo remain available with `WA_MODE=demo`. A separate `WA_MODE=backend` implementation now connects the same WhatsApp service to the Avocado Health FastAPI backend. The backend route specification is [WHATSAPP_CONTRACT.md](/Users/deepakonda/Documents/antigravity/hms-backend/WHATSAPP_CONTRACT.md), and the component map is [BACKEND_INTEGRATION.md](./whatsapp-mvp/BACKEND_INTEGRATION.md).

The proposed **₹800 online / ₹1,000 at-clinic** choice is documented in [PAYMENT_CHOICE_DESIGN.md](./whatsapp-mvp/PAYMENT_CHOICE_DESIGN.md) with a clickable [design preview](./whatsapp-mvp/payment-choice-preview.html). It is a design only: no checkout, payment request, price mutation, or booking change has been enabled.

## Patient journey

1. A patient sends `hi` to the Meta test number. The bot returns a picture-led menu: Book a visit, My visits when there is history, and More options.
2. The patient picks a specialty. The bot sends that specialty's staff-uploaded PDF, then asks for a branch and presents doctors at that branch. Choosing a doctor shows the uploaded portrait when available.
3. The bot gets availability from the backend, holds the chosen slot, collects a patient name, and asks for an explicit booking and reminder preference. It displays a reference only after the backend creates the appointment. With illustrative seed data and `WA_CLINIC_READY=false`, the response says the record is for local testing.
4. `hi` returns to the menu. My visits lists only appointments made by that WhatsApp sender, with detail, change, and cancel actions.
5. More options accepts an issue, private rating/comment, or a supported media message. These create staff cases visible at the upload desk; staff can mark cases open, in progress, or resolved.
6. An approved reminder template may be sent for a consented appointment only when clinic-ready mode is explicitly enabled. No reminder template is configured by default.

## Implemented contracts

| Area | Backend owns | Bot owns |
| --- | --- | --- |
| Clinical data | Branches, specialties, doctors, schedules, uploaded guides and photos | Tappable presentation and PDF/photo ordering |
| Booking | Availability, short-lived holds, confirmed appointment, conflict and idempotency handling | Name and consent prompts, hold expiry/conflict wording |
| Patient access | HMAC-derived sender ownership for WhatsApp-created appointments | Verified Meta webhook sender ID; no typed-phone lookup |
| Visit management | Sender-scoped list/detail, atomic reschedule, cancel | My visits navigation and explicit confirmations |
| Care requests | Durable issue/feedback cases and bounded attachments | Text and media intake; no medical interpretation |
| Recovery | Conversation step and latest prepared reply | Retry of the same inbound message and Meta send adapter |
| Reminders | Consent flag and due/claim/complete job | Approved template send when clinic-ready |

The backend staff page at `http://127.0.0.1:8002/whatsapp-assets` is available while the local backend process is running. It accepts one PDF per specialty and a JPEG/PNG photo per doctor by drag and drop. The admin key stays in browser memory. Uploaded files are stored in the backend's `MEDIA_DIR`; the database and that directory must be backed up together.

## Local acceptance and evidence

- Backend: fresh SQLite migration passed; 9 API tests passed.
- Bot: 22 tests passed; the frontend build passed.
- Integrated HTTP smoke: recovered a partial conversation after bot restart, booked, viewed, and cancelled a local test appointment through the actual FastAPI service.
- Earlier Meta test-number messages reached a phone, but this new backend mode has **not** completed a two-phone WhatsApp walkthrough. The HTTP checks do not establish phone delivery or clinical readiness.

## What is needed from the clinic

1. Approved specialty PDFs, clinician photos, and verified names, credentials, specialty assignments, branch addresses, fees, and schedules. The current seed catalogue is illustrative and has schedules only at its first branch.
2. A staff owner and response process for issues, feedback, and attachments, including retention rules for patient media.
3. A decision on how to verify patients and link existing website, voice, or staff appointments to WhatsApp. The current safe rule exposes only bookings made by the same WhatsApp sender.
4. Before reminders: patient-facing consent copy, an approved WhatsApp utility template with code, doctor, and local date/time parameters, and an opt-out/handling policy.
5. Before public launch: a production Meta number and credential, PostgreSQL deployment, durable media storage, staff authentication, monitoring, and two-phone testing including slot conflict and restart cases.

Until these inputs are checked, keep `WA_CLINIC_READY=false` and use the Meta test number. The default demo stays separate from the backend data. The live mode records appointments in a local backend database but labels them as tests; it should not be represented as a confirmed clinic visit.

## Remaining technical boundary

Conversation progress persists, but full outbound delivery receipts do not. A crash at the point where Meta accepts a message may lead to a duplicate reply. Multi-instance hosting needs shared send coordination. This does not affect the backend's booking idempotency, but it should be resolved before relying on the bot for unattended clinic operations.

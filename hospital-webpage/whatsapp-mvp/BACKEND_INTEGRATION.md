# WhatsApp bot → Avocado Health backend

Implemented locally on 2026-09-29 against the sibling checkout `/Users/deepakonda/Documents/antigravity/hms-backend` (branch `codex/whatsapp-integration`). The backend's [WHATSAPP_CONTRACT.md](/Users/deepakonda/Documents/antigravity/hms-backend/WHATSAPP_CONTRACT.md) is the route-level contract. `WA_MODE=demo` remains the default; `WA_MODE=backend` opts into the integrated flow.

## Ownership

| Concern | Owner | Contract |
| --- | --- | --- |
| Meta webhook verification, interactive menus, and message sending | Node WhatsApp service | Signature check before the sender ID reaches the backend; Meta credentials stay in the bot. |
| Doctor and specialty catalogue | FastAPI backend | `GET /catalogue`, `GET /doctors`; active approved records only for clinic use. |
| Specialty PDF and doctor portrait | FastAPI backend and staff upload desk | Staff uploads at `/whatsapp-assets`; bot retrieves authenticated `/assets/{id}`. PDF is sent before the doctor list, photo before slot selection. |
| Availability and temporary slot hold | FastAPI backend | `GET /availability`, `POST /slot-holds`, `DELETE /slot-holds/{id}`; a slot is advisory until held. |
| Booking, My visits, change, cancel | FastAPI backend | Sender-scoped `/appointments` routes; booking follows name and explicit reminder choice; reschedule is transactional. |
| Issues, private rating, inbound media | FastAPI backend and staff desk | `/cases` and `/cases/{id}/attachments`; staff can view and change case status. |
| Conversation restart recovery | FastAPI backend | `/conversations/{sender_id}` stores step, draft, inbound ID, and latest prepared reply. |
| Appointment reminder | FastAPI job plus Node worker | Jobs require patient consent; worker also requires `WA_CLINIC_READY=true` and an approved template name. |

The bot calls `/api/v1/integrations/whatsapp/*` with `X-Service-Key`; the staff desk uses `X-Admin-Key`. The backend derives a private owner key from the verified WhatsApp sender. This authorizes only appointments created by that WhatsApp sender. Existing website, voice, or receptionist appointments are not linked by a matching phone number. Stronger patient identity and cross-channel account linking need a separate clinic decision.

## Local verification

The backend migrated a fresh SQLite database and passed 9 API tests. The bot passed 22 tests. A real HTTP smoke test against FastAPI booked, listed, and cancelled a local test appointment after restoring conversation state across a bot restart. These checks do not prove PostgreSQL deployment, live Meta delivery, or a real clinic booking.

## Before clinic use

Replace seed doctors, locations, schedules, specialty guides, and portraits with approved facts. Provide a stable production backend and media store, staff access controls, production WhatsApp number and credentials, approved reminder template, staff response process, and a two-phone walkthrough. Backend mode now records inbound messages before acknowledging Meta. An interrupted outbound send is marked `uncertain` for staff review and is never automatically repeated. Run one bot replica until shared send coordination exists. See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md).

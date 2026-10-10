# Virtual OPD (teleconsultation) → HMS_NEW: plan

Status: **built** — migration `m05_teleconsult`, module `apps/api/src/modules/telehealth`, tests in `apps/api/src/http/telehealth.test.ts`.

## 1. What the old system had

Sources: `hospital-backend/app/{teleconsultation_api,teleconsultation_service,jitsi}.py`, migration `0005_identity_virtual_opd.py`, `tests/test_virtual_opd.py`, `VIRTUAL_OPD_IMPLEMENTATION_PLAN.md`, `hospital-webpage/src/components/virtual-opd/*`.

| Part | Old behaviour |
|---|---|
| Tables | `teleconsultations` (1 per virtual appointment, random `room_key`, status, timestamps, end reason, version), `teleconsultation_consents` (patient, document version, accepted/withdrawn), `teleconsultation_events` (append-only log) |
| Creation | When a virtual appointment is booked, in the same transaction |
| Patient | Logged-in patient (email/password or EXO-P code) → views consult → accepts consent (version must match config) → "check in" (`scheduled → waiting`) → join grant once the doctor has started |
| Doctor | Logged-in doctor, assigned to the appointment only → start (`→ in_progress`) → moderator join grant → end (`→ completed`, also completes the appointment) |
| Video | Jitsi. Backend mints a 5-minute HS256 JWT for an opaque room; join window 15 min before start to 60 min after end. Browser embeds Jitsi's `external_api.js` |
| Gaps | Consent text not stored (only a version string); no patient-identity confirmation; "end" completed the appointment directly, bypassing any clinical record; `ready` status never used; consent/grant routes not rate-limited |

## 2. How it maps onto HMS_NEW

| Old | HMS_NEW |
|---|---|
| `teleconsultations` | `clinical.tele_session` — the ERD's `tele_session` (M05). One per virtual appointment; links to the encounter through the appointment |
| `teleconsultation_consents` | `clinical.tele_consent` + `clinical.tele_consent_document` — the **text** the patient agreed to is stored and versioned per tenant, not just a version string |
| `teleconsultation_events` | `clinical.tele_session_event` (append-only, trigger-protected) + the usual audit and outbox rows |
| Patient login | **None** (decision W-D2: no patient accounts yet). The patient uses a **join link**: a random secret, stored only as a SHA-256 hash, expiring after the join window; the front desk issues or re-issues it. Link endpoints live under `/tele/v1` |
| Doctor login | Staff token (dev token / OIDC). Permission `teleconsult.conduct` **and** being the appointment's doctor |
| "End" completes appointment | Ending the **call** ≠ finishing the **visit**. The doctor finishes the encounter (notes, diagnosis, disposition) through the existing clinical API; that completes the appointment as for any OPD visit |
| Create in booking transaction | Created by a worker consumer on `appointment.confirmed` (visit mode virtual); issuing a link also creates it if the worker hasn't yet |

## 3. Lifecycle

```
virtual appointment confirmed ──► scheduled
patient (via link) accepts consent + enters waiting room ──► waiting
        └─ worker: if the patient record is linked, the appointment is checked in → encounter (TC-…) opens
assigned doctor starts (appointment must be checked in) ──► in_progress
doctor confirms the patient's identity (method recorded)
doctor ends the call: outcome consulted | patient_did_not_join | technical_failure ──► completed
appointment cancelled / no-show (scheduled|waiting) ──► cancelled / no_show, link revoked
```

Rules (enforced in code, and the transitions also in a database trigger):
- Patient join needs: valid link, current consent, `in_progress`, inside the join window (15 min before start → 60 min after end).
- Doctor join needs: assigned doctor, `in_progress`, inside the window. Doctor tokens are moderator; patient tokens never are.
- Outcome `consulted` requires a recorded identity check (Telemedicine Practice Guidelines 2020: the doctor must verify the patient's identity). Database CHECK, not just code.
- Consent: explicit, by the patient through the link, or recorded by staff as verbal consent (the guidelines allow consent by audio/video/text). Consent must be for the tenant's current published document.
- No published consent document → teleconsultation unavailable for that tenant (this is the on/off switch).
- Room names and link tokens contain no PHI; outbox events never contain link tokens or JWTs.

## 4. API

Staff (`/v1`, bearer token):

| Endpoint | Permission |
|---|---|
| `GET /v1/teleconsults?facilityId&date[&staffId][&status]` — worklist | `teleconsult.read` |
| `GET /v1/teleconsults/:id`, `GET /v1/appointments/:id/teleconsult` | `teleconsult.read` |
| `POST /v1/appointments/:id/teleconsult/link` — issue/re-issue patient link (old link stops working) | `teleconsult.manage` |
| `POST /v1/teleconsults/:id/consent` — staff-recorded verbal consent | `consents.record` |
| `POST /v1/teleconsults/:id/start` · `/join` · `/identity` · `/end` | `teleconsult.conduct` + assigned doctor |

Patient (`/tele/v1`, header `X-Teleconsult-Token`; the link carries the token in the URL **fragment** so it never reaches server logs):

`GET /tele/v1/session` (status, doctor, times, consent document, `retryAfterSeconds`) · `POST /tele/v1/session/consent` · `/check-in` · `/join` · `/leave`

## 5. Configuration

`JITSI_DOMAIN`, `JITSI_APP_ID`, `JITSI_SECRET` (≥ 32 chars; the dev default is refused when `NODE_ENV=production`), `JITSI_TOKEN_MINUTES` (5), `TELE_JOIN_EARLY_MINUTES` (15), `TELE_JOIN_LATE_MINUTES` (60), `TELE_PATIENT_LINK_BASE` (patient page URL).

The JWT targets a **self-hosted Jitsi with token authentication** (`jitsi-meet-tokens`, HS256, `aud`/`iss` = app id, `sub` = domain, `room`, `context.user.moderator`). On Jitsi, the moderator claim is honoured only when auto-owner is disabled / a token-affiliation module is installed; that is server configuration, not HMS code. The public meet.jit.si cannot validate our tokens, so it is not a usable target. JaaS (8x8) uses RS256 with a key id — a later adapter.

## 6. Not done (and why)

- **Rate limiting** on `/tele/v1`: tokens are 256-bit, so guessing is not the risk; abuse limits arrive with the public API (W1, `@fastify/rate-limit`).
- **Sending the link** by SMS/WhatsApp: no comms module yet; the front desk copies it. The `teleconsult.link_issued` event is there for the comms module to use (without the token).
- **Prescription drug-list limits** for teleconsultation (List O/A/B): needs the pharmacy module (M09/M10, `drug_product.tele_list`).
- **Recording**: off; needs its own consent, storage and retention design.
- **Consent withdrawal**: consent rows are immutable; withdrawal is a later addition.
- **Staff UI and patient page**: `hms-frontend` / website work.

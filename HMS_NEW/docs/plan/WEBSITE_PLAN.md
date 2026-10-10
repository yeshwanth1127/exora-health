# Public website → HMS_NEW: plan

Status: **plan — nothing moved yet.**

## 1. What exists today (`hospital-webpage/`)

| Area | Finding |
|---|---|
| Stack | React 19, Vite 6, Tailwind 4, Radix/shadcn UI, framer-motion/GSAP, PostHog, Sarvam voice SDK. SPA with custom routing in `src/App.tsx` (1,100 lines, `?page=` and clean paths) |
| Size | ~220 source files (1.6 MB); `public/` client images 227 MB; `research/` 152 MB; `whatsapp-mvp/` 3 MB (separate Node bot) |
| Entry points (`src/main.tsx`) | `/` website · `/portal` role login (patient / doctor / admin) · `/admin` admin dashboard · `/virtual-opd` teleconsultation |
| Content source | Almost every page reads **local TypeScript data**: `data/doctors.ts`, `doctorProfiles.ts`, `departments.ts`, `branches.ts` (4 Bengaluru branches), packages, blog, FAQ, legal |
| Booking | The in-site booking pages are a **sample walkthrough** ("No appointment has been reserved"). In live mode the Book button redirects to `/book/`, which **nothing in this repo serves**. `lib/hospitalApi.ts` (old backend: availability, slot-holds, appointments with a per-browser `owner_key`) is **not called by any component** |
| Backend calls that do exist | Login/portal/admin/virtual-OPD screens call the old Python backend (`/api/v1/auth/*`, `/api/v1/admin/*`, `/api/v1/me/*`, `/api/v1/doctor/*`, teleconsultation, `/api/v1/voice-agent/config`) with session cookies |
| Duplication | Two full design modes (Original / Light Green): 4 `Original*` page copies + 10 `variants/*` components; `designMode` threaded through `App.tsx` 22 times |
| Prototype claims | Ratings/review counts (16 places), accreditation, insurer partners, testimonials — flagged in `UI_SCREEN_MAP.md` as unverified |
| Tests | Vitest unit tests; Playwright e2e tied to the old backend's control server |

## 2. Decisions (from you)

| # | Decision |
|---|---|
| W-D1 | **Two front-ends.** The existing site becomes the **public, patient-facing website** inside HMS_NEW. Staff screens (admin, doctor, front desk) will be a **separate, separately hosted `hms-frontend`**, signing in through an **external identity provider** (the API's `AUTH_MODE=oidc` already supports this). |
| W-D2 | **Public booking without verification**: name + phone, no OTP. |
| W-D3 | **Keep one design mode**: Original (the current default). Light Green and its variant components are removed. |
| W-D4 | **First goal: public online booking** — real doctors, real slots, a real appointment the front desk sees. |

Consequences:
- `/admin`, `/portal` (doctor/admin roles) and the doctor side of `/virtual-opd` **do not move** to the website; they are rebuilt in `hms-frontend` on the new API. Their code stays in git history as a reference.
- Without verification there is no patient login; patients manage a booking with **confirmation code + phone number** (view, cancel, reschedule). A patient portal can return when OTP verification (and an SMS/WhatsApp provider) exists.
- Teleconsultation (Jitsi) and the voice-agent widget depend on old-backend endpoints; they're hidden until rebuilt.

## 3. Target layout

```
HMS_NEW/apps/
├── api/        existing — gains a public API namespace (/public/v1)
├── worker/     existing
├── website/    ← the public site (moved from hospital-webpage/)
└── hms-frontend/  later — staff app with external IdP login
packages/contracts/  shared Zod request/response schemas used by api and website
```

## 4. Backend work: a public API

The current API serves authenticated staff only. The website needs anonymous endpoints:

| Need | Design |
|---|---|
| Which hospital? | Tenant resolved from the site's domain (or `X-Hospital-Slug` in dev) → `platform.tenant.slug`. No token |
| Who acts? | A per-tenant **website service account** (system staff, `booking_agent` role). Public routes run commands as that account, so permission checks, audit and history work exactly as for staff (`origin_channel = web`) |
| Directory | `GET /public/v1/facilities`, `/specialties`, `/doctors`, `/doctors/:slug` — only **published** practitioner profiles; consultation fee from the active price list |
| Slots | `GET /public/v1/doctors/:slug/slots?from&to&facility` — free slots only, ≤ 14 days |
| Hold | `POST /public/v1/holds` → returns a **hold token** (random secret, stored hashed on the reservation). Only the token holder can book or release that hold |
| Book | `POST /public/v1/appointments` `{holdToken, name, phone, email?, reason?, privacyAccepted}` → booking party (unverified) + appointment; returns the confirmation code. The patient record is linked at check-in by the front desk (already supported) |
| Manage | `POST /public/v1/bookings/lookup` `{code, phone}` → details; `…/cancel`, `…/reschedule` (with a new hold token). Both code **and** phone are required |
| Abuse limits (needed because booking is unverified) | Per-IP rate limits (`@fastify/rate-limit`); max active holds per browser; max upcoming bookings per phone number (e.g. 3); hold expiry stays 5 min; optional CAPTCHA hook later |
| Privacy | Record the privacy-notice acceptance time on the booking party (DPDP); manage-booking responses never reveal more than that booking |

Schema additions (migration `0013_m03_public_directory`):
- `catalog.practitioner_profile`: `photo_url` (until the documents module), `display_order`.
- `platform.department`: `public_slug`, `tagline`, `description`, `is_public`.
- `platform.facility`: `public_slug`, `area`, `maps_url`, `opening_hours jsonb`, `is_public`.
- `booking.reservation`: `hold_token_hash`.
- `booking.booking_party`: `privacy_accepted_at`.

**Public slugs keep today's URLs** (`/doctors/doc-1`, `/locations/kr-puram`, `/departments/gynecology`), so links and SEO don't break.

## 5. Website work

| Area | Change |
|---|---|
| Move | `git mv hospital-webpage HMS_NEW/apps/website` (history kept; tag `legacy-website` marks the last old version). Not copied — `public/` alone is 227 MB. `research/` (152 MB) moves to `docs/research/` or out of the repo — your call. `whatsapp-mvp/` → `apps/whatsapp-bot/` (rewired later to the API as the existing WhatsApp service account) |
| Workspace | Becomes `@hms/website` in the pnpm workspace; dependency versions pinned; `package-lock.json` replaced by the pnpm lockfile |
| Remove | `/admin`, `/portal`, `/virtual-opd` entry points and components; Light Green mode (`variants/`, `designMode`, settings toggle); `lib/hospitalApi.ts`, `lib/auth.ts`, `lib/teleconsultationApi.ts`; old e2e control-server tests |
| API client | `src/lib/api/` — typed client for `/public/v1` using `packages/contracts`; a fresh `Idempotency-Key` per user action |
| Data | Doctors, departments and branches come from the API. Purely editorial content (blog, FAQ, legal, packages, department copy, photos not yet in the DB) stays as static files keyed by public slug |
| Pages rewired | Doctors directory, doctor detail (fee, real next slots), department pages (their doctors), locations, search results, schedule page (real calendar), booking modal (hold → details → confirm), confirmation page; **new** "Manage booking" page (code + phone) |
| States | Loading/empty/error states for every API call; clear messages for `slot_unavailable` (pick another time) and `hold_expired` (start again) |
| Claims | Fake ratings/review counts removed; other unverified claims listed for your sign-off before launch |
| Kept | PostHog analytics (consent banner unchanged), WhatsApp floating widget (link only), SEO script |

## 6. Phases

| Phase | Deliverable | Done when |
|---|---|---|
| W0 — Move | Site lives at `apps/website`, builds and runs **unchanged** on its demo data; staff entry points and Light Green removed | `pnpm --filter @hms/website dev` serves the site; its unit tests pass |
| W1 — Public API | Migration 0013, website service account, `/public/v1` directory, slots, hold, book, manage-booking, rate limits | API tests: anonymous booking end to end, hold-token ownership, per-phone limit, tenant isolation by domain |
| W2 — Real directory | Seed the demo tenant from the site's current doctors/departments/branches (same slugs), then wire directory pages to the API | Pages render from the API with the same URLs; no fake ratings |
| W3 — Real booking | Schedule page, booking modal, confirmation and manage-booking on the API | A visitor books in the browser; the appointment shows in `GET /v1/appointments` for front desk and can be checked in |
| W4 — Browser tests | Playwright against API + worker + website (Chromium is pre-installed here) | Book, conflict (two browsers, one slot), expired hold, cancel and reschedule pass |
| W5 — Deploy shape | nginx: website static + `/public/v1` → API; `CORS_ORIGINS` / domain → tenant mapping; retire `hospital-webpage` deployment | Deployment doc and config reviewed |

The staff `hms-frontend` (external IdP login, front desk, doctor consultation, schedules, admin) is planned separately after W3.

## 7. Open points for you
1. **`research/` (152 MB)** — keep in the repo under `docs/`, or remove from the repo?
2. **Identity provider for `hms-frontend`** — e.g. Keycloak (self-hosted), Auth0, Azure AD B2C, Google Workspace. Only needed when that work starts.
3. **Launch content** — which doctors, photos, fees and claims are real; the site's current data is demo content for "Sri Lakshmi Super Speciality Hospital".
4. **Per-phone booking limit** — 3 upcoming bookings per number is the proposed default.

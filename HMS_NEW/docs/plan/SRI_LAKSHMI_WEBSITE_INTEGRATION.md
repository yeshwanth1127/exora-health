# Sri Lakshmi website -> HMS appointments

13 October 2026. Website: `hospital-webpage` in the Paperwhale repository. Current booking API and staff dashboard: `HMS_NEW`. Voice/Sarvam and real WhatsApp delivery remain outside this change.

## Implemented behavior

HMS is the source of published doctor names, specialties, titles, departments, photographs, biographies, qualifications, languages and virtual-visit eligibility. The homepage, directory, doctor profiles, doctor search and department/location doctor cards consume this roster in HMS mode. Archived frontend arrays remain only in explicitly selected older/demo modes; they never fill an empty or failed HMS response. HMS is the default mode, and `booking_preview=true` does not select the simulated flow in that mode. Doctor metadata uses the backend roster; the static SEO export omits archived doctor detail routes in HMS mode.

The original `SearchResultsPage` / `OriginalSearchResultsPage` and `ScheduleAppointmentPage` / `OriginalScheduleAppointmentPage` layouts are used in HMS mode. Symptom/questionnaire results retain the five-day doctor-and-slot matrix, and booking retains the original monthly calendar, guest form, side summary and review screen in both themes. HMS data is adapted into these components; the separate replacement booking/search screens are no longer selected. Priced published times are clickable. Scheduled but unpriced times are returned separately without a booking token or invented fee and are shown in grey with an explanation; absent schedules show an empty state. A brief booking contact is recorded without claiming phone verification, creating a patient account or matching an existing patient by phone. Reception links the patient at arrival through the existing check-in flow. No WhatsApp message, OTP, payment or video join is implied by this form.

Successful appointments use the existing booking party, reservation, appointment, audit and outbox tables. They appear in staff appointment reads with `originChannel=web`. No separate website appointment store exists. The worker must run for existing downstream encounter/virtual-visit consumers; booking persistence itself is transactional and does not depend on a worker.

## Public contract

| Route | Purpose |
| --- | --- |
| `GET /public/v1/booking/:site/catalog` | Exact server-bound clinic identity, local date/window and published public roster; no staff login details or patient data |
| `GET /public/v1/booking/:site/slots?doctor=...&mode=...&from=...&to=...` | Up to 14 days within the next 31 days; public active service, affiliated published doctor, free slot and effective fee |
| `POST /public/v1/booking/:site/appointments` | Strict contact form and signed slot token; UUID `Idempotency-Key`; minimal confirmation receipt |

The website calls its own origin with `credentials: omit`. There are no staff bearer credentials, tenant IDs, unverified-patient IDs or contact details in browser URLs. Staff `/v1` routes retain bearer authentication. Public CORS is scoped to the exact site's configured origins and never expands staff CORS.

Server registry: `PUBLIC_BOOKING_ENABLED=true`, `PUBLIC_BOOKING_SIGNING_SECRET` (random server-held secret, at least 32 characters), and `PUBLIC_BOOKING_SITES_JSON`. Each entry pins `siteSlug`, `tenantId`, `facilityId`, `identityIssuer`, `identitySubject`, `origins`, optional `websiteBranchId` and explicit `doctorAliases`. The identity must resolve to an active system account with only `appointments.read` and `appointments.book` at that clinic. Registry identifiers are routing configuration, not browser credentials. Changing a doctor's public slug may require updating its old website ID alias mapping; current website links use backend slugs.

Signed selections pin tenant/clinic/doctor/service/type/start/end/fee and expire after 15 minutes. They do not reserve capacity. Confirmation creates and consumes the core hold in one transaction; there is no public arbitrary-time, overbooking, patient chart, appointment lookup, cancellation or patient registration API. Eligibility and pricing are rechecked. Suspended hospitals, inactive clinics/modules, unpublished doctors, withdrawn integration access, changed sessions/fees and occupied/blocked slots cannot create a new booking.

Access, calendar and pricing locks serialize the relevant writes. Calendar mutations acquire the same tenant calendar lock. Cross-module record locks use the owning module role and restore booking role before booking writes; no broad cross-module grants were added. The saved appointment's full doctor/clinic/service/type/time/fee is checked against the reviewed selection before commit.

The browser freezes one request and UUID before sending. Network failure, server failure or an unverifiable receipt keeps the frozen request in session storage and offers recovery with that same request/key. It cannot start another booking while the outcome is unknown. A committed request can replay after its selection expires. A reused key with altered contact details is refused. A revoked account or mismatched receipt may require reception to reconcile the original request; the UI continues to block another submission.

## Hospital data and preview

The running Sri Lakshmi database is `hms_sri_lakshmi` on the existing local PostgreSQL service at 54359. This is a persisted Sri Lakshmi clinic, not a synthetic roster rendered by the webpage. It contains 17 doctor profiles imported from the site's existing source archive (collected 3 October 2026), departments, consultation service definitions and calendars. Missing qualifications, experience, languages, fees and hours were not fabricated; virtual visits were not assumed. The import is a one-time source-data migration, not runtime frontend data. Its source date does not verify current clinical credentials or schedules.

`scripts/onboarding/import-sri-lakshmi-roster.mjs` requires the exact existing tenant/facility IDs and admin database URL through `SRI_LAKSHMI_TENANT_ID`, `SRI_LAKSHMI_FACILITY_ID`, `SRI_LAKSHMI_ADMIN_DATABASE_URL`. It checks the clinic name, imports only missing `SLH-...` staff records, and preserves existing staff edits. It neither resets a database nor invents fees/hours/patients. A production tenant and staff OIDC identities must be provisioned through the deployment's normal process; local dev identities are not a production login mechanism.

- Website: `http://127.0.0.1:5210/` (`VITE_BOOKING_MODE=hms`, `VITE_HMS_BOOKING_SITE=sri-lakshmi`).
- Staff: `http://127.0.0.1:5208/staff/`; the local sign-in defaults to registered identity `sri-lakshmi-admin` through ignored staff `.env.local` (`VITE_HMS_DEV_SUBJECT`). Old seeded development identities are not offered when this database-specific default is configured. This config applies only while local development sign-in is enabled, not to production OIDC.
- API: 3059. Server signing/binding configuration is in ignored `.env.sri-lakshmi-preview`, with real Meta sending/submission disabled.
- Previous synthetic preview records remain in their original database; the previous 5198/3049 preview is untouched.

Edit doctors under Workspace -> Doctors. Set the compatible consultation fee under Hospital catalogue, then publish each doctor's weekly or one-off hours in Schedules. A virtual appointment also needs explicit doctor eligibility, virtual service/hours/fee and the existing video-provider/worker/consent flow. As checked after the restoration, Dr Akshatha has published Diabetology consultation hours. The saved ₹1,000 fee belongs to Cardiology consultation, so those Diabetology times are visible but cannot be booked online until that service has an applicable fee. No fee was copied or invented to make a test booking. Configure each published schedule and its own service fee together.

## Hosted wiring

`hospital-webpage/Dockerfile.hms` builds HMS mode. Its `nginx.hms.conf.template` proxies `/public/v1/` to the runtime `HMS_PUBLIC_API_ORIGIN` private HMS upstream. Supply that origin; it has no fallback to the old Python backend. Web assets and API routes share the public HTTPS website origin. The reverse proxy overwrites forwarded IP headers. Configure `TRUSTED_PROXY_CIDRS` on the API with only the actual private proxy addresses/subnet; never a wildcard. With no configured trusted proxy, forwarded IP headers are ignored.

Anonymous budgets are persisted across API replicas: 90 reads/minute/IP, 30 write attempts/10 minutes/IP (failed requests also count), and 3 successful online bookings/day/phone. Only keyed hashes are retained in the budget table. Counters for a returning subject are pruned after two days; fleet-wide maintenance should prune inactive old counters too. Configure edge limits and monitor the same limits under the real proxy/network before activation. These limits deliberately do not imply OTP verification or consent.

Before hosted activation:

1. Supply actual Sri Lakshmi schedules/fees and review imported roster content.
2. Set the confirmed HTTPS origin, private API upstream, real tenant/clinic/integration identity and server secret; run the migrations (including `20261013100000_public_booking_budget.sql`) and generated schema.
3. Use production OIDC/DB/security configuration. Do not expose local `/dev` sign-in.
4. Verify proxy origin/IP handling, rate limits, one real permitted booking, fresh staff read and worker effects in that deployed environment.

The hosted container/proxy and production persisted booking have not been executed or verified. Docker is installed, but its daemon was unavailable during this check. HTTPS upstream certificate verification and SNI are enabled in the proxy template. No deployment, provider call or patient message was made.

## Verification

Backend regression and meaningful public HTTP tests cover persisted web reads, simultaneous requests, lost-response replay, changed-body refusal, expiration, token tampering, forbidden origins, exact account scope, unpublished profiles, suspended hospitals, concurrent department closure/calendar blocks, fee changes and IP-spoof resistance. Frontend tests cover roster refresh/empty responses, metadata, type-aware slot requests, bounded date grouping, receipt validation, frozen retries and no simulated OTP. Desktop browser checks verify the persisted 17-doctor roster, mapped doctor profile/booking route, empty real availability and visible setup-action outlines. Mobile remains outside the requested scope.

Final local checks: 36 backend test files / 380 tests, 10 website test files / 76 tests, and 139 staff tests passed. Backend type checking and both frontend builds passed; existing large-bundle warnings remain. `git diff --check` passed. Backend tests use the separate `hms_public_booking_test` database and do not reset Sri Lakshmi's data. These results do not verify a hosted deployment or a production booking.

Restoration acceptance (13 October): browser verification shows the original symptom results with backend doctors, all 17 doctors when search is cleared, real grey Diabetology times and the original doctor calendar. Six additional frontend tests protect both themes, symptom filtering without static padding, exact date/time handoff, review before POST, validated confirmation, unknown-outcome replay and unpriced times. The backend adds cross-department published-service and unpriced-schedule coverage. These are local verification results; no appointment was created in the Sri Lakshmi database during this check.

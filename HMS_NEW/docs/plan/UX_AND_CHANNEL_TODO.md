# Next phase: staff UX and channel integration

12 October 2026. The product owner accepted and closed the scoped staff implementation phase. Current focus is UX/UI and operations review. **Public webpage and Voice-bot target discovery/integration are ON HOLD at the owner's explicit request: “wait on that not yet log that as todo”.** Do not ask for repo/account details again or start channel implementation until resumed. This document carries deferred work forward; closure does not assert provider delivery or production acceptance.

## Completed navigation changes

- One **Appointments** entry: Appointments, Waitlist and Queue tabs. Existing `/staff/appointments`, `/staff/waitlist`, `/staff/queue` links select the matching tab. Existing actions and backend identities are retained; navigation still checks unsaved changes.
- **Hospital catalogue** and **Doctors** moved to Workspace.
- One **Activity** entry: Staff activity (audit/change/access reviews) and System status (event processing/holds/database readiness). Existing `/staff/activity` and `/staff/operations` links remain usable. All-clinic audit permission remains required; System status also requires appointment reads in the selected clinic.
- Design & UX guide removed from navigation, route renderer, both current and legacy frontend components, current inventory and dedicated styles. Historical design documentation stays in Git; it is not a staff feature.

## UX review TODO

**Desktop only by owner instruction. Mobile optimisation and responsive polish are deferred; do not start them during this UX slice.**

- Review the receptionist's daily sequence: appointment discovery → arrival/check-in → queue → consultation → completion/follow-up. Reduce repeated filters and preserve useful context across tabs; the current tabs intentionally retain their original separate filters.
- Display server-provided current-clinic role titles when a future session contract includes them. For now non-clinical staff without tenant.manage are labelled Clinic staff, not misidentified as administrators.
- Review shared date/doctor controls and saved tab/filter state. Do not infer a queue token or merge waitlist identity into an appointment without its existing verified backend command.
- Test empty/loading/error/stale-write/unknown-save states with staff, including keyboard and desktop layouts. Phone/mobile review is deferred. Consolidated navigation has local browser evidence; full persona usability acceptance still needs the owner/team.
- Review clinical handoff, walk-ins, care-team permissions and escalation; retain reasoned cancel/no-show and explicit consent. Billing/pharmacy/diagnostics/inpatient remain outside this phase.
- Activity should explain processed background events separately from patient contact. Add worker heartbeat/backlog/dead-letter monitoring in a future operational-readiness slice; current API Ready only proves database connectivity.
- Loyalty is a labelled concept, not an operational member/benefit system. Decide its future placement during UX review; no membership/payment build is implied.

## Channel integration TODO — public webpage and Voice bot ON HOLD

| Channel | Available HMS foundation | Work to resume after target confirmation |
|---|---|---|
| WhatsApp | Staff inbox/cases/content/campaign preparation, signed inbound account binding, immediate STOP/purpose consent, local queues and receipt evidence | Actual Meta account and approved templates, outbound claims/lease/media/send adapter, bounded retry/unknown-outcome reconciliation, correlated delivery receipts, quiet hours and provider acceptance; production storage/scanner |
| Voice bot | Normalized authenticated event ingestion, real voice-appointment link checks, bounded call history, transcript/recording consent/expiry/access audit | Identify actual runtime repository and normalize its callbacks; use existing authorized booking commands for catalogue/slots/hold/book/move/cancel. Validate account/pinned version, recording hosts, retention and live consented handoff. No unapproved public call launcher/telephony expansion |
| Public webpage | Clinic catalogue/schedule/booking domain and manual approved-host link registry | Identify exact frontend; define public safe read/booking/auth/rate-limit boundary. It must not receive staff bearer tokens or call unrestricted staff routes directly. Map minimal booker/patient identity, availability/hold expiry/idempotent booking, cancellation/reschedule authority, messaging consent and trusted channel attribution; test persisted round trip into this Appointments workspace |

When the relevant integration resumes, all channels must converge on the same HMS booking/queue/clinical records through authorized server adapters. Never create a second appointment database, link clinical patients by phone alone, report saved local messages as delivered, or put provider credentials in the browser. The patient WhatsApp booking bot and public booking API were excluded from the closed staff phase; any new public interaction needs an explicit next-phase contract decision.

## Deferred provider/release work carried forward

The old G19/G20 partial items are closed for this accepted local phase and carried here as substantive future work, not marked implemented. Also retain real Voice/PostHog/video acceptance, approved booking destination, production OIDC/deployment, production object storage/scanner and retention/purge policies. No live external operations are enabled by this document. See the [technical ledger](BACKEND_WORK_LEDGER.md) for exact implementation status and [operations review](STAFF_OPS_REVIEW.md) for local evidence.

## First annotated workflow changes — 12 October 2026 (patient/visit navigation superseded below)

Implemented the owner’s ten browser comments in the staff frontend:

- Schedules: removed the explanatory banner and inline overbooking switch. The existing **Workspace settings → Booking policy** controls the same clinic policy; schedule reads still respect it.
- Waitlist: removed the messages/consent entry and dialog from this page; kept the underlying contact consent/STOP protections. Request label is **Name**. Offers show the actual doctor selected on the request and a start/end time. Doctor is fixed because the persisted request is doctor-specific.
- Waitlist availability: **Anytime · next 60 days** visibly supplies the contract's date range and shows its end date. This is a bounded preference, not indefinite availability.
- Queue: opens with **All doctors** in the current clinic, displays doctor per token, and requires an explicit doctor for call-next/walk-in. The API requires staffId, so the frontend combines authorized per-doctor reads. A failed read fails the aggregate view; it does not imply a partial queue is complete.
- Booking: full-page Patient → Doctor & time → Review & confirm sequence, retaining real slot holds, expiry, idempotent writes and release on departure. Patient-record booking carries the exact patient ID.
- Appointment details: full-page booking/arrival view. The second review replaced the generic consultation-worklist link with the exact appointment→encounter route.
- Patient record: initially had five sections; the second review removed Consents and Identity & contacts and consolidated into Overview / Medical history. Saved previous visits link to their full consultation record. Registration is demographics; clinical documentation belongs to a visit. Consent is recorded explicitly after identity creation; registration never implies consent.
- Consultation: full-page patient header, section navigation, findings/notes/diagnoses/care/referrals and a separate completion panel showing saved notes, unresolved drafts and diagnoses. The assigned doctor starts/completes the visit using the existing commands. Unsaved new notes/diagnoses and unsigned persisted notes prevent progression to completion. Completion keeps the existing disposition/follow-up contract and appointment/queue reconciliation.

### Backend ledger carried forward from these comments

| Item | Current capability | Remaining work / decision |
|---|---|---|
| Doctor booking/blocking own schedule | Built-in Doctor lacks `appointments.book` and `schedules.manage`. Current grants are facility-wide. | **Backend TODO:** enforce an explicit own-practitioner policy on hold, range-hold, booking, exception preview/create/revoke and impact-resolution commands. Granting the current facility permission also enables other-doctor actions, so it does not satisfy the requested self-only behavior. No broad grant or frontend authorization substitute was added. |
| Indefinite waitlist preference | Required preferredFrom/preferredTo and a specific doctor; maximum 60-day span. | Decide whether to support an explicit unbounded preference and/or any-doctor request. Change contract, storage, expiry/matching/readback and tests together; never silently extend or roll a patient's preference. |
| Clinic-wide queue query | Existing read endpoint requires staffId. Frontend now aggregates all authorized doctors in the selected clinic. | Optional aggregate endpoint for efficiency and a consistent snapshot; preserve tenant/facility permissions and doctor identity for writes. Cross-clinic queues need a separate scope decision. |
| Repeat-patient chart access | Clinical role permissions plus care relationship; active encounter/explicit care assignment supports care. Past encounter participation ends at completion. | Decide longitudinal care assignment policy and staff workflow for routine repeat-patient review. No automatic broad access or emergency break-glass for routine browsing. Existing care assignments can grant permitted ongoing access without schema changes. |
| ABHA external medical records | ABHA number/address registry identifiers only. No imported ABDM clinical-record source. | Deferred external integration: authorised consent/request lifecycle, authenticated ABDM adapter, provenance, reconciliation, retention/access and tests. Identifier verification is not record import. |

Public webpage and Voice-bot integration remains ON HOLD. This UX slice adds no backend module, migration, provider call or role grant. Earlier unfinished/provider notification work remains under the existing deferred G19/G20 release scope; passing baseline tests does not assert live delivery.

## Second annotated desktop review — implemented

The staff mental model is **Patient → Appointment → Consultation**: patient details and ongoing history; a booked time and arrival; one visit’s clinical notes and outcome. These are distinct records with explicit links, not interchangeable tabs.

- Patient record has only **Overview / Medical history**. Overview contains details, related people and duplicate records. Removed hospital-consent entry, identity entry/removal, and routine care-assignment controls. Existing consent and identifier data/APIs remain intact; the app never assumes paper consents are signed. Flags and NKA belong in Medical history. External identifiers are read-only; ABHA retrieval remains unconnected.
- “Module Review” is the synthetic record created for local UX verification, not a module. That exact test ID is shown as **Demo patient / Test patient** across patient, appointment, booking, queue, consultation and schedule views. Persisted identity and other patients are unchanged.
- Appointment header has one primary **Continue consultation / View this visit’s summary** action via `GET /v1/appointments/:id/encounter`, plus a secondary patient-record link. No patient/date guess or central competing buttons.
- Appointment/Waitlist/Queue navigation uses three prominent desktop choices with descriptions. Date, doctor, status and visit filters have visible captions.
- Consultations use focused sections instead of a long anchor-linked form: Visit note, Vitals & findings, Patient history, Complete visit. Forms stay mounted when sections change, preserving unsaved inputs. Completed visits open saved notes and cannot add new visit notes or complete again; authorised correction workflows remain available under an explicit label. Care & referrals and the additional hospital-record forms were subsequently removed from this consultation workspace at the owner’s request.
- **Start visit now** opens an outpatient encounter for a registered patient who is physically present. For a doctor, attendingStaffId is their own identity. Uses the existing idempotent `POST /v1/encounters` contract; it does not create a future booking or queue token. Start → draft → sign → choose outcome → complete is now visible and browser-verified.
- Own schedule rows show **Your schedule**, Book appointment and Block time. Without write permission, controls remain disabled with a clear account-access explanation. Removed non-saving planning controls for unprivileged users. Users already authorised at facility level can select exact ranges; cross-slot preflight now respects published sessions, occupancy, visit mode and clinic, and save still uses atomic backend holds.

### Dedicated backend follow-ups

1. **Own-doctor booking/blocking:** add resource-based authorization described in the ledger before enabling built-in Doctor actions. Do not extend weekly-hours/other-doctor privileges as a shortcut.
2. **Routine medical-record access:** decide longitudinal treating-doctor access and place assignment management in an administrator workflow. Role permission and active-visit/explicit care relationship remain separate; emergency access is not routine access. A doctor opening an ordinary visit is added as attending through the existing domain command.
3. **New unbooked visit guard:** decide duplicate active-visit policy, clinic affiliation checks and doctor self-attending rules for `POST /v1/encounters`; stable idempotency protects retries of the same intent, not independently started duplicate visits.

Public webpage and Voice-bot integration remains ON HOLD. Desktop only; no mobile optimisation, backend code/migration/provider action or role grant in this review.

### Consultation scope simplification — 12 October 2026

Removed the Care & referrals navigation item, its entire form panel, and care-plan/referral counts from the completion review. Active visits have four sections; completed visits have three. Existing clinical records and backend contracts are retained. This is a desktop UI reduction; no replacement module or backend work is required by this request.

## Booking, duplicate alerts and visit status — 12 October 2026

- Registration offers **Register only / In person / Teleconsultation** as the next action. The selected type is carried into the appointment form after patient creation; it is not stored as a permanent patient attribute.
- Appointment type is explicit before slot selection and in review. Teleconsultation only lists real free virtual slots; it cannot silently fall back to an in-person session. No virtual hours means an explicit empty state, not a pretend video appointment.
- Registered-patient booking checks all paginated current/upcoming appointments at this clinic. An alert links to each existing appointment. Review requires confirmation that a second booking is intentional, with a fresh check before save. Moving excludes its original booking. Unregistered contacts and races still need the server policy in UX-B05.
- The patient record shows today’s actual visit status, completed-summary links and existing bookings. Removed the ambiguous generic **Start visit now** action. **Create an unbooked visit** clearly means separate care without an appointment; it shows open/completed visits and bookings, refuses a second open visit with the same doctor, and asks acknowledgement before a separate visit after a completion or alongside a booking.
- A future appointment explains the clinic-date check-in rule. A separate unbooked completion is shown explicitly as independent from that booking. Linked visits still use exact encounter IDs; a finished encounter awaiting worker processing does not display Continue consultation or fabricate a completed appointment.
- Early booked visits need the existing move→check-in→linked visit path, or the dedicated backend command in UX-B04. Existing user booking/visit records were not relinked or changed by this UX repair.

Desktop only. Provider/webpage/Voice integration stays on hold. No backend source, schema migration, clinical access grant or external provider action.

## Schedule overlap, waitlist validation and patient header — 12 October 2026

- An occupied whole published slot now uses the existing reasoned overbooking command automatically when the clinic setting and staff permission allow it. Observed live holds and blocks stay unavailable. Partial/multi-slot occupied ranges display explicit published-slot choices; selecting one visibly replaces both endpoints. Arbitrary overlap ranges and atomic hold-versus-booking checks are deferred as UX-B06; the frontend never silently truncates the requested duration.
- Waitlist phone fields validate before submission. Ten-digit Indian mobiles normalize to +91; other numbers need an explicit +country-code prefix. The reported unprefixed 14-digit value is refused with an inline field message. Valid formatted numbers are normalized; retries of the same submitted intent retain one idempotency key.
- Patient name, test badge, MRN and demographics now sit at the right of the Patient record title in the desktop header, replacing the separate summary card. Patient details still load from the existing scoped query.

Verified in the isolated local preview: valid Dr Vikram Anytime request saved and survived a fresh sign-in; reasoned 11:15–11:30 extra appointment persisted alongside the original 11:15–12:45 booking. Synthetic request withdrawn and synthetic extra appointment cancelled through normal audited actions after verification. Original bookings and blocks were unchanged. Frontend 70 tests PASS, TypeScript/build PASS, lint 0 errors /17 existing warnings. No backend code or schema change. Desktop only; external integrations remain on hold.

## Teleconsultation availability and schedule setup — 12 October 2026

- Booking replaces its date input with a monthly availability calendar and a times panel. Each day shows free times for the selected doctor, clinic and appointment type. Past days/times, occupied slots and other clinics/modes cannot appear as open availability. Month navigation uses existing slot reads within the API's 31-day maximum; loading/read failures are explicit. Selecting a date does not hold a slot; choosing a time uses the existing hold/review/confirm flow.
- Schedules exposes **Teleconsultation hours** beside weekly-hours configuration and on each authorized doctor row. Booking also links directly to the selected doctor's virtual hours. Weekly hours clearly labels In person / Teleconsultation and preserves the current separate per-mode preview/save semantics, conflict review and permissions.
- Doctors without video capability show the prerequisite **Doctors → Doctor details → Accepts video consultations → Save profile**, with an exact doctor-profile link. The UI blocks publishing virtual hours until that capability is enabled; it does not switch it on automatically or grant schedule access. No doctor calendar/hours were modified for this review.

PASS local browser: Dr Asha's existing Saturday hours appear as six open slots on 17, 24 and 31 October; 17 October shows the saved 14:00–16:00, 20-minute virtual slots. Selected 14:00, obtained a real hold, reviewed 17 October / Teleconsultation, then released it and observed six free times again without creating an appointment. Virtual-hours shortcut loaded Asha's existing Saturday rule; Vikram's prerequisite linked to his exact disabled profile switch. Frontend **72 tests PASS**; TypeScript/build PASS; lint **0 errors /17 existing warnings**. No backend work or external call integration. Public webpage/Voice work and mobile optimization remain deferred.

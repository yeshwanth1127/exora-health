# Staff booking setup evidence map

Implemented 13 October 2026. Frontend configuration reads only; no migrations, authorization changes, provider connections or live writes were made for this packet.

| Setup item | Authorized evidence used | Meaning and boundary |
| --- | --- | --- |
| O00 Clinic context | App's existing `/v1/facilities` read and real identity/grants | Tenant-wide `facility.manage` is required to create a first clinic. An empty permitted set does not imply no tenant clinics. Do not fabricate a selected clinic to mount creation. |
| O01 Clinic details | `GET /v1/facilities/:facilityId`, `catalog.read` | Active clinic with recorded address, city, state and timezone. Recorded fields are not public publication or contact verification. |
| O02 Doctor/calendar | Scoped `GET /v1/practitioners`, `catalog.read`; persisted `calendarId` | Authorized directory affiliation/calendar evidence only. Account invitation/login and professional registration remain separate. AddDoctor saves affiliation with its existing idempotency key, then runs the naturally idempotent calendar operation separately; failed second step remains visible and resumable. |
| O03 Consultation/fee | Active scoped directory services + current-date price book, `catalog.read` | Compatible mode and effective service/doctor-specific price; deliberate zero is valid. Preview is an existence check, not the exact booking quote. The booking flow validates the service, doctor, fee and selected slot together. |
| O04 Hours | Selected doctor's scoped effective `/sessions`, `appointments.read` | Future fixed-slot sessions in the next 31 days. No free capacity is different from no published configuration. One doctor and visit mode are inspected at a time; this is not a tenant-wide readiness aggregate. |
| O05 Handoff | Informational current manual reception workflow | No persistent routing/owner assignment contract is invented. Staff access and reception contact are independently managed. |
| O06 Availability preview | Scoped `/slots?includeUnavailable=true`, `appointments.read` | Free capacity within the checked period. No holds/bookings/messages created. Fully booked/held/blocked sessions remain configured. The final “Confirm the exact booking” item stays `optional_deferred` (“Checked during booking”) and is excluded from the confirmed configuration count; exact acceptance requires the booking workflow's live quote and validation. |
| O07 Optional modes | Existing module notices/readiness reads remain authoritative | `acceptsVirtual` does not prove video consent/provider/signing readiness. WhatsApp/Voice/Google are optional; Loyalty remains concept-only. No fabricated Connect action. |

Read failures and missing grants are `unknown`; never inferred as zero configuration. Loading is distinct. Guide visibility is limited to actors with configuration management grants. Read-only staff remain on their authorized workflow. Checklist state is recomputed from records on clinic change/reload; hide/show applies only to the mounted guide and does not alter persisted readiness.

## Explicit remaining boundaries

- A full readiness aggregate that guarantees one compatible doctor/service/fee/date combination, professional signing eligibility, current video-consent version/provider capability and supported operational routing is not implemented. The frontend labels configuration evidence separately from exact booking acceptance.
- Candidate staff types remain governed by the existing affiliation API; the frontend does not invent clinical eligibility rules. Add-doctor directory load failures no longer masquerade as “add a department.”
- A first-clinic save that does not grant the creator access must remain “created; access requires assignment.” Actual provisioning/creator-grant guarantees require backend contract confirmation.
- Existing Voice and Growth modules already expose runtime readiness and unavailable provider notices while preserving readable records; no extra unverified provider request was added.
- Meaningful local derivation tests cover unknown/forbidden/loading evidence, inherited zero/effective fee, mode mismatch, calendar absent, clinic scope, inactive clinic, expired sessions and fully booked configuration. Mobile, production and new persisted onboarding writes remain unverified.

## Focused empty-state coverage

- E03/E04: Doctor setup CTA follows configure permissions; successful scoped doctor read is required before zero-doctor state.
- E05/E06: Catalogue department/service prerequisites have real add actions where permitted.
- E07: Missing persisted calendar retains Set up calendar; partial AddDoctor failure resumes only calendar.
- E11: Catalogue fee read errors are unavailable, not unpriced. Missing default fee offers Set fee; mode-specific and doctor-specific fee boundaries remain explicit.
- E14/E15: Lookup starts with Find the patient first/Focus search; known no-match offers registration only through an explicitly provided permitted callback, otherwise Edit search.
- E20: Successfully empty dated video worklist offers Book video appointment with virtual mode preselected when authorized. Copy does not claim provider or video setup ready.
- E21: Consultation quiet state points to existing appointment/arrival flow; filtered scope uses filter-mismatch wording.
- E22/E23: Existing authorized provider/runtime notices identify integration-owner requirements without a fake Connect/test action; saved records remain visible.
- E24: Successfully empty growth cohort offers review of the real booking-link section; other periods/traffic remain independent.
- E27/E28: Shared loaded/error wrapper is owned by another implementation packet. Doctor/service second-step outcomes are now explicit, preserve successful first operations and block abandoning pending/unknown requests. Service unknown outcome offers a scoped current-record check and clears uncertainty only if current recorded fields/fee match the requested state; it does not claim an audit receipt or replay a non-idempotent write.
- E29/E30: Existing module/action authorization and suspension remain server/adapter controlled. No permissions or module state changed.
- E19/E31: Full video readiness / “Ready to accept bookings” promise is intentionally not inferred. Guide confirms selected-doctor configuration and read-only availability evidence; the live booking quote and provider/consent/signing checks are separate. Missing aggregate contract is explicit above.

F17 clinic geography uses human names mapped to preserved two-digit stored values, with other/legacy values retained. New clinics no longer silently default to Karnataka. Code suggestions remain editable and existing codes stay immutable. Time zones use IANA values and the saved value remains selectable. Label source: [NIC e-Invoice master codes](https://einvoice1.gst.gov.in/Others/MasterCodes), checked 13 October 2026; this selector does not interpret GST liability or jurisdiction.

## Bounded final review — 13 October 2026

Owned implemented states: **E03, E04, E05, E06, E07, E11, E14, E15, E20, E21, E22, E23, E24**; scoped parts of **E27/E28** (doctor/calendar and service/fee partial or unknown outcome). This is implementation coverage, not blanket persisted-write/browser acceptance. E20 is a dated video-worklist empty state and does not assert that video setup is ready.

Owned intentionally deferred states: **E19** full video readiness; **E31** ready-to-accept-bookings completion promise. Current guide confirms known configuration by selected doctor and mode, with an independent `acceptsVirtual` prerequisite. Consent version/provider capability, professional signing eligibility and an exact compatible session/service/effective-fee quote remain outside this derived evidence. A service priced elsewhere in the clinic must never become proof that the selected doctor's actual session service is priced. Fully booked or blocked sessions remain configured; they do not mean setup must be reset.

Other packets own **E01/E02, E08–E10, E12/E13, E16–E18, E25/E26** and the global **E27–E30** read/unknown/permission/module patterns. No claim of implementing all 31 states is made by this packet. O00 bootstrap entry and account-grant resolution are implemented/reviewed separately by the App owner; O05 routing remains informational. Dismissal is mounted presentation state, not domain completion.

Latest reviewed SetupGuide requests remain gated by real catalog/appointment read grants and scoped to the selected clinic. Navigation permissions must compare a destination's base route before its query parameters; opaque doctor/mode parameters do not change the underlying required read grant. This review found no new API authorization bypass. It did not exercise production, provider integration, mobile or new persisted clinical writes.

Final derivation regression checks additionally cover a wrong-clinic directory, the inclusive 31-day session boundary and a current-date fee expiring before an available next-day session. Even with four confirmed configuration checks and an open slot, the exact booking step remains `optional_deferred`; the guide does not certify session/service/date pricing or E31 readiness.

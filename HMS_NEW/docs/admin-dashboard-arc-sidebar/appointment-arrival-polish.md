# Appointment entry and quick arrival — 19 October 2026

User request: fix clipped appointment details, replace the awkward DOB picker with direct day/month/year entry, and allow fast clinical arrivals without a full registration form.

| Before | After | Why |
| --- | --- | --- |
| Booking type cards auto-filled narrow 180px columns, clipping Video consultation | Booking supplies the existing RadioCards `minColumnWidth=280` option | Complete labels fit without changing the Arc component's styling or motion |
| Patient action buttons and heading shared a crowded line | Actions have their own wrapping row; booking footers and detail headers wrap | Content stays readable within the desktop workspace |
| DOB required a calendar and year selection | Three Arc Input fields: Day, Month, Year | Direct keyboard entry; no scrolling through birth years |
| Queue arrival disabled until a doctor was selected outside a narrow drawer | Quick arrival opens a full page, with doctor selection inside | One visible entry from Appointments or Queue |
| New walk-in required a separate patient-registration save | Name + optional phone, then Check in and issue token | DOB, sex and other demographics can be recorded later |
| An unlinked booking required full registration before check-in | Quick check-in in the appointment's arrival section | Same minimal identity flow for existing bookings |

## Domain and permission contract

A clinical visit still needs an individual patient identity. Quick arrival creates an ordinary minimal record/MRN with unknown sex and null DOB, then creates/checks in the visit and issues its token in the **same transaction**. It does not create an anonymous shared chart or pretend full demographics were collected. Name is kept as entered in givenName; it can be refined later. A booking caller's phone is never silently copied as the patient's contact.

Existing endpoints accept `newPatient: { name, phone? }` as an alternative to `patientId`:
- `POST /v1/walk-ins`: exactly one identity is required.
- `POST /v1/appointments/:id/check-in`: newPatient is allowed only on unlinked bookings.

Both require `appointments.check_in`; creating an identity additionally requires `patients.register` at the visit's clinic. Nurses without registration permission can still select existing patients. Capacity/session/day rules remain authoritative. Pending or unknown commands lock editable controls; recovery replays the original idempotent request. Failed checks roll back the identity as well as the visit/token.

The patient module exposes `createPatient(ctx, input)` for transaction composition. Booking switches to the existing patient role for that insert and restores the booking role; no database grants, schema changes or broader write roles are added. Existing registration auditing and patient.registered events are preserved alongside appointment events.

Returning-patient search remains available; no automatic identity matching by name/phone and no silent merging. Quick arrival is intended for a new patient, not a shortcut to duplicate a returning patient's chart.

## DOB behavior

`BirthDateField.tsx` uses existing Arc Inputs and stores calendar-only YYYY-MM-DD values. All empty means unknown. Partial/invalid dates block native form submission and retain the leave guard. Leap years, actual month lengths and future birthdays are validated against the clinic's local day. No estimated birth date is invented. Appointment/report calendars retain their current behavior. The user explicitly approved this DOB-specific departure from the calendar control.

## Verification and continuation

- 246 staff tests pass (three new DOB tests); production build passes.
- 453 API/database tests pass in 44 files. The 48-test HTTP suite was rerun after adding a post-insert rollback check.
- Independent installed workspace root typecheck passes; local checkout's root check needs the newer platform/public/admin workspace dependencies, so the independent copy was used.
- Browser observed direct DOB entry, invalid 31 February refusal and valid 13 February acceptance, Quick arrival navigation and its optional details, and no truncated text inside the Video consultation card. Screenshots: `verification/dob-direct-entry.jpg`, `quick-arrival.jpg`, `booking-unclipped.jpg` and `booking-time-step.jpg`.
- Happy-path writes, retries, permission denials and rollback were exercised against isolated test tenants/database. No patient/arrival was created in the interactive clinic for demonstration. The actual browser check also reached Doctor & time, showing the ten-day picker and available time details/actions while scrolling. It did not place a slot hold or confirm a booking; the confirmation/review state is not claimed as visually reverified.
- Runtime: staff5198 → updated isolated API3080; both return HTTP200. Desktop only. No new Arc component folders: still 48 (44 adopted + 4 support).
- This follow-up is local work after PR2/main merge; publication is not implied by local checks.

# PRD: Everything the staff workspace shows can be changed there

Status: approved for execution by the product owner on 2026-10-11 ("the goal is to get everything to be editable … make everything work from a code perspective and also design tests … ping me once we are done with all code work"). Browser verification is done locally by the product owner afterwards.

Source of gaps: `docs/plan/BACKEND_WORK_LEDGER.md` (G13, G14, G16, G24) and the audit below. Schema authority: `docs/design/erd-v2`. Every rule in `backend-integration-phases.md` ("Rules every phase follows") applies.

## Problem

Several screens show records that nobody can create or change:

| Screen | Shows | Before this phase |
|---|---|---|
| Hospital catalogue | Clinics, departments | Read-only. No address, phone, directions or arrival instructions anywhere. |
| Hospital catalogue | Services, consult rooms | Read by the API, never shown. |
| Doctors | Specialty, clinics, fee, booking status, calendar | Profile editor was a local draft ("awaiting integration"). Fees read-only. No way to add a doctor to a clinic or open a calendar. |
| Patients | Demographics, phone | "Demographic editing is not available yet." |
| Workspace settings | Custom roles | Could be copied and edited but never retired. |

And regressions in booking:

| # | Regression | Cause |
|---|---|---|
| R1 | A newly added doctor can never be booked | No screen affiliates a doctor with a clinic or opens their calendar; Booking lists only doctors with a calendar. |
| R2 | Hours saved for a doctor with no earlier hours price every booking at "Fee not available" | `replaceWeeklyPlan` copies the service from replaced hours; with none it saves `healthcare_service_id = NULL`, and the fee lookup needs a service. |
| R3 | The Book appointment sheet can open with no doctor selected | The doctor is picked once when the sheet mounts; the doctor list loads asynchronously. |
| R4 | A phone caller who is not registered can't be booked from Appointments | The API takes a booking party, but the sheet demands a registered patient. |

## Goal

Every record a screen shows can be created and edited from that screen by someone holding the matching permission, through `/v1`, audited, with the same facility-scoped authorization as the rest of the API. Each user flow is written down and covered end to end by an HTTP test; a test also proves every `/v1` call the frontend makes has a backend route.

## Permissions (all already in `010_permissions.sql`; no role bundle changes)

| Change | Permission | Where |
|---|---|---|
| Create a clinic | `facility.manage` | every clinic |
| Edit a clinic's details / status | `facility.manage` | that clinic |
| Departments, consult rooms | `facility.manage` | the department's / room's clinic |
| Services (create, edit) | `catalog.manage` | the service's clinic |
| Fees (service default, doctor-specific) | `pricing.manage` | the service's clinic |
| Doctor profile (tenant-wide: specialty, bio, languages, virtual) | `catalog.manage` | every clinic the doctor is affiliated with (none → every clinic) |
| Add / end a doctor's clinic affiliation | `catalog.manage` | that clinic |
| Open a doctor's calendar | `schedules.manage` | any clinic they're affiliated with (existing route) |
| Staff name / phone | `staff.manage` | every clinic they hold a grant at (same rule as status) |
| Patient demographics, contacts, address | `patients.update` | any clinic (patients are tenant-wide, like `patients.read`) |
| Retire a custom role | `access.manage` | every clinic |

## API (new)

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/specialties` | Reference list for pickers (`catalog.read`). |
| GET | `/v1/facilities?includeInactive=true` | Inactive clinics only for `facility.manage` holders. |
| GET | `/v1/facilities/:id` | Full clinic details (`catalog.read` there). |
| POST | `/v1/facilities` | Idempotency-Key. Code is fixed after creation. |
| PATCH | `/v1/facilities/:id` | Optimistic `version`; 409 `stale_version`. Deactivating needs no future booked visits (409 `future_appointments`) and can't remove the last active clinic. |
| GET | `/v1/facilities/:id/directory?includeInactive=true` | Adds inactive rows and status for managers. |
| POST | `/v1/facilities/:id/departments`, PATCH `/v1/departments/:id` | Deactivating needs no active services or current doctor affiliations (409 `in_use`). |
| POST | `/v1/facilities/:id/consult-rooms`, PATCH `/v1/consult-rooms/:id` | Rooms are `platform.location` of kind `consult_room`. |
| POST | `/v1/departments/:id/services`, PATCH `/v1/healthcare-services/:id` | Creating a service also creates its consultation billing item. Optional opening fee needs `pricing.manage`. |
| PUT | `/v1/healthcare-services/:id/fee` | Default fee for the service from a date. |
| GET | `/v1/practitioners/:id/profile` | Profile, all affiliations (with end dates), calendar, staff contact. |
| PUT | `/v1/practitioners/:id/profile` | Upserts the profile. |
| POST | `/v1/practitioners/:id/affiliations`, POST `/v1/practitioner-affiliations/:id/end` | Ending refuses while future booked visits remain at that clinic (409 `future_appointments`), so the doctor's patients are moved first. |
| PUT | `/v1/practitioners/:id/fees` | Doctor-specific fee for a service and visit mode from a date; `feeMinor: null` returns to the service fee. |
| PATCH | `/v1/staff/:id` | Display name, phone. |
| PATCH | `/v1/patients/:id` | Demographics, primary phone/email, home address; optimistic `version`. Merged patients refused. Audit records changed field names, never values. |
| POST | `/v1/roles/:id/retire` | Custom roles with no active grants only. |

Weekly plans (`PUT /v1/practitioners/:id/weekly-plan`) also accept `healthcareServiceId` and `consultLocationId`. Without them, new hours keep the replaced hours' service; with none to copy, the doctor's department service for that visit mode is used when there is exactly one (R2).

## Pricing model

Active price lists are frozen by `catalog.price_list_item_guard`, so every booking keeps pointing at the exact price it used. A fee change therefore publishes a new version of the tenant's default cash list: the active list is locked, copied (every item, every date range) into version n+1, the changed item's open range is closed at `effectiveFrom` and the new price starts there; the old version is retired and the new one activated, in one transaction. Fee snapshots on existing appointments are untouched. A tenant with no default list gets "Standard cash rates" v1. `effectiveFrom` can't be in the past.

## Schema (migration `m01_facility_info`, ERD m01 updated)

`platform.facility` gains `directions_url` (https only, CHECK) and `arrival_instructions` (≤ 1,000 characters). No other table changes.

## Frontend

| Screen | Change |
|---|---|
| Hospital catalogue | Clinic details editor (address, phone, email, directions, arrival instructions, status), Add clinic; departments, services (with default fee) and consult rooms tables with add/edit and active switches. Read-only for people without the permission. |
| Doctors | Profile editor saves (specialty, qualifications, languages, experience, bio, virtual, name, phone); clinics tab adds/ends affiliations; fees tab sets per-service fees from a date; "Set up calendar" for doctors without one; inactive-in-booking shows as ended affiliation. "Add doctor" links to Settings → Add staff, then affiliation. |
| Patients | Edit details sheet (with version check). |
| Appointments | Doctor defaults once the list loads (R3); "Caller isn't registered yet" books with a booking party (R4); doctors without hours explain why there are no slots. |
| Schedules | Weekly editor sends the service when the clinic has one for that mode. |
| Settings | Retire a custom role. |
| Removed | `hms/Clinic.tsx` (unused, superseded by Doctors and Schedules). |

## Tests

- HTTP tests per endpoint: permission at the right clinic (branch admin can't edit another branch), validation, stale version, guards (`in_use`, `future_appointments`, last clinic), audit row written.
- Pricing: a fee change is a new list version; the booked `fee_snapshot_minor` of an earlier booking is unchanged; a booking after `effectiveFrom` gets the new fee; the quote equals what booking charges.
- `flows.test.ts`: the user flows in `docs/plan/STAFF_USER_FLOWS.md`, each as one end-to-end HTTP test.
- `coverage.test.ts`: every `/v1` path the staff frontend calls exists as a backend route (for some method), so a renamed or missing route fails CI instead of failing in the browser.
- Frontend unit tests for the new pure helpers (form → body builders, version conflict handling).

## Out of scope

WhatsApp, voice and growth modules (G19–G23) need their own providers and PRDs. Prescriptions, labs, billing, inpatient (G28–G33). Patient merge, flags and identifiers beyond phone/email/address. Staff registration (council numbers) editing. Invite expiry and invite email delivery.

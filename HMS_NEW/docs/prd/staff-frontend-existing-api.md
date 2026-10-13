# PRD: connect the staff frontend to every safe existing backend route

Approved in chat on 11 October 2026. This PRD covers frontend work only; the backend is unchanged.

## Problem
Several existing `/v1` routes had no staff UI: allergy and problem upkeep, vital correction, note templates, note entered-in-error, emergency (break-glass) access and starting service on a queue token. Clinicians had to work around these gaps.

## Goal
Every existing route that is safe to call is connected before any backend work starts. Unsafe or incomplete routes are listed with the reason ([contract decisions](../plan/FRONTEND_BACKEND_CONTRACT_DECISIONS.md)).

## Scope
In scope:
- Allergies: add them, and mark them inactive, refuted or entered in error.
- Problems: mark them resolved, in remission, refuted or entered in error.
- Vitals: correct a value, or mark it entered in error with a reason.
- Notes: use the consultation templates (structured fields) and edit them. The author can mark a note entered in error.
- Break-glass: emergency chart access, offered when care access is missing. It requires a reason of 10 or more characters and lasts 1 to 24 hours.
- Queue: "Start serving" moves a called token to in-service.
- Doctor fee: shown read-only.

Out of scope (wait for backend, ledger G01, G15, G34–G40):
- schedule writes
- encounter cancel
- queue complete
- nurse self-join
- staff verbal consent
- overbooking
- clinic-only blocks
- fee editing

## User flows
1. A doctor opens a consultation, records a vital and corrects it. The old value shows "Amended" and the new one shows "Final".
2. A doctor adds an allergy from the consultation or patient chart, then changes its status after a confirmation prompt.
3. A doctor picks the "OPD consultation (SOAP)" format, fills in the fields and saves a draft. The draft can later be marked entered in error with a reason; the note stays visible, struck through.
4. A nurse with no care relationship opens a chart. They see the emergency access form, give a reason and get time-limited access, which the backend audits.
5. Front desk or a nurse calls the next patient, then clicks "Start serving".

## Acceptance criteria
- Each flow above round-trips against the API and worker on synthetic data. Verified 11 October in the local preview.
- Permission gates follow the facility-scoped `can()`; the server stays authoritative.
- Unknown outcomes block retries until the record is refreshed (existing `useCommand`).
- Typecheck, lint (no new warnings in `src/hms`) and frontend tests pass.

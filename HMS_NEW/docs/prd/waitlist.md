# PRD: Staff waitlist (G11)

Status: approved in chat on 11 October 2026 (15-minute hold; the WhatsApp bot may also add requests). Ledger: G11 (UI-waitlist-01/02). Schema: `booking.waitlist_entry` and `booking.waitlist_offer` already exist (m04); no migration planned.

## Problem

When a doctor is fully booked, reception has nowhere to record "call me if something opens up". The original Waitlist page is in the menu but shows Pending. In the original app, patients joined from the booking page and accepted offers there. HMS_NEW has neither the public booking page (G33) nor patient messaging (G19), so that flow can't work as it was.

## Goal

Reception keeps a waitlist per clinic and fills a freed slot by phoning the patient. The original Waitlist design is used, with "Prepare slot offer" restored. No message is sent automatically.

## Scope

In:
- **List:** waiting and offered requests for the selected clinic, with filters (status, doctor) and the requested date range.
- **Add:** caller name and phone, optional registered patient, doctor, date range (up to 60 days) and a short note (500 characters). Front desk adds requests from the Waitlist page; the WhatsApp bot (booking agent) can add them through the same API.
- **Prepare slot offer** (original dialog): pick a date in the range and a free slot. Saving holds that real slot for **15 minutes**, linked to the offer.
- **Record the answer after calling:**
  - Accepted: books the held slot as an appointment for that caller (`originChannel: front_desk`), and the request closes as accepted.
  - Declined: releases the hold, and the request goes back to waiting.
  - No answer: the offer expires with its hold, and the request goes back to waiting.
- **Withdraw** a request, with a reason.

Out:
- Patient self-service join or accept (needs G33).
- Automatic WhatsApp or SMS offers (needs G19).
- Waitlisting by service instead of doctor.
- Auto-matching cancellations to waiters.

## User flows

1. A caller wants Dr Asha this week, but she's full. Reception adds them to the waitlist for 12–16 Oct.
2. A 10:30 slot is cancelled. Reception opens Waitlist, picks the request and uses **Prepare slot offer** to hold 10:30, then phones the caller.
3. The caller says yes. Reception clicks **Accepted**: the appointment is booked and appears on Schedules and Appointments.
4. The caller says no, or doesn't answer within 15 minutes. The slot frees and the request is waiting again.

## API (all `/v1`, all through `runCommand`, creating commands take `Idempotency-Key`)

| Route | Permission (at the request's clinic) |
|---|---|
| `GET /v1/waitlist?facilityId&status&staffId` | `appointments.read` |
| `POST /v1/waitlist` | `appointments.book` |
| `POST /v1/waitlist/:id/offer` `{slotStart}` | `appointments.book`; the slot must be at the request's clinic and for its doctor |
| `POST /v1/waitlist-offers/:id/accept` | `appointments.book` |
| `POST /v1/waitlist-offers/:id/decline` | `appointments.book` |
| `POST /v1/waitlist/:id/withdraw` `{reason}` | `appointments.cancel` |

No new permissions. Staff-created requests always carry `facility_id` (the column is nullable for future patient joins).

## Rules

- One pending offer per request. Offering locks the request row, so two staff can't offer at once.
- An offer reuses the booking hold (`holdSlot`, owner type `waitlist_offer`), so it can't double-book. The clinic check from f80e6fc applies.
- Expiry is applied when anyone reads or acts on the request, and the hold's own expiry frees the slot. No worker change is needed.
- The caller is a booking party, never shown as the patient (existing rule).

## Acceptance criteria

- Front desk adds, offers, accepts, declines and withdraws in the browser. Each round-trips to the database.
- Accepting creates exactly one appointment, also on retry.
- A Branch 1 user can't read or act on Branch 2 requests (403).
- A nurse can't add or offer.
- Two concurrent offers on one request: only one succeeds.
- An offer for a slot at another clinic or another doctor is rejected.
- An expired offer can't be accepted.
- Backend suite, root typecheck and frontend checks pass. Security review recorded here before commit.

## Security review (before commit)

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Every action on an existing request reads its clinic first and authorizes there (`authorizeEvery` with that clinic). A request with no clinic needs an every-clinic grant; an unknown id is 404. | Info | Tested; a mutation to plain `authorize` fails the cross-clinic test |
| 2 | The list authorizes `appointments.read` at the requested clinic and filters by it. | Info | Tested; a mutation dropping the clinic fails |
| 3 | Offering locks the request row (`FOR UPDATE`) and needs status waiting, so two staff offering at once get one 201 and one 409. | Info | Tested concurrently |
| 4 | The offer's hold is placed through the same `placeHold` as `/v1/holds`, so the clinic check from f80e6fc, the slot-exists check and the reservation EXCLUDE constraint all apply. A Branch 2 slot for a Branch 1 request is rejected. | Info | Tested |
| 5 | The plain hold-release route now only releases holds with no owner, so an offer's hold can't be dropped behind the request's back. | Info | Tested (404) |
| 6 | Accept takes an Idempotency-Key and re-checks that the offer is the live pending one under the row lock; a retry returns the same appointment and a late accept is `offer_expired`. | Info | Tested |
| 7 | The caller is stored as a booking party and shown as "Booked by", never as the patient. Notes are free text capped at 500 characters and rendered as text (React escapes it). | Info | No change needed |
| 8 | The frontend adapter only forwards ids that match a UUID pattern into `/v1` paths, and `request()` refuses any non-`/v1` path. Buttons are hidden without `appointments.book` / `appointments.cancel`; the server enforces the same. | Info | Verified in the browser (nurse sees a read-only list) |
| 9 | Withdraw and decline take no Idempotency-Key: they set a final state, so a retry gets a clean 409/precondition error instead of a second effect. | Info | No change needed |

# Booking price choice — design preview

Status: design only. No payment gateway, UPI request, payment link, charge, or booking mutation is added by this document or its [interactive preview](./payment-choice-preview.html). The existing WhatsApp bot continues to use its current booking flow.

## Placement in the conversation

After doctor, branch, slot, and patient name are selected, show the price choice. Keep the existing separate reminder-consent choice after payment method selection. The booking summary and **My visits** should eventually display the chosen amount and whether it is paid or due at clinic.

| Example option | Patient-facing copy | Future booking rule |
| --- | --- | --- |
| Pay online | **₹800 now · save ₹200** against a ₹1,000 consultation | Reserve the slot as `pending_payment`; confirm the discounted booking only after verified payment capture. |
| Pay at clinic | **₹1,000 at the clinic** | Confirm the booking with ₹1,000 due at reception. |

The ₹800/₹1,000 figures are example pricing supplied for this design. The current backend's illustrative doctors have different `consultation_fee` values (₹750–₹1,200), so neither amount may be inferred from the existing field. Before implementation, the clinic must choose between a uniform ₹1,000 fee with ₹200 prepayment discount and a per-doctor base fee with ₹200 discount. The backend must calculate and lock the final quote; WhatsApp button text is never the price authority.

## Proposed WhatsApp copy

1. **Choice:** “How would you like to pay for this visit? Pay online ₹800 and save ₹200, or pay ₹1,000 at the clinic. You will review your choice before confirming.” Buttons: `Pay online ₹800`, `At clinic ₹1,000`, `Back`.
2. **Online preview:** “Online price: ₹800. Savings: ₹200. In the live service, we would send a secure UPI payment request after you review the appointment. This preview cannot collect money or confirm the discounted booking.” Buttons: `Change choice`, `Main menu`.
3. **Clinic preview:** “Amount due at clinic: ₹1,000. In the live service, we would show the final appointment details and ask you to confirm. This preview does not create a booking.” Buttons: `Change choice`, `Main menu`.
4. **Live payment pending, later:** “Your slot is reserved until [time]. Complete the ₹800 payment to confirm it. If payment does not complete, the reservation expires. We will not ask for a UPI PIN in chat.”
5. **Live payment confirmed, later:** “Payment received: ₹800. Appointment confirmed. Reference [code].” If payment fails or the hold expires, state that the appointment is not confirmed and offer fresh slots.

The design avoids “₹200 more” as the primary label. Both total prices are shown first; the ₹200 saving is secondary. The offer terms, tax treatment, cancellation/refund rules, and whether it applies to every clinician must be approved before the copy is used with patients.

## Contract to add when payments are authorized

- A server-owned quote for doctor, branch, consultation type, and slot: `base_amount_paise`, `discount_amount_paise`, `amount_due_paise`, `currency=INR`, `expires_at`, and `pricing_policy_id`. Price snapshots must remain attached to the appointment even if fees change later.
- `payment_choice=online|clinic`, with states such as `pending_payment`, `paid`, `due_at_clinic`, `failed`, `expired`, and `refunded`. Booking status and payment status are distinct.
- A gateway order/reference tied to one quote, patient sender, and hold. Idempotency prevents repeat WhatsApp messages or gateway webhooks from creating another order or booking.
- A signed gateway webhook plus server-side payment lookup verifies capture and exact amount before confirming an online booking. A screenshot or patient reply is not proof of payment.
- A time-limited reservation while payment is pending. A late success after expiry requires reconciliation and a refund or a fresh slot; it must not silently overbook.
- Cancellation and reschedule rules specify whether a payment moves with the appointment, is refunded, or needs staff handling. **My visits** shows the final price and payment state.

## Delivery sequence

1. Review this copy and decide whether the price is uniform or per doctor. Keep it as a design preview until clinic prices and terms are approved.
2. Add quote and payment-choice persistence to the backend and show the choices in the bot without collecting money. Test both branches on the two test phones with explicit preview wording.
3. Add a payment gateway in its test environment, verify webhooks and reconciliation, then validate the Meta account's payment configuration. Only after that, enable a live UPI payment request. The WhatsApp Flow form is optional; two reply buttons are sufficient for this choice.

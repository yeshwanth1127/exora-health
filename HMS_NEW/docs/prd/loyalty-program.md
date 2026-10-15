# PRD: Loyalty programs

Status: direction approved 15 October 2026 ("no billing, various program types inspired by what already works, frontend for all of it") · UI first, backend later

## Problem

Clinics want patients to come back to them, not to the hospital down the road. Many already try:
- paper "family health cards";
- "every 5th follow-up free" cards;
- "bring a friend" offers.

None of it is tracked. Reception keeps a register, patients lose the card, and nobody knows who is due back.

What Exora has today:
- A static concept page (`feature-concepts.tsx`, "Avocado Care") that doesn't save anything.
- A placeholder in the live sidebar.
- `STAFF_MODULE_DEVELOPMENT_DECISIONS.md` kept loyalty as a labelled concept. This PRD reverses that for the UI.

## Goal

A clinic picks one or more proven loyalty formats and runs them from Exora on its own:
- **Admins:** set up a program in about 2 minutes, with a live preview of what patients see.
- **Reception:** enrols a patient in under 30 seconds. At the desk, sees what the patient has earned and records a visit, a stamp, a reward or a perk in one tap.
- **Patients:** get their card on WhatsApp and always know where they stand.

**Exora never handles money.** Fees, discounts and bills stay with the clinic's own billing. Exora records what was earned and used.

## Program types

The clinic can run any mix of these, one of each type:

| Type | How it works | Inspired by |
| --- | --- | --- |
| **Health membership** | Patient joins for a yearly fee, which the clinic collects itself. They get perks for themselves and their family, such as "10% off lab tests" or "3 free follow-ups a year". | Apollo 24\|7 Circle, Practo Plus, the family health cards clinics already sell |
| **Points** | Patients earn points for visits, health check-ups, referrals and Google reviews, then spend them on rewards such as a free BP and sugar check. | Apollo HealthCredits, Starbucks Rewards |
| **Visit stamps** | Every visit adds a stamp, and the Nth visit earns a reward. | Café punch cards; the "5th visit free" cards dental and physio clinics hand out |
| **Referrals** | A patient refers a friend. When the friend's first visit is done, both get a reward. | Uber and Airbnb invite credits, "bring a friend" clinic offers |
| **Status tiers** | Visits in the last 12 months set the tier (Silver → Gold → Platinum), and each tier has perks. | Airline status, Marriott Bonvoy |
| **Wellness goals** | Patients are rewarded for looking after their health: yearly check-up, flu shot, diabetes review every 3 months. | Discovery Vitality and the wellness rewards Indian health insurers now give |

## Scope

### In
- **Programs tab:**
  - a gallery of the 6 types, each with an "inspired by" line and a one-line pitch;
  - your programs, with status and a summary;
  - numbers: members, member visits and rewards given in the last 30 days.
- **Program editor:**
  - name and colour;
  - settings specific to the type;
  - a live preview of the patient card;
  - Save as draft or Go live; Pause and Resume.
  - Paused means no new members, while existing members keep what they've earned.
- **Members tab:**
  - search by name, phone or member ID, and filter by program;
  - each member's standing in every program: valid until, points, stamps, tier, goals;
  - **Enrol** a patient: name, Indian mobile number, programs, and family members for a membership.
- **Member panel:**
  - **Record a visit**: one tap adds points, a stamp and the visit toward their tier;
  - the actions for each program type: use a perk, redeem a reward, give the stamp reward, add a referral and mark it complete, mark a goal done, renew or cancel a membership;
  - full history, and undo for anything recorded the same day.
- **Patient view tab:** what a chosen member sees on WhatsApp, with the card for every program they're in.
- **Build pattern:** UI-first, the same as Website analytics:
  - state is kept per clinic in this browser;
  - sample programs and members exist only in local development;
  - production shows "Opens with the next update" with actions disabled.
- **Permissions:**
  - `growth.manage` edits programs;
  - `appointments.check_in` (reception) enrols members and records activity;
  - anyone with `appointments.read` can view.
- **One model test:**
  - perk limits;
  - points balance and redeem limits;
  - stamp reset;
  - tier thresholds;
  - membership status and renewal dates.

### Out
- Payments, invoices, discounts applied to bills, GST.
- Points that expire.
- Programs shared across a chain.
- Patient login or app.
- Backend, and visits recorded automatically from completed appointments (backend phase).
- Real WhatsApp sends (backend phase).

## User flows

1. **Admin starts a program:**
   - Loyalty program → pick a type from the gallery;
   - the editor opens with sensible defaults, next to the card preview;
   - adjust the settings → Go live.
2. **Reception enrols:**
   - Members → Enrol patient;
   - enter name and phone, and tick the programs;
   - for a membership, add family members;
   - Enrol. The member panel opens.
3. **At the desk:**
   - search the member → Record a visit;
   - points, stamps and tier update together;
   - if a stamp card is full, **Give reward**;
   - for a membership, **Use** a perk; a perk with a yearly limit shows how many are left.
4. **Referral:**
   - Add referral with the friend's name;
   - when the friend has visited, Mark visited, and both rewards show.
5. **Patient:** Patient view shows the WhatsApp card exactly as the patient will see it.

## Acceptance criteria

1. **Empty state.** A new clinic sees a gallery of all 6 types and nothing pre-filled. In production, buttons are disabled with "Opens with the next update".
2. **Going live.** A program can't go live without a name and its required settings. Problems are listed in plain words, for example "Add at least one reward" or "Each tier needs more visits than the one before".
3. **Enrol.** Rejects a phone number that isn't a valid Indian mobile, and a phone already enrolled (with a link to open that member). Family members are capped at the membership's limit.
4. **Perk limits.** A perk with a yearly limit can't go below zero, and the button says why.
5. **Redeeming points.** Can't redeem more points than the balance.
6. **Stamps.** The reward is only available once the card is full, and giving it starts a fresh card.
7. **Tiers.** The tier comes from visits in the last 12 months, and the panel shows how many visits to the next tier.
8. **Membership status.** Expiring soon means within 30 days, expired means past the end date. Renewing extends from the end date, or from today if already expired.
9. **Pausing.** A paused program can't take new members, and existing members keep their standing.
10. **Layout and tests.** Works at phone width. The model test covers criteria 4–8.

## Open questions

1. Show a "Member" badge on Appointments at check-in? (Backend phase.)
2. Should a Google review earn points automatically once the Google Business backend can see reviews?

## Sources

- Original concept: `apps/staff-web/src/modules/feature-concepts.tsx` (`LoyaltyProgram`).
- Earlier decision being reversed: `docs/plan/STAFF_MODULE_DEVELOPMENT_DECISIONS.md` (Loyalty row).

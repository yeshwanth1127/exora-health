# Voice agent, Apple Messages and empty-state onboarding

Status: **approved and built** (26 Oct 2026). Branch `codex/admin-dashboard-arc`.
The user asked for empty-state copy to stay small and minimal: one short sentence each.
Apple Messages opens on Conversations (like Voice opens on Call history); its empty state links to Setup.

## Problem

- **Voice (Sarvam).** Call setup shows four technical readiness cards (tenant
  connection, public HTTPS, Sarvam agent, website calling), a "Create voice agent"
  card, the phone-number setup form and two test cards, all at once. A clinic admin
  can't tell what to do first, what Exora does, or what "done" looks like. Call
  history is blank until calls arrive, with no explanation.
- **Apple Messages.** It is a preview: an inbox page with a status line, a list of
  "Conversation N" buttons and no setup editor. The setup-request API exists
  (`/v1/channel-onboarding/apple_messages`) but nothing in the dashboard uses it.
  Apple's channel policy (v3.1, 21 Jul 2026) says it is not onboarding businesses
  that primarily offer medical services, and the page doesn't say so.
- **Every other empty state.** `WorkspaceEmpty` renders the Arc EmptyState with an
  empty description, so 14 lists say only "No X" with no next step.

## Goal

One obvious next step on every channel page and every empty list. Truthful status
only: nothing reads "connected" or "live" without the server saying so.

## Scope

**In**

1. Voice › Call setup becomes one guided flow, using the WhatsApp page's pattern
   (Arc Stepper plus numbered step cards; components already adopted).
2. Voice › Call history gets an empty state that points to Call setup.
3. Apple Messages becomes a final two-tab page, Setup and Conversations, with a
   setup-request editor, a guided flow, a visible eligibility notice and an inbox
   empty state.
4. `WorkspaceEmpty` gets real descriptions and next-step actions at all 14 call
   sites.

**Out**

- Any provider provisioning, Sarvam or AWS calls, or Apple submission.
- New backend endpoints. Existing APIs only.
- New Arc components. Only already-adopted Stepper, EmptyState, Badge and Button.
- Phone layout, spoken-agent settings fields (kept as they are), WhatsApp flow.

## Prerequisite: merge

The dashboard branch lacks `origin/main`'s voice-agent work (`dabc6d5`, `b969ebc`).
Apple Messages lives only on `codex/apple-messages-foundation`, which is based on
main `2c773da`. Both merge cleanly except root `AGENTS.md`; both sides' sections are
kept. The Apple migrations then get applied to the shared dev DB.

## User flows

### Voice › Call setup (clinic admin)

Stepper: **Booking data → Phone line → Request agent → Exora builds → Live.**
Each step card shows a one-line "what this is", who does it (You / Exora) and its
real state from existing reads. Finished steps collapse to a summary. Future steps
are locked with a reason.

1. **Booking data.** "The agent books from your doctors and schedules." Shows N
   branches and N doctors from `/public/v1/bootstrap`. If there are none, it says
   so and links to Doctors. Done when there is at least one doctor.
2. **Phone line.** The existing voice ChannelOnboarding form (number plan,
   existing number, receptionist phone, overflow, languages, greeting), saved as a
   draft. Done when the draft is saved or requested.
3. **Request agent.** The existing "Create voice agent" action, with three cases:
   - plan not entitled: "Not in your plan, contact Exora";
   - no `voice.manage`: "Ask your administrator";
   - a declined request: shows the reason and a resubmit action.
4. **Exora builds.** A waiting state: "Requested by X on D" or "Being set up".
   The page already polls every 15 s. Copy says what happens next and that the page
   updates by itself.
5. **Live.** Shows the assigned number (existing card), a Test voice call button
   and the 4-step safe test. The Spoken agent settings move here unchanged.

The technical checks (tenant connection, HTTPS) become one compact "Technical
checks" row under the stepper, with the same truthful text. "Check status" stays.

### Voice › Call history

With no calls and the agent not live: "No calls yet. Calls appear here once your
voice agent is live." The action is **Finish call setup**, which switches tabs.
With no calls and the agent live: "No calls yet. Place a test call from the
booking website."

### Apple Messages (clinic admin and reception)

Tabs: **Setup** (default until conversations exist) and **Conversations**.

**Setup.** Stepper: **Clinic details → Support hours → Submit → Exora review → Live.**

- An **eligibility notice** is always visible until a connection is configured.
  It reads: "Apple currently doesn't onboard businesses whose main service is
  medical. Exora checks eligibility with Apple before anything goes live.
  Submitting doesn't connect Apple Messages."
- **Clinic details**: brand name, HTTPS website, business phone, support email,
  languages (English/Spanish) and greeting.
- **Support hours**: time zone, weekday hours (one interval per day), after-hours
  message and human handoff (on request).
- **Submit**: shows the declaration checkbox, then `submit`. The state becomes
  "Setup requested".
- **Exora review**: waiting copy. It never claims approval, because the response
  always has `live:false`.
- **Live**: reached only when the inbox reports `configured` and is not a local
  demo.
- Saves use the existing version, idempotency, permission (`comms.manage`) and
  unsaved-changes guard.

**Conversations.** The existing Arc SupportConversation inbox. The empty state
says: "No Apple conversations yet. They appear here once Apple Messages is live
for your clinic." The action is **Open setup**. The local-demo banner stays.

### Dashboard-wide empty states

Each `WorkspaceEmpty` gets a description of one sentence saying why the list is
empty and what fills it, plus an action where one exists. The action opens the
relevant create/setup page, or clears filters when the list is filtered to nothing.

| Call site | Copy | Action |
| --- | --- | --- |
| Patients | No patients yet. Patients appear when a booking is made or you add one. | New booking |
| Appointments | No appointments for this day. | New booking / clear filters |
| Queue | Nobody is waiting. Checked-in patients appear here. | Appointments |
| Doctors | No doctors yet. Add a doctor to open booking slots. | Add doctor |
| Catalogue (×2) | No services or prices yet. | Add item |
| Consultations, Teleconsultations | No consultations for this view. | Clear filters |
| Booking (no slots) | No open times for this doctor. Check their schedule. | Doctors |
| Growth charts | No data for this period yet. | — |
| Settings | Copy specific to the call site. | — |

Final copy is written per call site from what each query actually filters by.

## Acceptance criteria

1. Voice Call setup shows the Stepper, and the current step matches the server
   state in each case:
   - no doctors;
   - no draft;
   - not entitled;
   - pending;
   - in setup;
   - declined;
   - active.

   Exactly one primary action is visible per state.
2. No Voice or Apple copy claims connected, approved or live unless the
   corresponding read says so.
3. Apple setup round-trips the draft:
   - save, reload and see it persist;
   - a version conflict shows the existing conflict message;
   - submit shows "Setup requested";
   - users without `comms.manage` see read-only fields with an explanation.
4. The Apple eligibility notice is visible on Setup in every state before "Live".
5. Both empty Call history and empty Apple Conversations show an action that
   reaches setup.
6. Every `WorkspaceEmpty` call site has a non-empty description. The ones with
   actions navigate correctly.
7. Arc parity for the Stepper and EmptyState: same component, unchanged visual and
   motion contract, checked at 1440×900 light.
8. Staff and API test suites, the root and staff typechecks, and the staff build
   all pass. New tests cover the voice step derivation and the Apple step
   derivation as pure functions.

## Known limits

Real Sarvam activation, Apple approval, AWS deployment and a physical iPhone test
stay outside this work. The UI shows them as Exora steps and never as completed.

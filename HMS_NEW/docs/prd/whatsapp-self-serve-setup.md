# PRD: WhatsApp self-serve booking setup

Status: approved direction 2026-10-13 · phase 2 (full lifecycle) added 2026-10-14 · UI first, backend next

## Problem

Opening **WhatsApp** in the staff workspace shows a port of the old module: three buttons, seven tabs and a "delivery isn't connected" notice. There's no path a clinic can follow to switch WhatsApp booking on by itself. Connection is engineer-only (env vars / `WA_CLINIC_BINDINGS_JSON`), and no template is live at Meta.

## Goal

A clinic admin opens WhatsApp and is walked, one step at a time, to "patients can book on our WhatsApp number". There are no engineers and no env edits. Reminders and promotions come after booking is live.

## Decisions

- **Number:** default to **coexistence**, which keeps the WhatsApp Business app on the clinic's existing number. This requires Meta Embedded Signup, so Paperwhale must be a Meta Tech Provider. A new number is the fallback path.
- **Booking flow from a clinic-shape template**, then fully editable:

  | Template | Steps |
  | --- | --- |
  | Single doctor | Welcome → time → patient name → confirmation |
  | Small clinic | Welcome → doctor → time → name → confirmation |
  | Multi-speciality | Welcome → speciality → doctor → time → name → confirmation |

  Each step's text is editable, optional steps can be turned off, and any step can carry a header image or PDF.
- **Booking needs no Meta template.** The patient messages first, which opens the 24-hour service window. Templates arrive with reminders/promotions.
- **Prerequisite:** doctors, fees and hours are set up first. Otherwise the page shows a "Register your doctors first" empty state with links.

## Scope

**In:** register-first gate · 4-step setup (connect → booking flow → doctor & department content → test & go live) · live home with pause switch and entry points for reminders/promotions · doctor photo, doctor PDF, department PDF and per-step header uploads.

**In (phase 2, after go-live):** the whole appointment lifecycle on WhatsApp, a staff inbox, a live message log, promotions and settings. Details below.

**Out:** multi-language flows, Meta billing display, chatbot free-text understanding.

## Flow

```
WhatsApp
├─ doctors/fees/hours missing → "Register your doctors first" (links: Doctors, Catalogue, Schedules)
└─ setup (one active step, others collapsed with ✓ summaries)
   1 Connect number    coexistence checklist → Continue with Facebook (Embedded Signup) → ✓ +91… · Name
                       or "Use a new number instead"
   2 Booking flow      pick template (single / small / multi) → edit steps, headers · live phone preview
   3 Content           per doctor: photo + profile PDF · per department: PDF (multi only) · optional
   4 Test & go live    wa.me link → send "hi" from another phone → confirm → Accept bookings switch
   → Home: status, pause, edit flow/content, Next: Reminders · Promotions
```

## Acceptance criteria

1. With no doctors, no fees or no upcoming hours, only the register-first state shows, linking to each missing area.
2. On first open, step 1 is active and later steps are locked. A finished step collapses to a one-line summary and can be reopened.
3. Coexistence shows the eligibility list (Business app, 7+ days active, latest app, phone in hand for the QR, Meta Business admin) and what changes after connecting.
4. Choosing a template fills the steps using real doctor and department names. Edits show in the phone preview immediately.
5. Uploads accept JPG/PNG up to 5 MB and PDF up to 10 MB, show the file name, and can be replaced or removed.
6. Go live requires a connected number, a flow and a confirmed test. Pausing is one switch.
7. Staff without `comms.manage` see progress read-only.

## Backend phase (next)

- Embedded Signup code exchange, then `comms.channel_account` (WABA id, phone number id, token in a secret store) and webhook subscription.
- Persist the flow config per facility. The bot reads it instead of the hard-coded menu.
- Doctor PDF asset kind, step header assets, and a live/paused flag.

## Phase 2: running WhatsApp after go-live

Paperwhale is applying to become a Meta Tech Provider, so **Connect** uses Embedded Signup. The coexistence feature type is `whatsapp_business_app_onboarding`. Until the partner app is approved, the dialog simulates the result in dev builds only.

Once live, the page has six tabs: **Overview · Inbox · Automations · Promotions · Message log · Settings**. Each tab is deep-linkable as `whatsapp?tab=<id>`.

| Tab | What staff do |
| --- | --- |
| Overview | Live/paused switch, today's numbers (bookings, sent, delivered, needs reply), and items needing attention (open chats, failed sends, templates in review or rejected). Shows the lifecycle with each message on or off. |
| Inbox | Chats the bot handed over: the patient asked for staff, the bot got stuck, or a complaint. Staff see the full bot history and patient context, assign to themselves, reply, hand back to the bot and resolve. Once 24 h have passed since the patient's last message, only an approved template can be sent. |
| Automations | Lifecycle messages: confirmation, reminder (day before), reminder (same day), rescheduled, cancelled, missed-visit recall, post-visit feedback, follow-up due. Each has on/off, timing, editable text with variables, quick-reply buttons and its Meta template status. Editing approved text needs Meta review again. Quiet hours hold automated sends overnight. |
| Promotions | Marketing campaigns to opted-in patients: template, audience (everyone opted in / a speciality / not seen in N months), header image, schedule, preview, then delivery stats. Meta must approve each promotion first, so there is no test send before approval. STOP opts the patient out. |
| Message log | Every message in and out, live: type, template, category (service/utility/marketing), status (queued → sent → delivered → read, or failed with Meta's error code), retry for failed, and a detail drawer. |
| Settings | Number and Meta account health (display name, quality, messaging limit), reception hours and auto-reply, quiet hours, booking flow, doctor files. |

### Phase 2 acceptance criteria

1. An automation can't send until its template is Meta-approved. Turning it on before approval shows "Waiting for Meta approval".
2. Template text follows Meta's rules, checked before submitting: ≤1024 characters, no variable at the very start or end, no two variables side by side, known variables only, ≤3 buttons of ≤25 characters.
3. The inbox reply box is disabled once 24 h have passed since the patient's last message. The UI then offers to send an approved template instead.
4. Every send shows in the message log within a second and updates through to delivered/read or failed.
5. A failed message shows Meta's reason in plain words and offers Retry when that makes sense (not when the number isn't on WhatsApp).
6. Without `comms.manage`, automations, promotions and settings are read-only. Replying needs `comms.reply`.

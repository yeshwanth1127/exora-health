# First-run onboarding

Status: **approved** (26 Oct 2026) with the decisions below. Branch `codex/admin-dashboard-arc`.

## Problem

A new clinic admin opens the dashboard and sees a lot that doesn't help yet:

- **Empty tiles.** Six "Clinic activity" tiles all read 0 (New bookings, Visits due, Check-ins, Completed visits, Cancellations, No-shows).
- **Empty charts.** The charts and the Recent appointments table say "No appointments yet".
- **A buried guide.** The Booking setup guide sits below the tiles. It reads like an audit log, for example "Account access and professional registration are separate checks".
- **No order.** All 14 sidebar pages are open from the first minute, so nothing says what to do first.

## Goal

The first view does one job: get the clinic ready for bookings.

- One step at a time.
- One obvious button per step.
- Colour tells the admin where they are.
- Reports appear only once there is something to report.

## Scope

**In**

1. **Overview has three states**, all derived from existing server reads (no new endpoints):
   - **Setting up:** booking setup is not complete. Overview shows only the setup guide.
   - **Ready, no activity:** setup is complete but there has never been an appointment. Overview shows "Get your first patients".
   - **Running:** at least one appointment exists. Overview is today's page, with setup reachable from "Review setup".
2. **Welcome dialog.** It is shown once per staff member, on first sign-in.
3. **Guided steps with coach marks.** "Continue" on a step opens the right page. A small anchored bubble then points at the exact control to use, like the HubSpot example.
4. **Colour-coded hierarchy.** A small set of state colours and phase colours is used the same way on the Overview, the sidebar and the coach marks.
5. **Sidebar focus while setting up.** Pages that can't work yet are hidden until setup is done (see "Open questions").
6. **Plain copy.** Setup steps are rewritten in short sentences with no backend detail.

**Out**

- New backend endpoints or a server-side "tour seen" store. "Seen" is kept in the browser and is safe to lose.
- Phone layout.
- Changes to the channel guides (WhatsApp, Voice, Apple and Google). Those already follow the step pattern.
- Analytics, domain and Umami work (separate plans).

## User flows

### 1. First sign-in (admin, setup incomplete)

**Welcome dialog** (Arc Dialog). It has three short slides, dots, **Skip** and **Next →**:

1. "Welcome to Paperwhale". Subtitle: "Let's get {clinic} ready to take bookings."
2. "Five steps, about 10 minutes". Below it, the five step names as a list.
3. "Then reach patients". Body: "Connect WhatsApp, Google and your phone line once you're set up."
   The last button reads "Start setup". It closes the dialog and focuses step 1.

Skip and Close both mark the dialog as seen. "Replay welcome" sits in the user menu.

### 2. Overview: Setting up

The KPI tiles, charts, Recent appointments table and reporting header are removed. What remains, top to bottom:

- **Heading:** "Set up {clinic}". Subtitle: "{n} of 5 done".
- **Progress bar** (Arc Progress) in the setup colour.
- **Step list** (the existing ReleaseReadiness block, or StepList, kept as one numbered column):

| # | Step | Done when (existing read) | Opens |
| --- | --- | --- | --- |
| 1 | Clinic details | address, city, state and timezone saved | Hospital catalogue › clinic |
| 2 | Add a doctor | one active doctor with a calendar | Doctors |
| 3 | Consultation fee | one active consultation with a fee | Hospital catalogue › services |
| 4 | Opening hours | published hours in the next 31 days | Schedules |
| 5 | Try a booking | one open time is returned for the doctor | Book appointment (test) |

- Only the current step is expanded. It has one line of text and one primary button.
- Done steps collapse to a green tick plus a summary, for example "Dr Asha Rao · ₹800".
- Later steps show a grey lock.

- **Right column, "Up next: reach patients".** Locked tiles for WhatsApp, Google, Voice, Apple Messages and Website. Each shows a lock until setup is done.

Non-admins in a clinic that isn't set up see one card instead: "Your clinic is still being set up. Your administrator can finish it from Overview."

### 3. Coach marks while doing a step

**Continue** opens the step's page with `?guide=<step>`. On arrival, an anchored bubble (Arc Popover) points at the control:

> **Step 2 of 5**
> Add the doctor patients can book.
> **Next: click "Add doctor".**

- The bubble follows the action. Once the form is open, it moves to the Save button: "Next: click Save."
- On a successful save (the real server response), a toast reads "Step 2 done". Then "Back to setup" returns to Overview, where step 3 is open.
- Esc or ✕ dismisses the bubble for that step.
- The bubble never claims success on its own. It reacts only to saved data.

### 4. Overview: Ready, no activity

The heading reads "{clinic} is ready for bookings" with a green tick. Below it is the **"Get your first patients"** list:

1. **Book your first appointment.** Opens Book appointment.
2. **Connect WhatsApp.** Opens WhatsApp setup.
3. **Set up Google Business.**
4. **Add the booking link to your website.**

Each item is marked done from the same reads the sidebar already uses (`channel-ready.ts`). The tiles are still hidden at this point, because they would all read 0.

### 5. Overview: Running

This is today's Overview. The booking setup guide moves behind a **Review setup** button in the header. The tiles and charts show once the first appointment exists.

## Colour system (needs your approval: this deviates from the Arc demos)

The Arc demos are mostly neutral. This adds colour only to *state* and *phase*, using tokens that already exist in `foundation.css`.

| Meaning | Token | Used on |
| --- | --- | --- |
| Current step / do this now | `--accent` (blue) | step number, left border, primary button, progress bar, coach-mark heading |
| Done | `--success` (green) | tick, done summary, "ready" heading |
| Waiting on Paperwhale | `--warning` (amber) | "Waiting for approval" badges on the channel guides |
| Locked / later | muted grey | lock icon, later steps, locked channel tiles |
| Problem | `--danger` (red) | failed save or unreadable check |

**Phase colours** are used as icon tint in the sidebar groups and on the Overview section headings:

| Phase | Groups | Tint |
| --- | --- | --- |
| Set up | Workspace (Catalogue, Doctors, Schedules, Settings) | blue |
| Run the clinic | Clinic, Care | green |
| Reach patients | Messages, Growth | violet |

This changes four Arc components beyond data: Sidebar (icon tint), ReleaseReadiness or StepList (state colours), Dialog (welcome slides with dots) and Popover (step header). Everything else stays as in the demo.

## Acceptance criteria

1. **No setup:**
   - a fresh clinic with no doctors shows no KPI tiles, charts or appointment tables on Overview;
   - it shows the welcome dialog once, then setup with step 1 open.
2. **Accurate steps:** each step's done state matches the server read. Saving in the target page and returning to Overview advances the step without a reload.
3. **Coach marks:** a coach mark appears on Doctors, Catalogue and Schedules when opened from a step. It points at the real control, and dismisses with Esc.
4. **Truthful states:**
   - "Ready for bookings" appears only when all five checks pass;
   - the tiles appear only after the first appointment exists.
5. **Non-admin view:** non-admins never see setup controls; they get the one-line card.
6. **Colours:**
   - the colours follow the table above, in light and dark;
   - text keeps 4.5:1 contrast;
   - state is never shown by colour alone (each state also has an icon or text).
7. **Motion and keyboard:**
   - the dialog traps focus;
   - the coach mark is reachable by keyboard;
   - reduced motion is respected.
8. **Checks:** staff tests, typecheck and the build pass. Overview state derivation is a pure function with tests.

## Decisions (26 Oct 2026)

1. **Sidebar while setting up:** every page stays visible. Pages that need setup are greyed out with a lock and "Finish setup first".
2. **Welcome:** brand-blue slides (MicroAcquire style). Approved deviation from the Arc Dialog look.
3. **Coach marks:** dark bubble (HubSpot style). Approved deviation from the Arc Popover look.
4. **Colours:** approved as written, including the phase tints.

## As built (26 Oct 2026)

- **Four setup steps, not five.** "Try a booking" became the first item of "Get your first patients", so being ready for bookings doesn't depend on making one.
- **Each step shows its own saved state.** A later step that is already saved shows as done even if an earlier one isn't. A segmented progress bar replaces the Stepper, since the Stepper can't show steps finished out of order.
- **"Show welcome"** sits in the setup page header rather than the user menu.
- **Coach marks** find the target button by its visible label. They hide while a sheet or dialog is open. Any confirmed save rechecks setup (the `hms-saved` event), so a step ticks off, the "done" bubble appears and the sidebar unlocks without a reload.
- **Not verified in the browser:**
  - the locked-page card;
  - the non-admin "Nothing to report yet" card;
  - the running state after a first appointment;
  - dark mode.

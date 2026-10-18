# PRD: My alerts (per-person alerts tab)

Status: **approved and built** (18 Oct 2026; defaults approved: bell + page, the thresholds below, the `staff_alert_state` table). Section "As built" records where the build differs from the draft. Arc references: free Notification center for the header bell, and Pro Inbox triage for the Alerts page (see `docs/admin-dashboard-arc-sidebar/wave-3-shortlist.md`).

## Problem

Each staff member has to visit several pages to learn what needs them: Queue, Teleconsultations, Waitlist, Consultations, Settings › Team and the Overview setup guide. Nothing says "this is yours, it's due now" or "this is coming up". Things get missed: a patient waiting in the queue, a teleconsult about to start, a held waitlist slot about to expire, an unsigned note, or a registration or invite that is expiring.

## Goal

Give each signed-in person one place, **Alerts**, listing what needs them **now** and what is **coming up**. Every item is derived from data the server already holds and is filtered by that person's permissions and role. Each alert links to the page where the work is done. Alerts never perform the work themselves.

## Scope

In (v1):
- **Header bell**, using Notification center. It shows the count of *Now* alerts for the current clinic. The panel lists them with tone (warning = overdue, info = due soon) and links to the place to act. It keeps the source's All/Unread toggle, Mark all read and Dismiss.
- **Alerts page** in the sidebar (personal, under the user's name), using Inbox triage. The tabs are **Now**, **Coming up** and **Done** (dismissed). Rows show the source, title, detail and due time, and open the linked page. The source's snooze (S) and archive (E) keys map to *Snooze until tomorrow* and *Dismiss*.
- **Alert sources.** All of these are read-only derivations, scoped to the selected clinic, and each needs the permission listed:

| Who sees it | Now | Coming up | Source / permission |
| --- | --- | --- | --- |
| Doctor (own staffId) | Patient checked in or waiting in my queue; teleconsult in *waiting*; encounter in progress not finished | My next appointments today; teleconsults later today | `/v1/queue`, `/v1/teleconsults`, `/v1/encounters`, `/v1/calendar-board?staffId=me` (appointments.read / encounters.read) |
| Doctor | Referral to me in *sent* | — | `/v1/referrals?staffId=me` (encounters.read) |
| Front desk | Waitlist offer hold expiring within 5 min; queue tokens waiting > 15 min | Waitlist offers held; first appointments of the next hour | `/v1/waitlist`, `/v1/queue` (appointments.read) |
| Admin | Booking setup check not confirmed | Staff invites expiring within 3 days; professional registrations expiring within 30 days | `deriveSetup`, `/v1/staff-accounts` invite expiry, `/v1/staff/:id/registrations` validUntil (staff.read) |
| Everyone | — | My own registration expiring within 30 days | `/v1/staff/me/registrations` |

- **Read, dismiss and snooze state** is stored per person on the server, so it follows them across devices. This needs a small table `platform.staff_alert_state(tenant_id, staff_id, alert_key, read_at, dismissed_at, snoozed_until)` and three endpoints: `GET` the state, `PUT /v1/me/alerts/:key`, and `POST /v1/me/alerts/read-all`. The alert key is stable, built from the source and record id plus the event version. A dismissed alert reappears only if its underlying record changes.
- Refresh every 60 s while the tab is visible, plus on window focus. No background push.

Out:
- Push notifications (browser, email, WhatsApp, SMS) and any message to a patient.
- Configurable alert rules or thresholds per user. The thresholds above are fixed constants in v1.
- Cross-clinic aggregation. Alerts follow the selected clinic, like every other page.
- Acting from the alert (e.g. "Call next", "Check in"). The alert only links to the existing guarded command.
- Phone layout (desktop rollout only).

## User flows

1. **Doctor starts the day.** The bell shows "2". The panel lists "Asha Kumar checked in · waiting 6 min" and "Teleconsult 10:30 · patient in waiting room". Clicking one opens Queue or Teleconsultations on that record. Opening the panel does not mark items read; *Mark all read* does.
2. **Front desk, mid-morning.** Alerts › Now shows "Waitlist hold for Ravi expires in 4 min". Pressing E dismisses it once it's handled. If the hold actually expires, the item drops off because its source state changed.
3. **Admin, weekly.** Alerts › Coming up shows "Dr Vikram's KMC registration expires 2 Nov" and "Invite for meena@… expires in 2 days". Each links to Settings › Team with that person selected.
4. **Nothing pending.** Both components show their own demonstrated empty states ("All clear").
5. **A source read fails or isn't permitted.** That source is left out, and a muted line reads "Queue alerts unavailable". The app never claims "nothing due" when it couldn't check.

## Acceptance criteria

- Each alert comes from a live server record that the viewer is permitted to read. Opening it lands on the record's existing page. No alert is fabricated or sample data.
- The bell count equals the number of unread, undismissed and unsnoozed *Now* alerts for the selected clinic.
- Read, dismiss and snooze persist per staff member across reload and devices, and survive a server restart.
- A read failure for one source is shown as unavailable and never as zero.
- Notification center and Inbox triage match their demos in layout, motion, keyboard (S/E, arrow navigation, Esc) and empty states. Only labels, data and actions are bound. Any deviation is listed in the manifest.
- Tests: source-to-alert derivation per role, key stability, permission filtering, and state merge (read/dismissed/snoozed).
- The API passes its existing suite, with new route tests for the state endpoints.

## As built (18 Oct 2026)

- **Folders.** Inbox triage keeps its own Inbox / Snoozed / Archive model, labelled **Open / Snoozed / Done**, rather than Now / Coming up / Done tabs. Now and Coming up are shown as the row preview prefix ("Now ·" / "Coming up ·"). S snoozes until the clinic's next local midnight; E marks done; U moves back to Open.
- **Sources** (`apps/staff-web/src/hms/alerts.ts`, polled every 60 s while visible):

| Who | Now | Coming up | Source |
| --- | --- | --- | --- |
| Doctor (own) | Patient waiting or called in my queue; teleconsult patient waiting; consultation in progress > 60 min; referral to me in *sent* | My appointments and teleconsults in the next 60 min | `/v1/appointments` (today, staffId=me) token status, `/v1/teleconsults`, `/v1/encounters?status=in_progress`, `/v1/referrals` |
| Front desk | Confirmed appointment not checked in > 15 min after start; waitlist hold expiring within 5 min | Waitlist offers on hold; appointments in the next 60 min | `/v1/appointments` (today), `/v1/waitlist?status=offered` |
| access.manage | Invite expired | Invite expiring within 3 days | `/v1/staff-accounts` |
| Setup permissions | Booking setup check not started or blocked | — | `useSetupItems` (same checks as the Overview setup guide) |
| staff.manage | Team registration expired | Team registration expiring within 30 days | `GET /v1/me/alerts` → `teamRegistrations` |
| Everyone | Own registration expired | Own registration expiring within 30 days | `GET /v1/me/alerts` → `registrations` |

  Queue wait time is not exposed per token, so the draft's "queue tokens waiting > 15 min" became "not checked in > 15 min after the booked start".
- **Endpoints.** `GET /v1/me/alerts` (state + own and team registrations), `PUT /v1/me/alerts/:key` (read / dismissed / snoozedUntil), `POST /v1/me/alerts/read` (bulk read). Migration `20261018100000_m01_staff_alert_state.sql`.
- **Component deviations** (listed in `component-source-manifest.json`): an Open action on Notification center items and an Inbox triage detail action, both linking to the alert's page; Notification center re-syncs from props; the bell adds one "Some alerts could not be checked" item when a source failed.

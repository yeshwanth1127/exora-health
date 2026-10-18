# Wave 3 shortlist (18 Oct 2026)

Builds on the Pro wave (`pro-wave-shortlist.md`, verified by the user). The demos were inspected in the browser at 1440×900 light. **Built:** #1 and #2 (My alerts, `docs/prd/staff-alerts.md`), plus the Availability picker in Booking (approved by the user after a trial). See `HANDOFF.md` › Wave 3. #3–#5 are not built.

## Recommended

| # | Component | Preview | What it does in the demo | Where it goes | Data binding / conflict |
| --- | --- | --- | --- | --- | --- |
| 1 | **Notification center** (free) | [demo](http://localhost:4478/free-previews/notification-center/?theme=light), click the bell | Bell with a rolling unread badge. Opens a popover with All/Unread, Mark all read, expandable items with tone icons, per-item read/unread and Dismiss, Clear read, and an "All clear" empty state | Header bell, beside search | *Now* alerts from `docs/prd/staff-alerts.md`. Read/dismiss need per-person state (PRD question 3) |
| 2 | **Inbox triage** (pro) | [demo](http://localhost:4477/components/pro/inbox-triage/demo/?theme=light) | Inbox / Snoozed / Archive tabs with counts, unread dots, an Unread-only toggle, row keyboard navigation, and S to snooze / E to archive with row exit motion | New **Alerts** page per person | Tabs relabelled Now / Coming up / Done. Snooze = until tomorrow. Same state table as #1 |
| 3 | **Timeline** (free) | [demo](http://localhost:4478/free-previews/timeline/?theme=light) | Day-grouped activity feed, newest first: actor + action + meta, relative times, and rows that expand for detail | **Activity** page (`/v1/audit-events`) | Actor = staff name, title = action on subject, detail = diff. Past events only, so not used for upcoming alerts |
| 4 | **Hover card** (free) | [demo](http://localhost:4478/free-previews/hover-card/?theme=light), hover the name | Delayed hover/focus card with avatar, name and details | Patient names in Recent appointments, Queue and Appointments | MRN, phone and next appointment from the existing patient read. No photo, so initials are used |
| 5 | **Dropdown menu** (free) | [demo](http://localhost:4478/free-previews/dropdown-menu/?theme=light) | Trigger + menu with keyboard navigation, groups, shortcuts and destructive items | Row "More" actions in Appointments / Waitlist, where rows carry 3+ buttons | Each item calls the existing guarded command. Disabled while busy or unknown, as today |

## Later (needs a decision)

- **Availability picker** (pro, [demo](http://localhost:4477/components/pro/availability-picker/demo/?theme=light)): a day strip with open-slot counts, a slot list with free/busy bars, and Confirm time. It fits the booking slot step via `/v1/practitioners/:id/slots`. But it is close to the excluded "scheduling calendar" scope, and its 30-minute fixed duration and multi-person "everyone is free" bars don't map to single-doctor slots. **Built and approved by the user (18 Oct 2026)**, with a Start date calendar, 10 square days and the Booking pill's time chips. This is separate from the excluded Week calendar.
- **Multi-step form** (pro): Add doctor. It must keep the per-step server writes (carried over from the Pro shortlist).
- **Sortable data table** (free): Recent appointments / Staff lists. Considered twice before. Low value while lists are short.
- **Countdown** (free): a "teleconsult starts in" chip. Decorative, so skip unless asked.

## Ruled out this round

- Booking pill: a consumer "Book a table" morphing pill, not a staff flow.
- Presence stack and Avatar group: there is no live presence data.
- Week calendar and Kanban board: still deferred, as in earlier shortlists.

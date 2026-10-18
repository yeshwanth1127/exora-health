# Next Arc review — 19 October 2026

Selection only, against `917006f` in `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW`. No dashboard component code changed. This pass revisited eight candidate docs/APIs and the relevant application bindings; no new browser interaction or visual-parity verification was performed. Local preview entry pages were checked over HTTP. Use 127.0.0.1 below if localhost resolves inconsistently.

## What is already done

- **Availability picker is implemented**, in Booking → Doctor & time. The previous "later / needs approval" suggestion is stale. It has Start date, ten open days, slot chips and a real hold; the takeover locked day/time selection while a hold/release is pending.
- Current integration is **32 adopted components + 5 support components = 37 Arc folders**. This is a folder/type count, not exhaustive migration of every field or completed browser verification.
- Claude recorded screening **all 116 Pro component documents** in `pro-wave-shortlist.md`, with a smaller named set exercised in the browser. That is broader than the initial 24 rendered + 22 documentation + 33 source/document pass. The historical 82/83 candidate ledger is not a deduplicated total including the later all-Pro document survey. Do not add those counts together or call all 116 visually verified.
- This pass reviews existing unimplemented candidates; it does not assert eight newly discovered unique components.

## Recommended bounded wave

| Priority | Component / preview | Exact placement | Existing data and behavior to preserve | Before | After |
| --- | --- | --- | --- | --- | --- |
| 1 | [Stepper](http://127.0.0.1:4478/free-previews/stepper/?theme=light) | Booking header above Appointment type: Patient → Doctor & time → Review & confirm | `Booking.tsx` already owns steps 1–3. Bind current=step-1; keep current Back/Continue controls, prerequisites, real slot holds and unknown-outcome blocking. Start with the source's read-only mode; no jump to an uncompleted step. | Three plain numbered labels | Connected progress markers, current/completed states and source motion |
| 2 | [Dropdown menu](http://127.0.0.1:4478/free-previews/dropdown-menu/?theme=light) | Appointment details → secondary action strip: Move appointment, Cancel appointment, Mark no-show under a labeled More actions trigger | Keep primary Check in / Open consultation visible and Patient details available. Existing callbacks still open their guarded reason/confirmation/reschedule flows; selecting a menu item must not submit a lifecycle change. Same permissions and busy/unknown locks. | Several competing secondary/destructive buttons | One labeled menu for secondary actions |
| 3 | [Timeline](http://127.0.0.1:4478/free-previews/timeline/?theme=light) | Activity → optional Feed view next to the current Table view, below the existing filters | Map the existing `/v1/audit-events` data: occurredAt, actor, action/subject, record IDs, reason, diff and request ID. Group using server-provided organisation timezone; same filter query and Load more; retain CSV export, truncation notice, table and Break-glass review. | Dense change text in table cells | Scan by day/person; expand a row for its full changes and identifiers |

**Recommended order:** Stepper → Dropdown menu → Timeline. These have clear placements and existing data/commands. No new backend endpoint is needed for the core placements.

The Appointments table currently has just **Open**, not three buttons. A More menu on every table row would add a click without reducing clutter. Waitlist actions are state-dependent and usually few; keep Accept/Decline visible for a live offer. Revisit its Withdraw action only if it materially reduces clutter.

## Optional second batch

| Component / preview | Exact placement | Benefit and limits |
| --- | --- | --- |
| [Hover card](http://127.0.0.1:4478/free-previews/hover-card/?theme=light) | Start on patient names in Queue; later Appointments | A read-only identity preview: name, initials, MRN and recorded phone. Queue already reads PatientDetail per row, so reuse that data. Appointments has MRN but its bookingPartyPhone belongs to the booking contact and must not be labeled as the patient's phone. Fetch a permitted PatientDetail only on preview intent if needed. Keep name activation opening the patient, respect patients.read and explicit loading/error states. **Defer next appointment from the first pass**: it needs a separate complete appointment read and reliable future filtering, rather than inferring it from the currently displayed list. No clinical history in a hover preview. |
| [Radio cards](http://127.0.0.1:4478/free-previews/radio-cards/?theme=light) | Booking → Appointment type; optional later Patients → After registration choices | In person and Video consultation become explicit mutually exclusive cards with icons and short descriptions. Preserve the exact in_person/virtual values and hold/busy/unknown locks. Do not show fees, duration or availability until those are known for the selected doctor/slot. Use this only if the descriptions help staff choose; the current plain options are adequate otherwise. |

Hover card is optional and read-only. The source keeps focus on its trigger; interactive Book/Call/Edit controls do not belong inside it. The initial 500 ms hover delay, keyboard focus, Escape, close grace and warm-card behavior should stay intact.

## Additional candidates assessed in this pass

| Candidate / preview | Decision | Reason |
| --- | --- | --- |
| [Accordion](http://127.0.0.1:4478/free-previews/accordion/?theme=light) | Defer for editable doctor panels | The source is single-open and force-mounts its content. It would hide other unsaved forms rather than clarify their save boundaries. A later read-only profile summary could fit; collapsing independent editable Profile, Contact, Clinics and Fees is not this wave. |
| [Button group](http://127.0.0.1:4478/free-previews/button-group/?theme=light) | Alternative, not an additional layer | Could group existing date-navigation actions or appointment secondary actions, but current day navigation already works and Dropdown menu addresses the clearer clutter. Avoid adopting both for the same strip. It is an action group, not a persistent visit-type selector. |
| [File upload](http://127.0.0.1:4478/free-previews/file-upload/?theme=light) | Defer | Existing reviewed doctor/clinical forms do not provide a confirmed matching upload/progress/cancel contract. Do not install simulated progress or claim a file was stored. Inspect the intended real attachment endpoint before choosing it. |

Keep Roles permissions, Week calendar, large metrics/dashboard replacements and new provider/inbox workflows outside this bounded UI wave. The booking Availability picker does not constitute approval for replacing the scheduling timeline.

## Source pointers

- Free docs: `/Users/deepakonda/Downloads/test/arc-components/free-source/docs/<slug>.md`.
- Free TSX/CSS: `/Users/deepakonda/Downloads/test/arc-components/free-source/components/arc/<slug>/` (also available through the existing component-library paths).
- Existing implementation targets relative to staff app: `src/hms/Booking.tsx`, `src/hms/Appointments.tsx`, `src/hms/Queue.tsx`, `src/modules/settings.tsx` (`ActivityLog`), `src/hms/ActivityLog.tsx` (API adapter).
- Existing state and data contracts must remain authoritative; copied demos supply geometry and interaction. Preserve desktop scope and the user's retained visual verification preference. Inspect the selected rendered demo states immediately before implementation if the user authorizes that batch.

No runtime restarts, data writes, new UI dependencies or dashboard implementation changes were needed for this selection report. No tests were run for this docs-only pass.

# WhatsApp conversation, Queue Kanban and full-page Settings — 19 October 2026

Implemented on the existing `codex/admin-dashboard-arc` worktree after `c04a0ff`. The user approved the next two components and explicitly requested removing the embedded-window appearance from Settings. The user clarified that **Kanban belongs on Queue**. There is no WhatsApp Kanban tab or conversation-board integration.

## Placements and refinements

| Before | After | Why |
| --- | --- | --- |
| Settings is a centered 980px frame with a 640px internal scroller | Full-width Settings with sticky section navigation, normal page scrolling and full-width content | Make Settings part of the dashboard workspace |
| Custom WhatsApp preview thread and composer | Arc Support conversation with the requested WhatsApp theme | Retain the reference thread/composer motion while using existing chat data and actions |
| Queue table only | Board / Table views; Arc Kanban defaults to Board | See patient flow by status and optionally group by doctor |
| Refresh sits at label height beside the date picker | Refresh is part of DayNavigator's action row beside Today | Align the actual controls without a positional offset |
| Board / Table renders as raw unscoped tabs | Arc Tabs list receives the same local token scope as the workspace navigation | Restore the demonstrated pill, selected state, spacing and focus styling |
| Long board instructions consume a separate text block | Short operational guidance | Keep the page focused on the queue |

The last three refinements respond to the user's annotated Queue screenshots. The screenshots establish the previous defects; the integrated fixes have **not** received a new browser/visual verification pass.

## Queue: actual commands, not a locally edited task board

`src/hms/Queue.tsx` retains the existing clinic/doctor/day query and Table actions. Clinic queue records now carry the doctor ID from their originating scoped read. Board cards show the actual token number, doctor, priority and existing permission-gated patient hover. No additional clinical chart reads or invented task estimates/checklists are introduced.

`queue-board.ts` defines the transition whitelist from the existing API/module contract:

| From → To | Command / behavior |
| --- | --- |
| Called → With doctor | POST `/v1/queue-tokens/:tokenId/start` |
| Waiting or Called → Skipped | POST `/v1/queue-tokens/:tokenId/skip` |
| With doctor → Completed | POST `/v1/queue-tokens/:tokenId/complete` |
| Waiting → Called | Use existing Call next patient; the server chooses by priority and token order |
| Completed/Skipped → earlier state, or between doctors | Unavailable; no write |
| Reorder within a column | No persisted reordering; calling order stays server-owned |

A drop proposes a move and opens a review; it does not optimistically change the saved queue. Confirm uses the parent's existing `useCommand`, so Call next, Table actions and Board actions share busy/unknown locks. The proposed token is identified explicitly, and the review rechecks its current status and permissions after polling. Failed/loading reads, changed records and unsupported moves cannot submit. Completion warns that it also completes the linked appointment; the existing backend refuses completion while a linked consultation is still open. This is the backend's existing `encounter_open` rule, not a bypass of consultation completion.

The Kanban's keyboard lift and arrow movement use a temporary display snapshot. **Only drop requests a reviewed command**; Escape discards the snapshot without a server write. A polling change on another card cannot select that other patient as the move target. Swimlanes group by actual doctor; moving to a different doctor is rejected. Generic creation and task editing are unavailable, and clicking a card opens Queue details/actions instead of the demo's task editor. Unknown server statuses get their own visible column rather than losing records.

No API/schema/queue-order contract was added. Existing non-keyed queue-command unknown outcomes remain blocked; a refreshed record is not treated as proof of the original request. Interactive lost-response/recovery and clinical completion/refusal were not executed in this verification pass.

## WhatsApp conversation

Placement: `WhatsApp.tsx` → its explicitly labelled **UI preview saved in this browser** → Inbox. `WhatsAppInbox.tsx` now uses the Arc SupportConversation shell and ConversationComposer. Existing browser-local WaData remains the data source. This is not a new provider transport or an implementation of the separate legacy/operational Conversations module.

- Actual supplied message IDs, authors, incoming/outgoing direction, text, clinic-local dates/times and existing log statuses replace all reference sample messages. Metadata labels statuses as Preview.
- Requested WhatsApp adaptation: neutral chat canvas, green outgoing bubbles and send control, incoming bubbles, timestamps, compact delivery ticks and corresponding dark colours. The thread fills its inbox column instead of retaining the demo's narrow standalone width/height.
- Existing assign-to-me, bot handoff, resolve/reopen, reply permission, reply-window/template behavior, maximum length and saved replies remain bound to the preview's data/actions. Free-text submission rechecks the window at the event time; a refused submission retains the draft. Quick replies populate the editable draft. Enter queues, Shift+Enter adds a line, composition events are respected.
- Draft guards cover chat/filter/tab changes and resolving/handing back a chat. A discarded draft is cleared when the chat leaves open state. Auto-height follows the multiline composer and conversation state.
- The Arc reference's simulated agent replies, typing, sample identities and attachment-success paths are removed. No attachment upload capability is invented. No external message was sent for verification. Preview confirmations say queued/resolved in preview; they do not claim provider delivery.

## Source ports

New `arc/support-conversation/`: hand-port of local `components/pro/support-conversation/src/Component.cjs` with controlled data/action/composer bindings. Its message spring, reduced motion, scroll-follow and measured composer-height behavior are retained. Its CSS was extracted with hashed namespace removal and explicit user-approved WhatsApp theme/placement overrides.

New `arc/kanban-board/`: the recreated `KanbanBoard.cjs` body is retained as readable compiled JSX in `kanban-board-source.js`, with ESM dependency bindings to the app's React/Motion/Lucide/shared Arc components. A `.d.ts` describes its public data/binding props and a TSX facade exports it. This preserves the substantial pointer lift/tilt/drop, hit testing, auto-scroll, spring placeholders, keyboard, grouping and reduced-motion implementation. Source sample defaults are removed. Optional permission/create/open-card/move-request props connect real Queue semantics; optional display ID and body slots show token/patient data. A mounted guard prevents a delayed drop from requesting work after unmount. Compiled expression-sequence lint syntax is locally documented, not rewritten across the gesture engine.

New CSS rules preserve source conditional/reduced-motion rules and keyframes. `component-source-manifest.json` records reference/integrated digests and binding changes. Settings retains its default reference presentation; only HMS Settings opts into the explicitly approved full-page presentation. DayNavigator's optional action slot leaves other callers unchanged. No dependency installation was needed.

## Verification / handoff

- PASS: **214 frontend tests**, including seven new tests for the Queue transition/permission/doctor whitelist, unknown status preservation, locked Queue board, absent sample tasks, supplied WhatsApp history without synthetic replies/attachments, composer bounds/disabled state, and full-page Settings opt-in. Existing operational adapter, recovery, validation and permission tests remain green.
- PASS: TypeScript and production Vite build. Existing large-bundle advisory remains.
- PASS: focused lint for new ports, Queue, Inbox, Settings and date-controls changes. The existing `WhatsAppLive.tsx` missing JSX key warning remains outside the changed navigation guard.
- PASS: source-manifest digests, **41 adopted + 5 support = 46 component folders**, whitespace checks.
- UNVERIFIED: pointer/touch/keyboard gesture interaction and rendered geometry/motion after the user's screenshots, actual Queue writes/recovery, live provider delivery and deployment. The user retains visual verification. No browser automation or real patient/queue/provider writes were performed.

Continue in `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW`, dashboard5198 → isolated API3080. Preserve the dirty primary checkout and existing auth/runtime instructions. Resume from the user's visual feedback; no additional component wave is implied. Older FYI/next-turn language is historical and superseded by this implementation.

# Requested next turn: WhatsApp-themed Arc chat and Kanban

> Implemented: see `whatsapp-queue-settings-wave.md`. The user explicitly confirmed **Queue** as the Kanban placement. The remaining text records the earlier planning baseline, not outstanding work.

User instruction, 19 Oct 2026: “can you see that the whatsapp chat (moded for whatsapp theme) uses the arc ui component as well as the kanban next turn”. This is the next requested phase; neither component was implemented during the context/doctor/Settings wave. Do not redo the catalog survey or browser verification the user retained.

## WhatsApp chat: source-confirmed starting point

Current `apps/staff-web/src/hms/WhatsAppInbox.tsx` is a custom chat/list/details UI using shared Arc-backed Button/Input/Badge controls and `whatsapp-ui.tsx` Bubble/Ticks. It does **not** use Arc Support conversation. `WhatsAppLive.tsx` supplies browser-local `WaData` and mounts Inbox. `WhatsApp.tsx` labels this “UI preview · saved in this browser”; actual operational endpoints/permissions and provider capabilities are a separate surface. Browser-local queued messages and ticking preview statuses do not establish provider delivery.

Reference: [Support conversation](http://localhost:4477/components/pro/support-conversation/demo/?theme=light).

Next implementation: port its actual thread/message/composer interactions and motion, bind the existing selected conversation and supported actions, and apply the **explicitly requested WhatsApp theme** (green accents, familiar incoming/outgoing bubbles, timestamps and truthful ticks). Preserve labels and separation of preview vs real operations. Keep demo typing, replies, attachment success, send/delivery and resolution simulations out of real operations. Never send an external message merely to verify this UI. Source-read both the current chat and the reference before changing it; document any provider-backed action unavailable in the existing contract.

## Kanban

Reference: [Kanban board](http://localhost:4477/components/pro/kanban-board/demo/?theme=light).

There is currently no `arc/kanban-board` folder or HMS Kanban integration. Queue is a possible placement, but the chosen clinical state mapping has not been implemented. Inspect the reference and actual Queue commands together before choosing columns/actions. Queue call, skip, check-in and consultation commands have distinct permissions/preconditions; a drag cannot silently pretend they are a persisted status update. If supported moves are exposed through drag, retain the actual guarded command and refusal/recovery behavior. There is no confirmed persisted board-order endpoint: do not label local reordering as saved. Do not invent checklist edits, assignment changes or card metadata because the reference demo offers them.

Record the concrete column mapping, supported/unsupported moves, persistence behavior and placement in the handoff as this phase progresses. Use existing endpoints where they fit; review any real backend gap explicitly rather than manufacturing state. This user request authorizes the next phase and WhatsApp visual adaptation; routine component decisions do not need another general permission question.

## Baseline to preserve

Read root AGENTS.md, HANDOFF.md, context-and-setup-wave.md and the source manifest. Current baseline: 44 Arc folders (39 adopted + 5 support), 207 frontend tests, dashboard5198 → API3080. Continue on `codex/admin-dashboard-arc` in `/Users/deepakonda/.codex/worktrees/admin-dashboard-arc/HMS_NEW`. Desktop scope; user retains visual verification. Update counts/provenance/verification after implementation.

# Workspace subpages and main integration — 19 October 2026

User request: publish all accumulated Arc dashboard changes to GitHub/main, first giving multi-section workspaces sidebar children like Appointments.

## Navigation decisions

| Workspace | Sidebar children |
| --- | --- |
| WhatsApp | Overview, Inbox, Automations, Promotions, Message log, Settings |
| Google Business | Overview, Profile, Reviews, Posts, Photos, Insights |
| Website analytics | Overview, Websites, Settings |
| Loyalty programs | Programs, Members, Patient view |
| Voice | Call history, Call setup |

Appointments keeps All appointments, Waitlist and Queue. Queue Board/Table and Status/Swimlanes stay local because they change the same queue's presentation. Workspace settings/catalogue editors and recording-access review stay local because they are parts of one editing/review task.

## Implementation

`apps/staff-web/src/hms/workspace-navigation.ts` is the shared typed destination/label list. `use-workspace-tab.ts` binds existing Arc page tabs to the guarded workspace router. Query URLs such as `/staff/whatsapp?tab=inbox` remain compatible; conversation, automation ID and Google profile section deep links are retained. Sidebar active identity ignores record-specific query arguments. Commands include the subpages. Non-active groups start closed; navigating into a family reveals its group. The Arc sidebar's optional application bindings preserve its default open behavior and rendered/motion implementation.

Sidebar, tabs and browser history use the existing unsaved/pending decision mechanism. Unsaved WhatsApp messages/profile edits remain guarded. No fake successful writes are introduced.

## Integration with current main

Merged `origin/main` at `ff5cd25` before publishing. Main intentionally removed the legacy root marketing/backend/voice projects and added the current managed HMS workspaces. Retained that cleanup and all platform, provisioned tenant, control API, voice-number and managed provider changes. Combined 12 conflicting files manually.

WhatsApp and Google retain real managed query/action endpoints, permission/capability checks, version/idempotency handling, loading/error states and actual delivery status. Arc conversation, controls, confirmation dialogs and charts wrap those contracts. Website analytics uses real managed queries; unavailable attribution is null rather than zero. Unsupported photos/connection states stay visibly unavailable. Old browser-only preview limitations in earlier wave notes do not override these managed bindings. Patient-facing WhatsApp setup examples remain explicitly previews.

## Verification

- Fresh `pnpm install --frozen-lockfile`: PASS (independent source copy, pinned dependencies).
- Root TypeScript check: PASS.
- Staff tests: 243/243 PASS, including five new navigation/deep-link/dirty-state tests.
- Staff production build: PASS (existing large-chunk advisory remains).
- Full API/database suite: 449/449 PASS across 44 files.
- Targeted browser: local sign-in, WhatsApp Inbox deep link, analytics Websites child, Back/Forward and group collapse observed. Screenshot: `verification/workspace-subpages.jpg`.
- This clinic has no ready analytics integration and WhatsApp is unconnected. Actual setup/unavailable UI was observed; connected-provider subpages and a full demo-state/motion parity sweep were not exercised. No provider messages/campaigns were sent for verification.

Dashboard remains on 5198, worktree API on 3080. Readiness is local evidence, not production deployment or provider acceptance. New GitHub Staff workspace workflow checks clean install, root typecheck, staff tests and build. GitHub publication/merge status is recorded by the PR and final response.

Inventory unchanged: 48 component folders = 44 adopted + 4 support. Catalog documentation screening: 249/249; 201 entries unintegrated. This wave adds placements/routing, not component adoption.

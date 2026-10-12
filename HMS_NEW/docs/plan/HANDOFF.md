# Handoff: finish the backend for the original staff UI only

Branch `codex/staff-frontend-integration` of `yeshwanth1127/exora-health`, app in `HMS_NEW/`. Updated 12 October 2026 at `0aaff77`.

## Scope: read this first

**Build only what the original staff UI needs. Do not implement ERD modules just because they appear in `docs/design/erd-v2/`.** The ERD describes a whole hospital system; this project only needs the screens below.

The original UI is the 16 pages in `apps/staff-web/src/hms/original-ui-inventory.json`:

overview, appointments, doctors, schedules, waitlist, catalogue, operations, whatsapp, voice, google_business, growth_analytics, settings, activity, design, teleconsultations, loyalty.

Patients, Queue, Consultations and Walk-in were added during integration. They stay as they are.

**Out of scope. Do not build, restore or scaffold any of these:**
- M06 diagnostics / lab & imaging
- M07 inpatient
- M08 theatre
- M09 pharmacy / prescriptions
- M10 inventory
- M11 billing
- M12 insurance
- M14 documents
- M15 work tasks
- M16 integration
- M17 ABDM
- ledger items G28–G33

M06, M09 and M10 were built by mistake and removed in `0aaff77`. If a task seems to need one of these, stop and ask the product owner.

The only ERD module still to build is the part of **M13 comms** that the WhatsApp, Voice, Google Business and Growth analytics screens use. Its tables and routes are derived from those screens' original source files, not from the full ERD.

## What's left

Full spec, in order, with routes, permissions, credentials and tests: [BACKEND_COMPLETION_GUIDE.md](BACKEND_COMPLETION_GUIDE.md).

1. Small Schedules gaps:
   - G08: prove that exact-time moves work.
   - G06: virtual extra hours.
   - G05: verify Resolve in the weekly sheet.
   - G37 and G10: close them, or ask the product owner.
2. G19: patient notifications and reminders. This is the `comms` foundation and worker.
3. G20 WhatsApp, G21 Voice and G22 Google Business / growth analytics. Real sending needs provider credentials; until then use the log adapter, and mark anything that needs credentials as unverified.
4. G23 Loyalty: **only if the product owner says so.** It is a concept screen.
5. G25: shared Zod contracts for the new comms routes only.

Before starting G20–G23, get the decisions listed at the end of the guide: file storage, the WhatsApp bot, phone calls, loyalty and provider accounts.

Status of every item: [BACKEND_WORK_LEDGER.md](BACKEND_WORK_LEDGER.md).

## Conventions
- Registering a new schema touches:
  - `packages/platform/src/command.ts` (`MODULES`)
  - `db/tests/conventions.test.ts` (`MODULE_ROLE`)
  - `db/tests/db.ts` (`ModuleRole`)
  - `db/scripts/codegen.mjs`
  - `apps/api/src/server.ts`
  - `db/tests/m01-platform.test.ts` (the system role list)
- Optional modules refuse writes while suspended (`assertModuleActive` in `apps/api/src/modules/access/admin.ts`).
- Module roles never DELETE: rows are retired, voided or cancelled instead.
- Cross-module writes go through SECURITY DEFINER functions.
- Money is stored in integer `_minor` units.
- The actor always comes from the authenticated caller, never from the request body.
- Wire original screens through an `OriginalResourceSource` (see `apps/staff-web/src/hms/Waitlist.tsx`). **Never add `/api/v1/admin` compatibility routes.**
- `apps/api/src/http/coverage.test.ts` fails if the frontend calls a `/v1` path that has no route.

## Verify before each commit

Full checklist and browser walkthroughs: [REGRESSION_AND_FLOW_TESTS.md](REGRESSION_AND_FLOW_TESTS.md).

```
cd HMS_NEW
pnpm install
pnpm pg:start            # embedded Postgres on 54329
pnpm db:reset && pnpm db:codegen
pnpm typecheck
pnpm test                # 15 files / 199 tests at 0aaff77, all green
cd apps/staff-web && npx tsc -b && npm test && npm run lint && npx vite build   # 25 tests; lint 0 errors, 18 warnings
```

Then update `docs/api/README.md`, `docs/plan/STAFF_USER_FLOWS.md` and the ledger. Commit one item per commit.

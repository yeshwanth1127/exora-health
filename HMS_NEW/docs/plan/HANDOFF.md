# Handoff: finishing the ERD modules

Branch `main-a4mu8w` of `yeshwanth1127/exora-health`, app in `HMS_NEW/`. Goal: implement every ERD v2 module (`docs/design/erd-v2/`) end to end — migrations, commands, HTTP routes, tests, staff screens — so all code-level work is done. Browser checks are done by hand.

## Done
- M01–M05 complete (platform/admin, patient registry, catalogue and pricing, booking and calendar board, clinical records). Ledger: `docs/plan/BACKEND_WORK_LEDGER.md`.
- M06 diagnostics complete (orders, specimens, results, reports, imaging, Form F). The template to copy for every new module is `db/migrations/20261013100000_m06_diagnostics.sql`, `db/seeds/reference/070_permissions_diagnostics.sql`, `apps/api/src/modules/diagnostics/*`, `apps/api/src/http/routes/diagnostics.ts`, `apps/api/src/http/diagnostics.test.ts`, `apps/staff-web/src/hms/{diagnostics.ts,Orders.tsx,Laboratory.tsx}`.

## Remaining, in order
1. M10 inventory, then M09 pharmacy (`m10-inventory.md`, `m09-pharmacy.md`). Migrations `20261014100000_m10_inventory.sql`, `20261014101000_m09_pharmacy.sql`. Stock never goes negative; test it with two concurrent issues. Picks are FEFO. Stock movements are append-only. Pharmacy writes stock only through a SECURITY DEFINER function owned by inventory. Prescriptions are signed like clinical notes. Allergy warnings need an override reason. Pharmacist verification, OPD dispense with an MRP snapshot, approved substitution, the H1 register, patient indents, MAR and returns. Screens: Inventory page, Pharmacy page, Prescription section in the consultation, MAR panel. Ledger G28.
2. M11 billing, then M12 insurance. Accounts, charges from the `order_item.placed` and `dispense.handed_over` events (consumers in `apps/api/src/consumers.ts`), GST invoices from `catalog.tax_rule`, payments, ledger. Payers, coverage, pre-auth, claims. Ledger G30.
3. M07 inpatient, then M08 theatre. Ledger G32.
4. M13 comms (ledger G19–G23), wired to the WhatsApp, voice, growth and loyalty screens. Those screens currently show a Pending label (`apps/staff-web/src/hms/PendingModule.tsx`). Provider sending stays behind an adapter; say plainly what needs real provider credentials.
5. M14 documents (G31 uploads), M15 operations (work tasks, which also run the unacknowledged-critical-result escalation from M06), M16 integration (`integration_message`). Add the FKs that M06 left as plain uuids.
6. M17 ABDM, the public booking API (G33), shared contracts (G25), then final verification and ledger updates.

## Conventions
- Registering a new schema touches `packages/platform/src/command.ts` (`MODULES`), `db/tests/conventions.test.ts` (`MODULE_ROLE`), `db/tests/db.ts` (`ModuleRole`), `db/scripts/codegen.mjs`, `apps/api/src/server.ts`, and `db/tests/m01-platform.test.ts` (the system role list).
- Optional modules refuse writes while suspended (`assertModuleActive` in `apps/api/src/modules/access/admin.ts`).
- Module roles never DELETE: rows are retired, voided or cancelled instead.
- Cross-module writes go through SECURITY DEFINER functions.
- Money is stored in integer `_minor` units; tax rates in basis points.
- `apps/api/src/http/coverage.test.ts` fails if the frontend calls a `/v1` path that has no route.

## Verify before each commit
```
cd HMS_NEW
pnpm install
pnpm pg:start            # embedded Postgres on 54329
pnpm db:reset && pnpm db:codegen
pnpm typecheck
pnpm test                # currently 16 files / 218 tests, all green
cd apps/staff-web && npx tsc -b && npm test && npm run lint && npm run build   # lint: 18 pre-existing warnings
```
Then update `docs/api/README.md`, `docs/plan/STAFF_USER_FLOWS.md`, the ledger and `docs/plan/SCHEMA_PLAN.md`. Commit one module per commit.

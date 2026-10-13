# Handoff: closed staff implementation; UX/UI next

**Phase closed by the product owner on 12 October 2026.** Local staff implementation is accepted. Active focus is UX/UI and operations review; webpage/Voice-bot integration is on hold. Provider work below is carried forward in [UX_AND_CHANNEL_TODO.md](UX_AND_CHANNEL_TODO.md), not silently marked implemented. [Current operations review](STAFF_OPS_REVIEW.md).

Branch `codex/staff-frontend-integration` of `yeshwanth1127/exora-health`, app in `HMS_NEW/`. Starting commit `6713e01`; three implementation phases completed locally on 12 October 2026. See [STAFF_MODULE_PROGRESS.md](STAFF_MODULE_PROGRESS.md) and the [first checkpoint](STAFF_MODULE_IMPLEMENTATION_CHECKPOINT.md).

## Scope: read this first

**Build only what the original staff UI needs. Do not implement ERD modules just because they appear in `docs/design/erd-v2/`.** The ERD describes a whole hospital system; this project only needs the screens below.

The retained inventory is 15 pages (Design removed by owner) in `apps/staff-web/src/hms/original-ui-inventory.json`:

overview, appointments, doctors, schedules, waitlist, catalogue, operations, whatsapp, voice, google_business, growth_analytics, settings, activity, teleconsultations, loyalty.

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

The only ERD module in this implementation scope is the part of **M13 comms** that the WhatsApp, Voice, Google Business and Growth analytics screens use. Its tables and routes are derived from those screens' original source files, not from the full ERD.

## Resolved module decisions

The product owner delegated the choices. Follow [STAFF_MODULE_DEVELOPMENT_DECISIONS.md](STAFF_MODULE_DEVELOPMENT_DECISIONS.md): local/private S3-compatible content storage, staff WhatsApp only (no patient bot), staff Voice history/runtime ingestion (no public call launcher or telephone infrastructure), manual Google links/internal growth plus optional PostHog, Loyalty concept only, and shared schemas alongside the first new comms routes. The document also resolves ERD gaps and send/STOP/suspension semantics. Do not request the same product decisions again. Provider account facts and production readiness still need confirmation before live activation.

## Deferred technical work (not active this phase)

Full spec, in order, with routes, permissions, credentials and tests: [BACKEND_COMPLETION_GUIDE.md](BACKEND_COMPLETION_GUIDE.md).

1. Local scoped implementation is complete: all seven WhatsApp tabs, Voice history/review, Google manual links and internal Growth are mounted. G21/G22/G25 are DONE locally. 29 of 31 active requirements are DONE; G19/G20 remain PARTIAL.
2. G19/G20 still need actual Meta template sync/media/send transport, durable claims and unknown-outcome reconciliation, receipt correlation, quiet hours and live validation. Existing signed callbacks/control-plane STOP and local queues must be preserved.
3. Build the production private storage/scanner/quarantine adapter before enabling production uploads. Local filesystem validation does not meet that boundary.
4. Validate real Voice runtime/recording hosts and consent retention; configure and validate PostHog/public consented telemetry and the approved booking destination. These require account facts and acceptance, not more mock records.
5. G23 Loyalty remains a labelled concept. No billing/pharmacy/public bot/telephony expansion.

Product choices are resolved in the decision document. Build against disabled/log adapters until provider accounts are configured; missing accounts do not authorize fabricated results or live sends.

Status of every item: [BACKEND_WORK_LEDGER.md](BACKEND_WORK_LEDGER.md).

## Conventions
- Registering a new schema touches:
  - `packages/platform/src/command.ts` (`MODULES`)
  - `db/tests/conventions.test.ts` (`MODULE_ROLE`)
  - `db/tests/db.ts` (`ModuleRole`)
  - `db/scripts/codegen.mjs`
  - `apps/api/src/server.ts`
  - `db/tests/m01-platform.test.ts` (the system role list)
- Optional modules refuse business writes while suspended (`assertModuleActive` in `apps/api/src/modules/access/admin.ts`). For comms, authenticated STOP/withdrawals and already-sent delivery receipts must still persist through the narrow exception specified in the decision document.
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
pnpm db:reset && pnpm db:codegen  # only a disposable local database; verify URLs first
pnpm typecheck
pnpm test                # 20 files / 252 tests in the third implementation phase, all green
cd apps/staff-web && npx tsc -b && npm test && npm run lint && npx vite build   # 54 tests; lint 0 errors, 16 warnings
```

Then update `docs/api/README.md`, `docs/plan/STAFF_USER_FLOWS.md` and the ledger. Commit one item per commit.

# HMS_NEW — Schema & Backend Build Plan

Implements the ERD in [`../design/erd-v2/`](../design/erd-v2/README.md). Status: **Phase 5 (clinical core) done** — encounters opened by check-in, vitals, versioned and signed notes, diagnoses/problem list, allergies, care-relationship chart access with break-glass, CORS and dev login for front-ends; 111 tests green. Next: M06 diagnostics (lab/imaging orders and results), then M09/M10 pharmacy and inventory, M11 billing.

## 1. Decisions (locked)
| # | Decision | Choice |
|---|---|---|
| P1 | Backend language | TypeScript on Node 22 LTS, strict mode |
| P2 | Database | PostgreSQL 18, one database, one schema per module, shared tenancy with RLS |
| P3 | Schema management | **SQL-first**: hand-written `.sql` migrations are the single source of truth; TypeScript types are generated from the live database |
| P4 | Build order | Foundation slice first (M01–M04), then module by module |
| P5 | Layout | pnpm monorepo in `HMS_NEW/` inside this repo; independent of `hospital-backend/` |
| P6 | Clinical store | Standalone PostgreSQL, no Medplum ([ADR 0001](../adr/0001-standalone-postgres.md)) |

## 2. Tech stack
| Concern | Choice | Why |
|---|---|---|
| Runtime | Node 22 LTS (`.nvmrc`) | Already installed; matches frontend tooling |
| Package manager | pnpm workspaces | Already installed; strict dependency isolation |
| HTTP | Fastify | Fast, schema-based validation, good TypeScript support |
| Validation / contracts | Zod (shared in `packages/contracts`) | Same schemas on API and future frontend |
| Migrations | **dbmate** (plain SQL `-- migrate:up` / `-- migrate:down`, each file in a transaction, writes `db/schema.sql` dump) | No DSL — RLS, exclusion constraints, triggers and partitions are written exactly |
| Query layer | **Kysely** + **kysely-codegen** (types generated from the DB, all schemas) | Type-safe SQL without an ORM model to keep in sync |
| Driver | `pg` (node-postgres) | Kysely's standard Postgres dialect |
| Tests | Vitest; DB tests run against a real PostgreSQL 18 (never SQLite/mocks) | Invariants depend on Postgres features |
| Logging | pino (Fastify default) with correlation IDs | Ties logs to `audit_event.correlation_id` |
| Local DB | `pnpm pg:start` (PostgreSQL 18.4 binaries from the `embedded-postgres` npm package) **or** `docker-compose.yml` with `postgres:18` | npm binaries work without Docker (cloud containers, CI); the PGDG apt repo is blocked by this environment's network policy |

Exact package versions are pinned when Phase 0 scaffolds the workspace.

## 3. Directory structure
```
HMS_NEW/
├── README.md                     how to run everything
├── package.json                  workspace scripts (db:up, db:migrate, db:codegen, test…)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .nvmrc  .env.example  docker-compose.yml
├── docs/
│   ├── design/erd-v2/            the ERD (source of truth for tables)
│   ├── design/erd/               v1 (history)
│   ├── plan/SCHEMA_PLAN.md       this file
│   └── adr/                      architecture decision records
├── db/
│   ├── migrations/               dbmate SQL files (forward-only in production)
│   ├── schema.sql                dbmate dump, committed, reviewed in PRs
│   ├── seeds/reference/          permissions, specialties, system roles, terminology loaders
│   ├── seeds/dev/                demo tenant, facility, staff, patients
│   ├── tests/                    DB invariant tests (RLS, constraints, concurrency)
│   └── scripts/                  reset, partition maintenance, codegen wrapper
├── packages/
│   ├── db/                       Kysely client, generated types, withTenantTx(), module roles
│   ├── platform/                 command runner: idempotency, audit, outbox, number series
│   └── contracts/                Zod request/response/event schemas
└── apps/
    ├── api/src/modules/<module>/ commands, queries, routes, event handlers per module
    └── worker/                   outbox dispatcher, hold sweeper, partition + reconciliation jobs
```

## 4. Database architecture

### 4.1 Schemas and extensions
- Schemas: `platform`, `patient`, `catalog`, `booking` (foundation) → later `clinical`, `diagnostics`, `inpatient`, `theatre`, `pharmacy`, `inventory`, `billing`, `insurance`, `comms`, `documents`, `operations`, `integration`, `abdm`.
- Extensions (migration 0001): `btree_gist` (uuid/text equality in exclusion constraints), `pg_trgm` (name search), `citext` (emails).
- IDs: PostgreSQL 18 built-in `uuidv7()`.

### 4.2 Roles and grants (enforces "one writer per schema")
| Role | Login | Purpose |
|---|---|---|
| `hms_migrator` | yes | Owns all objects, runs migrations and seeds. `BYPASSRLS` (seeding only); never used by the app |
| `hms_app` | yes | The API/worker connection. `NOBYPASSRLS`. Has `USAGE` + `SELECT` on all module schemas (cross-module reads allowed), **no write privileges of its own** |
| `mod_platform`, `mod_patient`, `mod_catalog`, `mod_booking`, … | no | One per module: `INSERT/UPDATE` on its own schema only, plus `INSERT` on `platform.audit_event`, `platform.outbox_event`, `platform.idempotency_record`, and `UPDATE` on `platform.number_series` |
| `hms_readonly` | yes | Reporting/BI; SELECT on published views only |

`hms_app` is granted each `mod_*` role `WITH INHERIT FALSE, SET TRUE`, so it gains write rights only after `SET LOCAL ROLE mod_<module>` inside a transaction. A booking command physically cannot write `patient.*`. Nobody gets `DELETE` on clinical, financial, stock or audit tables.

### 4.3 Tenant isolation (RLS)
Every tenant-owned table:
```sql
ALTER TABLE patient.patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient.patient FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON patient.patient
  USING      (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```
- The app runs each request in a transaction that starts with `SET LOCAL app.tenant_id = '<uuid>'` and `SET LOCAL ROLE mod_<module>`. If the tenant isn't set, `current_setting` raises an error, so queries fail closed instead of returning everything.
- Global tables (`platform.tenant`, `platform.permission`, `catalog.specialty`, `catalog.terminology_concept`, `catalog.concept_map`) have no `tenant_id`. `platform.role` allows `tenant_id IS NULL` (system roles) to be read by every tenant.
- A helper `platform.apply_tenant_rls(regclass)` creates the standard policy, so every migration does it identically.

### 4.4 Keys and cross-tenant safety
```sql
CREATE TABLE patient.patient (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL REFERENCES platform.tenant (id),
  mrn        text NOT NULL,
  ...
  UNIQUE (tenant_id, id),          -- target for composite FKs
  UNIQUE (tenant_id, mrn)
);
-- child
FOREIGN KEY (tenant_id, patient_id) REFERENCES patient.patient (tenant_id, id)
```
A composite FK makes it impossible to point at another tenant's row, even from a bug that bypasses RLS. Nullable FKs use the default `MATCH SIMPLE` (not checked while NULL).

### 4.5 Standard columns and triggers
- Columns per [conventions](../design/erd-v2/00-conventions.md): `id, tenant_id, created_at, created_by, updated_at, updated_by, version`.
- `platform.touch_row()` BEFORE UPDATE trigger: sets `updated_at = now()`, `version = OLD.version + 1`. The app updates with `WHERE id = $1 AND version = $2`; zero rows → `409 Conflict`.
- `platform.forbid_update()` / `platform.forbid_delete()` triggers on immutable tables (`*_version`, `audit_event`, `stock_movement`, issued invoices via status check) as a second line behind the missing grants.
- Every FK column gets an index (Postgres doesn't create them automatically).

### 4.6 Partitioned tables
`platform.audit_event`, `platform.outbox_event`, and later `inventory.stock_movement`, `integration.integration_message` are range-partitioned by month on their timestamp. Primary keys include the partition key (`PRIMARY KEY (id, occurred_at)`), so nothing holds an FK *to* them. `platform.ensure_month_partitions(parent, months_ahead)` creates upcoming partitions; the worker calls it daily and the migration creates current + 3 months.

### 4.7 Numbering
`platform.next_number(facility_id, series_kind, period_key)` does `INSERT … ON CONFLICT DO UPDATE SET next_value = next_value + 1 RETURNING …` on `platform.number_series`, giving gap-free, race-free MRNs, tokens and invoice numbers.

### 4.8 Money, time, enums
Money `bigint` paise + `currency char(3)`; event times `timestamptz`; schedule times `time` + facility timezone; small enums `text` + `CHECK` (no PG `ENUM` types — they're painful to change).

## 5. Migration conventions
- File name: `db/migrations/<timestamp>_<module>_<what>.sql`, e.g. `20261010100000_m01_platform_core.sql`.
- One concern per file; tables of one module never spread across unrelated files.
- Each file = one transaction (dbmate default). `CREATE INDEX CONCURRENTLY` only in separate non-transactional files, when tables are large.
- Production is **forward-only**: `migrate:down` sections exist for local reset only.
- Every new tenant table must have: `tenant_id`, `UNIQUE (tenant_id, id)`, RLS via helper, `touch_row` trigger, grants to its module role, FK indexes. A test (`db/tests/conventions.test.ts`) queries the catalog and fails the build if any table misses one.
- `db/schema.sql` is regenerated and committed with every migration, so PR diffs show the real schema change.

## 6. Foundation slice — migration list
| # | File (module) | Creates |
|---|---|---|
| 0001 | `m00_bootstrap` | extensions; schemas `platform, patient, catalog, booking`; roles `hms_app`, `mod_*`, `hms_readonly`; helper functions (`touch_row`, `forbid_update`, `forbid_delete`, `apply_tenant_rls`, `ensure_month_partitions`) |
| 0002 | `m01_tenancy_org` | `tenant`, `organization`, `facility`, `department`, `location` (tree incl. bed/ward/theatre/store) |
| 0003 | `m01_staff_access` | `staff`, `staff_registration`, `user_account`, `permission`, `role`, `role_permission`, `role_grant`, `care_assignment`, `emergency_access_grant` |
| 0004 | `m01_platform_runtime` | `module_state`, `config_setting`, `number_series` + `next_number()`, `idempotency_record`, `audit_event` (partitioned), `outbox_event` (partitioned) |
| 0005 | `m03_terminology_directory` | `specialty`, `terminology_concept`, `concept_map`, `practitioner_profile`, `practitioner_affiliation`, `healthcare_service`, `bed_category` (needed before `location.bed_category_id` FK — added here with `ALTER TABLE`) |
| 0006 | `m02_patient` | `patient`, `patient_identifier`, `patient_address`, `patient_contact`, `related_person`, `patient_consent`, `patient_flag`, `patient_link`; then FKs `user_account.patient_id`, `care_assignment.patient_id` |
| 0007 | `m03_catalog_services` | `service_item`, `service_component`, `lab_test_def`, `observation_definition`, `reference_range`, `answer_option`, `procedure_def`, `package_def`, `package_inclusion` |
| 0008 | `m03_pricing` | `price_list`, `price_list_item` (exclusion on overlapping validity), `team_fee_rule`, `bed_charge_rule`, `tax_rule` |
| 0009 | `m04_booking_kernel` | `schedulable_resource`, `schedule_rule`, `schedule_exception`, `facility_holiday`, `day_plan`, `day_plan_block`, `reservation` (exclusion constraint) |
| 0010 | `m04_appointments` | `booking_party`, `web_booking_session`, `appointment`, `appointment_status_history`, `queue_token`, `waitlist_entry`, `waitlist_offer` |

FKs that point to modules not yet built (e.g. `queue_token.encounter_id` → `clinical.encounter`, `schedulable_resource.equipment_id` → `operations.equipment`, `price_list.payer_id` → `insurance.payer`) are created as plain nullable `uuid` columns now and get their FK constraint in that module's first migration.

## 7. Seeds
- `seeds/reference/` (all environments, idempotent upserts): permission list, system roles + role_permission, specialties, `module_state` defaults, a minimal terminology set. Full SNOMED CT India edition / WHO ICD-10 / LOINC loaders come later as scripts, because they're licensed downloads.
- `seeds/dev/` (local only): one tenant, two facilities with wards/beds, a few staff and doctors with schedules, sample patients, a cash price list.

## 8. Tests that define "done" for the foundation
| Test | Proves |
|---|---|
| RLS isolation | Tenant A's session sees zero rows of tenant B; inserting a row with B's `tenant_id` fails; missing `app.tenant_id` errors |
| Composite FK | A tenant-A row cannot reference a tenant-B patient even with RLS bypassed |
| Write ownership | Under `SET ROLE mod_booking`, INSERT into `patient.patient` is denied |
| Optimistic locking | Two updates with the same `version`: one succeeds, one affects 0 rows |
| Reservation concurrency | 20 parallel holds on the same doctor/slot → exactly 1 succeeds |
| Number series concurrency | 100 parallel `next_number()` calls → 100 distinct consecutive values |
| Token uniqueness | Parallel walk-in tokens for one session never collide |
| Idempotency | Same key + same hash returns stored result; same key + different hash rejected |
| Immutability | UPDATE/DELETE on `audit_event` and `appointment_status_history` denied |
| Conventions | Every tenant table has tenant_id, `UNIQUE (tenant_id, id)`, RLS enabled + forced, touch trigger, FK indexes |

## 9. Application layer (built alongside, Phase 4)
Every write goes through one **command runner** in `packages/platform`:
1. Authenticate → resolve user, tenant, facility, capabilities.
2. `BEGIN` → `SET LOCAL app.tenant_id`, `SET LOCAL ROLE mod_<module>`.
3. Check / store `idempotency_record`.
4. Run the module's command (Kysely, typed).
5. Insert `audit_event` + `outbox_event` (same transaction).
6. `COMMIT` → respond.

The worker claims outbox rows with `FOR UPDATE SKIP LOCKED`, delivers to in-process module handlers, records `inbox_record` (from M16, added when M16 lands; until then a minimal `platform.inbox_record`).

## 10. Phases
| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Workspace scaffold: pnpm, tsconfig, dbmate, docker-compose (PG18), Vitest DB harness, `db:reset` script | `pnpm db:reset && pnpm test` runs green on an empty project |
| 1 | Migrations 0001–0004 (bootstrap + M01) + reference seeds | Platform tests in §8 pass |
| 2 | Migrations 0005–0008 (M02 patient, M03 catalogue/pricing) | RLS, FK, conventions tests pass; codegen types compile |
| 3 | Migrations 0009–0010 (M04 booking) | Concurrency tests pass |
| 4 | API skeleton: command runner, auth stub, patient registration + booking + check-in endpoints, outbox worker | End-to-end: register → book → check in, with audit + outbox rows |
| 5+ | Module by module: M05 clinical + M06 diagnostics → M09 pharmacy + M10 inventory → M07 inpatient + M08 theatre → M11 billing → M12 insurance → M13 comms, M14 documents, M15 operations, M16 integration → M17 ABDM | Each module: migrations + tests + commands for its flows |

## 11. Risks and open items
| Item | Plan |
|---|---|
| PostgreSQL 18 required (`uuidv7()`) | Dev/CI via bundled 18.4 binaries or `postgres:18` container. If a managed host only offers ≤17, swap in a SQL `uuidv7()` function in migration 0001 |
| Bundled binaries lack `pg_dump` | `db/schema.sql` dump only where `pg_dump` 18 exists (`DBMATE_DUMP=1`); a schema snapshot test can replace it later |
| RLS performance | `tenant_id` leads every composite index; check plans on seeded volume before Phase 5 |
| `hms_app` membership in `mod_*` roles requires PG16+ `GRANT … WITH INHERIT FALSE` | Fine on 18 |
| Hosting region (DPDP Rules 2025) | Decide before production; schema unaffected |
| Medplum in the old migration plan | ADR 0001 records the change; team plan doc needs updating |

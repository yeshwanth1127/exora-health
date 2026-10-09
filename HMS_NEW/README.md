# HMS_NEW

New hospital management system: TypeScript (Node 22) modular backend on PostgreSQL 18. Separate from `hospital-backend/` (left untouched).

**Status:** planning complete, scaffold not started. Start with [docs/plan/SCHEMA_PLAN.md](docs/plan/SCHEMA_PLAN.md).

| Path | Contents |
|---|---|
| `docs/design/erd-v2/` | The ERD: 17 modules, ~230 tables (source of truth for tables) |
| `docs/plan/` | Schema and backend build plan |
| `docs/adr/` | Architecture decisions (standalone Postgres, TypeScript + SQL-first) |
| `db/` | SQL migrations, seeds, DB invariant tests, scripts |
| `packages/` | Shared code: `db` (Kysely client + generated types), `platform` (command runner, audit, outbox), `contracts` (Zod schemas) |
| `apps/` | `api` (Fastify, one folder per module) and `worker` (outbox dispatcher, sweepers, nightly jobs) |

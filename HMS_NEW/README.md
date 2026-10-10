# HMS_NEW

New hospital management system: TypeScript (Node 22) modular backend on PostgreSQL 18. Separate from `hospital-backend/` (left untouched).

**Status:** Phase 5 (clinical core) done — booking → check-in → doctor's consultation → completion over a secured HTTP API ([docs/api/README.md](docs/api/README.md), including how to wire a front-end); 111 tests. Next: lab/imaging orders, pharmacy, billing. Plan: [docs/plan/SCHEMA_PLAN.md](docs/plan/SCHEMA_PLAN.md).

## Quick start
```bash
cd HMS_NEW
pnpm install
pnpm pg:start          # PostgreSQL 18 from bundled binaries (or: docker compose up -d)
pnpm db:reset          # recreate dev database `hms`: migrate + reference + dev seeds
pnpm test              # rebuilds `hms_test` from scratch, runs DB, API and worker tests
pnpm typecheck
pnpm api:dev           # HTTP API on :3000 (dev tokens: pnpm dev:token ravi)
pnpm worker:dev        # outbox delivery + housekeeping
```

| Script | Does |
|---|---|
| `pg:start` / `pg:stop` / `pg:status` | Local PostgreSQL 18 on port 54329, data in `.pgdata/` (bundled `embedded-postgres` binaries; no Docker needed) |
| `db:migrate` / `db:rollback` / `db:status` | dbmate against `DATABASE_URL` |
| `db:new <name>` | New migration file in `db/migrations/` |
| `db:reset [--test]` | Drop, recreate, migrate and seed the dev (or test) database |
| `db:codegen` | Regenerate `packages/db/src/generated/db.ts` from the dev database (run after `db:reset` whenever migrations change) |
| `test` / `test:watch` | Vitest; global setup rebuilds `hms_test` first |

Settings: see `.env.example`.

## Layout
| Path | Contents |
|---|---|
| `docs/design/erd-v2/` | The ERD: 17 modules, ~230 tables |
| `docs/plan/` | Schema and backend build plan; [WEBSITE_PLAN.md](docs/plan/WEBSITE_PLAN.md) for moving the public website in |
| `docs/adr/` | Architecture decisions |
| `db/migrations/` | dbmate SQL migrations |
| `db/seeds/` | `reference/` (all environments), `dev/` (local only) |
| `db/tests/` | DB tests against real PostgreSQL 18 |
| `db/scripts/` | Local server, migrate, reset helpers |
| `packages/db` | Kysely client + generated schema types |
| `packages/platform` | Command runner (tenant, module role, idempotency, audit, outbox) and domain errors |
| `apps/api/src/modules/` | Module commands and queries: `booking`, `patient`, `directory` |
| `apps/api/src/http/`, `src/auth/` | HTTP routes, token verification, principal + permission checks |
| `apps/worker/` | Outbox dispatcher and housekeeping jobs |
| `docs/api/` | API reference |

## Notes
- The bundled binaries don't include `pg_dump`, so `db/schema.sql` is only written when `DBMATE_DUMP=1` and a `pg_dump` 18 is on PATH (e.g. inside the Docker container).
- When run as root (cloud containers), `pg:start` runs the server as the `postgres` OS user, because PostgreSQL refuses to run as root.

# HMS_NEW

New hospital management system: TypeScript (Node 22) modular backend on PostgreSQL 18. Separate from `hospital-backend/` (left untouched).

**Frontend developers start here: [docs/FRONTEND_GUIDE.md](docs/FRONTEND_GUIDE.md)** — data model, API, auth, and the screens to build for the admin dashboard and the Exora webpage.

**Selected staff frontend integration:** [master plan](docs/plan/STAFF_FRONTEND_INTEGRATION_MASTER_PLAN.md) and [prioritized gap backlog](docs/plan/staff-integration-audit/backend-gap-backlog.csv). This audits the existing `hms-monochrome/staff-web` against the current backend, including scheduling differences, lifecycle corrections, and missing UI. Core integration is now implemented in `apps/staff-web`; see the [executed checkpoint](docs/plan/STAFF_FRONTEND_INTEGRATION_CHECKPOINT.md) and [35-area missing backend ledger](docs/plan/BACKEND_WORK_LEDGER.md). Local preview: `http://127.0.0.1:5188/staff/appointments`.

**Status:** Phase 5 (clinical core) and Virtual OPD done — booking → check-in → doctor's consultation (in person or by video) → completion over a secured HTTP API ([docs/api/README.md](docs/api/README.md)); 117 tests. Next: lab/imaging orders, pharmacy, billing. Plan: [docs/plan/SCHEMA_PLAN.md](docs/plan/SCHEMA_PLAN.md).

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

## Exora SaaS and tenant containers

The Exora product website and connected onboarding run at `pnpm platform:dev`
(`http://127.0.0.1:5190`). The SaaS architecture and delivery gates are documented in
[`docs/plan/SAAS_PLATFORM_PLAN.md`](docs/plan/SAAS_PLATFORM_PLAN.md).

Start the containerized Exora control plane (corporate site, onboarding API, superadmin UI and its
operations-only PostgreSQL database):

```bash
pnpm control:up
# Corporate/onboarding: http://127.0.0.1:8090/
# Superadmin:          http://127.0.0.1:8090/admin/
```

The local default superadmin token is `local-superadmin-change-me`; override `SUPERADMIN_TOKEN`
outside a throwaway development machine. The control plane stores customer, subscription,
entitlement, deployment and voice-binding metadata only—never patient or clinical records.

For local self-service provisioning, run the control API on the Docker host with
`AUTO_PROVISION=1`; production uses a dedicated provisioner worker. The containerized control API
queues requests (`AUTO_PROVISION=0`) and never receives the Docker socket.

Build the tenant image containing the customer public booking site, staff frontend, HMS API and
worker, then launch its isolated PostgreSQL stack:

```bash
docker build --build-arg VITE_HMS_DEV_LOGIN=true -t exora/hms:local .
TENANT_PORT=8080 docker compose -f compose.tenant.yml up -d --no-build
```

For a customer-specific local development stack:

```bash
pnpm tenant:provision -- \
  --slug northstar-health \
  --name "Northstar Health" \
  --email owner@northstar.example \
  --owner "Northstar Administrator" \
  --facility "Indiranagar Clinic" \
  --city Bengaluru \
  --plan connect \
  --port 8081
```

The provisioner creates `.tenants/<slug>/.env` with mode `0600`, generated database/application
secrets, a dedicated Compose project, private volumes and links. The customer website is `/`; the
shared staff workspace is `/staff/appointments`. Local development uses the `admin` subject with no
password. Production must use tenant-specific OIDC and a one-time activation flow; development
login is rejected in `NODE_ENV=production`.

To add Voice to an existing local tenant, generate its isolated service identity first:

```bash
pnpm tenant:voice:prepare -- --slug test-hospital
```

After the tenant has a public HTTPS URL, use the superadmin voice manifest to create and test its
dedicated Sarvam agent, then bind the committed app without exposing the Sarvam API key in an
argument or browser bundle:

```bash
read -s SARVAM_API_KEY && export SARVAM_API_KEY
pnpm tenant:voice -- --slug test-hospital --org-id ORG --workspace-id WORKSPACE \
  --app-id APP --app-version VERSION --agent-name "Test Hospital Front Desk"
unset SARVAM_API_KEY
```

The public website then exposes the consent-gated call control. Sarvam tools use the tenant's
`X-Service-Key` and can read branches, doctors, schedules and live availability, and can hold,
book, look up, cancel and reschedule appointments. See
[`docs/plan/SARVAM_VOICE_SAAS.md`](docs/plan/SARVAM_VOICE_SAAS.md) for the complete activation and
hosting runbook.

## Layout
| Path | Contents |
|---|---|
| `docs/design/erd-v2/` | The ERD: 17 modules, ~230 tables |
| `docs/plan/` | Schema and backend build plan; [WEBSITE_PLAN.md](docs/plan/WEBSITE_PLAN.md) for moving the public website in; [VIRTUAL_OPD_PLAN.md](docs/plan/VIRTUAL_OPD_PLAN.md) for video consultations |
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
| `apps/platform-web/` | Exora corporate site and connected onboarding |
| `apps/control-api/`, `apps/admin-web/` | SaaS registry/API and isolated superadmin control plane |
| `apps/public-web/` | Tenant-branded public site and live booking flow |
| `docs/api/` | API reference |

## Notes
- The bundled binaries don't include `pg_dump`, so `db/schema.sql` is only written when `DBMATE_DUMP=1` and a `pg_dump` 18 is on PATH (e.g. inside the Docker container).
- When run as root (cloud containers), `pg:start` runs the server as the `postgres` OS user, because PostgreSQL refuses to run as root.

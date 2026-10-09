# ADR 0002 — TypeScript backend with SQL-first schema

- Status: accepted
- Date: 2026-10-09

## Context
The existing `hospital-backend` is Python (FastAPI, SQLAlchemy, Alembic). The team's plan documents describe a TypeScript modular backend, and the frontend is TypeScript/React. The schema relies heavily on PostgreSQL features ORMs model poorly: RLS policies, exclusion constraints, partial unique indexes, triggers, partitioning, composite FKs.

## Decision
- HMS_NEW backend: TypeScript on Node 22, Fastify, pnpm monorepo.
- Schema: hand-written SQL migrations run by dbmate are the single source of truth.
- Queries: Kysely with types generated from the live database (kysely-codegen).
- `hospital-backend` is left untouched; HMS_NEW is a separate project in the same repo.

## Consequences
- No drift between an ORM model and the real schema; every constraint is visible in SQL review.
- Developers write SQL-shaped queries (Kysely) rather than ORM calls.
- Type regeneration (`pnpm db:codegen`) is part of every migration change.

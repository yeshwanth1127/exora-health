# Exora staff workspace

Selected React/shadcn/Geist monochrome source, imported from `hms-monochrome/staff-web`. The original source is untouched; `SOURCE_PROVENANCE.json` records all 73 imported file hashes and its Git identity. The original app remains at `src/legacy/OriginalApp.tsx` with its advanced modules preserved for later integration.

The active `src/App.tsx` and `src/hms/` use the TypeScript HMS `/v1` APIs. The staff app builds into its own `dist/` at `/staff/`. It no longer relies on the Python cookie/CSRF or `/api` contract. Original public book/talk entry points are excluded from the production build.

## Development

From the inner `HMS_NEW` folder:

```sh
npx --yes pnpm@10.28.0 install
cp apps/staff-web/.env.example apps/staff-web/.env.local
npx --yes pnpm@10.28.0 staff:dev
```

Vite listens at `http://127.0.0.1:5188/staff/appointments`. The API proxy defaults to port 3038; set `HMS_API_PROXY_TARGET` to your chosen local API. Run the API and worker against the same database. `.env.local` is ignored. Development login requires both Vite development mode and `VITE_HMS_DEV_LOGIN=true`, plus an API in `AUTH_MODE=dev`; it is removed from production builds.

For the current isolated preview, PostgreSQL is on 54339, the database is `hms_staff_integration`, API is on 3038, worker shares that database and Vite is on 5188. The existing primary environment was not reset. Local seeded identities are Ravi (front desk), Asha (doctor), Meena (nurse) and Priya (admin). Memory-only authentication deliberately requires signing in again after a full reload.

## Checks

```sh
npx --yes pnpm@10.28.0 staff:test
npx --yes pnpm@10.28.0 staff:build
npx --yes pnpm@10.28.0 --filter @hms/staff-web lint
```

The root backend typecheck/test configuration excludes this browser application. It has its own DOM-aware TypeScript project and transport/context tests. Lint currently reports warnings in both preserved source and new React effects, with no errors; the build also warns about the main bundle size.

## Production configuration

Configure `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, scope and optional audience; register `${origin}/staff/callback` as the OIDC callback and align the issuer/audience with the API. Tokens stay in memory; only the short-lived OIDC protocol state uses session storage. API 401 clears the workspace; 403 preserves sign-in but clears unauthorized query records. Server permission checks remain authoritative.

Serve `dist/` at `/staff/` with an SPA fallback and proxy `/v1` and `/tele/v1` to the API at the same origin. Do not proxy `/dev` in production. This change has not configured a production host or deployment.

For virtual consultations, set API `TELE_PATIENT_LINK_BASE` to `${origin}/staff/video-consult`. The patient page uses the fragment link token and isolated patient-video endpoints, never a staff bearer token. Real video also requires approved consent content and the backend video-provider configuration. The default localhost provider remains visibly unavailable for real calls.

See [the checkpoint](../../docs/plan/STAFF_FRONTEND_INTEGRATION_CHECKPOINT.md), [master plan](../../docs/plan/STAFF_FRONTEND_INTEGRATION_MASTER_PLAN.md) and [backend ledger](../../docs/plan/BACKEND_WORK_LEDGER.md). All missing backend work remains deferred.

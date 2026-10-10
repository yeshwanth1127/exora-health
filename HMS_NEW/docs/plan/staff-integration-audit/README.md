# Staff integration audit evidence

Collected from the selected dirty `hms-monochrome/staff-web` source and the inner `HMS_NEW` TypeScript backend. See [the master plan](../STAFF_FRONTEND_INTEGRATION_MASTER_PLAN.md) for architecture, decisions, and acceptance gates.

- `ui-api-calls.json`: 133 static call sites, including wrappers and separate public entry points. Computed expressions are retained; this is not a unique endpoint count.
- `backend-routes.json`: 67 registered method/path pairs, including conditional development and patient-video routes. The current queue action loop is expanded explicitly.
- `snapshot.json`: source identities, dirty status, and 65 TypeScript source hashes. This is evidence, not a backup of the working tree. Preserve the selected source before extraction.
- `backend-gap-backlog.csv`: 35 gap/work packages (27 original audit packages plus 8 integration/future-domain additions), with priority, delivery phase, dependencies, frontend response, evidence, and acceptance. These are not 35 missing endpoints: some are authorization/lifecycle corrections, some whole modules, and others optional product choices.
- `integration-validation.json`, `integration-db-receipt.json`, `nursing-self-join-receipt.json`: subsequent executed local checks, persisted synthetic state and the reproduced G35 blocker.
- `integrated-staff-preview.png`: first-tranche staff appointments screenshot with fictional records.
- `collect.cjs`: reruns the static route/call-site inventory without API requests or database writes.

CSV `source_evidence` uses target-backend-relative paths. A `staff-web/` prefix identifies the external selected source at `/Users/deepakonda/.codex/worktrees/hms-monochrome/staff-web`; the selected source has now been imported into `apps/staff-web`, while this static inventory preserves its original baseline. Line references identify the audited snapshot and may drift after edits.

Run from the outer exora-health checkout:

```sh
node HMS_NEW/docs/plan/staff-integration-audit/collect.cjs /Users/deepakonda/.codex/worktrees/hms-monochrome/staff-web /Users/deepakonda/Documents/antigravity/HMS_NEW/HMS_NEW HMS_NEW/docs/plan/staff-integration-audit
```

Inventory presence establishes source registration only. Signed-in authorization, database persistence, worker behavior, deployment, and provider outcomes require the master plan's separate acceptance checks. No acceptance results have been inferred from this inventory. Subsequent executed checks are recorded separately in [the integration checkpoint](../STAFF_FRONTEND_INTEGRATION_CHECKPOINT.md). `validation.json` records the earlier 27-row planning baseline, not current implementation acceptance.

Current frontend-restoration evidence:

- `original-ui-parity.json`: 53 source-derived feature groups across 16 screens; remaining full module ports are explicit.
- `ui-restoration-validation.json`: 18 tests, build/typecheck, lint, original-source/backend preservation and bounded browser checks.
- `restored-schedules.png`, `restored-weekly-hours.png`: actual local components and fictional appointment records; weekly hours are explicitly an unsaved draft.
- [Original UI parity ledger](../ORIGINAL_UI_PARITY_LEDGER.md): missing design details and backend-agent handoff. No backend implementation is part of this pass.

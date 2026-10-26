# Approved Overview colours — 27 October 2026

The user approved the Overview colour proposal and requested it on the normal screen, including the setting-up view's “Up next: reach patients” panel. There is no preview query gate now.

- Ready/no-activity state: mint readiness banner, blue first-booking card and coloured channel icons.
- Setting-up state: soft violet channel-panel header, matching channel icons and unchanged lock/step rules. This panel is shown only while setup is incomplete; it was absent in the earlier screenshot because that clinic had already finished setup.
- Reports/running state and all other screens remain unchanged. Scope the colours in `overview-colours.module.css`; do not override shared Arc components.
- Provider readiness, onboarding progress, permissions and navigation still come from the existing reads/actions. Colour does not unlock or claim a connection.

Validation: staff typecheck, production build and 255 staff tests pass. Normal local Overview (no query flag) was visually checked in light desktop mode. The setup panel was source checked; its incomplete setup and dark states were not visually exercised against a real incomplete clinic.

Deployment boundary: local Vite5198 and API3080 use this worktree. Read-only SSH inspection found the hosted Paperwhale demo at `demo.app.paperwhale.health` on `srv2086263` (`201.18.196.230`), frontend/backend images `paperwhale/clinic-web:6fb54fb` and `paperwhale/clinic:6fb54fb`. Its server checkout is `/var/www/exora-health`, with separate uncommitted marketing/deployment configuration that must be preserved. Current staff/main contains changes across 72 staff files since that release, including API-dependent arrivals/channel setup. Do not deploy the new staff bundle alone against that backend. A question is pending on whether “prod” means the normal local dashboard or the hosted clinic; no hosted mutation has been performed. A hosted release needs paired compatibility validation, backups, immutable images, controlled rollout and separate served-asset/readiness verification.

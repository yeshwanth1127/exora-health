# Platform website replacement — 22 October 2026

Replaced `apps/platform-web` with the complete ClinicSheet website at source commit `debfa6b`. The former platform homepage and five-step UI were removed. Existing patient-site templates, staff UI, admin UI, database isolation, provisioning operations and provider contracts remain intact.

## Verification

- Production Next.js export/build passed (24 generated routes including framework routes).
- 9 platform tests passed: brand substitution, intake handoff, expiry, payload/consent/plan validation, supported templates, credential storage and lost-response recovery.
- 7 control/bootstrap tests passed on a separate local PostgreSQL instance: template handoff, rejected unknown template, authenticated idempotent recovery and completion/credential response, exported-route resolution, and actual facility type/timezone bootstrap, and production input parsing with voice disabled.
- The browser completed owner → organisation → facility → plan → review → queued request through the actual local control API; reload recovered the same request. Launch correctly disabled voice. Automatic provisioning and providers were disabled.
- 15 local HTTP route checks returned 200. Unknown page, JS asset and control API route returned 404. Product/dashboard deep routes worked with the production asset server.
- Frozen workspace lockfile validation passed. Local build used existing package installations; clean CI installation remains the dependency-installation check.

No live tenant, provider activation, production deployment or real administrator account was created during verification. The local completion test supplies a synthetic host result; it does not launch containers or prove production provisioning. The full monorepo typecheck was not verified locally because this clean checkout reuses partial dependency installations; the frontend build checks its types and the existing CI retains the full monorepo typecheck.

Source and original illustration assets are included. The generation prompts and historical design iterations remain in the ClinicSheet repository. Product-name configuration is `apps/platform-web/src/lib/brand.ts`.

The selected website template now passes through both local and production provisioning commands. Facility type and timezone are passed through compose into database bootstrap instead of being silently replaced by clinic/Asia-Kolkata defaults. Control API types and provisioning script syntax were checked separately. No production provisioner was run.

Production input parsing also fixes the existing `jq -e` false-value exit: Launch requests with voice disabled can now pass input validation. A regression test stops at a deliberately missing certificate, before any infrastructure work. CI now runs the platform unit tests, build and these focused provisioning tests.

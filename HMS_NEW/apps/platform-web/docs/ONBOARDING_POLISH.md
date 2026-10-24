# Connected onboarding polish

Implemented in the isolated `codex/onboarding-polish` checkout of exora-health. The separate public website preview, production VPS and original checkout are unchanged.

## Flow

Account → Workspace → Facility → Modules & launch → Website → Review → Provisioning → Ready.

Arc Input, Select, Checkbox, Radio cards and Stepper replace browser-style choices and validation popups. Fields retain native accessibility/autofill semantics; validation is displayed inline. Copied controls are unchanged from the existing local staff implementation; file hashes are in `onboarding-arc-provenance.json`. Only the surrounding wizard layout is new.

The local Pro multi-step demo was inspected at its details/owner steps, including forward navigation and the owner menu. The standalone free-component catalog could not load its missing catalog-all.json. Source identity and integrated interactions were checked; exact visual parity with every standalone free demo is not established.

## Module access

Core patient/catalogue/booking/clinical functionality stays included. Four optional operations selections are offered: Billing, Inpatient, Pharmacy & inventory, HR & staff. Inpatient adds Billing; Pharmacy adds Inventory. Removing Billing also removes Inpatient. Core-only is valid.

`clinicModules` survives draft recovery, the exact idempotent POST, job claim, production/local provisioner environment and tenant bootstrap. Customer entitlements reflect the selection and plan changes preserve it. Backend validation rejects unknown, duplicate and inconsistent selections. Existing callers without this field retain their old module entitlements. Explicit empty selection grants none of the optional operations modules.

Selected operations modules are initialized as `configured`, not `active`. Their existing administrator activation gates remain. This change does not add staff screens for these backend modules or activate voice/WhatsApp providers.

## Provisioning

The status page renders checking, queued, provisioning, failed and ready from the authenticated status endpoint. The API's initial response now accurately says queued. A queued request has not finished creating a website; a working request does not show a fabricated percentage or complete checkmark. Website/workspace cards show the registered template, request slug and server-assigned target URL when configured. Links only appear after server-confirmed ready and HTTPS URL validation.

Recovery persists the same request ID/token, idempotency key and payload. Temporary credentials remain in memory and never browser storage. Poll requests do not overlap; terminal states stop automatic polling and provide a manual status check. A provisioning failure is not silently resubmitted.

## Verification

- Production export and platform/root TypeScript checks pass.
- 24 website tests pass, including module dependencies, legacy payload recovery, inline step validation and truthful provisioning stages.
- 8 focused control-API/production-input/bootstrap tests pass against isolated PostgreSQL on port 54429. They verify saved selections, claims/completion, plan-change retention and configured-only tenant module rows.
- Browser checks: inline invalid-field focus; facility select keyboard/Escape focus return; plan keyboard selection and disabled voice on Launch; template choice; module dependencies/count; consent gating; lost POST response and identical-key/payload retry; reload; queued/working/failed/ready presentation; no links before ready; no temporary password in storage.
- The exported website submitted a real request to an isolated local control API and persisted/recovered queued status without page errors. No host provisioner or VPS deployment was invoked. Working/failed/ready browser states used explicit test responses; real database claim/completion was exercised in backend tests.
- Desktop and 390px targeted captures have no horizontal overflow. Exact standalone demo parity and provider/live tenant acceptance remain outside this verification.
- Search audit was not applicable to this noindex local build: it requires an approved canonical origin and indexing flag, which were not invented for onboarding review.

Local preview: http://127.0.0.1:5193/onboarding . It uses the isolated control database `hms_onboarding_preview`; AUTO_PROVISION and AUTO_VOICE_PROVISION are off. New requests stay queued until a real provisioner is configured.

## Consolidated selection and website examples

Modules and plan/channels share step 4. Optional modules and channels use whole-tile toggle buttons with aria-pressed, supporting multiple selections without checkbox chrome. Explicit consent remains on Review. Website selection is step 5 and shares the quote template grid. Preview links and selection radios are separate controls, so opening an example does not silently change the selection. Both examples open same-origin noindex pages in a new tab; they have no patient form, real availability, provider calls or booking writes. They illustrate a layout rather than promising an exact rendering of a deployed tenant.

A fresh supported quote template overrides an older draft once. Later onboarding template edits survive reloads; submitted/recovering requests retain their exact payload. The large generic provisioning clock and final quote sparkle badges have been removed.

Follow-up verification: production export (33 generated pages), TypeScript and 24 website tests pass. Browser checks covered multi-select via pointer and Space, module dependencies, no module/channel checkboxes, Launch voice restriction, a quote preference replacing a stale draft once, later template edits surviving reload, both example routes and new-tab navigation, desktop/390px website selection, removal of both marked badges, and the complete consent/submission/reload flow against the isolated control API. The local worker remains off, so requests stay queued. Example pages have no live booking integration.

## Paperwhale hosting integration (24 October 2026)

The existing local onboarding changes were carried into the Paperwhale deployment branch without replacing the production request/recovery contract with the older demo OTP flow. Shared module parsing is included in the website Docker build inputs; template example routes keep noindex response headers even when public marketing indexing is enabled.

Current integration checks: 36 website tests, 9 focused control/provisioning tests against an isolated temporary PostgreSQL server, root and website TypeScript checks, and the 40-page SSR build passed. The imported account validation/focus, facility selector dismissal/focus return, and module dependency selection were exercised locally. The public VPS website is separate from the still-pending control API, Keycloak and tenant provisioner installation; workspace creation must show an unavailable response until those services are installed.

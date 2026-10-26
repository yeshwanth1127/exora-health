# Swastikaa template verification — 26 October 2026

## Executed locally

- Swastikaa website, staff dashboard and platform production builds pass. Root API, website and platform TypeScript checks pass. Bundlers report advisory chunk-size warnings; the runtime `website-config.js` script is intentionally served by the API.
- 58 backend checks pass across website settings/profile, public booking, static template serving, onboarding/provisioner validation and voice regression suites. New checks exercise the enquiry inbox, concurrent idempotent recovery, payload/origin restrictions, staff permissions, stale versions, tenant isolation, signed preferences, tampering/expiry and no reservation created by a preference.
- 33 website tests pass: the existing 30 UI flows plus persisted tenant identity/live catalog and slots, no appointment form, inactive assistant handling, no demo fallback on catalog failure, and enquiry recovery with the original idempotency key.
- 9 targeted staff settings/intent tests pass.
- 30 platform tests pass, including Swastikaa quote/setup handoff retaining another entered hospital name.
- Browser evidence used an isolated test PostgreSQL instance on port 54437 and a synthetic River Hospital tenant on port 5256. The production template bundle loaded that persisted name and published doctor, then displayed real database slots at ₹800 for the published session. Selecting one reached the form-free assistant handoff and explicitly reported the inactive provider. No appointment was claimed or created.
- A browser-submitted synthetic enquiry was received, appeared in Workspace settings → Website, and was marked reviewed. Saving the demo checkbox persisted through a website reload: all six sample doctors returned while the header retained River Hospital. Screenshots in `backend/` contain only synthetic local data.
- The built onboarding flow was exercised through its review step with Swastikaa selected and River Hospital retained; no workspace creation was submitted from that static preview. The preserved Swastikaa demo was inspected at port 5254, and its actual screenshot supplies the onboarding template preview. Earlier desktop/phone UI checks are recorded in `reference-flow-audit.md` and previous QA captures.

## Evidence limits and release status

Source registration is complete for template ID `swastikaa`, including both image build paths and both provisioners. Production publication has not been performed: the documented compute host `10.0.0.5:22` timed out from this machine. A local green build is not proof that running platform/control/tenant images or the installed provisioner have been updated. Docker is not available in this local environment, so a container-image build was not executed.

No real Sarvam conversation, microphone access, recording, email, WhatsApp message, payment or production patient operation was performed. Actual managed-agent activation and its booking tools require provider verification. Clinical sample records were not seeded. Demonstration data stays on by default; live operation requires saved publication settings, real published profiles/fees/sessions and an activated assistant.

Elizabeth/reference layouts remain handbuilt and adapted as documented in `reference-flow-audit.md`; exact pixel/animation parity is not claimed. Existing Sri Lakshmi and NDR source apps remain unchanged.

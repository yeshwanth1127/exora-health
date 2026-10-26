# Hospital template library verification

Branch: `codex/hospital-template-library`. Local review only; no production tenant was created or deployed.

## Executed

- Shared hospital website: 50 passing tests, including the original Swastikaa cases, all three new compositions, navigation/Escape focus, care routes, form-free slot selection, named previews, live profile/roster bindings and mismatched runtime rejection.
- Platform: 33 passing tests. All three template IDs survive intake and workspace payload validation while retaining the entered facility name.
- Root TypeScript, shared package TypeScript, platform TypeScript, hospital host production build and platform static production build pass.
- API and provisioning: 46 passing tests. Contracts exercise shared static serving/configuration, saved website content, new template provisioning claims, name retention and production shell input validation. PostgreSQL runs in an isolated `/tmp` cluster on port 54438.
- Browser: inspected the three desktop homepages, Pathway phone layout, Atlas phone layout, Grove phone layout, expanded mobile navigation and care menu, Grove service-to-slot handoff, Atlas scan detail and the template gallery. Fixed care-menu horizontal overflow, compact header wrapping and the selected-slot scroll jump. Named previews also retain their template and identity in link hrefs, including new-tab/reload behavior.
- Browser onboarding: entered local sample account/facility details, verified all seven options, selected Atlas and reached review with Riverbend Hospital retained. No workspace submission occurred.

## Evidence and limits

`qa/` contains the actual template-library screenshot, Pathway phone screenshot, selected-slot phone screenshot and onboarding review screenshot. Each new template thumbnail comes from its rendered local homepage. The reference sources are linked in the package README.

No provider calls, production deployments, live appointments, insurer eligibility or clinical records were created. Live tests use API fixtures and local database contracts; they do not prove provider delivery. The three layouts are reference-informed compositions, not Ditto captures or exact reference-site copies. Existing adopted Arc source and integrations were moved into the shared package; this task does not claim a fresh exhaustive parity audit of every vendor component and state.

Vite reports the existing large-bundle warning (the shared engine includes adopted Pro bundles and voice code). The build passes; reducing that bundle is separate performance work.

# Hospital website component library

This package hosts the patient website runtime, Arc primitives and adopted Pro integrations, reusable page/section components, and template compositions. `apps/hospital-community-web` is the Vite asset host. The same build serves Swastikaa, Pathway, Atlas and Grove. Sri Lakshmi and Editorial remain separate applications.

## Preview and develop

From HMS_NEW, run `pnpm swastikaa:dev`. Open `/__templates` for the three new templates and `/__components?template=hospital-pathway` for the rendered section catalog. These are development-only routes. Use `?template=hospital-atlas&name=Example%20Hospital` for a named local demonstration. Production ignores these query overrides.

## Reuse instead of copying

- `src/vendor/arc` and `src/components`: existing Arc controls and adopted Pro adapters, plus Sri Lakshmi insurance and department integrations. Preserve vendor geometry, interaction and motion contracts.
- `src/sections`: data-bound navigation, patient actions, care directories (index/mosaic/spotlight), consultants (cards/list/spotlight), diagnostics, insurance, plans, location, FAQs, patient journey and footer. Empty and failed data stay explicit.
- `src/ui/components`: individually exported shared pages and the original Swastikaa composition.
- `src/ui/reference/components`: service, treatment, scan, consultant directory/profile, pricing and related-care components.
- `src/ui/reference/Schedule.tsx` and `LiveSchedule.tsx`: shared form-free slot preference and managed assistant handoff. Selecting a time does not reserve or confirm it.
- `src/templates/layouts`: page composition only. Import shared sections; do not fork data loading, booking or whole applications.
- `src/ui/Runtime.tsx`: the only tenant data adapter. Components use `useWebsite()`; they never fetch or invent tenant data themselves.

Public entry points: `@hms/hospital-web`, `@hms/hospital-web/components` and `@hms/hospital-web/styles.css`.

## Add a template

1. Compose a new home layout from exported sections and add only scoped design tokens/layout rules. Keep applicable Arc demo contracts intact.
2. Add a template ID and metadata in `packages/website-templates/src/index.js` and its declaration file. Register its composition in `TemplateHome`. The registry feeds the chooser, validation, local provisioner and static asset selection.
3. Update the production shell allowlist (the shell cannot import the JS registry); run `provisioner-input.test.ts` to verify parity.
4. Capture the actual rendered thumbnail into the website host and platform `public/templates` directories.
5. Verify every care, consultant and booking route, entered hospital identity, empty/live/demo behavior, responsive layout and disclosure keyboard behavior. Run package and onboarding contracts.

## Runtime and backend

Onboarding persists the selected ID and entered facility name. Provisioning sets `WEBSITE_TEMPLATE` and a booking-site binding. The tenant serves `/website-config.js` with that binding and the new template ID; `/public/v1/website` must match both. All four shared-engine templates use the existing content store (`website.swastikaa`, retained for compatibility), published doctor catalog, availability and managed assistant APIs. No extra database or per-template backend is created.

New accounts retain labelled sample content by default. Switching to live mode uses saved content and published clinical records; it never seeds sample doctors or fake bookings. Do not equate local UI or contract tests with a deployed tenant or successful provider call.

## Design references

- Pathway: [Spire Healthcare](https://www.spirehealthcare.com/) patient task navigation and framed image hierarchy.
- Atlas: [HCA UK](https://www.hcahealthcare.co.uk/) photographic lead and specialist discovery.
- Grove: [Cromwell Hospital](https://www.cromwellhospital.com/) consultant-led, spacious editorial hierarchy.

These are reference-informed compositions, not Ditto captures or pixel-identical clones. Photography and insurer assets reuse files already present in the project. No additional remote assets were downloaded.

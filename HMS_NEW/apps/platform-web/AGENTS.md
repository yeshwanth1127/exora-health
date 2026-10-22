# Website development

This is a static Next.js App Router marketing website. Use `npm run dev`, `npm run build`, `npm run typecheck`, and `npm test` from this directory.

## Shared brand

`src/lib/brand.ts` owns the editable product name. Import `BRAND_NAME` for React copy and metadata. Use `brandContent` only for static saved HTML/JSON. Do not rename CSS namespaces, storage keys or asset paths to change the visible name.

## Implementation boundaries

- Keep route markup, shared components, styles and public assets in their existing areas.
- Preserve identifiers shared between generated JSX, styles and the navigation runtime.
- Keep Arc dashboard components faithful to their selected local reference demos; change their application labels/data through bindings.
- Preserve reduced-motion support, keyboard navigation and visible disconnected states.
- Do not claim an account, submission, booking or provider connection succeeded without its real application result.
- Keep original illustration assets and generation prompts; use optimized versions on the site.

## Verification

Build and run relevant tests after changes. Inspect changed layouts in the browser. A successful build does not establish live backend behavior or deployment.

## Integrated platform

This application now posts setup to the control API. Preserve idempotent recovery, real status polling, registered template IDs, provider readiness distinctions and in-memory-only temporary credentials. See `ARCHITECTURE.md`. The prior local-only account/OTP flow has been replaced.

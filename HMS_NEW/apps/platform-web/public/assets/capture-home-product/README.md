# Home and Product illustration options

Only `/` and `/product/features` were refined in this pass. Other routes keep the previous pass.

- **A — People + tools:** default. Independent close-up portraits; simple objects at icon sizes; three separately generated PNGs compose workflow/team header art.
- **B — Objects only:** append `?art=objects` to either route. One clear object per section.
- Comparison board: `/assets/capture-home-product/index.html`.

Six independent imagegen calls produced two portraits, a patient-record folder, a magnifier, a next-step card and a staff badge. Original generated files are copied to `web/public/assets/capture-home-product/`. Each is a 1254px transparent PNG, with alpha ranging from 0 to 255. No cropping, background removal or compositing was applied to these source images. Composition is controlled in the webpage, with `CaptureArtwork.tsx` choosing independent parts.

`home-product-outputs.json` records exact prompts, input references, transparency and original generated file paths. The downloadable `capture-home-product-pack.zip` includes all six PNGs, reference copies, placement options and the prompt record. Reference portraits guide the sparse ink style; outputs are original Capture subjects.

Corrected the previous Product responsive-source bug: a small header illustration could be chosen by the browser as the large panel's srcset. Large panels now derive srcset exclusively from their own panel asset and preserve a 3:2 ratio. Home's small use-case slots no longer contain miniature dashboard screenshots. Home's feature compositions use a separate concept panel and separate illustration; scenario cards no longer apply photo colour filters to drawings. The repeated tiny workflow-logo substitutions became one legible native workflow row.

This is an illustration review. Large dashboard panels still use editable synthetic concept SVGs; remaining reference feature copy, prices, claims and destination links need a separate content pass. No publication or deployment was performed.

Backups of the affected original source files are in `home-product-backup/`. Do not run earlier bulk rebrand scripts over this refinement without preserving these changes; their slot assumptions predate this pass.

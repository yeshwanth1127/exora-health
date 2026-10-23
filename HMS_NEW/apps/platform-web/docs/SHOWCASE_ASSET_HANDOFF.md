# Healthcare showcases — artwork handoff

The new pages use the existing site's typography, blue accents, white background, rounded surfaces and alternating text/artwork rows. The user subsequently requested generated hero artwork. Four new hero illustrations now fill labs, dental, physiotherapy and teleconsultations; workflow and starter illustrations remain reserved for the Claude Design file.

## Pages

- `/labs-diagnostics`: enquiries and approved preparation instructions; appointments and arrivals; administrative follow-ups and report enquiries.
- `/specialties/dental`: first enquiry and consultation; treatment appointments; reminders and recall conversations.
- `/specialties/physiotherapy`: assessment booking; ongoing sessions and attendance; reminders and patient replies.
- `/solutions/teleconsultations`: arranging a remote appointment; the configured joining workflow; administrative follow-up.

Clinics (`/teams`) and hospitals (`/enterprise`) retain their existing hero and workflow artwork. Both use the same shared page component as the new audience/specialty pages. Their existing large assets have not been regenerated or replaced.

## Slot integration

`src/lib/showcase-artwork.ts` is the artwork registry. Each slot has a label, width, height and nullable `src`. For image deliverables, place the approved file under `public/assets/showcases/`, set the corresponding registry `src` to `/assets/showcases/<file>.webp`, and retain its real aspect ratio/dimensions. The existing `IllustrationSlot` component supplies the layout and alt text.

An HTML/CSS or SVG composition supplied by Claude can instead be integrated at the same named `data-artwork-slot`. Keep styles scoped and adapt it to the site's existing CSP. Never iframe an unreviewed HTML file or add unsafe script execution. The file format will determine that final adapter once it is supplied.

Each slot is independent. Do not combine all stages into one huge illustration. Default frame: 1200 × 800 (3:2), rendered around 440px wide in a desktop hero or 540px wide in a workflow row; mobile frames fill their container without text clipping. Copy remains real HTML outside the artwork.

| Prefix | Hero | Workflow 1 | Workflow 2 | Workflow 3 |
| --- | --- | --- | --- | --- |
| `labs` | A diagnostic-centre front desk | Enquiries and preparation information | Appointments and arrivals | Administrative follow-ups and report enquiries |
| `dental` | A dental-practice front desk | Enquiry to consultation | Treatment appointment coordination | Reminders and recalls |
| `physiotherapy` | A physiotherapy practice | Initial assessment booking | Ongoing session coordination | Attendance and follow-ups |
| `teleconsultations` | Remote appointments in the clinic day | Arrange the visit | Joining a configured consultation | Administrative next steps |

Keys are `<prefix>-hero` and `<prefix>-workflow-1`, `-2`, `-3`, plus `<prefix>-starter-1` and `-starter-2` for labs, dental and physiotherapy (23 independent slots, including the shared `teleconsultations-callout` slot). The two starter slots reserve the same 3:2 artwork space as existing clinic/hospital cards. The product overview reuses `teleconsultations-workflow-2` in its supporting-module card. The remote-care callout on the five audience pages has its own independent `teleconsultations-callout` slot, ready for future artwork.

## Content boundary

These are marketing workflow showcases with no backend calls or account creation. They do not add a laboratory information system, report authoring, dental charting, treatment planning, exercise prescription or live video connection. Existing connected services require their actual configuration. Clinical decisions remain with the healthcare team.

## Implementation and verification

Navigation data lives in `src/lib/site-navigation.ts`; the desktop/mobile disclosure menus are assembled from it in `navigation-menus.ts`. The footer and illustrated discovery cards use the same links. The homepage audience selector has been removed at the user’s request. New pages have metadata, sitemap/llms registry entries and allowlisted analytics paths. Temporary-preview noindex remains enabled. Analytics still requires its project token and consent.

Run `npm test`, `npm run typecheck` and `npm run build:public`. Verify each new page at desktop and mobile widths; exercise selector tabs with mouse, Arrow keys, Home/End; open/dismiss desktop and mobile menus; check FAQ disclosure and all new links. Publish only the sanitized `dist` output using the existing static deployment process.

Verified locally: production static export, TypeScript and 12 existing tests pass. Eight affected routes were checked at 1280px and 390px without horizontal overflow, broken images or forms. Internal links in all exported HTML resolve. The audience/specialty pages each have six page-specific artwork slots plus the shared teleconsultation callout; teleconsultations has four page-specific slots. Desktop disclosure menus, Escape/focus return, mobile navigation, homepage organisation selection and FAQ expansion were exercised. The patient-journey strip was removed from the four new pages. FAQs now share animated, keyboard-accessible disclosures across audience, product, pricing and help pages. Illustrated discovery cards use five generated blue-accent icons; Help & updates occupies an equal third menu column. This work has not been uploaded to the public VPS; the existing public release remains intact pending the supplied artwork.

## Hero artwork and research cards (22 October 2026)

The four generated hero images and their exact prompts are documented in `docs/assets/solution-heroes-v1/README.md`. Optimized alpha-preserving WebP files live in `public/assets/showcases/heroes-v1/`; all originals remain in the asset documentation directory. Heroes load eagerly; workflow illustrations remain lazy-loaded. Existing clinic/hospital artwork is preserved.

The former three rollout cards are replaced by the shared `ResearchBenchmarks` component on audience and product solution pages. Cards display general published study figures beneath a header identifying appointment-reminder research. At the user’s request, cards show only their large figure and outcome label; study links, comparator details and limitations are retained in the research documentation. No invented customer count or outcome is used. See `docs/RESEARCH_BENCHMARKS.md`.

# Sri Lakshmi client demo

Source snapshot: **3 October 2026**, [slsshospitals.com](https://slsshospitals.com/).

Branch: `codex/sri-lakshmi-demo`. The separate managed worktree preserves the dirty primary checkout. Commit `c1f32ba` captures the current website baseline before personalization.

## Presentation

Keep the existing layout, typography, colors, grids, spacing and homepage order. Personalization changes images and copy. The existing accreditation logo rail and Bangalore map are retained. The only requested additions are:

- About Us, using the existing information-page layout, at `/about/`.
- A five-photo hospital bento directly above the blogs in both homepage modes.
- A separate From the founder screen at `/founder/`, linked from About Us, its navigation submenu and the footer. The existing homepage video area stays in place.

The official hospital emblem appears beside the name in the header and footer, in the mobile menu and sample sign-in, and as the favicon/touch icon.

The follow-up audit identified 18 unique YouTube links in the source video gallery. Their playback and suitability for a founder/doctor clip remain unverified; the existing showcase currently uses profile previews. See `content-gap-audit.md` and `audit/video-links.json`.

## Collected material

| Material | Snapshot |
| --- | --- |
| Published pages | 56 HTML source files plus extracted text in `pages/` |
| Source files retained locally | 351 distinct photos, logos, illustrations and source CSS files under `public/clients/sri-lakshmi/` |
| Public CMS media catalog | 4,729 returned records in `media-inventory.json`, with 48 raw response pages in `inventory/` |
| Doctor roster | 17 published names, specialties and individual portraits |
| Departments | 20 source departments |
| Hospital group | 4 published locations, addresses, contacts and pictures |
| Health packages | 8 published one-time prices |
| Demo insurance labels | 4 local SVG text labels for named public schemes, in addition to sourced insurer assets |

`manifest.json` records source URLs, retained paths, sizes and SHA-256 checksums. It maps redundant resized WordPress variants to retained originals and records their original download provenance. The CMS catalog includes additional and historical uploads; these are inventoried, rather than all downloaded into the demo. No PDFs were returned in that catalog.

The upload-path keyed catalog in `src/data/clientAssets.ts` distinguishes filenames repeated across different months. The linked-source collector is `scripts/client-demo/collect_sri_lakshmi.py`; it does not reproduce the subsequent full CMS pagination and variant consolidation passes by itself. Refresh into a separate snapshot before replacing this reviewed archive.

## Published prices

Source: [Health packages](https://slsshospitals.com/health-packages/). Current offers and package inclusions require hospital confirmation.

| Package | Published price | Published original price |
| --- | ---: | ---: |
| Diabetic Check Up | ₹749 | ₹1,000 |
| Fertility Health Check Up | ₹3,699 | ₹4,955 |
| General Diabetic Health Check Up | ₹2,399 | ₹3,955 |
| Advance Health Check Up | ₹2,699 | ₹3,955 |
| Antenatal Profile | ₹3,199 | ₹4,955 |
| General Health Check Up | ₹3,999 | ₹4,955 |
| Complete Health CheckUp | ₹8,599 | ₹9,955 |
| Cardiac Health Check Up | ₹2,500 | ₹4,955 |

These are check-up packages, not monthly or annual subscriptions. The homepage rail retains its original layout and uses “Essential checks” / “More checks” to browse packages.

## Source decisions and gaps

- [About](https://slsshospitals.com/about/): founded in 2002 by Dr. Sambashiva; 50 beds; accessible and affordable care; founder portrait and published message. The founder screen includes the official Dr. Sambashiva hospital-introduction video and a summary of his published message.
- [Medical team](https://slsshospitals.com/our-professional/): source names and roles only. Individual qualifications, consultation fees, schedules, ratings and review counts are not published. Empty/zero data values mean unknown; the interface asks patients to confirm with reception.
- [Locations](https://slsshospitals.com/our-locations/): use each location’s specific picture and contact details. Group locations do not imply a shared doctor roster or booking integration.
- Main contact: +91 99017 11716; additional number +91 74067 99991; lakshmihospital@yahoo.co.in. The source header lists “#301, 3rd Cross, Old Extension, KR Puram”; the map/address block says “301, 3rd Main Rd, near Indane Gas, V B Layout, Old Extension.” Both source variants are preserved in this archive.
- [Cashless insurance](https://slsshospitals.com/cashless-insurance/): published insurer names include Star, HDFC ERGO, ICICI Lombard, Bajaj Allianz and Max Bupa. Eligibility, affiliations and current approvals need confirmation.
- No hospital accreditation certificates were established from the source. The restored rail is the existing demo presentation; its logos are not verified certifications of this client. The retained Bangalore illustration is a schematic from the existing layout, not navigation directions.
- Conflicting “20/25/30/35 years” claims, zero counters, placeholder text, unsupported credentials, fabricated testimonials and medical service promises are not treated as source facts. Hospital facility images fill the existing testimonial presentation.
- Hospital-approved legal policies are not supplied. Policy screens retain their layout and identify missing approved content.
- Appointment buttons now open the existing local walkthrough by default in this client branch, including direct `/schedule/` and `/book/` links. Sample dates, slots and demo verification remain explicitly labelled, and the final screen says no appointment is reserved or message sent. Set `VITE_BOOKING_MODE=live` only when the client backend is configured; that mode retains the existing authoritative `/book/` integration. The baseline backend integration suite requires a build with `VITE_BOOKING_MODE=live`. This branch does not provision Sri Lakshmi doctors, schedules or patient records in a backend. No real booking, message, deployment or provider delivery was performed.

## Local review

```sh
npm run dev -- --host 127.0.0.1 --port 5186
npm run build
npm run test
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/playwright npx playwright test -c tests/client-demo/preview.config.ts
```

The build keeps the existing SEO launch gate closed and the preview noindex. Browser coverage includes desktop Chromium, a 320px phone, and iPhone WebKit; both homepage modes, image loading, overflow, package toggles, About navigation, founder navigation, all doctor and department details, and remaining information routes. Captured screenshots are in `qa/`.


## Community, insurance and facilities expansion — 4 October 2026

- `/community/` (also `/community-events/` and `/media/`) provides 12 sourced hospital/community photographs, category filters and a native full-screen photo viewer with keyboard navigation, Escape dismissal and focus restoration. All five homepage bento photographs open this screen.
- Six official-channel films are curated from the hospital’s [Video Gallery](https://slsshospitals.com/video-gallery/). The selected recording mounts a YouTube privacy-enhanced embed only after a play action; changing recordings stops the previous player. The founder introduction also replaces the previous homepage play-message placeholder and appears on `/founder/`. Group branch films and event photographs have separate location/context labels; event dates and unverifiable achievements are not invented.
- `audit/video-metadata.json` records titles and channel attribution retrieved from YouTube oEmbed for all 18 linked clips. Six actual YouTube thumbnail files are retained under `public/clients/sri-lakshmi/videos/`, with URL/checksum provenance in `audit/video-posters.json`.
- `audit/youtube-live-check.json` records actual playback of `3HTtj5NBA4w`: video time exceeded one second, readyState was 4, and the player was unpaused. This verifies one official video’s playback in the local Chromium environment, not availability of every recording on every network or device.
- `/packages/` shows all eight one-time package prices and original prices from the source page. Full test inclusions, preparation, consultation benefits and offer validity remain hospital-confirmation items; they are not fabricated.
- `/insurance/` explains the published five-step cashless workflow, insurer/scheme labels, documents to discuss with the desk, pre-authorization, final settlement, copays/exclusions and FAQs. Documents are presented as preparation for the conversation rather than an asserted universal hospital checklist. Live eligibility is handled by the desk.
- `/facilities/` describes the published Philips FD10 cath lab, 100-watt Holmium laser, 10-bed ICU, 10-bed dialysis unit, modular OT and echo/ultrasound services. Unconfirmed scanner specifications and robotic-system claims are excluded. Six existing specialty pages have richer service descriptions using the archived source pages.
- Existing homepage layout/order, accreditation presentation and Bangalore map are retained. New navigation entries link to the new destinations. The appointment walkthrough and official hospital logo remain in place.

Validation: production build and 47 unit tests passed. The 24 browser cases cover desktop Chromium, 320px Chromium and iPhone WebKit, including both homepage designs, all 17 doctor/20 department routes, appointment walkthrough, the new media/photo interactions, all packages, cashless guidance and equipment links. Failed selector assertions were corrected; the native photo viewer explicitly restores focus for WebKit. The nine affected browser cases were rerun successfully after these fixes. Embed interaction tests use a fixture to isolate the interface; actual founder playback was verified separately. Screenshots in `qa/` were visually reviewed at desktop/phone widths. This remains a local client demo, not a live hospital booking or production deployment.

# Avocado Health UI screen map

This repository is a frontend prototype. Routes, filters, bookings, sign-in, doctors, prices, and clinic details use local data and UI state. The screens below are complete as navigable designs; they are not connected to a clinical, scheduling, identity, or insurance backend.

## Patient journey

| Journey | Screen and URL | Current state | Design reference |
| --- | --- | --- | --- |
| Discover care | Home `/` | Original homepage is the default; Light Green is a complete alternate homepage selected in Display Settings | Original Avocado components; [Tia homepage](https://asktia.com/) for light treatment |
| Browse care | Departments `/?page=departments` | Searchable specialty cards | [Tia services](https://asktia.com/) |
| Understand a specialty | Department `/?page=department&id=cardiology` | Services, clinicians, questions, related care | [Tia primary care](https://asktia.com/services/primary-care/) |
| Find a clinician | Doctors `/?page=doctors` | Name, specialty and clinic filters | [Tia virtual care team](https://asktia.com/locations/tia-virtual-clinic/) |
| Check a clinician | Doctor profile `/?page=doctor&id=doc-1` | Existing profile and schedule CTA | Existing Avocado profile flow |
| Start from a concern | Care search and results `/?page=results` | Existing search and questionnaire flow | Existing Avocado care search |
| Choose a visit | Schedule `/?page=schedule&doctor=doc-1` and booking modal | Existing frontend booking steps | Existing Avocado booking flow |
| Find a clinic | Locations `/?page=locations` | Physical and virtual care cards | [Tia locations](https://asktia.com/locations/) |
| Plan a clinic visit | Location `/?page=location&id=indiranagar` | Location summary and clinicians listed there | [Tia clinic detail](https://asktia.com/locations/culver-city/) |
| Understand cost | Insurance and pricing `/?page=insurance-pricing` | Coverage questions and illustrative plans | [Tia cash prices](https://asktia.com/tia-service-list/) |
| Understand the process | How care works `/?page=how-it-works` | Four-step journey, with links to each step | [Tia homepage care journey](https://asktia.com/) |
| Ask for help | Contact `/?page=contact` | Call, booking and clinic links | [Tia locations](https://asktia.com/locations/) |
| Self-service reading | FAQ `/?page=faq`, blog `/?page=blog`, article `/?page=blog-post&id=...` | Existing content screens | Existing Avocado screens |
| Policies | Legal hub `/?page=legal`, policy `/?page=legal&doc=terms` | Existing legal screens | Existing Avocado screens |
| Account access | Login modal | Existing frontend flow | Existing Avocado flow |

## Design options

The gear is available on every screen and offers two sitewide modes: **Original** and **Light Green**. The selected mode is saved locally in the browser. Original uses the preserved homepage, search results, and appointment layouts. Light Green uses their updated counterparts. The pictured navigation, compact Light Green footer, preview and emergency announcement, department pages, and doctor pages are shared in both modes. The original component files remain in place; old mixed per-section choices are no longer applied. Original-only homepage sections are shown only in Original mode.

Shared navigation follows the supplied Tia screenshot's arrangement: text links with small menus on desktop, a solid Book now button, and an outlined Log in button. Narrow screens use a horizontal link row instead of a hamburger menu. The announcement includes the preview disclosure and emergency number. The footer is limited to useful navigation and legal links.

## Backend and content handoff

- Replace demo doctor biographies, credentials, portraits, availability, fees, and reviews with verified records.
- Supply actual branch addresses, hours, services, accessibility, and directions. The new location detail screen deliberately does not invent these fields.
- Connect appointment search, slot reservation, patient identity, insurance eligibility, and payment to the backend before presenting them as live.
- Audit all existing claims before public indexing: accreditation, insurer relationships, clinic registration, 24/7 coverage, outcomes, patient counts, testimonials, discounts, and treatment claims currently appear in prototype content. A visually complete page is not evidence for any of these claims.
- Add per-page titles, descriptions, canonical URLs, structured data, and server-rendered or prerendered HTML after the verified content and final routes are agreed. The current Vite SPA is a UI preview, not an SEO-qualified site.

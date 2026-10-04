# Client content gap audit

Reviewed 3 October 2026 against the Sri Lakshmi public website and the demo on `codex/sri-lakshmi-demo`. This is a content comparison, not verification of installed equipment or current clinical capacity.

## Highest-value gaps

| Priority | Published content | Current demo | Recommended placement |
| --- | --- | --- | --- |
| 1 | Dedicated Services & Facilities page and individual facility pages | No dedicated facilities destination. Some facts appear in the original-mode facility carousel; light mode omits that carousel. | A Facilities & Technology screen linked from the existing About Us submenu. Reuse the current information-page styling. |
| 1 | Philips FD10 cardiac cath lab | Mentioned in the original-mode carousel, but absent from the cardiology page and light homepage. | Cardiology copy and a clearly labelled cath-lab card on the facilities screen. |
| 1 | 100-watt Holmium laser for kidney stones/prostate care | Urology mentions Holmium laser procedures without the specific published capability. | Urology equipment/service copy; facilities screen. |
| 1 | 10-bed ICU, 10-bed dialysis unit, modular OT, echo/ultrasound | Dialysis and imaging appear generically; ICU capacity and modular OT are not clearly presented. | Facilities screen and relevant department pages; more specific captions in the existing hospital bento after matching photographs. |
| 1 | Public video gallery with 18 unique YouTube links | Showcase play buttons currently display a “not published” message. The clips have not been reviewed to determine which feature each doctor or founder. | Review the linked clips, then connect appropriate videos to the existing video area. Keep its homepage position. |
| 2 | More detailed cardiac, urological, gynecological and other procedures | Current department data largely uses short summaries and a few service bullets. | Expand the existing department content blocks, without changing layouts. |
| 2 | Eight published health packages | All eight are captured in data. Six appear across the rail’s two states; the cardiac and complete packages are only mentioned in the closing text. The pricing page reuses this rail. | Make all eight easy to browse on the pricing screen. Obtain exact tests, preparation and validity from the hospital. |
| 2 | Cashless treatment workflow and named government schemes | Insurer/scheme labels are in the homepage rail; the insurance screen is mostly generic reception guidance. | Add the hospital’s document/pre-authorization/discharge process to existing insurance copy. Confirm scheme names and eligibility with the desk. |
| 3 | Event and community photographs in Media & News | Current resources are editorial drafts; the hospital bento shows only five facility photos. | A small media/gallery destination or selected event photographs with approved captions. |

## Equipment and infrastructure evidence

| Item | Source statement | Confidence for demo copy |
| --- | --- | --- |
| Philips FD10 cath lab | Explicit model on the [homepage](https://slsshospitals.com/); a separate [cath-lab page](https://slsshospitals.com/cardiac-cathlab/) describes digital imaging, angiography, angioplasty and stents. | Clear published claim; confirm current operational availability. |
| 100-watt Holmium laser | Explicit power/type on the [homepage](https://slsshospitals.com/). | Clear published claim; confirm current operational availability. |
| 10-bed ICU | [ICU page](https://slsshospitals.com/10-bedded-icu/) lists monitors, ventilators, infusion pumps, dialysis machines and defibrillators. | Clear published capacity/equipment list; individual device makes/models are not supplied. |
| 10-bed dialysis unit | [Dialysis facility page](https://slsshospitals.com/10-bedded-dialysis/) names hemodialysis machines and a dedicated unit. | Clear published capacity; machine makes/models are not supplied. |
| Modular operating theatre | [Modular OT page](https://slsshospitals.com/modular-ot/) describes HEPA filtration and laminar airflow. | Include the modular OT facility; confirm detailed specifications and robotic tools before featuring them. |
| Echo and ultrasound | Dedicated [imaging facility page](https://slsshospitals.com/echo-ultrasound/). | Clear published services; specific machine models are not supplied on this page. |
| CT, 3-Tesla MRI, digital X-ray, 4D ultrasound | [Radiology page](https://slsshospitals.com/radiology/) lists these capabilities. It also includes gynecology/obstetric headings and unrelated fibroid content. | Client confirmation needed before asserting installed equipment, scanner specifications or on-site availability. |
| da Vinci robotic surgery | [Urology page](https://slsshospitals.com/urology/) names the system but also includes unrelated memory-disorder content. | Client confirmation needed before featuring this device or capability. |

The site's facilities index also lists 24/7 emergency/trauma, pharmacy, laboratory and IPD/OPD. The demo already communicates several of these. Hospital opening hours should not be presented as every specialist being available around the clock.

## Procedure detail worth restoring

- Cardiology: the source lists Holter monitoring, catheterization, coronary angiography, angioplasty/stenting, pacemaker implantation and other interventions. The demo already includes ECG, echo, stress testing and angiography, but the fuller treatment list is missing. [Source](https://slsshospitals.com/cardiology/).
- Urology: the source describes cystoscopy, ureteroscopy, TURP, laser lithotripsy, PCNL and urodynamic testing. Confirm the exact current procedure roster before expanding the generic urology blocks. [Source](https://slsshospitals.com/urology/).
- Women's care: antenatal/postnatal care, breastfeeding support, childbirth classes, delivery rooms and NICU are described on the source page. Confirm which hospital location provides each service; the group has a separate Mother and Children Hospital. [Source](https://slsshospitals.com/gynecology-obstetrics/).

## Media findings

The HTML of [Video Gallery](https://slsshospitals.com/video-gallery/) contains 18 unique YouTube URLs, including two live-video URLs. They are saved in `audit/video-links.json`. YouTube playback was not verified: the web tool encountered a challenge/throttling on sampled links. The prior blanket assumption that source video content was unavailable was incomplete; a founder-specific recording remains unidentified.

[Media & News](https://slsshospitals.com/media-news/) contains event images despite little extractable text. One inspected photo shows the hospital group at an event with a Worldwide Book of Records **certificate of attempt**. This should not be described as an achieved world record or accreditation without supporting evidence. Its image is `public/clients/sri-lakshmi/dc1fc2b2-23.png`.

## Lower-priority or incomplete source sections

- The source Patient Care destination contains mostly generic package/contact material; it does not provide a reliable complete admission, visiting-hours or discharge guide. Ask the hospital for those details if needed.
- The source privacy policy identifies Sri Lakshmi Global Hospital LLP in Koramangala and another domain, rather than clearly identifying the KR Puram client. It should not be copied into this demo as an approved KR Puram policy.
- The current accreditation rail was restored to preserve the user's chosen presentation. This review still did not establish the client's actual certificates; retain that as a client confirmation item.
- Ratings, doctor credentials, individual consultation fees, actual schedules, package inclusions, and emergency transport details remain hospital-supplied data gaps.

## Recommended next content pass

1. Add the dedicated Facilities & Technology screen within the current design.
2. Enrich the existing cardiology, urology and renal-care copy using the clearly published facilities.
3. Review the linked videos and wire appropriate clips into the existing video area.
4. Improve browsing of all eight packages and the cashless-insurance explanation.

Useful client questions: Which listed scanners/laser/cath-lab devices are currently on site at KR Puram? Which services are available at each group hospital? Which published videos should represent the founder and doctors? What are the approved package inclusions, schedules and certification documents?

Refreshed source HTML/text and checksums for seven pages are in `audit/`. The earlier full source snapshot remains in `pages/`; no app layout was changed for this audit.


## Follow-up implementation — 4 October 2026

The accepted content pass is implemented: Community & Media, Facilities & Technology, the full eight-package catalog, detailed cashless guidance and enriched cardiology/urology/renal/surgical/women’s-care content. See `README.md` for routes and validation.

YouTube oEmbed metadata now identifies all 18 linked recordings. `3HTtj5NBA4w` is an official hospital introduction featuring Dr. Sambashiva, and `QZ6X0l_jt2U` is titled “About Sri Lakshmi Hospital By Dr.Sambashiva.” The earlier unresolved founder-video finding is superseded. Six official-channel selections are embedded with their actual thumbnails. Playback of the featured founder introduction was observed in Chromium; other films have metadata/interaction verification, not individual playback acceptance. The homepage video area keeps its existing location and presentation. No achieved world-record or accreditation claim was inferred from community photographs.

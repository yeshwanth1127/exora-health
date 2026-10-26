# Reference flow audit — 26 October 2026

## Inspected source

- https://hje.org.uk/clinics/orthopaedic/ — image hero, five-column translucent panel in twelve-column grid, 27.5px padding, 20px corners, 34px/39.1px title, condition copy, related clinics, patient information, location and FAQs.
- https://hje.org.uk/treatments/hip-replacement-surgery/ — linked breadcrumb, aliases, price anchor, consultant links, pricing card, self-pay/insurance copy, FAQ disclosures and inline booking anchor.
- https://hje.org.uk/tests-scans/mri/ — same detail geometry, scan pricing/payment, FAQs, separate imaging booking destination.
- https://hje.org.uk/consultants/ — autocomplete, name, adult/child select, explicit search submission, specialty shortcuts; results show profile and appointment actions. Clicked Cardiology into results.
- https://hje.org.uk/consultants/dr-carol-jane-whelan/ — profile heading/qualifications/role/age, booking anchor and inline Jotform. Inspected known-consultant branch without entering personal data or submitting.
- https://hje.org.uk/imaging-appointment/ — inspected referral yes/no branch without entering personal data or submitting.

The user's subsequent instruction overrides both appointment forms: show schedules and available slots with automation, no patient-details or request form. No external form is embedded or submitted in the implementation.

## Captures

Initial service and consultant-index captures were already present. New detail captures completed all four widths (375, 768, 1280, 1920); generated three exports under `research/ditto-hje-flows`. Generation initially failed because the compiler copy lacked its pattern catalog/lock. Restored those two source files from the official ion-design/ditto.site repository, then regenerated from saved captures without recapturing pages. These exports have not passed Ditto's independent perceptual validation gate.

## Intentional differences

Use supplied Swastikaa wordmark, illustrative local records and Indian locality. Exclude UK contact details, reviews, charity/news, medical promises, equipment claims and prices. Existing imagery plus two already-received reference photos are labelled illustrative. Service menus map to six example departments, six treatments and six tests/scans. Videos, consultant articles and patient stories are omitted because verified content/assets were not supplied. No original consultant portraits are presented as Swastikaa staff.

The page structures/geometry and local Proxima font follow the reference. Full pixel parity, original photography parity and all source animations are not claimed. Appointment controls intentionally follow the user's form-free schedule instruction. Arc primitives remain available and used elsewhere; the explicit 1:1 request takes precedence for these reference page elements.

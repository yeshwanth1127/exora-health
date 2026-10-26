# Hospital website UI: Arc first, reference led

- Inspect the full local Arc UI Free and Pro catalog before handbuilding a component. Use every suitable available Arc component across navigation, forms, search/filtering, booking, profiles, FAQs, galleries and feedback. Prefer Arc over shadcn or a custom substitute when it supports the intended flow.
- Local references: `/Users/deepakonda/Downloads/test/arc-components/`; rendered catalog `http://localhost:4477/portable/review.html`. Preserve selected components’ geometry, corner radii, spacing, borders, shadows, typography, state transitions, keyboard behavior and reduced-motion support. Inspect source and rendered states; record limits when no live demo exists.
- Use Arc foundation tokens rather than arbitrary radii: 18px controls, 26px panels, 34px large surfaces, 44px standard control height. Keep per-component exceptions from their actual source. Retain the selected hospital reference’s overall white-and-blue layout; the user explicitly approved Arc surface/control refinement within it.
- Reuse existing Sri Lakshmi section components, not only their images. Insurance logo rows and the department photo bento are approved sources. Map their data/actions to this site, retain their purposeful layout and interactions, and document adaptations. Leave the Sri Lakshmi app unchanged.
- Do not fetch additional assets for this task. Reuse local assets. Logos do not establish Swastikaa empanelment; keep sample branding/clinical/commercial content clearly labelled.
- Build frontend UI only. No API/backend work, message delivery, payments or persisted booking claims. Exclude news and charity.
- Keep navigation, doctor/profile/specialty routes and booking intact during refinement. Verify desktop and narrow layouts, keyboard/focus, open/closed states and complete local form flows. A green build alone does not establish visual parity.

## Appointment automation and brand (26 October)

- Use the supplied SWASTIKAA HOSPITAL wordmark at `public/brand/swastikaa-hospital.png`; do not substitute a decorative symbol or invented logo.
- Appointment entry must show consultant schedules and available slots. Do not introduce appointment enquiry or patient-detail forms. This explicit instruction overrides the reference hospital’s request-form booking pattern.
- Keep the current task frontend-only: distinguish sample schedules, selected slots and an actual confirmed booking. Without live availability, show a clear unavailable state or explicitly labelled demonstration times.

## Backend and template registration (26 October)

The user now authorises backend integration and publication as `swastikaa` / **Swastikaa template**, superseding earlier frontend-only restrictions. Reuse the canonical HMS tenant API/worker/database, public booking catalog and signed slots. Keep demo data available in explicit demo mode; never insert sample doctors or appointments into the real clinical database or present them as live slots. The form-free appointment requirement still applies; connect the existing managed voice assistant and distinguish unavailable providers from successful bookings. Tenant identities always come from saved facility records.

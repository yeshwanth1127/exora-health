# Mobile responsiveness fixes — 2 October 2026

Base: main `cc968e2`. Scope: patient website layouts and navigation. Changes are local, not deployed.

## What changed

- Replaced the partially hidden horizontal navigation with a native modal menu below 1280px. All specialties, clinics, resources, login, doctor directory, booking, and display settings are accessible. Native dialog provides focus containment and Escape dismissal; scrolling is restored on close.
- Unified header offsets for inner pages, sticky doctor tabs, search filters, and anchor scrolling.
- Phone form controls use 16px text. Scaled large headings for narrow screens, while preserving doctor card title sizes.
- Search forms stack safely; the original hero uses two columns on tablets instead of squeezing four fields into one row. Light homepage brings the search form ahead of the decorative photo on phones.
- Smaller doctor portraits and wrapped names fix the 335px-wide search results found on a 320px phone.
- Constrained insurer/accreditation logos and the WhatsApp panel to their available widths.
- Enlarged main navigation and specialty tap targets. Booking calendars use wider cells; booking and login OTP boxes shrink to fit. Login close control stays fixed during scrolling.
- Mobile voice access is inside care assistance; display settings are inside navigation. One contact trigger remains on phones, with safe-area spacing and room below footer links.

## Verified locally

| Check | Result |
| --- | --- |
| TypeScript + production Vite build + SEO generation | PASS |
| Existing Vitest suite | PASS: 45 tests across 5 files |
| `git diff --check` | PASS |
| Original design: home, doctors, ENT department, booking, search, doctor profile at 320/375/390/768/1440px | PASS, with 320px search overflow corrected and rechecked |
| Light design: home, booking, search at 320/375/430/768/1440px | PASS: document scroll width equals viewport width |
| Departments, locations, insurance, pricing, care journey, contact, FAQ, blog, legal at 320px | PASS: no document width overflow |
| Mobile menu/submenu selection | PASS: ENT selection routes to the ENT page and closes dialog |
| Menu Escape/focus restoration | PASS: closes dialog, restores scrolling and focuses menu trigger |
| Mobile login access, booking OTP and login OTP at 320px | PASS: all six inputs fit; sample details only |
| Monthly availability modal at 320px | PASS: fits viewport, date buttons and Done reachable |
| Mobile care assistance | PASS: panel fits viewport; voice action visible within it |
| Phone form font size | PASS: observed 16px |
| iOS Safari, Xcode iPhone 17 Pro simulator / iOS 26.2 | PASS for home visual rendering only |

Browser checks used the local Vite preview at `http://localhost:5174`. Screenshots are in the primary checkout's `tmp/mobile-qa/`: `original-home-375.jpg`, `light-home-375.jpg`, `mobile-menu-375.jpg`, and `iphone-safari.png`.

## Remaining boundaries

- Physical phone keyboard, pinch zoom, orientation changes, and simulator touch interactions were not verified. The simulator was available through simctl for boot/navigation/screenshots, but not as a controllable app in the computer-use interface.
- No production deployment or live appointment/backend behavior was tested. Booking and login in this main revision remain previews.
- Build retains the existing large-chunk warning. This work fixes responsive usability; it does not claim mobile network-performance acceptance.
- The separate Testing chat added the mobile acceptance matrix to `specs/website-readiness.plan.md`. When integrating with website PR #2, preserve its `/book/` forwarding and clinic/source context; that PR is newer than this main base.

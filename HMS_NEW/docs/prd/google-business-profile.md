# PRD: Google Business Profile, managed from Paperwhale

Status: approved 14 October 2026 · UI built (browser-only preview) · backend next

## Problem

The **Google Business** page only stores a booking link by hand. It doesn't connect to Google, so it can't show or change the clinic's profile.

Clinics end up in Google's own tool. It's built for every kind of business, uses Google's terms ("place action links", "attributes", "voice of merchant"), and doesn't know the clinic's doctors, hours, fees or WhatsApp number. So most clinic profiles stay half done: no booking button, old hours, few photos, unanswered reviews.

## Goal

A clinic admin connects Google once. Paperwhale then:

- fills in the profile from what the clinic has already set up in Paperwhale;
- adds a **Book appointment** button and a **WhatsApp** button in one tap each;
- shows a simple **profile score** with a short to-do list, where every item can be done on the same screen.

The admin never needs to understand Google's terms.

## Research: what Google allows

The Google Business Profile APIs can do almost everything this page needs.

| What patients see | Can Paperwhale manage it? | Google API (for engineers) |
| --- | --- | --- |
| **Book** button | Yes | Place Actions v1 (`APPOINTMENT`), plus the `url_appointment` attribute |
| **WhatsApp chat** button | Yes | Business Information v1 attribute `url_whatsapp` (a `wa.me` link). If a text-message number is also set, Google shows only that one. |
| Name, phone, website, address | Yes. Changing name, address or main category can send the profile back to Google for re-checking. | Business Information v1 `locations.patch` |
| Opening hours, holiday hours | Yes | `regularHours`, `specialHours` |
| Categories (e.g. Hospital, Cardiologist) | Yes | `categories` and `categories.list` |
| Description (750 characters) | Yes | `profile.description` |
| Services and prices | Yes | `serviceItems` |
| Yes/no facts (wheelchair access, online visits, payments, social links) | Yes. The available ones depend on the category. | `attributes.list` and `updateAttributes` |
| Photos (logo, cover, inside, outside, team) | Yes | Media upload v1 and v4.9 media |
| Posts (updates, offers, events) | Yes | v4.9 `localPosts` |
| Reviews: read and reply | Yes | v4.9 `reviews` |
| New-review alerts | Yes | Notifications v1.2 through Cloud Pub/Sub |
| Edits Google made to the profile | Yes, can accept or overwrite | `locations.getGoogleUpdated` |
| Views, calls, directions, website clicks, bookings, search terms | Yes, read only | Performance v1 |
| Questions & answers | **No.** Google shut the Q&A API down on 3 November 2025. | — |

**Access is gated.** Paperwhale's Google Cloud project has to apply for Business Profile API access. To qualify, the applicant must have managed a verified profile for 60+ days, and the profile needs a website. Until approval, the quota is 0. Clinics sign in with Google (scope `business.manage`) and pick their listing.

## Decisions

- **Paperwhale is the source of truth** for hours, phone, doctors, departments and services. Clinics edit them once in Paperwhale and Paperwhale keeps Google in step. If Google or the public change something, we show "Google changed this" with *Keep Google's* / *Use ours*.
- **Plain words only.** Never "attribute", "place action", "location" or "verification state". Say "Book button", "WhatsApp button", "your listing", "Google is checking this change".
- **One listing per clinic.** Each Paperwhale clinic is matched to one Google listing.
- **Book button** opens Paperwhale's public booking page for that clinic (`book.html`), or the clinic's approved booking link if one is set (it's already stored).
- **WhatsApp button** uses the number connected in the WhatsApp module. If WhatsApp isn't set up, offer to set it up or type a number.
- **No review gating.** Google forbids asking only happy patients for reviews. The review request after a visit goes to every patient, not only those who rated "Very good".
- **Patient privacy in replies.** Suggested replies never confirm that the reviewer is a patient and never mention health details. If a reply mentions a diagnosis or treatment, the screen warns before posting.

## Scope

**In:**
- Connect with Google and choose the listing. Explain clearly what to do if there's no listing yet, or if the clinic isn't the listing's owner.
- Profile score and to-do list.
- Book and WhatsApp buttons.
- Profile editor with a live "how it looks on Google" preview.
- Sync from Paperwhale data, with a list of what's different.
- Photos, posts and reviews (reply, alerts, review link, QR code, review request on WhatsApp).
- Insights.
- An empty state when the clinic hasn't registered doctors, hours or fees yet. This is the same gate as WhatsApp.

**Out:**
- Creating a brand-new listing and posting the verification postcard from Paperwhale. We link to Google's flow and pick the clinic up once it's verified.
- Separate listings for each doctor (later).
- Google Ads.
- Q&A (shut down by Google).
- Multi-language posts.

## User flow

```
Google Business
├─ doctors/hours/fees missing → "Set up your clinic first" (same gate as WhatsApp)
├─ not connected → "Get more patients from Google" + preview of their listing with Book and WhatsApp buttons
│     → Sign in with Google → pick listing (matched by phone/address) → done
│     · no listing yet → "Create it on Google (5 min), then come back" + what Google will ask
│     · not an owner/manager → "Ask the owner to add you as a manager" with a copyable message
└─ connected: Overview · Profile · Reviews · Posts · Photos · Insights
```

### Overview
- **Profile score, 0–100,** with a ring and a short sentence like "3 quick fixes to reach 90."
- **To-do list**, highest impact first. Each item has a single action button:
  1. Add a Book button.
  2. Add a WhatsApp button.
  3. Opening hours match your schedule (shows the differences).
  4. Holiday hours for the next 30 days (from clinic closures).
  5. Pick specialities. Suggested from your departments, e.g. Cardiologist, Orthopaedic surgeon.
  6. Write a description. A draft is written from your clinic details; edit it and publish.
  7. List your services (from the Catalogue).
  8. Add photos: logo, cover, and 3+ of the clinic and team.
  9. Answer simple questions: wheelchair access, parking, online consultations, payment methods.
  10. Reply to reviews (N waiting).
  11. Post an update. It's been N days; posting every 2 weeks keeps the listing fresh.
  12. Add social links.
- **This month's numbers:** profile views, calls, direction requests, website clicks and bookings, each with the change from last month.
- **"Google changed something"** banner when Google applied an edit, with *Keep* / *Undo*.

### Profile
- Sections: **Basics** (name, phone, website), **Buttons** (Book, WhatsApp), **Hours**, **Specialities**, **About** (description), **Services**, **Facilities and payments**, **Social links**.
- Each section shows where the value comes from ("From your schedule", "From Catalogue") and a **Use Paperwhale data** button.
- A Google-style listing card preview on the right updates as you type, the same pattern as the WhatsApp phone preview.
- Name, address and main category changes show a warning first: "Google may check this change before it shows, usually a few days."
- Every change shows as *Live*, *Google is checking*, or *Not accepted* with Google's reason.

### Reviews
- Inbox with filters (needs reply, all, 1–2 stars). Each review shows its star rating and age.
- Suggested reply for each review, privacy-safe, editable before posting.
- Review link, a printable QR poster for reception, and a toggle for **Ask for a review after every visit** on WhatsApp. That toggle reuses the WhatsApp automations, with no gating.
- Alert on new 1–2 star reviews (in-app; WhatsApp to the admin later).

### Posts
- Templates: health camp, new doctor joined, holiday hours, health package offer, general update.
- Each post has an image, text, and a button (Book / Call / Learn more).
- Preview, then post now or schedule.
- List of past posts with views.

### Photos
- Slots: logo, cover, clinic outside, clinic inside, team.
- Doctor photos already uploaded in Paperwhale can be added with one tap, if the clinic confirms consent.
- Size and quality checks before upload. Show photos Google rejected, with the reason.

### Insights
- Charts: views (Search vs Maps), actions (calls, directions, website, bookings, WhatsApp), top search terms by month.
- Plain captions, e.g. "Most people found you searching *cardiologist near me*."

## Acceptance criteria

1. With doctors, hours or fees missing, only the set-up-first state shows.
2. Not connected: the page shows a preview of the clinic's listing with Book and WhatsApp buttons, and a single "Connect Google" action.
3. The Book button and WhatsApp button can each be added in one tap from the to-do list. They point to the clinic's booking page and its WhatsApp `wa.me` link.
4. The profile score updates as items are done. Every to-do item can be finished without leaving the page.
5. When Paperwhale data and Google differ (hours, phone, services), the page shows the differences and can fix them in one action.
6. Name, address or main category edits warn about Google re-checking first. Each change shows its review state.
7. A review reply that mentions a health condition, treatment or "your visit" warns before posting. The review request is never limited to happy patients.
8. No text on the page uses Google's internal terms.
9. Staff without `growth.manage` can see everything but can't change anything (the existing permission).

## Backend phase (next)

- Google Cloud project: apply for Business Profile API access. Set up an OAuth consent screen with the `business.manage` scope, which needs Google verification.
- Store per clinic: Google account and location ID, and the token reference in the secret store. Never send tokens to the browser.
- Push changes: hours from schedules and closures, services from the catalogue, the buttons, attributes and photos. Retry failed pushes and record every push in the audit log.
- Pull from Google: `getGoogleUpdated` for edits Google made, Performance API every day, reviews through Pub/Sub alerts and a daily backfill.
- Category mapping: Paperwhale departments to Google category IDs, via `categories.list` filtered to region IN.

## Open questions

1. Is Paperwhale's Google Cloud project already applied for Business Profile API access? Sri Lakshmi's profile (60+ days, with a website) could be the qualifying one.
2. Should the clinic's **website** field point to its own site (Sri Lakshmi has one) or to the Paperwhale booking page? Recommendation: keep their website and use the booking page only for the Book button.
3. Draft the description with AI? Recommendation: yes, written from clinic data, shown as an editable draft, never published automatically.
4. Separate listings for each doctor: later phase, or needed now?

## Where the UI stands (14 October 2026)

The UI is built. The listing, reviews, posts, photos and numbers are sample data kept in the browser (`localStorage` key `exora:google:<facilityId>`). Google's checks of edits, photos and posts are simulated by `progress()` in `google-profile.ts`. "Simulate sign-in" appears only in dev builds.

Real data the page already uses:
- doctors, departments, services and fees;
- clinic address and phone (`/v1/facilities/:id`);
- the booking link (`/v1/booking-links`, falling back to `book.html?branch=<facilityId>`);
- opening hours, built from every doctor's sessions over the next 14 days;
- the WhatsApp number connected in the WhatsApp module.

Files:
- `apps/staff-web/src/hms/`: `GoogleBusiness.tsx` (gate, connect, tabs, Overview, listing preview), `GoogleProfile.tsx`, `GoogleEngage.tsx` (Reviews, Posts, Photos, Insights), `google-profile.ts` (score, to-dos, hours, categories, description and privacy checks, sample data), `clinic-basics.tsx` (the register-first gate shared with WhatsApp)
- Test: `apps/staff-web/tests/google-profile.test.ts`

Left for the backend phase, beyond the list above:
- a QR code poster for reviews (no QR library is installed; generate it on the server);
- one-tap doctor photos (needs the doctor photo assets and consent flag);
- the real place ID in the review link (currently `PLACE_ID`).

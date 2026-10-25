# Editorial hospital website

Reusable tenant website adapted from the reviewed `hospital-one` Welbeck/Sri Lakshmi + Arc composition. Registered template ID: `hospital-editorial`; workspace package: `@hms/hospital-editorial-web`. It is separate from `apps/sri-lakshmi-web`, which is unchanged.

In onboarding choose **Your launch → Patient website → Editorial hospital website**. For NDR, enter **NDR Hospital** as the facility name. No hospital name is inferred from the template ID or pinned to NDR. The quote chooser, quote handoff, draft recovery, review, control API, both provisioners and tenant static serving all accept the new ID. Existing omitted selections still mean `standard`.

## Data bindings

- `/public/v1/website` reads the active tenant and saved facility identity through tenant RLS. Name, city, address and reception phone reflect persisted facility data, including subsequent name changes. It selects the deployment's `BOOTSTRAP_FACILITY_ID` when present. It never publishes the owner's private account email/phone as reception contact.
- `/website-config.js` supplies the existing server-owned booking-site slug. There is no default hospital slug. Doctors, departments, profiles, fees, dates, slots and receipts come from that tenant's existing public booking APIs. Missing binding, empty catalog, missing fees and uncertain outcomes remain visible.
- The booking UI reuses a private copy of the existing `HmsBookingPage` and `PublicBookingIntent`, including its three steps, exact clinician identity, idempotency, uncertain-request recovery and navigation guards. Arc Date Reel jumps the published schedule window within the backend's date bounds. It does not reserve a slot by selecting a date. Successful booking is shown only after a verified backend receipt; there is no WhatsApp enquiry substitute or fake OTP.
- Optional `WEBSITE_CONTENT_JSON` contains public editorial content: `logoUrl`, `heroImage`, `storyImage`, `headline`, `introduction`, `story`, `photos`, `packages`. The server validates bounded text, local/HTTPS media URLs, image dimensions and nonnegative integer prices. It is configured per tenant deployment; neither onboarding nor this template copies another hospital's content. Omitted collections are empty. Invalid configuration fails explicitly.
- Each photo is `{src,title,alt,width,height}`. Each package is `{id,name,description,priceMinor,inclusions}`; prices are INR minor units, matching the existing booking currency. Publish only hospital-approved content. The existing pricing rail, selected-package contact context, Sri photograph mosaic and Arc lightbox consume these values. No invented inclusions, discounts, clinician credentials, reception number, insurance acceptance or hospital facilities are supplied.
- Neutral consultation stock images are decorative/illustrative defaults. No Sri Lakshmi photos, roster or NDR-specific medical claims are bundled. A fresh tenant has empty doctor/package/gallery states until its own content is published. Generic navigation and action labels remain shared UI copy.

## Source reuse

The generated Welbeck navbar, hero/task cards, service cards, hospital-story JSX/styles and typography are reused and parameterized. The Sri `DoctorsGridSection`, `HospitalGallerySection`, `LightPricingRailSection`, `HmsDoctorDirectory`, `HmsDoctorProfile` and `HmsBookingPage` are copied adapters, not edits to the existing Sri app. Arc Team Showcase, Lightbox viewer and Date Reel retain the private runtime adapters from `hospital-one`; this is reconstructed public-preview JavaScript, not original Arc TSX. Preserve Arc licensing and provenance and keep the packages private. Unused captured sample media/fonts are not redistributed with this app.

`qa/source-provenance.json` records the source paths and hashes. `scripts/build-arc.mjs` rebuilds the private adapters with esbuild/postcss available; ordinary builds use the checked-in generated adapter inputs. The root ignore rules are explicitly overridden for these private runtime source inputs.

## Run and verify

From `HMS_NEW`: `pnpm editorial:dev`, `pnpm editorial:build`, `pnpm editorial:test`. Vite runs at port 5240; set `HMS_PUBLIC_BOOKING_PROXY` to the local tenant API origin. The API must supply `/website-config.js` and `/public/v1/website`. Production builds are included in both tenant Docker build paths; `WEBSITE_TEMPLATE=hospital-editorial` selects this app while `/staff/` stays unchanged. Platform images must also be rebuilt to publish the new onboarding choice, and the installed production provisioner script updated from this release.

For a read-only visual fixture after building, run `node apps/hospital-editorial-web/scripts/preview-fixture.mjs` from `HMS_NEW` (port 5242). It displays NDR's name solely as a local test fixture with no hospital-specific contacts, physicians or booking writes. Override `PREVIEW_HOSPITAL_NAME` to check another name; do not use this fixture as a tenant runtime.

See `qa/VERIFICATION.md` for the checks and remaining deployment boundaries. No NDR production tenant is created by this source integration.

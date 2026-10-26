# Swastikaa template

Reusable hospital website, template ID `swastikaa`, package `@hms/hospital-community-web`. The reviewed design and existing demo data are retained. The supplied Swastikaa logo is used for Swastikaa; another facility uses its saved name and optional `logoUrl`. Sri Lakshmi and NDR source apps are unchanged.

## Runtime and backend

The existing onboarding flow persists the selected template ID, both provisioners forward it, and `WEBSITE_TEMPLATE=swastikaa` selects this frontend from the tenant image. That image contains the patient website, `/staff/` dashboard, API and worker; production provisioning also creates the tenant database and OIDC owner invitation. The template does not duplicate the backend or create a second appointment store.

`/website-config.js` supplies the server-owned booking-site slug. `/public/v1/website` supplies the saved facility identity and Swastikaa content/mode. Unbound production builds fail visibly. General enquiry, doctor catalog and availability APIs use the existing dedicated integration account, tenant RLS, origin allowlist and rate limits.

Default demo mode retains the sample doctors, schedules, services, treatments, scans, plans, insurer logos, FAQs and illustrative photography. It never inserts sample patients, doctors or appointments in clinical tables and never submits demo enquiries or bookings. **Demo mode stays on until an administrator explicitly switches it off.**

In live mode the website loads only published doctors, fees and schedulable sessions from HMS. Catalog errors do not substitute sample records. Services, treatment/scan information, insurers, FAQs, photos and packages come from saved website content; absent lists stay empty. There is no patient appointment form. A selected signed slot is a preference: the backend checks origin, voice-clinic binding, signature, millisecond expiry, current availability and fee before returning it to the managed voice assistant. The assistant must recheck/hold/confirm using its existing booking tools. No reservation is created by selecting a time.

The shared voice integration still requires an activated Sarvam agent, provider credentials, booking tools and appropriate entitlements. A template selection does not activate those services. Recording consent precedes microphone access. Unavailable providers are shown explicitly. Real-provider calling and production deployment require separate verification; local tests do not prove either.

## Staff management

Workspace settings → Website (`config.manage` at the facility) contains the demo/live switch, public content editor and latest 100 general enquiries. Name/address/phone remain the saved facility records. Updates are tenant-scoped, audited, idempotent and protected against stale versions. The public content schema is `apps/api/src/modules/booking/website-profile.ts`; only bounded copy, arrays and local/HTTPS media URLs are accepted. No remote media is downloaded automatically.

Public general enquiries use `POST /public/v1/booking/:site/enquiries`, UUID `Idempotency-Key`, exact Origin and bounded fields. A receipt means saved to the hospital inbox; no email or WhatsApp delivery is claimed. Staff can mark an enquiry reviewed. The migration is `20261026090000_website_enquiries.sql`.

## Local verification and release

From `HMS_NEW`: `pnpm swastikaa:dev`, `pnpm swastikaa:build`, `pnpm swastikaa:test`. Vite defaults to port 5250; set `HMS_PUBLIC_BOOKING_PROXY` to a tenant API with the correct booking-site binding. Standalone development remains a labelled demo.

A release needs updated platform/control and tenant images plus the installed production provisioner. The tenant migration runs using the existing migration container before its restricted application starts. Rebuilding a local frontend does not publish this option on a running platform or reassign an existing tenant. See `deploy/production/README.md`.

# Sri Lakshmi webpage

Copied from this repository's earlier `hospital-webpage` at `b2cf1a5`, retaining its original components, styling, content and assets. The only website integration changes are a runtime booking-site setting and its script in the HTML shell. This is the Sri Lakshmi branded site, not a generic rebranding engine. No clinic records, patient data, schedules, fees, credentials or provider services are copied.

Run from `HMS_NEW`: `pnpm website:test` and `pnpm website:build`. The Docker tenant image builds this site alongside the standard website and staff dashboard.

In Paperwhale onboarding, select **First facility → Website → Sri Lakshmi Hospital website**. The existing control request stores `websiteTemplate: "sri-lakshmi"`; both provisioners pass `WEBSITE_TEMPLATE=sri-lakshmi` into the tenant app. Existing requests without a choice keep the standard website. There is no new onboarding step.

The API serves the selected site at `/`, the dashboard at `/staff/`, and the public booking API on the same origin. `/website-config.js` supplies only the tenant's public booking-site slug. The site reads published doctors, schedules and fees from that tenant's HMS data. Successful bookings persist through the existing booking API and appear in staff appointments with source `web`. Staff credentials are never supplied to the website.

A fresh tenant starts empty: set up and publish its doctors, services, fees and availability in the dashboard. The existing explicit Sri Lakshmi roster import is optional and does not invent schedules or fees. Marketing content/assets remain Sri Lakshmi's existing content; selecting this site does not import them as clinical records. SEO remains behind the existing noindex launch gate.

For the VPS, an administrator must build the new tenant/platform images, update the installed provisioning script from `deploy/production/provision-tenant-production`, and restart the platform/provisioner using the selected release. Updating the repository alone does not replace running containers or the installed host script. Current production provisioning requires the company OIDC configuration. Verify the provisioner's database-host SSH trust before onboarding; the inspection request on 20 October failed at that trust check.

Local validation: 77 website tests, 243 staff tests and 22 focused backend/onboarding/static-serving tests passed. The public-booking test saves a real transaction in an isolated test database and verifies it appears in staff appointment reads. Website, platform, standard-site and staff builds and TypeScript checks passed. Docker execution and VPS end-to-end onboarding are not verified; the Docker daemon is unavailable locally. No production tenant was created for this implementation.

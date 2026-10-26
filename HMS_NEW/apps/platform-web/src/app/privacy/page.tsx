import ResourceShell from "../components/resource-shell";
import { AnalyticsPreferences } from "../components/website-analytics";
import { BRAND_NAME } from "../../lib/brand";
import { pageMetadata } from "../../lib/seo";
import "../solutions/solutions.css";
export const metadata = pageMetadata("/privacy");
export default function Privacy() {
  return (
    <ResourceShell>
      <main className="solution-page privacy-copy">
        <nav aria-label="Breadcrumb">
          <a href="/">Home</a>
          <span>/</span>
          <span>Privacy policy</span>
        </nav>
        <header>
          <p className="solution-eyebrow">Privacy policy</p>
          <h1>Your data. Clear choices.</h1>
          <p>
            This policy explains how {BRAND_NAME} handles website and workspace
            setup information, and Google Business Profile data when you choose
            to connect a clinic. {BRAND_NAME} is a software platform for
            clinics, not the clinic providing care. Patient records and clinical
            services are governed separately by the applicable clinic agreement
            and notices.
          </p>
          <p>
            Last updated: 26 October 2026. Contact:{" "}
            <a href="mailto:hello@paperwhale.health">hello@paperwhale.health</a>
            .
          </p>
        </header>
        <section>
          <h2>Optional website analytics</h2>
          <p>
            When analytics is configured and you allow it, PostHog measures
            known page visits, navigation links, setup step names, chosen
            plan/template and request status. Analytics stays off until you
            choose to allow it. You can decline and continue using the website.
          </p>
          <p>
            We do not send form values, names, email addresses, phone numbers,
            facility details, request identifiers, credentials, full referring
            URLs or query strings to analytics. Automatic form capture, session
            recording, person profiles and browser error collection are
            disabled. A random browser identifier connects permitted events; it
            is not linked to your administrator account.
          </p>
        </section>
        <section>
          <h2>Your browser preference</h2>
          <p>
            Your analytics choice is stored on this device. If enabled, an
            anonymous analytics identifier is stored separately. Supported Do
            Not Track or Global Privacy Control signals keep tracking disabled.{" "}
            <AnalyticsPreferences />.
          </p>
          <p>
            PostHog is an analytics provider. Its service necessarily receives
            network requests when you opt in. Project-side IP retention and
            regional hosting settings should be reviewed by the site operator.
          </p>
          <p>
            <a href="https://posthog.com/privacy" rel="noopener noreferrer">
              Read PostHog’s privacy policy ↗
            </a>
          </p>
        </section>
        <section>
          <h2>Details you enter during setup</h2>
          <p>
            Your growth-plan draft is stored in this browser tab for a limited
            period. Workspace setup saves a draft and recovery token on this
            device so you can resume. When you confirm and submit, the necessary
            organisation, owner, facility and plan details go to the control API
            to create your workspace. This operational request is separate from
            optional analytics.
          </p>
          <p>
            Temporary administrator passwords are displayed from the
            authenticated provisioning response and are not saved to browser
            storage. On a shared device, treat a saved recovery token as
            sensitive access to your setup status.
          </p>
        </section>
        <section id="google-business-profile">
          <h2>Connecting a Google Business Profile</h2>
          <p>
            When the Google integration is available, an authorised clinic
            administrator can choose Connect Google, sign in directly with
            Google, review the requested permission and select a business
            location they manage. Connecting is optional. We do not ask for or
            store your Google password. Availability depends on Google API
            approval and the clinic’s permissions; this policy does not imply
            Google has approved or verified the integration.
          </p>
          <h3>Data we access and why</h3>
          <p>
            We request Google’s Business Profile management permission (
            <code>https://www.googleapis.com/auth/business.manage</code>) to
            find the business accounts and locations you manage and operate the
            location you select. This permission can cover multiple profiles in
            your Google account; Paperwhale’s clinic connection is bound to the
            selected location.
          </p>
          <p>
            Depending on the feature you use, we access business account and
            location identifiers, business name, address, contact details,
            website, opening hours and other profile information; reviews,
            reviewer display information, ratings and replies; business posts;
            and performance metrics such as profile views and customer
            interactions. We use this data to show your clinic’s profile,
            reviews, posts and performance in the dashboard, and to carry out
            profile edits, review replies and post actions you authorise. Google
            permissions do not give us access to your Gmail messages, Drive
            files or patient records.
          </p>
          <h3>Storage and protection</h3>
          <p>
            We store the connection’s authorisation tokens and selected business
            identifiers on the server. Tokens are encrypted before storage and
            are not placed in browser storage. We also retain the connection
            state and operational or audit records needed to run and secure the
            service. Retrieved Google data is processed to provide the requested
            dashboard features. Access is limited by clinic membership and
            application permissions. Google requests use HTTPS.
          </p>
          <h3>Use, sharing and human access</h3>
          <p>
            We use Google data only to provide and improve the connected
            features described here. We do not sell it, use it for advertising
            or credit decisions, or use it to train general-purpose AI models.
            Google data is not sent to optional marketing-website analytics.
          </p>
          <p>
            Data is shared with Google to perform your requested operations and
            with authorised users of your clinic workspace according to their
            permissions. Infrastructure providers may process it on our behalf
            to host and secure the service. Other disclosures are limited to
            your consent, necessary security investigations, applicable legal
            requirements, or a business transfer with the consent required by
            Google’s policy. Our staff or contractors may access Google data
            only with your affirmative agreement for specific support, where
            necessary for security, or as required by law.
          </p>
          <p>
            {BRAND_NAME}’s use and transfer of information received from Google
            APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including its Limited Use requirements.
          </p>
          <h3>Disconnecting, retention and deletion</h3>
          <p>
            You can disconnect the Google connection in your clinic dashboard.
            Disconnecting disables the connection and clears its stored
            credentials and connection metadata; it does not delete your
            profile, reviews or posts at Google. You can also revoke
            Paperwhale’s access in your{" "}
            <a
              href="https://myaccount.google.com/connections"
              rel="noopener noreferrer"
            >
              Google Account connections
            </a>
            . Revoking access stops future authorised API access but does not
            itself remove previously retained operational records.
          </p>
          <p>
            Connection credentials are retained while needed for your active
            connection. To request deletion of retained Google data, email{" "}
            <a href="mailto:hello@paperwhale.health">hello@paperwhale.health</a>{" "}
            from your authorised clinic contact. We verify your authority before
            deleting the applicable data. Limited records may be retained where
            necessary for legal obligations or security; backup copies may
            remain until their normal rotation and are not used for ongoing
            integration activity. We will explain any applicable retention
            exception when responding to your request.
          </p>
        </section>
        <section>
          <h2>Questions about your setup</h2>
          <p>
            Use the <a href="/contact-sales">contact page</a> to find the
            currently published contact options. Provider activation and
            patient-data handling depend on the applicable clinic setup and
            agreement.
          </p>
        </section>
      </main>
    </ResourceShell>
  );
}

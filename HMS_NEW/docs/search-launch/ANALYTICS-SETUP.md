# PostHog setup and measurement contract

Supply the **public project token** from PostHog project settings, not a personal or administration API key. This frontend value is intentionally visible to browsers. Set `NEXT_PUBLIC_POSTHOG_KEY` and the ingestion host `https://us.i.posthog.com` or `https://eu.i.posthog.com` to match your project. Rebuild the platform image; setting runtime variables alone does not update static JavaScript.

Production Compose/Docker accepts those build args. Keep both search verification tokens optional. `.env.example` in `apps/platform-web` lists the public settings. No token has been configured or committed; no PostHog delivery is verified.

## Collection

No SDK initialises without a token, a permitted cloud host and visitor opt-in. Analytics loads after consent, with no blocking head script. The SDK sends only allowlisted event identifiers/properties; `before_send` also removes automatic title/URL/referrer/attribution/person data. Page URLs are reconstructed from the configured origin and a fixed path allowlist. Unknown paths, all query strings and fragments are excluded. Global Privacy Control and Do Not Track keep analytics off. Visitors can reopen preferences in the footer/privacy page and withdraw consent.

Autocapture, session replay, surveys, feature flags, performance collection, exception capture and person profiles are disabled. Form inputs, patient/admin identity, organisation names, credentials, onboarding IDs and arbitrary error messages are never analytics properties. PostHog necessarily receives network requests after opt-in; review project-side IP capture/retention and regional hosting with the owner. Reference: https://posthog.com/docs/privacy/data-collection and https://posthog.com/docs/libraries/js/config . This implementation is not a legal/compliance certification.

| Event | Safe fields | Meaning |
| --- | --- | --- |
| `$pageview` | fixed path, referrer category | Consented visit to an allowed page |
| `website_cta_clicked` | fixed source/target paths | Navigation link followed, not a completed enquiry |
| `quote_step_viewed` | fixed stage/path | Growth plan question viewed |
| `onboarding_step_viewed` | fixed stage/path | Setup stage viewed |
| `workspace_request_submitted` | plan, template, accepted, fixed path | Control API acknowledged a request; may be a recovered request |
| `workspace_request_failed` | unavailable, fixed path | Frontend request failed; not a patient/provider failure |
| `workspace_status_changed` | queued/provisioning/ready/failed, fixed path | Authorised server response reports status |

Configure a funnel from quote → onboarding account/workspace/facility/launch/review → accepted request → ready. Do not use frontend event counts as a deduplicated tenant count. Requests can be retried/recovered and visits can span tabs; the control database is the source of truth for unique workspaces. No personal identity is joined to the browser identifier.

## Search submission

`node scripts/indexnow.mjs --prepare` creates a public proof file and stable config. Rebuild/deploy, run `node scripts/indexnow.mjs` to inspect the proposed URLs, then explicitly use `--submit` after verifying the deployed files. The script verifies deployed proof/sitemap before notifying IndexNow. It does not submit to Google. No submission has been run in this task.

Use Search Console URL Inspection/sitemap submission for Google and Bing Webmaster Tools for Bing verification. Optional `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_BING_SITE_VERIFICATION` provide HTML verification tags; DNS verification is also possible.

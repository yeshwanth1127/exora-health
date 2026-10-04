# Website and appointment test execution

2 October 2026. Companion changes: website PR #2 and backend PR #4. Mobile commit `2015478` is integrated with real `/book/` forwarding; current main's SEO changes are preserved.

## Fixes found and made

- **Backend CI authentication failure:** reproduced 401s when external service-key settings differed from fixtures. Backend test configuration now isolates fixture credentials before settings are cached; production authentication is unchanged.
- **Ambiguous clinician selection:** a real-browser reproduction with two same-name doctors selected the first doctor silently. Backend booking UI now accepts only a unique roster match; otherwise the patient must choose. Explicit backend IDs/slugs take precedence over a name hint.
- **WebKit mobile menu focus:** keyboard focus did not return to the menu trigger after Escape. The header now restores focus explicitly, while avoiding a hidden desktop trigger or taking focus from another active dialog.
- **Slow integration startup:** PostgreSQL catalogue initialization exceeded the former five-second polling count on this host. HTTP integration now waits for actual readiness within a bounded 30-second deadline.

## Repeatable coverage

`playwright.config.ts` runs 16 independent scenario files in Chromium desktop, Chromium phone, WebKit phone and Firefox desktop: 64 cases. Firefox uses an America/Los_Angeles browser timezone while appointments remain in the clinic's Asia/Kolkata timezone.

The browser runner serves the production website and built backend booking/staff screens through one loopback origin. It creates a new temporary SQLite database, fixture clinic and named staff accounts. Phone verification goes through the signed synthetic WhatsApp webhook and durable worker. Database assertions use a separate Python process/connection. All outbound bot transport is simulated and external browser requests are blocked. Concurrency row-lock proof is supplied separately by PostgreSQL API tests.

Scenarios cover public routes/history/404 recovery; booking entry from header, directory, search and clinician profile; preserved source/clinic links and explicit preview routing; ambiguous roster names; verification errors/expiry; saved booking/reload/reception check-in; lost-response retry; competing slot holds; expired/blocked holds and changed fees; cancellation/rescheduling; calendar download and waitlist consent; dependency failure/reception fallback; patient isolation and staff sign-in; restricted storage; consent/login/disabled-voice controls; and mobile navigation/width/focus in both designs.

The mobile scenario checks 320/375/390/430px widths and 1440px desktop. Physical-phone keyboards, real app switching, touch and actual delivery remain separate acceptance checks. Preview sign-in is explicitly tested as a preview; it does not create a patient account.

## Validation record

- Backend: 91 tests passed with all three PostgreSQL fixtures enabled; no concurrency skips. A run with overridden external credentials reproduced the original auth failure before the fixture fix and passed after it.
- Bot: 37 tests passed; real HTTP signed-webhook/worker integration passed with both disposable SQLite and PostgreSQL.
- Website component suite: 46 passed. Browser test TypeScript check passed. Website and backend patient/staff builds passed.
- Initial four-browser matrix: 62 passed; two WebKit failures were investigated. The mobile focus defect was fixed; booking-entry assertions now wait for the loaded roster before navigating away, avoiding cancellation of initialization requests. Targeted reruns verify these corrections. The complete 64-case GitHub run on the final PR revision is required before merge; its retained check is the final full-matrix evidence.

Build retains a large website bundle warning; backend test tooling emits a Starlette deprecation warning. No production deployment, real Meta delivery, Sarvam call, Google publishing or PostHog ingestion is claimed.

## Run locally

Use the compatible backend revision pinned in `.github/workflows/website-tests.yml`, or a later tested revision. Do not point test database variables at clinic data.

```sh
# In a compatible backend checkout:
uv sync --locked --extra dev
npm --prefix staff-web ci
npm --prefix staff-web run build

# In this website checkout:
npm ci
npm run build
npm run test:e2e:install
npm run test:e2e:types
HMS_E2E_BACKEND_PATH=/absolute/path/to/hms-backend npm run test:e2e
```

For a focused run, append `-- --project=chromium tests/e2e/persisted-booking.spec.ts`. The runner requires free port 4187, does not reuse an existing server, and stops only its own backend/webhook/proxy. Fixture control credentials and reports are ignored by Git; temporary data is removed at shutdown. Unrelated previews and primary data are preserved.

For PostgreSQL proof, create a disposable test database, set `HMS_BOOKING_DATABASE_URL`, `HMS_VOICE_DATABASE_URL` and `HMS_OUTREACH_DATABASE_URL` to it, and run `uv run --locked pytest`. Each fixture uses and removes only its own random schema. `HMS_TEST_DATABASE_URL` runs the bot HTTP integration against a disposable migrated PostgreSQL database.

The website GitHub workflow builds both applications, checks component tests/test types, and runs the four-browser matrix on PRs and main. Backend CI independently checks migrations, API/bot integration, PostgreSQL races and Compose images/services. Failure traces/screenshots contain fictional fixture data and are retained briefly for diagnosis.

The remaining deployed HTTPS/provider acceptance checklist is in [the readiness plan](website-readiness.plan.md). Merging tested code does not activate online booking; deployment must still configure the same-origin proxy, migrations, approved clinic data, `WEB_BOOKING_ENABLED`, origin, WhatsApp number/module and signed webhook/worker.

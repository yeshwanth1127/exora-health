# Voice booking integration

The Sarvam call screen is now built and served by the existing backend, at `/talk/`. The backend's `staff-web/src/talk.tsx` shares its shadcn components/build with the staff workspace. Do not run a third `/var/www/avocado-web` checkout.

Use `VITE_VOICE_URL=/talk/` in production, and `http://127.0.0.1:8000/talk/` for local development. Rebuild the website after changing Vite environment values. The default launcher URL is already `/talk/`.

In the clinic HTTPS reverse proxy, route `/talk`, `/talk/`, `/staff/` (including `/staff/assets/`), `/book`, `/book/` and `/api/` to the backend; keep remaining website routes on port 5567. Forward the original host and HTTPS scheme and trust only the actual proxy's forwarded headers. Full configuration and lifecycle contracts are in the backend repo's `VOICE_MODULE.md`.

Configure the backend's Sarvam credentials, pinned agent version, authenticated provider callbacks and recording response/host settings, apply migrations, build the staff UI, and enable Voice under Staff > Settings > Modules. Configure `VOICE_WEBSITE_BOOKING_URL` in the backend to this website's `/schedule-appointment` URL (absolute URL when running on separate local ports).

`ecosystem.config.cjs` now starts only the patient website. After validating the new backend/proxy route, manually stop the legacy `avocado-voice` PM2 job if it is still running. Changing this file alone does not stop a running process or deploy the new route.

The patient must agree to recording before starting the call. Clinic administrators can review eligible call recordings in `/staff/voice`; reception staff see call outcomes but cannot access audio. Playback remains unavailable until the actual Sarvam recording response is verified and configured. Local mock tests are not live provider acceptance.

## One dashboard

The former `AdminDashboard` and its separate key-based sign-in have been removed. `/admin` opens the backend's `/staff/appointments` workspace; Vite forwards `/staff`, `/api` and `/talk` to `HMS_BACKEND_PROXY` (default `http://127.0.0.1:8000`). In production, the reverse proxy must route those same paths plus `/book` and `/book/` to the backend. The API also redirects legacy `/admin` URLs when it receives them directly.

For the isolated all-module local demo, start `scripts/demo.py` in the backend repo and set `HMS_BACKEND_PROXY=http://127.0.0.1:8014` plus `VITE_VOICE_URL=/talk/` in this repo's gitignored `.env.local`. Open `http://localhost:5173/admin`. The demo has clear/reload controls, a dedicated database and blocked external transports. Backend `DASHBOARD_MIGRATION.md` contains the feature-by-feature migration audit and demo setup.

## Verified website booking

Normal appointment entry now opens the backend `/book/` screen. The former sample calendar remains available only with `booking_preview=true`, and stays labelled as a preview. The backend must configure `WEB_BOOKING_ENABLED`, `WEB_BOOKING_ORIGIN` and the real bot number `WHATSAPP_BOOKING_NUMBER`, run migrations and build staff-web. See backend `BOOKING_JOURNEY.md`. Verification requires an actual message to the bot from the matching WhatsApp sender; there is no arbitrary demo-code production bypass. Real WhatsApp receipt still needs provider verification.

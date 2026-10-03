# Exora all-in-one Docker demo

The demo is packaged as one container containing the React website, FastAPI hospital backend, and SQLite database. The voice experience uses the managed Sarvam Voice Agents runtime through a server-side signing proxy in that same backend.

```bash
docker compose -f docker-compose.demo.yml up -d --build
```

Open:

- Website: http://localhost:8080
- Role portal: http://localhost:8080/portal
- Admin: http://localhost:8080/admin
- Virtual OPD: http://localhost:8080/virtual-opd
- Voice assistant: click **Talk to Aanya** on the website
- Backend health: http://localhost:8000/api/health/ready

Demo accounts:

- Admin: `admin@example.com` / `change-me-in-production`
- Doctor: `doctor@example.com` / `doctor-demo-password`
- Patient: `patient@example.com` / `patient-demo-password`

Use the **Portal login** button on the website. Select Patient, Doctor, or Staff / administrator; the page pre-fills the matching local demo account and opens that role's dashboard. Doctors see one worklist containing both clinic and virtual appointments. Staff manage Virtual OPD from the dedicated sidebar menu, including creating an appointment and tracking consent, waiting-room, call, and appointment status.

The database is persisted in `demo-data/avocado.db`. To reset the demo completely:

```bash
docker compose -f docker-compose.demo.yml down
rm -rf demo-data
docker compose -f docker-compose.demo.yml up -d --build
```

The Sarvam server key is read from the ignored root `.env` file and is never included in the browser bundle. The legacy local speech runtime is no longer started by this Docker image.

This is a local demonstration configuration. Before deployment, replace the demo passwords and session/Jitsi secrets, use PostgreSQL, configure a real Jitsi deployment or trusted provider, and put the Sarvam signing route behind authentication and rate limiting.

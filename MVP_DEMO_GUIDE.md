# Exora HMS — MVP demo guide

## Start and verify

```bash
cd /Users/ysw/Documents/ChatGPT/voice-agent
docker compose -f docker-compose.demo.yml up -d --build
docker compose -f docker-compose.demo.yml ps
```

Open:

- Website and booking: http://localhost:8080
- Role portal: http://localhost:8080/portal
- Administration: http://localhost:8080/admin
- Virtual OPD: http://localhost:8080/virtual-opd
- Voice assistant: click **Talk to Aanya** on the website
- Backend readiness: http://localhost:8000/api/health/ready

Use two browser profiles, or a normal window and a private window, so patient and doctor cookies do not replace one another.

## Suggested presentation flow

1. **Start with administration.** Sign in as `admin@example.com` / `change-me-in-production`. Show Overview, then Doctors. Explain that the doctor directory, login identity, fee, specialty, active state, and Virtual care switch all come from the shared hospital database. Show Schedules to explain where patient-visible slots originate. Show Virtual OPD to show the current online-consultation worklist.
2. **Show the third layer.** Click **Talk to Aanya**, then **Start voice call** and allow microphone access. Aanya is the existing Sarvam agent `Conversatio-47382521-7c72`; the website shows live connection state, transcript, mute, and end-call controls. Ask, “Which branches do you have?” or “Help me find a cardiology doctor.”
3. **Create one fresh patient journey.** From the website, choose Virtual OPD, select Dr. Ananya Sharma, Indiranagar, Video Visit, and an open slot. Enter a new email and phone number that have not been used in an earlier rehearsal. Confirm the booking.
4. **Pause on the confirmation.** Show the appointment reference, generated `EXO-P-...` patient code, and one-time access code. Explain that this creates the patient, user identity, appointment, reservation, teleconsultation, status history, and notification outbox records in the same database. Save both codes before leaving the page.
5. **Enter as the patient.** Open the Role portal in one browser, select Patient, and sign in with the generated patient code and access code. Open Virtual OPD. Show that consent is required and that the patient cannot join before the doctor starts. Accept consent, run the device check, and enter the waiting room.
6. **Enter as the assigned doctor.** In the second browser, sign in as `doctor.doc-2@example.com` / `doctor-demo-password`. The same booking appears in the doctor's worklist with the patient name and phone. Start the consultation, run the device check, and join the video room.
7. **Join as the patient.** Return to the patient window. The consultation becomes joinable; join the same Jitsi room and demonstrate audio/video controls.
8. **Complete and audit.** End the consultation from the doctor window. Refresh the patient view, then return to Administration. Show the completed status and Operations/outbox trail.

The Docker demo permits joining up to seven days early so a scheduled future slot can be demonstrated immediately. Production configuration defaults to a 15-minute early-join window.

## Backup video path

If you do not want to create a fresh booking on stage, use the seeded appointment:

| Role | Login | Password |
|---|---|---|
| Patient | `patient@example.com` | `patient-demo-password` |
| Doctor — Dr. Vikram Rao | `doctor@example.com` | `doctor-demo-password` |

Both accounts already see the same seeded Virtual OPD appointment. Do not complete this backup appointment during rehearsal if you want it ready for the presentation.

## Checks completed

- Backend test suite: 21 passed.
- Voice-agent test suite: 82 passed.
- Frontend TypeScript and production build: passed.
- Live Docker health: container healthy; frontend and backend endpoints respond.
- Sarvam session signing: verified live with HTTP 200, a signed WebSocket URL, and a call reference ID.
- Live UI: admin Overview, Doctors, Virtual OPD, Dr. Ananya worklist, seeded patient worklist, and the embedded Aanya call panel verified.
- External video dependency: `meet.jit.si/external_api.js` returned HTTP 200 from this machine.

## Demo boundaries

- WhatsApp and email messages are represented by durable outbox events; an external delivery worker/provider is not configured in this local container.
- Sarvam's booking tools currently target `https://avocado.exora.solutions`. That backend is reachable, but its current `VOICE_SERVICE_API_KEY` does not match the credential stored in the Sarvam tools (HTTP 401). Update the deployed backend secret or the seven Sarvam tool credentials before claiming a completed voice booking in the demo. The website call itself is ready and signed independently.
- The official browser SDK currently brings an npm audit advisory through its Node-only `speaker` dependency. The browser build uses the `/browser` entry point and loads it only when the user starts a call; Sarvam has not published a fixed SDK release yet.
- The public Jitsi service requires internet and browser camera/microphone permission. Test the two physical devices once before presenting.
- Prescriptions, investigations, clinical notes, and reports are future modules; do not claim they are implemented in this MVP.
- Public production deployment still needs PostgreSQL, managed secrets, HTTPS, a controlled Jitsi deployment/provider, backups, observability, and real notification providers.

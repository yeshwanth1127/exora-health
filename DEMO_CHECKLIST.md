# Exora demo-day checklist

The complete walkthrough and credentials are in [MVP_DEMO_GUIDE.md](./MVP_DEMO_GUIDE.md).

## Five minutes before presenting

- [ ] Run `docker compose -f docker-compose.demo.yml up -d --build`.
- [ ] Confirm `docker compose -f docker-compose.demo.yml ps` says `healthy`.
- [ ] Open http://localhost:8080, http://localhost:8765, and http://localhost:8000/api/health/ready.
- [ ] Use separate patient and doctor browser profiles.
- [ ] Confirm the chosen laptop camera and microphone work in both profiles.
- [ ] Keep the seeded Vikram/Demo Patient appointment untouched as the backup.
- [ ] Prepare a unique patient email and phone for the fresh-booking flow.
- [ ] Keep the generated patient code and access code visible after booking.

## On-stage proof points

- [ ] Admin Doctors shows each doctor and login identity.
- [ ] Admin Schedules explains where open booking slots come from.
- [ ] Voice assistant reads a doctor from the same backend directory.
- [ ] Patient receives an appointment reference plus patient and access codes.
- [ ] Patient consent blocks entry until accepted.
- [ ] Patient waiting room blocks entry until the doctor starts.
- [ ] Doctor and patient enter the same video room.
- [ ] Doctor completion updates patient and admin views.
- [ ] Operations shows the notification/event trail.

## If video is delayed

Use `patient@example.com` / `patient-demo-password` and `doctor@example.com` / `doctor-demo-password`, then continue from the patient consent step.
# Sarvam voice wrapper

- [ ] On the landing page, click **Talk to Aanya** and verify the in-page call panel opens.
- [ ] Click **Start voice call**, allow microphone access, hear Aanya's greeting, and verify transcript, mute, and end-call controls.
- [ ] Ask a hospital-information question before the demo; this validates the Sarvam agent and its knowledge base.
- [ ] Do not demonstrate a voice-created booking until the `X-Service-Key` credential stored in Sarvam matches the deployed `avocado.exora.solutions` backend. A mismatch currently returns HTTP 401.

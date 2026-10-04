# WhatsApp booking demo and backend integration

The default `WA_MODE=demo` is a local, backend-free **test flow** with fictional clinicians and in-memory requests. `WA_MODE=backend` uses the scheduling backend and a durable inbound queue. Neither mode is a live clinic until the [production deployment checks](./PRODUCTION_DEPLOYMENT.md) pass and clinic data is approved.

## Run without Meta

From the repository root:

```sh
npm run whatsapp:simulate
```

Type `hi`, then choose **Book a visit → specialty → sample clinician → slot → test alias**. The specialty choice sends a PDF guide before the clinician list; the clinician choice shows a portrait before sample slots. After the test request, send `hi` for the start and choose **My visits** to open **My appointments**. Each appointment has its own detail, change, and cancel actions; older requests remain in the local list. Try `:media image` and `:followup` in the simulator. `:quit` exits. The simulator shows text equivalents of the WhatsApp buttons, lists, images, and documents; it does not prove delivery to a phone.

Run the focused checks with:

```sh
npm run whatsapp:test
```

The three specialty guides are generated from [catalog.json](./catalog.json) and the six bundled sample portraits. To rebuild them after changing sample content:

```sh
uv run --with reportlab python whatsapp-mvp/scripts/build_doctor_pdfs.py
```

The PDFs are written to `output/pdf/`. The bot reads those exact files when a specialty is selected. All six portraits and all PDF profiles are clearly fictional. Replace the catalog details and images only with verified clinician information and approved headshots before any real clinic use.

## Local phone test setup

1. In your own [Meta developer account](https://developers.facebook.com/), create or select an app with WhatsApp and use its **test** business number. Add each tester's WhatsApp phone as an allowed test recipient. Both the owner's and partner's numbers are currently listed in the app. Do not register the clinic's number for this demo.
2. Copy `whatsapp-mvp/.env.example` to `whatsapp-mvp/.env` and fill in the test phone-number ID, temporary access token, app secret, a long random verify token, and the Graph API version shown by Meta. Never send these values in chat or commit the `.env` file.
3. Run `npm run whatsapp:server`. Its local webhook is `http://127.0.0.1:8787/webhook`.
4. Expose port 8787 with a temporary HTTPS tunnel of your choice. Set Meta's webhook callback to `https://YOUR-TUNNEL/webhook`, use the same verify token, and subscribe to `messages` events.
5. Test a webhook from Meta's app dashboard and a real `hi` from an approved phone. Keep the server and tunnel running. The owner reported that the real phone flow worked after a temporary access token was refreshed; a later expired token caused outbound HTTP 401 while inbound messages still reached the webhook. Type `followup` into the server terminal for a single manually triggered demo check-in while that conversation remains within the 24-hour window.

When `hi` reaches the local webhook, the demo uploads [welcome.png](./welcome.png) to Meta once per server run and sends it above three reply buttons. Before any booking these are **Book a visit**, **Find a doctor**, and **More options**. After a test request they are **Book a visit**, **My visits**, and **More options**; doctor browsing remains in More options. Choosing a specialty uploads and sends its PDF, then a tappable list of its two sample clinicians. Booking a clinician sends the corresponding portrait, then the sample slot list. The confirmation says to send `hi` to return to the start, and has **My visits** and **Main menu** buttons. My appointments shows up to eight requests per page and lets the tester open, change, or cancel the selected request. The built-in artwork explicitly says **TEST DEMO**; replace it with an approved clinic PNG/JPEG using `WA_WELCOME_IMAGE_PATH` if desired. If Meta rejects a combined image-and-button card with HTTP 400, the sender falls back to an image message followed by a button message.

Meta test-number setup: [Cloud API developer assets](https://www.postman.com/postman/brewing-postman-flows/folder/euh50yh/step-1-set-up-developer-assets-and-platform-access). Meta's test number is separate from the clinic's existing WhatsApp number.

## Demo behavior and boundaries

- Multiple booking, change, and cancellation requests affect only this process's memory; there is no real clinician schedule or reservation. Restarting the process clears the entire appointment history.
- Issues and ratings stay in local memory. No staff member or patient system receives them.
- Media messages receive an acknowledgement. Files are not downloaded or analyzed.
- Only the sender's phone number, message ID, and message type are used by the webhook adapter. Message bodies are processed in memory and omitted from server logs.
- Follow-ups are manual for the test. Outbound templates, persistent reminders, and production opt-in are outside this version.
- The owner reported that a real phone conversation worked before this navigation update. The updated start, My appointments, and change/cancel journey still needs a fresh phone walkthrough.
- The sender resumes a PDF/image sequence after a transient send failure, and the webhook coalesces simultaneous retries of one inbound message ID. These safeguards last only as long as this process runs.
- The webhook requires Meta's `X-Hub-Signature-256` signature and the configured app secret. It rejects unsigned or malformed requests.

## Backend and clinic readiness

The optional backend mode below implements the service contract for catalogue, media, availability, booking, visit management, cases, and consented reminder jobs. The default demo mode remains backend-free. Clinic use still needs verified doctor and location data, stable hosting and file storage, production Meta credentials, staff handling, and a two-phone walkthrough. See [the master plan](../WHATSAPP_MVP_MASTER_PLAN.md) for the full MVP scope.

## Opt-in backend mode

The backend integration is implemented against `yeshwanth1127/hms-backend` at the sibling checkout `/Users/deepakonda/Documents/antigravity/hms-backend`. Its route contract is in that checkout's `WHATSAPP_CONTRACT.md`. The default `WA_MODE=demo` preserves the phone demo above.

To test the real API locally, start the backend first and set these values in `whatsapp-mvp/.env`:

```env
WA_MODE=backend
BACKEND_URL=http://127.0.0.1:8000
BACKEND_WHATSAPP_SERVICE_KEY=<same value as the backend WHATSAPP_SERVICE_API_KEY>
WA_CLINIC_READY=false
```

Restart `npm run whatsapp:server` after changing the mode. The flow then reads backend departments, branches, doctors, uploaded specialty PDFs and doctor photos; obtains live availability; creates a hold; and records an appointment only after an explicit patient choice. In local mode, **My visits** pages through backend appointments. Production mode asks for the booking reference before showing one visit or allowing changes/cancellation; that access expires after 30 minutes. Issues, ratings, and supported PDF/image/audio/video attachments are saved as staff cases. The backend serves `http://127.0.0.1:8000/whatsapp-assets` for PDF and photo uploads.

Keep `WA_CLINIC_READY=false` with the backend's illustrative seed doctors. The bot marks booked records as a **local test**, even though the local backend returns `confirmed`. Set it to `true` only after real clinician details, locations, schedules, media, patient identity rules, and staff handling have been checked. The WhatsApp number is still Meta's test number until a production number is configured.

If the clinic approves an appointment-reminder utility template, set `WA_REMINDER_TEMPLATE_NAME` and `WA_REMINDER_TEMPLATE_LANGUAGE`. The template body must accept three text parameters in order: confirmation code, doctor name, and local appointment date/time. The worker polls due, consented reminder jobs once a minute only when `WA_CLINIC_READY=true`. No template name is configured by default, so no scheduled messages are sent. Meta's acknowledgement is not proof that the patient received the reminder.

Conversation progress and the latest prepared reply are persisted in the backend. Backend mode records signed inbound messages before acknowledging Meta, then one worker sends replies. Ambiguous outbound sends become `uncertain` and need staff review; they are never retried automatically. Complete the [production preflight](./PRODUCTION_DEPLOYMENT.md) and a two-phone walkthrough with approved clinic data before clinic use.

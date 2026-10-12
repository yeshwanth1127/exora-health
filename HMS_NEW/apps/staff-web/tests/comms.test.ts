import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ContactPointCreateSchema,
  MessagingConsentCreateSchema,
} from "@hms/contracts";
import {
  decodeCapabilities,
  decodeContacts,
  decodeMessages,
  notificationState,
} from "../src/hms/comms-model.ts";
import { HmsError } from "../src/hms/client.ts";

const id = "018f132b-ffab-7000-8000-000000000001";
const job = {
  id,
  appointmentId: id,
  kind: "confirmation",
  status: "queued",
  dueAt: "2026-10-12T09:00:00.000Z",
  reason: "provider_transport_not_implemented",
  message: { id, status: "queued", transport: "log", attempts: 0 },
};

test("local notification records never become a delivery claim in appointment details", () => {
  const data = decodeMessages({ items: [job] });
  assert.equal(notificationState(data.items[0]!), "Queued locally · not sent");
  const cancelled = decodeMessages({
    items: [
      {
        ...job,
        status: "cancelled",
        message: { ...job.message, status: "cancelled" },
      },
    ],
  });
  assert.equal(notificationState(cancelled.items[0]!), "Cancelled");
  const scheduled = decodeMessages({
    items: [{ ...job, status: "scheduled" }],
  });
  assert.equal(notificationState(scheduled.items[0]!), "Scheduled · not sent");
  const skipped = decodeMessages({
    items: [{ ...job, status: "skipped_no_consent", message: null }],
  });
  assert.equal(
    notificationState(skipped.items[0]!),
    "Not queued · messaging consent missing",
  );
});

test("malformed contact and capability responses fail closed without echoing input", () => {
  for (const decode of [decodeContacts, decodeCapabilities, decodeMessages]) {
    assert.throws(
      () =>
        decode({
          address: "+919876543210",
          liveSending: true,
          items: [job, { invalid: true }],
        }),
      (e: HmsError) =>
        e.code === "invalid_response" && !e.message.includes("9876543210"),
    );
  }
});

test("contact owner is explicit; adding a contact carries no implicit consent", () => {
  const body = {
    facilityId: id,
    patientId: id,
    channel: "whatsapp",
    address: "+919876543210",
  };
  assert.equal(ContactPointCreateSchema.safeParse(body).success, true);
  assert.equal(
    ContactPointCreateSchema.safeParse({ ...body, bookingPartyId: id }).success,
    false,
  );
  assert.equal(
    ContactPointCreateSchema.safeParse({ ...body, patientId: undefined })
      .success,
    false,
  );
  assert.equal(
    ContactPointCreateSchema.safeParse({ ...body, marketing: true }).success,
    false,
  );
});

test("a consent checkbox alone is insufficient; fresh affirmative evidence is required", () => {
  const base = {
    purpose: "reminders",
    action: "opt_in",
    source: "staff",
    evidence: "Requested reminders at reception",
  };
  assert.equal(MessagingConsentCreateSchema.safeParse(base).success, false);
  assert.equal(
    MessagingConsentCreateSchema.safeParse({ ...base, explicitOptIn: true })
      .success,
    true,
  );
  assert.equal(
    MessagingConsentCreateSchema.safeParse({
      ...base,
      explicitOptIn: true,
      evidence: "",
    }).success,
    false,
  );
  assert.equal(
    MessagingConsentCreateSchema.safeParse({
      ...base,
      explicitOptIn: true,
      actor: "someone else",
    }).success,
    false,
  );
});

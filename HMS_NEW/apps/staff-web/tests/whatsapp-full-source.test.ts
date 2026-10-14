import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { fullWhatsAppSource } from "../src/hms/whatsapp-full-source.ts";
import {
  IntentKeys,
  requestBytes,
  setIdentity,
  HmsError,
} from "../src/hms/client.ts";
import type { Facility } from "../src/hms/types.ts";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  setIdentity("");
});
const at = "00000000-0000-4000-8000-000000000001",
  id = "00000000-0000-4000-8000-000000000002",
  contact = "00000000-0000-4000-8000-000000000003";
const facility = { facilityId: at, timezone: "Asia/Kolkata" } as Facility;
const convo = {
  id,
  facilityId: at,
  contactPointId: contact,
  status: "open",
  automationState: "handoff_requested",
  automationAllowed: false,
  automationBlockedReasons: ["human_handoff", "reply_window_expired"],
  assignedStaffId: null,
  assignedStaffName: null,
  version: 4,
  updatedAt: "2026-10-12T04:30:00Z",
  replyUntil: null,
  canReply: false,
  contactAddress: "+919876543210",
  name: "Caller",
};
const camp = {
  id,
  facilityId: at,
  title: "Clinic update",
  templateId: contact,
  parameters: [],
  assetId: null,
  scheduledAt: "2026-12-01T04:30:00Z",
  interest: null,
  rateMinor: 150,
  budgetMinor: 10000,
  reservedMinor: 0,
  status: "draft",
  version: 3,
  approvedCount: 0,
  simulationOnly: true,
  providerDelivery: "unavailable",
};
test("original inbox maps UUID identity, version and server assignment without trusting browser actor", async () => {
  const calls: { path: string; body: any }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      path: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Response.json(
      String(url).includes(`/v1/conversations/${id}`)
        ? { conversation: convo, messages: [], cases: [] }
        : { items: [convo], total: 1, offset: 0, limit: 30 },
    );
  };
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const thread: any = await source.read(
    `/api/v1/admin/whatsapp/conversations/${id}`,
    new AbortController().signal,
  );
  assert.equal(thread.sender_id, id);
  assert.equal(thread.display_address, convo.contactAddress);
  assert.equal(thread.can_reply, false);
  await source.write(`/api/v1/admin/whatsapp/reception/${id}`, {
    method: "PATCH",
    body: { status: "active", assigned_to: "Untrusted name" },
  });
  assert.deepEqual(calls[1], {
    path: `/v1/conversations/${id}/assign`,
    body: { version: 4 },
  });
});
test("local campaign preserves server rate and drops client rate and approval actor", async () => {
  const calls: { path: string; body: any }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      path: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Response.json(
      init?.method === "POST" && String(url) === "/v1/campaigns"
        ? camp
        : String(url).endsWith("/preview")
          ? {
              campaignId: id,
              body: "Clinic update",
              recipients: 2,
              estimatedCostMinor: 300,
              withinBudget: true,
              audienceHash: "a".repeat(64),
              version: 5,
              simulationOnly: true,
            }
          : { ...camp, version: 6, status: "scheduled" },
    );
  };
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const draft: any = await source.write("/api/v1/admin/whatsapp/campaigns", {
    method: "POST",
    body: {
      title: camp.title,
      template_id: contact,
      parameters: [],
      asset_id: null,
      scheduled_at: camp.scheduledAt,
      audience: { branch_id: at },
      rate_paise: 1,
      budget_paise: 10000,
    },
  });
  assert.equal(draft.rate_paise, 150);
  assert.equal(draft.bookings, null);
  assert.equal(calls[0].body.rateMinor, undefined);
  const preview: any = await source.read(
    `/api/v1/admin/whatsapp/campaigns/${id}/preview`,
    new AbortController().signal,
  );
  await source.write(`/api/v1/admin/whatsapp/campaigns/${id}/approve`, {
    method: "POST",
    body: {
      actor: "spoofed",
      test_received: true,
      expected_count: preview.recipients,
      audience_hash: preview.audience_hash,
    },
  });
  assert.deepEqual(calls[2].body, {
    version: 5,
    testReceived: true,
    expectedCount: 2,
    audienceHash: "a".repeat(64),
  });
});
test("local template never pretends to be Meta approved or freshly synced", async () => {
  globalThis.fetch = async () =>
    Response.json({
      items: [
        {
          id,
          facilityId: at,
          name: "local",
          body: "Hello",
          language: "en",
          category: "marketing",
          parameterCount: 0,
          header: "none",
          providerApproval: "not_synced",
          editable: true,
          editBlockedReason: null,
          simulationOnly: true,
          version: 1,
        },
      ],
    });
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const rows: any = await source.read(
    "/api/v1/admin/whatsapp/templates",
    new AbortController().signal,
  );
  assert.equal(rows[0].simulationOnly, true);
  assert.equal(rows[0].status, "NOT_SYNCED");
  assert.equal(rows[0].synced_at, "");
});
test("unknown campaign outcome retains one idempotency key for a safe retry", async () => {
  const keys: string[] = [];
  let first = true;
  globalThis.fetch = async (_url, init) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
    if (first) {
      first = false;
      throw Error("connection lost");
    }
    return Response.json(camp);
  };
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const body = {
    title: camp.title,
    template_id: contact,
    parameters: [],
    asset_id: null,
    scheduled_at: camp.scheduledAt,
    budget_paise: 10000,
  };
  await assert.rejects(
    source.write("/api/v1/admin/whatsapp/campaigns", { method: "POST", body }),
  );
  await source.write("/api/v1/admin/whatsapp/campaigns", {
    method: "POST",
    body,
  });
  assert.equal(keys[0], keys[1]);
});
test("private media uses bearer authorization and rejects a file arriving after identity changes", async () => {
  setIdentity("test-token", "tenant");
  let options: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => {
    options = init;
    return new Response("bytes", {
      headers: { "content-type": "application/pdf" },
    });
  };
  const blob = await requestBytes(`/v1/comms/assets/${id}/content`);
  assert.equal(blob.type, "application/pdf");
  assert.equal(options?.credentials, "omit");
  assert.equal(
    new Headers(options?.headers).get("authorization"),
    "Bearer test-token",
  );
  globalThis.fetch = async () => {
    setIdentity("other", "tenant2");
    return new Response("PRIVATE");
  };
  await assert.rejects(
    requestBytes(`/v1/comms/assets/${id}/content`),
    (e: HmsError) => e.code === "context_changed",
  );
});
test("schema-invalid inbox response fails without echoing patient data", async () => {
  globalThis.fetch = async () =>
    Response.json({ items: [{ ...convo, version: "PRIVATE_PATIENT" }] });
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  await assert.rejects(
    source.read(
      "/api/v1/admin/whatsapp/conversations",
      new AbortController().signal,
    ),
    (e: HmsError) =>
      e.code === "invalid_response" && !e.message.includes("PRIVATE_PATIENT"),
  );
});

test("private photo upload carries selected clinic and byte content through typed bearer transport", async () => {
  let payload: any,
    route = "";
  globalThis.fetch = async (url, init) => {
    route = String(url);
    payload = JSON.parse(String(init?.body));
    return Response.json({
      id,
      facilityId: at,
      ownerType: "practitioner",
      ownerId: id,
      filename: "photo.png",
      mimeType: "image/png",
      sizeBytes: 8,
      sha256: "a".repeat(64),
      createdAt: "2026-10-12T04:30:00Z",
      status: "local_validated",
    });
  };
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const form = new FormData();
  form.append(
    "file",
    new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", {
      type: "image/png",
    }),
  );
  const result: any = await source.write(`/api/v1/admin/doctors/${id}/photo`, {
    method: "POST",
    body: form,
  });
  assert.equal(route, `/v1/practitioners/${id}/whatsapp-photo`);
  assert.equal(payload.facilityId, at);
  assert.equal(payload.mimeType, "image/png");
  assert.equal(payload.dataBase64, "iVBORw0KGgo=");
  assert.equal(result.validation_state, "local_validated");
});

test("declared interest needs owner revision and evidence, and refuses clinical targeting fields", async () => {
  const { ContactInterestSchema, ContactPointSchema } =
    await import("@hms/contracts");
  const contactRow = ContactPointSchema.parse({
    id: contact,
    facilityId: at,
    patientId: id,
    bookingPartyId: null,
    channel: "whatsapp",
    address: "+919876543210",
    status: "active",
    version: 6,
    interests: ["Clinic wellness events"],
    consents: { care: false, reminders: false, marketing: true },
  });
  assert.equal(contactRow.version, 6);
  assert.deepEqual(contactRow.interests, ["Clinic wellness events"]);
  assert.equal(
    ContactInterestSchema.safeParse({
      interest: "Clinic wellness events",
      evidence: "Person explicitly requested this interest",
      version: contactRow.version,
    }).success,
    true,
  );
  assert.equal(
    ContactInterestSchema.safeParse({
      interest: "Clinic wellness events",
      version: 6,
    }).success,
    false,
  );
  assert.equal(
    ContactInterestSchema.safeParse({
      interest: "Clinic wellness events",
      evidence: "Observed",
      version: 6,
      diagnosisCode: "clinical-target",
    }).success,
    false,
  );
});

test("schema-invalid successful mutation retains its idempotency key until verified retry", async () => {
  const keys: string[] = [];
  globalThis.fetch = async (_url, init) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
    return Response.json(
      keys.length === 1 ? { private: "PATIENT_DATA" } : camp,
    );
  };
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const body = {
    title: camp.title,
    template_id: contact,
    parameters: [],
    asset_id: null,
    scheduled_at: camp.scheduledAt,
    budget_paise: 10000,
  };
  await assert.rejects(
    source.write("/api/v1/admin/whatsapp/campaigns", { method: "POST", body }),
    (e: HmsError) =>
      e.code === "invalid_response" && !e.message.includes("PATIENT_DATA"),
  );
  await source.write("/api/v1/admin/whatsapp/campaigns", {
    method: "POST",
    body,
  });
  assert.equal(keys[0], keys[1]);
});

test("original inbox preserves server case categories and admits capped history", async () => {
  globalThis.fetch = async (url) =>
    Response.json(
      String(url).includes(`/v1/conversations/${id}`)
        ? {
            conversation: convo,
            messages: [],
            cases: [],
            hasOlderMessages: true,
          }
        : {
            items: [{ ...convo, kinds: ["reception", "feedback"] }],
            total: 71,
            offset: 30,
            limit: 30,
          },
    );
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const inbox: any = await source.read(
    "/api/v1/admin/whatsapp/conversations?offset=30",
    new AbortController().signal,
  );
  assert.deepEqual(inbox.items[0].kinds, ["reception", "feedback"]);
  assert.equal(inbox.total, 71);
  const thread: any = await source.read(
    `/api/v1/admin/whatsapp/conversations/${id}`,
    new AbortController().signal,
  );
  assert.equal(thread.has_older_messages, true);
  assert.match(thread.history_note, /Earlier history is not loaded/);
});

test("inbox preserves explicit human request, assignment and consent barrier", async () => {
  const assigned = {
    ...convo,
    automationState: "human",
    assignedStaffId: contact,
    assignedStaffName: "Assigned clinician",
    automationBlockedReasons: ["human_handoff", "consent_missing_or_withdrawn"],
  };
  globalThis.fetch = async (url) =>
    Response.json(
      String(url).endsWith(`/${id}`)
        ? { conversation: assigned, messages: [], cases: [] }
        : { items: [convo], total: 1, offset: 0, limit: 30 },
    );
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const inbox: any = await source.read(
    "/api/v1/admin/whatsapp/conversations",
    new AbortController().signal,
  );
  assert.equal(inbox.items[0].automation_state, "handoff_requested");
  assert.equal(inbox.items[0].version, 4);
  const thread: any = await source.read(
    `/api/v1/admin/whatsapp/conversations/${id}`,
    new AbortController().signal,
  );
  assert.equal(thread.active_handoff, true);
  assert.equal(thread.assigned_to, "Assigned clinician");
  assert.equal(thread.assigned_staff_id, contact);
  assert.equal(thread.automation_allowed, false);
  assert.deepEqual(
    thread.automation_blocked_reasons,
    assigned.automationBlockedReasons,
  );
});

test("open automation conversation is not inferred to be a human handoff", async () => {
  globalThis.fetch = async () =>
    Response.json({
      conversation: {
        ...convo,
        automationState: "automation",
        automationAllowed: true,
        automationBlockedReasons: [],
      },
      messages: [],
      cases: [],
    });
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const thread: any = await source.read(
    `/api/v1/admin/whatsapp/conversations/${id}`,
    new AbortController().signal,
  );
  assert.equal(thread.open, true);
  assert.equal(thread.active_handoff, false);
  assert.equal(thread.automation_allowed, true);
});

test("handoff and resume carry captured version/key; closing is a separate command", async () => {
  const calls: any[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      path: String(url),
      body: JSON.parse(String(init?.body)),
      key: new Headers(init?.headers).get("Idempotency-Key"),
    });
    return Response.json({ conversation: convo, messages: [], cases: [] });
  };
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  for (const action of ["handoff", "resume"])
    await source.write(`/api/v1/admin/whatsapp/reception/${id}/${action}`, {
      method: "POST",
      body: {
        version: 4,
        idempotency_key: `original-${action}`,
        assigned_to: "Spoofed actor",
      },
    });
  await source.write(`/api/v1/admin/whatsapp/reception/${id}`, {
    method: "PATCH",
    body: { version: 4, status: "closed", idempotency_key: "original-close" },
  });
  assert.deepEqual(calls, [
    {
      path: `/v1/conversations/${id}/handoff`,
      body: { version: 4 },
      key: "original-handoff",
    },
    {
      path: `/v1/conversations/${id}/resume`,
      body: { version: 4 },
      key: "original-resume",
    },
    {
      path: `/v1/conversations/${id}/close`,
      body: { version: 4 },
      key: "original-close",
    },
  ]);
});

test("unknown reply recovery keeps original version/key after refreshed conversation changes", async () => {
  const calls: any[] = [];
  let failed = false;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "POST") {
      calls.push({
        path: String(url),
        body: JSON.parse(String(init.body)),
        key: new Headers(init.headers).get("Idempotency-Key"),
      });
      if (!failed) {
        failed = true;
        throw Error("response lost");
      }
    }
    return Response.json({
      conversation: { ...convo, version: 9 },
      messages: [],
      cases: [],
    });
  };
  const source = fullWhatsAppSource(facility, [], new IntentKeys());
  const intent = {
    method: "POST",
    body: {
      version: 4,
      text: "Reception response",
      idempotency_key: "original-reply",
      actor: "Spoofed",
    },
  };
  await assert.rejects(
    source.write(`/api/v1/admin/whatsapp/reception/${id}/reply`, intent),
  );
  await source.read(
    `/api/v1/admin/whatsapp/conversations/${id}`,
    new AbortController().signal,
  );
  await source.write(`/api/v1/admin/whatsapp/reception/${id}/reply`, intent);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[1].body, { version: 4, text: "Reception response" });
});

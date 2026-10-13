import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  whatsappSource,
  decodeNotificationHistory,
} from "../src/hms/whatsapp-source.ts";
import type { Facility, Me } from "../src/hms/types.ts";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const facilityId = "00000000-0000-4000-8000-000000000001",
  visitId = "00000000-0000-4000-8000-000000000002";
const facility = { facilityId, timezone: "Asia/Kolkata" } as Facility;
const me = {
  tenantId: "tenant",
  staffId: "staff",
  permissions: { "comms.read": [facilityId], "comms.reply": [facilityId] },
} as Me;
test("restored WhatsApp maps scoped permissions and truthful provider capability", async () => {
  let path = "";
  globalThis.fetch = async (url) => {
    path = String(url);
    if (path.startsWith("/v1/comms/settings"))
      return Response.json({
        facilityId,
        accountId: null,
        phoneNumberId: null,
        providerConfigured: false,
        webhookReady: false,
        operationalCounts: {
          openConversations: 0,
          campaignDrafts: 0,
          marketingContacts: 0,
        },
        liveSending: false,
        transport: "log",
        templatesReady: false,
        storageReady: true,
        version: 0,
        testRecipientIds: [],
        rateMinor: 100,
      });
    return Response.json({
      facilityId,
      moduleStatus: "active",
      transport: "log",
      liveSending: false,
      reason: "provider_transport_not_implemented",
    });
  };
  const s = whatsappSource(me, facility);
  assert.equal(s.permissions.allowed["followups.manage"], false);
  assert.equal(s.permissions.allowed["comms.reply"], true);
  const config = await s.read<any>(
    "/api/v1/admin/whatsapp/operations-config",
    new AbortController().signal,
  );
  assert.equal(path, `/v1/comms/settings?facilityId=${facilityId}`);
  assert.equal(config.outreach_enabled, false);
  assert.equal(config.module_active, true);
  assert.equal(config.marketing_contacts, null);
});
test("completed follow-up preserves selected visit revision and never sends browser actor", async () => {
  const calls: { path: string; body: any; headers: any }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      path: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: init?.headers,
    });
    return Response.json(
      String(url).startsWith("/v1/appointments?")
        ? {
            items: [
              {
                appointmentId: visitId,
                facilityId,
                status: "completed",
                version: 7,
                patientName: "Patient",
                confirmationCode: "A123",
                originChannel: "front_desk",
              },
            ],
          }
        : {
            id: facilityId,
            appointmentId: visitId,
            kind: "follow_up",
            dueAt: "2026-11-01T04:30:00Z",
            message: null,
            status: "skipped_no_consent",
            reason: "no_consent",
          },
    );
  };
  const s = whatsappSource(me, facility);
  await s.read(
    "/api/v1/admin/appointments?status=completed",
    new AbortController().signal,
  );
  const body = {
    due_at: "2026-11-01T04:30:00Z",
    actor: "Untrusted browser actor",
  };
  const route = `/api/v1/admin/whatsapp/appointments/${visitId}/followup`;
  await s.write!(route, { method: "POST", body });
  await s.write!(route, { method: "POST", body });
  const listUrl = new URL(calls[0].path, "http://local");
  const from = listUrl.searchParams.get("from"),
    to = listUrl.searchParams.get("to");
  assert.match(from!, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(to!, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((Date.parse(to!) - Date.parse(from!)) / 86400000, 180);
  assert.equal(listUrl.searchParams.get("limit"), "500");
  assert.deepEqual(calls[1].body, { dueAt: body.due_at, version: 7 });
  assert.equal(calls[1].path, `/v1/appointments/${visitId}/followup`);
  assert.equal(
    calls[1].headers["Idempotency-Key"],
    calls[2].headers["Idempotency-Key"],
  );
});
test("rule adapter carries optimistic revision and excludes template/provider claims", async () => {
  let payload: any;
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({
      id: visitId,
      facilityId,
      kind: "same_day",
      enabled: true,
      delayHours: 2,
      version: 4,
      transport: "log",
      templateReady: false,
    });
  };
  const s = whatsappSource(me, facility);
  await s.write!("/api/v1/admin/whatsapp/followup-rules/same_day", {
    method: "PUT",
    body: {
      enabled: true,
      delay_hours: 2,
      version: 3,
      template_id: "fake-approved",
    },
  });
  assert.deepEqual(payload, {
    facilityId,
    enabled: true,
    delayHours: 2,
    version: 3,
  });
  await assert.rejects(
    s.write!("/api/v1/admin/whatsapp/campaigns", { method: "POST", body: {} }),
  );
});
test("history decoder preserves offer identity and rejects fabricated transport", () => {
  const job = {
    id: visitId,
    appointmentId: null,
    offerId: facilityId,
    kind: "waitlist_offer",
    status: "queued",
    dueAt: "2026-11-01T04:30:00Z",
    reason: "log_transport_no_delivery",
    message: {
      id: facilityId,
      status: "queued",
      transport: "log",
      attempts: 0,
    },
  };
  const r = decodeNotificationHistory({ items: [job], nextCursor: "next" });
  assert.equal(r.items[0].offerId, facilityId);
  assert.equal(r.nextCursor, "next");
  assert.throws(() =>
    decodeNotificationHistory({
      items: [{ ...job, message: { ...job.message, transport: "meta" } }],
    }),
  );
});

test("polling decoders have stable identity and malformed summary fails without echoing data", async () => {
  const { decodeCommsSummary, decodeMessages } =
    await import("../src/hms/comms-model.ts");
  assert.equal(decodeNotificationHistory, decodeMessages);
  assert.throws(
    () => decodeCommsSummary({ patientName: "PRIVATE_PATIENT", facilityId }),
    (error: any) =>
      error.code === "invalid_response" &&
      !error.message.includes("PRIVATE_PATIENT"),
  );
  // Protect the hook dependency: an inline schema lambda restarts polling on every state render.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../src/modules/whatsapp-notifications.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /useQuery\([\s\S]*?10000,\s*decodeCommsSummary/);
  assert.doesNotMatch(source, /=>\s*CommsSummarySchema\.parse/);
});

test("restored post-visit and immediate controls preserve typed kind, revision and delay", async () => {
  const calls: { path: string; body: any }[] = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ path: String(url), body });
    return Response.json({
      id: visitId,
      facilityId,
      kind: String(url).split("/").at(-1),
      enabled: body.enabled,
      delayHours: body.delayHours,
      version: body.version + 1,
      transport: "log",
      templateReady: false,
    });
  };
  const source = whatsappSource(me, facility);
  for (const kind of ["feedback", "no_show", "reschedule", "cancellation"])
    await source.write(`/api/v1/admin/whatsapp/followup-rules/${kind}`, {
      method: "PUT",
      body: {
        enabled: true,
        delay_hours: ["reschedule", "cancellation"].includes(kind) ? 0 : 24,
        version: 3,
      },
    });
  assert.deepEqual(
    calls.map((c) => c.path),
    ["feedback", "no_show", "reschedule", "cancellation"].map(
      (k) => `/v1/comms/followup-rules/${k}`,
    ),
  );
  assert.deepEqual(calls[2].body, {
    facilityId,
    version: 3,
    enabled: true,
    delayHours: 0,
  });
  assert.equal("recordedBy" in calls[0].body, false);
});

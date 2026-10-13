import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  HmsError,
  IntentKeys,
  request,
  setIdentity,
  setTenant,
} from "../src/hms/client.ts";
const realFetch = globalThis.fetch;
Object.assign(globalThis, { window: new EventTarget() });
afterEach(() => {
  globalThis.fetch = realFetch;
  setIdentity("");
});
test("bearer and tenant are sent without browser cookies; idempotency lives in header", async () => {
  setIdentity("test-token", "tenant-a");
  let init: RequestInit | undefined;
  globalThis.fetch = async (_url, options) => {
    init = options;
    return Response.json({ appointmentId: "saved" });
  };
  await request("/v1/appointments", {
    method: "POST",
    body: { reservationId: "held" },
    idempotencyKey: "intent-123",
  });
  const headers = init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer test-token");
  assert.equal(headers["X-Tenant-Id"], "tenant-a");
  assert.equal(headers["Idempotency-Key"], "intent-123");
  assert.equal(init?.credentials, "omit");
  assert.equal(init?.cache, "no-store");
  assert.ok(headers["X-Request-Id"]);
  assert.equal(headers["X-CSRF-Token"], undefined);
});
test("old Python endpoints cannot be sent through the new transport", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };
  await assert.rejects(
    request("/api/v1/admin/appointments"),
    (e: HmsError) => e.code === "unsupported_contract",
  );
  assert.equal(called, false);
});
test("403 preserves the session and carries structured chart access details", async () => {
  let signout = false;
  window.addEventListener(
    "hms-signout",
    () => {
      signout = true;
    },
    { once: true },
  );
  globalThis.fetch = async () =>
    Response.json(
      {
        error: {
          code: "forbidden",
          message: "No relationship",
          details: { reason: "no_care_relationship" },
        },
        requestId: "trace",
      },
      { status: 403 },
    );
  await assert.rejects(
    request("/v1/patients/p/chart"),
    (e: HmsError) =>
      e.status === 403 &&
      e.details.reason === "no_care_relationship" &&
      e.requestId === "trace",
  );
  assert.equal(signout, false);
});
test("401 signs out while development-login errors do not", async () => {
  let count = 0;
  const handler = () => {
    count++;
  };
  window.addEventListener("hms-signout", handler);
  globalThis.fetch = async () =>
    Response.json({ error: { message: "Expired" } }, { status: 401 });
  await assert.rejects(
    request("/dev/login", { method: "POST", body: { subject: "x" } }),
  );
  assert.equal(count, 0);
  await assert.rejects(request("/v1/me"));
  assert.equal(count, 1);
  window.removeEventListener("hms-signout", handler);
});
test("late response after tenant change cannot enter the new workspace", async () => {
  setIdentity("test-token", "tenant-a");
  let resolve!: (value: Response) => void;
  globalThis.fetch = () =>
    new Promise((r) => {
      resolve = r;
    });
  const pending = request("/v1/appointments");
  setTenant("tenant-b");
  resolve(Response.json({ items: [{ patientName: "old clinic" }] }));
  await assert.rejects(pending, (e: HmsError) => e.code === "context_changed");
});
test("network or post-commit server failure is an unknown mutation outcome", async () => {
  globalThis.fetch = async () => {
    throw new Error("connection dropped");
  };
  await assert.rejects(
    request("/v1/patients", { method: "POST", body: {} }),
    (e: HmsError) => e.code === "outcome_unknown",
  );
  globalThis.fetch = async () =>
    Response.json(
      { error: { code: "internal", message: "server error" } },
      { status: 500 },
    );
  await assert.rejects(
    request("/v1/patients", { method: "POST", body: {} }),
    (e: HmsError) => e.code === "outcome_unknown",
  );
});
test("validation errors preserve field messages", async () => {
  globalThis.fetch = async () =>
    Response.json(
      {
        error: {
          code: "validation",
          message: "request validation failed",
          details: { issues: [{ path: "phone", message: "expected E.164" }] },
        },
      },
      { status: 400 },
    );
  await assert.rejects(
    request("/v1/patients", { method: "POST", body: {} }),
    (e: HmsError) => e.message === "phone: expected E.164",
  );
});
test("same intent keeps a retry key until success; another intent uses another key", () => {
  const intents = new IntentKeys(),
    body = { patientId: "patient-1" };
  const key = intents.for("/v1/appointments", body);
  assert.equal(intents.for("/v1/appointments", body), key);
  assert.notEqual(
    intents.for("/v1/appointments", { patientId: "patient-2" }),
    key,
  );
  intents.complete("/v1/appointments", body);
  assert.notEqual(intents.for("/v1/appointments", body), key);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { OperationalIntent } from "../src/hms/operational-intent.ts";
import { HmsError } from "../src/hms/client.ts";
test("unknown replay preserves the original body/key and refuses new intent", async () => {
  const sent: any[] = [];
  const command = new OperationalIntent(
    async (_, options) => {
      sent.push(options);
      if (sent.length === 1) throw new HmsError("timeout");
      return { id: "saved" };
    },
    () => 1,
  );
  const body = { name: "Original", idempotency_key: "old-editor-key" };
  await assert.rejects(command.execute("/create", { body }, true));
  body.name = "Changed";
  await assert.rejects(command.execute("/create", { body }, true));
  await command.replay();
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(sent[1].body.name, "Original");
  assert.equal(command.unknown, false);
});
test("non-keyed unknown cannot replay; failed lookup keeps it frozen", async () => {
  const command = new OperationalIntent(
    async () => {
      throw new HmsError("timeout");
    },
    () => 1,
  );
  await assert.rejects(command.execute("/policy", { body: { enabled: true } }));
  await assert.rejects(command.replay());
  assert.equal(await command.check(async () => false), false);
  assert.equal(command.unknown, true);
  assert.equal(
    await command.check(
      async (intent) => (intent.options.body as any).enabled === true,
    ),
    true,
  );
  assert.equal(command.unknown, false);
});
test("pending double clicks and workspace changes cannot resend", async () => {
  let release!: () => void;
  let revision = 1;
  let calls = 0;
  const command = new OperationalIntent(
    async () => {
      calls++;
      await new Promise<void>((r) => {
        release = r;
      });
      throw new HmsError("timeout");
    },
    () => revision,
  );
  const pending = command.execute("/accept", {}, true);
  await assert.rejects(command.execute("/accept", {}, true));
  release();
  await assert.rejects(pending);
  revision = 2;
  await assert.rejects(command.replay());
  await assert.rejects(command.check(async () => true));
  assert.equal(calls, 1);
  assert.equal(command.unknown, true);
});
test("refusal is not success, and replay refusals never erase prior uncertainty", async () => {
  let calls = 0;
  const command = new OperationalIntent(
    async () => {
      throw ++calls === 1
        ? new HmsError("timeout")
        : new HmsError("permission revoked", 403, "forbidden");
    },
    () => 1,
  );
  await assert.rejects(command.execute("/grant", {}, true));
  await assert.rejects(command.replay());
  assert.equal(command.unknown, true);
  assert.equal(command.failure?.status, 403);
});

test("only explicitly supported legacy commands are replayable", async () => {
  const { legacyKeyed } = await import("../src/hms/operational-intent.ts");
  assert.equal(
    legacyKeyed("/api/v1/admin/waitlist-offers/offer-id/accept"),
    true,
  );
  assert.equal(
    legacyKeyed("/api/v1/admin/waitlist-offers/offer-id/decline"),
    false,
  );
  assert.equal(
    legacyKeyed("/api/v1/admin/waitlist/request-id/withdraw"),
    false,
  );
  assert.equal(legacyKeyed("/api/v1/admin/booking-policy", "PUT"), false);
  assert.equal(legacyKeyed("/api/v1/staff/users/person-id/grants"), true);
});
test("settings section deep links respect permissions and reject invalid sections", async () => {
  const { settingsSection } = await import("../src/hms/settings-sections.ts");
  assert.equal(
    settingsSection("booking", ["team", "booking", "account"]),
    "booking",
  );
  assert.equal(settingsSection("modules", ["account"]), "account");
  assert.equal(
    settingsSection("invalid", ["team", "roles", "account"]),
    "team",
  );
});
test("schedule recovery allowlist preserves preview and cancellation boundaries", async () => {
  const { legacyKeyed } = await import("../src/hms/operational-intent.ts");
  assert.equal(
    legacyKeyed("/api/v1/admin/schedule-timeline/weekly", "PUT"),
    true,
  );
  assert.equal(
    legacyKeyed("/api/v1/admin/schedule-timeline/weekly/preview"),
    false,
  );
  assert.equal(legacyKeyed("/api/v1/admin/schedule-exceptions/preview"), false);
  assert.equal(legacyKeyed("/api/v1/admin/schedule-exceptions"), true);
  assert.equal(legacyKeyed("/api/v1/admin/schedule-timeline/open"), true);
  assert.equal(
    legacyKeyed("/api/v1/admin/schedule-timeline/appointments"),
    true,
  );
  assert.equal(
    legacyKeyed(
      "/api/v1/admin/schedule-timeline/appointments/00000000-0000-0000-0000-000000000001/move",
    ),
    true,
  );
  assert.equal(
    legacyKeyed(
      "/api/v1/admin/schedule-timeline/appointments/00000000-0000-0000-0000-000000000001",
      "DELETE",
    ),
    false,
  );
});

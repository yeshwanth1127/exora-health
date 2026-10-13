import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPatient, createTenant } from "../../../../db/tests/db.ts";
import { startKit, localDay, type Kit, type Person } from "./test-kit.ts";
import {
  loadChannelSettings,
  recordingBytes,
  websiteActivity,
  type ChannelSettings,
} from "../modules/comms/voice-growth.ts";
let k: Kit,
  admin: Person,
  desk: Person,
  nurse: Person,
  otherFacility: string,
  patient: string,
  resource: string;
let network = 0;
const settings: ChannelSettings = {
  recordingHosts: ["recordings.example.com"],
  bookingHosts: ["booking.example.com"],
  fetcher: async () => {
    network++;
    return new Response(new Uint8Array([82, 73, 70, 70]), {
      headers: { "content-type": "audio/wav" },
    });
  },
};
const secret = "local-test-runtime-secret-32-characters";
const startedAt = new Date(Date.now() - 3600000).toISOString();
const consent = () => ({
  recordingAllowed: true,
  transcriptAllowed: true,
  evidence: "Recorded affirmative consent",
  occurredAt: startedAt,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});
const event = (extra: Record<string, unknown> = {}) => ({
  eventId: randomUUID(),
  sessionId: randomUUID(),
  sequence: 1,
  startedAt,
  status: "completed",
  endedAt: new Date(Date.now() - 3500000).toISOString(),
  ...extra,
});
async function ingest(data: unknown, auth = secret) {
  const r = await k.app.inject({
    method: "POST",
    url: "/integrations/voice/events",
    headers: { "x-voice-secret": auth },
    payload: data as object,
  });
  return { status: r.statusCode, body: r.json() };
}
const ok = (r: { status: number; body: any }, status = 200) => {
  expect(r, JSON.stringify(r.body)).toMatchObject({ status });
  return r.body;
};
const facility = () => k.tenant.facilityId;
const link = () => `/v1/facilities/${facility()}/booking-link`;
const history = () => `/v1/voice-calls?facilityId=${facility()}`;
async function appointment(
  status: string,
  date: string,
  created: string,
  from?: string,
) {
  const id = randomUUID();
  await k.admin.query(
    `INSERT INTO booking.appointment(id,tenant_id,confirmation_code,patient_id,practitioner_staff_id,resource_id,facility_id,session_on,booking_kind,origin_channel,status,created_at,rescheduled_from_id,cancelled_at,cancel_reason,checked_in_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'walk_in','voice',$9,$10,$11,CASE WHEN $9='cancelled' THEN now() END,CASE WHEN $9='cancelled' THEN 'Moved' END,CASE WHEN $9 IN('checked_in','completed') THEN now() END,CASE WHEN $9='completed' THEN now() END)`,
    [
      id,
      k.tenant.tenantId,
      randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
      patient,
      admin.staffId,
      resource,
      facility(),
      date,
      status,
      created,
      from ?? null,
    ],
  );
  return id;
}
beforeAll(async () => {
  k = await startKit("voice-growth", settings);
  admin = await k.person("Admin", "tenant_admin", null);
  desk = await k.person("Desk", "front_desk", facility());
  nurse = await k.person("Nurse", "nurse", facility(), "nurse");
  settings.voice = {
    tenantId: k.tenant.tenantId,
    facilityId: facility(),
    accountId: "verified-runtime",
    secret,
    agentVersion: 3,
  };
  otherFacility = ok(
    await k.call(
      admin,
      "POST",
      "/v1/facilities",
      {
        code: "OTHER",
        name: "Other clinic",
        facilityType: "clinic",
        stateCode: "29",
      },
      true,
    ),
    201,
  ).facilityId;
  patient = await createPatient(k.admin, k.tenant.tenantId);
  const {
    rows: [r],
  } = await k.admin.query(
    `INSERT INTO booking.schedulable_resource(tenant_id,kind,staff_id,name) VALUES($1,'practitioner',$2,'Clinician') RETURNING id`,
    [k.tenant.tenantId, admin.staffId],
  );
  resource = r.id;
});
afterAll(() => k.close());
describe("manual Google booking links", () => {
  it("requires permission and validates HTTPS, credentials and token-bearing URLs", async () => {
    for (const bookingUrl of [
      "http://example.com/book",
      "https://u:p@example.com/book",
      "https://example.com/book?token=private",
      "https://example.com/book#secret",
    ])
      expect(
        (await k.call(admin, "PUT", link(), { bookingUrl, version: 0 }, true))
          .status,
      ).toBe(400);
    expect(
      (
        await k.call(
          admin,
          "PUT",
          link(),
          { bookingUrl: "https://unapproved.example.com", version: 0 },
          true,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await k.call(
          desk,
          "PUT",
          link(),
          { bookingUrl: "https://booking.example.com", version: 0 },
          true,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await k.call(
          desk,
          "GET",
          `/v1/booking-links?facilityId=${otherFacility}`,
        )
      ).status,
    ).toBe(403);
  });
  it("persists a link, deduplicates retry, rejects stale update and records the server actor", async () => {
    const body = {
        bookingUrl: "https://booking.example.com/clinic",
        version: 0,
      },
      key = randomUUID();
    const saved = ok(await k.call(admin, "PUT", link(), body, key));
    expect(saved.version).toBe(1);
    expect(ok(await k.call(admin, "PUT", link(), body, key))).toEqual(saved);
    expect(
      (
        await k.call(
          admin,
          "PUT",
          link(),
          { ...body, bookingUrl: "https://booking.example.com/new" },
          true,
        )
      ).status,
    ).toBe(409);
    expect(
      ok(
        await k.call(desk, "GET", `/v1/booking-links?facilityId=${facility()}`),
      ).items[0],
    ).toEqual(saved);
    const changes = ok(
      await k.call(
        admin,
        "GET",
        `/v1/booking-links/changes?facilityId=${facility()}`,
      ),
    );
    expect(changes.items).toHaveLength(1);
    expect(changes.items[0]).toMatchObject({
      actorName: "Admin",
      before: null,
      after: body.bookingUrl,
    });
  });
});
describe("growth denominators, scope and reschedule cohorts", () => {
  it("returns null for empty denominators and refuses invalid or cross-clinic filters", async () => {
    const url = `/v1/growth/summary?facilityId=${facility()}&from=2020-01-01&to=2020-01-02`;
    expect(ok(await k.call(admin, "GET", url))).toMatchObject({
      appointmentsInCohort: 0,
      attendanceRateResolved: null,
      retainedConfirmationShare: null,
      byAcquisitionSource: {},
      sources: { acquisition: "not_tracked" },
    });
    expect(
      (await k.call(admin, "GET", url.replace("2020-01-02", "2019-01-01")))
        .status,
    ).toBe(400);
    expect(
      (await k.call(desk, "GET", url.replace(facility(), otherFacility)))
        .status,
    ).toBe(403);
  });
  it("counts the successor once by root creation date and handles untimed ended visits", async () => {
    const root = await appointment(
      "cancelled",
      "2025-01-01",
      "2025-01-01T23:00:00+05:30",
    );
    await appointment(
      "confirmed",
      "2025-02-01",
      "2025-02-01T10:00:00+05:30",
      root,
    );
    await appointment("completed", "2025-01-01", "2025-01-01T23:30:00+05:30");
    await appointment("no_show", "2025-01-01", "2025-01-01T23:45:00+05:30");
    const result = ok(
      await k.call(
        admin,
        "GET",
        `/v1/growth/summary?facilityId=${facility()}&from=2025-01-01&to=2025-01-01&cohort=created`,
      ),
    );
    expect(result).toMatchObject({
      appointmentsInCohort: 3,
      retainedConfirmationShare: 200 / 3,
      attendanceRateResolved: 50,
      byStatus: { confirmed: 1, completed: 1, no_show: 1 },
      byChannel: { voice: 3 },
    });
    const moved = ok(
      await k.call(
        admin,
        "GET",
        `/v1/growth/summary?facilityId=${facility()}&from=2025-02-01&to=2025-02-01&cohort=visit`,
      ),
    );
    expect(moved.appointmentsInCohort).toBe(1);
    expect(moved.byStatus).toEqual({ confirmed: 1 });
  });
  it("does not treat a current untimed checked-in visit as ended", async () => {
    await appointment("checked_in", localDay(), "2025-03-01T10:00:00+05:30");
    const r = ok(
      await k.call(
        admin,
        "GET",
        `/v1/growth/summary?facilityId=${facility()}&from=2025-03-01&to=2025-03-01&cohort=created`,
      ),
    );
    expect(r.attendanceRateResolved).toBeNull();
  });
  it("does no PostHog request when unconfigured and keeps provider failures unavailable", async () => {
    const before = network;
    const r = ok(
      await k.call(
        admin,
        "GET",
        `/v1/growth/website-activity?facilityId=${facility()}&from=2025-01-01&to=2025-01-02`,
      ),
    );
    expect(r).toMatchObject({ status: "not_configured", rows: [] });
    expect(network).toBe(before);
    const scoped = {
      ...settings,
      posthog: {
        tenantId: k.tenant.tenantId,
        facilityId: facility(),
        host: "https://us.posthog.com",
        project: "123",
        key: "test",
      },
      fetcher: async () => Response.json({ results: [["$pageview", 5, 3]] }),
    };
    const caller = {
      tenantId: k.tenant.tenantId,
      actor: { kind: "staff" as const, staffId: admin.staffId },
    };
    const q = {
      facilityId: facility(),
      from: "2025-01-01",
      to: "2025-01-02",
      traffic: "production" as const,
    };
    expect(
      await websiteActivity(caller, q, "Asia/Kolkata", scoped),
    ).toMatchObject({
      status: "available",
      rows: [{ event: "$pageview", events: 5, visitors: 3 }],
    });
    expect(
      await websiteActivity(caller, q, "Asia/Kolkata", {
        ...scoped,
        fetcher: async () =>
          Response.json({ results: [["patient_name", 1, 1]] }),
      }),
    ).toMatchObject({ status: "unavailable", rows: [] });
  });
});
describe("authenticated Voice runtime and private review", () => {
  it("rejects bad runtime authentication and browser-selected tenant/facility", async () => {
    expect((await ingest(event(), "wrong")).status).toBe(401);
    expect((await ingest(event({ tenantId: k.tenant.tenantId }))).status).toBe(
      400,
    );
  });
  it("deduplicates event ids, detects altered retry and ignores an older sequence", async () => {
    const e = event();
    const a = ok(await ingest(e));
    expect(ok(await ingest(e))).toEqual(a);
    expect((await ingest({ ...e, status: "error" })).status).toBe(409);
    expect(
      ok(await ingest({ ...e, eventId: randomUUID(), sequence: 0 })),
    ).toMatchObject({ ignored: true });
    const rows = await k.admin.query(
      "SELECT count(*)::int AS n FROM comms.voice_call WHERE tenant_id=$1 AND session_id=$2",
      [k.tenant.tenantId, e.sessionId],
    );
    expect(rows.rows[0].n).toBe(1);
  });
  it("does not infer consent or store unsolicited transcript turns", async () => {
    const c = ok(
      await ingest(
        event({
          turns: [
            {
              role: "user",
              originalText: "private test text",
              englishText: null,
            },
          ],
        }),
      ),
    );
    expect(
      (
        await k.admin.query(
          "SELECT count(*)::int AS n FROM comms.voice_transcript WHERE call_id=$1",
          [c.callId],
        )
      ).rows[0].n,
    ).toBe(0);
    const r = await k.call(
      admin,
      "GET",
      `/v1/voice-calls/${c.callId}/transcript`,
    );
    expect(r.status).toBe(422);
    const log = ok(
      await k.call(
        admin,
        "GET",
        `/v1/voice-recording-access?facilityId=${facility()}`,
      ),
    );
    expect(
      log.items.some(
        (v: any) =>
          v.callId === c.callId && v.outcome === "transcript_no_consent",
      ),
    ).toBe(true);
  });
  it("keeps consented revisions, audits review and never exposes a provider recording URL", async () => {
    const e = event({
      consent: consent(),
      recordingUrl: "https://recordings.example.com/private.wav",
      turns: [
        {
          role: "user",
          originalText: "Original test",
          englishText: "English test",
        },
      ],
    });
    const c = ok(await ingest(e));
    ok(
      await ingest({
        ...e,
        eventId: randomUUID(),
        sequence: 2,
        turns: [
          { role: "agent", originalText: "Second revision", englishText: null },
        ],
      }),
    );
    expect(
      (
        await k.admin.query(
          "SELECT count(*)::int AS n FROM comms.voice_transcript_revision WHERE call_id=$1",
          [c.callId],
        )
      ).rows[0].n,
    ).toBe(2);
    expect(
      ok(await k.call(desk, "GET", `/v1/voice-calls/${c.callId}/transcript`)),
    ).toMatchObject({
      source: "runtime",
      turns: [{ originalText: "Second revision" }],
    });
    const h = ok(await k.call(admin, "GET", history()));
    expect(JSON.stringify(h)).not.toContain("private.wav");
    expect(JSON.stringify(h)).not.toContain("Second revision");
    const denied = await k.call(
      desk,
      "GET",
      `/v1/voice-calls/${c.callId}/recording`,
    );
    expect(denied.status).toBe(403);
    const audio = await k.app.inject({
      method: "GET",
      url: `/v1/voice-calls/${c.callId}/recording`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(audio.statusCode).toBe(200);
    expect(audio.headers["cache-control"]).toBe("no-store");
    expect(audio.headers["content-type"]).toContain("audio/wav");
    const logs = ok(
      await k.call(
        admin,
        "GET",
        `/v1/voice-recording-access?facilityId=${facility()}`,
      ),
    );
    expect(
      logs.items
        .filter((v: any) => v.callId === c.callId)
        .map((v: any) => v.outcome),
    ).toEqual(
      expect.arrayContaining([
        "recording_forbidden",
        "recording_allowed",
        "transcript_allowed",
      ]),
    );
  });
  it("refuses expired consent and arbitrary recording hosts without a provider fetch", async () => {
    const before = network;
    expect(
      (
        await ingest(
          event({
            consent: consent(),
            recordingUrl: "https://localhost/private.wav",
          }),
        )
      ).status,
    ).toBe(400);
    const c = ok(
      await ingest(
        event({
          consent: {
            ...consent(),
            expiresAt: new Date(Date.now() - 1000).toISOString(),
          },
          recordingUrl: "https://recordings.example.com/expired.wav",
        }),
      ),
    );
    expect(
      (await k.call(admin, "GET", `/v1/voice-calls/${c.callId}/recording`))
        .status,
    ).toBe(422);
    expect(network).toBe(before);
  });
  it("verifies real voice-booked references and pinned version", async () => {
    expect((await ingest(event({ status: "booked" }))).status).toBe(400);
    expect(
      (
        await ingest(
          event({ appointmentId: randomUUID(), confirmationCode: "FAKEBOOK" }),
        )
      ).status,
    ).toBe(400);
    expect((await ingest(event({ agentVersion: 99 }))).status).toBe(400);
    const a = await appointment(
      "confirmed",
      localDay(),
      "2025-04-01T10:00:00+05:30",
    );
    const row = (
      await k.admin.query(
        "SELECT confirmation_code FROM booking.appointment WHERE id=$1",
        [a],
      )
    ).rows[0];
    const c = ok(
      await ingest(
        event({
          status: "booked",
          appointmentId: a,
          confirmationCode: row.confirmation_code,
        }),
      ),
    );
    expect(
      ok(await k.call(admin, "GET", history())).items.find(
        (v: any) => v.id === c.callId,
      ).appointment.id,
    ).toBe(a);
  });
  it("enforces facility/role/tenant scope for history and sensitive review", async () => {
    expect(
      (await k.call(desk, "GET", `/v1/voice-calls?facilityId=${otherFacility}`))
        .status,
    ).toBe(403);
    expect((await k.call(nurse, "GET", history())).status).toBe(403);
    const foreign = await createTenant(k.admin, "foreign-voice");
    const {
      rows: [c],
    } = await k.admin.query(
      `INSERT INTO comms.voice_call(tenant_id,facility_id,runtime_account_id,session_id,last_sequence,status,started_at) VALUES($1,$2,'foreign','call',0,'active',now()) RETURNING id`,
      [foreign.tenantId, foreign.facilityId],
    );
    expect(
      (await k.call(admin, "GET", `/v1/voice-calls/${c.id}/transcript`)).status,
    ).toBe(404);
  });
  it("allows consent withdrawal during suspension while rejecting new callbacks and writes", async () => {
    const e = event({
      consent: consent(),
      turns: [{ role: "user", originalText: "Sensitive", englishText: null }],
    });
    const c = ok(await ingest(e));
    await k.admin.query(
      `INSERT INTO platform.module_state(tenant_id,module_code,state) VALUES($1,'comms','suspended') ON CONFLICT(tenant_id,module_code) DO UPDATE SET state='suspended'`,
      [k.tenant.tenantId],
    );
    try {
      expect((await ingest(event())).status).toBe(422);
      ok(
        await ingest({
          ...e,
          eventId: randomUUID(),
          sequence: 2,
          consent: {
            ...consent(),
            recordingAllowed: false,
            transcriptAllowed: false,
          },
        }),
      );
      expect(
        (await k.call(admin, "GET", `/v1/voice-calls/${c.callId}/transcript`))
          .status,
      ).toBe(422);
      expect(
        (
          await k.call(
            admin,
            "PUT",
            link(),
            { bookingUrl: "https://booking.example.com/new", version: 1 },
            true,
          )
        ).status,
      ).toBe(422);
    } finally {
      await k.admin.query(
        `UPDATE platform.module_state SET state='active' WHERE tenant_id=$1 AND module_code='comms'`,
        [k.tenant.tenantId],
      );
    }
  });
  it("applies late withdrawals before sequence checks and never revives an old opt-in", async () => {
    const e = event({
      sequence: 10,
      consent: consent(),
      turns: [{ role: "user", originalText: "Original", englishText: null }],
    });
    const c = ok(await ingest(e));
    ok(
      await ingest({
        ...e,
        eventId: randomUUID(),
        sequence: 1,
        consent: {
          ...consent(),
          recordingAllowed: false,
          transcriptAllowed: false,
        },
      }),
    );
    expect(
      (await k.call(admin, "GET", `/v1/voice-calls/${c.callId}/transcript`))
        .status,
    ).toBe(422);
    ok(await ingest({ ...e, eventId: randomUUID(), sequence: 11 }));
    expect(
      (await k.call(admin, "GET", `/v1/voice-calls/${c.callId}/transcript`))
        .status,
    ).toBe(422);
    expect(
      (
        await k.admin.query(
          "SELECT count(*)::int AS n FROM comms.voice_consent_event WHERE call_id=$1",
          [c.callId],
        )
      ).rows[0].n,
    ).toBe(3);
  });
  it("rejects unsafe deployment config and invalid audio responses", async () => {
    expect(() =>
      loadChannelSettings({ VOICE_CALLBACK_SECRET: "short" }),
    ).toThrow();
    expect(() =>
      loadChannelSettings({ VOICE_RECORDING_HOSTS: "127.0.0.1" }),
    ).toThrow();
    expect(() =>
      loadChannelSettings({
        POSTHOG_READ_KEY: "secret",
        POSTHOG_API_HOST: "https://evil.example.com",
      }),
    ).toThrow();
    await expect(
      recordingBytes("https://evil.example.com/audio.wav", settings),
    ).rejects.toThrow();
    await expect(
      recordingBytes("https://recordings.example.com/audio.wav", {
        ...settings,
        fetcher: async () =>
          new Response("html", { headers: { "content-type": "text/html" } }),
      }),
    ).rejects.toThrow();
  });
});

it("Overview counts persisted Voice sessions only with clinic-scoped Voice permission", async () => {
  const url = `/v1/operations/summary?facilityId=${facility()}&date=${localDay()}`;
  const before = ok(await k.call(admin, "GET", url)).summary.voiceSessions;
  expect(before).toBeTypeOf("number");
  ok(await ingest(event()));
  expect(ok(await k.call(admin, "GET", url)).summary.voiceSessions).toBe(
    before + 1,
  );
  expect(ok(await k.call(desk, "GET", url)).summary.voiceSessions).toBe(
    before + 1,
  );
  expect(ok(await k.call(nurse, "GET", url)).summary.voiceSessions).toBeNull();
  expect(
    ok(
      await k.call(
        admin,
        "GET",
        `/v1/operations/summary?facilityId=${otherFacility}&date=${localDay()}`,
      ),
    ).summary.voiceSessions,
  ).toBe(0);
  expect(
    (
      await k.call(
        desk,
        "GET",
        `/v1/operations/summary?facilityId=${otherFacility}&date=${localDay()}`,
      )
    ).status,
  ).toBe(403);
});

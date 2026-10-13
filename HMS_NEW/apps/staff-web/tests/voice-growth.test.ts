import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { growthSource } from "../src/hms/growth-source.ts";
import { voiceSource } from "../src/hms/voice-source.ts";
import type { Me, Facility } from "../src/hms/types.ts";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const facilityId = "00000000-0000-4000-8000-000000000001",
  callId = "00000000-0000-4000-8000-000000000002";
const facility = {
  facilityId,
  name: "Clinic",
  code: "F1",
  timezone: "Asia/Kolkata",
  facilityType: "clinic",
  status: "active",
} as Facility;
const me = {
  tenantId: "tenant",
  staffId: "staff",
  permissions: { "growth.read": [facilityId], "voice.read": [facilityId] },
} as Me;
test("Google link adapter preserves server version and idempotent command shape", async () => {
  const calls: { path: string; body: any; key: string | null }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      path: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
      key: new Headers(init?.headers).get("idempotency-key"),
    });
    return Response.json(
      init?.method === "PUT"
        ? {
            facilityId,
            bookingUrl: "https://booking.example.com/new",
            version: 5,
            updatedAt: "2026-10-12T10:00:00Z",
          }
        : {
            items: [
              {
                facilityId,
                bookingUrl: "https://booking.example.com/old",
                version: 4,
                updatedAt: "2026-10-12T10:00:00Z",
              },
            ],
          },
    );
  };
  const api = growthSource(me, facility);
  await api("/api/v1/admin/google/booking-links");
  await api(`/api/v1/admin/google/booking-links/${facilityId}`, {
    method: "PUT",
    body: { booking_url: "https://booking.example.com/new" },
  });
  assert.deepEqual(calls[1].body, {
    bookingUrl: "https://booking.example.com/new",
    version: 4,
  });
  assert.ok(calls[1].key);
  assert.equal(calls[1].path, `/v1/facilities/${facilityId}/booking-link`);
});
test("growth adapter forwards clinic-local cohort filters and keeps null denominators", async () => {
  let path = "";
  globalThis.fetch = async (url) => {
    path = String(url);
    return Response.json({
      facilityId,
      from: "2026-10-01",
      to: "2026-10-12",
      timezone: "Asia/Kolkata",
      cohort: "visit",
      appointmentsInCohort: 0,
      retainedConfirmationShare: null,
      attendanceRateResolved: null,
      byStatus: {},
      byChannel: {},
      byAcquisitionSource: {},
      sources: { appointments: "persisted", acquisition: "not_tracked" },
    });
  };
  const r = await growthSource(
    me,
    facility,
  )<any>(
    "/api/v1/admin/growth/summary?start_date=2026-10-01&end_date=2026-10-12&cohort=visit",
  );
  const q = new URL(path, "http://local").searchParams;
  assert.equal(q.get("facilityId"), facilityId);
  assert.equal(q.get("cohort"), "visit");
  assert.equal(r.summary.attendance_rate_resolved, null);
  assert.deepEqual(r.by_acquisition_source, {});
});
test("growth adapter refuses cross-clinic filters before reading data", async () => {
  let reads = 0;
  globalThis.fetch = async () => {
    reads++;
    return Response.json({});
  };
  await assert.rejects(
    growthSource(
      me,
      facility,
    )("/api/v1/admin/growth/summary?branch_id=foreign"),
    /current clinic/,
  );
  assert.equal(reads, 0);
});
test("Voice adapter keeps transcript content separate and hides recording capability without permission", async () => {
  globalThis.fetch = async () =>
    Response.json({
      items: [
        {
          id: callId,
          sessionId: "runtime-session",
          status: "completed",
          startedAt: "2026-10-12T10:00:00Z",
          endedAt: "2026-10-12T10:01:00Z",
          agentVersion: 3,
          turnCount: 2,
          toolCalls: 1,
          appointment: null,
          recordingState: "eligible",
          transcriptState: "eligible",
          consentedAt: "2026-10-12T10:00:00Z",
          availableUntil: "2026-10-13T10:00:00Z",
        },
      ],
      total: 1,
      summary: { calls: 1, bookings: 0, errors: 0, completed: 1, toolCalls: 1 },
      nextCursor: null,
      configuration: {
        callsReady: true,
        recordingsReady: true,
        transcriptsReady: true,
        accessDays: 30,
        agentVersion: 3,
      },
    });
  const r = await voiceSource(me, facility).read<any>(
    "/api/v1/staff/voice?offset=0",
    new AbortController().signal,
  );
  assert.equal(r.can_review_recordings, false);
  assert.equal(r.calls[0].recording_state, "not_configured");
  assert.equal(r.calls[0].channel, "runtime");
  assert.equal(r.calls[0].last_intent, null);
  assert.equal("turns" in r.calls[0], false);
});
test("Voice transcript adapter turns legacy POST into an audited scoped GET", async () => {
  let path = "",
    method = "";
  globalThis.fetch = async (url, init) => {
    path = String(url);
    method = init?.method ?? "GET";
    return Response.json({
      source: "runtime",
      turns: [
        { role: "user", originalText: "Original", englishText: "English" },
      ],
    });
  };
  const r = await voiceSource(me, facility).write<any>(
    `/api/v1/staff/voice/sessions/${callId}/transcript`,
    { method: "POST" },
  );
  assert.equal(path, `/v1/voice-calls/${callId}/transcript`);
  assert.equal(method, "GET");
  assert.deepEqual(r.turns, [
    { role: "user", original_text: "Original", english_text: "English" },
  ]);
});

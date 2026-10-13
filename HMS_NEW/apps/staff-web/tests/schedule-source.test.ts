import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { scheduleSource } from "../src/hms/schedule-source.ts";
import type { Facility, Me } from "../src/hms/types.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const facility = {
  facilityId: "clinic-a",
  name: "Clinic A",
  city: "Bengaluru",
  timezone: "Asia/Kolkata",
  facilityType: "clinic",
} as Facility;
const me = {
  permissions: {
    "schedules.manage": ["clinic-a"],
    "appointments.book": ["clinic-a"],
    "appointments.reschedule": ["clinic-a"],
  },
} as Me;

test("original open-hours form sends virtual extra hours with a stable intent key", async () => {
  const calls: { path: string; body: any; headers: Record<string, string> }[] =
    [];
  globalThis.fetch = async (path, options) => {
    calls.push({
      path: String(path),
      body: JSON.parse(String(options?.body)),
      headers: options?.headers as Record<string, string>,
    });
    return Response.json({ scheduleExceptionId: "saved" });
  };
  const source = scheduleSource(me, facility, [], "2026-10-19", false);
  const body = {
    doctor_id: "doctor-a",
    branch_id: "clinic-a",
    schedule_date: "2026-10-19",
    starts_at_local: "16:00",
    ends_at_local: "17:00",
    slot_minutes: 15,
    consultation_type: "virtual",
  };
  await source.write!("/api/v1/admin/schedule-timeline/open", {
    method: "POST",
    body,
  });
  await source.write!("/api/v1/admin/schedule-timeline/open", {
    method: "POST",
    body,
  });
  assert.equal(calls[0].path, "/v1/practitioners/doctor-a/exceptions");
  assert.deepEqual(calls[0].body, {
    onDate: "2026-10-19",
    kind: "extra_hours",
    facilityId: "clinic-a",
    start: "16:00",
    end: "17:00",
    slotMinutes: 15,
    visitMode: "virtual",
  });
  assert.equal(
    calls[0].headers["Idempotency-Key"],
    calls[1].headers["Idempotency-Key"],
  );
});

test("original exact-time move holds the selected range before calling the normal reschedule route", async () => {
  const calls: { path: string; body: any }[] = [];
  const id = "00000000-0000-4000-8000-000000000001";
  globalThis.fetch = async (path, options) => {
    const route = String(path);
    calls.push({
      path: route,
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    });
    if (route === `/v1/appointments/${id}`)
      return Response.json({
        practitionerStaffId: "doctor-a",
        visitMode: "in_person",
      });
    if (route.includes("/slots?"))
      return Response.json({
        items: [
          {
            slotStart: "2026-10-19T04:30:00Z",
            slotEnd: "2026-10-19T04:45:00Z",
            visitMode: "in_person",
            status: "free",
          },
        ],
      });
    if (route === "/v1/holds/range")
      return Response.json({ reservationId: "exact-held" });
    return Response.json({ appointmentId: "replacement" });
  };
  const source = scheduleSource(me, facility, [], "2026-10-19", false);
  await source.write!(
    `/api/v1/admin/schedule-timeline/appointments/${id}/move`,
    {
      method: "POST",
      body: {
        starts_at: "2026-10-19T04:37:00Z",
        ends_at: "2026-10-19T04:59:00Z",
        reason: "Requested exact time",
        idempotency_key: "move-one",
      },
    },
  );
  assert.deepEqual(calls.slice(-2), [
    {
      path: "/v1/holds/range",
      body: {
        staffId: "doctor-a",
        startsAt: "2026-10-19T04:37:00Z",
        endsAt: "2026-10-19T04:59:00Z",
        holdMinutes: 5,
        visitMode: "in_person",
      },
    },
    {
      path: `/v1/appointments/${id}/reschedule`,
      body: { newReservationId: "exact-held", reason: "Requested exact time" },
    },
  ]);
});

const exactRangePath =
  "/api/v1/admin/schedule-timeline/check?" +
  new URLSearchParams({
    doctor_id: "doctor-a",
    branch_id: "clinic-a",
    starts_at: "2026-10-19T10:10:00+05:30",
    ends_at: "2026-10-19T10:45:00+05:30",
    consultation_type: "in_person",
  });

function rangePreflightFixture(mode = "in_person", occupied = false) {
  const calls: { path: string; method: string }[] = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path: String(path), method: options?.method ?? "GET" });
    return Response.json(
      String(path).includes("/sessions?")
        ? {
            items: [
              {
                facilityId: "clinic-a",
                visitMode: mode,
                slotMinutes: 30,
                startsAt: "2026-10-19T09:00:00+05:30",
                endsAt: "2026-10-19T12:00:00+05:30",
              },
            ],
          }
        : {
            items: [
              {
                slotStart: "2026-10-19T10:00:00+05:30",
                slotEnd: "2026-10-19T10:30:00+05:30",
                facilityId: "clinic-a",
                visitMode: mode,
                status: occupied ? "taken" : "free",
              },
              {
                slotStart: "2026-10-19T10:30:00+05:30",
                slotEnd: "2026-10-19T11:00:00+05:30",
                facilityId: "clinic-a",
                visitMode: mode,
                status: "free",
              },
            ],
          },
    );
  };
  return {
    source: scheduleSource(me, facility, [], "2026-10-19", false),
    calls,
  };
}

test("exact-range preflight accepts free time across slots within one published session without taking a hold", async () => {
  const { source, calls } = rangePreflightFixture();
  assert.deepEqual(
    await source.read(exactRangePath, new AbortController().signal),
    { overlapping_bookings: 0 },
  );
  assert.ok(calls.some((c) => c.path.includes("/sessions?")));
  assert.ok(calls.some((c) => c.path.includes("includeUnavailable=true")));
  assert.ok(calls.every((c) => c.method === "GET"));
});

test("exact-range preflight refuses an occupied slot intersecting the chosen range", async () => {
  const { source } = rangePreflightFixture("in_person", true);
  await assert.rejects(
    source.read(exactRangePath, new AbortController().signal),
    (error: { code?: string }) => error.code === "slot_unavailable",
  );
});

test("exact-range preflight refuses a range published for a different visit mode", async () => {
  const { source } = rangePreflightFixture("virtual");
  await assert.rejects(
    source.read(exactRangePath, new AbortController().signal),
    (error: { code?: string }) => error.code === "validation",
  );
});

test("exact-range preflight rejects another clinic before requesting availability", async () => {
  const { source, calls } = rangePreflightFixture();
  await assert.rejects(
    source.read(
      exactRangePath.replace("branch_id=clinic-a", "branch_id=clinic-b"),
      new AbortController().signal,
    ),
    (error: { code?: string }) => error.code === "facility_scope",
  );
  assert.equal(calls.length, 0);
});

function overbookingFixture({
  held = false,
  blocked = false,
  enabled = true,
  grant = true,
} = {}) {
  const calls: { path: string; method: string; body: any }[] = [];
  const first = {
    slotStart: "2026-10-19T10:00:00+05:30",
    slotEnd: "2026-10-19T10:30:00+05:30",
    facilityId: "clinic-a",
    visitMode: "in_person",
    status: blocked ? "blocked" : "taken",
  };
  const second = {
    ...first,
    slotStart: "2026-10-19T10:30:00+05:30",
    slotEnd: "2026-10-19T11:00:00+05:30",
  };
  const sessions = [
    {
      facilityId: "clinic-a",
      visitMode: "in_person",
      slotMinutes: 30,
      startsAt: "2026-10-19T09:00:00+05:30",
      endsAt: "2026-10-19T12:00:00+05:30",
    },
  ];
  globalThis.fetch = async (path, options) => {
    const route = String(path);
    calls.push({
      path: route,
      method: options?.method ?? "GET",
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    });
    if (route.includes("/calendar-board?"))
      return Response.json({
        asOf: "2026-10-18T09:00:00Z",
        rows: [
          {
            staffId: "doctor-a",
            sessions,
            slots: [first, second],
            holds: held
              ? [
                  {
                    startsAt: first.slotStart,
                    endsAt: first.slotEnd,
                    holdExpiresAt: "2026-10-19T11:00:00+05:30",
                  },
                ]
              : [],
            appointments: held
              ? []
              : [
                  {
                    startsAt: first.slotStart,
                    endsAt: second.slotEnd,
                    status: "confirmed",
                  },
                ],
            exceptions: [],
          },
        ],
      });
    if (route.includes("/sessions?")) return Response.json({ items: sessions });
    if (route.includes("/slots?"))
      return Response.json({ items: [first, second] });
    return Response.json({ appointmentId: "extra-saved" });
  };
  const permissions = {
    ...me.permissions,
    ...(grant ? { "appointments.overbook": ["clinic-a"] } : {}),
  };
  return {
    source: scheduleSource(
      { ...me, permissions },
      facility,
      [],
      "2026-10-19",
      enabled,
    ),
    calls,
  };
}
const wholeSlotPath = exactRangePath
  .replace("10%3A10%3A00", "10%3A00%3A00")
  .replace("10%3A45%3A00", "10%3A30%3A00");
const extraBody = {
  doctor_id: "doctor-a",
  branch_id: "clinic-a",
  consultation_type: "in_person",
  starts_at: "2026-10-19T10:00:00+05:30",
  ends_at: "2026-10-19T10:30:00+05:30",
  patient_name: "Local test",
  patient_phone: "+919900000001",
  overbook: true,
  overbook_reason: "Clinic approved extra",
  idempotency_key: "extra-one",
};

test("taken whole published slot automatically requires overbooking when setting and permission allow", async () => {
  const { source, calls } = overbookingFixture();
  assert.deepEqual(
    await source.read(wholeSlotPath, new AbortController().signal),
    { overlapping_bookings: 1, overbook_required: true },
  );
  await source.write!("/api/v1/admin/schedule-timeline/appointments", {
    method: "POST",
    body: extraBody,
  });
  const posts = calls.filter((c) => c.method === "POST");
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, "/v1/appointments/overbook");
  assert.equal(posts[0].body.slotStart, extraBody.starts_at);
  assert.equal(posts[0].body.overbookReason, extraBody.overbook_reason);
});
test("partial occupied range returns explicit whole-slot choices without changing requested endpoints", async () => {
  const { source } = overbookingFixture();
  const check: any = await source.read(
    exactRangePath,
    new AbortController().signal,
  );
  assert.equal(check.range_unsupported, true);
  assert.equal(check.overbook_required, undefined);
  assert.deepEqual(check.overbooking_slots, [
    {
      starts_at: "2026-10-19T10:00:00+05:30",
      ends_at: "2026-10-19T10:30:00+05:30",
    },
    {
      starts_at: "2026-10-19T10:30:00+05:30",
      ends_at: "2026-10-19T11:00:00+05:30",
    },
  ]);
});
test("overbooking refuses held and blocked time regardless of enabled policy", async () => {
  for (const [options, code] of [
    [{ held: true }, "slot_held"],
    [{ blocked: true }, "slot_blocked"],
  ] as const) {
    const { source, calls } = overbookingFixture(options);
    await assert.rejects(
      source.read(wholeSlotPath, new AbortController().signal),
      (e: { code?: string }) => e.code === code,
    );
    await assert.rejects(
      source.write!("/api/v1/admin/schedule-timeline/appointments", {
        method: "POST",
        body: extraBody,
      }),
      (e: { code?: string }) => e.code === code,
    );
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);
  }
});
test("overbooking cannot silently shorten partial or multi-slot requested ranges", async () => {
  for (const endpoints of [
    {
      starts_at: "2026-10-19T10:15:00+05:30",
      ends_at: "2026-10-19T10:30:00+05:30",
    },
    { starts_at: extraBody.starts_at, ends_at: "2026-10-19T11:00:00+05:30" },
  ]) {
    const { source, calls } = overbookingFixture();
    await assert.rejects(
      source.write!("/api/v1/admin/schedule-timeline/appointments", {
        method: "POST",
        body: { ...extraBody, ...endpoints },
      }),
      (e: { code?: string }) => e.code === "overbook_range_unsupported",
    );
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);
  }
});
test("overbooking requires both clinic policy and permission and an explicit reason", async () => {
  for (const options of [{ enabled: false }, { grant: false }]) {
    const { source, calls } = overbookingFixture(options);
    await assert.rejects(
      source.read(wholeSlotPath, new AbortController().signal),
      (e: { code?: string }) => e.code === "slot_unavailable",
    );
    await assert.rejects(
      source.write!("/api/v1/admin/schedule-timeline/appointments", {
        method: "POST",
        body: extraBody,
      }),
      (e: { code?: string }) => e.code === "forbidden",
    );
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);
  }
  const { source, calls } = overbookingFixture();
  await assert.rejects(
    source.write!("/api/v1/admin/schedule-timeline/appointments", {
      method: "POST",
      body: { ...extraBody, overbook_reason: "" },
    }),
    (e: { code?: string }) => e.code === "validation",
  );
  assert.equal(calls.length, 0);
});

const weeklyBodyForRecovery = {
  doctor_id: "doctor-a",
  branch_id: "clinic-a",
  consultation_type: "in_person",
  effective_from: "2026-10-19",
  effective_until: null,
  slot_minutes: 15,
  groups: [{ days: [0], windows: [{ start: "09:00", end: "13:00" }] }],
  idempotency_key: "original-weekly-intent",
};

test("confirmed weekly save is not turned into failure by a subsequent conflict read", async () => {
  const calls: { path: string; method: string; key?: string }[] = [];
  globalThis.fetch = async (path, options) => {
    calls.push({
      path: String(path),
      method: options?.method ?? "GET",
      key: ((options?.headers ?? {}) as Record<string, string>)[
        "Idempotency-Key"
      ],
    });
    if (options?.method === "PUT")
      return Response.json({
        affectedAppointmentIds: ["restricted-appointment"],
        canSave: true,
        otherPublishedHours: [],
      });
    return Response.json(
      { error: { code: "forbidden", message: "Read is not permitted" } },
      { status: 403 },
    );
  };
  const source = scheduleSource(me, facility, [], "2026-10-19", false);
  const result = await source.write!("/api/v1/admin/schedule-timeline/weekly", {
    method: "PUT",
    body: weeklyBodyForRecovery,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].key, "original-weekly-intent");
  assert.deepEqual(result, {
    affected_appointments: [],
    can_save: true,
    other_published_hours: [],
  });
});

test("weekly preview still fails closed if an affected appointment cannot be read", async () => {
  const methods: string[] = [];
  globalThis.fetch = async (_path, options) => {
    methods.push(options?.method ?? "GET");
    return options?.method === "POST"
      ? Response.json({
          affectedAppointmentIds: ["restricted-appointment"],
          canSave: false,
          otherPublishedHours: [],
        })
      : Response.json(
          { error: { code: "forbidden", message: "Read is not permitted" } },
          { status: 403 },
        );
  };
  const source = scheduleSource(me, facility, [], "2026-10-19", false);
  await assert.rejects(
    source.write!("/api/v1/admin/schedule-timeline/weekly/preview", {
      method: "POST",
      body: weeklyBodyForRecovery,
    }),
    /Read is not permitted/,
  );
  assert.deepEqual(methods, ["POST", "GET"]);
});

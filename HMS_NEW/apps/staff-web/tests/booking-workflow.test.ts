import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  activeAppointments,
  bookableSlots,
  upcomingPatientAppointments,
} from "../src/hms/booking-workflow.ts";
import type { Appointment, Slot } from "../src/hms/types.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const appointment = (appointmentId: string, status: string) =>
  ({ appointmentId, status }) as Appointment;

test("teleconsultation never falls back to an in-person or occupied slot", () => {
  const slots = [
    { slotStart: "in-person", visitMode: "in_person", status: "free" },
    { slotStart: "video-free", visitMode: "virtual", status: "free" },
    { slotStart: "video-booked", visitMode: "virtual", status: "booked" },
    { slotStart: "video-held", visitMode: "virtual", status: "held" },
  ] as Slot[];
  assert.deepEqual(
    bookableSlots(slots, "virtual").map((s) => s.slotStart),
    ["video-free"],
  );
  assert.deepEqual(bookableSlots(slots.slice(0, 1), "virtual"), []);
});

test("duplicate warning excludes closed bookings and the appointment being moved", () => {
  const items = [
    appointment("moving", "confirmed"),
    appointment("another", "confirmed"),
    appointment("arrived", "checked_in"),
    appointment("done", "completed"),
    appointment("cancelled", "cancelled"),
    appointment("missed", "no_show"),
  ];
  assert.deepEqual(
    activeAppointments(items, "moving").map((a) => a.appointmentId),
    ["another", "arrived"],
  );
});

test("existing-patient check follows pagination even when the first page has no active booking", async () => {
  const urls: URL[] = [];
  globalThis.fetch = async (input, options) => {
    assert.equal(options?.method, "GET");
    const url = new URL(String(input), "http://local.test");
    urls.push(url);
    assert.equal(url.searchParams.get("patientId"), "patient-one");
    assert.equal(url.searchParams.get("facilityId"), "clinic-one");
    assert.equal(url.searchParams.get("from"), "2026-10-12");
    return Response.json(
      url.searchParams.has("cursor")
        ? { items: [appointment("tomorrow", "confirmed")], nextCursor: null }
        : {
            items: [appointment("closed", "cancelled")],
            nextCursor: "page-two",
          },
    );
  };
  const items = await upcomingPatientAppointments(
    "clinic-one",
    "patient-one",
    "2026-10-12",
  );
  assert.equal(urls.length, 2);
  assert.equal(urls[1].searchParams.get("cursor"), "page-two");
  assert.deepEqual(
    items.map((a) => a.appointmentId),
    ["tomorrow"],
  );
});

test("failed later page cannot be reported as a clear duplicate check", async () => {
  globalThis.fetch = async (input) =>
    String(input).includes("cursor=")
      ? Response.json(
          { error: { code: "unavailable", message: "Temporary read failure" } },
          { status: 503 },
        )
      : Response.json({ items: [], nextCursor: "more" });
  await assert.rejects(() =>
    upcomingPatientAppointments("clinic", "patient", "2026-10-12"),
  );
});

test("repeated history cursor fails rather than looping or claiming a complete check", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ items: [], nextCursor: "same" });
  };
  await assert.rejects(
    () => upcomingPatientAppointments("clinic", "patient", "2026-10-12"),
    /completely/,
  );
  assert.equal(calls, 2);
});

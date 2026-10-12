import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPatient,
  createTenant,
  asTenant,
} from "../../../../db/tests/db.ts";
import { sql } from "@hms/db";
import { setTransactionContext } from "@hms/platform";
import { appointmentNotifications } from "../consumers.ts";
import { evaluateDueNotifications } from "../modules/comms/notifications.ts";
import {
  ist,
  localDay,
  nextMonday,
  startKit,
  type Kit,
  type Person,
} from "./test-kit.ts";
let k: Kit;
let admin: Person;
let desk: Person;
let nurse: Person;
let doctor: Person;
let patient: string;
let resource: string;
let clinic2: string;
const day = nextMonday(7);
const ok = (r: { status: number; body: any }, status = 200) => {
  expect(r, JSON.stringify(r.body)).toMatchObject({ status });
  return r.body;
};
beforeAll(async () => {
  k = await startKit("comms");
  admin = await k.person("Admin", "tenant_admin", null);
  desk = await k.person("Desk", "front_desk", k.tenant.facilityId);
  nurse = await k.person("Nurse", "nurse", k.tenant.facilityId, "nurse");
  doctor = await k.person("Doctor", "doctor", k.tenant.facilityId, "doctor");
  patient = await createPatient(k.admin, k.tenant.tenantId, "Contact owner");
  clinic2 = ok(
    await k.call(
      admin,
      "POST",
      "/v1/facilities",
      {
        code: "F2",
        name: "Other clinic",
        facilityType: "clinic",
        stateCode: "29",
      },
      true,
    ),
    201,
  ).facilityId;
  const department = ok(
    await k.call(
      admin,
      "POST",
      `/v1/facilities/${k.tenant.facilityId}/departments`,
      { code: "GM", name: "General Medicine" },
      true,
    ),
    201,
  ).departmentId;
  ok(
    await k.call(
      admin,
      "POST",
      `/v1/practitioners/${doctor.staffId}/affiliations`,
      {
        facilityId: k.tenant.facilityId,
        departmentId: department,
        validFrom: localDay(),
      },
      true,
    ),
    201,
  );
  ok(
    await k.call(
      admin,
      "POST",
      `/v1/departments/${department}/services`,
      {
        code: `CONS-${k.run}`,
        name: "Consultation",
        serviceMode: "in_person",
        defaultDurationMin: 15,
        feeMinor: 25000,
      },
      true,
    ),
    201,
  );
  resource = ok(
    await k.call(admin, "POST", `/v1/practitioners/${doctor.staffId}/calendar`),
    201,
  ).resourceId;
  ok(
    await k.call(
      admin,
      "PUT",
      `/v1/practitioners/${doctor.staffId}/weekly-plan`,
      {
        facilityId: k.tenant.facilityId,
        visitMode: "in_person",
        effectiveFrom: localDay(1),
        slotMinutes: 15,
        sessions: [{ weekday: 1, start: "09:00", end: "12:00" }],
      },
      true,
    ),
  );
});
afterAll(async () => k?.close());
let serial = 0;
const makeContact = async (
  owner = patient,
  facilityId = k.tenant.facilityId,
  address = `+91987654${String(++serial).padStart(4, "0")}`,
) =>
  ok(
    await k.call(
      admin,
      "POST",
      "/v1/contact-points",
      { facilityId, channel: "whatsapp", address, patientId: owner },
      true,
    ),
    201,
  );
const consent = async (
  id: string,
  purpose = "care",
  action = "opt_in",
  who = admin,
) =>
  k.call(
    who,
    "POST",
    `/v1/contact-points/${id}/consents`,
    {
      purpose,
      action,
      source: "staff",
      evidence: "Patient explicitly requested clinic messages",
      explicitOptIn: action === "opt_in",
    },
    true,
  );
const book = async (time: string, patientId = patient) => {
  const hold = ok(
    await k.call(
      desk,
      "POST",
      "/v1/holds",
      { staffId: doctor.staffId, slotStart: ist(day, time) },
      true,
    ),
    201,
  );
  return ok(
    await k.call(
      desk,
      "POST",
      "/v1/appointments",
      {
        reservationId: hold.reservationId,
        patientId,
        originChannel: "front_desk",
      },
      true,
    ),
    201,
  ).appointmentId as string;
};
const jobs = async (id: string) =>
  ok(await k.call(desk, "GET", `/v1/appointments/${id}/messages`))
    .items as any[];
async function replay(
  type: string,
  payload: Record<string, unknown>,
  started?: (pid: number) => void,
) {
  await k.db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, k.tenant.tenantId);
    await sql`SET LOCAL ROLE mod_comms`.execute(tx);
    if (started)
      started(
        (await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(tx))
          .rows[0]!.pid,
      );
    await appointmentNotifications.handle(tx, {
      id: randomUUID(),
      tenantId: k.tenant.tenantId,
      eventType: type,
      payload,
      occurredAt: new Date(),
      aggregateType: "booking.appointment",
      aggregateId: String(
        payload["appointmentId"] ?? payload["toAppointmentId"],
      ),
      aggregateVersion: null,
      correlationId: null,
      attempts: 1,
    });
  });
}
describe("communications foundation", () => {
  it("validates exactly one owner, rejects impersonated actor and affirmative consent without evidence", async () => {
    const base = {
      facilityId: k.tenant.facilityId,
      channel: "whatsapp",
      address: "+919876543201",
    };
    expect(
      (await k.call(admin, "POST", "/v1/contact-points", base, true)).status,
    ).toBe(400);
    expect(
      (
        await k.call(
          admin,
          "POST",
          "/v1/contact-points",
          { ...base, patientId: patient, bookingPartyId: randomUUID() },
          true,
        )
      ).status,
    ).toBe(400);
    const c = await makeContact();
    expect(
      (
        await k.call(
          admin,
          "POST",
          `/v1/contact-points/${c.id}/consents`,
          {
            purpose: "care",
            action: "opt_in",
            source: "staff",
            evidence: "Observed consent",
          },
          true,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await k.call(
          admin,
          "POST",
          `/v1/contact-points/${c.id}/consents`,
          {
            purpose: "care",
            action: "opt_in",
            source: "staff",
            evidence: "Observed consent",
            explicitOptIn: true,
            recordedBy: nurse.staffId,
          },
          true,
        )
      ).status,
    ).toBe(400);
  });
  it("scopes contact reads/writes to the clinic, records actor server-side and deduplicates retries", async () => {
    const input = {
      facilityId: k.tenant.facilityId,
      channel: "whatsapp",
      address: "+919876543202",
      patientId: patient,
    };
    const key = `contact-${k.run}`;
    const c = ok(
      await k.call(desk, "POST", "/v1/contact-points", input, key),
      201,
    );
    expect(
      ok(await k.call(desk, "POST", "/v1/contact-points", input, key), 201).id,
    ).toBe(c.id);
    expect(
      (
        await k.call(
          desk,
          "POST",
          "/v1/contact-points",
          { ...input, facilityId: clinic2 },
          true,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await k.call(
          nurse,
          "GET",
          `/v1/contact-points?facilityId=${k.tenant.facilityId}&patientId=${patient}`,
        )
      ).status,
    ).toBe(403);
    ok(await consent(c.id, "care", "opt_in", desk));
    const audit = (
      await k.admin.query(
        `SELECT actor_staff_id,diff FROM platform.audit_event WHERE subject_type='comms.messaging_consent_event' AND actor_staff_id=$1`,
        [desk.staffId],
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].diff).not.toHaveProperty("evidence");
    expect((await consent(c.id, "marketing", "opt_in", desk)).status).toBe(403);
  });
  it("masks phone lists for read-only roles and refuses known-contact owner-permission bypass", async () => {
    const c = await makeContact();
    const customPerson = async (name: string, permissions: string[]) => {
      const who = await k.person(name, "auditor", k.tenant.facilityId);
      await k.admin.query("DELETE FROM platform.role_grant WHERE staff_id=$1", [
        who.staffId,
      ]);
      const role = (
        await k.admin.query(
          "INSERT INTO platform.role(tenant_id,code,name) VALUES($1,$2,$2) RETURNING id",
          [k.tenant.tenantId, `comms_role_${++serial}`],
        )
      ).rows[0].id;
      await k.admin.query(
        "INSERT INTO platform.role_permission(role_id,permission_id) SELECT $1,id FROM platform.permission WHERE code=ANY($2::text[])",
        [role, permissions],
      );
      await k.admin.query(
        "INSERT INTO platform.role_grant(tenant_id,staff_id,role_id,facility_id) VALUES($1,$2,$3,$4)",
        [k.tenant.tenantId, who.staffId, role, k.tenant.facilityId],
      );
      return who;
    };
    const reader = await customPerson("Read only communications", [
      "comms.read",
      "patients.read",
    ]);
    const items = ok(
      await k.call(
        reader,
        "GET",
        `/v1/contact-points?facilityId=${k.tenant.facilityId}&patientId=${patient}`,
      ),
    ).items;
    const masked = items.find((item: any) => item.id === c.id).address;
    expect(masked).not.toBe(c.address);
    expect(masked.endsWith(c.address.slice(-4))).toBe(true);
    const isolated = await customPerson("Communications without owner access", [
      "comms.read",
      "comms.reply",
    ]);
    expect(
      (
        await k.call(
          isolated,
          "GET",
          `/v1/contact-points?facilityId=${k.tenant.facilityId}&patientId=${patient}`,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await k.call(
          isolated,
          "POST",
          "/v1/contact-points",
          {
            facilityId: k.tenant.facilityId,
            channel: "whatsapp",
            address: "+919876543298",
            patientId: patient,
          },
          true,
        )
      ).status,
    ).toBe(403);
    expect((await consent(c.id, "care", "opt_in", isolated)).status).toBe(403);
  });
  it("binds unregistered booking contacts only through appointments at the same clinic", async () => {
    const hold = ok(
      await k.call(
        desk,
        "POST",
        "/v1/holds",
        { staffId: doctor.staffId, slotStart: ist(day, "10:45") },
        true,
      ),
      201,
    );
    const visit = ok(
      await k.call(
        desk,
        "POST",
        "/v1/appointments",
        {
          reservationId: hold.reservationId,
          bookingParty: { name: "Caller", phone: "+919876543299" },
          originChannel: "front_desk",
        },
        true,
      ),
      201,
    );
    const bookingPartyId = (
      await k.admin.query(
        "SELECT booking_party_id FROM booking.appointment WHERE id=$1",
        [visit.appointmentId],
      )
    ).rows[0].booking_party_id;
    const input = {
      facilityId: k.tenant.facilityId,
      channel: "whatsapp",
      address: "+919876543299",
      bookingPartyId,
    };
    const c = ok(
      await k.call(desk, "POST", "/v1/contact-points", input, true),
      201,
    );
    expect(c.patientId).toBe(null);
    expect(c.bookingPartyId).toBe(bookingPartyId);
    expect(
      ok(
        await k.call(
          desk,
          "GET",
          `/v1/contact-points?facilityId=${k.tenant.facilityId}&bookingPartyId=${bookingPartyId}`,
        ),
      ).items,
    ).toHaveLength(1);
    expect(
      (
        await k.call(
          admin,
          "POST",
          "/v1/contact-points",
          { ...input, facilityId: clinic2 },
          true,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await k.call(
          admin,
          "GET",
          `/v1/contact-points?facilityId=${clinic2}&bookingPartyId=${bookingPartyId}`,
        )
      ).status,
    ).toBe(404);
  });
  it("STOP wins across same-address aliases and future contacts; a fresh opt-in restores only one purpose", async () => {
    const otherPatient = await createPatient(k.admin, k.tenant.tenantId);
    const address = "+919876543203";
    const a = await makeContact(patient, k.tenant.facilityId, address),
      b = await makeContact(otherPatient, clinic2, address);
    ok(await consent(a.id));
    ok(await consent(b.id, "reminders"));
    ok(await consent(b.id, "marketing"));
    ok(await consent(a.id, "care", "stop", desk));
    const list = ok(
      await k.call(
        admin,
        "GET",
        `/v1/contact-points?facilityId=${clinic2}&patientId=${otherPatient}`,
      ),
    );
    expect(list.items[0].consents).toEqual({
      care: false,
      reminders: false,
      marketing: false,
    });
    const futurePatient = await createPatient(k.admin, k.tenant.tenantId),
      future = await makeContact(futurePatient, clinic2, address);
    expect(future.consents).toEqual({
      care: false,
      reminders: false,
      marketing: false,
    });
    const renewed = ok(await consent(b.id, "reminders"));
    expect(renewed.consents).toEqual({
      care: false,
      reminders: true,
      marketing: false,
    });
  });
  it("reads records while suspended and still records STOP, but refuses new contacts and opt-ins", async () => {
    const c = await makeContact();
    ok(await consent(c.id));
    ok(
      await k.call(admin, "PUT", "/v1/modules/comms", {
        state: "suspended",
        version: 0,
        reason: "Pause communications",
      }),
    );
    expect(
      (
        await k.call(
          admin,
          "POST",
          "/v1/contact-points",
          {
            facilityId: k.tenant.facilityId,
            channel: "whatsapp",
            address: "+919876543210",
            patientId: patient,
          },
          true,
        )
      ).status,
    ).toBe(422);
    expect((await consent(c.id)).status).toBe(422);
    expect(ok(await consent(c.id, "care", "stop")).consents.care).toBe(false);
    expect(
      ok(
        await k.call(
          desk,
          "GET",
          `/v1/comms/capabilities?facilityId=${k.tenant.facilityId}`,
        ),
      ),
    ).toMatchObject({
      moduleStatus: "suspended",
      liveSending: false,
      transport: "log",
    });
    ok(
      await k.call(admin, "PUT", "/v1/modules/comms", {
        state: "active",
        version: 1,
        reason: "Resume communications",
      }),
    );
  });
  it("persists skipped-no-consent without a sendable message and never backfills it from a late opt-in", async () => {
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner),
      id = await book("09:00", owner);
    await k.dispatch();
    expect(await jobs(id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "confirmation",
          status: "skipped_no_consent",
          message: null,
        }),
      ]),
    );
    ok(await consent(c.id));
    await replay("appointment.confirmed", { appointmentId: id });
    expect(
      (await jobs(id)).find((j) => j.kind === "confirmation"),
    ).toMatchObject({
      status: "skipped_no_consent",
      message: null,
    });
  });
  it("persists confirmation and future reminder with purpose-specific consent, but log never delivers", async () => {
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner);
    ok(await consent(c.id));
    ok(await consent(c.id, "reminders"));
    const id = await book("09:15", owner);
    await k.dispatch();
    await replay("appointment.confirmed", { appointmentId: id });
    expect(await jobs(id)).toHaveLength(2);
    expect(
      (await k.call(doctor, "GET", `/v1/appointments/${id}/messages`)).status,
    ).toBe(403);
    expect(
      (await k.call(nurse, "GET", `/v1/appointments/${id}/messages`)).status,
    ).toBe(403);
    await evaluateDueNotifications(k.db);
    expect(
      (await jobs(id)).find((j) => j.kind === "confirmation"),
    ).toMatchObject({
      status: "queued",
      reason: "log_transport_no_delivery",
      message: { status: "queued", attempts: 0, transport: "log" },
    });
    expect((await jobs(id)).find((j) => j.kind === "day_before")).toMatchObject(
      {
        status: "scheduled",
        message: { status: "queued" },
      },
    );
    expect(JSON.stringify(await jobs(id))).not.toContain(c.address);
    await expect(
      asTenant(k.admin, k.tenant.tenantId, "mod_comms", (client) =>
        client.query(
          `UPDATE comms.outbound_message SET status='delivered' WHERE reminder_job_id IN(SELECT id FROM comms.reminder_job WHERE appointment_id=$1)`,
          [id],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("STOP after enqueue cancels queued messages and reminders atomically", async () => {
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner);
    ok(await consent(c.id));
    ok(await consent(c.id, "reminders"));
    const id = await book("09:30", owner);
    await k.dispatch();
    ok(await consent(c.id, "care", "stop"));
    await evaluateDueNotifications(k.db);
    expect(await jobs(id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "confirmation",
          status: "cancelled",
          reason: "consent_withdrawn",
          message: expect.objectContaining({ status: "cancelled" }),
        }),
        expect.objectContaining({ kind: "day_before", status: "cancelled" }),
      ]),
    );
  });
  it("rescheduling then reordered old confirmation/cancellation never revives predecessor or duplicates successor", async () => {
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner);
    ok(await consent(c.id));
    ok(await consent(c.id, "reminders"));
    const old = await book("09:45", owner);
    await k.dispatch();
    const hold = ok(
      await k.call(
        desk,
        "POST",
        "/v1/holds",
        { staffId: doctor.staffId, slotStart: ist(day, "10:00") },
        true,
      ),
      201,
    );
    const moved = ok(
      await k.call(
        desk,
        "POST",
        `/v1/appointments/${old}/reschedule`,
        {
          newReservationId: hold.reservationId,
          reason: "Patient requested a different time",
        },
        true,
      ),
    );
    const id = moved.appointmentId as string;
    await k.dispatch();
    await replay("appointment.cancelled", { appointmentId: old });
    await replay("appointment.confirmed", { appointmentId: old });
    await replay("appointment.rescheduled", {
      fromAppointmentId: old,
      toAppointmentId: id,
    });
    expect((await jobs(old)).every((j) => j.status === "cancelled")).toBe(true);
    expect(await jobs(id)).toHaveLength(2);
    expect(
      (await jobs(id)).filter((j) => j.kind === "reschedule"),
    ).toHaveLength(1);
  });
  it("cancellation creates a distinct care notice and invalidates confirmation/reminder work", async () => {
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner);
    ok(await consent(c.id));
    ok(await consent(c.id, "reminders"));
    const id = await book("10:15", owner);
    await k.dispatch();
    ok(
      await k.call(desk, "POST", `/v1/appointments/${id}/cancel`, {
        reason: "Patient cannot attend",
      }),
    );
    await k.dispatch();
    await replay("appointment.cancelled", { appointmentId: id });
    const rows = await jobs(id);
    expect(rows.filter((j) => j.kind === "cancellation")).toHaveLength(1);
    expect(rows.find((j) => j.kind === "cancellation")).toMatchObject({
      status: "scheduled",
    });
    expect(
      rows
        .filter((j) => j.kind !== "cancellation")
        .every((j) => j.status === "cancelled"),
    ).toBe(true);
  });
  it("takes the destination lock before job rows so concurrent STOP cannot deadlock", async () => {
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner);
    ok(await consent(c.id));
    ok(await consent(c.id, "reminders"));
    const id = await book("10:30", owner);
    await k.dispatch();
    ok(
      await k.call(desk, "POST", `/v1/appointments/${id}/cancel`, {
        reason: "Cancellation lock test",
      }),
    );
    const barrier = await k.admin.connect();
    let pending: Promise<void> | undefined;
    try {
      await barrier.query("BEGIN");
      await barrier.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`${k.tenant.tenantId}:whatsapp:${c.address}`],
      );
      let started!: (pid: number) => void;
      const pidReady = new Promise<number>((resolve) => {
        started = resolve;
      });
      pending = replay("appointment.cancelled", { appointmentId: id }, started);
      const pid = await pidReady;
      let blocked = false;
      for (let n = 0; n < 100; n++) {
        const row = (
          await k.admin.query(
            "SELECT wait_event FROM pg_stat_activity WHERE pid=$1",
            [pid],
          )
        ).rows[0];
        if (row?.wait_event === "advisory") {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      // With the old inverted order the worker already holds these rows and NOWAIT fails.
      const unlocked = await barrier.query(
        "SELECT id FROM comms.reminder_job WHERE appointment_id=$1 FOR UPDATE NOWAIT",
        [id],
      );
      expect(unlocked.rows).toHaveLength(2);
    } finally {
      await barrier.query("ROLLBACK");
      barrier.release();
      await pending;
    }
    const results = await Promise.all([
      consent(c.id, "care", "stop"),
      replay("appointment.cancelled", { appointmentId: id }),
    ]);
    expect(results[0]?.status).toBe(200);
    expect((await jobs(id)).every((j) => j.status === "cancelled")).toBe(true);
  });

  it("versioned local rules require manage scope, reject stale edits, and cancel old queued work", async () => {
    const rules = ok(
      await k.call(
        desk,
        "GET",
        `/v1/comms/followup-rules?facilityId=${k.tenant.facilityId}`,
      ),
    ).items;
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "day_before",
          enabled: true,
          delayHours: 24,
          version: 0,
          templateReady: false,
        }),
        expect.objectContaining({ kind: "same_day", enabled: false }),
      ]),
    );
    const body = {
      facilityId: k.tenant.facilityId,
      version: 0,
      enabled: true,
      delayHours: 2,
    };
    expect(
      (
        await k.call(
          desk,
          "PUT",
          "/v1/comms/followup-rules/same_day",
          body,
          true,
        )
      ).status,
    ).toBe(403);
    const key = `same-day-${k.run}`;
    const rule = ok(
      await k.call(
        admin,
        "PUT",
        "/v1/comms/followup-rules/same_day",
        body,
        key,
      ),
    );
    expect(rule.version).toBe(1);
    expect(
      ok(
        await k.call(
          admin,
          "PUT",
          "/v1/comms/followup-rules/same_day",
          body,
          key,
        ),
      ).version,
    ).toBe(1);
    expect(
      (
        await k.call(
          admin,
          "PUT",
          "/v1/comms/followup-rules/same_day",
          body,
          true,
        )
      ).status,
    ).toBe(409);
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner);
    ok(await consent(c.id));
    ok(await consent(c.id, "reminders"));
    const id = await book("11:00", owner);
    await k.dispatch();
    expect((await jobs(id)).find((j) => j.kind === "same_day")).toMatchObject({
      status: "scheduled",
    });
    ok(
      await k.call(
        admin,
        "PUT",
        "/v1/comms/followup-rules/same_day",
        { ...body, version: 1, enabled: false },
        true,
      ),
    );
    expect((await jobs(id)).find((j) => j.kind === "same_day")).toMatchObject({
      status: "cancelled",
      reason: "rule_disabled",
      message: expect.objectContaining({ status: "cancelled" }),
    });
    await replay("appointment.confirmed", { appointmentId: id });
    expect((await jobs(id)).filter((j) => j.kind === "same_day")).toHaveLength(
      1,
    );
  });
  it("manual follow-up requires completed versioned visit, queues once and remains valid after completion", async () => {
    ok(
      await k.call(
        admin,
        "PUT",
        "/v1/comms/followup-rules/follow_up",
        {
          facilityId: k.tenant.facilityId,
          version: 0,
          enabled: true,
          delayHours: 0,
        },
        true,
      ),
    );
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      c = await makeContact(owner);
    ok(await consent(c.id, "reminders"));
    const id = await book("11:15", owner);
    const request = {
      dueAt: new Date(ist(day, "12:30")).toISOString(),
      version: 1,
    };
    expect(
      (
        await k.call(
          desk,
          "POST",
          `/v1/appointments/${id}/followup`,
          request,
          true,
        )
      ).status,
    ).toBe(422);
    ok(
      await k.call(
        desk,
        "POST",
        `/v1/appointments/${id}/check-in`,
        {},
        true,
        ist(day, "11:15"),
      ),
    );
    await k.admin.query(
      "UPDATE booking.appointment SET status='completed',completed_at=$2::timestamptz WHERE id=$1",
      [id, ist(day, "11:30")],
    );
    const version = (
      await k.admin.query(
        "SELECT version FROM booking.appointment WHERE id=$1",
        [id],
      )
    ).rows[0].version;
    expect(
      (
        await k.call(
          desk,
          "POST",
          `/v1/appointments/${id}/followup`,
          request,
          true,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await k.call(
          nurse,
          "POST",
          `/v1/appointments/${id}/followup`,
          { ...request, version },
          true,
          ist(day, "11:45"),
        )
      ).status,
    ).toBe(403);
    const key = `follow-up-${k.run}`;
    const j = ok(
      await k.call(
        desk,
        "POST",
        `/v1/appointments/${id}/followup`,
        { ...request, version },
        key,
        ist(day, "11:45"),
      ),
    );
    expect(j).toMatchObject({
      kind: "follow_up",
      status: "scheduled",
      appointmentId: id,
    });
    expect(
      ok(
        await k.call(
          desk,
          "POST",
          `/v1/appointments/${id}/followup`,
          { ...request, version },
          key,
          ist(day, "11:45"),
        ),
      ).id,
    ).toBe(j.id);
    expect(
      (
        await k.call(
          desk,
          "POST",
          `/v1/appointments/${id}/followup`,
          { ...request, version },
          true,
          ist(day, "11:45"),
        )
      ).status,
    ).toBe(409);
    await k.admin.query(
      "UPDATE comms.reminder_job SET due_at=now()-interval '1 second' WHERE id=$1",
      [j.id],
    );
    await evaluateDueNotifications(k.db);
    expect(
      (await jobs(id)).find(
        (row) => row.id === j.id && row.kind === "follow_up",
      ),
    ).toMatchObject({
      status: "queued",
      reason: "log_transport_no_delivery",
    });
    ok(await consent(c.id, "reminders", "stop"));
    expect((await jobs(id)).find((j) => j.kind === "follow_up")).toMatchObject({
      status: "cancelled",
    });
  });
  it("waitlist-only callers can opt in, offer histories deduplicate and decline/expiry cannot revive offers", async () => {
    const entry = ok(
      await k.call(
        desk,
        "POST",
        "/v1/waitlist",
        {
          facilityId: k.tenant.facilityId,
          staffId: doctor.staffId,
          preferredFrom: day,
          preferredTo: day,
          bookingParty: { name: "Waitlist caller", phone: "+919876541111" },
        },
        true,
      ),
      201,
    );
    const row = ok(
      await k.call(
        desk,
        "GET",
        `/v1/waitlist?facilityId=${k.tenant.facilityId}`,
      ),
    ).items.find((r: any) => r.waitlistEntryId === entry.waitlistEntryId);
    expect(row.bookingPartyId).toBeTruthy();
    const c = ok(
      await k.call(
        desk,
        "POST",
        "/v1/contact-points",
        {
          facilityId: k.tenant.facilityId,
          bookingPartyId: row.bookingPartyId,
          channel: "whatsapp",
          address: "+919876541111",
        },
        true,
      ),
      201,
    );
    ok(await consent(c.id, "care", "opt_in", desk));
    const offer = ok(
      await k.call(
        desk,
        "POST",
        `/v1/waitlist/${entry.waitlistEntryId}/offer`,
        { slotStart: ist(day, "11:30") },
        true,
      ),
      201,
    );
    await k.dispatch();
    await evaluateDueNotifications(k.db);
    const read = async () =>
      ok(
        await k.call(
          desk,
          "GET",
          `/v1/waitlist-offers/${offer.offerId}/messages`,
        ),
      ).items;
    expect(await read()).toEqual([
      expect.objectContaining({
        appointmentId: null,
        offerId: offer.offerId,
        kind: "waitlist_offer",
        status: "queued",
      }),
    ]);
    expect(
      (
        await k.call(
          nurse,
          "GET",
          `/v1/waitlist-offers/${offer.offerId}/messages`,
        )
      ).status,
    ).toBe(403);
    ok(
      await k.call(
        desk,
        "POST",
        `/v1/waitlist-offers/${offer.offerId}/decline`,
        {},
      ),
    );
    await k.dispatch();
    expect((await read())[0]).toMatchObject({
      status: "cancelled",
      reason: "offer_inactive",
    });
    const second = ok(
      await k.call(
        desk,
        "POST",
        `/v1/waitlist/${entry.waitlistEntryId}/offer`,
        { slotStart: ist(day, "11:30") },
        true,
      ),
      201,
    );
    await k.dispatch();
    await evaluateDueNotifications(k.db);
    const current = ok(
      await k.call(
        desk,
        "GET",
        `/v1/waitlist-offers/${second.offerId}/messages`,
      ),
    ).items[0];
    await k.admin.query(
      "UPDATE comms.reminder_job SET expires_at=now()-interval '1 second' WHERE id=$1",
      [current.id],
    );
    await evaluateDueNotifications(k.db);
    expect(
      ok(
        await k.call(
          desk,
          "GET",
          `/v1/waitlist-offers/${second.offerId}/messages`,
        ),
      ).items[0],
    ).toMatchObject({
      status: "cancelled",
      reason: "expired",
    });
    await k.db.transaction().execute(async (tx) => {
      await setTransactionContext(tx, k.tenant.tenantId);
      await sql`SET LOCAL ROLE mod_comms`.execute(tx);
      await (
        await import("../consumers.ts")
      ).waitlistNotifications.handle(tx, {
        id: randomUUID(),
        tenantId: k.tenant.tenantId,
        eventType: "waitlist.offered",
        payload: { offerId: second.offerId },
        occurredAt: new Date(),
        aggregateType: "booking.waitlist_offer",
        aggregateId: second.offerId,
        aggregateVersion: null,
        correlationId: null,
        attempts: 1,
      });
    });
    expect(
      ok(
        await k.call(
          desk,
          "GET",
          `/v1/waitlist-offers/${second.offerId}/messages`,
        ),
      ).items,
    ).toHaveLength(1);
    expect(
      ok(
        await k.call(
          desk,
          "GET",
          `/v1/waitlist-offers/${second.offerId}/messages`,
        ),
      ).items[0].status,
    ).toBe("cancelled");
    ok(
      await k.call(
        desk,
        "POST",
        `/v1/waitlist/${entry.waitlistEntryId}/withdraw`,
        { reason: "Caller withdrew" },
      ),
    );
    await k.dispatch();
  });
  it("accepted waitlist offers cancel local notices and same-day rules cannot schedule on the previous clinic day", async () => {
    const entry = ok(
      await k.call(
        desk,
        "POST",
        "/v1/waitlist",
        {
          facilityId: k.tenant.facilityId,
          staffId: doctor.staffId,
          preferredFrom: day,
          preferredTo: day,
          bookingParty: { name: "Accepted caller", phone: "+919876541112" },
        },
        true,
      ),
      201,
    );
    const row = ok(
      await k.call(
        desk,
        "GET",
        `/v1/waitlist?facilityId=${k.tenant.facilityId}`,
      ),
    ).items.find((r: any) => r.waitlistEntryId === entry.waitlistEntryId);
    const c = ok(
      await k.call(
        desk,
        "POST",
        "/v1/contact-points",
        {
          facilityId: k.tenant.facilityId,
          bookingPartyId: row.bookingPartyId,
          channel: "whatsapp",
          address: "+919876541112",
        },
        true,
      ),
      201,
    );
    ok(await consent(c.id));
    const offer = ok(
      await k.call(
        desk,
        "POST",
        `/v1/waitlist/${entry.waitlistEntryId}/offer`,
        { slotStart: ist(day, "11:30") },
        true,
      ),
      201,
    );
    await k.dispatch();
    await evaluateDueNotifications(k.db);
    ok(
      await k.call(
        desk,
        "POST",
        `/v1/waitlist-offers/${offer.offerId}/accept`,
        {},
        true,
      ),
      201,
    );
    await k.dispatch();
    expect(
      ok(
        await k.call(
          desk,
          "GET",
          `/v1/waitlist-offers/${offer.offerId}/messages`,
        ),
      ).items[0],
    ).toMatchObject({
      status: "cancelled",
      reason: "offer_inactive",
    });
    const rule = ok(
      await k.call(
        desk,
        "GET",
        `/v1/comms/followup-rules?facilityId=${k.tenant.facilityId}`,
      ),
    ).items.find((r: any) => r.kind === "same_day");
    const enabled = ok(
      await k.call(
        admin,
        "PUT",
        "/v1/comms/followup-rules/same_day",
        {
          facilityId: k.tenant.facilityId,
          enabled: true,
          delayHours: 24,
          version: rule.version,
        },
        true,
      ),
    );
    const owner = await createPatient(k.admin, k.tenant.tenantId),
      patientContact = await makeContact(owner);
    ok(await consent(patientContact.id, "reminders"));
    const id = await book("11:45", owner);
    await k.dispatch();
    expect((await jobs(id)).find((j) => j.kind === "same_day")).toMatchObject({
      status: "skipped",
      reason: "outside_visit_day",
      message: null,
    });
    ok(
      await k.call(
        admin,
        "PUT",
        "/v1/comms/followup-rules/same_day",
        {
          facilityId: k.tenant.facilityId,
          enabled: false,
          delayHours: 2,
          version: enabled.version,
        },
        true,
      ),
    );
  });
  it("history keyset pages are stable and filters/summary remain facility scoped", async () => {
    const precisionRows = (
      await k.admin.query(
        "SELECT id FROM comms.reminder_job WHERE tenant_id=$1 AND facility_id=$2 ORDER BY id LIMIT 2",
        [k.tenant.tenantId, k.tenant.facilityId],
      )
    ).rows;
    for (const [i, r] of precisionRows.entries())
      await k.admin.query(
        "UPDATE comms.reminder_job SET created_at=$2::timestamptz WHERE id=$1",
        [r.id, `2099-01-01T00:00:00.12300${i + 1}Z`],
      );
    const precisionUrl = `/v1/outbound-messages?facilityId=${k.tenant.facilityId}&limit=1`;
    const precisionFirst = ok(await k.call(desk, "GET", precisionUrl));
    const precisionSecond = ok(
      await k.call(
        desk,
        "GET",
        `${precisionUrl}&cursor=${encodeURIComponent(precisionFirst.nextCursor)}`,
      ),
    );
    expect(precisionFirst.items[0].id).toBe(precisionRows[1].id);
    expect(precisionSecond.items[0].id).toBe(precisionRows[0].id);
    const url = `/v1/outbound-messages?facilityId=${k.tenant.facilityId}&limit=2`;
    const first = ok(await k.call(desk, "GET", url));
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = ok(
      await k.call(
        desk,
        "GET",
        `${url}&cursor=${encodeURIComponent(first.nextCursor)}`,
      ),
    );
    expect(
      second.items.some((r: any) =>
        first.items.some((s: any) => s.id === r.id),
      ),
    ).toBe(false);
    const filtered = ok(
      await k.call(desk, "GET", `${url}&kind=waitlist_offer&status=cancelled`),
    );
    expect(
      filtered.items.every(
        (r: any) => r.kind === "waitlist_offer" && r.status === "cancelled",
      ),
    ).toBe(true);
    expect((await k.call(desk, "GET", `${url}&cursor=bad`)).status).toBe(400);
    expect(
      (await k.call(desk, "GET", `/v1/outbound-messages?facilityId=${clinic2}`))
        .status,
    ).toBe(403);
    const summary = ok(
      await k.call(
        desk,
        "GET",
        `/v1/comms/summary?facilityId=${k.tenant.facilityId}`,
      ),
    );
    const actual = (
      await k.admin.query(
        "SELECT count(*)::int AS n FROM comms.reminder_job WHERE tenant_id=$1 AND facility_id=$2 AND status IN('scheduled','queued') AND expires_at>now()",
        [k.tenant.tenantId, k.tenant.facilityId],
      )
    ).rows[0].n;
    expect(summary.pending).toBe(actual);
    expect(summary.counts.scheduled + summary.counts.queued).toBe(actual);
    expect(
      (
        await k.call(
          nurse,
          "GET",
          `/v1/comms/summary?facilityId=${k.tenant.facilityId}`,
        )
      ).status,
    ).toBe(403);
    expect(
      (await k.call(desk, "GET", `/v1/comms/summary?facilityId=${clinic2}`))
        .status,
    ).toBe(403);
  });
  it("tenant RLS hides contact/message rows and refuses cross-tenant owner foreign keys", async () => {
    const other = await createTenant(k.admin, "comms-other"),
      alien = await createPatient(k.admin, other.tenantId);
    expect(
      (
        await k.call(
          admin,
          "POST",
          "/v1/contact-points",
          {
            facilityId: k.tenant.facilityId,
            channel: "whatsapp",
            address: "+919876543209",
            patientId: alien,
          },
          true,
        )
      ).status,
    ).toBe(404);
    const rows = await asTenant(
      k.admin,
      other.tenantId,
      "mod_comms",
      (client) => client.query("SELECT * FROM comms.contact_point"),
    );
    expect(rows.rows).toHaveLength(0);
  });
});

describe("post-visit local notifications and immediate controls", () => {
  const setRule = async (
    kind: string,
    enabled: boolean,
    delayHours: number,
  ) => {
    const rule = ok(
      await k.call(
        admin,
        "GET",
        `/v1/comms/followup-rules?facilityId=${k.tenant.facilityId}`,
      ),
    ).items.find((r: any) => r.kind === kind);
    return ok(
      await k.call(
        admin,
        "PUT",
        `/v1/comms/followup-rules/${kind}`,
        {
          facilityId: k.tenant.facilityId,
          enabled,
          delayHours,
          version: rule.version,
        },
        true,
      ),
    );
  };
  const terminalVisit = async (
    status: "completed" | "no_show",
    owner: string,
  ) => {
    const {
      rows: [r],
    } = await k.admin.query(
      `INSERT INTO booking.appointment(tenant_id,confirmation_code,patient_id,practitioner_staff_id,resource_id,facility_id,session_on,booking_kind,origin_channel,status,checked_in_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,'walk_in','front_desk',$7,CASE WHEN $7='completed' THEN now() END,CASE WHEN $7='completed' THEN now() END) RETURNING id,completed_at`,
      [
        k.tenant.tenantId,
        randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
        owner,
        doctor.staffId,
        resource,
        k.tenant.facilityId,
        status,
      ],
    );
    return r;
  };
  it("feedback/no-show default off, immediate rules default on and zero-delay is enforced", async () => {
    const rules = ok(
      await k.call(
        desk,
        "GET",
        `/v1/comms/followup-rules?facilityId=${k.tenant.facilityId}`,
      ),
    ).items;
    for (const kind of ["feedback", "no_show"])
      expect(rules.find((r: any) => r.kind === kind)).toMatchObject({
        enabled: false,
      });
    for (const kind of ["reschedule", "cancellation"])
      expect(rules.find((r: any) => r.kind === kind)).toMatchObject({
        enabled: true,
        delayHours: 0,
      });
    expect(
      (
        await k.call(
          admin,
          "PUT",
          "/v1/comms/followup-rules/reschedule",
          {
            facilityId: k.tenant.facilityId,
            enabled: true,
            delayHours: 1,
            version: 0,
          },
          true,
        )
      ).status,
    ).toBe(400);
  });
  it("creates deduplicated post-visit jobs from persisted outcomes, requires consent and respects STOP/rule changes", async () => {
    const p = await createPatient(
        k.admin,
        k.tenant.tenantId,
        "Post visit test",
      ),
      c = await makeContact(p);
    ok(await consent(c.id, "reminders"));
    const completed = await terminalVisit("completed", p);
    await replay("appointment.completed", { appointmentId: completed.id });
    expect(
      (await jobs(completed.id)).filter((j) => j.kind === "feedback"),
    ).toHaveLength(0);
    await setRule("feedback", true, 1);
    await replay("appointment.completed", { appointmentId: completed.id });
    await replay("appointment.completed", { appointmentId: completed.id });
    const feedback = (await jobs(completed.id)).filter(
      (j) => j.kind === "feedback",
    );
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ status: "scheduled" });
    expect(
      Date.parse(feedback[0].dueAt) - completed.completed_at.getTime(),
    ).toBe(3600000);
    await k.admin.query(
      "UPDATE comms.reminder_job SET due_at=now()-interval '1 second' WHERE id=$1",
      [feedback[0].id],
    );
    await evaluateDueNotifications(k.db);
    expect(
      (await jobs(completed.id)).find((j) => j.kind === "feedback").status,
    ).toBe("queued");
    await setRule("feedback", false, 1);
    expect(
      (await jobs(completed.id)).find((j) => j.kind === "feedback").status,
    ).toBe("cancelled");
    const missed = await terminalVisit("no_show", p);
    await setRule("no_show", true, 1);
    await replay("appointment.no_show", { appointmentId: missed.id });
    const noShow = (await jobs(missed.id)).find((j) => j.kind === "no_show");
    const at = (
      await k.admin.query(
        "SELECT occurred_at FROM booking.appointment_status_history WHERE appointment_id=$1 AND to_status='no_show'",
        [missed.id],
      )
    ).rows[0].occurred_at;
    expect(Date.parse(noShow.dueAt) - at.getTime()).toBe(3600000);
    ok(await consent(c.id, "reminders", "stop"));
    expect(
      (await jobs(missed.id)).find((j) => j.kind === "no_show").status,
    ).toBe("cancelled");
    const p2 = await createPatient(k.admin, k.tenant.tenantId, "No consent");
    await makeContact(p2);
    const denied = await terminalVisit("no_show", p2);
    await replay("appointment.no_show", { appointmentId: denied.id });
    expect(
      (await jobs(denied.id)).find((j) => j.kind === "no_show").status,
    ).toBe("skipped_no_consent");
    await setRule("no_show", false, 1);
  });
  it("disabled immediate cancellation/reschedule rules do not create those notices", async () => {
    await setRule("reschedule", false, 0);
    await setRule("cancellation", false, 0);
    const p = await createPatient(
      k.admin,
      k.tenant.tenantId,
      "Disabled notices",
    );
    const c = await makeContact(p);
    ok(await consent(c.id, "care"));
    const {
      rows: [a],
    } = await k.admin.query(
      `INSERT INTO booking.appointment(tenant_id,confirmation_code,patient_id,practitioner_staff_id,resource_id,facility_id,session_on,booking_kind,origin_channel,status,cancelled_at,cancel_reason) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,'walk_in','front_desk','cancelled',now(),'Clinic cancelled') RETURNING id`,
      [
        k.tenant.tenantId,
        randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
        p,
        doctor.staffId,
        resource,
        k.tenant.facilityId,
      ],
    );
    await replay("appointment.cancelled", { appointmentId: a.id });
    expect(
      (await jobs(a.id)).find((j) => j.kind === "cancellation"),
    ).toBeUndefined();
    const {
      rows: [replacement],
    } = await k.admin.query(
      `INSERT INTO booking.appointment(tenant_id,confirmation_code,patient_id,practitioner_staff_id,resource_id,facility_id,session_on,booking_kind,origin_channel,rescheduled_from_id) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,'walk_in','front_desk',$7) RETURNING id`,
      [
        k.tenant.tenantId,
        randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
        p,
        doctor.staffId,
        resource,
        k.tenant.facilityId,
        a.id,
      ],
    );
    await replay("appointment.rescheduled", {
      fromAppointmentId: a.id,
      toAppointmentId: replacement.id,
    });
    expect(
      (await jobs(replacement.id)).find((j) => j.kind === "reschedule"),
    ).toBeUndefined();
    await setRule("reschedule", true, 0);
    await setRule("cancellation", true, 0);
  });
});

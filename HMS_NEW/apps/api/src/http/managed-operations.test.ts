import { runCommand } from "@hms/platform";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { seal, type ManagedSettings } from "../modules/comms/managed-config.ts";
import { notices, templateName } from "../modules/comms/managed-automations.ts";
import { dispatchManagedWhatsApp } from "../modules/comms/managed-whatsapp.ts";
import { dispatchGooglePosts } from "../modules/comms/managed-google.ts";
import { startKit, type Kit, type Person } from "./test-kit.ts";
let k: Kit,
  admin: Person,
  desk: Person,
  connectionId: string,
  contactId: string,
  partyId: string;
const requests: { url: string; body: any }[] = [],
  created = new Set<string>();
let templateStatus = "APPROVED",
  changedBody = false,
  failPost = false;
const settings: ManagedSettings = {
  encryptionKey: Buffer.alloc(32, 4),
  whatsappSending: true,
  publicOrigin: "https://dashboard.example.com",
  meta: {
    appId: "111111",
    appSecret: "private-secret",
    configId: "222222",
    graphVersion: "v23.0",
  },
  google: { clientId: "private-google", clientSecret: "private-secret" },
  fetcher: async (url, init = {}) => {
    const u = new URL(String(url)),
      body = init.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url: String(url), body });
    const json = (v: any) => new Response(JSON.stringify(v));
    if (u.pathname.endsWith("/message_templates")) {
      if (init.method === "POST") {
        created.add(body.name);
        return json({ id: "111111", status: "PENDING", category: "UTILITY" });
      }
      const name = u.searchParams.get("name");
      if (name?.startsWith("hms_")) {
        const kind = name.slice(4, -3) as keyof typeof notices;
        return json({
          data: created.has(name)
            ? [
                {
                  name,
                  language: "en",
                  category: "UTILITY",
                  status: templateStatus,
                  components: [
                    {
                      type: "BODY",
                      text: changedBody
                        ? "Unexpected message"
                        : notices[kind].body,
                    },
                  ],
                },
              ]
            : [],
        });
      }
      return json({
        data: [
          {
            name: "clinic_news",
            language: "en",
            category: "MARKETING",
            status: templateStatus,
            components: [
              {
                type: "BODY",
                text: changedBody
                  ? "Changed message"
                  : "Our clinic has extended opening hours. Reply STOP to opt out.",
              },
            ],
          },
        ],
      });
    }
    if (u.pathname.endsWith("/messages")) {
      if (failPost) throw Error("private provider error");
      return json({ messages: [{ id: "wamid." + randomUUID() }] });
    }
    if (u.pathname.endsWith("/localPosts") && init.method === "POST") {
      if (failPost) throw Error("unknown Google acceptance");
      return json({ name: "accounts/123/locations/456/localPosts/new" });
    }
    return json({});
  },
};
const ok = (r: { status: number; body: any }) => {
  expect(r, JSON.stringify(r.body)).toMatchObject({ status: 200 });
  return r.body;
};
const scope = () => `facilityId=${k.tenant.facilityId}`;
const consent = async (purpose: string, action = "opt_in") =>
  ok(
    await k.call(admin, "POST", `/v1/contact-points/${contactId}/consents`, {
      purpose,
      action,
      source: "staff",
      evidence: "Explicit synthetic permission recorded by staff",
      explicitOptIn: action === "opt_in",
    }),
  );
beforeAll(async () => {
  k = await startKit("managed-operations", undefined, undefined, settings);
  admin = await k.person("Admin", "tenant_admin", null);
  desk = await k.person("Desk", "front_desk", k.tenant.facilityId);
  const tenant = k.tenant.tenantId,
    facility = k.tenant.facilityId;
  const result = await k.admin.query(
    "INSERT INTO comms.managed_connection(tenant_id,facility_id,provider,external_id,credential,metadata,created_by)VALUES($1,$2,'whatsapp','999999999999',$3,$4,$5)RETURNING id",
    [
      tenant,
      facility,
      seal(
        settings,
        { token: "private-token" },
        `${tenant}:${facility}:whatsapp`,
      ),
      JSON.stringify({ subscribed: true, businessAccountId: "888888888888" }),
      admin.staffId,
    ],
  );
  connectionId = result.rows[0].id;
  await k.admin.query(
    "INSERT INTO comms.managed_connection(tenant_id,facility_id,provider,external_id,credential,created_by)VALUES($1,$2,'google','accounts/123/locations/456',$3,$4)",
    [
      tenant,
      facility,
      seal(
        settings,
        {
          access_token: "private-token",
          refresh_token: "private-refresh",
          expires_at: Date.now() + 3600000,
        },
        `${tenant}:${facility}:google`,
      ),
      admin.staffId,
    ],
  );
  partyId = (
    await k.admin.query(
      "INSERT INTO booking.booking_party(tenant_id,name,phone)VALUES($1,'Synthetic Person','+919955441122')RETURNING id",
      [tenant],
    )
  ).rows[0].id;
  contactId = (
    await k.admin.query(
      "INSERT INTO comms.contact_point(tenant_id,facility_id,booking_party_id,address,channel)VALUES($1,$2,$3,'+919955441122','whatsapp')RETURNING id",
      [tenant, facility, partyId],
    )
  ).rows[0].id;
  await k.admin.query(
    "INSERT INTO comms.conversation(tenant_id,facility_id,contact_point_id)VALUES($1,$2,$3)",
    [tenant, facility, contactId],
  );
  await k.admin.query(
    "INSERT INTO comms.whatsapp_workspace(tenant_id,facility_id,preferences,created_by)VALUES($1,$2,$3,$4)",
    [
      tenant,
      facility,
      JSON.stringify({ quiet: { on: false, from: "21:00", to: "08:00" } }),
      admin.staffId,
    ],
  );
});
afterAll(async () => {
  await k?.close();
});

describe("managed appointment notices", () => {
  it("submits once, reads actual approval and rejects content drift", async () => {
    let item = ok(
      await k.call(
        admin,
        "GET",
        `/v1/whatsapp-workspace/automations?${scope()}`,
      ),
    ).items[0];
    expect(item.status).toBe("not_submitted");
    const payload = {
        facilityId: k.tenant.facilityId,
        kind: "confirmation",
        enabled: true,
        version: 0,
      },
      key = randomUUID();
    ok(
      await k.call(
        admin,
        "PUT",
        "/v1/whatsapp-workspace/automations",
        payload,
        key,
      ),
    );
    ok(
      await k.call(
        admin,
        "PUT",
        "/v1/whatsapp-workspace/automations",
        payload,
        key,
      ),
    );
    expect(
      requests.filter((r) => r.body?.name === templateName("confirmation")),
    ).toHaveLength(1);
    item = ok(
      await k.call(
        admin,
        "POST",
        "/v1/whatsapp-workspace/automations/refresh",
        { facilityId: k.tenant.facilityId, kind: "confirmation" },
      ),
    ).items[0];
    expect(item).toMatchObject({ enabled: true, status: "approved" });
    changedBody = true;
    item = ok(
      await k.call(
        admin,
        "POST",
        "/v1/whatsapp-workspace/automations/refresh",
        { facilityId: k.tenant.facilityId, kind: "confirmation" },
      ),
    ).items[0];
    expect(item.status).toBe("rejected");
    changedBody = false;
    ok(
      await k.call(
        admin,
        "POST",
        "/v1/whatsapp-workspace/automations/refresh",
        { facilityId: k.tenant.facilityId, kind: "confirmation" },
      ),
    );
    expect(
      (await k.call(desk, "PUT", "/v1/whatsapp-workspace/automations", payload))
        .status,
    ).toBe(403);
  });
  it("sends an eligible due notice once and cancels a stale appointment before sending", async () => {
    await consent("care");
    const doctor = await k.person(
        "Doctor",
        "doctor",
        k.tenant.facilityId,
        "doctor",
      ),
      resource = (
        await k.admin.query(
          "INSERT INTO booking.schedulable_resource(tenant_id,staff_id,kind,name)VALUES($1,$2,'practitioner','Doctor')RETURNING id",
          [k.tenant.tenantId, doctor.staffId],
        )
      ).rows[0].id;
    let offset = 3;
    const appointment = async () => {
      const reservation = (
        await k.admin.query(
          "INSERT INTO booking.reservation(tenant_id,resource_id,facility_id,period,status,owner_id)VALUES($1,$2,$3,tstzrange(now()+$4*interval '1 hour',now()+($4+1)*interval '1 hour'),'booked',uuidv7())RETURNING id,lower(period) AS starts,upper(period) AS ends",
          [k.tenant.tenantId, resource, k.tenant.facilityId, offset++],
        )
      ).rows[0];
      return String(
        (
          await k.admin.query(
            "INSERT INTO booking.appointment(tenant_id,confirmation_code,booking_party_id,practitioner_staff_id,resource_id,facility_id,session_on,booking_kind,origin_channel,starts_at,ends_at,reservation_id)VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,'slot','front_desk',$7,$8,$9)RETURNING id",
            [
              k.tenant.tenantId,
              randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
              partyId,
              doctor.staffId,
              resource,
              k.tenant.facilityId,
              reservation.starts,
              reservation.ends,
              reservation.id,
            ],
          )
        ).rows[0].id,
      );
    };
    const queue = async (a: string) => {
      const rule = (
        await k.admin.query(
          "SELECT id,version FROM comms.managed_automation WHERE facility_id=$1 AND kind='confirmation'",
          [k.tenant.facilityId],
        )
      ).rows[0];
      const j = (
        await k.admin.query(
          "INSERT INTO comms.reminder_job(tenant_id,facility_id,appointment_id,contact_point_id,kind,purpose,due_at,expires_at,status)VALUES($1,$2,$3,$4,'confirmation','care',now()-interval '1 minute',now()+interval '2 hours','scheduled')RETURNING id",
          [k.tenant.tenantId, k.tenant.facilityId, a, contactId],
        )
      ).rows[0].id;
      return String(
        (
          await k.admin.query(
            "INSERT INTO comms.outbound_message(tenant_id,facility_id,reminder_job_id,contact_point_id,managed_send_requested,managed_purpose,managed_details)VALUES($1,$2,$3,$4,true,'reminder',$5)RETURNING id",
            [
              k.tenant.tenantId,
              k.tenant.facilityId,
              j,
              contactId,
              JSON.stringify({
                automationId: rule.id,
                automationVersion: rule.version,
                phoneNumberId: "999999999999",
              }),
            ],
          )
        ).rows[0].id,
      );
    };
    const a = await appointment(),
      id = await queue(a);
    let before = requests.filter((r) => r.url.endsWith("/messages")).length;
    await Promise.all([
      dispatchManagedWhatsApp(k.db, settings),
      dispatchManagedWhatsApp(k.db, settings),
    ]);
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before + 1,
    );
    expect(
      (
        await k.admin.query(
          "SELECT status FROM comms.outbound_message WHERE id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("sent");
    const payload = requests
      .filter((r) => r.url.endsWith("/messages"))
      .at(-1)!.body;
    expect(payload).toMatchObject({
      type: "template",
      template: { name: "hms_confirmation_v1", language: { code: "en" } },
    });
    expect(JSON.stringify(payload)).not.toContain("Synthetic Person");
    const stale = await appointment(),
      staleId = await queue(stale);
    await k.admin.query(
      "UPDATE booking.appointment SET status='cancelled',cancelled_at=now(),cancel_reason='Synthetic cancellation' WHERE id=$1",
      [stale],
    );
    before = requests.filter((r) => r.url.endsWith("/messages")).length;
    await dispatchManagedWhatsApp(k.db, settings);
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before,
    );
    expect(
      (
        await k.admin.query(
          "SELECT status FROM comms.outbound_message WHERE id=$1",
          [staleId],
        )
      ).rows[0].status,
    ).toBe("cancelled");
    const fresh = await appointment();
    const emit = async (id: string) => {
      await runCommand(
        k.db,
        {
          tenantId: k.tenant.tenantId,
          actor: { kind: "system" },
          module: "booking",
          name: "booking.synthetic_notice_event",
        },
        async (ctx) => {
          ctx.emit({
            eventType: "appointment.confirmed",
            aggregateType: "booking.appointment",
            aggregateId: id,
            payload: { appointmentId: id },
          });
        },
      );
      await k.dispatch();
    };
    await emit(fresh);
    const armed = (
      await k.admin.query(
        "SELECT m.managed_send_requested,m.managed_purpose FROM comms.outbound_message m JOIN comms.reminder_job j ON j.id=m.reminder_job_id WHERE j.appointment_id=$1 AND j.kind='confirmation'",
        [fresh],
      )
    ).rows[0];
    expect(armed).toMatchObject({
      managed_send_requested: true,
      managed_purpose: "reminder",
    });
    await dispatchManagedWhatsApp(k.db, settings);
    const historical = await appointment();
    await k.admin.query(
      "UPDATE booking.appointment SET created_at=now()-interval '1 day' WHERE id=$1",
      [historical],
    );
    await emit(historical);
    expect(
      (
        await k.admin.query(
          "SELECT m.managed_send_requested FROM comms.outbound_message m JOIN comms.reminder_job j ON j.id=m.reminder_job_id WHERE j.appointment_id=$1 AND j.kind='confirmation'",
          [historical],
        )
      ).rows[0].managed_send_requested,
    ).toBe(false);
  });
});

describe("reviewed promotions", () => {
  const preview = async () =>
    k.call(admin, "POST", "/v1/whatsapp-workspace/promotions/preview", {
      facilityId: k.tenant.facilityId,
      title: "Clinic news",
      name: "clinic_news",
      language: "en",
      dueAt: new Date(Date.now() + 3600000).toISOString(),
      budgetMinor: 10000,
    });
  it("requires explicit marketing consent and a fresh audience snapshot", async () => {
    expect((await preview()).status).toBe(422);
    await consent("marketing");
    const draft = ok(await preview());
    expect(draft).toMatchObject({ recipients: 1, estimateMinor: 100 });
    await consent("marketing", "opt_out");
    expect(
      (
        await k.call(
          admin,
          "POST",
          `/v1/whatsapp-workspace/promotions/${draft.id}/approve`,
          { facilityId: k.tenant.facilityId, version: draft.version },
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await k.call(
          desk,
          "POST",
          `/v1/whatsapp-workspace/promotions/${draft.id}/approve`,
          { facilityId: k.tenant.facilityId, version: draft.version },
        )
      ).status,
    ).toBe(403);
  });
  it("approval queues only the reviewed audience, respects quiet hours and sends once", async () => {
    await consent("marketing");
    const draft = ok(await preview()),
      key = randomUUID(),
      body = { facilityId: k.tenant.facilityId, version: draft.version };
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/promotions/${draft.id}/approve`,
        body,
        key,
      ),
    );
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/promotions/${draft.id}/approve`,
        body,
        key,
      ),
    );
    await k.admin.query(
      "UPDATE comms.managed_broadcast SET due_at=now()-interval '1 minute' WHERE id=$1",
      [draft.id],
    );
    let before = requests.filter((r) => r.url.endsWith("/messages")).length;
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
    await k.admin.query(
      "UPDATE comms.whatsapp_workspace SET preferences=$2 WHERE facility_id=$1",
      [
        k.tenant.facilityId,
        JSON.stringify({
          quiet: {
            on: true,
            from: local,
            to:
              local === "23:59"
                ? "00:00"
                : local.slice(0, 3) +
                  String(Number(local.slice(3)) + 1).padStart(2, "0"),
          },
        }),
      ],
    );
    await dispatchManagedWhatsApp(k.db, settings);
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before,
    );
    await k.admin.query(
      "UPDATE comms.whatsapp_workspace SET preferences=$2 WHERE facility_id=$1",
      [
        k.tenant.facilityId,
        JSON.stringify({ quiet: { on: false, from: "21:00", to: "08:00" } }),
      ],
    );
    await Promise.all([
      dispatchManagedWhatsApp(k.db, settings),
      dispatchManagedWhatsApp(k.db, settings),
    ]);
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before + 1,
    );
    expect(
      requests.filter((r) => r.url.endsWith("/messages")).at(-1)!.body,
    ).toMatchObject({ type: "template", template: { name: "clinic_news" } });
  });
  it("STOP and provider content changes prevent delivery; uncertain requests never retry", async () => {
    let draft = ok(await preview());
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/promotions/${draft.id}/approve`,
        { facilityId: k.tenant.facilityId, version: draft.version },
      ),
    );
    await k.admin.query(
      "UPDATE comms.managed_broadcast SET due_at=now()-interval '1 minute' WHERE id=$1",
      [draft.id],
    );
    await consent("care", "stop");
    let before = requests.filter((r) => r.url.endsWith("/messages")).length;
    await dispatchManagedWhatsApp(k.db, settings);
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before,
    );
    await consent("marketing");
    draft = ok(await preview());
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/promotions/${draft.id}/approve`,
        { facilityId: k.tenant.facilityId, version: draft.version },
      ),
    );
    await k.admin.query(
      "UPDATE comms.managed_broadcast SET due_at=now()-interval '1 minute' WHERE id=$1",
      [draft.id],
    );
    changedBody = true;
    await dispatchManagedWhatsApp(k.db, settings);
    changedBody = false;
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before,
    );
    draft = ok(await preview());
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/promotions/${draft.id}/approve`,
        { facilityId: k.tenant.facilityId, version: draft.version },
      ),
    );
    await k.admin.query(
      "UPDATE comms.managed_broadcast SET due_at=now()-interval '1 minute' WHERE id=$1",
      [draft.id],
    );
    failPost = true;
    await dispatchManagedWhatsApp(k.db, settings);
    failPost = false;
    before = requests.filter((r) => r.url.endsWith("/messages")).length;
    await dispatchManagedWhatsApp(k.db, settings);
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before,
    );
    expect(
      (
        await k.admin.query(
          "SELECT status FROM comms.outbound_message WHERE managed_broadcast_id=$1",
          [draft.id],
        )
      ).rows[0].status,
    ).toBe("unknown");
  });
});

describe("Google scheduled publishing", () => {
  const schedule = async () => {
    const version = (
      await k.admin.query(
        "SELECT version FROM comms.managed_connection WHERE tenant_id=$1 AND provider='google'",
        [k.tenant.tenantId],
      )
    ).rows[0].version;
    return ok(
      await k.call(admin, "POST", `/v1/google-business/actions?${scope()}`, {
        action: "post",
        version,
        kind: "update",
        title: "",
        text: "Clinic opening hours",
        button: null,
        publishAt: new Date(Date.now() + 3600000).toISOString(),
      }),
    );
  };
  it("persists the schedule without publishing and concurrent workers publish once", async () => {
    const before = requests.filter(
      (r) => r.url.endsWith("/localPosts") && r.body,
    ).length;
    expect(await schedule()).toMatchObject({ accepted: true, scheduled: true });
    expect(
      requests.filter((r) => r.url.endsWith("/localPosts") && r.body),
    ).toHaveLength(before);
    await k.admin.query(
      "UPDATE comms.google_scheduled_post SET due_at=now()-interval '1 minute' WHERE tenant_id=$1",
      [k.tenant.tenantId],
    );
    await Promise.all([
      dispatchGooglePosts(k.db, settings),
      dispatchGooglePosts(k.db, settings),
    ]);
    expect(
      requests.filter((r) => r.url.endsWith("/localPosts") && r.body),
    ).toHaveLength(before + 1);
    expect(
      (
        await k.admin.query(
          "SELECT status FROM comms.google_scheduled_post WHERE tenant_id=$1",
          [k.tenant.tenantId],
        )
      ).rows[0].status,
    ).toBe("accepted");
  });
  it("does not retry unknown publishing or publish after disconnect", async () => {
    await schedule();
    await k.admin.query(
      "UPDATE comms.google_scheduled_post SET due_at=now()-interval '1 minute' WHERE tenant_id=$1 AND status='scheduled'",
      [k.tenant.tenantId],
    );
    failPost = true;
    await dispatchGooglePosts(k.db, settings);
    failPost = false;
    const before = requests.filter(
      (r) => r.url.endsWith("/localPosts") && r.body,
    ).length;
    await dispatchGooglePosts(k.db, settings);
    expect(
      requests.filter((r) => r.url.endsWith("/localPosts") && r.body),
    ).toHaveLength(before);
    await schedule();
    ok(
      await k.call(
        admin,
        "DELETE",
        `/v1/managed-connections/google?${scope()}`,
      ),
    );
    await k.admin.query(
      "UPDATE comms.google_scheduled_post SET due_at=now()-interval '1 minute' WHERE tenant_id=$1 AND status='scheduled'",
      [k.tenant.tenantId],
    );
    await dispatchGooglePosts(k.db, settings);
    expect(
      requests.filter((r) => r.url.endsWith("/localPosts") && r.body),
    ).toHaveLength(before);
  });
});

describe("WhatsApp number binding", () => {
  it("cancels queued replies after rotation and refuses to reuse the old reply window", async () => {
    await consent("care");
    const account = (
      await k.admin.query(
        "INSERT INTO comms.channel_account(tenant_id,facility_id,phone_number_id)VALUES($1,$2,'999999999999')RETURNING id",
        [k.tenant.tenantId, k.tenant.facilityId],
      )
    ).rows[0].id;
    const conversation = (
      await k.admin.query(
        "SELECT id FROM comms.conversation WHERE contact_point_id=$1",
        [contactId],
      )
    ).rows[0].id;
    await k.admin.query(
      "INSERT INTO comms.inbound_message(tenant_id,conversation_id,account_id,provider_message_id,text_content,received_at,phone_number_id)VALUES($1,$2,$3,$4,'Synthetic inbound',now(),'999999999999')",
      [k.tenant.tenantId, conversation, account, randomUUID()],
    );
    await k.admin.query(
      "UPDATE comms.conversation SET last_inbound_at=now(),status='open',automation_state='human',assigned_staff_id=$2 WHERE id=$1",
      [conversation,admin.staffId],
    );
    let thread = ok(
      await k.call(
        admin,
        "GET",
        `/v1/whatsapp-workspace/conversations/${conversation}`,
      ),
    );
    expect(thread.conversation.canReply).toBe(true);
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/conversations/${conversation}/reply`,
        {
          version: thread.conversation.version,
          text: "Reply to the original number only",
        },
      ),
    );
    await k.admin.query(
      "UPDATE comms.managed_connection SET external_id='777777777777' WHERE id=$1",
      [connectionId],
    );
    await k.admin.query(
      "UPDATE comms.channel_account SET phone_number_id='777777777777' WHERE id=$1",
      [account],
    );
    const before = requests.filter((r) => r.url.endsWith("/messages")).length;
    await dispatchManagedWhatsApp(k.db, settings);
    expect(requests.filter((r) => r.url.endsWith("/messages"))).toHaveLength(
      before,
    );
    expect(
      (
        await k.admin.query(
          "SELECT status FROM comms.outbound_message WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1",
          [conversation],
        )
      ).rows[0].status,
    ).toBe("cancelled");
    thread = ok(
      await k.call(
        admin,
        "GET",
        `/v1/whatsapp-workspace/conversations/${conversation}`,
      ),
    );
    expect(thread.conversation.canReply).toBe(false);
    expect(
      (
        await k.call(
          admin,
          "POST",
          `/v1/whatsapp-workspace/conversations/${conversation}/reply`,
          {
            version: thread.conversation.version,
            text: "Must wait for a new inbound message",
          },
        )
      ).status,
    ).toBe(422);
  });
});

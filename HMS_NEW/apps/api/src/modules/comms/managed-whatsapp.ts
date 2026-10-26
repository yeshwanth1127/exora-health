import { broadcastPayload } from "./managed-promotions.ts";
import { reminderPayload, quietNow } from "./managed-automations.ts";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { sql, type DB, type Kysely, type Transaction } from "@hms/db";
import {
  conflict,
  forbidden,
  invalid,
  notFound,
  preconditionFailed,
  runCommand,
  runQuery,
  setTransactionContext,
} from "@hms/platform";
import type { Caller } from "../../caller.ts";
import { clock } from "../../caller.ts";
import {
  providerJson,
  seal,
  unseal,
  type ManagedSettings,
} from "./managed-config.ts";
import { connection } from "./managed-google.ts";
import {
  conversations,
  conversationCommand,
  thread,
  assertWhatsAppActive,
} from "./whatsapp.ts";
import type { WhatsAppBinding } from "./whatsapp-provider-config.ts";
import { addressLock } from "./notifications.ts";
import {
  bookingAuthority,
  bookingSite,
  verifyChatActivation,
} from "./managed-booking-chat.ts";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const aad = (t: string, f: string) => `${t}:${f}:whatsapp`;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const attachment = z.strictObject({
  kind: z.enum(["image", "pdf"]),
  name: z.string().max(200),
});
export const WhatsAppDraft = z.strictObject({
  path: z.enum(["coexistence", "new_number"]),
  shape: z
    .enum(["single_doctor", "small_clinic", "multi_specialty"])
    .nullable(),
  steps: z
    .array(
      z.strictObject({
        id: z.enum([
          "welcome",
          "department",
          "doctor",
          "slot",
          "details",
          "confirm",
        ]),
        on: z.boolean(),
        message: z.string().max(1024),
        header: attachment.nullable(),
      }),
    )
    .max(6),
  flowDone: z.boolean(),
  content: z
    .record(z.string().max(100), attachment)
    .refine((v) => Object.keys(v).length <= 100),
  contentDone: z.boolean(),
  tested: z.boolean(),
  live: z.boolean(),
  paused: z.boolean(),
});
export const WhatsAppPreferences = z.strictObject({
  quiet: z.strictObject({ on: z.boolean(), from: time, to: time }),
  hours: z.strictObject({ from: time, to: time }),
  away: z.strictObject({ on: z.boolean(), text: z.string().max(1024) }),
  handoffWords: z.string().max(300),
  savedReplies: z.array(z.string().max(1024)).max(30),
  askConsent: z.boolean(),
});
const emptyDraft = () => ({
  path: "coexistence",
  shape: null,
  steps: [],
  flowDone: false,
  content: {},
  contentDone: false,
  tested: false,
  live: false,
  paused: false,
});
const preferences = () => ({
  quiet: { on: true, from: "21:00", to: "08:00" },
  hours: { from: "09:00", to: "18:00" },
  away: { on: false, text: "" },
  handoffWords: "human, receptionist",
  savedReplies: [],
  askConsent: false,
});
function meta(settings: ManagedSettings) {
  if (!settings.meta || !settings.encryptionKey)
    throw preconditionFailed(
      "WhatsApp connection is being prepared. Please try again later.",
    );
  return settings.meta;
}
export async function whatsappDashboard(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  settings: ManagedSettings,
  reveal: boolean,
) {
  const conn = await connection(db, caller, facilityId, "whatsapp");
  const stored = await runQuery(db, caller.tenantId, async (tx) => {
    if (
      !(await tx
        .selectFrom("platform.facility")
        .select("id")
        .where("id", "=", facilityId)
        .executeTakeFirst())
    )
      throw notFound("clinic");
    const {
      rows: [row],
    } = await sql<{
      draft: any;
      preferences: any;
      version: number;
    }>`SELECT draft,preferences,version FROM comms.whatsapp_workspace WHERE facility_id=${facilityId}`.execute(
      tx,
    );
    return row;
  });
  const validWindows = await runQuery(
    db,
    caller.tenantId,
    async (tx) =>
      new Set(
        (
          await sql<{
            conversation_id: string;
          }>`SELECT DISTINCT conversation_id FROM comms.inbound_message WHERE phone_number_id=${conn?.external_id ?? ""} AND received_at>now()-interval '24 hours'`.execute(
            tx,
          )
        ).rows.map((r) => r.conversation_id),
      ),
  );
  const list = await conversations(
    db,
    caller,
    { facilityId, offset: 0, limit: 100 },
    reveal,
  );
  const activity = await runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<any>`SELECT * FROM (
      SELECT m.id,m.conversation_id,m.created_at,m.updated_at,p.address,m.text_content,m.status,m.managed_purpose,'out'::text AS direction FROM comms.outbound_message m JOIN comms.contact_point p ON p.id=m.contact_point_id AND p.tenant_id=m.tenant_id WHERE m.facility_id=${facilityId} AND (m.conversation_id IS NOT NULL OR m.managed_send_requested)
      UNION ALL SELECT m.id,m.conversation_id,m.received_at AS created_at,m.received_at AS updated_at,p.address,m.text_content,'received'::text AS status,NULL::text AS managed_purpose,'in'::text AS direction FROM comms.inbound_message m JOIN comms.conversation c ON c.id=m.conversation_id AND c.tenant_id=m.tenant_id JOIN comms.contact_point p ON p.id=c.contact_point_id AND p.tenant_id=c.tenant_id WHERE c.facility_id=${facilityId}
    ) activity ORDER BY created_at DESC,id DESC LIMIT 100`.execute(tx);
    const {
      rows: [count],
    } = await sql<{
      n: number;
    }>`SELECT count(DISTINCT address)::int AS n FROM comms.contact_point WHERE facility_id=${facilityId} AND status='active' AND comms.has_consent(id,'marketing')`.execute(
      tx,
    );
    const {
      rows: [booked],
    } = await sql<{
      n: number;
    }>`SELECT count(*)::int AS n FROM booking.appointment a JOIN platform.facility f ON f.id=a.facility_id AND f.tenant_id=a.tenant_id WHERE a.facility_id=${facilityId} AND a.origin_channel='whatsapp' AND (a.created_at AT TIME ZONE f.timezone)::date=(now() AT TIME ZONE f.timezone)::date`.execute(
      tx,
    );
    const {
      rows: [stats],
    } =
      await sql<any>`SELECT count(*) FILTER(WHERE m.status IN('sent','delivered','read'))::int AS sent,count(*) FILTER(WHERE m.status IN('delivered','read'))::int AS delivered,count(*) FILTER(WHERE m.status IN('delivered','read','failed'))::int AS settled,count(*) FILTER(WHERE m.status='failed')::int AS failed
      FROM comms.outbound_message m JOIN platform.facility f ON f.id=m.facility_id AND f.tenant_id=m.tenant_id
      WHERE m.facility_id=${facilityId} AND m.managed_send_requested AND (m.created_at AT TIME ZONE f.timezone)::date=(now() AT TIME ZONE f.timezone)::date`.execute(
        tx,
      );
    return {
      messageStats: stats,
      bookedToday: booked?.n ?? 0,
      optedIn: count?.n ?? 0,
      log: rows.map((r) => ({
        id: r.id,
        conversationId: r.conversation_id,
        at: new Date(r.created_at).getTime(),
        patient: "WhatsApp visitor",
        phone: reveal
          ? r.address
          : r.address.slice(0, 3) + " ••••• " + r.address.slice(-5),
        direction: r.direction,
        kind:
          r.direction === "in"
            ? "Patient message"
            : r.managed_purpose === "broadcast"
              ? "Promotion"
              : r.managed_purpose === "reminder"
                ? "Appointment notice"
                : r.managed_purpose?.startsWith("booking")
                  ? "Booking assistant"
                  : "Staff reply",
        template:
          r.managed_purpose === "reminder"
            ? "Appointment notice"
            : r.managed_purpose === "broadcast"
              ? "Promotion"
              : null,
        category:
          r.managed_purpose === "broadcast"
            ? "marketing"
            : r.managed_purpose === "reminder"
              ? "utility"
              : "service",
        body: r.text_content ?? "",
        status: r.status,
        history: [{ status: r.status, at: new Date(r.updated_at).getTime() }],
        error: null,
      })),
    };
  });
  return {
    available: !!settings.meta,
    connected: !!conn?.metadata.subscribed,
    version: stored?.version ?? 0,
    setup: {
      ...emptyDraft(),
      ...(stored?.draft ?? {}),
      connected: conn?.metadata.subscribed
        ? { phone: conn.metadata.phone, name: conn.metadata.name }
        : null,
    },
    capabilities: {
      sending: !!settings.whatsappSending && !!conn?.metadata.subscribed,
      booking:
        !!settings.booking?.sites.some(
          (s) => s.tenantId === caller.tenantId && s.facilityId === facilityId,
        ) && !!settings.whatsappSending,
      automations: !!settings.meta && !!conn?.metadata.subscribed,
      campaigns: !!settings.meta && !!conn?.metadata.subscribed,
      uploads: true,
    },
    data: {
      v: 1,
      day: clock(caller).toISOString().slice(0, 10),
      optedIn: activity.optedIn,
      bookedToday: activity.bookedToday,
      messageStats: activity.messageStats,
      bookingActive: !!stored?.draft.live && !stored?.draft.paused,
      automations: [],
      campaigns: [],
      log: activity.log,
      settings: { ...preferences(), ...(stored?.preferences ?? {}) },
      conversations: list.items.map((c) => ({
        id: c.id,
        version: c.version,
        canReply: c.canReply && validWindows.has(c.id),
        patient: c.name ?? "WhatsApp visitor",
        phone: c.contactAddress,
        reason: "",
        status:
          c.status === "closed"
            ? "resolved"
            : c.automationState === "automation"
              ? "bot"
              : "open",
        assignee: c.assignedStaffName,
        messages: activity.log
          .filter((e) => e.conversationId === c.id)
          .slice(0, 1)
          .map((e) => ({
            id: e.id,
            at: e.at,
            from: e.direction === "in" ? "patient" : "staff",
            text: e.body,
          })),
        updatedAt: Date.parse(c.updatedAt),
        context: { next: null, last: null, visits: 0 },
      })),
    },
  };
}
export async function saveWhatsAppWorkspace(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  version: number,
  draft: z.infer<typeof WhatsAppDraft>,
  prefs: z.infer<typeof WhatsAppPreferences>,
  key: string,
  settings: ManagedSettings,
) {
  if (draft.live) {
    await verifyChatActivation(db, caller, facilityId, settings);
    const c = await connection(db, caller, facilityId, "whatsapp");
    if (!c?.metadata.subscribed)
      throw preconditionFailed("Connect WhatsApp before accepting bookings.");
  }
  if (Object.keys(draft.content).length || draft.steps.some((s) => s.header))
    throw preconditionFailed(
      "Upload files using the clinic document controls before adding them to a booking flow.",
    );
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.whatsapp_workspace_save",
      request: { facilityId, version, draft, prefs },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${caller.tenantId + ":wa-workspace:" + facilityId},0))`.execute(
        ctx.tx,
      );
      if (
        !(await ctx.tx
          .selectFrom("platform.facility")
          .select("id")
          .where("id", "=", facilityId)
          .executeTakeFirst())
      )
        throw notFound("clinic");
      const {
        rows: [old],
      } = await sql<{
        version: number;
      }>`SELECT version FROM comms.whatsapp_workspace WHERE facility_id=${facilityId}`.execute(
        ctx.tx,
      );
      if ((old?.version ?? 0) !== version)
        throw conflict("WhatsApp settings changed. Reload before editing.");
      const {
        rows: [saved],
      } = await sql<{
        id: string;
        version: number;
      }>`INSERT INTO comms.whatsapp_workspace(tenant_id,facility_id,draft,preferences,created_by,booking_enabled_at) VALUES(${caller.tenantId},${facilityId},${JSON.stringify(draft)}::jsonb,${JSON.stringify(prefs)}::jsonb,${caller.actor.staffId!},${draft.live ? new Date() : null})
      ON CONFLICT(tenant_id,facility_id) DO UPDATE SET booking_enabled_at=CASE WHEN EXCLUDED.draft->>'live'='true' AND (comms.whatsapp_workspace.draft->>'live' IS DISTINCT FROM 'true' OR (comms.whatsapp_workspace.draft->>'paused'='true' AND coalesce(EXCLUDED.draft->>'paused','false')<>'true')) THEN now() ELSE comms.whatsapp_workspace.booking_enabled_at END,draft=EXCLUDED.draft,preferences=EXCLUDED.preferences RETURNING id,version`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "update",
        subjectType: "comms.whatsapp_workspace",
        subjectId: saved!.id,
      });
      return { version: saved!.version };
    },
  );
}
export async function startWhatsApp(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  key: string,
  settings: ManagedSettings,
) {
  const config = meta(settings);
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.whatsapp_connect_start",
      request: { facilityId },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      if (
        !(await ctx.tx
          .selectFrom("platform.facility")
          .select("id")
          .where("id", "=", facilityId)
          .executeTakeFirst())
      )
        throw notFound("clinic");
      const nonce = randomBytes(32).toString("base64url");
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.integration_attempt(tenant_id,facility_id,provider,actor_staff_id,actor_user_id,state_hash,verifier,expires_at)
      VALUES(${caller.tenantId},${facilityId},'whatsapp',${caller.actor.staffId!},${caller.actor.userId!},${hash(nonce)},'',now()+interval '10 minutes') RETURNING id`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "create",
        subjectType: "comms.whatsapp_connection",
        subjectId: r!.id,
        diff: { state: "awaiting_consent" },
      });
      return {
        attemptId: r!.id,
        nonce,
        appId: config.appId,
        configId: config.configId,
        version: config.graphVersion,
      };
    },
  );
}
export const WhatsAppConnectInput = z.strictObject({
  facilityId: z.uuid(),
  attemptId: z.uuid(),
  nonce: z.string().regex(/^[\w-]{43}$/),
  code: z.string().min(1).max(4096),
  businessAccountId: z.string().regex(/^\d{5,40}$/),
  phoneNumberId: z.string().regex(/^\d{5,40}$/).optional(),
  path: z.enum(["coexistence", "new_number"]),
});
export async function finishWhatsApp(
  db: Kysely<DB>,
  caller: Caller,
  input: z.infer<typeof WhatsAppConnectInput>,
  settings: ManagedSettings,
) {
  const config = meta(settings),
    { facilityId } = input,
    root = `https://graph.facebook.com/${config.graphVersion}`;
  // Consume before exchanging a one-use code. It cannot be replayed or used by another staff account.
  await runCommand(
    db,
    { ...caller, module: "comms", name: "comms.whatsapp_exchange" },
    async (ctx) => {
      const { rows } =
        await sql`UPDATE comms.integration_attempt SET status='exchanging' WHERE id=${input.attemptId} AND facility_id=${facilityId} AND provider='whatsapp' AND status='pending' AND state_hash=${hash(input.nonce)}
      AND actor_staff_id=${caller.actor.staffId!} AND actor_user_id=${caller.actor.userId!} AND expires_at>now() RETURNING id`.execute(
          ctx.tx,
        );
      if (rows.length !== 1)
        throw forbidden(
          "WhatsApp connection expired. Start again from the dashboard.",
        );
    },
  );
  let bound = false;
  try {
    const result = await providerJson(settings, `${root}/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.appId,
        client_secret: config.appSecret,
        code: input.code,
      }).toString(),
    });
    if (typeof result.access_token !== "string") throw Error();
    const headers = {
      Authorization: `Bearer ${result.access_token}`,
      "content-type": "application/json",
    };
    const phones = await providerJson(
      settings,
      `${root}/${input.businessAccountId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,platform_type,is_on_biz_app&limit=100`,
      { headers },
    );
    const candidates = Array.isArray(phones.data) ? phones.data : [];
    // Coexistence's completion event can contain only a WABA. Never guess among several numbers.
    const phone = input.phoneNumberId ? candidates.find((p: any) => p.id === input.phoneNumberId)
      : candidates.length === 1 ? candidates[0] : undefined;
    if (!phone || phone.code_verification_status !== "VERIFIED")
      throw preconditionFailed(
        "Verify this phone number with Meta before connecting.",
      );
    if (typeof phone.id !== 'string' || !/^\d{5,40}$/.test(phone.id)) throw Error();
    input.phoneNumberId = phone.id;
    if (input.path === 'coexistence' && phone.is_on_biz_app !== true)
      throw preconditionFailed('Choose the WhatsApp Business app connection in Meta, or use the new number option.');
    if (input.path === 'new_number' && phone.is_on_biz_app === true)
      throw preconditionFailed('This number uses the Business app. Choose Keep your current number.');
    const display =
      "+" + String(phone.display_phone_number ?? "").replace(/\D/g, "");
    if (
      !/^\+[1-9]\d{7,14}$/.test(display) ||
      typeof phone.verified_name !== "string"
    )
      throw Error();
    // A verified provider identity is reserved under tenant scope before subscribing external webhooks.
    await runCommand(
      db,
      { ...caller, module: "comms", name: "comms.whatsapp_bind" },
      async (ctx) => {
        await assertWhatsAppActive(ctx.tx);
        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${caller.tenantId + ":account:" + facilityId},0))`.execute(
          ctx.tx,
        );
        const {
          rows: [old],
        } = await sql<{
          phone_number_id: string;
        }>`SELECT phone_number_id FROM comms.channel_account WHERE facility_id=${facilityId}`.execute(
          ctx.tx,
        );
        if (old && old.phone_number_id !== input.phoneNumberId)
          throw conflict(
            "A different number already belongs to this clinic. Contact Paperwhale to move it safely.",
          );
        await sql`INSERT INTO comms.channel_account(tenant_id,facility_id,phone_number_id,created_by) VALUES(${caller.tenantId},${facilityId},${input.phoneNumberId},${caller.actor.staffId!}) ON CONFLICT(tenant_id,facility_id) DO NOTHING`.execute(
          ctx.tx,
        );
        await sql`INSERT INTO comms.managed_connection(tenant_id,facility_id,provider,external_id,credential,metadata,created_by)
        VALUES(${caller.tenantId},${facilityId},'whatsapp',${input.phoneNumberId},${seal(settings, { token: result.access_token }, aad(caller.tenantId, facilityId))},
        ${JSON.stringify({ phone: display, name: phone.verified_name, businessAccountId: input.businessAccountId, path: input.path, subscribed: false })}::jsonb,${caller.actor.staffId!})
        ON CONFLICT(tenant_id,facility_id,provider) DO UPDATE SET credential=EXCLUDED.credential,
        metadata=EXCLUDED.metadata||jsonb_build_object('syncRequests',CASE WHEN comms.managed_connection.metadata->>'businessAccountId'=EXCLUDED.metadata->>'businessAccountId' THEN coalesce(comms.managed_connection.metadata->'syncRequests','{}'::jsonb) ELSE '{}'::jsonb END),enabled=true`.execute(
          ctx.tx,
        );
        ctx.audit({
          action: "update",
          subjectType: "comms.whatsapp_connection",
          diff: { state: "verified", facilityId },
        });
      },
    );
    bound = true;
    // An empty subscription POST removes an existing WABA callback override. Leave an existing
    // subscription intact; only the explicitly connected phone receives a new callback below.
    const subscriptions = await providerJson(settings, `${root}/${input.businessAccountId}/subscribed_apps`, { headers });
    if (!subscriptions.data?.some((s: any) => s.whatsapp_business_api_data?.id === config.appId)) {
      const subscription = await providerJson(settings, `${root}/${input.businessAccountId}/subscribed_apps`, { method: 'POST', headers, body: '{}' });
      if (subscription.success !== true) throw Error();
    }
    if (settings.webhookVerifyToken && settings.publicOrigin?.startsWith('https:')) {
      const callback = `${settings.publicOrigin}/v1/integrations/whatsapp/webhook`;
      if (callback.length > 200) throw Error();
      const routed = await providerJson(settings, `${root}/${input.phoneNumberId}`, {
        method: 'POST', headers, body: JSON.stringify({ webhook_configuration: {
          override_callback_uri: callback, verify_token: settings.webhookVerifyToken,
        } }),
      });
      if (routed.success !== true) throw Error();
      const readback = await providerJson(settings, `${root}/${input.phoneNumberId}?fields=webhook_configuration`, { headers });
      if (readback.webhook_configuration?.phone_number !== callback) throw Error();
    }
    // Coexistence numbers are registered by Meta's Business app onboarding. Other numbers need Cloud registration.
    if (input.path === "new_number" && phone.platform_type !== "CLOUD_API") {
      const pin = String(randomInt(100000, 1000000));
      const registered = await providerJson(
        settings,
        `${root}/${input.phoneNumberId}/register`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ messaging_product: "whatsapp", pin }),
        },
      );
      if (registered.success !== true) throw Error();
      await runCommand(
        db,
        { ...caller, module: "comms", name: "comms.whatsapp_registration" },
        async (ctx) => {
          await sql`UPDATE comms.managed_connection SET credential=${seal(settings, { token: result.access_token, pin }, aad(caller.tenantId, facilityId))} WHERE facility_id=${facilityId} AND provider='whatsapp' AND external_id=${input.phoneNumberId}`.execute(
            ctx.tx,
          );
        },
      );
    }
    await runCommand(
      db,
      { ...caller, module: "comms", name: "comms.whatsapp_connected" },
      async (ctx) => {
        await sql`UPDATE comms.managed_connection SET metadata=metadata||'{"subscribed":true}'::jsonb WHERE facility_id=${facilityId} AND provider='whatsapp' AND external_id=${input.phoneNumberId}`.execute(
          ctx.tx,
        );
        await sql`UPDATE comms.integration_attempt SET status='used' WHERE id=${input.attemptId}`.execute(
          ctx.tx,
        );
        ctx.audit({
          action: "update",
          subjectType: "comms.whatsapp_connection",
          diff: { state: "connected", facilityId },
        });
      },
    );
    if (input.path === 'coexistence') {
      for (const sync_type of ['smb_app_state_sync', 'history']) {
        const claim = await runCommand(db, { ...caller, module: 'comms', name: 'comms.whatsapp_sync_claim' }, async ctx => {
          const { rows:[row] } = await sql<{metadata:any}>`SELECT metadata FROM comms.managed_connection WHERE facility_id=${facilityId} AND provider='whatsapp' AND external_id=${input.phoneNumberId} AND enabled FOR UPDATE`.execute(ctx.tx);
          if (!row) throw preconditionFailed('This connection changed. Connect again.');
          const previous = row.metadata.syncRequests?.[sync_type];
          if (previous?.state === 'completed') return false;
          if (previous) throw preconditionFailed('Synchronization needs a company connection check before retrying.');
          await sql`UPDATE comms.managed_connection SET metadata=jsonb_set(metadata,'{syncRequests}',coalesce(metadata->'syncRequests','{}'::jsonb)||${JSON.stringify({[sync_type]:{state:'claimed'}})}::jsonb) WHERE facility_id=${facilityId} AND provider='whatsapp'`.execute(ctx.tx);
          return true;
        });
        if (!claim) continue;
        const sync = await providerJson(settings, `${root}/${input.phoneNumberId}/smb_app_data`, {
          method: 'POST', headers, body: JSON.stringify({ messaging_product: 'whatsapp', sync_type }),
        });
        if (typeof sync.request_id !== 'string') throw Error();
        await runCommand(db, { ...caller, module:'comms', name:'comms.whatsapp_sync_accepted' }, async ctx => {
          await sql`UPDATE comms.managed_connection SET metadata=jsonb_set(metadata,'{syncRequests}',coalesce(metadata->'syncRequests','{}'::jsonb)||${JSON.stringify({[sync_type]:{state:'completed',requestId:sync.request_id}})}::jsonb) WHERE facility_id=${facilityId} AND provider='whatsapp' AND external_id=${input.phoneNumberId} AND enabled`.execute(ctx.tx);
        });
      }
    }
    return { connected: true };
  } catch {
    await runCommand(
      db,
      { ...caller, module: "comms", name: "comms.whatsapp_connect_failed" },
      async (ctx) => {
        await sql`UPDATE comms.integration_attempt SET status='failed' WHERE id=${input.attemptId}`.execute(ctx.tx);
        if (bound) await sql`UPDATE comms.managed_connection SET metadata=metadata||'{"subscribed":false}'::jsonb WHERE facility_id=${facilityId} AND provider='whatsapp' AND external_id=${input.phoneNumberId ?? ''}`.execute(ctx.tx);
      },
    );
    throw preconditionFailed(
      "WhatsApp could not complete the connection. Please connect again.",
    );
  }
}
/** Resolve dynamic bindings from verified encrypted records, without loading them into process.env. */
export async function managedWhatsAppBinding(
  db: Kysely<DB>,
  phone: string,
  settings: ManagedSettings,
): Promise<WhatsAppBinding | null> {
  if (!settings.meta) return null;
  const {
    rows: [a],
  } = await sql<{
    tenant_id: string;
    facility_id: string;
  }>`SELECT * FROM comms.account_for_phone(${phone})`.execute(db);
  if (!a) return null;
  const c = await connection(
    db,
    { tenantId: a.tenant_id, actor: { kind: "system" } },
    a.facility_id,
    "whatsapp",
  );
  if (!c || c.external_id !== phone || !c.metadata.subscribed) return null;
  return {
    mode: "multi_clinic",
    tenantId: a.tenant_id,
    facilityId: a.facility_id,
    phoneNumberId: phone,
    businessAccountId: c.metadata.businessAccountId,
    accessTokenEnv: "MANAGED_DATABASE",
    accessTokenPresent: true,
    signatureConfigured: true,
    inboundConfigured: true,
    outboundCredentialsReady: true,
  };
}
async function tenantTx<T>(
  db: Kysely<DB>,
  tenantId: string,
  fn: (tx: Transaction<DB>) => Promise<T>,
) {
  return db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, tenantId);
    await sql`SET LOCAL ROLE mod_comms`.execute(tx);
    return fn(tx);
  });
}
/** Only staff free-text replies with fresh consent/window are eligible. Unknown acceptance never retries automatically. */
export async function dispatchManagedWhatsApp(
  db: Kysely<DB>,
  settings: ManagedSettings,
) {
  if (!settings.whatsappSending || !settings.meta) return 0;
  const { rows } = await sql<{
    tenant_id: string;
    id: string;
  }>`SELECT * FROM comms.managed_send_candidates()`.execute(db);
  let count = 0;
  for (const row of rows) {
    const claim = await tenantTx(db, row.tenant_id, async (tx) => {
      const {
        rows: [m],
      } =
        await sql<any>`SELECT m.*,c.id AS connection_id,c.external_id,c.metadata,c.credential,c.enabled FROM comms.outbound_message m JOIN comms.managed_connection c ON c.tenant_id=m.tenant_id AND c.facility_id=m.facility_id AND c.provider='whatsapp' AND c.enabled WHERE m.id=${row.id} AND m.status='queued' AND m.managed_send_requested AND c.metadata->>'subscribed'='true' FOR UPDATE OF m`.execute(
          tx,
        );
      if (!m) return null;
      if (
        ["reminder", "broadcast"].includes(m.managed_purpose) &&
        (await quietNow(tx, m.facility_id))
      )
        return null;
      const {
        rows: [d],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.managed_delivery(tenant_id,outbound_id,connection_id) VALUES(${row.tenant_id},${m.id},${m.connection_id}) ON CONFLICT DO NOTHING RETURNING id`.execute(
        tx,
      );
      if (!d) return null;
      await sql`UPDATE comms.outbound_message SET transport='meta',status='claimed',attempts=1 WHERE id=${row.id}`.execute(
        tx,
      );
      return { ...m, attemptId: d.id };
    });
    if (!claim) continue;
    try {
      await tenantTx(db, row.tenant_id, async (tx) => {
        await assertWhatsAppActive(tx);
        const {
          rows: [contact],
        } = await sql<{
          address: string;
        }>`SELECT address FROM comms.contact_point WHERE id=${claim.contact_point_id}`.execute(
          tx,
        );
        if (!contact) throw Error();
        await addressLock(tx, row.tenant_id, contact.address);
        await sql`SELECT pg_advisory_xact_lock(hashtextextended('access:' || ${row.tenant_id},0))`.execute(
          tx,
        );
        await sql`SET LOCAL ROLE mod_platform`.execute(tx);
        await sql`SELECT id FROM platform.tenant WHERE id=${row.tenant_id} FOR SHARE`.execute(
          tx,
        );
        await sql`SELECT id FROM platform.facility WHERE id=${claim.facility_id} FOR SHARE`.execute(
          tx,
        );
        await sql`SELECT id FROM platform.module_state WHERE module_code='comms' FOR SHARE`.execute(
          tx,
        );
        await sql`SET LOCAL ROLE mod_comms`.execute(tx);
        const {
          rows: [operational],
        } = await sql<{
          ok: boolean;
        }>`SELECT EXISTS(SELECT 1 FROM platform.tenant t JOIN platform.facility f ON f.tenant_id=t.id WHERE t.status IN('active','trial') AND f.id=${claim.facility_id} AND f.status='active') AS ok`.execute(
          tx,
        );
        if (!operational?.ok) throw Error();
        await assertWhatsAppActive(tx);
        // Disconnect/reconnect cannot race a provider request using a superseded credential.
        const {
          rows: [currentConnection],
        } =
          await sql`SELECT id FROM comms.managed_connection WHERE id=${claim.connection_id} AND enabled AND credential=${claim.credential} AND external_id=${claim.external_id} AND metadata->>'subscribed'='true' FOR SHARE`.execute(
            tx,
          );
        if (
          !currentConnection ||
          claim.managed_details.phoneNumberId !== claim.external_id
        )
          throw Error();
        const {
          rows: [valid],
        } = await sql<{
          ok: boolean;
        }>`SELECT EXISTS(SELECT 1 FROM comms.conversation c JOIN comms.contact_point p ON p.id=c.contact_point_id AND p.tenant_id=c.tenant_id
          JOIN platform.staff s ON s.id=${claim.created_by} AND s.tenant_id=c.tenant_id AND s.status='active'
          JOIN platform.facility f ON f.id=c.facility_id AND f.tenant_id=c.tenant_id AND f.status='active'
          WHERE c.id=${claim.conversation_id} AND c.status='open' AND p.status='active' AND comms.has_consent(p.id,'care') AND c.last_inbound_at>now()-interval '24 hours'
          AND EXISTS(SELECT 1 FROM comms.inbound_message i WHERE i.conversation_id=c.id AND i.phone_number_id=${claim.external_id} AND i.received_at>now()-interval '24 hours')
          AND EXISTS(SELECT 1 FROM platform.staff_permission sp WHERE sp.staff_id=s.id AND sp.permission='comms.reply' AND (sp.facility_id IS NULL OR sp.facility_id=c.facility_id))
          AND EXISTS(SELECT 1 FROM platform.user_account u WHERE u.staff_id=s.id AND u.status='active')
          AND EXISTS(SELECT 1 FROM comms.managed_connection mc WHERE mc.id=${claim.connection_id} AND mc.enabled AND mc.external_id=${claim.external_id} AND mc.credential=${claim.credential} AND mc.metadata->>'subscribed'='true')) AS ok`.execute(
          tx,
        );
        let templateBody: any;
        if (claim.managed_purpose === "broadcast") {
          templateBody = await broadcastPayload(tx, claim, settings);
        } else if (claim.managed_purpose === "reminder") {
          templateBody = await reminderPayload(tx, claim, settings);
        } else if (claim.managed_purpose === "reply") {
          if (!valid?.ok) throw Error();
        } else {
          const {
            rows: [bot],
          } = await sql<{
            ok: boolean;
          }>`SELECT EXISTS(SELECT 1 FROM comms.conversation c JOIN comms.contact_point p ON p.id=c.contact_point_id AND p.tenant_id=c.tenant_id
            JOIN comms.whatsapp_workspace w ON w.facility_id=c.facility_id AND w.tenant_id=c.tenant_id
            JOIN platform.facility f ON f.id=c.facility_id AND f.tenant_id=c.tenant_id AND f.status='active'
            JOIN comms.inbound_message i ON i.id=${claim.managed_inbound_id} AND i.tenant_id=c.tenant_id AND i.conversation_id=c.id
            JOIN comms.managed_connection mc ON mc.id=${claim.connection_id} AND mc.tenant_id=c.tenant_id AND mc.enabled AND mc.credential=${claim.credential} AND mc.metadata->>'subscribed'='true'
            WHERE c.id=${claim.conversation_id} AND c.status='open' AND c.automation_state='automation' AND p.status='active' AND c.last_inbound_at>now()-interval '24 hours'
            AND w.draft->>'live'='true' AND coalesce(w.draft->>'paused','false')<>'true' AND i.created_at>=w.booking_enabled_at AND i.phone_number_id=${claim.external_id}
            AND (comms.has_consent(p.id,'care') OR (${claim.managed_purpose}='booking_prompt' AND NOT EXISTS(SELECT 1 FROM comms.messaging_consent_event e JOIN comms.contact_point alias ON alias.id=e.contact_point_id AND alias.tenant_id=e.tenant_id WHERE alias.address=p.address AND e.action='stop' AND e.occurred_at>i.created_at)))) AS ok`.execute(
            tx,
          );
          if (!bot?.ok) throw Error();
          await bookingAuthority(
            db,
            bookingSite(settings, row.tenant_id, claim.facility_id),
          );
        }
        const tokens = unseal<{ token: string }>(
          settings,
          claim.credential,
          aad(row.tenant_id, claim.facility_id),
        );
        let response: any;
        try {
          response = await providerJson(
            settings,
            `https://graph.facebook.com/${settings.meta!.graphVersion}/${claim.external_id}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tokens.token}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: contact.address.replace("+", ""),
                ...(templateBody ?? {
                  type: "text",
                  text: { preview_url: false, body: claim.text_content },
                }),
              }),
            },
          );
        } catch {
          await sql`UPDATE comms.managed_delivery SET state='uncertain' WHERE id=${claim.attemptId}`.execute(
            tx,
          );
          await sql`UPDATE comms.outbound_message SET status='unknown' WHERE id=${row.id}`.execute(
            tx,
          );
          return;
        }
        const id = response.messages?.[0]?.id;
        if (typeof id !== "string" || id.length > 1024) {
          await sql`UPDATE comms.managed_delivery SET state='uncertain' WHERE id=${claim.attemptId}`.execute(
            tx,
          );
          await sql`UPDATE comms.outbound_message SET status='unknown' WHERE id=${row.id}`.execute(
            tx,
          );
          return;
        }
        await sql`UPDATE comms.managed_delivery SET state='accepted',provider_message_id=${id} WHERE id=${claim.attemptId}`.execute(
          tx,
        );
        await sql`UPDATE comms.outbound_message SET status='sent' WHERE id=${row.id}`.execute(
          tx,
        );
      });
    } catch {
      await tenantTx(db, row.tenant_id, async (tx) => {
        await sql`UPDATE comms.managed_delivery SET state='failed' WHERE id=${claim.attemptId} AND state='claimed'`.execute(
          tx,
        );
        await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE id=${row.id} AND status='claimed'`.execute(
          tx,
        );
      });
    }
    count++;
  }
  return count;
}
export async function whatsappThread(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  reveal: boolean,
) {
  const result = await thread(db, caller, id, reveal);
  const c = await connection(
    db,
    caller,
    result.conversation.facilityId,
    "whatsapp",
  );
  const window = await runQuery(
    db,
    caller.tenantId,
    async (tx) =>
      (
        await sql`SELECT id FROM comms.inbound_message WHERE conversation_id=${id} AND phone_number_id=${c?.external_id ?? ""} AND received_at>now()-interval '24 hours' LIMIT 1`.execute(
          tx,
        )
      ).rows.length > 0,
  );
  result.conversation.canReply = result.conversation.canReply && !!c && window;
  return result;
}
export async function whatsappCommand(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: { version: number; text?: string },
  action: "assign" | "close" | "reply" | "handoff" | "resume",
  key: string,
  settings: ManagedSettings,
) {
  if (action === "resume") {
    const ready = await runQuery(
      db,
      caller.tenantId,
      async (tx) =>
        (
          await sql`SELECT w.id FROM comms.whatsapp_workspace w JOIN comms.conversation c ON c.facility_id=w.facility_id AND c.tenant_id=w.tenant_id WHERE c.id=${id} AND w.draft->>'live'='true' AND coalesce(w.draft->>'paused','false')<>'true'`.execute(
            tx,
          )
        ).rows.length > 0,
    );
    if (!ready)
      throw preconditionFailed(
        "Enable booking before handing this conversation back to the assistant.",
      );
  }
  if (action === "reply" && !settings.whatsappSending)
    throw preconditionFailed(
      "WhatsApp sending is not available yet. Your reply was not queued.",
    );
  let managedDetails: Record<string, string> = {};
  if (action === "reply") {
    const facilityId = await runQuery(
      db,
      caller.tenantId,
      async (tx) =>
        (
          await tx
            .selectFrom("comms.conversation")
            .select("facility_id")
            .where("id", "=", id)
            .executeTakeFirstOrThrow()
        ).facility_id,
    );
    const conn = await connection(db, caller, facilityId, "whatsapp");
    if (!conn?.metadata.subscribed)
      throw preconditionFailed("Connect WhatsApp before sending a reply.");
    const hasWindow = await runQuery(
      db,
      caller.tenantId,
      async (tx) =>
        (
          await sql`SELECT id FROM comms.inbound_message WHERE conversation_id=${id} AND phone_number_id=${conn.external_id} AND received_at>now()-interval '24 hours' LIMIT 1`.execute(
            tx,
          )
        ).rows.length > 0,
    );
    if (!hasWindow)
      throw preconditionFailed(
        "Wait for a new message to this WhatsApp number before replying.",
      );
    managedDetails = { phoneNumberId: conn.external_id };
  }
  return conversationCommand(
    db,
    caller,
    id,
    input,
    action,
    key,
    action === "reply",
    managedDetails,
  );
}

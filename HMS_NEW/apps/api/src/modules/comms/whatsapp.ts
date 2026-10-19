import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { sql, type DB, type Kysely, type Transaction } from "@hms/db";
import {
  conflict,
  pgCode,
  forbidden,
  invalid,
  notFound,
  preconditionFailed,
  runCommand,
  runQuery,
  writeAudit,
  writeOutbox,
  type CommandContext,
} from "@hms/platform";
import {
  CampaignSchema,
  CampaignPreviewSchema,
  ConversationSchema,
  ConversationThreadSchema,
  WhatsAppAssetSchema,
  MessageTemplateSchema,
  WhatsAppSettingsSchema,
  type CampaignCreate,
  type WhatsAppUpload,
} from "@hms/contracts";
import { clock, type Caller } from "../../caller.ts";
import { addressLock, moduleState } from "./notifications.ts";
import type { OutboxEvent } from "../../../../worker/src/dispatcher.ts";
import {
  parseWhatsAppProviderConfig,
  resolveWhatsAppBinding,
  type WhatsAppBinding,
} from "./whatsapp-provider-config.ts";
import { templateSubmissionDto } from "./template-submission-shape.ts";
type Tx = Transaction<DB>;
export async function assertWhatsAppActive(tx: Tx) {
  if ((await moduleState(tx)) !== "active")
    throw preconditionFailed("communications module is inactive", {
      reason: "module_inactive",
    });
}
const time = (v: string | Date) => new Date(v).toISOString();
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export async function settings(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const f = await tx
      .selectFrom("platform.facility")
      .select("id")
      .where("id", "=", facilityId)
      .executeTakeFirst();
    if (!f) throw notFound("facility");
    const {
      rows: [a],
    } = await sql<{
      id: string;
      phone_number_id: string;
      version: number;
    }>`SELECT * FROM comms.channel_account WHERE facility_id=${facilityId}`.execute(
      tx,
    );
    const binding = a ? resolveWhatsAppBinding(a.phone_number_id) : null;
    const matches =
      !!binding &&
      (binding.mode === "legacy" ||
        (binding.tenantId === caller.tenantId &&
          binding.facilityId === facilityId));
    const configured = matches && !!binding?.inboundConfigured;
    const {
      rows: [counts],
    } = await sql<{
      openConversations: number;
      campaignDrafts: number;
      marketingContacts: number;
    }>`SELECT (SELECT count(*)::int FROM comms.conversation WHERE facility_id=${facilityId} AND status='open') AS "openConversations",(SELECT count(*)::int FROM comms.campaign WHERE facility_id=${facilityId} AND status='draft') AS "campaignDrafts",(SELECT count(DISTINCT address)::int FROM comms.contact_point c WHERE facility_id=${facilityId} AND status='active' AND comms.has_consent(c.id,'marketing')) AS "marketingContacts"`.execute(
      tx,
    );
    return WhatsAppSettingsSchema.parse({
      facilityId,
      accountId: a?.id ?? null,
      phoneNumberId: a?.phone_number_id ?? null,
      version: a?.version ?? 0,
      providerConfigured: configured && !!binding?.outboundCredentialsReady,
      templateStatusAvailable:
        matches &&
        binding?.mode === "multi_clinic" &&
        !!binding?.outboundCredentialsReady,
      templateSubmissionAvailable:
        process.env.WA_TEMPLATE_SUBMISSIONS_ENABLED === "true" &&
        matches &&
        binding?.mode === "multi_clinic" &&
        !!binding?.outboundCredentialsReady,
      webhookReady: configured,
      operationalCounts: counts,
      liveSending: false,
      transport: "log",
      templatesReady: false,
      storageReady: process.env.NODE_ENV !== "production",
      testRecipientIds: (process.env.WA_TEST_RECIPIENTS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      rateMinor: localRate(),
    });
  });
}
export async function saveSettings(
  db: Kysely<DB>,
  caller: Caller,
  input: { facilityId: string; phoneNumberId: string; version: number },
  key: string,
) {
  await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.channel_account",
      request: input,
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const provider = parseWhatsAppProviderConfig();
      if (
        provider.mode === "multi_clinic" &&
        !provider.bindings.some(
          (b) =>
            b.phoneNumberId === input.phoneNumberId &&
            b.tenantId === ctx.tenantId &&
            b.facilityId === input.facilityId,
        )
      )
        throw forbidden(
          "The company must provision this clinic provider binding first",
        );
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:account:${input.facilityId}`},0))`.execute(
        ctx.tx,
      );
      const {
        rows: [a],
      } = await sql<{
        version: number;
        id: string;
        phone_number_id: string;
      }>`SELECT id,version,phone_number_id FROM comms.channel_account WHERE facility_id=${input.facilityId} FOR UPDATE`.execute(
        ctx.tx,
      );
      if ((a?.version ?? 0) !== input.version)
        throw conflict("account changed", { reason: "stale_version" });
      if (
        a &&
        a.phone_number_id !== input.phoneNumberId &&
        (
          await sql<{
            used: boolean;
          }>`SELECT (EXISTS(SELECT 1 FROM comms.provider_event WHERE account_id=${a.id}) OR
          EXISTS(SELECT 1 FROM comms.template_provider_check WHERE account_id=${a.id}) OR
          EXISTS(SELECT 1 FROM comms.template_submission WHERE account_id=${a.id})) AS used`.execute(
            ctx.tx,
          )
        ).rows[0]!.used
      )
        throw conflict(
          "This number has provider history. A reviewed migration is required.",
          { reason: "account_has_history" },
        );
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.channel_account(tenant_id,facility_id,phone_number_id,created_by) VALUES(${ctx.tenantId},${input.facilityId},${input.phoneNumberId},${ctx.actor.staffId ?? null}) ON CONFLICT(tenant_id,facility_id) DO UPDATE SET phone_number_id=EXCLUDED.phone_number_id RETURNING id`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "update",
        subjectType: "comms.channel_account",
        subjectId: r!.id,
      });
      ctx.emit({
        eventType: "whatsapp.account_configured",
        aggregateType: "comms.channel_account",
        aggregateId: r!.id,
        payload: { facilityId: input.facilityId },
      });
    },
  );
  return settings(db, caller, input.facilityId);
}
export async function conversationRow(tx: Tx, id: string, lock = false) {
  const {
    rows: [r],
  } = await sql<{
    id: string;
    facility_id: string;
    contact_point_id: string;
    status: "open" | "closed";
    automation_state: "automation" | "handoff_requested" | "human";
    contact_active: boolean;
    module_active: boolean;
    assigned_staff_id: string | null;
    assigned_staff_name: string | null;
    last_inbound_at: Date | null;
    updated_at: Date;
    version: number;
    address: string;
    name: string | null;
    kinds: string[];
    care_allowed: boolean;
  }>`SELECT c.*,ARRAY(SELECT DISTINCT sc.kind FROM comms.support_case sc WHERE sc.conversation_id=c.id AND sc.tenant_id=c.tenant_id) AS kinds,s.display_name AS assigned_staff_name,p.address,p.status='active' AS contact_active,coalesce((SELECT ms.state='active' FROM platform.module_state ms WHERE ms.tenant_id=c.tenant_id AND ms.module_code='comms'),true) AS module_active,comms.has_consent(p.id,'care') AS care_allowed,coalesce(pt.given_name,b.name) AS name FROM comms.conversation c JOIN comms.contact_point p ON p.tenant_id=c.tenant_id AND p.id=c.contact_point_id LEFT JOIN patient.patient pt ON pt.tenant_id=p.tenant_id AND pt.id=p.patient_id LEFT JOIN booking.booking_party b ON b.tenant_id=p.tenant_id AND b.id=p.booking_party_id LEFT JOIN platform.staff s ON s.tenant_id=c.tenant_id AND s.id=c.assigned_staff_id WHERE c.id=${id} ${lock ? sql`FOR UPDATE OF c` : sql``}`.execute(
    tx,
  );
  if (!r) throw notFound("conversation");
  return r;
}
function conversationDto(
  r: Awaited<ReturnType<typeof conversationRow>>,
  now: Date,
  reveal: boolean,
) {
  const until = r.last_inbound_at
    ? new Date(new Date(r.last_inbound_at).getTime() + 86400000)
    : null;
  const blocked: Array<
    | "closed"
    | "human_handoff"
    | "module_inactive"
    | "consent_missing_or_withdrawn"
    | "reply_window_expired"
    | "contact_inactive"
  > = [];
  if (r.status !== "open") blocked.push("closed");
  if (r.automation_state !== "automation") blocked.push("human_handoff");
  if (!r.module_active) blocked.push("module_inactive");
  if (!r.contact_active) blocked.push("contact_inactive");
  if (!r.care_allowed) blocked.push("consent_missing_or_withdrawn");
  if (!until || until <= now) blocked.push("reply_window_expired");
  return ConversationSchema.parse({
    id: r.id,
    facilityId: r.facility_id,
    contactPointId: r.contact_point_id,
    status: r.status,
    automationState: r.automation_state,
    automationAllowed: blocked.length === 0,
    automationBlockedReasons: blocked,
    assignedStaffId: r.assigned_staff_id,
    assignedStaffName: r.assigned_staff_name,
    version: r.version,
    updatedAt: time(r.updated_at),
    replyUntil: until ? time(until) : null,
    canReply:
      r.status === "open" &&
      r.module_active &&
      r.contact_active &&
      !!until &&
      until > now &&
      r.care_allowed,
    contactAddress: reveal ? r.address : r.address.replace(/.(?=.{4})/g, "•"),
    name: r.name,
    kinds: r.status === "open" ? ["reception", ...r.kinds] : r.kinds,
  });
}
export async function conversationFacility(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
) {
  return runQuery(
    db,
    caller.tenantId,
    async (tx) => (await conversationRow(tx, id)).facility_id,
  );
}
export async function inboxContacts(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  reveal: boolean,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } =
      await sql<any>`SELECT c.*,comms.has_consent(c.id,'care') AS care,comms.has_consent(c.id,'reminders') AS reminders,comms.has_consent(c.id,'marketing') AS marketing FROM comms.contact_point c WHERE facility_id=${facilityId} AND status='active' ORDER BY created_at DESC LIMIT 100`.execute(
        tx,
      );
    return {
      items: rows.map((r) => ({
        id: r.id,
        facilityId: r.facility_id,
        patientId: r.patient_id,
        bookingPartyId: r.booking_party_id,
        channel: "whatsapp",
        address: reveal ? r.address : r.address.replace(/.(?=.{4})/g, "•"),
        status: r.status,
        version: r.version,
        interests: [],
        consents: {
          care: r.care,
          reminders: r.reminders,
          marketing: r.marketing,
        },
      })),
    };
  });
}
export async function conversations(
  db: Kysely<DB>,
  caller: Caller,
  q: {
    facilityId: string;
    status?: string;
    search?: string;
    kind?: string;
    offset: number;
    limit: number;
  },
  reveal: boolean,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<{
      id: string;
      total: string | number;
    }>`SELECT c.id,count(*) OVER() AS total FROM comms.conversation c JOIN comms.contact_point p ON p.tenant_id=c.tenant_id AND p.id=c.contact_point_id WHERE c.facility_id=${q.facilityId} AND (${q.status ?? null}::text IS NULL OR c.status=${q.status ?? null}) AND (${q.search ?? null}::text IS NULL OR p.address ILIKE ${"%" + (q.search ?? "") + "%"}) AND (${q.kind ?? null}::text IS NULL OR (${q.kind ?? null}='reception' AND c.status='open') OR EXISTS(SELECT 1 FROM comms.support_case sc WHERE sc.tenant_id=c.tenant_id AND sc.conversation_id=c.id AND sc.kind=${q.kind ?? null})) ORDER BY c.updated_at DESC,c.id DESC OFFSET ${q.offset} LIMIT ${q.limit}`.execute(
      tx,
    );
    return {
      items: await Promise.all(
        rows.map(async (r) =>
          conversationDto(
            await conversationRow(tx, r.id),
            clock(caller),
            reveal,
          ),
        ),
      ),
      total: Number(rows[0]?.total ?? 0),
      offset: q.offset,
      limit: q.limit,
    };
  });
}
export async function thread(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  reveal: boolean,
) {
  return runCommand(
    db,
    { ...caller, module: "comms", name: "comms.read_conversation" },
    async (ctx) => {
      const tx = ctx.tx;
      ctx.audit({
        action: "view",
        subjectType: "comms.conversation",
        subjectId: id,
      });
      const c = await conversationRow(tx, id);
      const { rows: messages } =
        await sql<any>`SELECT id,'inbound' AS direction,text_content AS text,created_at,NULL::uuid AS actor_staff_id,NULL::text AS status,NULL::text AS transport FROM comms.inbound_message WHERE conversation_id=${id} UNION ALL SELECT id,'outbound',text_content,created_at,created_by,status,transport FROM comms.outbound_message WHERE conversation_id=${id} ORDER BY created_at DESC LIMIT 101`.execute(
          tx,
        );
      const { rows: cases } =
        await sql<any>`SELECT * FROM comms.support_case WHERE conversation_id=${id} ORDER BY created_at DESC LIMIT 100`.execute(
          tx,
        );
      return ConversationThreadSchema.parse({
        conversation: conversationDto(c, clock(caller), reveal),
        hasOlderMessages: messages.length > 100,
        messages: messages
          .slice(0, 100)
          .reverse()
          .map((m) => ({
            id: m.id,
            direction: m.direction,
            text: m.text,
            createdAt: time(m.created_at),
            actorStaffId: m.actor_staff_id,
            status: m.status,
            transport: m.transport,
          })),
        cases: cases.map((r) => ({
          id: r.id,
          conversationId: r.conversation_id,
          kind: r.kind,
          description: r.description,
          rating: r.rating,
          status: r.status,
          version: r.version,
        })),
      });
    },
  );
}
export async function openConversation(
  db: Kysely<DB>,
  caller: Caller,
  input: { facilityId: string; contactPointId: string },
  key: string,
) {
  const result = await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.open_conversation",
      request: input,
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      if (!ctx.actor.staffId)
        throw forbidden("a staff member must open a human conversation");
      const {
        rows: [p],
      } = await sql<{
        id: string;
        address: string;
      }>`SELECT id,address FROM comms.contact_point WHERE id=${input.contactPointId} AND facility_id=${input.facilityId} AND status='active'`.execute(
        ctx.tx,
      );
      if (!p) throw notFound("contact at this clinic");
      await addressLock(ctx.tx, ctx.tenantId, p.address);
      const {
        rows: [existing],
      } = await sql<{
        id: string;
        status: "open" | "closed";
      }>`SELECT id,status FROM comms.conversation WHERE contact_point_id=${input.contactPointId} FOR UPDATE`.execute(
        ctx.tx,
      );
      // Opening an already-open inbox thread is a read, not a way to steal assignment without CAS.
      if (existing?.status === "open") return { id: existing.id };
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.conversation(tenant_id,facility_id,contact_point_id,created_by,automation_state,assigned_staff_id) VALUES(${ctx.tenantId},${input.facilityId},${input.contactPointId},${ctx.actor.staffId},'human',${ctx.actor.staffId}) ON CONFLICT(tenant_id,contact_point_id) DO UPDATE SET status='open',automation_state='human',assigned_staff_id=EXCLUDED.assigned_staff_id RETURNING id`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "create",
        subjectType: "comms.conversation",
        subjectId: r!.id,
      });
      ctx.emit({
        eventType: "conversation.opened",
        aggregateType: "comms.conversation",
        aggregateId: r!.id,
        payload: { conversationId: r!.id },
      });
      return { id: r!.id };
    },
  );
  return thread(db, caller, result.id, true);
}
export async function conversationCommand(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: { version: number; text?: string },
  action: "assign" | "close" | "reply" | "handoff" | "resume",
  key: string,
  managedSendRequested = false,
  managedDetails:Record<string,string> = {},
) {
  await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: `comms.conversation_${action}`,
      request: {
        id,
        ...input,
        ...(managedSendRequested ? { managedSendRequested: true,managedDetails } : {}),
      },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      if (!ctx.actor.staffId)
        throw forbidden("a staff member must manage this conversation");
      const initial = await conversationRow(ctx.tx, id);
      await addressLock(ctx.tx, ctx.tenantId, initial.address);
      const c = await conversationRow(ctx.tx, id, true);
      if (c.version !== input.version)
        throw conflict("conversation changed", { reason: "stale_version" });
      if (c.status === "closed") throw conflict("conversation is closed");
      if (action === "resume") {
        if (!c.contact_active || !c.care_allowed)
          throw preconditionFailed(
            "fresh care-messaging permission is required before resuming automation",
            { reason: "consent_missing_or_withdrawn" },
          );
        if (
          !c.last_inbound_at ||
          new Date(c.last_inbound_at).getTime() + 86400000 <=
            clock(caller).getTime()
        )
          throw preconditionFailed(
            "a current inbound reply window is required before resuming automation",
            { reason: "reply_window_expired" },
          );
        await sql`UPDATE comms.conversation SET automation_state='automation',assigned_staff_id=NULL WHERE id=${id}`.execute(
          ctx.tx,
        );
      } else if (action === "handoff") {
        await sql`UPDATE comms.conversation SET automation_state='handoff_requested',assigned_staff_id=NULL WHERE id=${id}`.execute(
          ctx.tx,
        );
      } else if (action === "reply") {
        if (
          !c.last_inbound_at ||
          new Date(c.last_inbound_at).getTime() + 86400000 <=
            clock(caller).getTime()
        )
          throw conflict("free-text reply window has expired", {
            reason: "reply_window_expired",
          });
        const {
          rows: [consent],
        } = await sql<{
          ok: boolean;
        }>`SELECT comms.has_consent(${c.contact_point_id},'care') AS ok`.execute(
          ctx.tx,
        );
        if (!consent!.ok)
          throw preconditionFailed(
            "explicit care-messaging consent is required",
          );
        await sql`INSERT INTO comms.outbound_message(tenant_id,facility_id,contact_point_id,conversation_id,text_content,created_by,managed_send_requested,managed_details) VALUES(${ctx.tenantId},${c.facility_id},${c.contact_point_id},${id},${input.text!},${ctx.actor.staffId ?? null},${managedSendRequested},${JSON.stringify(managedDetails)}::jsonb)`.execute(
          ctx.tx,
        );
        await sql`UPDATE comms.conversation SET automation_state='human',assigned_staff_id=${ctx.actor.staffId} WHERE id=${id}`.execute(
          ctx.tx,
        );
      } else
        await sql`UPDATE comms.conversation SET status=${action === "close" ? "closed" : "open"},automation_state='human',assigned_staff_id=${ctx.actor.staffId} WHERE id=${id}`.execute(
          ctx.tx,
        );
      ctx.audit({
        action: "update",
        subjectType: "comms.conversation",
        subjectId: id,
        diff: { action },
      });
      ctx.emit({
        eventType: "conversation.updated",
        aggregateType: "comms.conversation",
        aggregateId: id,
        payload: { conversationId: id, action },
      });
      return { id };
    },
  );
  return thread(db, caller, id, true);
}
export async function createCase(
  db: Kysely<DB>,
  caller: Caller,
  input: {
    conversationId: string;
    kind: string;
    description: string;
    rating?: number;
  },
  key: string,
) {
  const r = await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.create_case",
      request: input,
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      await conversationRow(ctx.tx, input.conversationId);
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.support_case(tenant_id,conversation_id,kind,description,rating,created_by) VALUES(${ctx.tenantId},${input.conversationId},${input.kind},${input.description},${input.rating ?? null},${ctx.actor.staffId ?? null}) RETURNING id`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "create",
        subjectType: "comms.support_case",
        subjectId: r!.id,
      });
      ctx.emit({
        eventType: "support.case_opened",
        aggregateType: "comms.support_case",
        aggregateId: r!.id,
        payload: { caseId: r!.id, conversationId: input.conversationId },
      });
      return { id: r!.id };
    },
  );
  return (await thread(db, caller, input.conversationId, true)).cases.find(
    (c) => c.id === r.id,
  )!;
}
export async function caseConversation(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const {
      rows: [c],
    } = await sql<{
      conversation_id: string;
    }>`SELECT conversation_id FROM comms.support_case WHERE id=${id}`.execute(
      tx,
    );
    if (!c) throw notFound("case");
    return c.conversation_id;
  });
}
export async function caseStatus(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: { version: number; status: string },
  key: string,
) {
  const conversationId = await caseConversation(db, caller, id);
  await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.case_status",
      request: { id, ...input },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const {
        rows: [c],
      } = await sql<{
        id: string;
      }>`UPDATE comms.support_case SET status=${input.status} WHERE id=${id} AND version=${input.version} RETURNING id`.execute(
        ctx.tx,
      );
      if (!c) throw conflict("case changed", { reason: "stale_version" });
      ctx.audit({
        action: "status_change",
        subjectType: "comms.support_case",
        subjectId: id,
        diff: { status: input.status },
      });
      ctx.emit({
        eventType: "support.case_status_changed",
        aggregateType: "comms.support_case",
        aggregateId: id,
        payload: { caseId: id, status: input.status },
      });
      return { id };
    },
  );
  return (await thread(db, caller, conversationId, true)).cases.find(
    (c) => c.id === id,
  )!;
}

function assetDto(r: any) {
  return WhatsAppAssetSchema.parse({
    id: r.id,
    facilityId: r.facility_id,
    ownerType: r.owner_type,
    ownerId: r.owner_id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    sha256: r.sha256,
    status: r.status,
    createdAt: time(r.created_at),
  });
}
const storageRoot = () =>
  path.resolve(
    process.env.COMMS_STORAGE_PATH ??
      path.join(process.cwd(), ".comms-storage"),
  );
function objectPath(key: string) {
  if (!/^[a-f0-9-]{36}\/\/[a-f0-9-]{36}$/.test(key))
    throw forbidden("invalid storage key");
  const target = path.resolve(storageRoot(), key.replace("//", "/"));
  if (!target.startsWith(storageRoot() + path.sep))
    throw forbidden("invalid storage path");
  return target;
}
function validateFile(input: WhatsAppUpload, kind: string) {
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(input.dataBase64) ||
    input.dataBase64.length % 4
  )
    throw invalid("invalid base64");
  const bytes = Buffer.from(input.dataBase64, "base64");
  if (
    !bytes.length ||
    bytes.length > (input.mimeType === "application/pdf" ? 10 : 5) * 1024 * 1024
  )
    throw invalid("file exceeds permitted size");
  if (
    (kind === "department" && input.mimeType !== "application/pdf") ||
    (kind !== "department" && input.mimeType === "application/pdf")
  )
    throw invalid(
      "this content requires a photo/image or department PDF respectively",
    );
  if (input.mimeType === "application/pdf") {
    const source = bytes.toString("latin1");
    if (
      !source.startsWith("%PDF-") ||
      !source.trimEnd().endsWith("%%EOF") ||
      /\/JavaScript|\/JS\b|\/Launch|\/EmbeddedFile|\/OpenAction/i.test(source)
    )
      throw invalid("invalid or active PDF content");
  } else if (input.mimeType === "image/png") {
    if (
      bytes.length < 45 ||
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString("ascii", 12, 16) !== "IHDR" ||
      !bytes.includes(Buffer.from("IEND"))
    )
      throw invalid("invalid PNG image");
    const w = bytes.readUInt32BE(16),
      h = bytes.readUInt32BE(20);
    if (!w || !h || w * h > 50_000_000)
      throw invalid("image dimensions exceed limit");
  } else if (
    bytes.length < 20 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    throw invalid("invalid JPEG image");
  return bytes;
}
export async function uploadAsset(
  db: Kysely<DB>,
  caller: Caller,
  kind: "practitioner" | "department" | "campaign",
  ownerId: string | null,
  input: WhatsAppUpload,
  key: string,
) {
  if (process.env.NODE_ENV === "production")
    throw preconditionFailed(
      "production content uploads require a configured private storage and scanning adapter",
    );
  const bytes = validateFile(input, kind);
  const result = await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.upload_asset",
      request: {
        kind,
        ownerId,
        facilityId: input.facilityId,
        filename: input.filename,
        mimeType: input.mimeType,
        sha256: hash(bytes.toString("base64")),
      },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      if (kind === "department") {
        const d = await ctx.tx
          .selectFrom("platform.department")
          .select("id")
          .where("id", "=", ownerId!)
          .where("facility_id", "=", input.facilityId)
          .executeTakeFirst();
        if (!d) throw notFound("department at this clinic");
      }
      if (kind === "practitioner") {
        const a = await ctx.tx
          .selectFrom("catalog.practitioner_affiliation")
          .select("id")
          .where("staff_id", "=", ownerId!)
          .where("facility_id", "=", input.facilityId)
          .where(
            "valid_from",
            "<=",
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
            }).format(clock(caller)),
          )
          .where((eb) =>
            eb.or([
              eb("valid_to", "is", null),
              eb(
                "valid_to",
                ">",
                new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Kolkata",
                }).format(clock(caller)),
              ),
            ]),
          )
          .executeTakeFirst();
        if (!a) throw notFound("doctor at this clinic");
      }
      const id = randomUUID(),
        objectKey = `${ctx.tenantId}//${id}`,
        target = objectPath(objectKey);
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
      try {
        if (ownerId)
          await sql`UPDATE comms.asset SET status='retired' WHERE facility_id=${input.facilityId} AND owner_type=${kind} AND owner_id=${ownerId} AND status='local_validated'`.execute(
            ctx.tx,
          );
        const {
          rows: [r],
        } =
          await sql<any>`INSERT INTO comms.asset(id,tenant_id,facility_id,owner_type,owner_id,filename,mime_type,size_bytes,sha256,object_key,status,created_by) VALUES(${id},${ctx.tenantId},${input.facilityId},${kind},${ownerId},${path.basename(input.filename)},${input.mimeType},${bytes.length},${createHash("sha256").update(bytes).digest("hex")},${objectKey},'local_validated',${ctx.actor.staffId ?? null}) RETURNING *`.execute(
            ctx.tx,
          );
        ctx.audit({
          action: "create",
          subjectType: "comms.asset",
          subjectId: id,
          diff: {
            ownerType: kind,
            mimeType: input.mimeType,
            sizeBytes: bytes.length,
          },
        });
        ctx.emit({
          eventType: "comms.asset_uploaded",
          aggregateType: "comms.asset",
          aggregateId: id,
          payload: { assetId: id, facilityId: input.facilityId },
        });
        return assetDto(r);
      } catch (err) {
        await unlink(target).catch(() => {});
        throw err;
      }
    },
  );
  return result;
}
export async function assets(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => ({
    items: (
      await sql<any>`SELECT * FROM comms.asset WHERE facility_id=${facilityId} AND status<>'retired' ORDER BY created_at DESC LIMIT 200`.execute(
        tx,
      )
    ).rows.map(assetDto),
  }));
}
export async function assetRecord(db: Kysely<DB>, caller: Caller, id: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const {
      rows: [r],
    } = await sql<any>`SELECT * FROM comms.asset WHERE id=${id}`.execute(tx);
    if (!r) throw notFound("asset");
    return r;
  });
}
export async function assetContent(db: Kysely<DB>, caller: Caller, id: string) {
  const r = await assetRecord(db, caller, id);
  if (r.status !== "local_validated")
    throw preconditionFailed("asset is not validated for access");
  const bytes = await readFile(objectPath(r.object_key));
  if (createHash("sha256").update(bytes).digest("hex") !== r.sha256)
    throw preconditionFailed("asset integrity check failed");
  await runCommand(
    db,
    { ...caller, module: "comms", name: "comms.read_asset" },
    async (ctx) => {
      ctx.audit({ action: "view", subjectType: "comms.asset", subjectId: id });
      return { id };
    },
  );
  return { bytes, mimeType: r.mime_type, filename: r.filename };
}
function templateDto(r: any) {
  return MessageTemplateSchema.parse({
    id: r.id,
    facilityId: r.facility_id,
    name: r.name,
    body: r.body,
    language: r.language,
    category: r.category,
    parameterCount: r.parameter_count,
    header: r.header,
    providerApproval: r.provider_approval,
    providerStatusCheck: r.provider_status_check
      ? {
          status: r.provider_status_check.provider_status,
          match: r.provider_status_check.content_match,
          checkedAt: time(r.provider_status_check.checked_at),
          providerTemplateId: r.provider_status_check.provider_template_id,
          localVersion: r.provider_status_check.template_version,
        }
      : null,
    submission: r.submission ? templateSubmissionDto(r.submission, r) : null,
    simulationOnly: true,
    editable: !r.edit_blocked,
    editBlockedReason: r.edit_blocked
      ? "Used by an approved or scheduled campaign. Create another template instead."
      : null,
    version: r.version,
  });
}
export async function templates(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => ({
    items: (
      await sql<any>`SELECT t.*, (SELECT to_jsonb(p) FROM comms.template_provider_check p WHERE p.template_id=t.id ORDER BY p.checked_at DESC,p.id DESC LIMIT 1) AS provider_status_check,
        (SELECT to_jsonb(s) FROM comms.template_submission s WHERE s.template_id=t.id
          ORDER BY (s.body=t.body AND s.language=t.language AND s.category=t.category AND s.parameter_count=t.parameter_count AND t.header='none' AND s.state NOT IN('failed','cancelled')) DESC,s.created_at DESC,s.id DESC LIMIT 1) AS submission,
        EXISTS(SELECT 1 FROM comms.campaign c WHERE c.template_id=t.id AND (c.status='scheduled' OR c.approval_hash IS NOT NULL OR c.approved_by IS NOT NULL)) AS edit_blocked FROM comms.message_template t WHERE facility_id=${facilityId} ORDER BY name`.execute(
        tx,
      )
    ).rows.map(templateDto),
  }));
}
export async function createTemplate(
  db: Kysely<DB>,
  caller: Caller,
  input: {
    facilityId: string;
    name: string;
    body: string;
    language: string;
    category: string;
    parameterCount: number;
    header: string;
  },
  key: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.local_template",
      request: input,
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      validateTemplateParameters(input.body, input.parameterCount);
      const {
        rows: [r],
      } =
        await sql<any>`INSERT INTO comms.message_template(tenant_id,facility_id,name,body,language,category,parameter_count,header,created_by) VALUES(${ctx.tenantId},${input.facilityId},${input.name},${input.body},${input.language},${input.category},${input.parameterCount},${input.header},${ctx.actor.staffId ?? null}) RETURNING *`
          .execute(ctx.tx)
          .catch((error: unknown) => {
            if (pgCode(error) === "23505")
              throw conflict(
                "A template with this name and language already exists at this clinic.",
                { reason: "duplicate_template" },
              );
            throw error;
          });
      ctx.audit({
        action: "create",
        subjectType: "comms.message_template",
        subjectId: r.id,
      });
      ctx.emit({
        eventType: "template.local_draft_created",
        aggregateType: "comms.message_template",
        aggregateId: r.id,
        payload: { templateId: r.id, providerApproval: "not_synced" },
      });
      return templateDto(r);
    },
  );
}
/** Numbered body parameters must be contiguous and every brace must belong to a placeholder. */
export function validateTemplateParameters(body: string, count: number) {
  if (!Number.isInteger(count) || count < 0 || count > 10)
    throw invalid("template parameter count must be between 0 and 10");
  const placeholders = [...body.matchAll(/\{\{([1-9][0-9]*)\}\}/g)].map((m) =>
    Number(m[1]),
  );
  const literal = body.replace(/\{\{([1-9][0-9]*)\}\}/g, "");
  if (
    /[{}]/.test(literal) ||
    placeholders.some((n) => n > count) ||
    new Set(placeholders).size !== count
  )
    throw invalid(
      "Use contiguous numbered placeholders {{1}} through the parameter count; names, gaps and malformed braces are not allowed.",
    );
}

export async function templateFacility(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const row = await tx
      .selectFrom("comms.message_template")
      .select("facility_id")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) throw notFound("message template");
    return row.facility_id;
  });
}

export async function editTemplate(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: {
    facilityId: string;
    version: number;
    name: string;
    body: string;
    language: string;
    category: string;
    parameterCount: number;
    header: string;
  },
  key: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.edit_template",
      request: { id, ...input },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const {
        rows: [before],
      } =
        await sql<any>`SELECT * FROM comms.message_template WHERE id=${id} AND facility_id=${input.facilityId} FOR UPDATE`.execute(
          ctx.tx,
        );
      if (!before) throw notFound("message template");
      if (before.version !== input.version)
        throw conflict(
          "This template changed. Reload it and review your changes.",
          { reason: "stale_version", currentVersion: before.version },
        );
      const {
        rows: [used],
      } = await sql<{
        blocked: boolean;
      }>`SELECT EXISTS(SELECT 1 FROM comms.campaign WHERE template_id=${id} AND (status='scheduled' OR approval_hash IS NOT NULL OR approved_by IS NOT NULL)) AS blocked`.execute(
        ctx.tx,
      );
      if (used!.blocked)
        throw conflict(
          "This template is used by an approved or scheduled campaign. Create another template.",
          { reason: "approved_campaign_content" },
        );
      validateTemplateParameters(input.body, input.parameterCount);
      const {
        rows: [draft],
      } = await sql<{
        linked: boolean;
      }>`SELECT EXISTS(SELECT 1 FROM comms.campaign WHERE template_id=${id} AND status='draft') AS linked`.execute(
        ctx.tx,
      );
      if (
        draft!.linked &&
        (before.category !== input.category ||
          before.parameter_count !== input.parameterCount ||
          before.header !== input.header)
      )
        throw conflict(
          "Draft campaigns use this template structure. Create another template to change category, header or parameter count.",
          { reason: "draft_campaign_structure" },
        );
      // An edited body/language invalidates all prior local tests and review versions.
      await sql`UPDATE comms.campaign SET local_tested=false WHERE template_id=${id} AND status='draft'`.execute(
        ctx.tx,
      );
      const {
        rows: [saved],
      } =
        await sql<any>`UPDATE comms.message_template SET name=${input.name},body=${input.body},language=${input.language},category=${input.category},parameter_count=${input.parameterCount},header=${input.header},provider_approval='not_synced' WHERE id=${id} RETURNING *`
          .execute(ctx.tx)
          .catch((error: unknown) => {
            if (pgCode(error) === "23505")
              throw conflict(
                "A template with this name and language already exists at this clinic.",
                { reason: "duplicate_template" },
              );
            throw error;
          });
      ctx.audit({
        action: "update",
        subjectType: "comms.message_template",
        subjectId: id,
        diff: {
          version: [before.version, saved.version],
          providerApproval: "not_synced",
        },
      });
      ctx.emit({
        eventType: "template.local_draft_updated",
        aggregateType: "comms.message_template",
        aggregateId: id,
        aggregateVersion: saved.version,
        payload: { templateId: id, providerApproval: "not_synced" },
      });
      return templateDto(saved);
    },
  );
}

function localRate() {
  const rate = Number(process.env.WA_ESTIMATED_RATE_MINOR ?? 100);
  if (!Number.isSafeInteger(rate) || rate < 0 || rate > 100000)
    throw preconditionFailed("invalid configured campaign estimate");
  return rate;
}
function campaignDto(r: any) {
  return CampaignSchema.parse({
    id: r.id,
    facilityId: r.facility_id,
    title: r.title,
    templateId: r.template_id,
    parameters: r.parameters,
    assetId: r.asset_id,
    scheduledAt: time(r.scheduled_at),
    interest: r.interest,
    rateMinor: r.rate_minor,
    budgetMinor: Number(r.budget_minor),
    reservedMinor: Number(r.reserved_minor),
    status: r.status,
    version: r.version,
    approvedCount: r.approved_count,
    simulationOnly: true,
    providerDelivery: "unavailable",
  });
}
export async function campaignRecord(tx: Tx, id: string, lock = false) {
  const {
    rows: [r],
  } =
    await sql<any>`SELECT * FROM comms.campaign WHERE id=${id} ${lock ? sql`FOR UPDATE` : sql``}`.execute(
      tx,
    );
  if (!r) throw notFound("campaign");
  return r;
}
export async function campaignFacility(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
) {
  return runQuery(
    db,
    caller.tenantId,
    async (tx) => (await campaignRecord(tx, id)).facility_id as string,
  );
}
export async function campaigns(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => ({
    items: (
      await sql<any>`SELECT * FROM comms.campaign WHERE facility_id=${facilityId} ORDER BY created_at DESC LIMIT 100`.execute(
        tx,
      )
    ).rows.map(campaignDto),
  }));
}
export async function createCampaign(
  db: Kysely<DB>,
  caller: Caller,
  input: CampaignCreate,
  key: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.create_campaign",
      request: input,
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const {
        rows: [t],
      } =
        await sql<any>`SELECT * FROM comms.message_template WHERE id=${input.templateId} AND facility_id=${input.facilityId} FOR UPDATE`.execute(
          ctx.tx,
        );
      if (!t || t.category !== "marketing")
        throw invalid("choose a marketing template at this clinic");
      if (input.parameters.length !== t.parameter_count)
        throw invalid("wrong template parameter count");
      if (new Date(input.scheduledAt) < clock(caller))
        throw invalid("campaign time must be in the future");
      if (t.header === "image" && !input.assetId)
        throw invalid("image template requires a campaign asset");
      if (input.assetId) {
        const {
          rows: [asset],
        } =
          await sql<any>`SELECT * FROM comms.asset WHERE id=${input.assetId} AND facility_id=${input.facilityId} AND owner_type='campaign' AND status='local_validated'`.execute(
            ctx.tx,
          );
        if (!asset) throw invalid("campaign image is unavailable");
      }
      const {
        rows: [r],
      } =
        await sql<any>`INSERT INTO comms.campaign(tenant_id,facility_id,title,template_id,parameters,asset_id,scheduled_at,interest,rate_minor,budget_minor,created_by) VALUES(${ctx.tenantId},${input.facilityId},${input.title},${input.templateId},${JSON.stringify(input.parameters)}::jsonb,${input.assetId ?? null},${input.scheduledAt},${input.interest ?? null},${localRate()},${input.budgetMinor},${ctx.actor.staffId ?? null}) RETURNING *`.execute(
          ctx.tx,
        );
      ctx.audit({
        action: "create",
        subjectType: "comms.campaign",
        subjectId: r.id,
      });
      ctx.emit({
        eventType: "campaign.draft_created",
        aggregateType: "comms.campaign",
        aggregateId: r.id,
        payload: { campaignId: r.id },
      });
      return campaignDto(r);
    },
  );
}
async function campaignAudience(tx: Tx, c: any) {
  return (
    await sql<{
      id: string;
      address: string;
    }>`SELECT DISTINCT ON(p.address) p.id,p.address FROM comms.contact_point p WHERE p.facility_id=${c.facility_id} AND p.status='active' AND comms.has_consent(p.id,'marketing') AND (${c.interest}::text IS NULL OR EXISTS(SELECT 1 FROM comms.contact_interest i WHERE i.tenant_id=p.tenant_id AND i.contact_point_id=p.id AND i.interest=${c.interest})) ORDER BY p.address,p.created_at,p.id`.execute(
      tx,
    )
  ).rows;
}
async function preview(tx: Tx, c: any) {
  const recipients = await campaignAudience(tx, c);
  const {
    rows: [t],
  } =
    await sql<any>`SELECT * FROM comms.message_template WHERE id=${c.template_id}`.execute(
      tx,
    );
  if (!t) throw notFound("template");
  let assetHash: string | null = null;
  if (c.asset_id) {
    const {
      rows: [a],
    } =
      await sql<any>`SELECT sha256,status FROM comms.asset WHERE id=${c.asset_id} AND facility_id=${c.facility_id}`.execute(
        tx,
      );
    if (!a || a.status !== "local_validated")
      throw preconditionFailed("campaign image is no longer available");
    assetHash = a.sha256;
  }
  const body = t.body.replace(
    /\{\{(\d+)\}\}/g,
    (_m: string, n: string) => c.parameters[Number(n) - 1] ?? "",
  );
  const estimated = recipients.length * c.rate_minor;
  return {
    value: CampaignPreviewSchema.parse({
      campaignId: c.id,
      body,
      recipients: recipients.length,
      estimatedCostMinor: estimated,
      withinBudget: estimated <= Number(c.budget_minor),
      audienceHash: hash(
        JSON.stringify({
          recipients: recipients.map((r) => ({
            id: r.id,
            destinationHash: hash(r.address),
          })),
          templateVersion: t.version,
          parameters: c.parameters,
          assetHash,
          rateMinor: c.rate_minor,
          budgetMinor: Number(c.budget_minor),
          scheduledAt: time(c.scheduled_at),
          interest: c.interest,
        }),
      ),
      version: c.version,
      simulationOnly: true,
    }),
    recipients,
  };
}
export async function campaignPreview(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
) {
  return runQuery(
    db,
    caller.tenantId,
    async (tx) => (await preview(tx, await campaignRecord(tx, id))).value,
  );
}
export async function campaignAction(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: any,
  action: "test" | "approve" | "pause",
  key: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: `comms.campaign_${action}`,
      request: { id, ...input },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const initial = await campaignRecord(ctx.tx, id);
      // Template edits and campaign approval use this same lock. Content cannot change after
      // approval's snapshot check or while the approved campaign is being persisted.
      await sql`SELECT id FROM comms.message_template WHERE id=${initial.template_id} FOR UPDATE`.execute(
        ctx.tx,
      );
      if (action === "approve") {
        const addresses = (
          await sql<{
            address: string;
          }>`SELECT DISTINCT address FROM comms.contact_point WHERE facility_id=${initial.facility_id} ORDER BY address`.execute(
            ctx.tx,
          )
        ).rows;
        for (const p of addresses)
          await addressLock(ctx.tx, ctx.tenantId, p.address);
      }
      const c = await campaignRecord(ctx.tx, id, true);
      if (c.version !== input.version)
        throw conflict("campaign changed", { reason: "stale_version" });
      if (action === "test") {
        if (c.status !== "draft") throw conflict("only drafts can be tested");
        const allowed = (process.env.WA_TEST_RECIPIENTS ?? "")
          .split(",")
          .map((s) => s.trim());
        if (!allowed.includes(input.recipientId) || !input.recipientId)
          throw forbidden("choose a configured test recipient");
        await sql`UPDATE comms.campaign SET local_tested=true WHERE id=${id}`.execute(
          ctx.tx,
        );
        const testId = randomUUID();
        ctx.audit({
          action: "update",
          subjectType: "comms.campaign",
          subjectId: id,
          diff: { localTestOnly: true },
        });
        ctx.emit({
          eventType: "campaign.local_test_queued",
          aggregateType: "comms.campaign",
          aggregateId: id,
          payload: { campaignId: id, testId },
        });
        return {
          status: "queued" as const,
          transport: "log" as const,
          delivered: false as const,
          testId,
        };
      }
      if (action === "pause") {
        if (c.status !== "scheduled")
          throw conflict("only scheduled local campaigns can be paused");
        await sql`UPDATE comms.campaign SET status='paused' WHERE id=${id}`.execute(
          ctx.tx,
        );
        await sql`UPDATE comms.campaign_recipient SET status='cancelled',excluded_reason='campaign_paused' WHERE campaign_id=${id} AND status='queued'`.execute(
          ctx.tx,
        );
      } else {
        if (c.status !== "draft" || !c.local_tested || !input.testReceived)
          throw preconditionFailed(
            "review the local test before approving a draft",
          );
        const p = await preview(ctx.tx, c);
        if (
          p.value.audienceHash !== input.audienceHash ||
          p.value.recipients !== input.expectedCount
        )
          throw conflict("audience or approved content changed", {
            reason: "audience_changed",
          });
        if (!p.value.withinBudget)
          throw preconditionFailed("estimated budget cap prevents queueing");
        if (new Date(c.scheduled_at) <= clock(caller))
          throw preconditionFailed("the proposed campaign time has passed");
        for (const r of p.recipients)
          await sql`INSERT INTO comms.campaign_recipient(tenant_id,campaign_id,contact_point_id,address_hash,reserved_minor,status) VALUES(${ctx.tenantId},${id},${r.id},${hash(r.address)},${c.rate_minor},'queued') ON CONFLICT DO NOTHING`.execute(
            ctx.tx,
          );
        await sql`UPDATE comms.campaign SET status='scheduled',approval_hash=${p.value.audienceHash},approved_by=${ctx.actor.staffId ?? null},approved_count=${p.value.recipients},reserved_minor=${p.value.estimatedCostMinor} WHERE id=${id}`.execute(
          ctx.tx,
        );
      }
      ctx.audit({
        action: "status_change",
        subjectType: "comms.campaign",
        subjectId: id,
        diff: { action, simulationOnly: true },
      });
      ctx.emit({
        eventType: "campaign.local_status_changed",
        aggregateType: "comms.campaign",
        aggregateId: id,
        payload: { campaignId: id, action },
      });
      return campaignDto(await campaignRecord(ctx.tx, id));
    },
  );
}
export async function declareInterest(
  db: Kysely<DB>,
  caller: Caller,
  id: string,
  input: { interest: string; evidence: string; version: number },
  key: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.contact_interest",
      request: { id, ...input },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const {
        rows: [c],
      } = await sql<{
        address: string;
        version: number;
      }>`SELECT address,version FROM comms.contact_point WHERE id=${id}`.execute(
        ctx.tx,
      );
      if (!c) throw notFound("contact");
      await addressLock(ctx.tx, ctx.tenantId, c.address);
      if (
        (
          await sql<{
            version: number;
          }>`SELECT version FROM comms.contact_point WHERE id=${id} FOR UPDATE`.execute(
            ctx.tx,
          )
        ).rows[0]!.version !== input.version
      )
        throw conflict("contact changed", { reason: "stale_version" });
      if (
        !(
          await sql<{
            ok: boolean;
          }>`SELECT comms.has_consent(${id},'marketing') AS ok`.execute(ctx.tx)
        ).rows[0]!.ok
      )
        throw preconditionFailed(
          "declared interests require explicit marketing consent",
        );
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.contact_interest(tenant_id,contact_point_id,interest,evidence,created_by) VALUES(${ctx.tenantId},${id},${input.interest},${input.evidence},${ctx.actor.staffId ?? null}) ON CONFLICT DO NOTHING RETURNING id`.execute(
        ctx.tx,
      );
      if (r)
        await sql`UPDATE comms.contact_point SET status=status WHERE id=${id}`.execute(
          ctx.tx,
        );
      ctx.audit({
        action: "create",
        subjectType: "comms.contact_interest",
        subjectId: r?.id,
      });
      ctx.emit({
        eventType: "contact.interest_declared",
        aggregateType: "comms.contact_point",
        aggregateId: id,
        payload: { contactPointId: id },
      });
      return { recorded: true };
    },
  );
}

export async function cancelAddressWork(
  tx: Tx,
  tenantId: string,
  address: string,
  purpose: string,
) {
  await addressLock(tx, tenantId, address);
  await sql`UPDATE comms.reminder_job SET status='cancelled',reason='consent_withdrawn' WHERE status IN('scheduled','queued') AND (${purpose === "all"} OR purpose=${purpose}) AND contact_point_id IN(SELECT id FROM comms.contact_point WHERE address=${address})`.execute(
    tx,
  );
  await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE status='queued' AND contact_point_id IN(SELECT id FROM comms.contact_point WHERE address=${address}) AND (${purpose === "all" || purpose === "care"} OR reminder_job_id IN(SELECT id FROM comms.reminder_job WHERE status='cancelled'))`.execute(
    tx,
  );
  if (purpose === "all" || purpose === "marketing") {
    const { rows: campaigns } = await sql<{
      campaign_id: string;
    }>`SELECT DISTINCT campaign_id FROM comms.campaign_recipient WHERE status='queued' AND contact_point_id IN(SELECT id FROM comms.contact_point WHERE address=${address}) ORDER BY campaign_id`.execute(
      tx,
    );
    for (const c of campaigns) {
      await sql`SELECT id FROM comms.campaign WHERE id=${c.campaign_id} FOR UPDATE`.execute(
        tx,
      );
      const { rows: removed } = await sql<{
        reserved_minor: number;
      }>`UPDATE comms.campaign_recipient SET status='excluded',excluded_reason='consent_withdrawn' WHERE campaign_id=${c.campaign_id} AND status='queued' AND contact_point_id IN(SELECT id FROM comms.contact_point WHERE address=${address}) RETURNING reserved_minor`.execute(
        tx,
      );
      const amount = removed.reduce((sum, r) => sum + r.reserved_minor, 0);
      if (amount)
        await sql`UPDATE comms.campaign SET reserved_minor=reserved_minor-${amount} WHERE id=${c.campaign_id}`.execute(
          tx,
        );
    }
  }
}
export async function deliveryHistory(
  db: Kysely<DB>,
  caller: Caller,
  q: {
    facilityId: string;
    kind?: string;
    status?: string;
    from?: string;
    to?: string;
    limit: number;
    cursor?: string;
  },
) {
  let cursor: { at: string; id: string } | null = null;
  if (q.cursor) {
    try {
      const r = JSON.parse(Buffer.from(q.cursor, "base64url").toString());
      if (
        typeof r.at !== "string" ||
        !Number.isFinite(Date.parse(r.at)) ||
        typeof r.id !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          r.id,
        )
      )
        throw Error();
      cursor = r;
    } catch {
      throw invalid("invalid delivery cursor");
    }
  }
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } = await sql<any>`WITH history AS(
 SELECT coalesce(m.id,j.id) AS id,j.kind,coalesce(j.appointment_id,j.waitlist_offer_id) AS related_id,j.status,j.created_at,coalesce(j.reason,CASE WHEN j.status='queued' THEN 'log_transport_no_delivery' ELSE NULL END) AS reason FROM comms.reminder_job j LEFT JOIN comms.outbound_message m ON m.tenant_id=j.tenant_id AND m.reminder_job_id=j.id WHERE j.facility_id=${q.facilityId} UNION ALL SELECT m.id,'reply',m.conversation_id,m.status,m.created_at,CASE WHEN m.status='queued' THEN 'log_transport_no_delivery' ELSE 'cancelled' END FROM comms.outbound_message m WHERE m.facility_id=${q.facilityId} AND m.conversation_id IS NOT NULL
 UNION ALL SELECT r.id,'campaign',r.campaign_id,r.status,r.created_at,coalesce(r.excluded_reason,'log_transport_no_delivery') FROM comms.campaign_recipient r JOIN comms.campaign c ON c.tenant_id=r.tenant_id AND c.id=r.campaign_id WHERE c.facility_id=${q.facilityId})
 SELECT *,created_at::text AS cursor_at FROM history WHERE (${q.kind ?? null}::text IS NULL OR kind=${q.kind ?? null}) AND (${q.status ?? null}::text IS NULL OR status=${q.status ?? null}) AND (${q.from ?? null}::timestamptz IS NULL OR created_at>=${q.from ?? null}::timestamptz) AND (${q.to ?? null}::timestamptz IS NULL OR created_at<${q.to ?? null}::timestamptz) AND (${cursor?.at ?? null}::timestamptz IS NULL OR (created_at,id)<(${cursor?.at ?? null}::timestamptz,${cursor?.id ?? null}::uuid)) ORDER BY created_at DESC,id DESC LIMIT ${q.limit + 1}`.execute(
      tx,
    );
    const more = rows.length > q.limit,
      page = rows.slice(0, q.limit),
      last = page.at(-1);
    return {
      items: page.map((r) => ({
        id: r.id,
        kind: r.kind,
        relatedId: r.related_id,
        status: r.status,
        transport: "log",
        createdAt: time(r.created_at),
        reason: r.reason,
      })),
      nextCursor:
        more && last
          ? Buffer.from(
              JSON.stringify({ at: last.cursor_at, id: last.id }),
            ).toString("base64url")
          : null,
    };
  });
}
export async function validateWhatsAppAccountBinding(
  db: Kysely<DB>,
  binding: WhatsAppBinding,
) {
  const {
    rows: [account],
  } = await sql<{
    id: string;
    tenant_id: string;
    facility_id: string;
  }>`SELECT * FROM comms.account_for_phone(${binding.phoneNumberId})`.execute(
    db,
  );
  if (
    !account ||
    (binding.mode === "multi_clinic" &&
      (account.tenant_id !== binding.tenantId ||
        account.facility_id !== binding.facilityId))
  )
    throw forbidden("Unconfigured WhatsApp account binding");
  return account;
}
export async function storeWhatsAppCallback(
  db: Kysely<DB>,
  phoneNumberId: string,
  payload: Record<string, unknown>,
  reviewedBinding?: WhatsAppBinding,
) {
  const binding = reviewedBinding ?? resolveWhatsAppBinding(phoneNumberId);
  if (!binding?.signatureConfigured || binding.phoneNumberId !== phoneNumberId)
    throw forbidden("Unconfigured WhatsApp provider binding");
  const account = await validateWhatsAppAccountBinding(db, binding);
  return runCommand(
    db,
    {
      tenantId: account.tenant_id,
      actor: { kind: "system" },
      module: "comms",
      name: "comms.provider_ingest",
    },
    async (ctx) => {
      // Same clinic lock as account updates; recheck after waiting, never route using a stale lookup.
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:account:${account.facility_id}`},0))`.execute(
        ctx.tx,
      );
      const {
        rows: [current],
      } = await sql<{ id: string }>`SELECT id FROM comms.channel_account
        WHERE id=${account.id} AND facility_id=${account.facility_id} AND phone_number_id=${phoneNumberId} FOR UPDATE`.execute(
        ctx.tx,
      );
      if (!current) throw forbidden("WhatsApp account binding changed");
      const eventKey = hash(JSON.stringify(payload));
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.provider_event(tenant_id,account_id,event_key,payload,facility_id,phone_number_id,business_account_id)
        VALUES(${account.tenant_id},${account.id},${eventKey},${JSON.stringify(payload)}::jsonb,${account.facility_id},${phoneNumberId},${binding.businessAccountId}) ON CONFLICT DO NOTHING RETURNING id`.execute(
        ctx.tx,
      );
      if (r) {
        await handleWhatsAppCallback(
          ctx.tx,
          {
            id: r.id,
            occurredAt: clock({
              tenantId: account.tenant_id,
              actor: { kind: "system" },
            }),
            tenantId: account.tenant_id,
            eventType: "whatsapp.callback_received",
            aggregateType: "comms.provider_event",
            aggregateId: r.id,
            aggregateVersion: null,
            payload: { providerEventId: r.id },
            correlationId: ctx.correlationId,
            attempts: 1,
          },
          { controlOnly: true },
        );
        ctx.audit({
          action: "create",
          subjectType: "comms.provider_event",
          subjectId: r.id,
        });
        ctx.emit({
          eventType: "whatsapp.callback_received",
          aggregateType: "comms.provider_event",
          aggregateId: r.id,
          payload: { providerEventId: r.id },
        });
      }
      return { accepted: true };
    },
  );
}
/** Only explicit whole-message commands are recognized; this is not a natural-language classifier. */
export function requestsWhatsAppHuman(text: string): boolean {
  return ["human", "agent", "receptionist", "speak to a human"].includes(
    text.trim().toLowerCase().replace(/\s+/g, " "),
  );
}
export async function handleWhatsAppCallback(
  tx: Tx,
  event: OutboxEvent,
  options: { controlOnly?: boolean } = {},
) {
  const id = event.payload["providerEventId"];
  if (typeof id !== "string")
    throw invalid("callback event identifier required");
  const {
    rows: [r],
  } = await sql<{
    payload: any;
    account_id: string;
    facility_id: string;
    phone_number_id: string | null;
    current_phone_number_id: string;
    current_facility_id: string;
  }>`SELECT e.payload,e.account_id,coalesce(e.facility_id,a.facility_id) AS facility_id,e.phone_number_id,
       a.phone_number_id AS current_phone_number_id,a.facility_id AS current_facility_id
     FROM comms.provider_event e JOIN comms.channel_account a ON a.tenant_id=e.tenant_id AND a.id=e.account_id WHERE e.id=${id}`.execute(
    tx,
  );
  if (!r) return;
  if (
    r.phone_number_id &&
    (r.phone_number_id !== r.current_phone_number_id ||
      r.facility_id !== r.current_facility_id ||
      r.payload?.metadata?.phone_number_id !== r.phone_number_id)
  )
    throw forbidden("Accepted WhatsApp callback binding no longer matches");
  const value = r.payload;
  for (const receipt of value.statuses ?? []) {
    if (typeof receipt.id !== "string" || typeof receipt.status !== "string")
      continue;
    const key = hash(
      JSON.stringify([
        r.account_id,
        receipt.id,
        receipt.status,
        receipt.timestamp ?? null,
      ]),
    );
    await sql`INSERT INTO comms.delivery_receipt(tenant_id,account_id,provider_event_id,provider_message_id,provider_status) VALUES(${event.tenantId},${r.account_id},${key},${receipt.id},${receipt.status}) ON CONFLICT DO NOTHING`.execute(
      tx,
    );
    // Only known IDs from this exact account can advance delivery. Late receipts cannot regress read/delivered.
    if (["sent", "delivered", "read", "failed"].includes(receipt.status)) {
      await sql`UPDATE comms.outbound_message m SET status=${receipt.status} FROM comms.managed_delivery d,comms.channel_account a
        WHERE d.outbound_id=m.id AND d.tenant_id=m.tenant_id AND d.provider_message_id=${receipt.id}
        AND a.id=${r.account_id} AND a.tenant_id=m.tenant_id AND a.facility_id=m.facility_id AND m.transport='meta'
        AND ((m.status IN ('claimed','unknown','sent') AND ${receipt.status} IN ('delivered','read','failed')) OR (m.status='delivered' AND ${receipt.status}='read'))`.execute(
        tx,
      );
    }
  }
  for (const inbound of value.messages ?? []) {
    if (
      typeof inbound.id !== "string" ||
      typeof inbound.from !== "string" ||
      !/^[1-9][0-9]{7,14}$/.test(inbound.from)
    )
      continue;
    const address = "+" + inbound.from,
      body =
        typeof inbound.text?.body === "string"
          ? inbound.text.body.slice(0, 3000)
          : "[Unsupported message content]";
    const stop = body.trim().toUpperCase() === "STOP";
    const {rows:[workspace]}=await sql<any>`SELECT preferences FROM comms.whatsapp_workspace WHERE facility_id=${r.facility_id}`.execute(tx);
    const handoffWords=String(workspace?.preferences?.handoffWords??'').split(',').map(w=>w.trim().toLowerCase()).filter(Boolean);
    const humanRequested = requestsWhatsAppHuman(body) || handoffWords.includes(body.trim().toLowerCase());
    // Control requests pause automation synchronously inside the signed callback transaction.
    if (options.controlOnly && !stop && !humanRequested) continue;
    if (!stop && !humanRequested && (await moduleState(tx)) !== "active")
      continue;
    await addressLock(tx, event.tenantId, address);
    const duplicate = (
      await sql<{
        id: string;
      }>`SELECT id FROM comms.inbound_message WHERE account_id=${r.account_id} AND provider_message_id=${inbound.id}`.execute(
        tx,
      )
    ).rows[0];
    if (duplicate) continue;
    // Select only unregistered caller contacts. A shared number never chooses or links a clinical patient.
    let contact = (
      await sql<{
        id: string;
      }>`SELECT id FROM comms.contact_point WHERE facility_id=${r.facility_id} AND address=${address} AND booking_party_id IS NOT NULL AND status='active' ORDER BY created_at,id LIMIT 1`.execute(
        tx,
      )
    ).rows[0];
    if (!contact) {
      const {
        rows: [party],
      } = await sql<{
        id: string;
      }>`SELECT booking.create_comms_caller(${address}) AS id`.execute(tx);
      contact = (
        await sql<{
          id: string;
        }>`INSERT INTO comms.contact_point(tenant_id,facility_id,booking_party_id,channel,address) VALUES(${event.tenantId},${r.facility_id},${party!.id},'whatsapp',${address}) RETURNING id`.execute(
          tx,
        )
      ).rows[0]!;
    }
    const seconds = Number(inbound.timestamp),
      received =
        Number.isFinite(seconds) && seconds > 0
          ? new Date(Math.min(seconds * 1000, Date.now()))
          : new Date();
    const {
      rows: [c],
    } = await sql<{
      id: string;
    }>`INSERT INTO comms.conversation(tenant_id,facility_id,contact_point_id,last_inbound_at,automation_state) VALUES(${event.tenantId},${r.facility_id},${contact.id},${received},${humanRequested ? "handoff_requested" : "automation"}) ON CONFLICT(tenant_id,contact_point_id) DO UPDATE SET automation_state=CASE WHEN ${humanRequested} AND comms.conversation.automation_state='automation' THEN 'handoff_requested' ELSE comms.conversation.automation_state END,last_inbound_at=greatest(comms.conversation.last_inbound_at,EXCLUDED.last_inbound_at) RETURNING id`.execute(
      tx,
    );
    await sql`INSERT INTO comms.inbound_message(tenant_id,conversation_id,account_id,provider_message_id,text_content,received_at,phone_number_id) VALUES(${event.tenantId},${c!.id},${r.account_id},${inbound.id},${body},${received},${r.phone_number_id}) ON CONFLICT DO NOTHING`.execute(
      tx,
    );
    if (stop) {
      await sql`INSERT INTO comms.messaging_consent_event(tenant_id,contact_point_id,purpose,action,source,evidence,explicit_opt_in,recorded_by) VALUES(${event.tenantId},${contact.id},'care','stop','provider','Signed provider STOP message',false,NULL)`.execute(
        tx,
      );
      await cancelAddressWork(tx, event.tenantId, address, "all");
    }
    await writeAudit(
      tx,
      event.tenantId,
      { kind: "system" },
      event.correlationId,
      [
        {
          action: "create",
          subjectType: "comms.inbound_message",
          subjectId: c!.id,
          diff: { providerReceived: true, stop, humanRequested },
        },
      ],
    );
    await writeOutbox(tx, event.tenantId, event.correlationId, [
      {
        eventType: "conversation.message_received",
        aggregateType: "comms.conversation",
        aggregateId: c!.id,
        payload: { conversationId: c!.id, stop, humanRequested },
      },
    ]);
  }
}

import { createHash } from "node:crypto";
import { z } from "zod";
import { sql, type DB, type Kysely, type Transaction } from "@hms/db";
import {
  conflict,
  invalid,
  notFound,
  preconditionFailed,
  runQuery,
  runCommand,
  stableStringify,
} from "@hms/platform";
import type { Caller } from "../../caller.ts";
import { connection } from "./managed-google.ts";
import { managedMeta } from "./managed-automations.ts";
import { providerJson, type ManagedSettings } from "./managed-config.ts";
import { addressLock } from "./notifications.ts";
import { assertWhatsAppActive } from "./whatsapp.ts";
const digest = (v: unknown) =>
  createHash("sha256").update(stableStringify(v)).digest("hex");
type Tx = Transaction<DB>;
type Template = {
  phoneNumberId?: string;
  name: string;
  language: string;
  body: string;
};
export const PromotionInput = z.strictObject({
  facilityId: z.uuid(),
  title: z.string().trim().min(1).max(100),
  name: z.string().regex(/^[a-z0-9_]{1,512}$/),
  language: z.string().regex(/^[a-z]{2,3}(?:_[A-Za-z]{2,4})?$/),
  dueAt: z.iso.datetime({ offset: true }),
  budgetMinor: z.number().int().positive().max(100000000),
});
export async function marketingTemplates(
  settings: ManagedSettings,
  conn: any,
  name?: string,
): Promise<Template[]> {
  const config = managedMeta(settings, conn),
    result = await providerJson(
      settings,
      `${config.root}?limit=100${name ? "&name=" + encodeURIComponent(name) : ""}`,
      { headers: config.headers },
    );
  if (!Array.isArray(result.data))
    throw preconditionFailed("Approved messages could not be loaded.");
  return result.data
    .filter(
      (t: any) =>
        t.status === "APPROVED" &&
        t.category === "MARKETING" &&
        /^[a-z0-9_]{1,512}$/.test(t.name) &&
        /^[a-z]{2,3}(?:_[A-Za-z]{2,4})?$/.test(t.language) &&
        t.components?.length === 1 &&
        t.components[0]?.type === "BODY" &&
        typeof t.components[0]?.text === "string" &&
        t.components[0].text.length <= 1024 &&
        !/[{}]/.test(t.components[0].text),
    )
    .map((t: any) => ({
      name: t.name,
      language: t.language,
      body: t.components[0].text,
    }));
}
async function audience(tx: Tx, facility: string) {
  const { rows } = await sql<{
    id: string;
    address: string;
  }>`SELECT DISTINCT ON(address) id,address FROM comms.contact_point p WHERE facility_id=${facility} AND status='active' AND comms.has_consent(p.id,'marketing') ORDER BY address,created_at,id LIMIT 501`.execute(
    tx,
  );
  if (rows.length > 500)
    throw preconditionFailed(
      "This promotion can include up to 500 opted-in contacts.",
    );
  return rows;
}
const snapshot = (
  people: { id: string; address: string }[],
  template: Template,
) =>
  digest({
    people: people.map((p) => ({ id: p.id, address: digest(p.address) })),
    template,
  });
export async function promotionsDashboard(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
  settings: ManagedSettings,
) {
  const conn = await connection(db, caller, facility, "whatsapp");
  let templates: Template[] = [];
  let available = true;
  try {
    templates = await marketingTemplates(settings, conn);
  } catch {
    available = false;
  }
  const items = await runQuery(db, caller.tenantId, async (tx) =>
    (
      await sql<any>`SELECT b.id,b.title,b.status,b.recipient_count,b.estimate_minor,b.due_at,b.version,
    count(m.id) FILTER(WHERE m.status='queued')::int AS queued,count(m.id) FILTER(WHERE m.status IN('sent','delivered','read'))::int AS accepted,
    count(m.id) FILTER(WHERE m.status='delivered' OR m.status='read')::int AS delivered,count(m.id) FILTER(WHERE m.status='unknown' OR m.status='claimed')::int AS uncertain
    FROM comms.managed_broadcast b LEFT JOIN comms.outbound_message m ON m.managed_broadcast_id=b.id AND m.tenant_id=b.tenant_id
    WHERE b.facility_id=${facility} GROUP BY b.id ORDER BY b.created_at DESC LIMIT 100`.execute(
        tx,
      )
    ).rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      recipients: r.recipient_count,
      estimateMinor: r.estimate_minor,
      dueAt: new Date(r.due_at).toISOString(),
      version: r.version,
      queued: r.queued,
      accepted: r.accepted,
      delivered: r.delivered,
      uncertain: r.uncertain,
    })),
  );
  return { available, templates, items };
}
export async function previewPromotion(
  db: Kysely<DB>,
  caller: Caller,
  input: z.infer<typeof PromotionInput>,
  key: string,
  settings: ManagedSettings,
) {
  if (!settings.whatsappSending)
    throw preconditionFailed("WhatsApp sending is being prepared.");
  const due = new Date(input.dueAt);
  if (due <= new Date() || due.getTime() > Date.now() + 90 * 86400000)
    throw invalid("Choose a time within the next 90 days.");
  const conn = await connection(db, caller, input.facilityId, "whatsapp"),
    matches = (await marketingTemplates(settings, conn, input.name)).filter(
      (t) => t.name === input.name && t.language === input.language,
    );
  if (matches.length !== 1)
    throw preconditionFailed("Choose an approved message.");
  const template = { ...matches[0]!, phoneNumberId: conn!.external_id };
  const rate = Number(process.env.WA_ESTIMATED_RATE_MINOR ?? 100);
  if (!Number.isSafeInteger(rate) || rate < 0 || rate > 100000)
    throw preconditionFailed("Promotion estimates are being prepared.");
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.managed_promotion_preview",
      request: input,
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const people = await audience(ctx.tx, input.facilityId),
        cost = people.length * rate;
      if (!people.length)
        throw preconditionFailed("No contacts have opted into promotions.");
      if (cost > input.budgetMinor)
        throw preconditionFailed("The estimated cost exceeds your budget.");
      const {
        rows: [r],
      } = await sql<{
        id: string;
        version: number;
      }>`INSERT INTO comms.managed_broadcast(tenant_id,facility_id,connection_id,title,template,audience_hash,recipient_count,budget_minor,estimate_minor,due_at,created_by)
      VALUES(${caller.tenantId},${input.facilityId},${conn!.id},${input.title},${JSON.stringify(template)}::jsonb,${snapshot(people, template)},${people.length},${input.budgetMinor},${cost},${due},${caller.actor.staffId!}) RETURNING id,version`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "create",
        subjectType: "comms.managed_broadcast",
        subjectId: r!.id,
        diff: { status: "draft", recipients: people.length },
      });
      return {
        ...r!,
        body: template.body,
        recipients: people.length,
        estimateMinor: cost,
        dueAt: input.dueAt,
      };
    },
  );
}
export async function promotionAction(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
  id: string,
  version: number,
  action: "approve" | "pause",
  key: string,
  settings: ManagedSettings,
) {
  const conn = await connection(db, caller, facility, "whatsapp");
  managedMeta(settings, conn);
  const initial = await runQuery(
    db,
    caller.tenantId,
    async (tx) =>
      (
        await sql<any>`SELECT * FROM comms.managed_broadcast WHERE id=${id} AND facility_id=${facility}`.execute(
          tx,
        )
      ).rows[0],
  );
  if (!initial) throw notFound("promotion");
  const template = initial.template as Template;
  if (action === "approve") {
    const approved = (
      await marketingTemplates(settings, conn, template.name)
    ).find(
      (t) =>
        t.name === template.name &&
        t.language === template.language &&
        t.body === template.body,
    );
    if (!approved)
      throw preconditionFailed("This message is no longer approved.");
  }
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.managed_promotion_" + action,
      request: { facility, id, version },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      // Address locks always precede campaign/message locks, matching STOP.
      const people =
        action === "approve" ? await audience(ctx.tx, facility) : [];
      for (const p of people)
        await addressLock(ctx.tx, caller.tenantId, p.address);
      const {
        rows: [r],
      } =
        await sql<any>`SELECT * FROM comms.managed_broadcast WHERE id=${id} AND facility_id=${facility} FOR UPDATE`.execute(
          ctx.tx,
        );
      if (r.version !== version)
        throw conflict("This promotion changed. Refresh before continuing.");
      if (action === "pause") {
        if (r.status !== "scheduled")
          throw conflict("Only scheduled promotions can be paused.");
        await sql`UPDATE comms.managed_broadcast SET status='paused' WHERE id=${id}`.execute(
          ctx.tx,
        );
        await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE managed_broadcast_id=${id} AND status='queued'`.execute(
          ctx.tx,
        );
      } else {
        const current = await audience(ctx.tx, facility);
        if (
          r.status !== "draft" ||
          r.connection_id !== conn!.id ||
          template.phoneNumberId !== conn!.external_id ||
          new Date(r.due_at) <= new Date()
        )
          throw conflict("Review a fresh promotion before sending.");
        if (
          snapshot(current, template) !== r.audience_hash ||
          current.length !== r.recipient_count ||
          r.estimate_minor > r.budget_minor
        )
          throw conflict("The audience changed. Preview the promotion again.");
        for (const p of current)
          await sql`INSERT INTO comms.outbound_message(tenant_id,facility_id,managed_broadcast_id,contact_point_id,text_content,created_by,managed_send_requested,managed_purpose,managed_details)
        VALUES(${caller.tenantId},${facility},${id},${p.id},${template.body},${caller.actor.staffId!},true,'broadcast',${JSON.stringify({ addressHash: digest(p.address), phoneNumberId: template.phoneNumberId })}::jsonb) ON CONFLICT DO NOTHING`.execute(
            ctx.tx,
          );
        await sql`UPDATE comms.managed_broadcast SET status='scheduled',approved_by=${caller.actor.staffId!} WHERE id=${id}`.execute(
          ctx.tx,
        );
      }
      ctx.audit({
        action: "update",
        subjectType: "comms.managed_broadcast",
        subjectId: id,
        diff: { action },
      });
      return { accepted: true };
    },
  );
}
export async function broadcastPayload(
  tx: Tx,
  claim: any,
  settings: ManagedSettings,
) {
  const {
    rows: [b],
  } =
    await sql<any>`SELECT b.*,p.address FROM comms.managed_broadcast b JOIN comms.contact_point p ON p.id=${claim.contact_point_id} AND p.tenant_id=b.tenant_id AND p.facility_id=b.facility_id AND p.status='active'
    JOIN platform.facility f ON f.id=b.facility_id AND f.tenant_id=b.tenant_id AND f.status='active'
    JOIN platform.staff s ON s.id=b.approved_by AND s.tenant_id=b.tenant_id AND s.status='active'
    WHERE b.id=${claim.managed_broadcast_id} AND b.status='scheduled' AND b.connection_id=${claim.connection_id} AND b.due_at<=now() AND b.due_at>now()-interval '1 day'
    AND comms.has_consent(p.id,'marketing') AND EXISTS(SELECT 1 FROM platform.staff_permission sp WHERE sp.staff_id=s.id AND sp.permission='campaigns.approve' AND (sp.facility_id IS NULL OR sp.facility_id=b.facility_id))
    AND EXISTS(SELECT 1 FROM platform.user_account u WHERE u.staff_id=s.id AND u.status='active') FOR SHARE OF b`.execute(
      tx,
    );
  if (!b || digest(b.address) !== claim.managed_details.addressHash)
    throw preconditionFailed("This recipient is no longer eligible.");
  const t = b.template as Template;
  if (
    !(await marketingTemplates(settings, claim, t.name)).some(
      (current) =>
        current.name === t.name &&
        current.language === t.language &&
        current.body === t.body,
    )
  )
    throw preconditionFailed("This message is no longer approved.");
  return {
    type: "template",
    template: { name: t.name, language: { code: t.language } },
  };
}

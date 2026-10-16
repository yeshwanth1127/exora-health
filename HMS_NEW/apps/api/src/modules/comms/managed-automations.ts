import { createHash } from "node:crypto";
import { z } from "zod";
import { sql, type DB, type Kysely, type Transaction } from "@hms/db";
import {
  conflict,
  notFound,
  preconditionFailed,
  runCommand,
  runQuery,
} from "@hms/platform";
import type { Caller } from "../../caller.ts";
import { connection } from "./managed-google.ts";
import {
  providerJson,
  unseal,
  type ManagedSettings,
} from "./managed-config.ts";
import { assertWhatsAppActive } from "./whatsapp.ts";

export const AutomationKind = z.enum([
  "confirmation",
  "day_before",
  "same_day",
  "reschedule",
  "cancellation",
]);
type Kind = z.infer<typeof AutomationKind>;
export const notices: Record<Kind, { title: string; body: string }> = {
  confirmation: {
    title: "Booking confirmation",
    body: "Your appointment at {{1}} is confirmed for {{2}}. Reference: {{3}}. Contact reception to make changes.",
  },
  day_before: {
    title: "Reminder · 24 hours before",
    body: "A reminder: your appointment at {{1}} is scheduled for {{2}}. Reference: {{3}}. Contact reception to make changes.",
  },
  same_day: {
    title: "Reminder · 2 hours before",
    body: "Your appointment at {{1}} is coming up at {{2}}. Reference: {{3}}. Contact reception if you need help.",
  },
  reschedule: {
    title: "Appointment moved",
    body: "Your appointment at {{1}} has moved to {{2}}. Reference: {{3}}. Contact reception if this time does not suit you.",
  },
  cancellation: {
    title: "Appointment cancelled",
    body: "Your appointment at {{1}} for {{2}} has been cancelled. Reference: {{3}}. Contact reception to book another time.",
  },
};
export const templateName = (kind: Kind) => `hms_${kind}_v1`;
export function managedMeta(settings: ManagedSettings, row: any) {
  if (!settings.meta || !row?.enabled || !row.metadata.subscribed)
    throw preconditionFailed("Connect WhatsApp first.");
  const { token } = unseal<{ token: string }>(
    settings,
    row.credential,
    `${row.tenant_id}:${row.facility_id}:whatsapp`,
  );
  return {
    root: `https://graph.facebook.com/${settings.meta.graphVersion}/${row.metadata.businessAccountId}/message_templates`,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  };
}
export async function noticeStatus(
  settings: ManagedSettings,
  conn: any,
  kind: Kind,
) {
  const config = managedMeta(settings, conn),
    name = templateName(kind);
  const result = await providerJson(
    settings,
    `${config.root}?name=${name}&limit=100`,
    { headers: config.headers },
  );
  const matches = Array.isArray(result.data)
    ? result.data.filter((t: any) => t.name === name && t.language === "en")
    : [];
  if (matches.length !== 1)
    return matches.length ? "rejected" : "not_submitted";
  const t = matches[0];
  if (
    t.category !== "UTILITY" ||
    (t.parameter_format && t.parameter_format !== "POSITIONAL") ||
    !Array.isArray(t.components) ||
    t.components.length !== 1 ||
    t.components[0]?.type !== "BODY" ||
    t.components[0]?.text !== notices[kind].body
  )
    return "rejected";
  return t.status === "APPROVED"
    ? "approved"
    : t.status === "REJECTED"
      ? "rejected"
      : "pending";
}
export async function automationDashboard(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
) {
  const rows = await runQuery(db, caller.tenantId, async (tx) => {
    if (
      !(await tx
        .selectFrom("platform.facility")
        .select("id")
        .where("id", "=", facility)
        .executeTakeFirst())
    )
      throw notFound("clinic");
    return (
      await sql<any>`SELECT * FROM comms.managed_automation WHERE facility_id=${facility}`.execute(
        tx,
      )
    ).rows;
  });
  return {
    items: AutomationKind.options.map((kind) => {
      const r = rows.find((r) => r.kind === kind);
      return {
        kind,
        title: notices[kind].title,
        body: notices[kind].body
          .replace("{{1}}", "your clinic")
          .replace("{{2}}", "the appointment time")
          .replace("{{3}}", "the booking reference"),
        enabled: r?.enabled ?? false,
        status: r?.provider_status ?? "not_submitted",
        version: r?.version ?? 0,
      };
    }),
  };
}
export async function setAutomation(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
  input: { kind: Kind; enabled: boolean; version: number },
  key: string,
  settings: ManagedSettings,
) {
  const conn = await connection(db, caller, facility, "whatsapp");
  managedMeta(settings, conn);
  const row = await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.managed_automation",
      request: { facility, ...input },
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${caller.tenantId + ":automation:" + facility + ":" + input.kind},0))`.execute(
        ctx.tx,
      );
      const {
        rows: [before],
      } =
        await sql<any>`SELECT * FROM comms.managed_automation WHERE facility_id=${facility} AND kind=${input.kind}`.execute(
          ctx.tx,
        );
      if ((before?.version ?? 0) !== input.version)
        throw conflict("This message setting changed. Refresh before saving.");
      const {
        rows: [saved],
      } =
        await sql<any>`INSERT INTO comms.managed_automation(tenant_id,facility_id,kind,enabled,connection_id,created_by)
      VALUES(${caller.tenantId},${facility},${input.kind},${input.enabled},${conn!.id},${caller.actor.staffId!})
      ON CONFLICT(tenant_id,facility_id,kind) DO UPDATE SET enabled_at=CASE WHEN EXCLUDED.enabled AND (NOT comms.managed_automation.enabled OR comms.managed_automation.connection_id<>EXCLUDED.connection_id) THEN now() ELSE comms.managed_automation.enabled_at END,enabled=EXCLUDED.enabled,connection_id=EXCLUDED.connection_id,created_by=EXCLUDED.created_by RETURNING id`.execute(
          ctx.tx,
        );
      if (input.kind !== "confirmation") {
        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${caller.tenantId + ":rule:" + facility + ":" + input.kind},0))`.execute(
          ctx.tx,
        );
        await sql`INSERT INTO comms.followup_rule(tenant_id,facility_id,kind,enabled,delay_hours,created_by) VALUES(${caller.tenantId},${facility},${input.kind},${input.enabled},${input.kind === "day_before" ? 24 : input.kind === "same_day" ? 2 : 0},${caller.actor.staffId!})
        ON CONFLICT(tenant_id,facility_id,kind) DO UPDATE SET enabled=EXCLUDED.enabled,delay_hours=EXCLUDED.delay_hours`.execute(
          ctx.tx,
        );
      }
      await sql`UPDATE comms.outbound_message SET status='cancelled' WHERE facility_id=${facility} AND managed_purpose='reminder' AND managed_details->>'automationId'=${saved.id} AND status='queued'`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "update",
        subjectType: "comms.managed_automation",
        subjectId: saved.id,
        diff: { kind: input.kind, enabled: input.enabled },
      });
      return saved;
    },
  );
  if (input.enabled)
    await refreshAutomation(
      db,
      caller,
      facility,
      input.kind,
      settings,
      true,
      row.id,
    );
  return automationDashboard(db, caller, facility);
}
export async function refreshAutomation(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
  kind: Kind,
  settings: ManagedSettings,
  create = false,
  id?: string,
) {
  const conn = await connection(db, caller, facility, "whatsapp"),
    config = managedMeta(settings, conn);
  let status = await noticeStatus(settings, conn, kind);
  if (create && status === "not_submitted") {
    const canPost = await runCommand(
      db,
      { ...caller, module: "comms", name: "comms.managed_template_claim" },
      async (ctx) => {
        const { rows } =
          await sql`INSERT INTO comms.integration_attempt(tenant_id,facility_id,provider,actor_staff_id,actor_user_id,state_hash,verifier,status,expires_at)
            VALUES(${caller.tenantId},${facility},'whatsapp',${caller.actor.staffId!},${caller.actor.userId!},${createHash("sha256").update(`notice:${caller.tenantId}:${conn!.metadata.businessAccountId}:${kind}:en`).digest("hex")},'','used',now()+interval '10 minutes') ON CONFLICT DO NOTHING RETURNING id`.execute(
            ctx.tx,
          );
        if (rows.length)
          await sql`UPDATE comms.managed_automation SET attempted_at=now(),provider_status='unknown' WHERE id=${id!} AND enabled`.execute(
            ctx.tx,
          );
        return rows.length === 1;
      },
    );
    if (canPost) {
      try {
        await providerJson(settings, config.root, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify({
            name: templateName(kind),
            language: "en",
            category: "UTILITY",
            parameter_format: "POSITIONAL",
            components: [
              {
                type: "BODY",
                text: notices[kind].body,
                example: {
                  body_text: [
                    [
                      "Example Clinic",
                      "18 October 2026 at 10:00 AM",
                      "ABCD1234",
                    ],
                  ],
                },
              },
            ],
          }),
        });
        status = "pending";
      } catch {
        status = "unknown";
      }
    } else status = "unknown";
  }
  await runCommand(
    db,
    { ...caller, module: "comms", name: "comms.managed_template_status" },
    async (ctx) => {
      await sql`UPDATE comms.managed_automation SET provider_status=${status} WHERE facility_id=${facility} AND kind=${kind} AND connection_id=${conn!.id} AND provider_status IS DISTINCT FROM ${status}`.execute(
        ctx.tx,
      );
    },
  );
  return automationDashboard(db, caller, facility);
}
export async function reminderPayload(
  tx: Transaction<DB>,
  claim: any,
  settings: ManagedSettings,
) {
  await sql`SET LOCAL ROLE mod_booking`.execute(tx);
  await sql`SELECT a.id FROM booking.appointment a JOIN comms.reminder_job j ON j.appointment_id=a.id AND j.tenant_id=a.tenant_id WHERE j.id=${claim.reminder_job_id} FOR SHARE OF a`.execute(
    tx,
  );
  await sql`SET LOCAL ROLE mod_comms`.execute(tx);
  const {
    rows: [j],
  } =
    await sql<any>`SELECT j.*,a.starts_at,a.confirmation_code,a.status AS appointment_status,f.name AS clinic_name,f.timezone,r.enabled AS automation_enabled,r.version AS automation_version,r.kind AS automation_kind
    FROM comms.reminder_job j JOIN booking.appointment a ON a.id=j.appointment_id AND a.tenant_id=j.tenant_id
    JOIN platform.facility f ON f.id=j.facility_id AND f.tenant_id=j.tenant_id AND f.status='active'
    JOIN comms.managed_automation r ON r.id=${claim.managed_details.automationId}::uuid AND r.tenant_id=j.tenant_id AND r.facility_id=j.facility_id AND r.connection_id=${claim.connection_id}
    JOIN platform.staff s ON s.id=r.created_by AND s.tenant_id=r.tenant_id AND s.status='active'
    WHERE j.id=${claim.reminder_job_id} AND j.status IN('scheduled','queued') AND j.due_at<=now() AND j.expires_at>now()
    AND EXISTS(SELECT 1 FROM platform.staff_permission sp WHERE sp.staff_id=s.id AND sp.permission='comms.manage' AND (sp.facility_id IS NULL OR sp.facility_id=j.facility_id))
    AND EXISTS(SELECT 1 FROM platform.user_account u WHERE u.staff_id=s.id AND u.status='active')
    AND NOT EXISTS(SELECT 1 FROM booking.appointment successor WHERE successor.rescheduled_from_id=a.id)
    AND EXISTS(SELECT 1 FROM comms.contact_point p WHERE p.id=j.contact_point_id AND p.facility_id=j.facility_id AND p.status='active' AND comms.has_consent(p.id,j.purpose)
      AND ((a.patient_id IS NOT NULL AND p.patient_id=a.patient_id) OR (a.patient_id IS NULL AND p.booking_party_id=a.booking_party_id))) FOR SHARE OF r,j`.execute(
      tx,
    );
  if (
    !j ||
    !j.starts_at ||
    !j.automation_enabled ||
    j.automation_version !== claim.managed_details.automationVersion ||
    j.automation_kind !== j.kind ||
    j.appointment_status !==
      (j.kind === "cancellation" ? "cancelled" : "confirmed")
  )
    throw preconditionFailed("This appointment message is no longer eligible.");
  if (j.kind !== "confirmation") {
    const {
      rows: [rule],
    } =
      await sql<any>`SELECT enabled,version FROM comms.followup_rule WHERE facility_id=${j.facility_id} AND kind=${j.kind}`.execute(
        tx,
      );
    if (
      (rule && (!rule.enabled || rule.version !== j.rule_version)) ||
      (!rule && j.rule_version !== null)
    )
      throw preconditionFailed("This message rule changed.");
  }
  const current = await noticeStatus(settings, claim, j.kind);
  if (current !== "approved")
    throw preconditionFailed("This message is waiting for approval.");
  const when = new Intl.DateTimeFormat("en-IN", {
    timeZone: j.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(j.starts_at));
  const values = [j.clinic_name, when, j.confirmation_code];
  await sql`UPDATE comms.outbound_message SET text_content=${notices[j.kind as Kind].body.replace(/\{\{([123])\}\}/g, (_m, n) => values[Number(n) - 1])} WHERE id=${claim.id}`.execute(
    tx,
  );
  return {
    type: "template",
    template: {
      name: templateName(j.kind),
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [j.clinic_name, when, j.confirmation_code].map(
            (text) => ({ type: "text", text }),
          ),
        },
      ],
    },
  };
}

export async function pollAutomationApprovals(
  db: Kysely<DB>,
  settings: ManagedSettings,
) {
  if (!settings.meta) return 0;
  const { rows } = await sql<{
    tenant_id: string;
    facility_id: string;
    kind: Kind;
  }>`SELECT * FROM comms.managed_automation_candidates()`.execute(db);
  for (const r of rows)
    try {
      await refreshAutomation(
        db,
        { tenantId: r.tenant_id, actor: { kind: "system" } },
        r.facility_id,
        r.kind,
        settings,
      );
    } catch {}
  return rows.length;
}
export async function quietNow(tx: Transaction<DB>, facility: string) {
  const {
    rows: [r],
  } =
    await sql<any>`SELECT f.timezone,w.preferences FROM platform.facility f LEFT JOIN comms.whatsapp_workspace w ON w.facility_id=f.id AND w.tenant_id=f.tenant_id WHERE f.id=${facility}`.execute(
      tx,
    );
  const quiet = r?.preferences?.quiet ?? {
    on: true,
    from: "21:00",
    to: "08:00",
  };
  if (!quiet.on || quiet.from === quiet.to) return false;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: r.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return quiet.from < quiet.to
    ? time >= quiet.from && time < quiet.to
    : time >= quiet.from || time < quiet.to;
}

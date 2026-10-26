import { lockAccess } from "../access/staff.ts";
import { z } from "zod";
import { sql, type DB, type Kysely } from "@hms/db";
import { runQuery, runCommand, conflict, forbidden } from "@hms/platform";
import type { Caller } from "../../caller.ts";
import type { PublicBookingSite } from "./public-config.ts";
export const Enquiry = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  topic: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(2000),
  context: z.string().trim().max(200).optional(),
});
export async function saveEnquiry(
  db: Kysely<DB>,
  site: PublicBookingSite,
  body: z.infer<typeof Enquiry>,
  key: string,
) {
  return db.transaction().execute(async (tx) => {
    await sql`SELECT set_config('app.tenant_id',${site.tenantId},true)`.execute(
      tx,
    );
    await sql`SET LOCAL ROLE mod_booking`.execute(tx);
    const {
      rows: [r],
    } = await sql<{
      id: string;
    }>`INSERT INTO booking.website_enquiry(tenant_id,facility_id,request_key,name,email,topic,message,context) VALUES(${site.tenantId},${site.facilityId},${key},${body.name},${body.email},${body.topic},${body.message},${body.context ?? null}) ON CONFLICT(tenant_id,facility_id,request_key) DO NOTHING RETURNING id`.execute(
      tx,
    );
    if (r) return { id: r.id, status: "received" as const };
    const {
      rows: [previous],
    } =
      await sql<any>`SELECT id,name,email,topic,message,context FROM booking.website_enquiry WHERE facility_id=${site.facilityId} AND request_key=${key}`.execute(
        tx,
      );
    if (
      !previous ||
      ["name", "email", "topic", "message"].some(
        (k) => previous[k] !== body[k as keyof typeof body],
      ) ||
      previous.context !== (body.context ?? null)
    )
      throw conflict("This enquiry request has different contents.");
    return { id: previous.id, status: "received" as const };
  });
}
export async function listEnquiries(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const { rows } =
      await sql`SELECT id,name,email,topic,message,context,status,created_at AS "createdAt",version FROM booking.website_enquiry WHERE facility_id=${facilityId} ORDER BY created_at DESC LIMIT 100`.execute(
        tx,
      );
    return { items: rows };
  });
}
export async function reviewEnquiry(
  db: Kysely<DB>,
  caller: Caller,
  input: { facilityId: string; id: string; version: number },
  key?: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "booking",
      name: "booking.review_website_enquiry",
      idempotencyKey: key,
      request: input,
    },
    async (ctx) => {
      await lockAccess(ctx);
      const { rows: permissions } =
        await sql`SELECT 1 FROM platform.staff_permission p JOIN platform.staff s ON s.id=p.staff_id AND s.status='active' AND NOT s.is_system_account WHERE p.staff_id=${ctx.actor.staffId ?? null} AND p.permission='config.manage' AND (p.facility_id IS NULL OR p.facility_id=${input.facilityId}) LIMIT 1`.execute(
          ctx.tx,
        );
      if (!permissions.length) throw forbidden("Website access was revoked");
      const {
        rows: [r],
      } = await sql<{
        id: string;
        status: string;
        version: number;
      }>`UPDATE booking.website_enquiry SET status='reviewed',updated_by=${ctx.actor.staffId ?? null} WHERE id=${input.id} AND facility_id=${input.facilityId} AND version=${input.version} RETURNING id,status,version`.execute(
        ctx.tx,
      );
      if (!r) throw conflict("The enquiry changed. Reload the list.");
      ctx.audit({
        action: "update",
        subjectType: "booking.website_enquiry",
        subjectId: r.id,
        diff: { status: "reviewed" },
      });
      return r;
    },
  );
}

import { z } from "zod";
import { sql, type DB, type Kysely, type Transaction } from "@hms/db";
import {
  runQuery,
  runCommand,
  notFound,
  conflict,
  forbidden,
} from "@hms/platform";
import type { Caller } from "../../caller.ts";
import { clock } from "../../caller.ts";
import { lockAccess } from "../access/staff.ts";
import { WebsiteContent } from "./website-profile.ts";
export const WebsiteSettings = z.strictObject({
  demoEnabled: z.boolean(),
  content: WebsiteContent,
});
const KEY = "website.swastikaa";
export async function readWebsiteSettings(
  tx: Transaction<DB>,
  facilityId: string,
) {
  const row = await tx
    .selectFrom("platform.config_setting")
    .select(["id", "value"])
    .where("facility_id", "=", facilityId)
    .where("key", "=", KEY)
    .where("effective_from", "<=", new Date())
    .orderBy("effective_from", "desc")
    .orderBy("id", "desc")
    .executeTakeFirst();
  return row
    ? { version: row.id, ...WebsiteSettings.parse(row.value) }
    : { version: null, demoEnabled: true, content: WebsiteContent.parse({}) };
}
export async function getWebsiteSettings(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const facility = await tx
      .selectFrom("platform.facility")
      .select("id")
      .where("id", "=", facilityId)
      .executeTakeFirst();
    if (!facility) throw notFound("Facility");
    return { facilityId, ...(await readWebsiteSettings(tx, facilityId)) };
  });
}
export async function saveWebsiteSettings(
  db: Kysely<DB>,
  caller: Caller,
  input: {
    facilityId: string;
    version: string | null;
    demoEnabled: boolean;
    content: z.infer<typeof WebsiteContent>;
  },
  key?: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "platform",
      name: "platform.save_website",
      idempotencyKey: key,
      request: input,
    },
    async (ctx) => {
      await lockAccess(ctx);
      const { rows } =
        await sql`SELECT 1 FROM platform.staff_permission p JOIN platform.staff s ON s.id=p.staff_id AND s.status='active' AND NOT s.is_system_account WHERE p.staff_id=${ctx.actor.staffId ?? null} AND p.permission='config.manage' AND (p.facility_id IS NULL OR p.facility_id=${input.facilityId}) LIMIT 1`.execute(
          ctx.tx,
        );
      if (ctx.actor.kind !== "staff" || !rows.length)
        throw forbidden("Website configuration access was revoked");
      const facility = await ctx.tx
        .selectFrom("platform.facility")
        .select("id")
        .where("id", "=", input.facilityId)
        .forUpdate()
        .executeTakeFirst();
      if (!facility) throw notFound("Facility");
      const before = await readWebsiteSettings(ctx.tx, input.facilityId);
      if (before.version !== input.version)
        throw conflict("Website settings changed. Reload before saving.");
      const { id } = await ctx.tx
        .insertInto("platform.config_setting")
        .values({
          tenant_id: ctx.tenantId,
          facility_id: input.facilityId,
          key: KEY,
          value: JSON.stringify({
            demoEnabled: input.demoEnabled,
            content: input.content,
          }),
          effective_from: clock(caller),
          created_by: ctx.actor.staffId,
          updated_by: ctx.actor.staffId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      ctx.audit({
        action: "update",
        subjectType: "platform.config_setting",
        subjectId: id,
        diff: {
          key: KEY,
          facilityId: input.facilityId,
          demoEnabled: input.demoEnabled,
        },
      });
      return {
        facilityId: input.facilityId,
        version: id,
        demoEnabled: input.demoEnabled,
        content: input.content,
      };
    },
  );
}

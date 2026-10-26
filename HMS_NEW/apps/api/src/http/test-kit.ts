// Shared HTTP test setup: a fresh tenant, staff members holding built-in roles at chosen clinics, and a
// `call` helper that signs requests as one of them. Used by catalog.test.ts and flows.test.ts.
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createDb, type DB, type Kysely } from "@hms/db";
import { config } from "../../../../db/scripts/config.mjs";
import {
  adminPool,
  createTenant,
  type TenantFixture,
} from "../../../../db/tests/db.ts";
import { signDevToken } from "../auth/dev-token.ts";
import { createVerifier } from "../auth/verify.ts";
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from "../config.ts";
import { dispatchOnce } from "../../../worker/src/dispatcher.ts";
import { consumers } from "../consumers.ts";
import type { ManagedSettings } from "../modules/comms/managed-config.ts";
import type { ChannelSettings } from "../modules/comms/voice-growth.ts";
import { buildServer, type ServerDeps } from "../server.ts";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Person {
  staffId: string;
  token: string;
}

export interface Kit {
  app: FastifyInstance;
  db: Kysely<DB>;
  admin: ReturnType<typeof adminPool>;
  tenant: TenantFixture;
  run: string;
  /** Adds a staff member with a built-in role at a clinic (null: every clinic) and a dev sign-in. */
  person(
    name: string,
    role: string,
    facilityId: string | null,
    staffType?: string,
  ): Promise<Person>;
  /** `now` pins the server clock for this request (X-Test-Now). */
  call(
    who: Person,
    method: Method,
    url: string,
    body?: unknown,
    idem?: string | boolean,
    now?: string,
  ): Promise<{ status: number; body: any }>;
  /** Runs the worker's consumers until nothing is pending (check-in opens the encounter, and so on). */
  dispatch(): Promise<void>;
  close(): Promise<void>;
}

export async function startKit(
  label: string,
  channels?: ChannelSettings,
  whatsappTemplateFetcher?: typeof fetch,
  managed?: ManagedSettings,
  /** Extra server dependencies that need the new tenant (for example its public tenant id). */
  extra?: (tenant: TenantFixture) => Partial<ServerDeps>,
): Promise<Kit> {
  const admin = adminPool();
  const tenant = await createTenant(admin, label);
  const db = createDb({
    connectionString: config.testAppDatabaseUrl,
    maxConnections: 5,
  });
  const app = buildServer({
    db,
    verifier: createVerifier({
      mode: "dev",
      secret: DEV_SECRET_DEFAULT,
      issuer: DEV_ISSUER,
    }),
    allowClockOverride: true,
    channels,
    whatsappTemplateFetcher,
    managed,
    ...extra?.(tenant),
  });
  const run = randomUUID().slice(0, 8);
  let n = 0;
  return {
    app,
    db,
    admin,
    tenant,
    run,
    async person(name, role, facilityId, staffType = "admin") {
      const subject = `${label}-${run}-${++n}`;
      const {
        rows: [s],
      } = await admin.query<{ id: string }>(
        `INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $3, $3, $4) RETURNING id`,
        [tenant.tenantId, subject, name, staffType],
      );
      await admin.query(
        `INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $4 FROM platform.role WHERE tenant_id IS NULL AND code = $3`,
        [tenant.tenantId, s!.id, role, facilityId],
      );
      await admin.query(
        `INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`,
        [tenant.tenantId, s!.id, DEV_ISSUER, subject],
      );
      return { staffId: s!.id, token: await signDevToken(subject) };
    },
    async call(who, method, url, body, idem, now) {
      const headers: Record<string, string> = {
        authorization: `Bearer ${who.token}`,
      };
      // Test-only convenience for newly keyed existing routes; false explicitly tests a missing header.
      // Production callers preserve one key for an unchanged intent through uncertainty.
      const key = idem === undefined && method !== "GET" ? true : idem;
      if (key)
        headers["idempotency-key"] =
          key === true ? `test-${randomUUID()}` : key;
      if (now) headers["x-test-now"] = now;
      const res = await app.inject({
        method,
        url,
        headers,
        ...(body !== undefined ? { payload: body as object } : {}),
      });
      return { status: res.statusCode, body: res.body ? res.json() : null };
    },
    async dispatch() {
      for (let i = 0; i < 20; i++)
        if (
          (await dispatchOnce(db, consumers, { batchSize: 200 })).claimed === 0
        )
          break;
    },
    async close() {
      await app.close();
      await db.destroy();
      await admin.end();
    },
  };
}

/** The first Monday at least `minDays` from today (Asia/Kolkata). */
export function nextMonday(minDays = 2): string {
  for (let d = minDays; ; d++) {
    const day = localDay(d);
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 1) return day;
  }
}

export const ist = (day: string, time: string) => `${day}T${time}:00+05:30`;

/** YYYY-MM-DD in Asia/Kolkata, `days` from today. */
export function localDay(days = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(Date.now() + days * 86_400_000),
  );
}

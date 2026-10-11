// Workspace administration (G16) and the activity log (G18) over HTTP.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { config } from '../../../../db/scripts/config.mjs';
import { adminPool, createTenant, type TenantFixture } from '../../../../db/tests/db.ts';
import { signDevToken } from '../auth/dev-token.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from '../config.ts';
import { buildServer } from '../server.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 5 });
let app: FastifyInstance;
let t: TenantFixture;
let facility2: string;
const run = randomUUID().slice(0, 8);
const people = {} as Record<'admin' | 'branchAdmin' | 'frontDesk' | 'auditor' | 'nurse', string>;
const tokens = {} as Record<keyof typeof people, string>;

async function call(method: 'GET' | 'POST' | 'PUT', url: string, opts: { token?: string; body?: unknown; idem?: string | true } = {}) {
  const headers: Record<string, string> = { authorization: `Bearer ${opts.token ?? tokens.admin}` };
  if (opts.idem) headers['idempotency-key'] = opts.idem === true ? `test-${randomUUID()}` : opts.idem;
  const res = await app.inject({ method, url, headers, ...(opts.body !== undefined ? { payload: opts.body as object } : {}) });
  return { status: res.statusCode, body: res.body ? res.json() : null };
}

beforeAll(async () => {
  app = buildServer({ db, verifier: createVerifier({ mode: 'dev', secret: DEV_SECRET_DEFAULT, issuer: DEV_ISSUER }) });
  t = await createTenant(admin, 'access');
  const one = async (text: string, values: unknown[]) => (await admin.query<{ id: string }>(text, values)).rows[0]!.id;
  facility2 = await one(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Branch 2', 'clinic', '29') RETURNING id`, [t.tenantId, t.organizationId]);
  const setup: Array<[keyof typeof people, string, string, string | null]> = [
    ['admin', 'Priya Admin', 'tenant_admin', null],
    ['branchAdmin', 'Branch One Lead', 'tenant_admin', t.facilityId],
    ['frontDesk', 'Ravi Desk', 'front_desk', t.facilityId],
    ['auditor', 'Audit Person', 'auditor', null],
    ['nurse', 'Meena Nurse', 'nurse', t.facilityId],
  ];
  for (const [who, name, role, facility] of setup) {
    people[who] = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $3, $3, 'admin') RETURNING id`, [t.tenantId, who, name]);
    await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $4 FROM platform.role WHERE tenant_id IS NULL AND code = $3`, [t.tenantId, people[who], role, facility]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [t.tenantId, people[who], DEV_ISSUER, `${who}-${run}`]);
    tokens[who] = await signDevToken(`${who}-${run}`);
  }
});

afterAll(async () => {
  await app?.close();
  await db.destroy();
  await admin.end();
});

describe('activity log (G18)', () => {
  const log = (query: string, token = tokens.auditor) => call('GET', `/v1/audit-events?${query}`, { token });

  it('lists who changed what, filtered, for auditors and every-clinic administrators only', async () => {
    const toggled = await call('PUT', `/v1/facilities/${t.facilityId}/overbooking`, { token: tokens.branchAdmin, body: { enabled: true } });
    expect(toggled.status).toBe(200);
    expect((await call('PUT', `/v1/facilities/${t.facilityId}/overbooking`, { token: tokens.branchAdmin, body: { enabled: false } })).status).toBe(200);
    const found = await log(`actor=${encodeURIComponent('branch one')}&action=config_setting`);
    expect(found.status).toBe(200);
    expect(found.body.items[0]).toMatchObject({ actorName: 'Branch One Lead', actorIsSystem: false, action: 'update', subjectType: 'platform.config_setting' });
    const id = found.body.items[0].subjectId;
    const byRecord = (await log(`record=${id}`)).body.items;
    expect(byRecord.map((e: { auditEventId: string; subjectId: string }) => [e.auditEventId, e.subjectId])).toEqual([[found.body.items[0].auditEventId, id]]);
    expect((await log(`record=${id}`, tokens.admin)).status).toBe(200);
    expect((await log('actor=%25')).body.items).toEqual([]); // wildcards are literal
    expect((await log(`record=${id}&to=2020-01-01`)).body.items).toEqual([]);
    expect((await log('from=2026-02-02&to=2026-01-01')).status).toBe(400);

    // Only this tenant's rows (RLS), newest first, paged with `more`
    const page = await log('limit=500');
    const { rows } = await admin.query<{ n: string }>(`SELECT count(*) AS n FROM platform.audit_event WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [t.tenantId, page.body.items.map((e: { auditEventId: string }) => e.auditEventId)]);
    expect(Number(rows[0]!.n)).toBe(page.body.items.length);
    expect((await log('limit=1')).body).toMatchObject({ more: true });

    for (const token of [tokens.branchAdmin, tokens.frontDesk, tokens.nurse]) expect((await log('', token)).status).toBe(403);
  });

  it('exports matching events and records the export', async () => {
    expect((await call('POST', '/v1/audit-events/export', { token: tokens.frontDesk, body: {} })).status).toBe(403);
    const out = await call('POST', '/v1/audit-events/export', { token: tokens.auditor, body: { action: 'config_setting' } });
    expect(out.status).toBe(200);
    expect(out.body.truncated).toBe(false);
    expect(out.body.items.length).toBeGreaterThan(0);
    const recorded = await log('action=export');
    expect(recorded.body.items[0]).toMatchObject({ actorName: 'Audit Person', action: 'export', subjectType: 'platform.audit_event', diff: { filters: { action: 'config_setting' }, rows: out.body.items.length } });
  });
});

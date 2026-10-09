// M01 platform: tenant isolation, cross-tenant safety, write ownership, optimistic locking,
// numbering under concurrency, immutability and the tree / access rules.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PG, adminPool, appPool, asTenant, createBedCategory, createPatient, createTenant, type TenantFixture } from './db.ts';

const admin = adminPool();
const app = appPool(25);
let a: TenantFixture;
let b: TenantFixture;
let bedCategoryA: string;

beforeAll(async () => {
  a = await createTenant(admin, 'tenant-a');
  b = await createTenant(admin, 'tenant-b');
  bedCategoryA = await createBedCategory(admin, a.tenantId);
});
afterAll(async () => {
  await app.end();
  await admin.end();
});

async function insertStaff(t: TenantFixture, employeeNo: string): Promise<string> {
  const { rows: [s] } = await admin.query<{ id: string }>(
    `INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type)
     VALUES ($1, $2, 'Test', 'Test ' || $2, 'doctor') RETURNING id`,
    [t.tenantId, employeeNo],
  );
  return s!.id;
}

describe('tenant isolation (RLS)', () => {
  it('a tenant sees only its own rows', async () => {
    const ids = await asTenant(app, a.tenantId, null, async (c) =>
      (await c.query<{ id: string }>('SELECT id FROM platform.facility')).rows.map((r) => r.id),
    );
    expect(ids).toEqual([a.facilityId]);
  });

  it('a tenant sees only its own tenant row', async () => {
    const ids = await asTenant(app, b.tenantId, null, async (c) =>
      (await c.query<{ id: string }>('SELECT id FROM platform.tenant')).rows.map((r) => r.id),
    );
    expect(ids).toEqual([b.tenantId]);
  });

  it('queries fail when the transaction has no tenant set', async () => {
    await expect(
      asTenant(app, null, null, (c) => c.query('SELECT id FROM platform.facility')),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege, message: expect.stringContaining('app.tenant_id') });
  });

  it("a tenant cannot insert a row carrying another tenant's id", async () => {
    await expect(
      asTenant(app, a.tenantId, 'mod_platform', (c) =>
        c.query(
          `INSERT INTO platform.organization (tenant_id, name, org_type) VALUES ($1, 'Sneaky', 'clinic')`,
          [b.tenantId],
        ),
      ),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });

  it("a tenant cannot update another tenant's rows (they are invisible)", async () => {
    const count = await asTenant(app, a.tenantId, 'mod_platform', async (c) =>
      (await c.query(`UPDATE platform.facility SET name = 'x' WHERE id = $1`, [b.facilityId])).rowCount,
    );
    expect(count).toBe(0);
  });

  it('monthly audit partitions are isolated too', async () => {
    const { rows } = await admin.query<{ name: string }>(
      `SELECT c.relname AS name FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
       WHERE i.inhparent = 'platform.audit_event'::regclass AND NOT (c.relrowsecurity AND c.relforcerowsecurity)`,
    );
    expect(rows).toEqual([]);
  });
});

describe('cross-tenant foreign keys', () => {
  it("a row cannot reference another tenant's parent, even with RLS bypassed", async () => {
    await expect(
      admin.query(
        `INSERT INTO platform.department (tenant_id, facility_id, code, name, kind)
         VALUES ($1, $2, 'X', 'Cross-tenant', 'clinical')`,
        [a.tenantId, b.facilityId],
      ),
    ).rejects.toMatchObject({ code: PG.foreignKeyViolation });
  });
});

describe('write ownership', () => {
  it('the app role without a module role cannot write', async () => {
    await expect(
      asTenant(app, a.tenantId, null, (c) =>
        c.query(`INSERT INTO platform.organization (tenant_id, name, org_type) VALUES ($1, 'X', 'clinic')`, [a.tenantId]),
      ),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });

  it("another module's role cannot write platform tables", async () => {
    await expect(
      asTenant(app, a.tenantId, 'mod_booking', (c) =>
        c.query(`INSERT INTO platform.organization (tenant_id, name, org_type) VALUES ($1, 'X', 'clinic')`, [a.tenantId]),
      ),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });

  it('the owning module role can write, and any module can still read', async () => {
    const name = await asTenant(app, a.tenantId, 'mod_platform', async (c) => {
      await c.query(`INSERT INTO platform.organization (tenant_id, name, org_type) VALUES ($1, 'Branch org', 'clinic')`, [a.tenantId]);
      return (await c.query<{ name: string }>(`SELECT name FROM platform.organization WHERE name = 'Branch org'`)).rows[0]?.name;
    });
    expect(name).toBe('Branch org');
    const facilities = await asTenant(app, a.tenantId, 'mod_booking', async (c) =>
      (await c.query('SELECT 1 FROM platform.facility')).rowCount,
    );
    expect(facilities).toBe(1);
  });

  it('nobody can delete facilities', async () => {
    await expect(
      asTenant(app, a.tenantId, 'mod_platform', (c) => c.query('DELETE FROM platform.facility WHERE id = $1', [a.facilityId])),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });
});

describe('optimistic locking', () => {
  it('bumps version on update; a stale version updates nothing', async () => {
    const result = await asTenant(app, a.tenantId, 'mod_platform', async (c) => {
      const before = (await c.query<{ version: number }>('SELECT version FROM platform.facility WHERE id = $1', [a.facilityId])).rows[0]!.version;
      const first = await c.query(
        `UPDATE platform.facility SET phone = '080-1' WHERE id = $1 AND version = $2 RETURNING version`,
        [a.facilityId, before],
      );
      const stale = await c.query(`UPDATE platform.facility SET phone = '080-2' WHERE id = $1 AND version = $2`, [a.facilityId, before]);
      return { before, after: first.rows[0]?.version, staleCount: stale.rowCount };
    });
    expect(result.after).toBe(result.before + 1);
    expect(result.staleCount).toBe(0);
  });
});

describe('number series', () => {
  it('hands out 100 consecutive, distinct numbers under concurrent callers', async () => {
    const period = `test-${Date.now()}`;
    const values = await Promise.all(
      Array.from({ length: 100 }, () =>
        asTenant(
          app,
          a.tenantId,
          'mod_booking',
          async (c) =>
            Number((await c.query<{ n: string }>(`SELECT platform.next_number('token', $1, $2) AS n`, [a.facilityId, period])).rows[0]!.n),
          { commit: true },
        ),
      ),
    );
    expect([...values].sort((x, y) => x - y)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('keeps separate sequences per tenant, facility and period', async () => {
    const next = (t: TenantFixture, facility: string | null, period: string) =>
      asTenant(app, t.tenantId, 'mod_patient', async (c) =>
        Number((await c.query<{ n: string }>(`SELECT platform.next_number('mrn', $1, $2) AS n`, [facility, period])).rows[0]!.n),
      { commit: true });
    expect(await next(a, null, '')).toBe(1);
    expect(await next(a, null, '')).toBe(2);
    expect(await next(b, null, '')).toBe(1);
    expect(await next(a, a.facilityId, '')).toBe(1);
    expect(await next(a, null, '2026-27')).toBe(1);
  });
});

describe('idempotency records', () => {
  it('rejects a second record with the same scope and key', async () => {
    await expect(
      asTenant(app, a.tenantId, 'mod_booking', async (c) => {
        const insert = `INSERT INTO platform.idempotency_record (tenant_id, scope, key, request_hash) VALUES ($1, 'booking.book', 'k-1', $2)`;
        await c.query(insert, [a.tenantId, 'hash-1']);
        await c.query(insert, [a.tenantId, 'hash-2']);
      }),
    ).rejects.toMatchObject({ code: PG.uniqueViolation });
  });
});

describe('audit log immutability', () => {
  it('module roles can append audit events but not change them; even superusers are stopped', async () => {
    await asTenant(app, a.tenantId, 'mod_patient', (c) =>
      c.query(`INSERT INTO platform.audit_event (tenant_id, action, subject_type) VALUES ($1, 'view', 'patient')`, [a.tenantId]),
    { commit: true });
    await expect(
      asTenant(app, a.tenantId, 'mod_platform', (c) => c.query(`UPDATE platform.audit_event SET reason = 'edited'`)),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
    await expect(admin.query(`DELETE FROM platform.audit_event WHERE tenant_id = $1`, [a.tenantId])).rejects.toMatchObject({
      code: PG.insufficientPrivilege,
      message: expect.stringContaining('immutable'),
    });
  });

  it('routes events into a monthly partition, with the default partition as a safety net', async () => {
    const { rows } = await admin.query<{ part: string }>(
      `INSERT INTO platform.audit_event (tenant_id, action, subject_type, occurred_at)
       VALUES ($1, 'view', 'patient', now()), ($1, 'view', 'patient', now() + interval '5 years')
       RETURNING tableoid::regclass::text AS part`,
      [a.tenantId],
    );
    expect(rows[0]!.part).toMatch(/^platform\.audit_event_y\d{4}m\d{2}$/);
    expect(rows[1]!.part).toBe('platform.audit_event_default');
  });
});

describe('location tree', () => {
  const insertLocation = (c: { query: typeof admin.query }, kind: string, code: string, parent: string | null, extra: { ward_type?: string } = {}) =>
    c.query<{ id: string }>(
      `INSERT INTO platform.location (tenant_id, facility_id, parent_location_id, kind, code, name, ward_type, bed_category_id)
       VALUES ($1, $2, $3, $4, $5, $5, $6, CASE WHEN $4 = 'bed' THEN $7::uuid END) RETURNING id`,
      [a.tenantId, a.facilityId, parent, kind, code, extra.ward_type ?? null, bedCategoryA],
    );

  it('accepts a bed under a ward (via a room) and rejects a bed with no ward above it', async () => {
    const { rows: [ward] } = await insertLocation(admin, 'ward', 'W1', null, { ward_type: 'general' });
    const { rows: [room] } = await insertLocation(admin, 'room', 'W1-R1', ward!.id);
    await expect(insertLocation(admin, 'bed', 'W1-R1-B1', room!.id)).resolves.toBeDefined();
    const { rows: [lobby] } = await insertLocation(admin, 'room', 'LOBBY', null);
    await expect(insertLocation(admin, 'bed', 'LOBBY-B1', lobby!.id)).rejects.toMatchObject({ code: PG.checkViolation });
  });

  it('rejects cycles', async () => {
    const { rows: [x] } = await insertLocation(admin, 'building', 'BX', null);
    const { rows: [y] } = await insertLocation(admin, 'floor', 'BX-1', x!.id);
    await expect(
      admin.query('UPDATE platform.location SET parent_location_id = $1 WHERE id = $2', [y!.id, x!.id]),
    ).rejects.toMatchObject({ code: PG.checkViolation });
  });

  it('rejects a parent in another facility', async () => {
    const { rows: [f2] } = await admin.query<{ id: string }>(
      `INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code)
       VALUES ($1, $2, 'F2', 'Facility 2', 'clinic', '33') RETURNING id`,
      [a.tenantId, a.organizationId],
    );
    const { rows: [parent] } = await insertLocation(admin, 'building', 'BF1', null);
    await expect(
      admin.query(
        `INSERT INTO platform.location (tenant_id, facility_id, parent_location_id, kind, code, name)
         VALUES ($1, $2, $3, 'floor', 'BF2-1', 'Floor')`,
        [a.tenantId, f2!.id, parent!.id],
      ),
    ).rejects.toMatchObject({ code: PG.foreignKeyViolation });
  });
});

describe('facility rules', () => {
  it("rejects a GSTIN whose state prefix doesn't match the facility state", async () => {
    await expect(
      admin.query(
        `INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code, gstin)
         VALUES ($1, $2, 'BADGST', 'X', 'clinic', '29', '33ABCDE1234F1Z9')`,
        [a.tenantId, a.organizationId],
      ),
    ).rejects.toMatchObject({ code: PG.checkViolation });
  });
});

describe('roles and grants', () => {
  it('tenants see system roles plus their own, never another tenant’s', async () => {
    await asTenant(app, b.tenantId, 'mod_platform', (c) =>
      c.query(`INSERT INTO platform.role (tenant_id, code, name) VALUES ($1, 'b_custom', 'B custom')`, [b.tenantId]),
    { commit: true });
    const codes = await asTenant(app, a.tenantId, null, async (c) =>
      (await c.query<{ code: string }>('SELECT code FROM platform.role ORDER BY code')).rows.map((r) => r.code),
    );
    expect(codes).toEqual(['auditor', 'booking_agent', 'doctor', 'front_desk', 'nurse', 'tenant_admin']);
  });

  it('tenants cannot change system roles or their permissions', async () => {
    const updated = await asTenant(app, a.tenantId, 'mod_platform', async (c) =>
      (await c.query(`UPDATE platform.role SET name = 'Hacked' WHERE code = 'doctor'`)).rowCount,
    ).catch((err: { code: string }) => err.code);
    expect([0, PG.insufficientPrivilege]).toContain(updated);
    await expect(
      asTenant(app, a.tenantId, 'mod_platform', (c) =>
        c.query(
          `INSERT INTO platform.role_permission (role_id, permission_id)
           SELECT r.id, p.id FROM platform.role r, platform.permission p
           WHERE r.code = 'nurse' AND r.tenant_id IS NULL AND p.code = 'patients.merge'`,
        ),
      ),
    ).rejects.toMatchObject({ code: PG.insufficientPrivilege });
  });

  it("a staff member can be granted a system role but not another tenant's role", async () => {
    const staffId = await insertStaff(a, `G-${Date.now()}`);
    await asTenant(app, a.tenantId, 'mod_platform', (c) =>
      c.query(
        `INSERT INTO platform.role_grant (tenant_id, staff_id, role_id)
         SELECT $1, $2, id FROM platform.role WHERE tenant_id IS NULL AND code = 'doctor'`,
        [a.tenantId, staffId],
      ),
    );
    const { rows: [bRole] } = await admin.query<{ id: string }>(`SELECT id FROM platform.role WHERE code = 'b_custom'`);
    await expect(
      asTenant(app, a.tenantId, 'mod_platform', (c) =>
        c.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id) VALUES ($1, $2, $3)`, [a.tenantId, staffId, bRole!.id]),
      ),
    ).rejects.toMatchObject({ code: PG.foreignKeyViolation });
  });
});

describe('accounts and access', () => {
  it('a login belongs to exactly one staff member or patient', async () => {
    await expect(
      admin.query(
        `INSERT INTO platform.user_account (tenant_id, identity_issuer, identity_subject) VALUES ($1, 'idp', 'nobody')`,
        [a.tenantId],
      ),
    ).rejects.toMatchObject({ code: PG.checkViolation });
  });

  it('login lookup finds accounts across tenants without a tenant context', async () => {
    const sa = await insertStaff(a, `L-${Date.now()}`);
    const sb = await insertStaff(b, `L-${Date.now()}`);
    for (const [t, s] of [[a, sa], [b, sb]] as const) {
      await admin.query(
        `INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status)
         VALUES ($1, $2, 'idp', 'visiting-doctor', 'active')`,
        [t.tenantId, s],
      );
    }
    const { rows } = await app.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM platform.accounts_for_identity('idp', 'visiting-doctor')`,
    );
    expect(rows.map((r) => r.tenant_id).sort()).toEqual([a.tenantId, b.tenantId].sort());
  });

  it('break-glass access is limited to 24 hours and needs a real reason', async () => {
    const staffId = await insertStaff(a, `BG-${Date.now()}`);
    const patientId = await createPatient(admin, a.tenantId);
    const insert = (reason: string, hours: number) =>
      admin.query(
        `INSERT INTO platform.emergency_access_grant (tenant_id, staff_id, patient_id, reason, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))`,
        [a.tenantId, staffId, patientId, reason, hours],
      );
    await expect(insert('Unconscious patient in ER', 4)).resolves.toBeDefined();
    await expect(insert('Unconscious patient in ER', 48)).rejects.toMatchObject({ code: PG.checkViolation });
    await expect(insert('need', 4)).rejects.toMatchObject({ code: PG.checkViolation });
  });
});

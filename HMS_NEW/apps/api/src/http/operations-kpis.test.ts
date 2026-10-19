import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OperationsKpiReportSchema } from '@hms/contracts';
import { createDb } from '@hms/db';
import { config } from '../../../../db/scripts/config.mjs';
import { adminPool, createPatient, createTenant, type TenantFixture } from '../../../../db/tests/db.ts';
import { signDevToken } from '../auth/dev-token.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from '../config.ts';
import { buildServer } from '../server.ts';
import { aggregateKpis, reportDay, type KpiBucket } from '../modules/booking/operations-kpis.ts';

const admin = adminPool();
const db = createDb({ connectionString: config.testAppDatabaseUrl, maxConnections: 5 });
let app: FastifyInstance, tenant: TenantFixture, other: TenantFixture;
let branch: string, token: string, noPermission: string;
const run = randomUUID().slice(0, 8), end = '2026-10-19';
const meta = { facilityId: randomUUID(), end, timezone: 'Asia/Kolkata', asOf: '2026-10-19T12:00:00.000Z', availableFrom: '2026-01-01' };

beforeAll(async () => {
  app = buildServer({ db, verifier: createVerifier({ mode: 'dev', secret: DEV_SECRET_DEFAULT, issuer: DEV_ISSUER }), allowClockOverride: true });
  tenant = await createTenant(admin, 'kpis');
  other = await createTenant(admin, 'other-kpis');
  const one = async (sql: string, values: unknown[]) => (await admin.query<{ id: string }>(sql, values)).rows[0]!.id;
  branch = await one(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code) VALUES ($1, $2, 'F2', 'Other branch', 'clinic', '29') RETURNING id`, [tenant.tenantId, tenant.organizationId]);
  await admin.query(`UPDATE platform.facility SET created_at = '2026-01-01T00:00:00Z', timezone = 'Asia/Kolkata' WHERE id IN ($1, $2, $3)`, [tenant.facilityId, other.facilityId, branch]);
  const doctor = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, 'DR', 'Doctor', 'Dr Reporting', 'doctor') RETURNING id`, [tenant.tenantId]);
  const resource = await one(`INSERT INTO booking.schedulable_resource (tenant_id, kind, staff_id, name) VALUES ($1, 'practitioner', $2, 'Reporting') RETURNING id`, [tenant.tenantId, doctor]);
  const patient = await createPatient(admin, tenant.tenantId, 'PRIVATE PATIENT');
  for (const [name, granted] of [['reader', true], ['none', false]] as const) {
    const staff = await one(`INSERT INTO platform.staff (tenant_id, employee_no, given_name, display_name, staff_type) VALUES ($1, $2, $2, $2, 'admin') RETURNING id`, [tenant.tenantId, name]);
    if (granted) await admin.query(`INSERT INTO platform.role_grant (tenant_id, staff_id, role_id, facility_id) SELECT $1, $2, id, $3 FROM platform.role WHERE tenant_id IS NULL AND code = 'front_desk'`, [tenant.tenantId, staff, tenant.facilityId]);
    await admin.query(`INSERT INTO platform.user_account (tenant_id, staff_id, identity_issuer, identity_subject, status) VALUES ($1, $2, $3, $4, 'active')`, [tenant.tenantId, staff, DEV_ISSUER, `${name}-${run}`]);
    const signed = await signDevToken(`${name}-${run}`);
    if (granted) token = signed; else noPermission = signed;
  }
  let code = 100000;
  const booking = async (created: string, status: string, channel = 'web', day = end, facility = tenant.facilityId, predecessor: string | null = null) => one(`
    INSERT INTO booking.appointment (tenant_id, confirmation_code, patient_id, practitioner_staff_id, resource_id, facility_id, session_on, booking_kind, origin_channel, status, created_at, checked_in_at, completed_at, cancelled_at, cancel_reason, rescheduled_from_id, reason_text)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'walk_in', $8, $9, $10,
      CASE WHEN $9 IN ('checked_in','completed') THEN '2026-10-18T18:50:00Z'::timestamptz END,
      CASE WHEN $9 = 'completed' THEN '2026-10-19T01:00:00Z'::timestamptz END,
      CASE WHEN $9 = 'cancelled' THEN '2026-10-19T02:00:00Z'::timestamptz END,
      CASE WHEN $9 = 'cancelled' THEN 'fixture cancellation' END, $11, 'PRIVATE REASON') RETURNING id`,
    [tenant.tenantId, String(code++), patient, doctor, resource, facility, day, channel, status, created, predecessor]);
  await booking('2026-10-19T00:15:00Z', 'confirmed');
  await booking('2026-10-18T18:45:00Z', 'completed', 'whatsapp');
  await booking('2026-10-18T18:29:00Z', 'no_show', 'voice', '2026-10-18');
  await booking('2026-10-12T18:29:00Z', 'confirmed'); // Oct 12 local: previous 7-day period.
  await booking('2026-10-11T12:00:00Z', 'cancelled'); // Old booking, cancellation in current period.
  const original = await booking('2026-10-10T12:00:00Z', 'cancelled');
  await booking('2026-10-19T03:00:00Z', 'confirmed', 'web', end, tenant.facilityId, original);
  await booking('2026-10-19T03:00:00Z', 'confirmed', 'web', end, branch);
});
afterAll(async () => { await app?.close(); await db.destroy(); await admin.end(); });
const call = (facility = tenant.facilityId, auth = token, date = end) => app.inject({ method: 'GET', url: `/v1/operations/kpis?facilityId=${facility}&date=${date}`, headers: { authorization: `Bearer ${auth}`, 'x-test-now': '2026-10-19T12:00:00.000Z' } });

describe('clinic KPI reporting', () => {
  it('aggregates local creation dates and actual event dates; excludes reschedule replacement bookings/cancellations', async () => {
    const response = await call();
    expect(response.statusCode, response.body).toBe(200);
    const report = OperationsKpiReportSchema.parse(response.json());
    const metric = (id: string) => report.metrics.find((m) => m.id === id)!;
    expect(metric('bookings').periods['7']).toMatchObject({ current: 3, previous: 3, complete: true });
    expect(metric('bookings').series.slice(-2)).toEqual([1, 2]);
    expect(metric('completed').periods['7'].current).toBe(1);
    expect(metric('checkIns').periods['7'].current).toBe(1);
    expect(metric('cancelled').periods['7'].current).toBe(1);
    expect(metric('noShows').periods['7'].current).toBe(1);
    expect(metric('visits').periods['7'].current).toBe(5);
    for (const m of report.metrics) for (const range of ['7', '30', '90'] as const) {
      const p = m.periods[range];
      for (const rows of Object.values(p.breakdowns)) {
        expect(rows.reduce((sum, r) => sum + r.value, 0)).toBe(p.current);
        expect(rows.reduce((sum, r) => sum + (r.previous ?? 0), 0)).toBe(p.previous);
      }
    }
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|patientId|reason_text|confirmation_code/);
  });
  it('enforces sign-in, permission, facility and tenant boundaries', async () => {
    expect((await app.inject({ method: 'GET', url: `/v1/operations/kpis?facilityId=${tenant.facilityId}&date=${end}` })).statusCode).toBe(401);
    expect((await call(tenant.facilityId, noPermission)).statusCode).toBe(403);
    expect((await call(branch)).statusCode).toBe(403);
    expect((await call(other.facilityId)).statusCode).toBe(403);
    // A tenant-wide permission still cannot query another tenant through RLS.
    await admin.query(`UPDATE platform.role_grant SET facility_id = NULL WHERE tenant_id = $1`, [tenant.tenantId]);
    expect((await call(other.facilityId)).statusCode).toBe(404);
  });
  it('keeps pre-clinic history unknown while empty known days are zero', async () => {
    const facility = (await admin.query<{ id: string }>(`INSERT INTO platform.facility (tenant_id, organization_id, code, name, facility_type, state_code, created_at) VALUES ($1, $2, 'NEW', 'New clinic', 'clinic', '29', '2026-10-18T00:00:00+05:30') RETURNING id`, [tenant.tenantId, tenant.organizationId])).rows[0]!.id;
    const response = await call(facility);
    expect(response.statusCode, response.body).toBe(200);
    const report = OperationsKpiReportSchema.parse(response.json());
    expect(report.availableFrom).toBe('2026-10-18');
    for (const m of report.metrics) {
      expect(m.series.slice(-3)).toEqual([null, 0, 0]);
      expect(m.periods['7']).toEqual({ current: 0, previous: null, complete: false, breakdowns: { doctor: [], channel: [] } });
    }
  });
  it('rejects malformed and future dates', async () => {
    expect((await call(tenant.facilityId, token, 'bad')).statusCode).toBe(400);
    expect((await call(tenant.facilityId, token, '2026-02-31')).statusCode).toBe(400);
    expect((await call(tenant.facilityId, token, '2026-10-20')).statusCode).toBe(400);
  });
  it('uses clinic-local today across a UTC date boundary', async () => {
    const response = await app.inject({ method: 'GET', url: `/v1/operations/kpis?facilityId=${tenant.facilityId}&date=2026-10-20`, headers: { authorization: `Bearer ${token}`, 'x-test-now': '2026-10-19T19:00:00Z' } });
    expect(response.statusCode, response.body).toBe(200);
  });
});

describe('exact period aggregation', () => {
  const row = (date: string, count: number, doctorId = 'd1'): KpiBucket => ({ metric: 'bookings', date, count, doctorId, doctorName: 'Same name', channel: 'web' });
  it('sums each range rather than taking its final daily value, with full 90-day comparisons', () => {
    const rows = Array.from({ length: 180 }, (_, i) => row(reportDay(end, i - 179), i < 90 ? 1 : 2));
    const report = aggregateKpis(meta, rows);
    const m = report.metrics[0]!;
    expect(m.periods['7'].current).toBe(14);
    expect(m.periods['30'].current).toBe(60);
    expect(m.periods['90']).toMatchObject({ current: 180, previous: 90 });
    expect(m.series.length).toBe(180);
  });
  it('keeps unknown history null; sums recorded partial activity and disables incomplete comparisons', () => {
    const report = aggregateKpis({ ...meta, availableFrom: '2026-10-18' }, [row(end, 3)]);
    const m = report.metrics[0]!;
    expect(m.series.slice(-3)).toEqual([null, 0, 3]);
    expect(m.periods['7']).toMatchObject({ current: 3, previous: null, complete: false });
    expect(m.periods['7'].breakdowns.doctor[0]!.previous).toBeNull();
  });
  it('retains distinct doctors with equal names and previous-only groups', () => {
    const report = aggregateKpis(meta, [row(end, 2, 'd1'), row(end, 3, 'd2'), row('2026-10-10', 4, 'd3')]);
    const p = report.metrics[0]!.periods['7'];
    expect(p.breakdowns.doctor).toEqual([
      { id: 'd2', name: 'Same name', value: 3, previous: 0 },
      { id: 'd1', name: 'Same name', value: 2, previous: 0 },
      { id: 'd3', name: 'Same name', value: 0, previous: 4 },
    ]);
  });
  it('preserves actual zero periods and inclusive leap-day/month boundaries', () => {
    const report = aggregateKpis({ ...meta, end: '2024-03-01', availableFrom: '2023-01-01' }, []);
    expect(report.metrics[0]!.periods['90']).toMatchObject({ current: 0, previous: 0, complete: true });
    expect(reportDay('2024-03-01', -1)).toBe('2024-02-29');
  });
});

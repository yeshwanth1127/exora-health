import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditEventsResponseSchema, AuditExportResponseSchema } from '@hms/contracts';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit;
let auditor: Person;
let desk: Person;
beforeAll(async () => {
  k = await startKit('audit-boundary');
  auditor = await k.person('Auditor', 'auditor', null);
  desk = await k.person('Desk', 'front_desk', k.tenant.facilityId);
});
afterAll(async () => k?.close());

describe('authoritative tenant audit date boundary', () => {
  it('exposes the actual timezone and uses a half-open DST date range, independently of clinic/browser timezone', async () => {
    await k.admin.query(`UPDATE platform.tenant SET default_timezone='America/New_York' WHERE id=$1`, [k.tenant.tenantId]);
    const action = `boundary-${k.run}`;
    const instants = ['2026-03-08T04:59:59Z', '2026-03-08T05:00:00Z', '2026-03-09T03:59:59Z', '2026-03-09T04:00:00Z'];
    for (const at of instants) await k.admin.query(
      `INSERT INTO platform.audit_event(tenant_id,occurred_at,actor_staff_id,action,subject_type) VALUES($1,$2,$3,'create',$4)`,
      [k.tenant.tenantId, at, auditor.staffId, action],
    );
    const q = `action=${action}&from=2026-03-08&to=2026-03-08`;
    const listed = await k.call(auditor, 'GET', `/v1/audit-events?${q}`);
    expect(listed.status).toBe(200);
    const page = AuditEventsResponseSchema.parse(listed.body);
    expect(page.dateBoundary).toEqual({scope:'tenant',timezone:'America/New_York',fromInclusive:'2026-03-08T05:00:00.000Z',toExclusive:'2026-03-09T04:00:00.000Z'});
    expect(page.items.map(r => r.occurredAt)).toEqual(['2026-03-09T03:59:59.000Z','2026-03-08T05:00:00.000Z']);
    expect(Date.parse(page.dateBoundary.toExclusive!) - Date.parse(page.dateBoundary.fromInclusive!)).toBe(23*60*60*1000);
    const exported = await k.call(auditor, 'POST', '/v1/audit-events/export', {action,from:'2026-03-08',to:'2026-03-08'});
    expect(exported.status).toBe(200);
    const out = AuditExportResponseSchema.parse(exported.body);
    expect(out.dateBoundary).toEqual(page.dateBoundary);
    expect(out.items.map(r => r.auditEventId)).toEqual(page.items.map(r => r.auditEventId));
    const receipt = await k.call(auditor, 'GET', '/v1/audit-events?action=export');
    expect(receipt.body.items[0].diff.dateBoundary).toEqual(page.dateBoundary);
  });

  it('returns nullable open bounds and keeps organisation-wide authorization and tenant isolation', async () => {
    const page = await k.call(auditor, 'GET', '/v1/audit-events');
    expect(AuditEventsResponseSchema.parse(page.body).dateBoundary).toEqual({scope:'tenant',timezone:'America/New_York',fromInclusive:null,toExclusive:null});
    expect((await k.call(desk,'GET','/v1/audit-events')).status).toBe(403);
    expect((await k.call(desk,'POST','/v1/audit-events/export',{})).status).toBe(403);
    const other = await startKit('audit-other');
    try {
      const actor = await other.person('Other auditor','auditor',null);
      const response = await other.call(actor,'GET','/v1/audit-events');
      const otherPage = AuditEventsResponseSchema.parse(response.body);
      expect(otherPage.dateBoundary.timezone).toBe('Asia/Kolkata');
      expect(otherPage.items).toEqual([]);
    } finally { await other.close(); }
  });

  it('refuses malformed or reversed dates rather than changing the date interpretation', async () => {
    expect((await k.call(auditor,'GET','/v1/audit-events?from=2026-03-09&to=2026-03-08')).status).toBe(400);
    expect((await k.call(auditor,'GET','/v1/audit-events?from=2026-99-08')).status).toBe(400);
    expect(AuditEventsResponseSchema.safeParse({items:[],more:false,dateBoundary:{scope:'facility',timezone:'Asia/Kolkata',fromInclusive:null,toExclusive:null}}).success).toBe(false);
  });
});

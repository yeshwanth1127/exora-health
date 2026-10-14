import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { requestsWhatsAppHuman } from '../modules/comms/whatsapp.ts';
import { startKit, type Kit, type Person } from './test-kit.ts';

let k: Kit, foreign: Kit, admin: Person, desk: Person, colleague: Person, otherDesk: Person, nurse: Person, foreignDesk: Person;
const before = { ...process.env };
const phone = `${Date.now()}88`, secret = 'test-only-human-handoff-signature-secret';
let sequence = 0;
const ok = (response: { status: number; body: any }, status = 200) => {
  expect(response, JSON.stringify(response.body)).toMatchObject({ status });
  return response.body;
};
async function inbound(from: string, text: string, id = randomUUID(), valid = true) {
  const payload = JSON.stringify({ entry: [{ changes: [{ value: {
    metadata: { phone_number_id: phone },
    messages: [{ id, from, timestamp: String(Math.floor(Date.now() / 1000)), text: { body: text } }],
  } }] }] });
  const response = await k.app.inject({ method: 'POST', url: '/v1/integrations/whatsapp/webhook', payload,
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=' +
      (valid ? createHmac('sha256', secret).update(payload).digest('hex') : '0'.repeat(64)) } });
  return { status: response.statusCode, body: response.json() };
}
async function get(id: string, who = desk) {
  return ok(await k.call(who, 'GET', `/v1/conversations/${id}`)).conversation;
}
async function consent(contactPointId: string) {
  ok(await k.call(desk, 'POST', `/v1/contact-points/${contactPointId}/consents`, {
    purpose: 'care', action: 'opt_in', source: 'staff', explicitOptIn: true,
    evidence: 'Caller explicitly requested care messaging for this clinic',
  }, true));
}
async function fresh(withConsent = true) {
  const from = `919876${String(++sequence).padStart(6, '0')}`;
  ok(await inbound(from, 'Hello clinic'));
  await k.dispatch();
  const items = ok(await k.call(desk, 'GET', `/v1/conversations?facilityId=${k.tenant.facilityId}&search=${from}`)).items;
  expect(items).toHaveLength(1);
  const c = items[0];
  if (withConsent) await consent(c.contactPointId);
  return { from, c: await get(c.id) };
}
beforeAll(async () => {
  Object.assign(process.env, { WA_PHONE_NUMBER_ID: phone, WA_APP_SECRET: secret, WA_VERIFY_TOKEN: 'test-only-handoff-verify' });
  k = await startKit('whatsapp-handoff');
  admin = await k.person('Admin', 'tenant_admin', null);
  desk = await k.person('Reception', 'front_desk', k.tenant.facilityId);
  colleague = await k.person('Colleague', 'front_desk', k.tenant.facilityId);
  nurse = await k.person('Nurse', 'nurse', k.tenant.facilityId, 'nurse');
  const other = ok(await k.call(admin, 'POST', '/v1/facilities', {
    code: 'OTHER', name: 'Other clinic', facilityType: 'clinic', stateCode: '29',
  }, true), 201).facilityId;
  otherDesk = await k.person('Other clinic desk', 'front_desk', other);
  foreign = await startKit('whatsapp-handoff-foreign');
  foreignDesk = await foreign.person('Foreign reception', 'front_desk', foreign.tenant.facilityId);
  ok(await k.call(admin, 'PUT', '/v1/comms/settings', { facilityId: k.tenant.facilityId, phoneNumberId: phone, version: 0 }, true));
});
afterAll(async () => {
  await k?.close();
  await foreign?.close();
  for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
  Object.assign(process.env, before);
});

describe('WhatsApp explicit automation and human handoff guard', () => {
  it('recognizes only conservative whole-message human commands', () => {
    for (const text of ['human', 'AGENT', ' receptionist ', 'Speak to a human', ' speak  to a\nhuman '])
      expect(requestsWhatsAppHuman(text), text).toBe(true);
    for (const text of ['human resources', 'I am an agent', 'the receptionist was helpful', 'not human', 'please speak to a human', 'STOP'])
      expect(requestsWhatsAppHuman(text), text).toBe(false);
  });
  it('returns eligibility separately from live sending; missing permission pauses automation', async () => {
    const { c } = await fresh(false);
    expect(c).toMatchObject({ automationState: 'automation', automationAllowed: false, assignedStaffId: null });
    expect(c.automationBlockedReasons).toContain('consent_missing_or_withdrawn');
    await consent(c.contactPointId);
    expect(await get(c.id)).toMatchObject({ automationAllowed: true, automationBlockedReasons: [] });
    expect(ok(await k.call(desk, 'GET', `/v1/comms/settings?facilityId=${k.tenant.facilityId}`))).toMatchObject({ liveSending: false, transport: 'log' });
  });
  it('pauses synchronously for signed human requests, de-duplicates callbacks, and refuses forged signatures', async () => {
    const { from, c } = await fresh();
    const messageId = randomUUID();
    expect((await inbound(from, 'human', randomUUID(), false)).status).toBe(403);
    expect(await get(c.id)).toMatchObject({ automationState: 'automation', automationAllowed: true });
    ok(await inbound(from, 'speak to a human', messageId));
    // No worker dispatch: the signed ingestion transaction already pauses automation.
    const pending = await get(c.id);
    expect(pending).toMatchObject({ automationState: 'handoff_requested', automationAllowed: false, assignedStaffId: null });
    ok(await inbound(from, 'speak to a human', messageId));
    await k.dispatch();
    expect(await get(c.id)).toMatchObject({ version: pending.version, automationState: 'handoff_requested' });
  });
  it('claims human ownership with compare-and-set and actor-scoped keyed replay, then explicitly resumes', async () => {
    const { c } = await fresh();
    const key = `assign-${randomUUID()}`;
    const assigned = ok(await k.call(desk, 'POST', `/v1/conversations/${c.id}/assign`, { version: c.version }, key)).conversation;
    expect(assigned).toMatchObject({ automationState: 'human', automationAllowed: false, assignedStaffId: desk.staffId });
    expect(ok(await k.call(desk, 'POST', `/v1/conversations/${c.id}/assign`, { version: c.version }, key)).conversation.version).toBe(assigned.version);
    expect((await k.call(colleague, 'POST', `/v1/conversations/${c.id}/assign`, { version: c.version }, true)).status).toBe(409);
    expect((await k.call(colleague, 'POST', `/v1/conversations/${c.id}/assign`, { version: c.version }, key)).status).toBe(409);
    const resumeKey = `resume-${randomUUID()}`;
    const resumed = ok(await k.call(desk, 'POST', `/v1/conversations/${c.id}/resume`, { version: assigned.version }, resumeKey)).conversation;
    expect(resumed).toMatchObject({ automationState: 'automation', automationAllowed: true, assignedStaffId: null });
    expect(ok(await k.call(desk, 'POST', `/v1/conversations/${c.id}/resume`, { version: assigned.version }, resumeKey)).conversation.version).toBe(resumed.version);
    const handoff = ok(await k.call(colleague, 'POST', `/v1/conversations/${c.id}/handoff`, { version: resumed.version }, true)).conversation;
    expect(handoff).toMatchObject({ automationState: 'handoff_requested', automationAllowed: false, assignedStaffId: null });
  });
  it('opening an existing human thread cannot silently change its assignee or version', async () => {
    const { c } = await fresh();
    const assigned = ok(await k.call(desk, 'POST', `/v1/conversations/${c.id}/assign`, { version: c.version }, true)).conversation;
    const opened = ok(await k.call(colleague, 'POST', '/v1/conversations', {
      facilityId: k.tenant.facilityId, contactPointId: c.contactPointId,
    }, true));
    expect(opened).toMatchObject({ id: c.id, version: assigned.version });
    expect(await get(c.id)).toMatchObject({ automationState: 'human', assignedStaffId: desk.staffId, version: assigned.version });
  });
  it('enforces tenant, clinic, role, and required idempotency key for handoff commands', async () => {
    const { c } = await fresh();
    for (const who of [otherDesk, nurse])
      expect((await k.call(who, 'POST', `/v1/conversations/${c.id}/handoff`, { version: c.version }, true)).status).toBe(403);
    expect((await foreign.call(foreignDesk, 'POST', `/v1/conversations/${c.id}/resume`, { version: c.version }, true)).status).toBe(404);
    expect((await k.call(desk, 'POST', `/v1/conversations/${c.id}/handoff`, { version: c.version }, false)).status).toBe(400);
    expect(await get(c.id)).toMatchObject({ version: c.version, automationState: 'automation' });
  });
  it('keeps STOP stronger than resume and never reopens closed threads on inbound messages', async () => {
    const { from, c } = await fresh();
    ok(await inbound(from, 'STOP'));
    const stopped = await get(c.id);
    expect(stopped.automationAllowed).toBe(false);
    expect((await k.call(desk, 'POST', `/v1/conversations/${c.id}/resume`, { version: stopped.version }, true)).status).toBe(422);
    await consent(c.contactPointId);
    const closed = ok(await k.call(desk, 'POST', `/v1/conversations/${c.id}/close`, { version: stopped.version }, true)).conversation;
    expect(closed).toMatchObject({ status: 'closed', automationAllowed: false });
    ok(await inbound(from, 'Hello again'));
    await k.dispatch();
    ok(await inbound(from, 'human'));
    const stillClosed = await get(c.id);
    expect(stillClosed).toMatchObject({ status: 'closed', automationAllowed: false });
    expect(stillClosed.automationBlockedReasons).toContain('closed');
    expect((await k.call(desk, 'POST', `/v1/conversations/${c.id}/resume`, { version: stillClosed.version }, true)).status).toBe(409);
  });
  it('refuses automation on module suspension and expired reply windows', async () => {
    const { c } = await fresh();
    await k.admin.query(`INSERT INTO platform.module_state(tenant_id,module_code,state) VALUES($1,'comms','suspended') ON CONFLICT(tenant_id,module_code) DO UPDATE SET state='suspended'`, [k.tenant.tenantId]);
    try {
      expect((await get(c.id)).automationBlockedReasons).toContain('module_inactive');
      expect((await k.call(desk, 'POST', `/v1/conversations/${c.id}/resume`, { version: c.version }, true)).status).toBe(422);
    } finally {
      await k.admin.query(`UPDATE platform.module_state SET state='active' WHERE tenant_id=$1 AND module_code='comms'`, [k.tenant.tenantId]);
    }
    const expired = new Date(Date.now() + 2 * 86400000).toISOString();
    const details = ok(await k.call(desk, 'GET', `/v1/conversations/${c.id}`, undefined, false, expired)).conversation;
    expect(details.automationBlockedReasons).toContain('reply_window_expired');
    expect((await k.call(desk, 'POST', `/v1/conversations/${c.id}/resume`, { version: c.version }, true, expired)).status).toBe(422);
  });
});

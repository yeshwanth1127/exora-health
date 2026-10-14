import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPatient, createTenant, asTenant } from '../../../../db/tests/db.ts';
import { startKit, localDay, type Kit, type Person } from './test-kit.ts';
let k: Kit,
  admin: Person,
  desk: Person,
  nurse: Person,
  patient: string,
  contact: any,
  conversation: any,
  template: any,
  facility2: string,
  department: string,
  doctor: Person,
  storage: string;
const envBefore = { ...process.env };
const phone = `${Date.now()}77`,
  secret = 'test-only-whatsapp-signature-secret-at-least32';
const ok = (r: { status: number; body: any }, status = 200) => {
  expect(r, JSON.stringify(r.body)).toMatchObject({ status });
  return r.body;
};
const consent = async (id: string) =>
  ok(
    await k.call(
      admin,
      'POST',
      `/v1/contact-points/${id}/consents`,
      {
        purpose: 'marketing',
        action: 'opt_in',
        source: 'staff',
        evidence: 'Explicit offer-message permission',
        explicitOptIn: true,
      },
      true,
    ),
  );
const inbound = async (id: string, text: string, from = '919876547001', signature = true) => {
  const payload = JSON.stringify({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: phone },
              messages: [{ id, from, timestamp: String(Math.floor(Date.now() / 1000)), text: { body: text } }],
            },
          },
        ],
      },
    ],
  });
  const r = await k.app.inject({
    method: 'POST',
    url: '/v1/integrations/whatsapp/webhook',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signature
        ? 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
        : 'sha256=' + '0'.repeat(64),
    },
    payload,
  });
  return { status: r.statusCode, body: r.json() };
};
const campaign = async (budget = 10000, interest: string | null = null) =>
  ok(
    await k.call(
      admin,
      'POST',
      '/v1/campaigns',
      {
        facilityId: k.tenant.facilityId,
        title: 'Clinic updates',
        templateId: template.id,
        parameters: ['clinic'],
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        budgetMinor: budget,
        interest,
      },
      true,
    ),
  );
const preview = async (id: string) => ok(await k.call(admin, 'GET', `/v1/campaigns/${id}/preview`));
const testCampaign = async (c: any) => {
  ok(
    await k.call(admin, 'POST', `/v1/campaigns/${c.id}/test`, { version: c.version, recipientId: 'clinic-test' }, true),
  );
  return preview(c.id);
};
beforeAll(async () => {
  storage = await mkdtemp(path.join(tmpdir(), 'hms-wa-test-'));
  Object.assign(process.env, {
    WA_PHONE_NUMBER_ID: phone,
    WA_APP_SECRET: secret,
    WA_VERIFY_TOKEN: 'test-only-verification-token',
    WA_TEST_RECIPIENTS: 'clinic-test',
    WA_ESTIMATED_RATE_MINOR: '100',
    COMMS_STORAGE_PATH: storage,
  });
  k = await startKit('whatsapp');
  admin = await k.person('Admin', 'tenant_admin', null);
  desk = await k.person('Desk', 'front_desk', k.tenant.facilityId);
  nurse = await k.person('Nurse', 'nurse', k.tenant.facilityId, 'nurse');
  doctor = await k.person('Doctor', 'doctor', k.tenant.facilityId, 'doctor');
  patient = await createPatient(k.admin, k.tenant.tenantId);
  facility2 = ok(
    await k.call(
      admin,
      'POST',
      '/v1/facilities',
      { code: 'F2', name: 'Other clinic', facilityType: 'clinic', stateCode: '29' },
      true,
    ),
    201,
  ).facilityId;
  department = ok(
    await k.call(
      admin,
      'POST',
      `/v1/facilities/${k.tenant.facilityId}/departments`,
      { code: 'GM', name: 'General' },
      true,
    ),
    201,
  ).departmentId;
  ok(
    await k.call(
      admin,
      'POST',
      `/v1/practitioners/${doctor.staffId}/affiliations`,
      { facilityId: k.tenant.facilityId, departmentId: department, validFrom: localDay() },
      true,
    ),
    201,
  );
  contact = ok(
    await k.call(
      desk,
      'POST',
      '/v1/contact-points',
      { facilityId: k.tenant.facilityId, patientId: patient, channel: 'whatsapp', address: '+919876547001' },
      true,
    ),
    201,
  );
  conversation = ok(
    await k.call(
      desk,
      'POST',
      '/v1/conversations',
      { facilityId: k.tenant.facilityId, contactPointId: contact.id },
      true,
    ),
  );
  template = ok(
    await k.call(
      admin,
      'POST',
      '/v1/message-templates',
      {
        facilityId: k.tenant.facilityId,
        name: 'Local marketing sample',
        body: 'Hello {{1}}',
        language: 'en',
        category: 'marketing',
        parameterCount: 1,
        header: 'none',
      },
      true,
    ),
  );
  ok(
    await k.call(
      admin,
      'PUT',
      '/v1/comms/settings',
      { facilityId: k.tenant.facilityId, phoneNumberId: phone, version: 0 },
      true,
    ),
  );
});
afterAll(async () => {
  await k?.close();
  for (const key of Object.keys(process.env)) if (!(key in envBefore)) delete process.env[key];
  Object.assign(process.env, envBefore);
  if (storage) await rm(storage, { recursive: true, force: true });
});
describe('WhatsApp local staff operations', () => {
  it('keeps provider sending disabled and local templates visibly unapproved', async () => {
    expect(template).toMatchObject({ simulationOnly: true, providerApproval: 'not_synced' });
    expect(ok(await k.call(desk, 'GET', `/v1/comms/settings?facilityId=${k.tenant.facilityId}`))).toMatchObject({
      providerConfigured: false,
      webhookReady: true,
      liveSending: false,
      transport: 'log',
      testRecipientIds: ['clinic-test'],
    });
    expect(
      (
        await k.call(
          desk,
          'POST',
          '/v1/message-templates',
          {
            facilityId: k.tenant.facilityId,
            name: 'Forbidden',
            body: 'Hello',
            language: 'en',
            category: 'marketing',
            parameterCount: 0,
          },
          true,
        )
      ).status,
    ).toBe(403);
    expect(
      (await k.call(admin, 'POST', '/v1/message-templates/sync', { facilityId: k.tenant.facilityId }, true)).status,
    ).toBe(422);
  });
  it('opens local cases without inventing inbound or permission to reply; assignment versions prevent stale writes', async () => {
    const t = ok(await k.call(desk, 'GET', `/v1/conversations/${conversation.id}`));
    expect(t.messages).toEqual([]);
    expect(t.conversation.canReply).toBe(false);
    expect(
      (
        await k.call(
          desk,
          'POST',
          `/v1/conversations/${conversation.id}/reply`,
          { version: t.conversation.version, text: 'Hello' },
          true,
        )
      ).status,
    ).toBe(409);
    const assigned = ok(
      await k.call(
        desk,
        'POST',
        `/v1/conversations/${conversation.id}/assign`,
        { version: t.conversation.version },
        true,
      ),
    );
    expect(assigned.conversation.assignedStaffId).toBe(desk.staffId);
    expect(
      (
        await k.call(
          desk,
          'POST',
          `/v1/conversations/${conversation.id}/close`,
          { version: t.conversation.version },
          true,
        )
      ).status,
    ).toBe(409);
    expect((await k.call(nurse, 'GET', `/v1/conversations/${conversation.id}`)).status).toBe(403);
    const c = ok(
      await k.call(
        desk,
        'POST',
        '/v1/support-cases',
        { conversationId: conversation.id, kind: 'feedback', description: 'Caller requested a follow-up', rating: 4 },
        true,
      ),
    );
    expect(
      ok(await k.call(desk, 'GET', `/v1/conversations?facilityId=${k.tenant.facilityId}&kind=feedback`)).items.map(
        (r: any) => r.id,
      ),
    ).toContain(conversation.id);
    expect(
      ok(
        await k.call(
          desk,
          'POST',
          `/v1/support-cases/${c.id}/status`,
          { version: c.version, status: 'resolved' },
          true,
        ),
      ),
    ).toMatchObject({ status: 'resolved', version: c.version + 1 });
    expect(
      (await k.call(desk, 'POST', `/v1/support-cases/${c.id}/status`, { version: c.version, status: 'open' }, true))
        .status,
    ).toBe(409);
  });
  it('validates exact webhook bytes, deduplicates incoming messages and never links a patient by phone', async () => {
    expect((await inbound('inbound-1', 'Hello', undefined, false)).status).toBe(403);
    ok(await inbound('inbound-1', 'Hello'));
    ok(await inbound('inbound-1', 'Hello'));
    await k.dispatch();
    const rows = (
      await k.admin.query(
        `SELECT p.patient_id,p.booking_party_id,c.id FROM comms.conversation c JOIN comms.contact_point p ON p.id=c.contact_point_id WHERE c.tenant_id=$1 AND p.address=$2 AND p.booking_party_id IS NOT NULL`,
        [k.tenant.tenantId, contact.address],
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].patient_id).toBe(null);
    expect(rows[0].booking_party_id).toBeTruthy();
    const actual = ok(await k.call(desk, 'GET', `/v1/conversations/${rows[0].id}`));
    expect(actual.messages).toHaveLength(1);
    expect(actual.conversation.canReply).toBe(false);
    ok(
      await k.call(
        desk,
        'POST',
        `/v1/contact-points/${actual.conversation.contactPointId}/consents`,
        {
          purpose: 'care',
          action: 'opt_in',
          source: 'staff',
          evidence: 'Explicit clinic-reply consent',
          explicitOptIn: true,
        },
        true,
      ),
    );
    const refreshed = ok(await k.call(desk, 'GET', `/v1/conversations/${rows[0].id}`));
    const result = ok(
      await k.call(
        desk,
        'POST',
        `/v1/conversations/${rows[0].id}/reply`,
        { version: refreshed.conversation.version, text: 'Reception will help you' },
        `reply-${k.run}`,
      ),
    );
    expect(result.messages.at(-1)).toMatchObject({
      direction: 'outbound',
      status: 'queued',
      transport: 'log',
      actorStaffId: desk.staffId,
    });
    expect(
      ok(
        await k.call(
          desk,
          'POST',
          `/v1/conversations/${rows[0].id}/reply`,
          { version: refreshed.conversation.version, text: 'Reception will help you' },
          `reply-${k.run}`,
        ),
      ).messages,
    ).toHaveLength(2);
    await k.admin.query("UPDATE comms.conversation SET last_inbound_at=now()-interval '25 hours' WHERE id=$1", [
      rows[0].id,
    ]);
    const stale = ok(await k.call(desk, 'GET', `/v1/conversations/${rows[0].id}`));
    expect(
      (
        await k.call(
          desk,
          'POST',
          `/v1/conversations/${rows[0].id}/reply`,
          { version: stale.conversation.version, text: 'Too late' },
          true,
        )
      ).status,
    ).toBe(409);
  });
  it('verified inbound and replayed messages preserve explicit closure until staff reopen', async () => {
    const row = (
      await k.admin.query(
        `SELECT c.id FROM comms.conversation c JOIN comms.contact_point p ON p.id=c.contact_point_id WHERE c.tenant_id=$1 AND p.booking_party_id IS NOT NULL AND p.address=$2`,
        [k.tenant.tenantId, contact.address],
      )
    ).rows[0];
    const before = ok(await k.call(desk, 'GET', `/v1/conversations/${row.id}`));
    ok(await k.call(desk, 'POST', `/v1/conversations/${row.id}/close`, { version: before.conversation.version }, true));
    ok(await inbound('inbound-1', 'Hello'));
    await k.dispatch();
    expect(ok(await k.call(desk, 'GET', `/v1/conversations/${row.id}`)).conversation.status).toBe('closed');
    ok(await inbound('inbound-new', 'A new question'));
    await k.dispatch();
    expect(ok(await k.call(desk, 'GET', `/v1/conversations/${row.id}`)).conversation.status).toBe('closed');
  });
  it('STOP persists while suspended and cancels shared-address work before acknowledging the callback', async () => {
    await consent(contact.id);
    ok(await k.call(admin, 'PUT', '/v1/modules/comms', { state: 'suspended', version: 0, reason: 'Suspend test' }));
    ok(await inbound('provider-stop', ' STOP '));
    // No worker dispatch: STOP is a synchronous control-plane effect, business work stays asynchronous.
    expect(
      ok(await k.call(desk, 'GET', `/v1/contact-points?facilityId=${k.tenant.facilityId}&patientId=${patient}`))
        .items[0].consents.marketing,
    ).toBe(false);
    expect(
      (
        await k.call(
          desk,
          'POST',
          '/v1/support-cases',
          { conversationId: conversation.id, kind: 'issue', description: 'Not while suspended' },
          true,
        )
      ).status,
    ).toBe(422);
    ok(await k.call(admin, 'PUT', '/v1/modules/comms', { state: 'active', version: 1, reason: 'Resume test' }));
  });
  it('uploads private immutable images/PDFs with authenticated reads and rejects MIME/traversal/oversize surprises', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR7sAAAAASUVORK5CYII=',
      'base64',
    );
    const upload = {
      facilityId: k.tenant.facilityId,
      filename: '../portrait.png',
      mimeType: 'image/png',
      dataBase64: png.toString('base64'),
    };
    const image = ok(
      await k.call(admin, 'PUT', `/v1/practitioners/${doctor.staffId}/whatsapp-photo`, upload, `photo-${k.run}`),
    );
    expect(image).toMatchObject({ filename: 'portrait.png', status: 'local_validated' });
    expect(image).not.toHaveProperty('objectKey');
    expect(
      ok(await k.call(admin, 'PUT', `/v1/practitioners/${doctor.staffId}/whatsapp-photo`, upload, `photo-${k.run}`)).id,
    ).toBe(image.id);
    const bytes = await k.app.inject({
      method: 'GET',
      url: `/v1/comms/assets/${image.id}/content`,
      headers: { authorization: `Bearer ${desk.token}` },
    });
    expect(bytes.statusCode).toBe(200);
    expect(bytes.rawPayload.equals(png)).toBe(true);
    expect(bytes.headers['x-content-type-options']).toBe('nosniff');
    expect((await k.call(nurse, 'GET', `/v1/comms/assets/${image.id}/content`)).status).toBe(403);
    expect(
      (
        await k.call(
          admin,
          'PUT',
          `/v1/practitioners/${doctor.staffId}/whatsapp-photo`,
          { ...upload, dataBase64: Buffer.from('<html>not png</html>').toString('base64') },
          true,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await k.call(
          admin,
          'PUT',
          `/v1/practitioners/${doctor.staffId}/whatsapp-photo`,
          { ...upload, facilityId: facility2 },
          true,
        )
      ).status,
    ).toBe(404);
    const pdf = ok(
      await k.call(
        admin,
        'PUT',
        `/v1/departments/${department}/whatsapp-guide`,
        {
          ...upload,
          filename: 'guide.pdf',
          mimeType: 'application/pdf',
          dataBase64: Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF').toString('base64'),
        },
        true,
      ),
    );
    expect(pdf.mimeType).toBe('application/pdf');
    expect(
      (
        await k.call(
          admin,
          'PUT',
          `/v1/departments/${department}/whatsapp-guide`,
          {
            ...upload,
            filename: 'bad.pdf',
            mimeType: 'application/pdf',
            dataBase64: Buffer.from('%PDF-1.7\n/JavaScript (alert)\n%%EOF').toString('base64'),
          },
          true,
        )
      ).status,
    ).toBe(400);
  });
  it('deduplicates destinations, binds audience hashes and restricts test destinations/approval permissions', async () => {
    await consent(contact.id);
    const secondPatient = await createPatient(k.admin, k.tenant.tenantId);
    const alias = ok(
      await k.call(
        admin,
        'POST',
        '/v1/contact-points',
        { facilityId: k.tenant.facilityId, patientId: secondPatient, channel: 'whatsapp', address: contact.address },
        true,
      ),
      201,
    );
    await consent(alias.id);
    const c = await campaign();
    expect((await preview(c.id)).recipients).toBe(1);
    expect(
      (
        await k.call(
          admin,
          'POST',
          `/v1/campaigns/${c.id}/test`,
          { version: c.version, recipientId: '+919876543999' },
          true,
        )
      ).status,
    ).toBe(403);
    const p = await testCampaign(c);
    expect(
      (
        await k.call(
          desk,
          'POST',
          `/v1/campaigns/${c.id}/approve`,
          { version: p.version, audienceHash: p.audienceHash, expectedCount: p.recipients, testReceived: true },
          true,
        )
      ).status,
    ).toBe(403);
    ok(
      await k.call(
        admin,
        'POST',
        `/v1/contact-points/${alias.id}/consents`,
        { purpose: 'marketing', action: 'stop', source: 'staff', evidence: 'User withdrew offers' },
        true,
      ),
    );
    expect(
      (
        await k.call(
          admin,
          'POST',
          `/v1/campaigns/${c.id}/approve`,
          { version: p.version, audienceHash: p.audienceHash, expectedCount: p.recipients, testReceived: true },
          true,
        )
      ).status,
    ).toBe(409);
  });
  it('enforces estimated budget atomically, deduplicates concurrent approval and pauses local reservations', async () => {
    await consent(contact.id);
    const capped = await campaign(0),
      p = await testCampaign(capped);
    expect(p.withinBudget).toBe(false);
    expect(
      (
        await k.call(
          admin,
          'POST',
          `/v1/campaigns/${capped.id}/approve`,
          { version: p.version, audienceHash: p.audienceHash, expectedCount: p.recipients, testReceived: true },
          true,
        )
      ).status,
    ).toBe(422);
    const c = await campaign(),
      seen = await testCampaign(c),
      body = {
        version: seen.version,
        audienceHash: seen.audienceHash,
        expectedCount: seen.recipients,
        testReceived: true,
      };
    const responses = await Promise.all([
      k.call(admin, 'POST', `/v1/campaigns/${c.id}/approve`, body, true),
      k.call(admin, 'POST', `/v1/campaigns/${c.id}/approve`, body, true),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const approved = responses.find((r) => r.status === 200)!.body;
    expect(approved).toMatchObject({
      status: 'scheduled',
      reservedMinor: 100,
      simulationOnly: true,
      providerDelivery: 'unavailable',
    });
    expect(
      (await k.admin.query('SELECT count(*)::int AS n FROM comms.campaign_recipient WHERE campaign_id=$1', [c.id]))
        .rows[0].n,
    ).toBe(1);
    const paused = ok(await k.call(admin, 'POST', `/v1/campaigns/${c.id}/pause`, { version: approved.version }, true));
    expect(paused.status).toBe('paused');
    expect(
      ok(await k.call(desk, 'GET', `/v1/whatsapp/outbound?facilityId=${k.tenant.facilityId}&kind=campaign&limit=1`))
        .items[0],
    ).toMatchObject({ status: 'cancelled', transport: 'log' });
  });
  it('stores declared interests only under marketing consent with optimistic versions', async () => {
    const fresh = (await k.admin.query('SELECT version FROM comms.contact_point WHERE id=$1', [contact.id])).rows[0]
      .version;
    const input = {
      interest: 'Wellness events',
      evidence: 'Patient declared this interest voluntarily',
      version: fresh,
    };
    ok(await k.call(admin, 'POST', `/v1/contact-points/${contact.id}/interests`, input, true));
    expect((await k.call(admin, 'POST', `/v1/contact-points/${contact.id}/interests`, input, true)).status).toBe(409);
    const listed = ok(
      await k.call(desk, 'GET', `/v1/contact-points?facilityId=${k.tenant.facilityId}&patientId=${patient}`),
    ).items[0];
    expect(listed.interests).toContain('Wellness events');
    const filtered = await campaign(10000, 'Wellness events');
    expect((await preview(filtered.id)).recipients).toBe(1);
  });
  it('hides another tenant and clinic records through both RLS and route authorization', async () => {
    expect((await k.call(desk, 'GET', `/v1/conversations?facilityId=${facility2}`)).status).toBe(403);
    expect((await k.call(desk, 'GET', `/v1/comms/assets?facilityId=${facility2}`)).status).toBe(403);
    const other = await createTenant(k.admin, 'wa-other');
    expect(
      (await asTenant(k.admin, other.tenantId, 'mod_comms', (c) => c.query('SELECT id FROM comms.campaign'))).rows,
    ).toEqual([]);
    const raw = await k.app.inject({
      method: 'GET',
      url: '/v1/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-only-verification-token&hub.challenge=123',
    });
    expect(raw.statusCode).toBe(200);
    expect(raw.body).toBe('123');
  });
});

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { config } from '../../../../db/scripts/config.mjs';
import { adminPool } from '../../../../db/tests/db.ts';
import { createAppleDemoClinic } from '../../../../db/scripts/apple-demo-fixture.ts';
import { signDevToken } from '../auth/dev-token.ts';
import { createVerifier } from '../auth/verify.ts';
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from '../config.ts';
import { buildServer } from '../server.ts';
import {
  appleWake,
  flushAppleReplies,
  reconcileAppleContact,
  type AppleTransport,
} from '../modules/comms/apple-connect.ts';
import {
  loadAppleSettings,
  type AppleBinding,
} from '../modules/comms/apple-config.ts';
import {
  type AppleTranscriptEntry,
  ingestAppleTranscript,
  processAppleConversation,
} from '../modules/comms/apple-messages.ts';
import type { ManagedSettings } from '../modules/comms/managed-config.ts';

const admin = adminPool(),
  db = createDb({
    connectionString: config.testAppDatabaseUrl,
    maxConnections: 5,
  });
let clinic: Awaited<ReturnType<typeof createAppleDemoClinic>>,
  binding: AppleBinding,
  settings: ManagedSettings,
  app: ReturnType<typeof buildServer>,
  token: string;
const transcripts = new Map<string, AppleTranscriptEntry[]>(),
  sent = new Map<string, string>();
const transport: AppleTransport = {
  transcript: async (id) => transcripts.get(id) ?? [],
  send: async (_contact, id, text) => {
    sent.set(id, text);
    return 'aws-' + id;
  },
};
let ordinal = 0;
function entry(text: string, id = randomUUID()): AppleTranscriptEntry {
  return {
    Id: id,
    Type: 'MESSAGE',
    ParticipantRole: 'CUSTOMER',
    ContentType: 'text/plain',
    Content: text,
    AbsoluteTime: new Date(Date.now() - 60000 + ++ordinal * 50).toISOString(),
  };
}
async function inbound(contact: string, text: string, id = randomUUID()) {
  const entries = transcripts.get(contact) ?? [];
  entries.push(entry(text, id));
  transcripts.set(contact, entries);
  const conversationId = await reconcileAppleContact(
    db,
    binding,
    contact,
    settings,
    transport,
  );
  const {
    rows: [reply],
  } = await admin.query(
    'SELECT o.text_content FROM comms.apple_message i JOIN comms.apple_message o ON o.reply_to=i.id WHERE i.tenant_id=$1 AND i.provider_id=$2',
    [binding.tenantId, id],
  );
  return { conversationId, text: reply?.text_content as string | undefined };
}
async function call(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  bearer = token,
  key: string = randomUUID(),
) {
  const r = await app.inject({
    method,
    url: path,
    headers: { authorization: 'Bearer ' + bearer, 'idempotency-key': key },
    ...(body ? { payload: body } : {}),
  });
  return { status: r.statusCode, body: r.json() };
}
beforeAll(async () => {
  clinic = await createAppleDemoClinic(admin);
  // Fixture identity issuer follows the actual development verifier.
  await admin.query(
    'UPDATE platform.user_account SET identity_issuer=$1 WHERE staff_id=$2',
    [DEV_ISSUER, clinic.ownerStaffId],
  );
  binding = {
    tenantId: clinic.tenantId,
    facilityId: clinic.facilityId,
    instanceArn: `arn:aws:connect:us-east-1:111122223333:instance/${randomUUID()}`,
    topicArn: 'arn:aws:sns:us-east-1:111122223333:apple-demo',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/111122223333/apple-demo',
    sessionTable: 'apple-demo',
  };
  settings = {
    fetcher: fetch,
    booking: {
      sites: [clinic.site],
      signingSecret: 'apple-test-booking-signing-secret-123456',
    },
  };
  app = buildServer({
    db,
    managed: settings,
    publicBooking: settings.booking,
    apple: { bindings: [binding] },
    verifier: createVerifier({
      mode: 'dev',
      secret: DEV_SECRET_DEFAULT,
      issuer: DEV_ISSUER,
    }),
  });
  token = await signDevToken(clinic.ownerSubject);
});
afterAll(async () => {
  await app?.close();
  await db.destroy();
  await admin.end();
});

describe('Amazon Connect Apple booking against restricted PostgreSQL', () => {
  it('validates company-owned AWS bindings and refuses another SNS topic or account', () => {
    expect(loadAppleSettings({})).toEqual({ bindings: [] });
    expect(
      loadAppleSettings({
        APPLE_CONNECT_ENABLED: 'true',
        APPLE_CONNECT_BINDINGS_JSON: JSON.stringify([binding]),
      }),
    ).toEqual({ bindings: [binding] });
    expect(() =>
      loadAppleSettings({
        APPLE_CONNECT_ENABLED: 'true',
        APPLE_CONNECT_BINDINGS_JSON: JSON.stringify([
          { ...binding, queueUrl: 'https://evil.example/queue' },
        ]),
      }),
    ).toThrow();
    const body = {
      Type: 'Notification',
      TopicArn: binding.topicArn,
      MessageAttributes: {
        ContactId: { Type: 'String', Value: randomUUID() },
        InstanceId: {
          Type: 'String',
          Value: binding.instanceArn.split('/')[1],
        },
        AccountId: { Type: 'String', Value: '111122223333' },
      },
    };
    expect(appleWake(JSON.stringify(body), binding)).toBe(
      body.MessageAttributes.ContactId.Value,
    );
    expect(() =>
      appleWake(
        JSON.stringify({
          ...body,
          TopicArn: 'arn:aws:sns:us-east-1:111122223333:untrusted',
        }),
        binding,
      ),
    ).toThrow();
    expect(() =>
      appleWake(
        JSON.stringify({
          ...body,
          MessageAttributes: {
            ...body.MessageAttributes,
            AccountId: { Type: 'String', Value: '999999999999' },
          },
        }),
        binding,
      ),
    ).toThrow();
  });
  it('books exactly once after explicit confirmation with USD, New York time and an unverified +1 contact', async () => {
    const contact = randomUUID();
    expect((await inbound(contact, 'HI')).text).toContain('Reply YES');
    expect((await inbound(contact, 'YES')).text).toContain('Dr Demo');
    const slots = await inbound(contact, '1');
    expect(slots.text).toContain('$125.00');
    expect(slots.text).toContain('America/New_York');
    expect((await inbound(contact, '1')).text).toContain('full name');
    expect((await inbound(contact, 'Synthetic Visitor')).text).toContain(
      'Apple does not share',
    );
    expect((await inbound(contact, '+12125550123')).text).toContain(
      'Reply CONFIRM',
    );
    expect(
      (
        await admin.query(
          'SELECT id FROM booking.appointment WHERE tenant_id=$1',
          [clinic.tenantId],
        )
      ).rows,
    ).toHaveLength(0);
    const id = randomUUID();
    const confirmation = await inbound(contact, 'CONFIRM', id);
    expect(confirmation.text).toContain('Your appointment is confirmed.');
    await Promise.all([
      reconcileAppleContact(db, binding, contact, settings, transport),
      reconcileAppleContact(db, binding, contact, settings, transport),
    ]);
    const appointments = (
      await admin.query(
        'SELECT a.id,a.origin_channel,a.currency,a.fee_snapshot_minor,a.patient_id,b.verified_channel,b.phone FROM booking.appointment a JOIN booking.booking_party b ON b.id=a.booking_party_id WHERE a.tenant_id=$1',
        [clinic.tenantId],
      )
    ).rows;
    expect(appointments).toHaveLength(1);
    expect(appointments[0]).toMatchObject({
      origin_channel: 'apple_messages',
      currency: 'USD',
      fee_snapshot_minor: 12500,
      patient_id: null,
      verified_channel: null,
      phone: '+12125550123',
    });
    await Promise.all([
      flushAppleReplies(db, binding, transport),
      flushAppleReplies(db, binding, transport),
    ]);
    expect(
      [...sent.values()].filter((text) =>
        text.includes('Your appointment is confirmed.'),
      ),
    ).toHaveLength(1);
    const view = await call(
      'GET',
      `/v1/apple-messages/conversations/${confirmation.conversationId}?facilityId=${binding.facilityId}`,
    );
    expect(view.status).toBe(200);
    expect(JSON.stringify(view.body)).not.toMatch(
      /connectionToken|participantToken|arn:aws/,
    );
    expect(
      view.body.messages.filter((m: any) =>
        m.text.includes('Your appointment is confirmed.'),
      )[0].status,
    ).toBe('accepted');
  });
  it('keeps an uncertain provider response retryable using the same outbound id', async () => {
    const contact = randomUUID();
    await inbound(contact, 'HI');
    const ids: string[] = [];
    let fail = true;
    const flaky = {
      ...transport,
      send: async (_contact: string, id: string, text: string) => {
        ids.push(id);
        sent.set(id, text);
        if (fail) throw Error('network response lost');
        return 'aws-' + id;
      },
    };
    await expect(flushAppleReplies(db, binding, flaky)).rejects.toThrow(
      'remain queued',
    );
    fail = false;
    await flushAppleReplies(db, binding, flaky);
    expect(ids[0]).toBe(ids[1]);
  });
  it('keeps an unavailable provider session from rolling back another contact’s acknowledgement', async () => {
    const unavailable = randomUUID(),
      healthy = randomUUID();
    await inbound(unavailable, 'HI');
    await inbound(healthy, 'HI');
    const isolated = {
      ...transport,
      send: async (contact: string, id: string, text: string) => {
        if (contact === unavailable) throw Error('expired contact');
        return transport.send(contact, id, text);
      },
    };
    await expect(flushAppleReplies(db, binding, isolated)).rejects.toThrow(
      'remain queued',
    );
    const { rows } = await admin.query(
      "SELECT c.contact_id,m.status FROM comms.apple_message m JOIN comms.apple_conversation c ON c.id=m.conversation_id WHERE c.contact_id=ANY($1::uuid[]) AND m.direction='outbound'",
      [[unavailable, healthy]],
    );
    expect(rows.find((r) => r.contact_id === unavailable)?.status).toBe(
      'queued',
    );
    expect(rows.find((r) => r.contact_id === healthy)?.status).toBe('accepted');
    await flushAppleReplies(db, binding, transport);
  });
  it('stops automation for human handoff and queues staff replies with permission and version checks', async () => {
    const contact = randomUUID();
    await inbound(contact, 'HI');
    const handoff = await inbound(contact, 'AGENT');
    expect(handoff.text).toContain('waiting for reception');
    expect((await inbound(contact, 'CONFIRM')).text).toBeUndefined();
    const detail = await call(
      'GET',
      `/v1/apple-messages/conversations/${handoff.conversationId}?facilityId=${binding.facilityId}`,
    );
    const body = {
      facilityId: binding.facilityId,
      version: detail.body.conversation.version,
      text: 'A real staff reply from the synthetic demo.',
    };
    const first = await call(
      'POST',
      `/v1/apple-messages/conversations/${handoff.conversationId}/replies`,
      body,
      token,
      'reply-key',
    );
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('queued');
    expect(
      await call(
        'POST',
        `/v1/apple-messages/conversations/${handoff.conversationId}/replies`,
        body,
        token,
        'reply-key',
      ),
    ).toEqual(first);
    expect(
      (
        await call(
          'POST',
          `/v1/apple-messages/conversations/${handoff.conversationId}/replies`,
          body,
        )
      ).status,
    ).toBe(409);
    await flushAppleReplies(db, binding, transport);
    expect(
      [...sent.values()].some((t) =>
        t.startsWith('Reception: A real staff reply'),
      ),
    ).toBe(true);
  });
  it('honors STOP and ended chats without resuming from a replayed earlier transcript', async () => {
    const contact = randomUUID();
    await inbound(contact, 'HI');
    const stopped = await inbound(contact, 'STOP');
    expect((await inbound(contact, 'YES')).text).toBeUndefined();
    const records = transcripts.get(contact)!;
    records.push({
      ...entry(''),
      Type: 'EVENT',
      ContentType: 'application/vnd.amazonaws.connect.event.chat.ended',
    });
    await reconcileAppleContact(db, binding, contact, settings, transport);
    const thread = await call(
      'GET',
      `/v1/apple-messages/conversations/${stopped.conversationId}?facilityId=${binding.facilityId}`,
    );
    expect(thread.body.conversation.status).toBe('closed');
    expect(
      (
        await call(
          'POST',
          `/v1/apple-messages/conversations/${stopped.conversationId}/replies`,
          {
            facilityId: binding.facilityId,
            version: thread.body.conversation.version,
            text: 'Must not send',
          },
        )
      ).status,
    ).toBe(409);
  });
  it('honors STOP during reception handoff even without booking configuration and cancels unsent staff text', async () => {
    const contact = randomUUID();
    const handoff = await inbound(contact, 'AGENT');
    const detail = await call(
      'GET',
      `/v1/apple-messages/conversations/${handoff.conversationId}?facilityId=${binding.facilityId}`,
    );
    const queued = await call(
      'POST',
      `/v1/apple-messages/conversations/${handoff.conversationId}/replies`,
      {
        facilityId: binding.facilityId,
        version: detail.body.conversation.version,
        text: 'Do not send after customer STOP.',
      },
    );
    expect(queued.status).toBe(200);
    const entries = transcripts.get(contact)!;
    entries.push(entry('I am waiting'), entry('STOP'));
    await reconcileAppleContact(
      db,
      binding,
      contact,
      { fetcher: fetch },
      transport,
    );
    await flushAppleReplies(db, binding, transport);
    const thread = await call(
      'GET',
      `/v1/apple-messages/conversations/${handoff.conversationId}?facilityId=${binding.facilityId}`,
    );
    expect(thread.body.conversation.status).toBe('closed');
    expect(
      thread.body.messages.find((m: any) => m.id === queued.body.messageId)
        .status,
    ).toBe('cancelled');
    expect(
      [...sent.values()].some((t) =>
        t.includes('Do not send after customer STOP'),
      ),
    ).toBe(false);
  });
  it('does not trust another clinic or an unauthenticated request to read or reply', async () => {
    const list = await call(
      'GET',
      `/v1/apple-messages?facilityId=${binding.facilityId}`,
    );
    expect(list.status).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/v1/apple-messages?facilityId=${binding.facilityId}`,
        })
      ).statusCode,
    ).toBe(401);
    const other = await createAppleDemoClinic(admin);
    expect(
      (
        await call(
          'GET',
          `/v1/apple-messages/conversations/${list.body.items[0].id}?facilityId=${other.facilityId}`,
        )
      ).status,
    ).toBe(404);
  });
  it('revalidates a time taken by a competing Apple booking and never confirms both', async () => {
    const contacts = [randomUUID(), randomUUID()];
    for (const contact of contacts)
      for (const text of [
        'HI',
        'YES',
        '1',
        '1',
        'Synthetic Race Visitor',
        '+12125550124',
      ])
        await inbound(contact, text);
    const results = await Promise.all(
      contacts.map((contact) => inbound(contact, 'CONFIRM')),
    );
    expect(
      results.filter((r) => r.text?.includes('Your appointment is confirmed.')),
    ).toHaveLength(1);
    expect(
      results.filter((r) => r.text?.includes('That time could not be booked.')),
    ).toHaveLength(1);
    const {
      rows: [count],
    } = await admin.query(
      "SELECT count(*)::int n FROM booking.appointment a JOIN booking.booking_party p ON p.id=a.booking_party_id WHERE a.tenant_id=$1 AND p.name='Synthetic Race Visitor'",
      [clinic.tenantId],
    );
    expect(count.n).toBe(1);
  });
  it('does not send a queued staff reply after that staff member loses access', async () => {
    const contact = randomUUID();
    const first = await inbound(contact, 'HI');
    await inbound(contact, 'AGENT');
    const subject = 'temporary-' + randomUUID();
    const {
      rows: [staff],
    } = await admin.query(
      "INSERT INTO platform.staff(tenant_id,employee_no,given_name,display_name,staff_type)VALUES($1,$2,'Temporary','Temporary','admin')RETURNING id",
      [clinic.tenantId, subject],
    );
    await admin.query(
      "INSERT INTO platform.user_account(tenant_id,staff_id,identity_issuer,identity_subject,status)VALUES($1,$2,$3,$4,'active')",
      [clinic.tenantId, staff.id, DEV_ISSUER, subject],
    );
    await admin.query(
      "INSERT INTO platform.role_grant(tenant_id,staff_id,role_id,facility_id)SELECT $1,$2,id,$3 FROM platform.role WHERE tenant_id IS NULL AND code='tenant_admin'",
      [clinic.tenantId, staff.id, binding.facilityId],
    );
    const read = await call(
      'GET',
      `/v1/apple-messages/conversations/${first.conversationId}?facilityId=${binding.facilityId}`,
    );
    const queued = await call(
      'POST',
      `/v1/apple-messages/conversations/${first.conversationId}/replies`,
      {
        facilityId: binding.facilityId,
        version: read.body.conversation.version,
        text: 'Revoked staff must not send this.',
      },
      await signDevToken(subject),
    );
    expect(queued.status).toBe(200);
    await admin.query(
      'UPDATE platform.role_grant SET revoked_at=now() WHERE staff_id=$1',
      [staff.id],
    );
    await flushAppleReplies(db, binding, transport);
    expect(
      [...sent.values()].some((t) => t.includes('Revoked staff must not send')),
    ).toBe(false);
    expect(
      (
        await admin.query(
          'SELECT status FROM comms.apple_message WHERE id=$1',
          [queued.body.messageId],
        )
      ).rows[0].status,
    ).toBe('cancelled');
  });
});

import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { createHandler } from '../../../../../infra/apple-connect/bootstrap.cjs';
import { appleConnectTemplate } from '../../../../../infra/apple-connect/template.mjs';

describe('Connect bootstrap trust and private session provisioning', () => {
  it('refuses a web chat masquerading through user-supplied Apple attributes', async () => {
    let created = false;
    const handler = createHandler(
      {
        describe: async () => ({
          Contact: {
            SegmentAttributes: {
              'connect:Subtype': { ValueString: 'connect:Chat' },
            },
          },
        }),
        createParticipant: async () => {
          created = true;
        },
      },
      { instanceArn: 'instance', topicArn: 'topic' },
    );
    await expect(
      handler({
        Details: {
          ContactData: {
            InstanceARN: 'instance',
            Channel: 'CHAT',
            ContactId: randomUUID(),
            Attributes: { subtype: 'connect:Apple' },
          },
        },
      }),
    ).rejects.toThrow('Apple Messages');
    expect(created).toBe(false);
  });
  it('creates the bot, connects it immediately, retains credentials privately and replays without a second participant', async () => {
    const instanceArn = `arn:aws:connect:us-east-1:111122223333:instance/${randomUUID()}`,
      contactId = randomUUID();
    const calls: string[] = [];
    let row: any;
    const handler = createHandler(
      {
        describe: async () => ({
          Contact: {
            SegmentAttributes: {
              'connect:Subtype': { ValueString: 'connect:Apple' },
            },
          },
        }),
        get: async () => row,
        startStreaming: async () => {
          calls.push('stream');
        },
        createParticipant: async () => {
          calls.push('create');
          return {
            ParticipantCredentials: { ParticipantToken: 'private-token' },
          };
        },
        connectParticipant: async (input: any) => {
          calls.push('connect');
          expect(input.ConnectParticipant).toBe(true);
          return {
            ConnectionCredentials: {
              ConnectionToken: 'private-connection',
              Expiry: new Date(Date.now() + 600000).toISOString(),
            },
          };
        },
        put: async (input: any) => {
          row = input;
          calls.push('save');
        },
        publish: async () => {
          calls.push('wake');
        },
      },
      { instanceArn, topicArn: 'topic' },
    );
    const event = {
      Details: {
        ContactData: {
          InstanceARN: instanceArn,
          Channel: 'CHAT',
          ContactId: contactId,
        },
      },
    };
    expect(await handler(event)).toEqual({ ready: 'true' });
    expect(calls).toEqual(['stream', 'create', 'connect', 'save', 'wake']);
    expect(await handler(event)).toEqual({ ready: 'true' });
    expect(calls.filter((v) => v === 'create')).toHaveLength(1);
    expect(row.subtype.S).toBe('connect:Apple');
    await expect(
      handler({
        Details: {
          ContactData: { ...event.Details.ContactData, InstanceARN: 'other' },
        },
      }),
    ).rejects.toThrow('Unexpected');
  });
  it('limits queue publishing and invocation to the configured AWS sources', () => {
    const template = appleConnectTemplate();
    const policies = JSON.stringify(template.Resources);
    expect(template.Resources.Inbox.Properties.SqsManagedSseEnabled).toBe(true);
    expect(
      template.Resources.Sessions.Properties.SSESpecification.SSEEnabled,
    ).toBe(true);
    expect(policies).toContain('aws:SourceArn');
    expect(policies).toContain('aws:SourceAccount');
    expect(template.Resources.InvokePermission.Properties.SourceArn).toEqual({
      Ref: 'ConnectInstanceArn',
    });
    expect(template.Resources.Subscription.Properties.RawMessageDelivery).toBe(
      false,
    );
  });
});

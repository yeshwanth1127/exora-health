import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmazonAppleTransport } from './apple-connect.ts';
import type { AppleBinding } from './apple-config.ts';

const binding: AppleBinding = {
  tenantId: randomUUID(),
  facilityId: randomUUID(),
  instanceArn: `arn:aws:connect:us-east-1:111122223333:instance/${randomUUID()}`,
  topicArn: 'arn:aws:sns:us-east-1:111122223333:apple',
  queueUrl: 'https://sqs.us-east-1.amazonaws.com/111122223333/apple',
  sessionTable: 'apple-sessions',
};
const contactId = randomUUID();
const session = () => ({
  instanceArn: { S: binding.instanceArn },
  subtype: { S: 'connect:Apple' },
  participantToken: { S: 'private-participant' },
  connectionToken: { S: 'private-connection' },
  connectionExpiry: { S: new Date(Date.now() + 3600000).toISOString() },
  expiresAt: { N: String(Math.floor(Date.now() / 1000) + 3600) },
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Amazon Apple SDK adapter without network access', () => {
  it('rejects demo bindings and unverified private sessions before using participant APIs', async () => {
    expect(
      () => new AmazonAppleTransport({ ...binding, localDemo: true }),
    ).toThrow('demo');
    const transport = new AmazonAppleTransport(binding);
    vi.spyOn(transport.dynamo, 'send').mockResolvedValue({
      Item: { ...session(), subtype: { S: 'connect:Chat' } },
    } as never);
    const participant = vi.spyOn(transport.participant, 'send');
    await expect(transport.transcript(contactId)).rejects.toThrow('verified');
    expect(participant).not.toHaveBeenCalled();
  });
  it('renews private connection credentials and reconciles all transcript pages in time order', async () => {
    const transport = new AmazonAppleTransport(binding),
      row = session();
    row.connectionExpiry.S = new Date(0).toISOString();
    const dynamo = vi
      .spyOn(transport.dynamo, 'send')
      .mockResolvedValueOnce({ Item: row } as never)
      .mockResolvedValueOnce({} as never);
    const transcript = (text: string, offset: number) => ({
      Id: text,
      Type: 'MESSAGE',
      ContentType: 'text/plain',
      ParticipantRole: 'CUSTOMER',
      Content: text,
      AbsoluteTime: new Date(Date.now() + offset).toISOString(),
    });
    const participant = vi
      .spyOn(transport.participant, 'send')
      .mockResolvedValueOnce({
        ConnectionCredentials: {
          ConnectionToken: 'renewed-private',
          Expiry: new Date(Date.now() + 3600000).toISOString(),
        },
      } as never)
      .mockResolvedValueOnce({
        Transcript: [transcript('newer', 1000)],
        NextToken: 'older-page',
      } as never)
      .mockResolvedValueOnce({ Transcript: [transcript('older', 0)] } as never);
    expect(
      (await transport.transcript(contactId)).map((e) => e.Content),
    ).toEqual(['older', 'newer']);
    expect(participant.mock.calls[0]![0].input).toEqual({
      ParticipantToken: 'private-participant',
      Type: ['CONNECTION_CREDENTIALS'],
    });
    expect(participant.mock.calls[1]![0].input).toMatchObject({
      ConnectionToken: 'renewed-private',
      ScanDirection: 'BACKWARD',
      SortOrder: 'ASCENDING',
      MaxResults: 100,
    });
    expect(participant.mock.calls[2]![0].input).toMatchObject({
      NextToken: 'older-page',
    });
    expect(dynamo.mock.calls[1]![0].input).toMatchObject({
      TableName: binding.sessionTable,
      ConditionExpression: 'instanceArn=:i AND expiresAt>:n',
    });
  });
  it('uses stable send tokens and emits typing before the real reply', async () => {
    vi.useFakeTimers();
    const transport = new AmazonAppleTransport(binding);
    vi.spyOn(transport.dynamo, 'send').mockResolvedValue({
      Item: session(),
    } as never);
    const participant = vi
      .spyOn(transport.participant, 'send')
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ Id: 'provider-message' } as never);
    const id = randomUUID(),
      pending = transport.send(contactId, id, 'Synthetic reception reply');
    await vi.advanceTimersByTimeAsync(999);
    expect(participant).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe('provider-message');
    expect(participant.mock.calls[0]![0].input).toMatchObject({
      ContentType: 'application/vnd.amazonaws.connect.event.typing',
      ClientToken: id + '-typing',
    });
    expect(participant.mock.calls[1]![0].input).toMatchObject({
      ContentType: 'text/plain',
      Content: 'Synthetic reception reply',
      ClientToken: id,
    });
  });
});

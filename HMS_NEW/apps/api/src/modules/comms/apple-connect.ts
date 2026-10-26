import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  ConnectParticipantClient,
  CreateParticipantConnectionCommand,
  GetTranscriptCommand,
  SendMessageCommand,
  SendEventCommand,
} from '@aws-sdk/client-connectparticipant';
import { sql, type DB, type Kysely } from '@hms/db';
import { setTransactionContext } from '@hms/platform';
import { z } from 'zod';
import {
  TranscriptEntry,
  ingestAppleTranscript,
  processAppleConversation,
  type AppleTranscriptEntry,
} from './apple-messages.ts';
import type { AppleBinding } from './apple-config.ts';
import type { ManagedSettings } from './managed-config.ts';
import { assertWhatsAppActive } from './whatsapp.ts';

export interface AppleTransport {
  transcript(contactId: string): Promise<AppleTranscriptEntry[]>;
  send(contactId: string, id: string, text: string): Promise<string>;
}
/** Queue policy permits only the bound SNS topic; IAM-authenticated SQS is the trust boundary. */
export function appleWake(body: string, binding: AppleBinding) {
  const sns = z
    .object({
      Type: z.literal('Notification'),
      TopicArn: z.literal(binding.topicArn),
      MessageAttributes: z.record(
        z.string(),
        z.object({ Type: z.literal('String'), Value: z.string() }),
      ),
    })
    .parse(JSON.parse(body));
  const attrs = sns.MessageAttributes,
    parts = binding.instanceArn.split(':'),
    instance = binding.instanceArn.split('/')[1];
  if (
    attrs.InstanceId?.Value !== instance ||
    attrs.AccountId?.Value !== parts[4]
  )
    throw Error('Apple queue source does not match its configured instance');
  return z.uuid().parse(attrs.ContactId?.Value);
}
export class AmazonAppleTransport implements AppleTransport {
  readonly sqs: SQSClient;
  readonly dynamo: DynamoDBClient;
  readonly participant: ConnectParticipantClient;
  constructor(readonly binding: AppleBinding) {
    if (binding.localDemo)
      throw Error('Local demo transcripts cannot use the AWS transport');
    const region = binding.instanceArn.split(':')[3];
    this.sqs = new SQSClient({ region });
    this.dynamo = new DynamoDBClient({ region });
    this.participant = new ConnectParticipantClient({ region });
  }
  private async token(contactId: string) {
    z.uuid().parse(contactId);
    const { Item: r } = await this.dynamo.send(
      new GetItemCommand({
        TableName: this.binding.sessionTable,
        Key: { contactId: { S: contactId } },
        ConsistentRead: true,
      }),
    );
    if (
      !r ||
      r.instanceArn?.S !== this.binding.instanceArn ||
      r.subtype?.S !== 'connect:Apple' ||
      Number(r.expiresAt?.N ?? 0) <= Date.now() / 1000 ||
      !r.participantToken?.S
    )
      throw Error('Apple contact is not an active verified Connect session');
    if (
      r.connectionToken?.S &&
      Date.parse(r.connectionExpiry?.S ?? '') > Date.now() + 60000
    )
      return r.connectionToken.S;
    const renewed = await this.participant.send(
      new CreateParticipantConnectionCommand({
        ParticipantToken: r.participantToken.S,
        Type: ['CONNECTION_CREDENTIALS'],
      }),
    );
    const token = renewed.ConnectionCredentials?.ConnectionToken,
      expiry = renewed.ConnectionCredentials?.Expiry;
    if (!token || !expiry)
      throw Error('Apple connection renewal did not return credentials');
    await this.dynamo.send(
      new UpdateItemCommand({
        TableName: this.binding.sessionTable,
        Key: { contactId: { S: contactId } },
        UpdateExpression: 'SET connectionToken=:t, connectionExpiry=:e',
        ConditionExpression: 'instanceArn=:i AND expiresAt>:n',
        ExpressionAttributeValues: {
          ':t': { S: token },
          ':e': { S: expiry },
          ':i': { S: this.binding.instanceArn },
          ':n': { N: String(Math.floor(Date.now() / 1000)) },
        },
      }),
    );
    return token;
  }
  async transcript(contactId: string) {
    const token = await this.token(contactId),
      entries: AppleTranscriptEntry[] = [];
    let next: string | undefined;
    do {
      const page = await this.participant.send(
        new GetTranscriptCommand({
          ConnectionToken: token,
          MaxResults: 100,
          NextToken: next,
          ScanDirection: 'BACKWARD',
          SortOrder: 'ASCENDING',
        }),
      );
      for (const row of page.Transcript ?? [])
        entries.push(TranscriptEntry.parse(row));
      next = page.NextToken;
      if (entries.length > 500 || (next && entries.length >= 500))
        throw Error(
          'Apple transcript requires operator review; automatic processing limit reached',
        );
    } while (next);
    return entries.sort(
      (a, b) =>
        a.AbsoluteTime.localeCompare(b.AbsoluteTime) ||
        a.Id.localeCompare(b.Id),
    );
  }
  async send(contactId: string, id: string, text: string) {
    const token = await this.token(contactId);
    await this.participant.send(
      new SendEventCommand({
        ConnectionToken: token,
        ContentType: 'application/vnd.amazonaws.connect.event.typing',
        ClientToken: id + '-typing',
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const sent = await this.participant.send(
      new SendMessageCommand({
        ConnectionToken: token,
        ContentType: 'text/plain',
        Content: text,
        ClientToken: id,
      }),
    );
    if (!sent.Id) throw Error('Connect did not acknowledge this reply');
    return sent.Id;
  }
  async receive() {
    const result = await this.sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: this.binding.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 10,
        VisibilityTimeout: 120,
      }),
    );
    return result.Messages ?? [];
  }
  async acknowledge(receipt: string) {
    await this.sqs.send(
      new DeleteMessageCommand({
        QueueUrl: this.binding.queueUrl,
        ReceiptHandle: receipt,
      }),
    );
  }
}

export async function reconcileAppleContact(
  db: Kysely<DB>,
  binding: AppleBinding,
  contactId: string,
  settings: ManagedSettings,
  transport: AppleTransport,
) {
  const id = await ingestAppleTranscript(
    db,
    binding,
    contactId,
    await transport.transcript(contactId),
  );
  for (let i = 0; i < 100; i++)
    if (!(await processAppleConversation(db, binding, id, settings))) break;
  return id;
}
/** Connect's stable ClientToken makes a lost SendMessage response retryable without duplicate text. */
export async function flushAppleReplies(
  db: Kysely<DB>,
  binding: AppleBinding,
  transport: AppleTransport,
) {
  const rows = await db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, binding.tenantId);
    await sql`SET LOCAL ROLE mod_comms`.execute(tx);
    await assertWhatsAppActive(tx);
    const { rows } = await sql<{
      id: string;
      conversation_id: string;
      contact_id: string;
      text_content: string;
      actor_staff_id: string | null;
      created_at: Date;
    }>`
      SELECT m.id,m.conversation_id,c.contact_id,m.text_content,m.actor_staff_id,m.created_at FROM comms.apple_message m
      JOIN comms.apple_conversation c ON c.id=m.conversation_id AND c.tenant_id=m.tenant_id
      WHERE c.facility_id=${binding.facilityId} AND c.instance_arn=${binding.instanceArn} AND m.status='queued' ORDER BY m.created_at,m.id LIMIT 20`.execute(
      tx,
    );
    return rows;
  });
  let count = 0,
    failed = false;
  const blocked = new Set<string>();
  for (const m of rows) {
    if (blocked.has(m.conversation_id)) continue;
    try {
      count += await db.transaction().execute(async (tx) => {
        await setTransactionContext(tx, binding.tenantId);
        await sql`SET LOCAL ROLE mod_comms`.execute(tx);
        await assertWhatsAppActive(tx);
        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${'apple:' + binding.instanceArn + ':' + m.conversation_id},0))`.execute(
          tx,
        );
        const {
          rows: [active],
        } = await sql<{
          ok: boolean;
        }>`SELECT EXISTS(SELECT 1 FROM platform.facility f
        JOIN platform.tenant t ON t.id=f.tenant_id WHERE f.id=${binding.facilityId} AND f.status='active' AND t.status IN ('active','trial')) AS ok`.execute(
          tx,
        );
        if (!active?.ok) return 0;
        const {
          rows: [pending],
        } = await sql<{
          status: string;
        }>`SELECT status FROM comms.apple_message WHERE id=${m.id}`.execute(tx);
        if (pending?.status !== 'queued') return 0;
        if (m.actor_staff_id) {
          const {
            rows: [allowed],
          } = await sql<{
            ok: boolean;
          }>`SELECT EXISTS(SELECT 1 FROM platform.staff s
          JOIN platform.user_account u ON u.staff_id=s.id AND u.status='active'
          JOIN platform.staff_permission p ON p.staff_id=s.id AND p.permission='comms.reply'
          WHERE s.id=${m.actor_staff_id} AND s.status='active' AND (p.facility_id IS NULL OR p.facility_id=${binding.facilityId})) AS ok`.execute(
            tx,
          );
          if (!allowed?.ok) {
            await sql`UPDATE comms.apple_message SET status='cancelled' WHERE id=${m.id}`.execute(
              tx,
            );
            return 0;
          }
        }
        if (new Date(m.created_at).getTime() < Date.now() - 90 * 60000) {
          await sql`UPDATE comms.apple_message SET status='failed' WHERE id=${m.id}`.execute(
            tx,
          );
          return 0;
        }
        const providerId = await transport.send(
          m.contact_id,
          m.id,
          m.actor_staff_id ? 'Reception: ' + m.text_content : m.text_content,
        );
        await sql`UPDATE comms.apple_message SET status='accepted',provider_response_id=${providerId} WHERE id=${m.id}`.execute(
          tx,
        );
        return 1;
      });
    } catch {
      // Preserve each successful acknowledgement and keep later replies on the failed thread ordered.
      failed = true;
      blocked.add(m.conversation_id);
    }
  }
  if (failed)
    throw Error('Some Apple replies remain queued for provider retry');
  return count;
}

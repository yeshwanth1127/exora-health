import { useState } from 'react';
import {
  AppleInboxSchema,
  AppleThreadSchema,
  type AppleThread,
} from '@hms/contracts';
import { PageTitle } from '@/components/workspace';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  SupportConversation,
  ConversationComposer,
} from '@/components/arc/support-conversation/support-conversation';
import { useCommand, useQuery, useWorkspace } from './hooks';
import { requestLeave, useUnsaved } from './leave';
import { CommandReceiptRecovery } from './CommandReceiptRecovery';

const decodeInbox = (value: unknown) => {
  try {
    return AppleInboxSchema.parse(value);
  } catch {
    throw Error('Apple inbox could not be read.');
  }
};
const decodeThread = (value: unknown) => {
  try {
    return AppleThreadSchema.parse(value);
  } catch {
    throw Error('Apple conversation could not be read.');
  }
};
const labels = {
  automation: 'Booking assistant',
  handoff: 'Needs reception',
  closed: 'Closed',
};
export function AppleMessages() {
  const { facility } = useWorkspace();
  return <AppleMessagesClinic key={facility.facilityId} />;
}
function AppleMessagesClinic() {
  const { facility } = useWorkspace();
  const inbox = useQuery(
    `/v1/apple-messages?facilityId=${facility.facilityId}`,
    5000,
    decodeInbox,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? inbox.data?.items[0]?.id ?? null;
  return (
    <div className="space-y-6">
      <PageTitle title="Apple Messages" />
      <Card className="p-4">
        <p className="font-medium">
          {inbox.data?.localDemo
            ? 'Local demo · no Apple delivery'
            : inbox.data?.configured
              ? 'Connection configured · live test pending'
              : 'Company setup required'}
        </p>
        <p className="text-sm text-muted-foreground">
          {inbox.data?.localDemo
            ? 'These are synthetic local conversations. An iPhone test requires your Apple test account and a connected messaging service.'
            : 'Your clinic’s account must be linked and tested before accepting Apple Messages bookings.'}
        </p>
      </Card>
      {inbox.error && <p role="alert">{inbox.error}</p>}
      {inbox.loading && <p>Loading conversations…</p>}
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-2" aria-label="Apple conversations">
          <Button variant="outline" onClick={() => void inbox.refresh()}>
            Refresh
          </Button>
          {inbox.data?.items.map((item, index) => (
            <Button
              key={item.id}
              variant={selected === item.id ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => {
                if (selected !== item.id)
                  requestLeave(() => setPicked(item.id));
              }}
            >
              Conversation {index + 1} · {labels[item.status]}
            </Button>
          ))}
          {inbox.data && !inbox.data.items.length && (
            <p className="text-sm text-muted-foreground">
              No Apple conversations yet.
            </p>
          )}
        </div>
        {selected && (
          <AppleConversation
            key={selected}
            id={selected}
            onUpdated={() => void inbox.refresh()}
          />
        )}
      </div>
    </div>
  );
}
function AppleConversation({
  id,
  onUpdated,
}: {
  id: string;
  onUpdated: () => void;
}) {
  const { facility, can } = useWorkspace();
  const thread = useQuery(
    `/v1/apple-messages/conversations/${id}?facilityId=${facility.facilityId}`,
    5000,
    decodeThread,
  );
  return (
    <div>
      {thread.error && <p role="alert">{thread.error}</p>}
      {thread.data && (
        <AppleReply
          thread={thread.data}
          refresh={async () => {
            await thread.refresh();
            onUpdated();
          }}
          canReply={can('comms.reply')}
        />
      )}
    </div>
  );
}
function AppleReply({
  thread,
  refresh,
  canReply,
}: {
  thread: AppleThread;
  refresh: () => Promise<void>;
  canReply: boolean;
}) {
  const { facility } = useWorkspace();
  const [text, setText] = useState('');
  const cmd = useCommand();
  useUnsaved(!!text);
  const locked =
    !canReply ||
    thread.conversation.status === 'closed' ||
    cmd.busy ||
    cmd.unknown;
  async function send() {
    if (locked || !text.trim()) return;
    const result = await cmd.run(
      `/v1/apple-messages/conversations/${thread.conversation.id}/replies`,
      {
        facilityId: facility.facilityId,
        version: thread.conversation.version,
        text: text.trim(),
      },
      true,
    );
    if (result) {
      setText('');
      await refresh();
    }
  }
  return (
    <div>
      <SupportConversation
        channelName="Apple Messages"
        variant="reference"
        title="Appointment enquiry"
        subtitle={labels[thread.conversation.status]}
        resolved={thread.conversation.status === 'closed'}
        messages={thread.messages.map((m) => {
          const at = new Date(m.createdAt);
          return {
            id: m.id,
            sender: m.direction === 'inbound' ? 'Visitor' : 'Clinic',
            outgoing: m.direction === 'outbound',
            text: m.text,
            time: at.toLocaleTimeString('en-US', {
              timeZone: facility.timezone,
              hour: 'numeric',
              minute: '2-digit',
            }),
            day: at.toLocaleDateString('en-US', {
              timeZone: facility.timezone,
            }),
            delivery:
              m.direction === 'outbound'
                ? m.status === 'accepted'
                  ? 'Accepted by messaging service'
                  : m.status
                : undefined,
          };
        })}
        notice="Replies pause the booking assistant. A queued reply has not yet been accepted by the messaging service."
        composer={
          <ConversationComposer
            value={text}
            onChange={setText}
            onSend={() => void send()}
            suggestions={[]}
            placeholder="Reply as reception…"
            disabled={locked}
            sendLabel="Queue reply"
          />
        }
      />
      {cmd.error && <p role="alert">{cmd.error}</p>}
      <CommandReceiptRecovery
        command={cmd}
        onConfirmed={() => {
          setText('');
          void refresh();
        }}
      />
    </div>
  );
}

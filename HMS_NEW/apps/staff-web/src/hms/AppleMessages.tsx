import { useState } from 'react';
import {
  AppleInboxSchema,
  AppleThreadSchema,
  type AppleThread,
} from '@hms/contracts';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/arc/tabs/tabs';
import { AppleSetup } from './AppleSetup';
import { WorkspaceEmpty } from './WorkspaceEmpty';
import { useWorkspaceTab } from './use-workspace-tab';
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
  const [tab, open] = useWorkspaceTab("apple_messages");
  const inbox = useQuery(
    `/v1/apple-messages?facilityId=${facility.facilityId}`,
    5000,
    decodeInbox,
  );
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? inbox.data?.items[0]?.id ?? null;
  const live = !!inbox.data?.configured && !inbox.data.localDemo;
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => open(value as "conversations" | "setup")}
      className="arc-workflow-root"
    >
      <div className="arc-demo-scope mb-6">
        <TabsList aria-label="Apple Messages workspace">
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="setup" className="arc-workflow-panel">
        <AppleSetup live={live} onOpenConversations={() => open("conversations")} />
      </TabsContent>
      <TabsContent value="conversations" className="arc-workflow-panel">
        <div className="space-y-6">
          {inbox.error && <p role="alert">{inbox.error}</p>}
          {inbox.loading && !inbox.data && <p className="text-sm text-muted-foreground">Loading conversations…</p>}
          {inbox.data?.localDemo && (
            <p className="text-sm text-muted-foreground">
              Local demo · synthetic conversations, nothing is sent to Apple.
            </p>
          )}
          {inbox.data && !inbox.data.items.length ? (
            <WorkspaceEmpty
              title="No conversations yet"
              description={live ? "New Apple Messages appear here." : "They appear here once Apple Messages is live."}
              action={live ? undefined : { label: "Open setup", onClick: () => open("setup") }}
            />
          ) : (
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
              </div>
              {selected && (
                <AppleConversation
                  key={selected}
                  id={selected}
                  onUpdated={() => void inbox.refresh()}
                />
              )}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
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

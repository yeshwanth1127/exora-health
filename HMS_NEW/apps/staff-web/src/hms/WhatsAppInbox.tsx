import {
  SupportConversation,
  ConversationComposer,
} from "@/components/arc/support-conversation/support-conversation";
import { requestLeave, useUnsaved } from "./leave";
import { useCallback, useState } from "react";
import {
  Bot,
  CalendarPlus,
  Clock,
  Inbox as InboxIcon,
  Search,
  Send,
  UserCheck,
} from "lucide-react";
import { toast } from "@/components/toast-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "./hooks";
import {
  automationInfo,
  lastInbound,
  needsReply,
  queue,
  render,
  uid,
  windowLeft,
  type Conversation,
  type WaData,
} from "./whatsapp-data";
import { ago, duration, Ticks, useNow, type Change } from "./whatsapp-ui";

const filters = [
  ["waiting", "Needs reply"],
  ["mine", "Mine"],
  ["open", "All open"],
  ["resolved", "Resolved"],
] as const;
type Filter = (typeof filters)[number][0];

export function Inbox({
  data,
  change,
  clinicName,
  openAutomations,
}: {
  data: WaData;
  change: Change;
  clinicName: string;
  openAutomations: () => void;
}) {
  const { me, can, go, facility } = useWorkspace();
  const canReply = can("comms.reply");
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("waiting");
  const [q, setQ] = useState("");
  const match = (c: Conversation) =>
    filter === "waiting"
      ? needsReply(c)
      : filter === "mine"
        ? c.status === "open" && c.assignee === me.displayName
        : filter === "open"
          ? c.status === "open"
          : c.status === "resolved";
  const list = data.conversations
    .filter(
      (c) =>
        match(c) &&
        `${c.patient} ${c.phone}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort(
      (a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0),
    );
  const [picked, setPicked] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("conversation"),
  );
  const c =
    data.conversations.find((x) => x.id === (picked ?? list[0]?.id)) ?? null;
  // Acting on a chat pins it, so it stays open after it leaves the current filter.
  const edit = (patch: Partial<Conversation>) => {
    setPicked(c?.id ?? null);
    change((d) => ({
      ...d,
      conversations: d.conversations.map((x) =>
        x.id === c?.id ? { ...x, ...patch } : x,
      ),
    }));
  };
  const count = (f: Filter) =>
    data.conversations.filter((x) =>
      f === "waiting"
        ? needsReply(x)
        : f === "mine"
          ? x.status === "open" && x.assignee === me.displayName
          : f === "open"
            ? x.status === "open"
            : x.status === "resolved",
    ).length;

  const send = useCallback(
    (text: string, template: string | null) => {
      if (
        !c ||
        !canReply ||
        c.status !== "open" ||
        !text.trim() ||
        text.length > 4096
      )
        return false;
      const at = Date.now();
      if (!template && !windowLeft(lastInbound(c), at)) {
        toast.error("The reply window has closed. Use an approved template.");
        return false;
      }
      setPicked(c.id);
      change((d) => {
        const [next, logId] = queue(
          d,
          {
            patient: c.patient,
            phone: c.phone,
            kind: template ? "Reception follow-up" : "Staff reply",
            template,
            category: template ? "utility" : "service",
            body: text,
          },
          at,
        );
        return {
          ...next,
          conversations: next.conversations.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  assignee: x.assignee ?? me.displayName,
                  messages: [
                    ...x.messages,
                    {
                      id: uid(),
                      at,
                      from: "staff" as const,
                      text,
                      by: me.displayName,
                      logId,
                    },
                  ],
                }
              : x,
          ),
        };
      });
      return true;
    },
    [c, canReply, change, me.displayName],
  );

  return (
    <Card className="grid h-[calc(100dvh-230px)] min-h-[560px] gap-0 overflow-hidden p-0 shadow-none lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_260px]">
      <aside
        className={`flex min-h-0 flex-col border-r ${c && picked ? "max-lg:hidden" : ""}`}
      >
        <div className="space-y-3 border-b p-3">
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name or number"
              aria-label="Search chats"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.map(([k, label]) => (
              <Button
                key={k}
                size="xs"
                variant={filter === k ? "secondary" : "ghost"}
                onClick={() =>
                  requestLeave(() => {
                    setFilter(k);
                    setPicked(null);
                  })
                }
              >
                {label}
                {k !== "resolved" && (
                  <span className="text-muted-foreground tabular-nums">
                    {count(k)}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {list.map((x) => {
            const last = x.messages.at(-1);
            const active = x.id === c?.id;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => requestLeave(() => setPicked(x.id))}
                  className={`flex w-full gap-3 border-b px-3 py-3 text-left ${active ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#25d366]/15 text-sm font-medium text-[#128c7e]">
                    {x.patient[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${needsReply(x) ? "font-semibold" : "font-medium"}`}
                      >
                        {x.patient}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {last ? ago(last.at, now) : ""}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {last?.from === "staff"
                        ? "You: "
                        : last?.from === "bot"
                          ? "Bot: "
                          : ""}
                      {last?.text ?? "No messages yet"}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[10px] font-normal"
                      >
                        {x.reason}
                      </Badge>
                      {x.assignee && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {x.assignee}
                        </span>
                      )}
                      {needsReply(x) && (
                        <span
                          className="ml-auto size-2 shrink-0 rounded-full bg-[#25d366]"
                          aria-label="Needs reply"
                        />
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!list.length && (
            <li className="grid place-items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <InboxIcon className="size-5" />
              {filter === "waiting"
                ? "No chats currently need a reply in this preview."
                : "No chats here."}
            </li>
          )}
        </ul>
      </aside>
      {c ? (
        <>
          <SupportConversation
            key={c.id}
            title={c.patient}
            subtitle={`${c.phone} · ${c.assignee ? `Assigned to ${c.assignee === me.displayName ? "you" : c.assignee}` : "Unassigned"}`}
            className={picked ? "" : "max-lg:hidden"}
            resolved={c.status !== "open"}
            onResolve={
              canReply
                ? () =>
                    requestLeave(() => {
                      edit(
                        c.status === "open"
                          ? { status: "resolved" }
                          : { status: "open", assignee: me.displayName },
                      );
                      toast.success(
                        c.status === "open"
                          ? "Chat resolved in preview"
                          : "Chat reopened in preview",
                      );
                    })
                : undefined
            }
            actions={
              <>
                {" "}
                {canReply && c.status === "open" && (
                  <>
                    {c.assignee !== me.displayName && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => edit({ assignee: me.displayName })}
                      >
                        <UserCheck /> Assign to me
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        requestLeave(() => {
                          edit({ status: "bot", assignee: null });
                          toast.success("Chat moved to bot in preview");
                        })
                      }
                    >
                      <Bot /> Hand back to bot
                    </Button>
                  </>
                )}
              </>
            }
            messages={c.messages.map((message) => {
              const status = message.logId
                ? data.log.find((entry) => entry.id === message.logId)?.status
                : undefined;
              return {
                id: message.id,
                sender:
                  message.from === "patient"
                    ? c.patient
                    : message.from === "bot"
                      ? "Bot"
                      : (message.by ?? "Staff"),
                outgoing: message.from !== "patient",
                text: message.text,
                time: new Date(message.at).toLocaleTimeString("en-IN", {
                  timeZone: facility.timezone,
                  hour: "numeric",
                  minute: "2-digit",
                }),
                day: new Date(message.at).toLocaleDateString("en-IN", {
                  timeZone: facility.timezone,
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
                delivery: status ? (
                  <>
                    Preview · <Ticks status={status} />
                    {status}
                  </>
                ) : undefined,
              };
            })}
            notice={
              c.status === "open"
                ? undefined
                : c.status === "resolved"
                  ? "Resolved in this preview"
                  : "Handed back to the bot in this preview"
            }
            composer={
              <Composer
                c={c}
                data={data}
                now={now}
                canReply={canReply}
                clinicName={clinicName}
                send={send}
                openAutomations={openAutomations}
              />
            }
          />
          <aside className="hidden min-h-0 overflow-y-auto border-l p-4 text-sm xl:block">
            <p className="text-xs font-medium text-muted-foreground">Patient</p>
            <p className="mt-1 font-medium">{c.patient}</p>
            <p className="text-xs text-muted-foreground">
              {c.context.visits
                ? `${c.context.visits} past visit${c.context.visits === 1 ? "" : "s"}`
                : "New patient"}
            </p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Next appointment
                </dt>
                <dd>{c.context.next ?? "None booked"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last visit</dt>
                <dd>{c.context.last ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Why it reached you
                </dt>
                <dd>{c.reason}</dd>
              </div>
            </dl>
            <Button
              className="mt-5 w-full"
              size="sm"
              variant="outline"
              onClick={() => go("appointments?book=1")}
            >
              <CalendarPlus /> Book appointment
            </Button>
          </aside>
        </>
      ) : (
        <div className="grid place-items-center p-8 text-sm text-muted-foreground max-lg:hidden xl:col-span-2">
          Pick a chat to read it.
        </div>
      )}
    </Card>
  );
}

function Composer({
  c,
  data,
  now,
  canReply,
  clinicName,
  send,
  openAutomations,
}: {
  c: Conversation;
  data: WaData;
  now: number;
  canReply: boolean;
  clinicName: string;
  send: (text: string, template: string | null) => boolean;
  openAutomations: () => void;
}) {
  const [text, setText] = useState("");
  if (c.status !== "open" && text) setText("");
  useUnsaved(!!text.trim());
  if (!canReply)
    return (
      <p className="border-t p-4 text-sm text-muted-foreground">
        You can read this chat. Ask your administrator for reply access.
      </p>
    );
  if (c.status !== "open")
    return (
      <p className="border-t p-4 text-sm text-muted-foreground">
        Reopen this chat to reply.
      </p>
    );
  const left = windowLeft(lastInbound(c), now);
  if (!left) {
    const tpl = data.automations.find((a) => a.id === "staff_reply")!;
    const body = render(tpl.approved?.body ?? tpl.body, {
      patient_name: c.patient.split(" ")[0],
      clinic_name: clinicName,
    });
    return (
      <div className="space-y-3 border-t p-4">
        <p className="flex items-start gap-2 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <span>
            More than 24 hours since {c.patient.split(" ")[0]}'s last message,
            so WhatsApp only allows an approved template. When they reply, you
            can chat freely again.
          </span>
        </p>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {automationInfo.staff_reply.title}
          </p>
          {body}
        </div>
        {c.messages.at(-1)?.from === "staff" ? (
          <p className="text-sm text-muted-foreground">
            Queued in this browser preview. You can chat freely once{" "}
            {c.patient.split(" ")[0]} replies.
          </p>
        ) : tpl.approved ? (
          <Button
            onClick={() => {
              if (send(body, automationInfo.staff_reply.name))
                toast.success("Template queued in preview");
            }}
          >
            <Send /> Send template
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              This template isn't approved by Meta yet.
            </span>
            <Button size="sm" variant="outline" onClick={openAutomations}>
              Submit it
            </Button>
          </div>
        )}
      </div>
    );
  }
  const submit = () => {
    if (send(text.trim(), null)) {
      setText("");
      toast.success("Message queued in preview");
    }
  };
  return (
    <div className="space-y-2 border-t p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`ml-auto flex items-center gap-1 text-[11px] ${left < 2 * 3_600_000 ? "text-amber-700" : "text-muted-foreground"}`}
        >
          <Clock className="size-3" /> Reply window {duration(left)} left
        </span>
      </div>
      <ConversationComposer
        value={text}
        onChange={setText}
        onSend={submit}
        suggestions={data.settings.savedReplies}
        placeholder={`Reply to ${c.patient.split(" ")[0]}… (Enter to send, Shift+Enter for a new line)`}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  MessageCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { api, dateTime, wa, type Asset, type StaffUser } from "@/lib/api";
import {
  Action,
  Choice,
  Empty,
  Field,
  Resource,
  SectionTitle,
  StateBadge,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Content = {
  kind: string;
  text?: string;
  body?: string;
  caption?: string;
  filename?: string;
  choiceTitle?: string;
  choiceId?: string;
  choiceType?: string;
  media_unavailable?: boolean;
  asset?: Asset & { url: string };
  buttons?: { title: string }[];
  buttonText?: string;
  sections?: {
    title: string;
    rows: { title: string; description?: string }[];
  }[];
  messages?: Content[];
};
type ThreadSummary = {
  sender_id: string;
  name?: string;
  preview: string;
  assigned_to: string | null;
  updated_at: string;
  open: boolean;
  kinds: string[];
};
type Inbox = {
  items: ThreadSummary[];
  total: number;
  offset: number;
  limit: number;
};
type Thread = {
  sender_id: string;
  active_handoff: boolean;
  assigned_to: string | null;
  can_reply: boolean;
  cases: {
    id: string;
    kind: string;
    description: string;
    rating: number | null;
    status: string;
  }[];
  messages: {
    id: string;
    direction: string;
    content: Content;
    created_at: string;
    actor: string | null;
    delivery: string | null;
  }[];
  history_note: string | null;
  has_older_messages: boolean;
};
const names: Record<string, string> = {
  reception: "Reception",
  issue: "Issue",
  feedback: "Feedback",
};

function Media({ asset }: { asset: Asset & { url: string } }) {
  const [open, setOpen] = useState(false),
    [failed, setFailed] = useState(false);
  const image = asset.mime_type.startsWith("image/");
  return (
    <div className="space-y-2">
      {image && !failed ? (
        <Button
          variant="ghost"
          className="block h-auto w-full p-0 overflow-hidden"
          aria-label={`Enlarge ${asset.filename}`}
          onClick={() => setOpen(true)}
        >
          <img
            src={asset.url}
            alt={asset.filename}
            loading="lazy"
            onError={() => setFailed(true)}
            className="max-h-64 w-full object-contain rounded-md"
          />
        </Button>
      ) : asset.mime_type.startsWith("audio/") ? (
        <audio
          controls
          preload="none"
          src={asset.url}
          aria-label={asset.filename}
          className="w-full max-w-full"
        />
      ) : asset.mime_type.startsWith("video/") ? (
        <video
          controls
          preload="metadata"
          src={asset.url}
          aria-label={asset.filename}
          className="max-h-64 w-full rounded-md"
        />
      ) : (
        <div className="flex gap-2 items-center">
          <FileText className="size-4 shrink-0" />
          <span className="break-all">{asset.filename}</span>
        </div>
      )}
      {failed && (
        <p className="text-xs">
          Image preview unavailable. Try opening the original file.
        </p>
      )}
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs underline underline-offset-4"
      >
        <Download className="size-3" />
        Open original · {Math.max(1, Math.round(asset.size_bytes / 1024))} KB
      </a>
      {image && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{asset.filename}</DialogTitle>
              <DialogDescription>
                Original conversation attachment
              </DialogDescription>
            </DialogHeader>
            <img
              src={asset.url}
              alt={asset.filename}
              className="w-full max-h-[70dvh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MessageContent({ content }: { content: Content }) {
  if (content.kind === "sequence")
    return (
      <div className="space-y-4">
        {content.messages?.map((m, i) => (
          <MessageContent key={i} content={m} />
        ))}
      </div>
    );
  const text =
    content.choiceTitle || content.body || content.caption || content.text;
  return (
    <div className="space-y-3">
      {content.asset && <Media asset={content.asset} />}
      {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
      {content.choiceId && (
        <Badge variant="outline">
          Selected {content.choiceType === "list" ? "list option" : "button"}
        </Badge>
      )}
      {content.buttons?.length ? (
        <div className="space-y-1.5" aria-label="Options shown to the patient">
          <p className="text-[11px] text-muted-foreground">
            Options shown to patient
          </p>
          {content.buttons.map((b, i) => (
            <div
              key={i}
              className="rounded-md border bg-background py-2 px-3 text-center text-xs"
            >
              {b.title}
            </div>
          ))}
        </div>
      ) : null}
      {content.sections?.length ? (
        <details className="rounded-md border bg-background p-3">
          <summary className="cursor-pointer text-xs font-medium">
            {content.buttonText || "View options"} · view list
          </summary>
          <div
            className="mt-3 space-y-3"
            aria-label="List shown to the patient"
          >
            {content.sections.map((s, i) => (
              <div key={i}>
                <p className="text-xs font-medium mb-1">{s.title}</p>
                <ul className="divide-y">
                  {s.rows.map((r, j) => (
                    <li key={j} className="py-2 text-xs">
                      <p>{r.title}</p>
                      {r.description && (
                        <p className="text-muted-foreground mt-1">
                          {r.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {(content.media_unavailable ||
        ["image", "document", "audio", "video"].includes(content.kind)) &&
        !content.asset && (
          <p className="text-xs text-muted-foreground">
            {content.filename || "Attachment"} · Original file is unavailable in
            this dashboard.
          </p>
        )}
      {content.kind === "unsupported" && (
        <p className="text-xs text-muted-foreground">
          This message type cannot be previewed here.
        </p>
      )}
    </div>
  );
}

export function Conversations({
  user,
  enabled,
}: {
  user: StaffUser;
  enabled: boolean;
}) {
  const [kind, setKind] = useState("all"),
    [status, setStatus] = useState("all"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(""),
    [reply, setReply] = useState({ sender: "", text: "" }),
    [closeSender, setCloseSender] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const inbox = useResource<Inbox>(
    `${wa}/conversations?kind=${kind}&status=${status}&q=${encodeURIComponent(search)}&offset=${offset}&limit=30`,
  );
  const current =
    inbox.data?.items.find((c) => c.sender_id === selected) ??
    inbox.data?.items[0];
  const text = reply.sender === current?.sender_id ? reply.text : "";
  const setText = (value: string) =>
    setReply({ sender: current?.sender_id ?? "", text: value });
  const close = !!closeSender && closeSender === current?.sender_id;
  const setClose = (value: boolean) =>
    setCloseSender(value ? (current?.sender_id ?? "") : "");
  const detail = useResource<Thread>(
    current ? `${wa}/conversations/${current.sender_id}` : null,
  );
  const refresh = () => {
    inbox.refresh();
    detail.refresh();
  };
  const thread =
    detail.data?.sender_id === current?.sender_id ? detail.data : null;
  return (
    <>
      <SectionTitle
        title="Conversations"
        description="Read patient messages, bot options and reception replies in one thread."
        action={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <div className="grid sm:grid-cols-[minmax(200px,1fr)_180px_160px] items-end gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search conversations"
            placeholder="Search phone or patient request"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Choice
          label="Conversation type"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setOffset(0);
            setSelected("");
            setText("");
          }}
          options={[
            ["all", "All conversations"],
            ["reception", "Reception"],
            ["issue", "Issues"],
            ["feedback", "Feedback"],
          ]}
        />
        <Choice
          label="Conversation status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setOffset(0);
            setSelected("");
            setText("");
          }}
          options={[
            ["all", "Any status"],
            ["open", "Open"],
            ["resolved", "Resolved"],
          ]}
        />
      </div>
      <Resource {...inbox}>
        {!current ? (
          <Empty
            title="No matching conversations"
            description="Try another type, status or search."
          />
        ) : (
          <Card className="grid lg:grid-cols-[280px_minmax(0,1fr)] p-0 gap-0 overflow-hidden">
            <div className="border-b lg:border-b-0 lg:border-r bg-muted/20">
              <p className="text-xs text-muted-foreground px-4 py-3 border-b">
                {inbox.data?.total}{" "}
                {inbox.data?.total === 1 ? "conversation" : "conversations"}
              </p>
              <div className="p-2 max-h-[250px] lg:max-h-[680px] overflow-y-auto">
                {inbox.data?.items.map((c) => (
                  <Button
                    key={c.sender_id}
                    variant="ghost"
                    aria-pressed={c.sender_id === current.sender_id}
                    className={`w-full h-auto min-h-24 justify-start text-left p-3 mb-1 whitespace-normal ${c.sender_id === current.sender_id ? "bg-background ring-1 ring-border" : ""}`}
                    onClick={() => {
                      setSelected(c.sender_id);
                      setText("");
                    }}
                  >
                    <span className="min-w-0 w-full">
                      <span className="flex justify-between gap-2 text-xs font-medium">
                        <span>{c.name || `+${c.sender_id}`}</span>
                        {c.open && (
                          <span
                            className="size-1.5 mt-1.5 rounded-full bg-foreground shrink-0"
                            aria-label="Open"
                          />
                        )}
                      </span>
                      {c.name && (
                        <span className="block text-[11px] text-muted-foreground mt-1">
                          +{c.sender_id}
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground mt-1.5 truncate">
                        {c.preview}
                      </span>
                      <span className="block text-[10px] text-muted-foreground mt-2">
                        {c.kinds.map((k) => names[k] || k).join(" · ") || "Bot"}{" "}
                        ·{" "}
                        {c.assigned_to ||
                          (c.open ? "Unassigned" : "No open request")}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
              {(inbox.data?.total ?? 0) > 30 && (
                <div className="p-3 border-t flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!offset}
                    onClick={() => setOffset(offset - 30)}
                  >
                    <ArrowLeft />
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={offset + 30 >= (inbox.data?.total ?? 0)}
                    onClick={() => setOffset(offset + 30)}
                  >
                    Next
                    <ArrowRight />
                  </Button>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Resource {...detail}>
                {thread && (
                  <>
                    <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {current.name || `+${current.sender_id}`}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {thread.active_handoff
                            ? `Bot paused · ${thread.assigned_to || "Unassigned"}`
                            : "Conversation history"}
                        </p>
                      </div>
                      {thread.active_handoff && (
                        <div className="flex flex-wrap gap-2">
                          <Action
                            variant="outline"
                            run={async () => {
                              await api(
                                `${wa}/reception/${current.sender_id}`,
                                {
                                  method: "PATCH",
                                  body: {
                                    status: "active",
                                    assigned_to: user.name,
                                  },
                                },
                              );
                              refresh();
                            }}
                            success="Conversation assigned to you"
                          >
                            Take conversation
                          </Action>
                          <Button
                            variant="outline"
                            onClick={() => setClose(true)}
                          >
                            Close & resume bot
                          </Button>
                        </div>
                      )}
                    </div>
                    {thread.cases
                      .filter((c) => c.kind !== "reception")
                      .map((c) => (
                        <div
                          key={c.id}
                          className="px-5 py-3 border-b flex flex-wrap items-center gap-2 text-xs"
                        >
                          <Badge variant="outline">
                            {names[c.kind] || c.kind}
                            {c.rating !== null ? ` · ${c.rating}/5` : ""}
                          </Badge>
                          <span className="flex-1 min-w-40">
                            {c.description}
                          </span>
                          <StateBadge value={c.status} />
                          {c.status !== "resolved" && (
                            <Action
                              variant="ghost"
                              run={async () => {
                                await api(
                                  `/api/v1/admin/whatsapp-cases/${c.id}`,
                                  {
                                    method: "PATCH",
                                    body: { status: "resolved" },
                                  },
                                );
                                refresh();
                              }}
                              success="Request resolved"
                            >
                              Mark resolved
                            </Action>
                          )}
                        </div>
                      ))}
                    <div
                      className="p-5 space-y-4 max-h-[520px] overflow-y-auto min-h-64"
                      aria-label="Conversation messages"
                    >
                      {thread.history_note && (
                        <p className="text-[11px] text-muted-foreground border rounded-md p-3">
                          {thread.history_note}
                        </p>
                      )}
                      {thread.has_older_messages && (
                        <p className="text-xs text-muted-foreground">
                          Showing the latest 100 messages.
                        </p>
                      )}
                      {thread.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[92%] sm:max-w-[80%] ${m.direction === "outbound" ? "ml-auto" : ""}`}
                        >
                          <div
                            className={`rounded-lg border p-3 text-sm ${m.direction === "outbound" ? "bg-muted/40" : "bg-background"}`}
                          >
                            <MessageContent content={m.content} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {m.direction === "inbound"
                              ? "Patient"
                              : m.actor || "Staff"}{" "}
                            · {dateTime(m.created_at)}
                            {m.delivery
                              ? ` · ${m.delivery === "accepted" ? "Accepted by provider" : m.delivery}`
                              : ""}
                          </p>
                        </div>
                      ))}
                      {!thread.messages.length && (
                        <p className="text-sm text-muted-foreground">
                          No retained messages yet.
                        </p>
                      )}
                    </div>
                    {thread.active_handoff ? (
                      <div className="p-5 border-t space-y-3">
                        {!thread.can_reply && (
                          <p className="text-xs text-muted-foreground">
                            Reply window closed. The patient must message again
                            before a free-text reply.
                          </p>
                        )}
                        <Field
                          id="reception-reply"
                          label="Reply to patient"
                          error={
                            !enabled
                              ? "Reception replies are disabled in Settings."
                              : !thread.can_reply
                                ? "The reply window has closed. The patient must message again before you can reply."
                                : !text.trim()
                                  ? "Write a reply before sending."
                                  : undefined
                          }
                        >
                          <Textarea
                            id="reception-reply"
                            placeholder="Write a helpful reply…"
                            value={text}
                            maxLength={2000}
                            onChange={(e) => setText(e.target.value)}
                            disabled={!thread.can_reply || !enabled}
                          />
                        </Field>
                        <div className="flex flex-wrap justify-between items-center gap-3">
                          <p className="text-xs text-muted-foreground">
                            Replies are sent as {user.name}.
                          </p>
                          <Action
                            disabled={
                              !enabled || !thread.can_reply || !text.trim()
                            }
                            run={async () => {
                              await api(
                                `${wa}/reception/${current.sender_id}/reply`,
                                {
                                  method: "POST",
                                  body: {
                                    actor: user.name,
                                    text: text.trim(),
                                    idempotency_key:
                                      "staff-ui:" + crypto.randomUUID(),
                                  },
                                },
                              );
                              setText("");
                              refresh();
                            }}
                            success="Reply queued. Check Delivery history for the result."
                          >
                            Queue reply
                            <ArrowRight />
                          </Action>
                        </div>
                      </div>
                    ) : (
                      <p className="border-t p-4 text-xs text-muted-foreground flex gap-2">
                        <MessageCircle className="size-4 shrink-0" />
                        This is a history view. Staff replies are available when
                        the patient has an active reception handoff.
                      </p>
                    )}
                  </>
                )}
              </Resource>
            </div>
          </Card>
        )}
      </Resource>
      <Dialog open={close} onOpenChange={setClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this conversation?</DialogTitle>
            <DialogDescription>
              Reception will stop handling +{current?.sender_id}. The patient
              can use the booking bot again.
            </DialogDescription>
          </DialogHeader>
          <Action
            run={async () => {
              await api(`${wa}/reception/${current!.sender_id}`, {
                method: "PATCH",
                body: { status: "closed", assigned_to: user.name },
              });
              setClose(false);
              refresh();
            }}
            success="Conversation closed. Bot resumed."
          >
            Close & resume bot
          </Action>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { useLegacyCommand } from "@/hms/operational-command";
import { RecoveryNotice } from "@/hms/OperationalRecovery";
import { requestLeave, useUnsaved } from "@/hms/leave";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  MessageCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { dateTime, wa, type Asset, type StaffUser } from "@/lib/api";
import {
  Action,
  Choice,
  Empty,
  Field,
  Resource,
  SectionTitle,
  StateBadge,
  useResource,
  useApi,
  usePermissions,
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
type Automation = {
  version?: number;
  open?: boolean;
  automation_state?: "automation" | "handoff_requested" | "human";
  automation_allowed?: boolean;
  automation_blocked_reasons?: string[];
  assigned_staff_id?: string | null;
};
const blockedNames: Record<string, string> = {
  closed: "Conversation closed",
  module_inactive: "WhatsApp is disabled for this clinic",
  consent_missing_or_withdrawn: "Messaging permission is missing or withdrawn",
  reply_window_expired:
    "The patient must message again to reopen the reply window",
  contact_inactive: "Messaging contact is inactive",
};
function AutomationBadge({
  state,
}: {
  state?: Automation["automation_state"];
}) {
  if (!state) return null;
  return (
    <Badge variant={state === "handoff_requested" ? "default" : "outline"}>
      {state === "handoff_requested"
        ? "Human requested"
        : state === "human"
          ? "Human handling"
          : "Automation"}
    </Badge>
  );
}
type ThreadSummary = Automation & {
  sender_id: string;
  display_address?: string;
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
type Thread = Automation & {
  sender_id: string;
  display_address?: string;
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
  localMode = false,
}: {
  user: StaffUser;
  enabled: boolean;
  localMode?: boolean;
}) {
  const api = useApi();
  const command = useLegacyCommand();
  const paused = command.busy || command.unknown;
  const canReply = usePermissions().can("comms.reply");
  const [kind, setKind] = useState("all"),
    [status, setStatus] = useState("all"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(""),
    [reply, setReply] = useState({ sender: "", text: "" }),
    [closeSender, setCloseSender] = useState(""),
    [resumeTarget, setResumeTarget] = useState<{
      id: string;
      version: number;
    } | null>(null);
  useUnsaved(!!reply.text.trim());
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
  const resumeBlocks =
    thread?.automation_blocked_reasons?.filter(
      (reason) => reason !== "human_handoff",
    ) ?? [];
  const mutate = (
    path: string,
    method: string,
    body: Record<string, unknown>,
  ) =>
    localMode
      ? command.write(path, {
          method,
          body: { ...body, version: thread?.version },
        })
      : api(path, { method, body });
  return (
    <>
      <RecoveryNotice
        command={command}
        onRecovered={() => {
          setReply({ sender: "", text: "" });
          setCloseSender("");
          setResumeTarget(null);
          refresh();
        }}
      />
      {localMode && canReply && <LocalConversationCreate onSaved={refresh} />}
      <SectionTitle
        title="Conversations"
        action={
          <Button variant="outline" disabled={paused} onClick={refresh}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <div className="grid sm:grid-cols-[minmax(200px,1fr)_180px_160px] items-end gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            disabled={paused}
            aria-label="Search conversations"
            placeholder="Search phone or patient request"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Choice
          disabled={paused}
          label="Conversation type"
          value={kind}
          onChange={(v) =>
            requestLeave(() => {
              setKind(v);
              setOffset(0);
              setSelected("");
              setReply({ sender: "", text: "" });
            })
          }
          options={[
            ["all", "All conversations"],
            ["reception", "Reception"],
            ["issue", "Issues"],
            ["feedback", "Feedback"],
          ]}
        />
        <Choice
          disabled={paused}
          label="Conversation status"
          value={status}
          onChange={(v) =>
            requestLeave(() => {
              setStatus(v);
              setOffset(0);
              setSelected("");
              setReply({ sender: "", text: "" });
            })
          }
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
                    disabled={paused}
                    key={c.sender_id}
                    variant="ghost"
                    aria-pressed={c.sender_id === current.sender_id}
                    className={`w-full h-auto min-h-24 justify-start text-left p-3 mb-1 whitespace-normal ${c.sender_id === current.sender_id ? "bg-background ring-1 ring-border" : ""}`}
                    onClick={() =>
                      requestLeave(() => {
                        setSelected(c.sender_id);
                        setReply({ sender: c.sender_id, text: "" });
                      })
                    }
                  >
                    <span className="min-w-0 w-full">
                      <span className="flex justify-between gap-2 text-xs font-medium">
                        <span>
                          {c.name ||
                            c.display_address ||
                            (localMode
                              ? "Messaging contact"
                              : `+${c.sender_id}`)}
                        </span>
                        {c.open && (
                          <span
                            className="size-1.5 mt-1.5 rounded-full bg-foreground shrink-0"
                            aria-label="Open"
                          />
                        )}
                      </span>
                      {c.name && (
                        <span className="block text-[11px] text-muted-foreground mt-1">
                          {c.display_address ??
                            (localMode
                              ? "Messaging contact"
                              : `+${c.sender_id}`)}
                        </span>
                      )}
                      <span className="block mt-2">
                        <AutomationBadge state={c.automation_state} />
                      </span>
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
                    disabled={paused || !offset}
                    onClick={() =>
                      requestLeave(() => {
                        setOffset(offset - 30);
                        setReply({ sender: "", text: "" });
                      })
                    }
                  >
                    <ArrowLeft />
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={paused || offset + 30 >= (inbox.data?.total ?? 0)}
                    onClick={() =>
                      requestLeave(() => {
                        setOffset(offset + 30);
                        setReply({ sender: "", text: "" });
                      })
                    }
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
                          {current.name ||
                            current.display_address ||
                            (localMode
                              ? "Messaging contact"
                              : `+${current.sender_id}`)}
                        </h3>
                        <div className="mt-2">
                          <AutomationBadge state={thread.automation_state} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {thread.automation_state
                            ? `${thread.open ? "Open" : "Closed"} · ${thread.assigned_to ? `Assigned to ${thread.assigned_to}` : "Unassigned"}`
                            : thread.active_handoff
                              ? `${localMode ? "Reception" : "Bot paused"} · ${thread.assigned_to || "Unassigned"}`
                              : "Conversation history"}
                        </p>
                      </div>
                      {(thread.automation_state
                        ? thread.open
                        : thread.active_handoff) && (
                        <div className="flex flex-wrap gap-2">
                          <Action
                            variant="outline"
                            disabled={
                              paused || (localMode && (!canReply || !enabled))
                            }
                            run={async () => {
                              await mutate(
                                `${wa}/reception/${current.sender_id}`,
                                "PATCH",
                                { status: "active", assigned_to: user.name },
                              );
                              refresh();
                            }}
                            success="Conversation assigned to you"
                          >
                            Take conversation
                          </Action>
                          {localMode &&
                            thread.automation_state === "automation" && (
                              <Action
                                variant="outline"
                                disabled={paused || !canReply || !enabled}
                                run={async () => {
                                  await mutate(
                                    `${wa}/reception/${current.sender_id}/handoff`,
                                    "POST",
                                    {},
                                  );
                                  refresh();
                                }}
                                success="Human handling requested; automation paused"
                              >
                                Request human handling
                              </Action>
                            )}
                          {localMode &&
                            thread.automation_state !== "automation" &&
                            thread.version !== undefined && (
                              <Button
                                variant="outline"
                                disabled={
                                  paused ||
                                  !canReply ||
                                  !enabled ||
                                  resumeBlocks.length > 0
                                }
                                onClick={() =>
                                  setResumeTarget({
                                    id: current.sender_id,
                                    version: thread.version!,
                                  })
                                }
                              >
                                Resume automation
                              </Button>
                            )}
                          <Button
                            variant="outline"
                            disabled={
                              paused || (localMode && (!canReply || !enabled))
                            }
                            onClick={() => setClose(true)}
                          >
                            {localMode
                              ? "Close conversation"
                              : "Close & resume bot"}
                          </Button>
                        </div>
                      )}
                    </div>
                    {localMode && resumeBlocks.length > 0 && (
                      <p className="border-b px-5 py-3 text-sm text-muted-foreground">
                        Automation unavailable:{" "}
                        {resumeBlocks
                          .map((reason) => blockedNames[reason] ?? reason)
                          .join(" · ")}
                      </p>
                    )}
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
                              disabled={
                                paused || (localMode && (!canReply || !enabled))
                              }
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
                                : undefined
                          }
                        >
                          <Textarea
                            id="reception-reply"
                            placeholder="Write a helpful reply…"
                            value={text}
                            maxLength={2000}
                            onChange={(e) => setText(e.target.value)}
                            disabled={
                              paused ||
                              !thread.can_reply ||
                              !enabled ||
                              (localMode && !canReply)
                            }
                          />
                        </Field>
                        <div className="flex flex-wrap justify-between items-center gap-3">
                          <Action
                            disabled={
                              paused ||
                              !enabled ||
                              !thread.can_reply ||
                              !text.trim() ||
                              (localMode && !canReply)
                            }
                            run={async () => {
                              await mutate(
                                `${wa}/reception/${current.sender_id}/reply`,
                                "POST",
                                { actor: user.name, text: text.trim() },
                              );
                              setText("");
                              refresh();
                            }}
                            success={
                              localMode
                                ? "Reply saved locally. No message was delivered."
                                : "Reply queued. Check Delivery history for the result."
                            }
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
      <Dialog
        open={!!resumeTarget}
        onOpenChange={(open) => {
          if (!paused && !open) setResumeTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return this conversation to automation?</DialogTitle>
            <DialogDescription>
              This clears the staff assignment and ends human handling.
              Automation can respond only when messaging permission and the
              reply window allow it. Live bot delivery is not connected.
            </DialogDescription>
          </DialogHeader>
          <RecoveryNotice
            command={command}
            onRecovered={() => {
              setResumeTarget(null);
              refresh();
            }}
          />
          <Action
            variant="destructive"
            disabled={paused || !canReply || !enabled}
            run={async () => {
              if (!resumeTarget) return;
              await command.write(`${wa}/reception/${resumeTarget.id}/resume`, {
                method: "POST",
                body: { version: resumeTarget.version },
              });
              setResumeTarget(null);
              refresh();
            }}
            success="Conversation returned to automation"
          >
            Resume automation
          </Action>
        </DialogContent>
      </Dialog>
      <Dialog
        open={close}
        onOpenChange={(open) => {
          if (!paused) setClose(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this conversation?</DialogTitle>
            <DialogDescription>
              {localMode
                ? "Close this staff conversation; automatic booking is unavailable."
                : `Reception will stop handling +${current?.sender_id}. The patient can use the booking bot again.`}
            </DialogDescription>
          </DialogHeader>
          <RecoveryNotice
            command={command}
            onRecovered={() => {
              setClose(false);
              refresh();
            }}
          />
          <Action
            disabled={paused || (localMode && (!canReply || !enabled))}
            run={async () => {
              await mutate(`${wa}/reception/${current!.sender_id}`, "PATCH", {
                status: "closed",
                assigned_to: user.name,
              });
              setClose(false);
              refresh();
            }}
            success={
              localMode
                ? "Conversation closed."
                : "Conversation closed. Bot resumed."
            }
          >
            {localMode ? "Close conversation" : "Close & resume bot"}
          </Action>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LocalConversationCreate({ onSaved }: { onSaved: () => void }) {
  const api = useApi(),
    contacts = useResource<{
      items: {
        id: string;
        address: string;
        patientId: string | null;
        bookingPartyId: string | null;
      }[];
    }>(`${wa}/contacts`);
  const created = useRef<{ contact: string; id: string } | null>(null);
  const [open, setOpen] = useState(false),
    [contact, setContact] = useState(""),
    [kind, setKind] = useState("issue"),
    [description, setDescription] = useState(""),
    [rating, setRating] = useState("");
  return (
    <div className="mb-5">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open a local support case
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a local support case</DialogTitle>
            <DialogDescription>
              Choose an existing messaging contact. This does not simulate an
              incoming patient message or open a provider reply window.
            </DialogDescription>
          </DialogHeader>
          <Resource {...contacts}>
            <Choice
              label="Existing messaging contact"
              value={contact}
              onChange={setContact}
              options={(contacts.data?.items ?? []).map((c) => [
                c.id,
                `${c.address} · ${c.patientId ? "patient contact" : "booking contact"}`,
              ])}
            />
            <Choice
              label="Case type"
              value={kind}
              onChange={setKind}
              options={[
                ["issue", "Issue"],
                ["feedback", "Feedback"],
              ]}
            />
            {kind === "feedback" && (
              <Choice
                label="Voluntary feedback rating (optional)"
                value={rating}
                onChange={setRating}
                options={[
                  ["", "No rating"],
                  ...[1, 2, 3, 4, 5].map(
                    (n) => [String(n), `${n}/5`] as [string, string],
                  ),
                ]}
              />
            )}
            <Field
              label="Administrative description"
              id="local-case-description"
            >
              <Textarea
                id="local-case-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                placeholder="Do not include clinical narratives."
              />
            </Field>
            <Action
              disabled={!contact || description.trim().length < 3}
              run={async () => {
                const r =
                  created.current?.contact === contact
                    ? { id: created.current.id }
                    : await api<{ id: string }>(`${wa}/conversations`, {
                        method: "POST",
                        body: { contactPointId: contact },
                      });
                created.current = { contact, id: r.id };
                await api(`${wa}/support-cases`, {
                  method: "POST",
                  body: {
                    conversationId: r.id,
                    kind,
                    description: description.trim(),
                    ...(kind === "feedback" && rating
                      ? { rating: Number(rating) }
                      : {}),
                  },
                });
                setOpen(false);
                created.current = null;
                setDescription("");
                onSaved();
              }}
              success="Local support case opened"
            >
              Save local case
            </Action>
          </Resource>
        </DialogContent>
      </Dialog>
    </div>
  );
}

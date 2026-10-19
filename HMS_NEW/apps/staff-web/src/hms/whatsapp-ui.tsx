import { useFieldContext } from "@/components/field-context";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, CheckCheck, Clock, FileText, ImageIcon, Paperclip, Upload, X, AlertCircle } from "lucide-react";
import { toast } from "@/components/toast-events";
import { GrowthBadge as Badge } from "./GrowthBadge";
import { Button } from "@/components/ui/button";
import { WorkspaceChoice } from "@/components/WorkspaceChoice";
import { IntentKeys, request } from "./client";
import { useQuery, useWorkspace } from "./hooks";
import { saveWaPreferences, type WaRemote } from "./managed-whatsapp";

import type { Practitioner } from "./types";
import { checkUpload, type Attachment } from "./whatsapp-setup";
import {
  templateState,
  type Status,
  type TemplateDraft,
  type WaData,
} from "./whatsapp-data";

export type Clinic = {
  name: string;
  doctors: Practitioner[];
  departments: { id: string; name: string }[];
  fee: (staffId: string) => number | null;
};

/** Object URLs for files picked this visit, keyed by slot id, so previews show the real image. */
export const previews = new Map<string, string>();

export function useWaData(_key: string, make: () => WaData) {
  const { facility } = useWorkspace();
  const remote = useQuery<WaRemote>(
    `/v1/whatsapp-workspace?facilityId=${facility.facilityId}`,
    15000,
  );
  const [data, setData] = useState<WaData>(() => ({
    ...make(),
    conversations: [],
    automations: [],
    campaigns: [],
    log: [],
    optedIn: 0,
  }));
  const [busy, setBusy] = useState(false),
    [revision, bump] = useState(0);
  const refs = useRef({
    busy: false,
    dirty: false,
    keys: new IntentKeys(),
    latest: data,
    remote: null as WaRemote | null,
  });
  useEffect(() => {
    if (remote.data) {
      refs.current.remote = remote.data;
      if (!refs.current.dirty && !refs.current.busy) {
        refs.current.latest = {
          ...remote.data.data,
          capabilities: remote.data.capabilities,
        };
        setData(refs.current.latest);
      }
    }
  }, [remote.data, busy]);
  const refreshRef = useRef(remote.refresh);
  refreshRef.current = remote.refresh;
  useEffect(() => {
    const refresh = () => {
      void refreshRef.current();
    };
    window.addEventListener("hms-whatsapp-updated", refresh);
    return () => window.removeEventListener("hms-whatsapp-updated", refresh);
  }, [facility.facilityId]);
  const change: Change = (fn) => {
    const r = refs.current,
      old = r.latest,
      next = fn(old);
    if (JSON.stringify(next.settings) !== JSON.stringify(old.settings)) {
      r.latest = next;
      r.dirty = true;
      setData(next);
      bump((n) => n + 1);
      return;
    }
    if (r.busy) return;
    if (
      JSON.stringify(next.automations) !== JSON.stringify(old.automations) ||
      JSON.stringify(next.campaigns) !== JSON.stringify(old.campaigns)
    ) {
      toast.error(
        "Use Automations or Promotions to review and save these changes.",
      );
      return;
    }
    const chat = next.conversations.find(
      (c) =>
        JSON.stringify(c) !==
        JSON.stringify(old.conversations.find((x) => x.id === c.id)),
    );
    if (!chat) {
      toast.error("This action is not available yet.");
      return;
    }
    const before = old.conversations.find((c) => c.id === chat.id);
    if (!before) return;
    const message = chat.messages.find(
      (m) => m.from === "staff" && !before.messages.some((x) => x.id === m.id),
    );
    const action = message
      ? "reply"
      : chat.status === "resolved"
        ? "close"
        : chat.status === "bot"
          ? "resume"
          : "assign";
    if (message && !remote.data?.capabilities.sending) {
      toast.error("WhatsApp sending is not available yet.");
      return;
    }
    const path = `/v1/whatsapp-workspace/conversations/${chat.id}/${action}`,
      body = {
        version: chat.version ?? before.version,
        ...(message ? { text: message.text } : {}),
      };
    r.busy = true;
    setBusy(true);
    void request(path, {
      method: "POST",
      body,
      idempotencyKey: r.keys.for(path, body),
    })
      .then(async () => {
        r.keys.complete(path, body);
        await remote.refresh();
        window.dispatchEvent(new Event("hms-whatsapp-updated"));
        toast.success(
          message
            ? "Reply queued. Delivery appears after confirmation."
            : "Conversation updated",
        );
      })
      .catch((e) => toast.error(e.message))
      .finally(() => {
        r.busy = false;
        setBusy(false);
      });
  };
  useEffect(() => {
    const r = refs.current;
    if (!r.dirty || r.busy || !r.remote) return;
    const timer = setTimeout(async () => {
      r.dirty = false;
      r.busy = true;
      setBusy(true);
      const prefs = r.latest.settings;
      try {
        await saveWaPreferences(facility.facilityId, r.remote!, prefs, r.keys);
        await remote.refresh();
        window.dispatchEvent(new Event("hms-whatsapp-updated"));
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Settings could not be saved.",
        );
        r.dirty = false;
      } finally {
        r.busy = false;
        setBusy(false);
        if (!r.dirty) await remote.refresh();
        bump((n) => n + 1);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [revision, remote.data, facility.facilityId]);
  return [
    { ...data, loading: remote.loading, error: remote.error, busy },
    change,
  ] as const;
}
export type Change = (fn: (d: WaData) => WaData) => void;

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const maskPhone = (p: string) => `${p.slice(0, 3)} ••••• ${p.slice(-5)}`;
export const clock = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export function ago(at: number, now: number) {
  const m = Math.round((now - at) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}
export function duration(ms: number) {
  const m = Math.ceil(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
export const startOfToday = (now: number) => new Date(now).setHours(0, 0, 0, 0);

export function StepDot({
  n,
  done,
  active,
}: {
  n: number;
  done: boolean;
  active: boolean;
}) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium ${done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary" : "border text-muted-foreground"}`}
    >
      {done ? <Check className="size-3.5" /> : n}
    </span>
  );
}

const templateLabels = {
  not_submitted: ["Not submitted", "outline"],
  in_review: ["In review at Meta", "secondary"],
  rejected: ["Rejected", "destructive"],
  approved: ["Approved", "outline"],
  edited: ["Edited · not submitted", "outline"],
} as const;
export function MetaBadge({ t }: { t: TemplateDraft }) {
  const s = templateState(t);
  const [label, variant] = templateLabels[s];
  return (
    <Badge variant={variant} className="gap-1.5 font-normal">
      <span
        className={`size-1.5 rounded-full ${s === "approved" ? "bg-emerald-600" : s === "rejected" ? "bg-destructive" : s === "in_review" ? "animate-pulse bg-amber-500" : "bg-muted-foreground/50"}`}
      />
      {label}
    </Badge>
  );
}

export const statusLabels: Record<Status, string> = {
  claimed: "Sending",
  unknown: "Delivery unconfirmed",
  cancelled: "Cancelled",
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  received: "Received",
};
export function Ticks({
  status,
  className = "",
}: {
  status: Status;
  className?: string;
}) {
  const c = `size-3.5 ${className}`;
  if (status === "unknown")
    return <AlertCircle className={c} aria-label="Delivery unconfirmed" />;
  if (status === "claimed" || status === "queued")
    return <Clock className={c} aria-label="Queued" />;
  if (status === "sent") return <Check className={c} aria-label="Sent" />;
  if (status === "delivered")
    return <CheckCheck className={c} aria-label="Delivered" />;
  if (status === "read")
    return <CheckCheck className={`${c} text-sky-500`} aria-label="Read" />;
  if (status === "failed")
    return (
      <AlertCircle className={`${c} text-destructive`} aria-label="Failed" />
    );
  return null;
}

export function Pick<T extends string>({
  id,
  value,
  options,
  onChange,
  className = "w-full",
}: {
  id?: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const field = useFieldContext();
  return <div className={className}><WorkspaceChoice id={id} label={field?.label ?? "Selection"}
    value={value} onChange={(next) => onChange(next as T)}
    options={options.map(([value, label]) => ({ value, label }))} /></div>;

}

export function FileSlot({
  id,
  label,
  value,
  onChange,
  accept = "image/jpeg,image/png,application/pdf",
  compact = false,
}: {
  id: string;
  label: string;
  value: Attachment | null;
  onChange: (value: Attachment | null) => void;
  accept?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pick = (file?: File) => {
    if (!file) return;
    const error = checkUpload(file);
    if (error) return void toast.error(error);
    const old = previews.get(id);
    if (old) URL.revokeObjectURL(old);
    previews.set(id, URL.createObjectURL(file));
    onChange({
      kind: file.type === "application/pdf" ? "pdf" : "image",
      name: file.name,
    });
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <>
          <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
            {value.kind === "pdf" ? (
              <FileText className="size-3.5 shrink-0" />
            ) : (
              <ImageIcon className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{value.name}</span>
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(null)}
          >
            <X />
          </Button>
        </>
      ) : (
        <Button
          size={compact ? "xs" : "sm"}
          variant="outline"
          onClick={() => input.current?.click()}
        >
          {compact ? <Upload /> : <Paperclip />}
          {compact ? "Upload" : `Add ${label.toLowerCase()}`}
        </Button>
      )}
    </div>
  );
}

export function Bubble({
  me = false,
  children,
  meta,
}: {
  me?: boolean;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,.13)] ${me ? "bg-[#d9fdd3]" : "bg-white"}`}
      >
        {children}
        {meta && (
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}

export function Choices({ items }: { items: string[] }) {
  return (
    <div className="-mx-2.5 mt-2 divide-y border-t">
      {items.map((t) => (
        <p
          key={t}
          className="truncate px-2.5 py-1.5 text-center text-[13px] text-[#008069]"
        >
          {t}
        </p>
      ))}
    </div>
  );
}

export function HeaderPreview({
  id,
  header,
}: {
  id: string;
  header: Attachment;
}) {
  const url = previews.get(id);
  if (header.kind === "image" && url)
    return (
      <img
        src={url}
        alt=""
        className="-mx-1 mb-1.5 aspect-video w-[calc(100%+0.5rem)] rounded-md object-cover"
      />
    );
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-md bg-[#f0f2f5] p-2 text-xs">
      {header.kind === "pdf" ? (
        <FileText className="size-5 text-[#e53935]" />
      ) : (
        <ImageIcon className="size-5" />
      )}
      <span className="truncate">{header.name}</span>
    </div>
  );
}

/** One template message as the patient receives it. */
export function TemplatePreview({
  title,
  slot,
  header,
  text,
  buttons,
  footer,
}: {
  title: string;
  slot: string;
  header: Attachment | null;
  text: string;
  buttons: string[];
  footer?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border-[5px] border-foreground/85 bg-[#efeae2]">
      <div className="bg-[#008069] px-3 py-2 text-sm font-medium text-white">
        {title}
      </div>
      <div className="min-h-40 p-3 text-[13px] leading-snug text-[#111b21]">
        <Bubble meta={clock(Date.now())}>
          {header && <HeaderPreview id={slot} header={header} />}
          <p className="whitespace-pre-wrap break-words">{text}</p>
          {footer && (
            <p className="mt-1 text-[11px] text-[#667781]">{footer}</p>
          )}
          {buttons.length > 0 && (
            <Choices items={buttons.filter((b) => b.trim())} />
          )}
        </Bubble>
      </div>
    </div>
  );
}

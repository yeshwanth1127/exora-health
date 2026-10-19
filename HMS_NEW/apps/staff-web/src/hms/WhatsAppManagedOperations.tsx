import { useState } from "react";
import { toast } from "@/components/toast-events";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GrowthSwitch as Switch } from "./GrowthControls";
import { GrowthBadge as Badge } from "./GrowthBadge";
import { IntentKeys, request } from "./client";
import { useQuery, useWorkspace } from "./hooks";
type Notice = {
  kind: string;
  title: string;
  body: string;
  enabled: boolean;
  status: string;
  version: number;
};
export function ManagedAutomations() {
  const { facility, can } = useWorkspace(),
    q = useQuery<{ items: Notice[] }>(
      `/v1/whatsapp-workspace/automations?facilityId=${facility.facilityId}`,
      15000,
    );
  const [busy, setBusy] = useState(""),
    [keys] = useState(() => new IntentKeys());
  const save = async (n: Notice, enabled: boolean) => {
    if (busy) return;
    setBusy(n.kind);
    const path = "/v1/whatsapp-workspace/automations",
      body = {
        facilityId: facility.facilityId,
        kind: n.kind,
        enabled,
        version: n.version,
      };
    try {
      await request(path, {
        method: "PUT",
        body,
        idempotencyKey: keys.for(path, body),
      });
      keys.complete(path, body);
      await q.refresh();
      toast.success(
        enabled
          ? "Message enabled. Sending starts after approval."
          : "Message disabled.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save message.");
      await q.refresh();
    } finally {
      setBusy("");
    }
  };
  const refresh = async (n: Notice) => {
    if (busy) return;
    setBusy(n.kind);
    try {
      await request("/v1/whatsapp-workspace/automations/refresh", {
        method: "POST",
        body: { facilityId: facility.facilityId, kind: n.kind },
        idempotencyKey: crypto.randomUUID(),
      });
      await q.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check approval.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Turn on the appointment messages you need. We prepare them for approval
        automatically. Only new appointments with the appropriate messaging
        consent are included. Quiet hours apply to scheduled messages.
      </p>
      {q.error && <p role="alert">{q.error}</p>}
      {q.loading && <p>Loading messages…</p>}
      {q.data?.items.map((n) => (
        <Card key={n.kind} className="gap-3 p-5 shadow-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{n.title}</p>
              <Badge variant="outline">
                {!n.enabled
                  ? "Off"
                  : n.status === "approved"
                    ? "Ready"
                    : n.status === "rejected"
                      ? "Needs attention"
                      : n.status === "unknown"
                        ? "Checking submission"
                        : "Waiting for approval"}
              </Badge>
            </div>
            <Switch
              label={n.title}
              checked={n.enabled}
              disabled={!can("comms.manage") || !!busy}
              onCheckedChange={(on) => void save(n, on)}
            />
          </div>
          <p className="text-sm text-muted-foreground">{n.body}</p>
          {n.enabled && n.status !== "approved" && (
            <Button
              variant="outline"
              size="sm"
              disabled={!!busy || !can("comms.manage")}
              onClick={() => void refresh(n)}
            >
              Check approval
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}

type Promotion = {
  id: string;
  title: string;
  status: string;
  recipients: number;
  estimateMinor: number;
  dueAt: string;
  version: number;
  queued: number;
  accepted: number;
  delivered: number;
  uncertain: number;
};
type ReadyMessage = { name: string; language: string; body: string };
export function ManagedPromotions() {
  const { facility, can } = useWorkspace(),
    q = useQuery<{
      available: boolean;
      templates: ReadyMessage[];
      items: Promotion[];
    }>(
      `/v1/whatsapp-workspace/promotions?facilityId=${facility.facilityId}`,
      15000,
    );
  const [title, setTitle] = useState(""),
    [selected, setSelected] = useState(""),
    [when, setWhen] = useState(""),
    [budget, setBudget] = useState("500"),
    [preview, setPreview] = useState<{
      id: string;
      version: number;
      body: string;
      recipients: number;
      estimateMinor: number;
      dueAt: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [keys] = useState(() => new IntentKeys());
  const messages = q.data?.templates ?? [];
  const prepare = async () => {
    const t = messages[Number(selected)];
    if (!t || !when || busy) return;
    setBusy(true);
    const path = "/v1/whatsapp-workspace/promotions/preview",
      body = {
        facilityId: facility.facilityId,
        title,
        name: t.name,
        language: t.language,
        dueAt: new Date(when).toISOString(),
        budgetMinor: Math.round(Number(budget) * 100),
      };
    try {
      const result = await request<NonNullable<typeof preview>>(path, {
        method: "POST",
        body,
        idempotencyKey: keys.for(path, body),
      });
      keys.complete(path, body);
      setPreview(result);
      await q.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not prepare promotion.",
      );
    } finally {
      setBusy(false);
    }
  };
  const act = async (
    id: string,
    version: number,
    action: "approve" | "pause",
  ) => {
    if (busy) return;
    setBusy(true);
    const path = `/v1/whatsapp-workspace/promotions/${id}/${action}`,
      body = { facilityId: facility.facilityId, version };
    try {
      await request(path, {
        method: "POST",
        body,
        idempotencyKey: keys.for(path, body),
      });
      keys.complete(path, body);
      setPreview(null);
      await q.refresh();
      toast.success(
        action === "approve" ? "Promotion scheduled." : "Promotion paused.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save promotion.");
    } finally {
      setBusy(false);
    }
  };
  if (!can("campaigns.manage"))
    return (
      <p className="text-sm text-muted-foreground">
        Your role does not include promotions.
      </p>
    );
  return (
    <div className="max-w-4xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Promotions go only to people who explicitly opted in. Choose an approved
        message, review the audience and estimated cost, then approve. Quiet
        hours apply. Up to 500 contacts per promotion.
      </p>
      {q.error && <p role="alert">{q.error}</p>}
      {!q.data?.available && (
        <p className="text-sm text-muted-foreground">
          Approved messages could not be loaded. Refresh once the connection is
          ready.
        </p>
      )}
      {!messages.length && q.data?.available && (
        <p className="text-sm text-muted-foreground">
          No approved promotion messages are available yet. Your service team
          can prepare them; this screen requires no provider account setup.
        </p>
      )}
      {messages.length > 0 && !preview && (
        <Card className="gap-4 p-5 shadow-none">
          <label className="space-y-1 text-sm">
            Promotion name
            <input
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </label>
          <label className="space-y-1 text-sm">
            Message
            <select
              className="mt-1 block h-9 w-full rounded-md border bg-background px-3"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose a message</option>
              {messages.map((t, i) => (
                <option key={t.name + ":" + t.language} value={String(i)}>
                  {t.body.slice(0, 120)}
                </option>
              ))}
            </select>
          </label>
          {selected !== "" && messages[Number(selected)] && (
            <p className="whitespace-pre-wrap text-sm">
              {messages[Number(selected)]!.body}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              Send after
              <input
                className="mt-1 block h-9 w-full rounded-md border bg-background px-3"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </label>
            <label className="space-y-1 text-sm">
              Estimated budget cap (₹)
              <input
                className="mt-1 block h-9 w-full rounded-md border bg-background px-3"
                type="number"
                min="1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
          </div>
          <Button
            disabled={
              busy ||
              !title.trim() ||
              selected === "" ||
              !when ||
              !(Number(budget) > 0)
            }
            onClick={() => void prepare()}
          >
            Review promotion
          </Button>
        </Card>
      )}
      {preview && (
        <Card className="gap-4 p-5 shadow-none">
          <p className="font-medium">Review before sending</p>
          <p className="whitespace-pre-wrap text-sm">{preview.body}</p>
          <p className="text-sm">
            {preview.recipients} opted-in contacts · estimated ₹
            {(preview.estimateMinor / 100).toFixed(2)} · after{" "}
            {new Date(preview.dueAt).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Provider charges can differ from the estimate. Delivery is recorded
            only when confirmed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !can("campaigns.approve")}
              onClick={() => void act(preview.id, preview.version, "approve")}
            >
              Approve and schedule
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Back
            </Button>
          </div>
        </Card>
      )}
      {q.data?.items
        .filter((p) => p.status !== "draft")
        .map((p) => (
          <Card key={p.id} className="gap-2 p-5 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">{p.title}</p>
              <Badge variant="outline">
                {p.status === "paused"
                  ? "Paused"
                  : p.queued
                    ? "Scheduled"
                    : "Attempted"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {p.recipients} contacts · {p.accepted} accepted · {p.delivered}{" "}
              delivered · {p.uncertain} need checking
            </p>
            {p.status === "scheduled" && p.queued > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void act(p.id, p.version, "pause")}
              >
                Pause
              </Button>
            )}
          </Card>
        ))}
    </div>
  );
}

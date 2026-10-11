// Mounts the original Activity log on /v1/audit-events (G18). Auditors and every-clinic administrators only.
import { useMemo } from "react";
import { ActivityLog as OriginalActivityLog } from "@/modules/settings";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { request } from "./client";
import { useWorkspace } from "./hooks";

type AuditEvent = {
  auditEventId: string;
  occurredAt: string;
  actorName: string | null;
  actorIsSystem: boolean;
  action: string;
  subjectType: string;
  subjectId: string | null;
  patientId: string | null;
  reason: string | null;
  diff: unknown;
  correlationId: string | null;
};

// Original filter names → API filter names.
const filters = (p: URLSearchParams) =>
  Object.fromEntries(
    (
      [
        ["actor", "actor"],
        ["target", "record"],
        ["action", "action"],
        ["start", "from"],
        ["end", "to"],
      ] as const
    )
      .map(([from, to]) => [to, p.get(from)?.trim() ?? ""])
      .filter(([, v]) => v),
  );
const item = (e: AuditEvent) => ({
  id: e.auditEventId,
  created_at: e.occurredAt,
  actor: e.actorName ?? "System",
  actor_type: e.actorIsSystem ? "system" : "staff",
  action: `${e.action} · ${e.subjectType}`,
  targets: Object.fromEntries(
    [
      ["record", e.subjectId],
      ["patient", e.patientId],
    ].filter(([, v]) => v),
  ),
  change: {
    ...(e.diff && typeof e.diff === "object" && !Array.isArray(e.diff) ? e.diff : e.diff == null ? {} : { value: e.diff }),
    ...(e.reason ? { reason: e.reason } : {}),
  },
  request_id: e.correlationId ?? "",
});

export function ActivityLogPage() {
  const { me } = useWorkspace();
  const source = useMemo<OriginalResourceSource>(
    () => ({
      scope: `${me.tenantId}:${me.staffId}:audit`,
      permissions: { role: me.staffType, allowed: {}, staff: [] },
      unavailableWrite: "Not available on this page.",
      async read<T>(path: string, signal: AbortSignal): Promise<T> {
        const url = new URL(path, location.origin);
        if (url.pathname !== "/api/v1/staff/audit") throw new Error("Not available on this page.");
        const q = new URLSearchParams({ ...filters(url.searchParams), limit: url.searchParams.get("limit") ?? "50" });
        const page = await request<{ items: AuditEvent[]; more: boolean }>(`/v1/audit-events?${q}`, { signal });
        return { items: page.items.map(item), more: page.more } as T;
      },
      async write<T>(path: string, options: { method?: string } = {}): Promise<T> {
        const url = new URL(path, location.origin);
        if (url.pathname !== "/api/v1/staff/audit/export" || options.method !== "POST") throw new Error("Not available on this page.");
        const out = await request<{ items: AuditEvent[]; truncated: boolean }>("/v1/audit-events/export", {
          method: "POST",
          body: filters(url.searchParams),
        });
        return { items: out.items.map(item), truncated: out.truncated } as T;
      },
    }),
    [me],
  );
  return (
    <OriginalResourceContext.Provider value={source}>
      <OriginalActivityLog />
    </OriginalResourceContext.Provider>
  );
}

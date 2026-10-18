// Header bell (Arc Notification center): the person's open *Now* alerts for this clinic (docs/prd/staff-alerts.md).
import { useMemo, useRef } from "react";
import { NotificationCenter, type NotificationItem } from "@/components/arc/notification-center/notification-center";
import { useWorkspace } from "./hooks";
import { useAlerts } from "./use-alerts";
import { whenLabel, type MarkedAlert } from "./alerts";

const UNAVAILABLE = "unavailable";

export function AlertsBell() {
  const { facility, go } = useWorkspace();
  const { alerts, unavailable, now, mark } = useAlerts();
  const open = useMemo(() => alerts.filter((a) => a.bucket === "now" && a.folder === "open"), [alerts]);
  const items = useMemo<NotificationItem[]>(
    () => [
      // The bell never shows "All clear" when a source could not be checked.
      ...(unavailable.length
        ? [{ id: UNAVAILABLE, title: "Some alerts could not be checked", description: `${unavailable.join(", ")} unavailable. Open Alerts to retry.`, time: "Now", tone: "warning" as const }]
        : []),
      ...open.map((a) => ({ id: a.key, title: a.title, description: `${a.who} · ${a.detail}`, time: whenLabel(a, now, facility.timezone), read: a.read, tone: a.tone })),
    ],
    [open, unavailable, now, facility.timezone],
  );
  const find = (n: NotificationItem) => open.filter((a) => a.key === n.id);
  // Mark all read and Clear read call back once per item in the same tick; save them together.
  const queued = useRef<{ read: MarkedAlert[]; dismissed: MarkedAlert[] }>({ read: [], dismissed: [] });
  const later = (kind: "read" | "dismissed", n: NotificationItem) => {
    const q = queued.current[kind];
    if (q.length === 0) queueMicrotask(() => void mark(queued.current[kind].splice(0), { [kind]: true }));
    q.push(...find(n));
  };
  return (
    <div className="arc-demo-scope workspace-alerts">
      <NotificationCenter
        label="Alerts"
        notifications={items}
        onReadChange={(n, read) => (read ? later("read", n) : void mark(find(n), { read }))}
        onDismiss={(n) => later("dismissed", n)}
        onOpen={(n) => go(n.id === UNAVAILABLE ? "alerts" : (find(n)[0]?.destination ?? "alerts"))}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Timeline } from "@/components/arc/timeline/timeline";
import { activityEvents, type AuditItem } from "./activity-feed-data";

export function ActivityFeed({ items, timezone }: { items: AuditItem[]; timezone: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") setNow(Date.now()); };
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return <div className="arc-demo-scope p-5">
    <Timeline label="Staff activity feed" now={now} timeZone={timezone} locale="en-IN" scrollToNew={false}
      events={activityEvents(items).map((event) => ({ ...event, detail: <dl className="space-y-3 text-sm">
        <div><dt className="font-medium">Action</dt><dd className="break-all">{event.action}</dd></div>
        <div><dt className="font-medium">Actor type</dt><dd>{event.actorType}</dd></div>
        <div><dt className="font-medium">Records</dt><dd className="break-all">{event.meta || "No record identifiers"}</dd></div>
        <div><dt className="font-medium">Changes</dt><dd><pre className="whitespace-pre-wrap break-words font-mono text-xs">{JSON.stringify(event.changes, null, 2)}</pre></dd></div>
        <div><dt className="font-medium">Request ID</dt><dd className="break-all">{event.requestId || "Not recorded"}</dd></div>
      </dl> }))} />
  </div>;
}

export type AuditItem = {
  id: string; created_at: string; actor: string; actor_type: string; action: string;
  targets: Record<string, string>; change: Record<string, unknown>; request_id: string;
};
/** No new events or outcomes: the feed and table share exactly the same server audit records. */
export function activityEvents(items: AuditItem[]) {
  return items.map((item) => ({
    id: item.id, at: item.created_at, actor: item.actor, title: item.action.replaceAll("_", " "),
    meta: Object.entries(item.targets).map(([key, value]) => `${key}: ${value}`).join(" · "),
    action: item.action, actorType: item.actor_type, changes: item.change, requestId: item.request_id,
  }));
}

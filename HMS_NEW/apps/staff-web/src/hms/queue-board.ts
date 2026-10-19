import type { KanbanColumn } from "@/components/arc/kanban-board/kanban-board";
import type { QueueToken } from "./types";
import { label } from "./model";
export type ClinicQueueToken = QueueToken & {
  doctorName: string;
  doctorStaffId: string;
};
const columns: KanbanColumn[] = [
  { id: "waiting", name: "Waiting" },
  { id: "called", name: "Called" },
  { id: "in_service", name: "With doctor" },
  { id: "done", name: "Completed" },
  { id: "skipped", name: "Skipped" },
];
export function queueColumns(tokens: ClinicQueueToken[]) {
  const known = new Set(columns.map((column) => column.id));
  return [
    ...columns,
    ...[...new Set(tokens.map((token) => token.status))]
      .filter((status) => !known.has(status))
      .map((status) => ({ id: status, name: label(status) })),
  ];
}
export type QueueMove = {
  tokenId: string;
  from: string;
  to: string;
  action: "start" | "skip" | "complete";
  label: string;
};
/** Calling order belongs to call-next; completed/skipped patients cannot be resurrected by dragging. */
export function queueMove(
  token: ClinicQueueToken,
  to: string,
  allowed: boolean,
  doctorStaffId?: string,
): QueueMove | null {
  if (!allowed || (doctorStaffId && doctorStaffId !== token.doctorStaffId))
    return null;
  const action =
    token.status === "called" && to === "in_service"
      ? "start"
      : ["waiting", "called"].includes(token.status) && to === "skipped"
        ? "skip"
        : token.status === "in_service" && to === "done"
          ? "complete"
          : null;
  return action
    ? {
        tokenId: token.tokenId,
        from: token.status,
        to,
        action,
        label:
          action === "start"
            ? "Start serving"
            : action === "skip"
              ? "Skip token"
              : "Complete service",
      }
    : null;
}

import { useState, type ReactNode } from "react";
import { KanbanBoard } from "@/components/arc/kanban-board/kanban-board";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-events";
import { useWorkspace, type useCommand } from "./hooks";
import { CommandReceiptRecovery } from "./CommandReceiptRecovery";
import { label } from "./model";
import {
  queueColumns,
  queueMove,
  type ClinicQueueToken,
  type QueueMove,
} from "./queue-board";
export function QueueBoard({
  tokens,
  command,
  unavailable,
  patient,
  onChanged,
  date,
}: {
  tokens: ClinicQueueToken[];
  command: ReturnType<typeof useCommand>;
  unavailable: boolean;
  patient: (token: ClinicQueueToken) => ReactNode;
  onChanged: (message: string) => void;
  date: string;
}) {
  const { can, go } = useWorkspace(),
    allowed = can("queue.manage"),
    locked = command.busy || command.unknown;
  const [selected, setSelected] = useState<string | null>(null),
    [move, setMove] = useState<QueueMove | null>(null);
  const token = tokens.find((item) => item.tokenId === selected);
  const freshMove =
    token &&
    move &&
    token.status === move.from &&
    queueMove(token, move.to, allowed);
  const propose = (id: string, to: string, doctorStaffId?: string) => {
    if (!allowed || locked || unavailable) return;
    const current = tokens.find((item) => item.tokenId === id);
    if (!current) return;
    const intent = queueMove(current, to, allowed, doctorStaffId);
    if (!intent) {
      toast.error(
        to === "called"
          ? "Use Call next patient to preserve the queue’s priority order."
          : "That queue move is unavailable. Doctor assignment and calling order stay unchanged.",
      );
      return;
    }
    setSelected(id);
    setMove(intent);
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Call next follows priority order. Move a card to review a status change.</p>
      <div className="arc-demo-scope arc-section-frame">
        <KanbanBoard
          title="Patient queue"
          columns={queueColumns(tokens)}
          people={[
            ...new Map(
              tokens.map((item) => [
                item.doctorStaffId,
                { id: item.doctorStaffId, name: item.doctorName },
              ]),
            ).values(),
          ]}
          cards={tokens.map((item) => ({
            id: item.tokenId,
            displayId: `Token ${item.tokenNo}`,
            title: item.doctorName,
            column: item.status,
            assignee: item.doctorStaffId,
            label: label(item.priority),
            body: patient(item),
          }))}
          allowCreate={false}
          readOnly={!allowed || locked || unavailable || !!selected}
          onOpenCard={(id) => {
            if (!locked && !unavailable) {
              setSelected(id);
              setMove(null);
            }
          }}
          onMoveRequest={propose}
        />
      </div>
      {!tokens.length && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No queue arrivals for this day.
        </p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !locked) {
            setSelected(null);
            setMove(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {move ? move.label : "Queue details"}
              {token ? ` · Token ${token.tokenNo}` : ""}
            </DialogTitle>
            <DialogDescription>
              {token
                ? `${token.doctorName} · ${label(token.status)}`
                : "This token is no longer in the current queue. Refresh before continuing."}
            </DialogDescription>
          </DialogHeader>
          {token && (
            <div className="space-y-4">
              {patient(token)}
              {move ? (
                <p className="text-sm">
                  {move.action === "complete"
                    ? "This completes the token and its linked appointment. An open consultation must be finished in Consultations first; the server will refuse this change while it is open."
                    : move.action === "skip"
                      ? "This skips the patient’s current queue token."
                      : "This marks the called patient as being served by the doctor."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allowed &&
                    ["in_service", "skipped", "done"].map((to) => {
                      const option = queueMove(token, to, true);
                      return (
                        option && (
                          <Button
                            key={to}
                            variant="outline"
                            disabled={locked || unavailable}
                            onClick={() => setMove(option)}
                          >
                            {option.label}
                          </Button>
                        )
                      );
                    })}
                  {can("encounters.read") && (
                    <Button
                      variant="outline"
                      disabled={locked}
                      onClick={() => {
                        setSelected(null);
                        go(
                          `consultations?patient=${token.patientId}&date=${date}`,
                        );
                      }}
                    >
                      Consultations
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          <CommandReceiptRecovery command={command} />
          {command.error && (
            <p role="alert" className="text-sm text-destructive">
              {command.error}
            </p>
          )}
          {move && !freshMove && (
            <p role="status" className="text-sm text-muted-foreground">
              The queue changed. Close this review and refresh before making a
              new change.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={locked}
              onClick={() => {
                setSelected(null);
                setMove(null);
              }}
            >
              Close
            </Button>
            {move && (
              <Button
                disabled={locked || unavailable || !freshMove}
                onClick={async () => {
                  if (!freshMove || unavailable || locked) return;
                  const result = await command.run(
                    `/v1/queue-tokens/${freshMove.tokenId}/${freshMove.action}`,
                  );
                  if (result) {
                    toast.success(`${freshMove.label} saved`);
                    onChanged(
                      `Token ${token?.tokenNo}: ${label(freshMove.to)}.`,
                    );
                    setSelected(null);
                    setMove(null);
                  }
                }}
              >
                {command.busy ? "Saving…" : move.label}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { dateTime, istDateTime } from "@/lib/api";
import { Action, Field, useApi } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { DeskAppointment } from "./NurseDesk";

/** One reviewed mutation per click; failed moves leave the original visit intact. */
export function AppointmentActions({
  item,
  allowed,
  onSaved,
}: {
  item: DeskAppointment;
  allowed: Record<string, boolean>;
  onSaved: () => void;
}) {
  const api = useApi();
  const [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false);
  const [start, setStart] = useState(istDateTime(new Date(item.starts_at))),
    [end, setEnd] = useState(istDateTime(new Date(item.ends_at)));
  const [reason, setReason] = useState(""),
    [deleteReason, setDeleteReason] = useState(""),
    [error, setError] = useState("");
  const operation = useRef({ signature: "", key: "" });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const startError = !start
    ? "Choose a new start date and time."
    : new Date(start + ":00+05:30").getTime() <= now
      ? "The new start must be in the future."
      : "";
  const endError = !end
    ? "Choose a new end date and time."
    : start >= end
      ? "End must be after start."
      : start.slice(0, 10) !== end.slice(0, 10)
        ? "Start and end must be on the same clinic day."
        : "";
  const unchanged =
    start === istDateTime(new Date(item.starts_at)) &&
    end === istDateTime(new Date(item.ends_at));
  const valid = !startError && !endError && !unchanged;
  const canMove =
    allowed["appointments.create"] &&
    item.status === "confirmed" &&
    new Date(item.starts_at).getTime() > now &&
    !item.deleted_at;
  const canDelete =
    allowed["appointments.delete"] &&
    item.status !== "completed" &&
    !item.deleted_at;
  if (!canMove && !canDelete) return null;
  return (
    <div className="w-full space-y-4 pb-5">
      <div className="flex flex-wrap gap-2">
        {canMove && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing(!editing);
              setError("");
            }}
          >
            <CalendarClock />
            Edit appointment time
          </Button>
        )}
        {canDelete && (
          <Button variant="outline" onClick={() => setDeleting(true)}>
            <Trash2 />
            Cancel appointment
          </Button>
        )}
      </div>
      {editing && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Enter exact start and end times. The doctor, clinic, patient and
            notes stay with this visit.
          </p>
          <Field
            label="New start · IST"
            id="move-start"
            error={
              startError ||
              (unchanged
                ? "Choose a different start or end time before saving."
                : undefined)
            }
          >
            <Input
              id="move-start"
              aria-invalid={!!startError || unchanged}
              type="datetime-local"
              step={60}
              value={start}
              onInput={(e) => {
                setStart(e.currentTarget.value);
                setError("");
              }}
              onChange={(e) => {
                setStart(e.target.value);
                setError("");
              }}
            />
          </Field>
          <Field label="New end · IST" id="move-end" error={endError}>
            <Input
              id="move-end"
              aria-invalid={!!endError}
              type="datetime-local"
              step={60}
              value={end}
              onInput={(e) => {
                setEnd(e.currentTarget.value);
                setError("");
              }}
              onChange={(e) => {
                setEnd(e.target.value);
                setError("");
              }}
            />
          </Field>
          <Field
            label="Reason for changing time"
            id="move-reason"
            error={
              reason.trim().length < 2
                ? "Enter a reason with at least 2 characters."
                : undefined
            }
          >
            <Input
              id="move-reason"
              value={reason}
              maxLength={240}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Action
            disabled={!valid || reason.trim().length < 2}
            run={async () => {
              const body = {
                starts_at: new Date(start + ":00+05:30").toISOString(),
                ends_at: new Date(end + ":00+05:30").toISOString(),
                reason: reason.trim(),
              };
              const signature = JSON.stringify(body);
              if (operation.current.signature !== signature)
                operation.current = { signature, key: crypto.randomUUID() };
              try {
                await api(
                  `/api/v1/admin/schedule-timeline/appointments/${item.id}/move`,
                  {
                    method: "POST",
                    body: { ...body, idempotency_key: operation.current.key },
                  },
                );
                onSaved();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not move this appointment.",
                );
                throw e;
              }
            }}
            success="Appointment time updated"
          >
            Save appointment time
          </Action>
        </div>
      )}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              {item.patient_name} · {dateTime(item.starts_at)}. This frees the
              time. The cancelled record and its reason stay in the
              appointment history and audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field
            label="Reason for cancelling"
            id="delete-reason"
            error={
              deleteReason.trim().length < 2
                ? "Enter a reason with at least 2 characters to cancel."
                : undefined
            }
          >
            <Input
              id="delete-reason"
              value={deleteReason}
              maxLength={240}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
            <Action
              variant="destructive"
              disabled={deleteReason.trim().length < 2}
              run={async () => {
                await api(
                  `/api/v1/admin/schedule-timeline/appointments/${item.id}`,
                  { method: "DELETE", body: { reason: deleteReason.trim() } },
                );
                setDeleting(false);
                onSaved();
              }}
              success="Appointment cancelled"
            >
              Cancel appointment
            </Action>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

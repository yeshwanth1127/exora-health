import { OriginalResourceContext } from "@/components/resource-source";
import { useUnsaved } from "@/hms/leave";
import { useContext, useState } from "react";
import { api } from "@/lib/api";
import { Action, Field } from "@/components/workspace";
import { Textarea } from "@/components/ui/textarea";
import type { DeskAppointment } from "./NurseDesk";

export function AppointmentNotes({
  item,
  canEdit,
  onSaved,
}: {
  item: DeskAppointment;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const source = useContext(OriginalResourceContext);
  const [notes, setNotes] = useState(item.staff_notes ?? "");
  useUnsaved(notes !== (item.staff_notes ?? ""));
  return (
    <div className="space-y-3">
      {canEdit ? (
        <>
          <Field label="Staff notes" id="appointment-notes">
            <Textarea
              id="appointment-notes"
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Arrival details or reception coordination"
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            {source
              ? "Saved staff notes are unavailable. Text here is a local draft only and cannot be saved or sent."
              : "Visible to clinic staff. These notes are not sent to the patient."}
          </p>
          <Action
            variant="outline"
            disabled={notes.trim() === (item.staff_notes ?? "")}
            run={async () => {
              await api(
                `/api/v1/admin/schedule-timeline/appointments/${item.id}/notes`,
                { method: "PATCH", body: { staff_notes: notes.trim() } },
              );
              onSaved();
            }}
            success="Staff notes saved"
          >
            Save notes
          </Action>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Staff notes</p>
          <p className="text-sm whitespace-pre-wrap">
            {source
              ? "Saved staff notes are not available yet."
              : item.staff_notes || "No staff notes."}
          </p>
        </>
      )}
    </div>
  );
}

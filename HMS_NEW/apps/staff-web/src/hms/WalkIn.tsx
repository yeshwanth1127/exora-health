import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommand, useWorkspace } from "./hooks";
import { PatientLookup, RegisterPatient } from "./Patients";
import { Choice, ErrorMessage, Field, Hint } from "./ui";
import { label } from "./model";
import { useUnsaved } from "./leave";
import type { Patient } from "./types";

export function WalkIn({
  staffId,
  onCreated,
}: {
  staffId: string;
  onCreated: (result: { tokenNo: number; sessionOn: string }) => void;
}) {
  const { facility, can } = useWorkspace(),
    cmd = useCommand();
  const [patient, setPatient] = useState<Patient | null>(null),
    [register, setRegister] = useState(false),
    [reason, setReason] = useState(""),
    [priority, setPriority] = useState("normal");
  useUnsaved(
    cmd.unknown || !!patient || !!reason.trim() || priority !== "normal",
  );
  return (
    <div className="p-6 space-y-5">
      <ErrorMessage text={cmd.error} />
      <Hint>
        This registers today's arrival and creates a queue token. The doctor
        must have remaining walk-in capacity at this facility.
      </Hint>
      {!patient ? (
        <>
          <PatientLookup onSelect={setPatient} />
          {can("patients.register") && (
            <Button variant="ghost" onClick={() => setRegister((v) => !v)}>
              {register ? "Hide registration" : "Register new patient"}
            </Button>
          )}
          {register && <RegisterPatient onCreated={setPatient} />}
        </>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p>
              {patient.name} · {patient.mrn}
            </p>
            <Button
              variant="ghost"
              disabled={cmd.busy || cmd.unknown}
              onClick={() => setPatient(null)}
            >
              Change patient
            </Button>
          </div>
          <Choice
            label="Queue priority"
            value={priority}
            onChange={setPriority}
            options={["normal", "senior_citizen", "emergency", "vip"].map(
              (v) => ({ value: v, label: label(v) }),
            )}
          />
          <Field title="Reason for visit (optional)" id="walk-in-reason">
            <Textarea
              id="walk-in-reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Button
            disabled={cmd.busy}
            onClick={async () => {
              const result = await cmd.run<{
                tokenNo: number;
                sessionOn: string;
              }>(
                "/v1/walk-ins",
                {
                  patientId: patient.patientId,
                  staffId,
                  facilityId: facility.facilityId,
                  priority,
                  ...(reason.trim() ? { reason: reason.trim() } : {}),
                },
                true,
              );
              if (result) onCreated(result);
            }}
          >
            {cmd.busy
              ? "Registering arrival…"
              : cmd.unknown
                ? "Recover the same walk-in request"
                : "Confirm walk-in arrival"}
          </Button>
        </>
      )}
    </div>
  );
}

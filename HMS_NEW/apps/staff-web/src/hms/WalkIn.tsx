import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/toast-events";
import { useCommand, useWorkspace } from "./hooks";
import { PatientLookup, RegisterPatient } from "./Patients";
import {
  QuickPatientFields,
  arrivalReady,
  arrivalBody,
} from "./QuickPatientFields";
import { Choice, ErrorMessage, Field } from "./ui";
import { label } from "./model";
import { requestLeave, useUnsaved } from "./leave";
import type { Patient } from "./types";

export function WalkIn({
  staffId: initialStaff = "",
  onCreated,
}: {
  staffId?: string;
  onCreated: (result: { tokenNo: number; sessionOn: string }) => void;
}) {
  const { facility, practitioners, can } = useWorkspace(),
    cmd = useCommand();
  const [staffId, setStaffId] = useState(initialStaff);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [mode, setMode] = useState(
    can("patients.register") ? "quick" : "search",
  );
  const [arrival, setArrival] = useState({ name: "", phone: "" });
  const [showOptions, setShowOptions] = useState(false);
  const [reason, setReason] = useState(""),
    [priority, setPriority] = useState("normal");
  const locked = cmd.busy || cmd.unknown;
  const doctors = [
    ...new Map(
      practitioners
        .filter((p) => p.facilityId === facility.facilityId)
        .map((p) => [p.staffId, p]),
    ).values(),
  ];
  const selected = doctors.some((p) => p.staffId === staffId) ? staffId : "";
  const ready =
    !!selected &&
    (!!patient ||
      (mode === "quick" && can("patients.register") && arrivalReady(arrival)));
  useUnsaved(
    cmd.unknown ||
      !!patient ||
      !!arrival.name ||
      !!arrival.phone ||
      !!reason.trim() ||
      priority !== "normal" ||
      staffId !== initialStaff,
    { pending: locked },
  );
  function changeMode(next: string) {
    if (next === mode) return;
    const change = () => {
      setMode(next);
      setPatient(null);
      setArrival({ name: "", phone: "" });
    };
    if (mode === "register" || patient || arrival.name || arrival.phone)
      requestLeave(change);
    else change();
  }

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-muted-foreground">
        Check the patient in and issue today’s queue token. The doctor must have
        walk-in capacity.
      </p>
      <Choice
        label="Doctor"
        value={selected}
        disabled={locked}
        onChange={setStaffId}
        options={[
          { value: "", label: "Choose a doctor" },
          ...doctors.map((p) => ({ value: p.staffId, label: p.name })),
        ]}
      />
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Arrival patient"
      >
        {can("patients.register") && (
          <Button
            variant={mode === "quick" ? "default" : "outline"}
            aria-pressed={mode === "quick"}
            disabled={locked}
            onClick={() => changeMode("quick")}
          >
            New patient · quick arrival
          </Button>
        )}
        <Button
          variant={mode === "search" ? "default" : "outline"}
          aria-pressed={mode === "search"}
          disabled={locked}
          onClick={() => changeMode("search")}
        >
          Find existing patient
        </Button>
      </div>
      <fieldset disabled={locked} className="space-y-5">
        {mode === "quick" && !patient ? (
          <QuickPatientFields
            value={arrival}
            onChange={setArrival}
            disabled={locked}
          />
        ) : patient ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {patient.name} · MRN {patient.mrn}
            </p>
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() => setPatient(null)}
            >
              Change patient
            </Button>
          </div>
        ) : mode === "register" ? (
          <RegisterPatient
            onCreated={(p) => {
              setPatient(p);
              setMode("search");
            }}
          />
        ) : (
          <PatientLookup
            onSelect={(p) => {
              if (!locked) setPatient(p);
            }}
          />
        )}
        {mode === "search" && !patient && can("patients.register") && (
          <Button variant="ghost" onClick={() => changeMode("register")}>
            Open full registration instead
          </Button>
        )}
        <Button
          variant="ghost"
          aria-expanded={showOptions}
          onClick={() => setShowOptions((v) => !v)}
        >
          Priority and visit reason (optional)
        </Button>
        {showOptions && (
          <div className="space-y-4 pt-4">
            <Choice
              label="Queue priority"
              value={priority}
              disabled={locked}
              onChange={setPriority}
              options={["normal", "senior_citizen", "emergency", "vip"].map(
                (v) => ({ value: v, label: label(v) }),
              )}
            />
            <Field title="Reason for visit" id="walk-in-reason">
              <Textarea
                id="walk-in-reason"
                maxLength={500}
                value={reason}
                disabled={locked}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>
        )}
      </fieldset>
      <ErrorMessage text={cmd.error} />
      <Button
        disabled={cmd.busy || (!cmd.unknown && !ready)}
        onClick={async () => {
          const body = {
            ...(patient
              ? { patientId: patient.patientId }
              : { newPatient: arrivalBody(arrival) }),
            staffId: selected,
            facilityId: facility.facilityId,
            priority,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          };
          const result = cmd.unknown
            ? await cmd.replay<{ tokenNo: number; sessionOn: string }>()
            : await cmd.run<{ tokenNo: number; sessionOn: string }>(
                "/v1/walk-ins",
                body,
                true,
              );
          if (result) {
            toast.success(`Checked in · Token ${result.tokenNo}`);
            onCreated(result);
          }
        }}
      >
        {cmd.busy
          ? "Checking in…"
          : cmd.unknown
            ? "Recover the same arrival request"
            : "Check in and issue token"}
      </Button>
    </div>
  );
}

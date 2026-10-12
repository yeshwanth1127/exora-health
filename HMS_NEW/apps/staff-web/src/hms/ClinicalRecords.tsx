import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCommand, useWorkspace } from "./hooks";
import { useUnsaved } from "./leave";
import { label } from "./model";
import { Choice, ErrorMessage, Field, Hint } from "./ui";
import type { Allergy, Problem, Vital } from "./types";

/** Emergency chart access: reasoned, time-limited and audited by the backend. */
export function BreakGlass({
  patientId,
  onGranted,
}: {
  patientId: string;
  onGranted: () => void;
}) {
  const { can } = useWorkspace(),
    cmd = useCommand();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [hours, setHours] = useState("4");
  useUnsaved(!!reason.trim() || cmd.unknown);
  if (!can("break_glass.use"))
    return (
      <Hint>
        Medical records are restricted to the treating doctor and assigned
        clinical staff. Your account is not assigned to this patient. Ask the
        clinic administrator to arrange access.
      </Hint>
    );
  return (
    <div className="space-y-3">
      <Hint>
        Your account is not assigned to this patient’s medical records. Ask the
        clinic administrator to arrange routine access. Emergency access is
        temporary and records your reason for review.
      </Hint>
      {open ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await cmd.run(
                `/v1/patients/${patientId}/break-glass`,
                { reason: reason.trim(), hours: Number(hours) },
                true,
              )
            ) {
              setReason("");
              setOpen(false);
              onGranted();
            }
          }}
        >
          <Field title="Emergency reason" id="break-glass-reason">
            <Textarea
              id="break-glass-reason"
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field title="Access duration" id="break-glass-hours">
            <Choice
              label="Access duration"
              value={hours}
              onChange={setHours}
              options={["1", "2", "4", "8", "12", "24"].map((h) => ({
                value: h,
                label: `${h} hour${h === "1" ? "" : "s"}`,
              }))}
            />
          </Field>
          <ErrorMessage text={cmd.error} />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              disabled={cmd.busy || reason.trim().length < 10}
            >
              <ShieldAlert />
              Open chart for emergency
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={cmd.unknown}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <ShieldAlert />
          Emergency access
        </Button>
      )}
    </div>
  );
}

const allergyEnds = ["inactive", "refuted", "entered_in_error"];
const problemEnds: [string, Record<string, string>][] = [
  ["Resolved", { clinicalStatus: "resolved" }],
  ["In remission", { clinicalStatus: "remission" }],
  ["Refuted", { verificationStatus: "refuted" }],
  ["Entered in error", { verificationStatus: "entered_in_error" }],
];

/** Active allergies and problems. The backend enforces care-team access on every change. */
export function AllergiesProblems({
  patientId,
  allergies,
  problems,
  editable,
  onChanged,
}: {
  patientId: string;
  allergies: Allergy[];
  problems: Problem[];
  editable: boolean;
  onChanged: () => void;
}) {
  const { can } = useWorkspace(),
    cmd = useCommand();
  const write = editable && can("clinical.write");
  const [adding, setAdding] = useState(false),
    [category, setCategory] = useState("drug"),
    [substance, setSubstance] = useState(""),
    [reaction, setReaction] = useState(""),
    [severity, setSeverity] = useState(""),
    [criticality, setCriticality] = useState("");
  useUnsaved(!!(substance.trim() || reaction.trim()) || cmd.unknown);
  const change = async (path: string, body: unknown, what: string) => {
    if (!window.confirm(what)) return;
    if (await cmd.run(path, body, false, "PATCH")) onChanged();
  };
  return (
    <div className="space-y-5">
      <ErrorMessage text={cmd.error} />
      <div className="space-y-2">
        <h3 className="font-semibold">Allergies</h3>
        {allergies.length ? (
          allergies.map((a) => (
            <div
              key={a.allergyId}
              className="flex items-center justify-between gap-3 border-b py-2 text-sm"
            >
              <span>
                <span className="font-medium">{a.substance}</span> ·{" "}
                {label(a.category)} · {a.reaction ?? "Reaction not recorded"}
                {a.severity && ` · ${label(a.severity)}`}
                {a.criticality === "high" && " · High criticality"}
              </span>
              {write && (
                <div className="w-44 shrink-0">
                  <Choice
                    label={`Change ${a.substance} status`}
                    value=""
                    disabled={cmd.busy || cmd.unknown}
                    onChange={(status) =>
                      change(
                        `/v1/allergies/${a.allergyId}`,
                        { status },
                        `Mark ${a.substance} allergy as ${label(status).toLowerCase()}?`,
                      )
                    }
                    options={allergyEnds.map((v) => ({
                      value: v,
                      label: `Mark ${label(v).toLowerCase()}`,
                    }))}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No active allergy records. This does not confirm the patient has no
            allergies.
          </p>
        )}
        {write &&
          (adding ? (
            <form
              className="space-y-3 rounded-md border p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await cmd.run(
                    `/v1/patients/${patientId}/allergies`,
                    {
                      category,
                      substance: substance.trim(),
                      ...(reaction.trim() ? { reaction: reaction.trim() } : {}),
                      ...(severity ? { severity } : {}),
                      ...(criticality ? { criticality } : {}),
                    },
                    true,
                  )
                ) {
                  setSubstance("");
                  setReaction("");
                  setSeverity("");
                  setCriticality("");
                  setAdding(false);
                  onChanged();
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field title="Category" id="allergy-category">
                  <Choice
                    label="Category"
                    value={category}
                    onChange={setCategory}
                    options={["drug", "food", "environment", "other"].map(
                      (v) => ({ value: v, label: label(v) }),
                    )}
                  />
                </Field>
                <Field title="Substance" id="allergy-substance">
                  <Input
                    id="allergy-substance"
                    required
                    maxLength={200}
                    value={substance}
                    onChange={(e) => setSubstance(e.target.value)}
                  />
                </Field>
                <Field title="Severity (optional)" id="allergy-severity">
                  <Choice
                    label="Severity"
                    value={severity}
                    onChange={setSeverity}
                    options={["mild", "moderate", "severe"].map((v) => ({
                      value: v,
                      label: label(v),
                    }))}
                  />
                </Field>
                <Field title="Criticality (optional)" id="allergy-criticality">
                  <Choice
                    label="Criticality"
                    value={criticality}
                    onChange={setCriticality}
                    options={["low", "high", "unable_to_assess"].map((v) => ({
                      value: v,
                      label: label(v),
                    }))}
                  />
                </Field>
              </div>
              <Field title="Reaction (optional)" id="allergy-reaction">
                <Input
                  id="allergy-reaction"
                  maxLength={500}
                  value={reaction}
                  onChange={(e) => setReaction(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={cmd.busy || !substance.trim()}
                >
                  Record allergy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={cmd.unknown}
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              disabled={cmd.unknown}
              onClick={() => setAdding(true)}
            >
              Add allergy
            </Button>
          ))}
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Active problems</h3>
        {problems.length ? (
          problems.map((p) => (
            <div
              key={p.conditionId}
              className="flex items-center justify-between gap-3 border-b py-2 text-sm"
            >
              <span>
                <span className="font-medium">{p.display}</span> ·{" "}
                {label(p.clinicalStatus)} · {label(p.verificationStatus)}
              </span>
              {write && (
                <div className="w-44 shrink-0">
                  <Choice
                    label={`Change ${p.display} status`}
                    value=""
                    disabled={cmd.busy || cmd.unknown}
                    onChange={(choice) => {
                      const [title, body] = problemEnds.find(
                        ([t]) => t === choice,
                      )!;
                      void change(
                        `/v1/conditions/${p.conditionId}`,
                        body,
                        `Mark ${p.display} as ${title.toLowerCase()}?`,
                      );
                    }}
                    options={problemEnds.map(([t]) => ({
                      value: t,
                      label: `Mark ${t.toLowerCase()}`,
                    }))}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No active problems. Problems are added from consultation diagnoses.
          </p>
        )}
      </div>
    </div>
  );
}

/** Amend a final vital with a new value, or mark it entered in error. */
export function VitalCorrection({
  vital,
  onSaved,
}: {
  vital: Vital;
  onSaved: () => void;
}) {
  const cmd = useCommand();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [reason, setReason] = useState("");
  useUnsaved(open && (!!reason.trim() || !!value.trim()));
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Correct
      </Button>
    );
  const numeric = vital.valueNum !== null;
  return (
    <form
      className="mt-2 w-full space-y-2 rounded-md border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const corrected = value.trim()
          ? numeric
            ? Number(value)
            : value.trim()
          : undefined;
        if (
          corrected === undefined &&
          !window.confirm(
            `No new value given. Mark this ${vital.display} reading as entered in error?`,
          )
        )
          return;
        if (
          await cmd.run(`/v1/observations/${vital.observationId}/correct`, {
            reason: reason.trim(),
            ...(corrected !== undefined ? { value: corrected } : {}),
          })
        ) {
          setOpen(false);
          onSaved();
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label={`Corrected ${vital.display}`}
          type={numeric ? "number" : "text"}
          step="any"
          placeholder="Corrected value (blank = entered in error)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Input
          aria-label="Correction reason"
          required
          minLength={3}
          maxLength={500}
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <ErrorMessage text={cmd.error} />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={cmd.busy || cmd.unknown || reason.trim().length < 3}
        >
          Save correction
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={cmd.unknown}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

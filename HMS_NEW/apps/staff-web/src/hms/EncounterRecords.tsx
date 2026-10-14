// The rest of the clinical record on one encounter (ERD m05): triage, immunizations, care plans,
// referrals, the medico-legal case, births and the death record. Each form posts to its /v1 command;
// the API checks the permission at the encounter's clinic and the care relationship.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { label } from "./model";
import { refusal } from "./forms";
import { Choice, ErrorMessage, Field, Hint, Status } from "./ui";
import type {
  ClinicDirectory,
  EncounterRecords as Records,
  Practitioner,
} from "./types";

const when = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const local = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 16);
};
const iso = (v: string) => new Date(v).toISOString();

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-3 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  open,
  onClick,
  children,
}: {
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      {open ? "Close" : children}
    </Button>
  );
}

const REASONS: Record<string, string> = {
  encounter_closed:
    "This encounter is closed; new records go on an open visit.",
  already_open: "This encounter already has a medico-legal record.",
  already_recorded: "This patient's death is already recorded.",
  duplicate_birth: "That birth order is already recorded.",
  not_recipient: "Only the doctor referred to can accept or decline.",
  invalid_transition:
    "That change isn't possible from the referral's current state.",
  already_issued: "The MCCD was already issued.",
  pending_investigation:
    "A medico-legal death pending investigation is certified after the post-mortem.",
};
function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const r = refusal(cmd.failure);
  return <ErrorMessage text={(r && REASONS[r]) || cmd.error} />;
}

export function EncounterRecords({
  encounterId,
  records,
  active,
  onChanged,
}: {
  encounterId: string;
  records: Records;
  active: boolean;
  onChanged: () => void;
}) {
  const { can } = useWorkspace();
  const write = can("clinical.write");
  return (
    <>
      <CarePlans
        encounterId={encounterId}
        records={records}
        active={active && write}
        onChanged={onChanged}
      />
      <Referrals
        encounterId={encounterId}
        records={records}
        write={active && write}
        onChanged={onChanged}
      />
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">
          Additional hospital records
        </summary>
        <Triage
          encounterId={encounterId}
          records={records}
          active={active && write}
          onChanged={onChanged}
        />
        <Immunizations
          encounterId={encounterId}
          records={records}
          active={active && write}
          onChanged={onChanged}
        />
        {(can("mlc.read") || can("mlc.record") || records.hasMlc) && (
          <Mlc
            encounterId={encounterId}
            records={records}
            onChanged={onChanged}
          />
        )}
        {(can("vital_records.record") ||
          records.births.length > 0 ||
          records.death) && (
          <VitalRecords
            encounterId={encounterId}
            records={records}
            onChanged={onChanged}
          />
        )}
      </details>
    </>
  );
}

function Triage({
  encounterId,
  records,
  active,
  onChanged,
}: {
  encounterId: string;
  records: Records;
  active: boolean;
  onChanged: () => void;
}) {
  const cmd = useCommand();
  const [open, setOpen] = useState(false),
    [category, setCategory] = useState("yellow"),
    [arrival, setArrival] = useState("walk_in"),
    [complaint, setComplaint] = useState(""),
    [reassess, setReassess] = useState("30");
  return (
    <Section
      title="Triage"
      action={
        active && (
          <Toggle open={open} onClick={() => setOpen(!open)}>
            Triage
          </Toggle>
        )
      }
    >
      {records.triage.map((t) => (
        <p key={t.triageId} className="text-sm">
          <Status value={t.category} /> {label(t.triageScale)} ·{" "}
          {t.arrivalMode ? label(t.arrivalMode) : "arrival not recorded"} ·{" "}
          {when(t.assessedAt)} by {t.assessedBy}
          {t.reassessDueAt ? ` · re-triage by ${when(t.reassessDueAt)}` : ""}
        </p>
      ))}
      {!records.triage.length && (
        <p className="text-sm text-muted-foreground">Not triaged.</p>
      )}
      {open && (
        <form
          className="grid grid-cols-2 gap-3 border rounded-lg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await cmd.run(`/v1/encounters/${encounterId}/triage`, {
              triageScale: "india_colour",
              category,
              arrivalMode: arrival,
              ...(complaint.trim() ? { chiefComplaint: complaint.trim() } : {}),
              ...(reassess ? { reassessInMinutes: Number(reassess) } : {}),
            });
            if (ok) {
              setOpen(false);
              onChanged();
            }
          }}
        >
          <Field title="Category" id="triage-category">
            <Choice
              label="Triage category"
              value={category}
              onChange={setCategory}
              options={["red", "yellow", "green", "black"].map((v) => ({
                value: v,
                label: label(v),
              }))}
            />
          </Field>
          <Field title="Arrived by" id="triage-arrival">
            <Choice
              label="Arrival mode"
              value={arrival}
              onChange={setArrival}
              options={[
                "walk_in",
                "ambulance_108",
                "private_ambulance",
                "police",
                "referred",
              ].map((v) => ({ value: v, label: label(v) }))}
            />
          </Field>
          <Field title="Chief complaint" id="triage-complaint">
            <Input
              id="triage-complaint"
              maxLength={500}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
          </Field>
          <Field title="Re-triage in (minutes)" id="triage-reassess">
            <Input
              id="triage-reassess"
              type="number"
              min={5}
              max={720}
              value={reassess}
              onChange={(e) => setReassess(e.target.value)}
            />
          </Field>
          <div className="col-span-2">
            <Refused cmd={cmd} />
            <Button type="submit" disabled={cmd.busy}>
              Save triage
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

function Immunizations({
  encounterId,
  records,
  active,
  onChanged,
}: {
  encounterId: string;
  records: Records;
  active: boolean;
  onChanged: () => void;
}) {
  const { me } = useWorkspace(),
    cmd = useCommand();
  const [open, setOpen] = useState(false),
    [vaccine, setVaccine] = useState(""),
    [dose, setDose] = useState(""),
    [lot, setLot] = useState(""),
    [route, setRoute] = useState("intramuscular"),
    [site, setSite] = useState(""),
    [given, setGiven] = useState(true),
    [notDone, setNotDone] = useState("");
  return (
    <Section
      title="Immunizations"
      action={
        active && (
          <Toggle open={open} onClick={() => setOpen(!open)}>
            Record vaccination
          </Toggle>
        )
      }
    >
      {records.immunizations.map((i) => (
        <div
          key={i.immunizationId}
          className="flex items-center justify-between text-sm"
        >
          <span>
            {i.vaccine}
            {i.doseNumber ? ` · dose ${i.doseNumber}` : ""} ·{" "}
            {i.status === "not_done"
              ? `not given (${i.notDoneReason})`
              : `${i.route ? label(i.route) : ""} ${i.site ?? ""}`}{" "}
            · {when(i.administeredAt)}
            {i.status === "entered_in_error" && " · entered in error"}
          </span>
          {i.administeredBy === me.staffId &&
            i.status !== "entered_in_error" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={cmd.busy}
                onClick={async () => {
                  const why = window.prompt("Why is this entry wrong?");
                  if (
                    why &&
                    why.trim().length >= 3 &&
                    (await cmd.run(
                      `/v1/immunizations/${i.immunizationId}/entered-in-error`,
                      { reason: why.trim() },
                    ))
                  )
                    onChanged();
                }}
              >
                Entered in error
              </Button>
            )}
        </div>
      ))}
      {open && (
        <form
          className="grid grid-cols-2 gap-3 border rounded-lg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await cmd.run(
              `/v1/encounters/${encounterId}/immunizations`,
              {
                vaccine: vaccine.trim(),
                ...(dose ? { doseNumber: Number(dose) } : {}),
                ...(lot.trim() ? { lotNumber: lot.trim() } : {}),
                ...(given
                  ? { route, ...(site.trim() ? { site: site.trim() } : {}) }
                  : { status: "not_done", notDoneReason: notDone.trim() }),
              },
            );
            if (ok) {
              setOpen(false);
              setVaccine("");
              onChanged();
            }
          }}
        >
          <Field title="Vaccine" id="imm-vaccine">
            <Input
              id="imm-vaccine"
              required
              maxLength={120}
              value={vaccine}
              onChange={(e) => setVaccine(e.target.value)}
            />
          </Field>
          <Field title="Dose number" id="imm-dose">
            <Input
              id="imm-dose"
              type="number"
              min={1}
              max={20}
              value={dose}
              onChange={(e) => setDose(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between col-span-2">
            <Label htmlFor="imm-given">Given</Label>
            <Switch id="imm-given" checked={given} onCheckedChange={setGiven} />
          </div>
          {given ? (
            <>
              <Field title="Route" id="imm-route">
                <Choice
                  label="Route"
                  value={route}
                  onChange={setRoute}
                  options={[
                    "intramuscular",
                    "subcutaneous",
                    "intradermal",
                    "oral",
                    "intranasal",
                  ].map((v) => ({ value: v, label: label(v) }))}
                />
              </Field>
              <Field title="Site" id="imm-site">
                <Input
                  id="imm-site"
                  maxLength={60}
                  value={site}
                  placeholder="Left deltoid"
                  onChange={(e) => setSite(e.target.value)}
                />
              </Field>
              <Field title="Lot number" id="imm-lot">
                <Input
                  id="imm-lot"
                  maxLength={60}
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <Field title="Why it wasn't given" id="imm-notdone">
              <Input
                id="imm-notdone"
                required
                maxLength={300}
                value={notDone}
                onChange={(e) => setNotDone(e.target.value)}
              />
            </Field>
          )}
          <div className="col-span-2">
            <Refused cmd={cmd} />
            <Button
              type="submit"
              disabled={
                cmd.busy || !vaccine.trim() || (!given && !notDone.trim())
              }
            >
              Save vaccination
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

const KINDS = [
  "medication",
  "observation",
  "procedure",
  "education",
  "diet",
  "follow_up",
  "other",
];

function CarePlans({
  encounterId,
  records,
  active,
  onChanged,
}: {
  encounterId: string;
  records: Records;
  active: boolean;
  onChanged: () => void;
}) {
  const cmd = useCommand();
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [activities, setActivities] = useState([
      { kind: "follow_up", description: "", frequency: "" },
    ]);
  const ready =
    title.trim().length >= 3 &&
    activities.every((a) => a.description.trim().length >= 2);
  return (
    <Section
      title="Care plans"
      action={
        active && (
          <Toggle open={open} onClick={() => setOpen(!open)}>
            New care plan
          </Toggle>
        )
      }
    >
      {!records.carePlans.length && (
        <p className="text-sm text-muted-foreground">
          No care plans recorded for this visit.
        </p>
      )}
      {records.carePlans.map((p) => (
        <div
          key={p.carePlanId}
          className="border rounded-lg p-3 space-y-2 text-sm"
        >
          <div className="flex justify-between gap-3">
            <span className="font-medium">{p.title}</span>
            <Status value={p.status} />
          </div>
          {p.activities.map((a) => (
            <div
              key={a.activityId}
              className="flex items-center justify-between gap-3"
            >
              <span>
                {label(a.kind)} · {a.description}
                {a.frequency ? ` · ${a.frequency}` : ""} ·{" "}
                <span className="text-muted-foreground">{label(a.status)}</span>
              </span>
              {p.status === "active" &&
                ["planned", "in_progress"].includes(a.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cmd.busy}
                    onClick={async () => {
                      if (
                        await cmd.run(
                          `/v1/care-plan-activities/${a.activityId}/status`,
                          { status: "completed" },
                        )
                      )
                        onChanged();
                    }}
                  >
                    Done
                  </Button>
                )}
            </div>
          ))}
          {p.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                if (
                  await cmd.run(`/v1/care-plans/${p.carePlanId}/status`, {
                    status: "completed",
                    reason: "Plan completed",
                  })
                )
                  onChanged();
              }}
            >
              Complete plan
            </Button>
          )}
        </div>
      ))}
      {open && (
        <form
          className="space-y-3 border rounded-lg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await cmd.run(
              `/v1/encounters/${encounterId}/care-plans`,
              {
                title: title.trim(),
                activities: activities.map((a) => ({
                  kind: a.kind,
                  description: a.description.trim(),
                  ...(a.frequency.trim()
                    ? { frequency: a.frequency.trim() }
                    : {}),
                })),
              },
            );
            if (ok) {
              setOpen(false);
              setTitle("");
              setActivities([
                { kind: "follow_up", description: "", frequency: "" },
              ]);
              onChanged();
            }
          }}
        >
          <Field title="Plan" id="plan-title">
            <Input
              id="plan-title"
              maxLength={200}
              value={title}
              placeholder="Diabetes control"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          {activities.map((a, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Choice
                label={`Activity ${i + 1} kind`}
                value={a.kind}
                onChange={(v) =>
                  setActivities(
                    activities.map((x, j) => (j === i ? { ...x, kind: v } : x)),
                  )
                }
                options={KINDS.map((v) => ({ value: v, label: label(v) }))}
              />
              <Input
                aria-label={`Activity ${i + 1}`}
                value={a.description}
                maxLength={500}
                placeholder="What to do"
                onChange={(e) =>
                  setActivities(
                    activities.map((x, j) =>
                      j === i ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                aria-label={`Activity ${i + 1} frequency`}
                value={a.frequency}
                maxLength={100}
                placeholder="How often"
                onChange={(e) =>
                  setActivities(
                    activities.map((x, j) =>
                      j === i ? { ...x, frequency: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setActivities([
                ...activities,
                { kind: "other", description: "", frequency: "" },
              ])
            }
          >
            Add activity
          </Button>
          <Refused cmd={cmd} />
          <Button type="submit" disabled={cmd.busy || !ready}>
            Save care plan
          </Button>
        </form>
      )}
    </Section>
  );
}

function Referrals({
  encounterId,
  records,
  write,
  onChanged,
}: {
  encounterId: string;
  records: Records;
  write: boolean;
  onChanged: () => void;
}) {
  const { facility, practitioners, me } = useWorkspace(),
    cmd = useCommand();
  const directory = useQuery<ClinicDirectory>(
    `/v1/facilities/${facility.facilityId}/directory`,
  );
  const [open, setOpen] = useState(false),
    [direction, setDirection] = useState("internal"),
    [to, setTo] = useState(""),
    [dept, setDept] = useState(""),
    [org, setOrg] = useState(""),
    [doctor, setDoctor] = useState(""),
    [why, setWhy] = useState(""),
    [urgency, setUrgency] = useState("routine");
  const doctors = practitioners.filter(
    (p: Practitioner) => p.staffId !== me.staffId,
  );
  return (
    <Section
      title="Referrals"
      action={
        write && (
          <Toggle open={open} onClick={() => setOpen(!open)}>
            Refer
          </Toggle>
        )
      }
    >
      {!records.referrals.length && (
        <p className="text-sm text-muted-foreground">
          No referrals recorded for this visit.
        </p>
      )}
      {records.referrals.map((r) => (
        <div
          key={r.referralId}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span>
            {r.toStaffName ?? r.toDepartmentName ?? r.externalOrg} ·{" "}
            {label(r.urgency)} · {r.reason}
            {r.responseNote ? ` · “${r.responseNote}”` : ""}
          </span>
          <span className="flex items-center gap-2">
            <Status value={r.status} />
            {r.toStaffId === me.staffId && r.status === "sent" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cmd.busy}
                  onClick={async () => {
                    if (
                      await cmd.run(`/v1/referrals/${r.referralId}/respond`, {
                        status: "accepted",
                      })
                    )
                      onChanged();
                  }}
                >
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cmd.busy}
                  onClick={async () => {
                    if (
                      await cmd.run(`/v1/referrals/${r.referralId}/respond`, {
                        status: "rejected",
                      })
                    )
                      onChanged();
                  }}
                >
                  Decline
                </Button>
              </>
            )}
            {r.referredBy === me.staffId &&
              ["sent", "accepted"].includes(r.status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cmd.busy}
                  onClick={async () => {
                    if (
                      await cmd.run(`/v1/referrals/${r.referralId}/respond`, {
                        status: "cancelled",
                      })
                    )
                      onChanged();
                  }}
                >
                  Cancel
                </Button>
              )}
          </span>
        </div>
      ))}
      {open && (
        <form
          className="grid grid-cols-2 gap-3 border rounded-lg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const target =
              direction === "internal"
                ? {
                    ...(to ? { toStaffId: to } : {}),
                    ...(dept ? { toDepartmentId: dept } : {}),
                  }
                : {
                    externalOrg: org.trim(),
                    ...(doctor.trim() ? { externalDoctor: doctor.trim() } : {}),
                  };
            const ok = await cmd.run(
              `/v1/encounters/${encounterId}/referrals`,
              { direction, reason: why.trim(), urgency, ...target },
            );
            if (ok) {
              setOpen(false);
              setWhy("");
              onChanged();
            }
          }}
        >
          <Field title="To" id="ref-direction">
            <Choice
              label="Referral direction"
              value={direction}
              onChange={setDirection}
              options={[
                { value: "internal", label: "This hospital" },
                { value: "outbound", label: "Another hospital" },
              ]}
            />
          </Field>
          <Field title="Urgency" id="ref-urgency">
            <Choice
              label="Urgency"
              value={urgency}
              onChange={setUrgency}
              options={["routine", "urgent", "emergency"].map((v) => ({
                value: v,
                label: label(v),
              }))}
            />
          </Field>
          {direction === "internal" ? (
            <>
              <Field title="Doctor" id="ref-doctor">
                <Choice
                  label="Refer to doctor"
                  value={to || "none"}
                  onChange={(v) => setTo(v === "none" ? "" : v)}
                  options={[
                    { value: "none", label: "Any doctor in the department" },
                    ...doctors.map((d) => ({
                      value: d.staffId,
                      label: d.name,
                    })),
                  ]}
                />
              </Field>
              <Field title="Department" id="ref-dept">
                <Choice
                  label="Refer to department"
                  value={dept || "none"}
                  onChange={(v) => setDept(v === "none" ? "" : v)}
                  options={[
                    { value: "none", label: "—" },
                    ...(directory.data?.departments ?? []).map((d) => ({
                      value: d.departmentId,
                      label: d.name,
                    })),
                  ]}
                />
              </Field>
            </>
          ) : (
            <>
              <Field title="Hospital" id="ref-org">
                <Input
                  id="ref-org"
                  required
                  maxLength={200}
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                />
              </Field>
              <Field title="Doctor (optional)" id="ref-ext-doctor">
                <Input
                  id="ref-ext-doctor"
                  maxLength={100}
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                />
              </Field>
            </>
          )}
          <div className="col-span-2">
            <Field title="Reason" id="ref-reason">
              <Textarea
                id="ref-reason"
                required
                maxLength={2000}
                value={why}
                onChange={(e) => setWhy(e.target.value)}
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Refused cmd={cmd} />
            <Button
              type="submit"
              disabled={
                cmd.busy ||
                why.trim().length < 3 ||
                (direction === "internal" ? !to && !dept : !org.trim())
              }
            >
              Send referral
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

const MLC_TYPES = [
  "road_traffic",
  "assault",
  "burns",
  "poisoning",
  "fall",
  "sexual_assault",
  "animal_bite",
  "industrial",
  "suspected_suicide",
  "brought_dead",
  "other",
];

function Mlc({
  encounterId,
  records,
  onChanged,
}: {
  encounterId: string;
  records: Records;
  onChanged: () => void;
}) {
  const { can } = useWorkspace(),
    cmd = useCommand();
  const m = records.mlc;
  const [type, setType] = useState(m?.mlc_type ?? "road_traffic"),
    [broughtBy, setBroughtBy] = useState(m?.brought_by_name ?? ""),
    [place, setPlace] = useState(m?.incident_place ?? ""),
    [station, setStation] = useState(m?.police_station ?? ""),
    [ref, setRef] = useState(m?.intimation_ref ?? ""),
    [officer, setOfficer] = useState(m?.officer_name ?? ""),
    [pocso, setPocso] = useState(m?.is_pocso ?? false);
  if (records.hasMlc && !m)
    return (
      <Section title="Medico-legal case">
        <Hint>
          This visit is a medico-legal case. Its details are visible to staff
          with medico-legal access.
        </Hint>
      </Section>
    );
  const editable = can("mlc.record");
  return (
    <Section title={m ? `Medico-legal case ${m.mlc_no}` : "Medico-legal case"}>
      {!m && !editable && (
        <p className="text-sm text-muted-foreground">
          Not a medico-legal case.
        </p>
      )}
      {(m || editable) && (
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = {
              mlcType: type,
              broughtByName: broughtBy.trim() || null,
              incidentPlace: place.trim() || null,
              policeStation: station.trim() || null,
              intimationRef: ref.trim() || null,
              officerName: officer.trim() || null,
              isPocso: pocso,
              ...(station.trim() && !m?.police_intimated_at
                ? {
                    policeIntimatedAt: new Date().toISOString(),
                    intimationMode: "phone",
                  }
                : {}),
            };
            const ok = m
              ? await cmd.run(
                  `/v1/mlc-records/${m.id}`,
                  { version: m.version, ...body },
                  false,
                  "PATCH",
                )
              : await cmd.run(`/v1/encounters/${encounterId}/mlc`, body);
            if (ok) onChanged();
          }}
        >
          <fieldset disabled={!editable} className="contents">
            <Field title="Type" id="mlc-type">
              <Choice
                label="MLC type"
                value={type}
                disabled={!editable}
                onChange={setType}
                options={MLC_TYPES.map((v) => ({ value: v, label: label(v) }))}
              />
            </Field>
            <Field title="Brought by" id="mlc-brought">
              <Input
                id="mlc-brought"
                maxLength={100}
                value={broughtBy}
                onChange={(e) => setBroughtBy(e.target.value)}
              />
            </Field>
            <Field title="Incident place" id="mlc-place">
              <Input
                id="mlc-place"
                maxLength={300}
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
            </Field>
            <Field title="Police station" id="mlc-station">
              <Input
                id="mlc-station"
                maxLength={150}
                value={station}
                onChange={(e) => setStation(e.target.value)}
              />
            </Field>
            <Field title="Intimation reference" id="mlc-ref">
              <Input
                id="mlc-ref"
                maxLength={100}
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
            </Field>
            <Field title="Officer" id="mlc-officer">
              <Input
                id="mlc-officer"
                maxLength={100}
                value={officer}
                onChange={(e) => setOfficer(e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between col-span-2">
              <Label htmlFor="mlc-pocso">POCSO case</Label>
              <Switch
                id="mlc-pocso"
                checked={pocso}
                disabled={!editable}
                onCheckedChange={setPocso}
              />
            </div>
          </fieldset>
          {m?.police_intimated_at && (
            <p className="text-xs text-muted-foreground col-span-2">
              Police informed {when(m.police_intimated_at)}.
            </p>
          )}
          {editable && (
            <div className="col-span-2">
              <Refused cmd={cmd} />
              <Button
                type="submit"
                variant={m ? "outline" : "default"}
                disabled={cmd.busy}
              >
                {m ? "Save medico-legal details" : "Open medico-legal case"}
              </Button>
            </div>
          )}
        </form>
      )}
    </Section>
  );
}

function VitalRecords({
  encounterId,
  records,
  onChanged,
}: {
  encounterId: string;
  records: Records;
  onChanged: () => void;
}) {
  const { can } = useWorkspace(),
    cmd = useCommand();
  const allowed = can("vital_records.record");
  const [birth, setBirth] = useState(false),
    [death, setDeath] = useState(false);
  const [b, setB] = useState({
    bornAt: local(),
    sex: "female",
    weight: "",
    weeks: "",
    method: "normal_vaginal",
    apgar1: "",
    apgar5: "",
    live: true,
    order: String(records.births.length + 1),
  });
  const [d, setD] = useState({
    diedAt: local(),
    causes: ["", ""],
    manner: "natural",
    pm: false,
  });
  return (
    <Section title="Births and death">
      {records.births.map((x) => (
        <p key={x.id} className="text-sm">
          Baby {x.birth_order} · {label(x.sex)} ·{" "}
          {x.birth_weight_g ? `${x.birth_weight_g} g` : "weight not recorded"} ·{" "}
          {label(x.delivery_method)} ·{" "}
          {x.is_live_birth ? "live birth" : "stillbirth"} · {when(x.born_at)}
          {x.civil_registration_ref
            ? ` · registered ${x.civil_registration_ref}`
            : ""}
        </p>
      ))}
      {records.death && (
        <div className="text-sm space-y-1">
          <p>
            Died {when(records.death.died_at)} · {label(records.death.manner)} ·{" "}
            {(records.death.cause_chain as string[]).join(" ← ")}
          </p>
          <p className="text-muted-foreground">
            {records.death.mccd_issued_at
              ? `MCCD ${label(records.death.mccd_form ?? "")} issued`
              : "MCCD not issued"}{" "}
            ·{" "}
            {records.death.body_released_at
              ? `body released to ${records.death.body_released_to}`
              : "body not released"}
          </p>
          {allowed && !records.death.mccd_issued_at && (
            <Button
              variant="outline"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                if (
                  await cmd.run(
                    `/v1/death-records/${records.death!.id}/certify`,
                    { mccdForm: "form_4" },
                  )
                )
                  onChanged();
              }}
            >
              Issue MCCD (Form 4)
            </Button>
          )}
          {allowed && !records.death.body_released_at && (
            <Button
              variant="outline"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                const to = window.prompt(
                  "Body released to (name and relationship)",
                );
                if (
                  to &&
                  to.trim().length >= 2 &&
                  (await cmd.run(
                    `/v1/death-records/${records.death!.id}/certify`,
                    { bodyReleasedTo: to.trim() },
                  ))
                )
                  onChanged();
              }}
            >
              Release body
            </Button>
          )}
        </div>
      )}
      {allowed && (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setBirth(!birth)}>
            {birth ? "Close" : "Record a birth"}
          </Button>
          {!records.death && (
            <Button variant="ghost" size="sm" onClick={() => setDeath(!death)}>
              {death ? "Close" : "Record death"}
            </Button>
          )}
        </div>
      )}
      {birth && (
        <form
          className="grid grid-cols-2 gap-3 border rounded-lg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const num = (v: string) => (v ? Number(v) : null);
            const ok = await cmd.run(`/v1/encounters/${encounterId}/births`, {
              bornAt: iso(b.bornAt),
              sex: b.sex,
              birthWeightG: num(b.weight),
              gestationWeeks: num(b.weeks),
              deliveryMethod: b.method,
              apgar1: num(b.apgar1),
              apgar5: num(b.apgar5),
              isLiveBirth: b.live,
              birthOrder: Number(b.order),
            });
            if (ok) {
              setBirth(false);
              onChanged();
            }
          }}
        >
          <Field title="Born at" id="birth-at">
            <Input
              id="birth-at"
              type="datetime-local"
              value={b.bornAt}
              onChange={(e) => setB({ ...b, bornAt: e.target.value })}
            />
          </Field>
          <Field title="Sex" id="birth-sex">
            <Choice
              label="Baby sex"
              value={b.sex}
              onChange={(v) => setB({ ...b, sex: v })}
              options={["female", "male", "other", "unknown"].map((v) => ({
                value: v,
                label: label(v),
              }))}
            />
          </Field>
          <Field title="Weight (g)" id="birth-weight">
            <Input
              id="birth-weight"
              type="number"
              min={200}
              max={7000}
              value={b.weight}
              onChange={(e) => setB({ ...b, weight: e.target.value })}
            />
          </Field>
          <Field title="Gestation (weeks)" id="birth-weeks">
            <Input
              id="birth-weeks"
              type="number"
              min={20}
              max={45}
              value={b.weeks}
              onChange={(e) => setB({ ...b, weeks: e.target.value })}
            />
          </Field>
          <Field title="Delivery" id="birth-method">
            <Choice
              label="Delivery method"
              value={b.method}
              onChange={(v) => setB({ ...b, method: v })}
              options={[
                "normal_vaginal",
                "assisted_vaginal",
                "lscs",
                "other",
              ].map((v) => ({ value: v, label: label(v) }))}
            />
          </Field>
          <Field title="Birth order" id="birth-order">
            <Input
              id="birth-order"
              type="number"
              min={1}
              max={9}
              value={b.order}
              onChange={(e) => setB({ ...b, order: e.target.value })}
            />
          </Field>
          <Field title="APGAR 1 min" id="birth-a1">
            <Input
              id="birth-a1"
              type="number"
              min={0}
              max={10}
              value={b.apgar1}
              onChange={(e) => setB({ ...b, apgar1: e.target.value })}
            />
          </Field>
          <Field title="APGAR 5 min" id="birth-a5">
            <Input
              id="birth-a5"
              type="number"
              min={0}
              max={10}
              value={b.apgar5}
              onChange={(e) => setB({ ...b, apgar5: e.target.value })}
            />
          </Field>
          <div className="flex items-center justify-between col-span-2">
            <Label htmlFor="birth-live">Live birth</Label>
            <Switch
              id="birth-live"
              checked={b.live}
              onCheckedChange={(v) => setB({ ...b, live: v })}
            />
          </div>
          <div className="col-span-2">
            <Refused cmd={cmd} />
            <Button type="submit" disabled={cmd.busy}>
              Save birth
            </Button>
          </div>
        </form>
      )}
      {death && (
        <form
          className="grid grid-cols-2 gap-3 border rounded-lg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const causeChain = d.causes.map((c) => c.trim()).filter(Boolean);
            if (
              await cmd.run(`/v1/encounters/${encounterId}/death`, {
                diedAt: iso(d.diedAt),
                causeChain,
                manner: d.manner,
                postMortemRequired: d.pm,
              })
            ) {
              setDeath(false);
              onChanged();
            }
          }}
        >
          <Field title="Time of death" id="death-at">
            <Input
              id="death-at"
              type="datetime-local"
              value={d.diedAt}
              onChange={(e) => setD({ ...d, diedAt: e.target.value })}
            />
          </Field>
          <Field title="Manner" id="death-manner">
            <Choice
              label="Manner of death"
              value={d.manner}
              onChange={(v) => setD({ ...d, manner: v })}
              options={[
                "natural",
                "accident",
                "suicide",
                "homicide",
                "pending_investigation",
                "undetermined",
              ].map((v) => ({ value: v, label: label(v) }))}
            />
          </Field>
          <Field title="Immediate cause" id="death-c1">
            <Input
              id="death-c1"
              maxLength={300}
              value={d.causes[0]}
              onChange={(e) =>
                setD({ ...d, causes: [e.target.value, d.causes[1]!] })
              }
            />
          </Field>
          <Field title="Due to (antecedent)" id="death-c2">
            <Input
              id="death-c2"
              maxLength={300}
              value={d.causes[1]}
              onChange={(e) =>
                setD({ ...d, causes: [d.causes[0]!, e.target.value] })
              }
            />
          </Field>
          <div className="flex items-center justify-between col-span-2">
            <Label htmlFor="death-pm">Post-mortem required</Label>
            <Switch
              id="death-pm"
              checked={d.pm}
              onCheckedChange={(v) => setD({ ...d, pm: v })}
            />
          </div>
          <div className="col-span-2">
            <Refused cmd={cmd} />
            <Button
              type="submit"
              variant="destructive"
              disabled={cmd.busy || !d.causes[0]!.trim()}
            >
              Record death
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

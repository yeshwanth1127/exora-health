import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { today, label, needsCareAccess, templateFields } from "./model";
import {
  Choice,
  Empty,
  ErrorMessage,
  Field,
  Hint,
  LoadingState,
  Status,
} from "./ui";
import { PatientChart } from "./Patients";
import { confirmLeave, useUnsaved } from "./leave";
import {
  AllergiesProblems,
  BreakGlass,
  VitalCorrection,
} from "./ClinicalRecords";
import { EncounterRecords } from "./EncounterRecords";
import type {
  EncounterDetail,
  EncounterRow,
  Note,
  NoteTemplate,
} from "./types";

export function Consultations() {
  const { facility, can } = useWorkspace();
  const [date, setDate] = useState(today(facility.timezone)),
    [status, setStatus] = useState("all"),
    [selected, setSelected] = useState<EncounterRow | null>(null);
  const result = useQuery<{ items: EncounterRow[] }>(
    `/v1/encounters?${query({ facilityId: facility.facilityId, date, status: status === "all" ? undefined : status })}`,
    5000,
  );
  return (
    <>
      <PageTitle
        title="Consultations"
        description="Arrivals become encounters when the worker processes check-in."
      />
      <div className="flex gap-3 mb-5">
        <Input
          aria-label="Consultation date"
          type="date"
          className="w-44"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="w-48">
          <Choice
            label="Encounter status"
            value={status}
            onChange={setStatus}
            options={[
              "all",
              "arrived",
              "in_progress",
              "finished",
              "cancelled",
            ].map((v) => ({
              value: v,
              label: v === "all" ? "All encounters" : label(v),
            }))}
          />
        </div>
        <Button variant="outline" onClick={result.refresh}>
          Refresh
        </Button>
      </div>
      <LoadingState {...result}>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data?.items.map((e) => (
                <TableRow key={e.encounterId}>
                  <TableCell>
                    <div className="font-medium">{e.patientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.mrn} · {e.encounterNo}
                    </div>
                  </TableCell>
                  <TableCell>{e.attendingName}</TableCell>
                  <TableCell>{e.tokenNo ?? "—"}</TableCell>
                  <TableCell>
                    <Status value={e.status} />
                  </TableCell>
                  <TableCell>
                    {can("clinical.read") ? (
                      <Button variant="ghost" onClick={() => setSelected(e)}>
                        Open
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Clinical access required
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.data?.items.length === 0 && (
            <Empty>
              No encounters for this day. If a patient was just checked in,
              refresh shortly.
            </Empty>
          )}
        </Card>
      </LoadingState>
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && confirmLeave()) setSelected(null);
          }}
        >
          <SheetContent className="overflow-y-auto sm:max-w-3xl">
            <SheetHeader>
              <SheetTitle>{selected.patientName}</SheetTitle>
              <SheetDescription>
                {selected.encounterNo} · {selected.attendingName}
              </SheetDescription>
            </SheetHeader>
            <Encounter row={selected} onChanged={result.refresh} />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
function Encounter({
  row,
  onChanged,
}: {
  row: EncounterRow;
  onChanged: () => void;
}) {
  const { me, can } = useWorkspace();
  const result = useQuery<EncounterDetail>(`/v1/encounters/${row.encounterId}`);
  const cmd = useCommand();
  const [chart, setChart] = useState(false),
    [narrative, setNarrative] = useState(""),
    [templateCode, setTemplateCode] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [diagnosis, setDiagnosis] = useState(""),
    [disposition, setDisposition] = useState("discharged_home"),
    [followUp, setFollowUp] = useState(""),
    [finish, setFinish] = useState(false);
  const templates = useQuery<{ items: NoteTemplate[] }>(
    can("clinical.read") ? "/v1/note-templates" : null,
  );
  // Nurses write nursing notes (signed by them, G27); doctors write consultation notes.
  const nurse = me.staffType === "nurse";
  const noteKind = nurse ? "nursing" : "consultation";
  const consultTemplates = [
    ...new Map(
      (templates.data?.items ?? [])
        .filter((t) => t.noteType === noteKind)
        .map((t) => [t.code, t]),
    ).values(),
  ];
  const template = consultTemplates.find((t) => t.code === templateCode);
  const filled = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v.trim()),
  );
  const noteReady = template
    ? Object.keys(filled).length > 0
    : !!narrative.trim();
  useUnsaved(
    !!narrative.trim() || Object.keys(filled).length > 0 || cmd.unknown,
  );
  const active = ["arrived", "in_progress"].includes(
    result.data?.encounter.status ?? row.status,
  );
  const assignedDoctor =
    me.staffType === "doctor" && me.staffId === row.attendingStaffId;
  const refresh = () => {
    result.refresh();
    onChanged();
  };
  return (
    <div className="p-6 space-y-6">
      <ErrorMessage text={cmd.error} />
      {needsCareAccess(result.failure) && (
        <BreakGlass patientId={row.patientId} onGranted={refresh} />
      )}
      <LoadingState
        {...result}
        error={needsCareAccess(result.failure) ? "" : result.error}
      >
        {result.data && (
          <>
            <div className="flex justify-between items-center">
              <Status value={result.data.encounter.status} />
              <Button variant="outline" onClick={() => setChart((v) => !v)}>
                {chart ? "Hide patient chart" : "Patient chart"}
              </Button>
            </div>
            <p className="text-sm">
              Chief complaint:{" "}
              {result.data.encounter.chiefComplaint ?? "Not recorded"}
            </p>
            {chart && (
              <PatientChart patientId={row.patientId} editable={false} />
            )}
            {active && can("clinical.write") && (
              <Vitals encounterId={row.encounterId} onSaved={refresh} />
            )}
            <div>
              <h3 className="font-semibold mb-3">Recorded vitals</h3>
              {result.data.vitals.length ? (
                result.data.vitals.map((v) => (
                  <div
                    key={v.observationId}
                    className="flex flex-wrap items-center justify-between border-b py-2 text-sm"
                  >
                    <span>{v.display}</span>
                    <span className="flex items-center gap-2">
                      {v.valueNum ?? v.valueText} {v.unit} · {label(v.status)}
                      {v.status === "final" && can("clinical.write") && (
                        <VitalCorrection vital={v} onSaved={refresh} />
                      )}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No vitals recorded.
                </p>
              )}
            </div>
            {assignedDoctor &&
              can("encounters.manage") &&
              result.data.encounter.status === "arrived" && (
                <Button
                  disabled={cmd.busy || cmd.unknown}
                  onClick={async () => {
                    if (
                      await cmd.run(`/v1/encounters/${row.encounterId}/start`)
                    )
                      refresh();
                  }}
                >
                  <Stethoscope />
                  Start consultation
                </Button>
              )}
            <div className="space-y-4">
              <h3 className="font-semibold">Clinical notes</h3>
              {result.data.notes.map((note) => (
                <NoteEditor
                  key={note.noteId}
                  note={note}
                  template={templates.data?.items.find(
                    (t) => t.code === note.templateCode,
                  )}
                  active={active}
                  onSaved={refresh}
                />
              ))}
              {active && (assignedDoctor || nurse) && can("clinical.write") && (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await cmd.run(
                        `/v1/encounters/${row.encounterId}/notes`,
                        template
                          ? {
                              noteType: template.noteType,
                              templateCode: template.code,
                              data: filled,
                              ...(narrative.trim()
                                ? { narrative: narrative.trim() }
                                : {}),
                            }
                          : {
                              noteType: noteKind,
                              narrative: narrative.trim(),
                            },
                        true,
                      )
                    ) {
                      setNarrative("");
                      setFields({});
                      refresh();
                    }
                  }}
                >
                  {consultTemplates.length > 0 && (
                    <Field title="Note format" id="note-template">
                      <Choice
                        label="Note format"
                        value={templateCode || "free"}
                        disabled={cmd.unknown}
                        onChange={(v) => {
                          setTemplateCode(v === "free" ? "" : v);
                          setFields({});
                        }}
                        options={[
                          { value: "free", label: "Free text" },
                          ...consultTemplates.map((t) => ({
                            value: t.code,
                            label: t.name,
                          })),
                        ]}
                      />
                    </Field>
                  )}
                  {template &&
                    templateFields(template.schema).map(([key, title]) => (
                      <Field key={key} title={title} id={`note-${key}`}>
                        <Textarea
                          id={`note-${key}`}
                          maxLength={20000}
                          rows={3}
                          value={fields[key] ?? ""}
                          onChange={(e) =>
                            setFields({ ...fields, [key]: e.target.value })
                          }
                        />
                      </Field>
                    ))}
                  <Field
                    title={
                      template
                        ? "Additional narrative (optional)"
                        : nurse
                          ? "New nursing note"
                          : "New consultation note"
                    }
                    id="new-note"
                  >
                    <Textarea
                      id="new-note"
                      maxLength={20000}
                      required={!template}
                      rows={template ? 3 : 6}
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                    />
                  </Field>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={cmd.busy || !noteReady}
                  >
                    Save draft note
                  </Button>
                </form>
              )}
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Diagnoses</h3>
              {result.data.diagnoses.map((d) => (
                <p key={d.encounterDiagnosisId} className="text-sm">
                  {d.display} · {label(d.role)} · {label(d.verificationStatus)}
                </p>
              ))}
              {active && assignedDoctor && can("clinical.write") && (
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await cmd.run(
                        `/v1/encounters/${row.encounterId}/diagnoses`,
                        {
                          role: "primary",
                          display: diagnosis.trim(),
                          verificationStatus: "provisional",
                        },
                      )
                    ) {
                      setDiagnosis("");
                      refresh();
                    }
                  }}
                >
                  <Input
                    aria-label="Diagnosis description"
                    value={diagnosis}
                    placeholder="Provisional diagnosis description"
                    maxLength={300}
                    onChange={(e) => setDiagnosis(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={cmd.busy || cmd.unknown || !diagnosis.trim()}
                  >
                    Add diagnosis
                  </Button>
                </form>
              )}
            </div>
            <AllergiesProblems
              patientId={row.patientId}
              allergies={result.data.allergies}
              problems={result.data.problems}
              editable={active}
              onChanged={refresh}
            />
            <EncounterRecords
              encounterId={row.encounterId}
              records={result.data.records}
              active={active}
              onChanged={refresh}
            />
            {assignedDoctor &&
              can("encounters.manage") &&
              result.data.encounter.status === "in_progress" && (
                <div className="space-y-3 border-t pt-5">
                  {result.data.notes.some((n) => n.status === "draft") ? (
                    <Hint>
                      Sign the draft notes before finishing this consultation.
                    </Hint>
                  ) : finish ? (
                    <form
                      className="space-y-3"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await cmd.run(
                            `/v1/encounters/${row.encounterId}/finish`,
                            {
                              disposition,
                              ...(disposition === "follow_up"
                                ? { followUpAdvisedOn: followUp }
                                : {}),
                            },
                          )
                        ) {
                          setFinish(false);
                          refresh();
                        }
                      }}
                    >
                      <Field title="Disposition" id="disposition">
                        <Choice
                          label="Disposition"
                          value={disposition}
                          onChange={setDisposition}
                          options={[
                            "discharged_home",
                            "follow_up",
                            "referred_out",
                          ].map((v) => ({ value: v, label: label(v) }))}
                        />
                      </Field>
                      {disposition === "follow_up" && (
                        <Field title="Follow-up date" id="follow-up">
                          <Input
                            id="follow-up"
                            type="date"
                            required
                            value={followUp}
                            onChange={(e) => setFollowUp(e.target.value)}
                          />
                        </Field>
                      )}
                      <p className="text-xs text-muted-foreground">
                        The worker completes the appointment and queue after
                        this encounter is finished.
                      </p>
                      <Button type="submit" disabled={cmd.busy || cmd.unknown}>
                        Confirm visit completion
                      </Button>
                    </form>
                  ) : (
                    <Button onClick={() => setFinish(true)}>
                      Finish consultation
                    </Button>
                  )}
                </div>
              )}
          </>
        )}
      </LoadingState>
      {cmd.unknown && (
        <Button
          variant="outline"
          onClick={async () => {
            if (await result.refresh()) {
              cmd.reconciled();
              onChanged();
            }
          }}
        >
          Refresh saved encounter
        </Button>
      )}
    </div>
  );
}
function NoteEditor({
  note,
  template,
  active,
  onSaved,
}: {
  note: Note;
  template?: NoteTemplate;
  active: boolean;
  onSaved: () => void;
}) {
  const { me, can } = useWorkspace(),
    cmd = useCommand();
  const savedFields = () =>
    Object.fromEntries(
      Object.entries(note.data ?? {}).map(([k, v]) => [k, String(v ?? "")]),
    );
  const [editing, setEditing] = useState(false),
    [text, setText] = useState(note.narrative ?? ""),
    [fields, setFields] = useState<Record<string, string>>(savedFields),
    [reason, setReason] = useState(""),
    [voiding, setVoiding] = useState(false),
    [voidReason, setVoidReason] = useState("");
  const structure = template
    ? templateFields(template.schema)
    : Object.keys(note.data ?? {}).map((k) => [k, label(k)] as const);
  const fieldsChanged =
    JSON.stringify(fields) !== JSON.stringify(savedFields());
  useUnsaved(
    (editing && (text !== (note.narrative ?? "") || fieldsChanged)) ||
      (voiding && !!voidReason.trim()),
  );
  const signed = ["signed", "amended"].includes(note.status),
    own = note.authorStaffId === me.staffId,
    voided = note.status === "entered_in_error";
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm font-medium">
            {template?.name ?? label(note.noteType)} · v{note.currentVersion}
          </span>
          <Status value={note.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          {note.authorName}
          {note.signedAt ? " · Signed" : ""}
        </p>
        {editing ? (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await cmd.run(
                  `/v1/notes/${note.noteId}`,
                  {
                    baseVersion: note.currentVersion,
                    narrative: text,
                    ...(structure.length ? { data: fields } : {}),
                    ...(signed ? { amendmentReason: reason.trim() } : {}),
                  },
                  false,
                  "PUT",
                )
              ) {
                setEditing(false);
                onSaved();
              }
            }}
          >
            {structure.map(([key, title]) => (
              <Field key={key} title={title} id={`edit-${note.noteId}-${key}`}>
                <Textarea
                  id={`edit-${note.noteId}-${key}`}
                  maxLength={20000}
                  rows={3}
                  value={fields[key] ?? ""}
                  onChange={(e) =>
                    setFields({ ...fields, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <Textarea
              aria-label="Edit clinical note"
              required={!structure.length}
              value={text}
              maxLength={20000}
              rows={structure.length ? 3 : 6}
              onChange={(e) => setText(e.target.value)}
            />
            {signed && (
              <Input
                aria-label="Amendment reason"
                required
                minLength={3}
                placeholder="Reason for amendment"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={cmd.busy || cmd.unknown}>
                Save {signed ? "amendment" : "draft"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Discard changes
              </Button>
            </div>
          </form>
        ) : (
          <div className={voided ? "line-through opacity-60" : undefined}>
            {structure.map(([key, title]) =>
              note.data?.[key] ? (
                <div key={key} className="text-sm">
                  <p className="font-medium">{title}</p>
                  <p className="whitespace-pre-wrap">
                    {String(note.data[key])}
                  </p>
                </div>
              ) : null,
            )}
            {note.narrative && (
              <p className="text-sm whitespace-pre-wrap">{note.narrative}</p>
            )}
          </div>
        )}
        <ErrorMessage text={cmd.error} />
        {voiding && (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await cmd.run(`/v1/notes/${note.noteId}/entered-in-error`, {
                  reason: voidReason.trim(),
                })
              ) {
                setVoiding(false);
                setVoidReason("");
                onSaved();
              }
            }}
          >
            <Input
              aria-label="Reason the note was entered in error"
              required
              minLength={3}
              maxLength={500}
              placeholder="Why was this note entered in error?"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The note stays in the record, struck through, with your reason.
            </p>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  cmd.busy || cmd.unknown || voidReason.trim().length < 3
                }
              >
                Mark entered in error
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setVoiding(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
        {!editing && !voiding && own && can("clinical.write") && !voided && (
          <div className="flex gap-2">
            {active && (
              <Button
                variant="outline"
                onClick={() => {
                  setText(note.narrative ?? "");
                  setFields(savedFields());
                  setEditing(true);
                }}
              >
                {signed ? "Amend" : "Edit draft"}
              </Button>
            )}
            {active && note.status === "draft" && can("clinical.sign") && (
              <Button
                disabled={cmd.busy || cmd.unknown}
                onClick={async () => {
                  if (await cmd.run(`/v1/notes/${note.noteId}/sign`)) onSaved();
                }}
              >
                Sign note
              </Button>
            )}
            <Button variant="ghost" onClick={() => setVoiding(true)}>
              Entered in error
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// Seeded pilot codes only; configurable observation definitions are tracked in G13.
const vitals = [
  ["BP_SYS", "Systolic BP", "mmHg"],
  ["BP_DIA", "Diastolic BP", "mmHg"],
  ["PULSE", "Pulse", "/min"],
  ["TEMP", "Temperature", "°C"],
  ["SPO2", "Oxygen saturation", "%"],
] as const;
function Vitals({
  encounterId,
  onSaved,
}: {
  encounterId: string;
  onSaved: () => void;
}) {
  const cmd = useCommand(),
    [values, setValues] = useState<Record<string, string>>({});
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const entries = Object.entries(values)
          .filter(([, v]) => v.trim())
          .map(([code, v]) => ({ code, value: Number(v) }));
        if (
          entries.length &&
          (await cmd.run(`/v1/encounters/${encounterId}/vitals`, {
            values: entries,
          }))
        ) {
          setValues({});
          onSaved();
        }
      }}
    >
      <h3 className="font-semibold">Record vitals</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {vitals.map(([code, title, unit]) => (
          <Field key={code} title={`${title} (${unit})`} id={`vital-${code}`}>
            <Input
              id={`vital-${code}`}
              type="number"
              step="any"
              value={values[code] ?? ""}
              onChange={(e) => setValues({ ...values, [code]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <ErrorMessage text={cmd.error} />
      <Button
        type="submit"
        variant="outline"
        disabled={
          cmd.busy ||
          cmd.unknown ||
          !Object.values(values).some((v) => v.trim())
        }
      >
        Save vitals
      </Button>
      <p className="text-xs text-muted-foreground">
        Using the seeded pilot definitions. Clinic-specific vital definitions
        are pending.
      </p>
    </form>
  );
}

import { DayNavigator } from "@/components/date-controls";
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
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { query } from "./client";
import { today, label, needsCareAccess, templateFields } from "./model";
import { Choice, ErrorMessage, Field, Hint, LoadingState, Status } from "./ui";
import { FullPage } from "./FullPage";
import { PatientChart, TestPatientBadge } from "./Patients";
import { NewConsultation } from "./NewConsultation";
import { patientDisplayName } from "./patient-presentation";
import { useUnsaved } from "./leave";
import {
  AllergiesProblems,
  BreakGlass,
  VitalCorrection,
} from "./ClinicalRecords";
import type {
  EncounterDetail,
  EncounterRow,
  Note,
  NoteTemplate,
} from "./types";

export function Consultations() {
  const { facility, can, go } = useWorkspace();
  const params = new URLSearchParams(location.search);
  const patientId = params.get("patient");
  const [openedId, setOpenedId] = useState(() => params.get("encounter"));
  const [creating, setCreating] = useState(() => params.get("new") === "1");
  const [date, setDate] = useState(
      params.get("date") ?? today(facility.timezone),
    ),
    [status, setStatus] = useState("all"),
    [selected, setSelected] = useState<EncounterRow | null>(null);
  const result = useQuery<{ items: EncounterRow[] }>(
    `/v1/encounters?${query({ facilityId: facility.facilityId, date, status: status === "all" ? undefined : status })}`,
    5000,
  );
  const opened = useQuery<EncounterDetail>(
    openedId && can("clinical.read") ? `/v1/encounters/${openedId}` : null,
  );
  const close = () => {
    setSelected(null);
    setCreating(false);
    setOpenedId(null);
    history.replaceState(history.state, "", location.pathname);
    result.refresh();
  };
  if (creating)
    return (
      <FullPage
        title="Create unbooked visit"
        back="Back to consultations"
        onBack={close}
      >
        <NewConsultation
          onOpened={(id) => {
            setCreating(false);
            setOpenedId(id);
            history.replaceState(
              history.state,
              "",
              `${location.pathname}?encounter=${id}`,
            );
            result.refresh();
          }}
        />
      </FullPage>
    );
  if (selected)
    return (
      <FullPage
        title={
          ["finished", "cancelled"].includes(selected.status)
            ? "Visit summary"
            : "Consultation"
        }
        back="Back to consultations"
        onBack={close}
      >
        <Encounter
          key={selected.encounterId}
          row={selected}
          onChanged={result.refresh}
        />
      </FullPage>
    );
  if (openedId)
    return (
      <FullPage
        title={
          opened.data?.encounter.status === "finished"
            ? "Visit summary"
            : "Consultation"
        }
        back="Back to consultations"
        onBack={close}
      >
        {needsCareAccess(opened.failure) && (
          <Hint>
            Medical records are available to the treating doctor and assigned
            clinical staff. Your account is not currently assigned to this
            patient. Ask the clinic administrator to arrange access.
          </Hint>
        )}
        <LoadingState
          {...opened}
          error={needsCareAccess(opened.failure) ? "" : opened.error}
        >
          {opened.data && (
            <Encounter
              row={{
                encounterId: openedId,
                encounterNo: opened.data.encounter.encounterNo,
                patientId: opened.data.patient.patientId,
                patientName:
                  `${opened.data.patient.givenName} ${opened.data.patient.familyName ?? ""}`.trim(),
                mrn: opened.data.patient.mrn,
                attendingStaffId: opened.data.encounter.attendingStaffId,
                attendingName: "",
                status: opened.data.encounter.status,
                appointmentId: opened.data.encounter.appointmentId,
                arrivedAt: "",
                tokenNo: null,
              }}
              onChanged={result.refresh}
            />
          )}
        </LoadingState>
      </FullPage>
    );
  return (
    <>
      <PageTitle
        title="Consultations"
        action={
          can("encounters.manage") &&
          can("clinical.read") &&
          can("patients.read") &&
          can("encounters.read") ? (
            <Button onClick={() => setCreating(true)}>
              Create unbooked visit
            </Button>
          ) : undefined
        }
      />
      <div className="flex items-start gap-4 mb-5">
        <DayNavigator label="Date" value={date} onChange={setDate} timezone={facility.timezone} />
        <div className="w-48">
          <Choice
            label="Visit status"
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
              label: v === "all" ? "All visits" : label(v),
            }))}
          />
        </div>
        <Button variant="outline" className="mt-7" onClick={result.refresh}>
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
              {result.data?.items
                .filter((e) => !patientId || e.patientId === patientId)
                .map((e) => (
                  <TableRow key={e.encounterId}>
                    <TableCell>
                      <div className="font-medium">
                        {patientDisplayName(e.patientId, e.patientName)}{" "}
                        <TestPatientBadge patientId={e.patientId} />
                      </div>
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
                          {["finished", "cancelled"].includes(e.status)
                            ? "View summary"
                            : "Continue visit"}
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
          {result.data?.items.filter(
            (e) => !patientId || e.patientId === patientId,
          ).length === 0 && (
            <WorkspaceEmpty
              title={
                patientId || status !== "all"
                  ? "No visits match this patient, status and date"
                  : "No visits to work on"
              }
              description={
                patientId || status !== "all"
                  ? "Try another patient, status or date."
                  : "Checked-in patients appear here."
              }
              action={
                can("appointments.read")
                  ? {
                      label: "Open appointments",
                      onClick: () => go("appointments"),
                    }
                  : undefined
              }
            />
          )}
        </Card>
      </LoadingState>
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
  const { me, can, go, practitioners } = useWorkspace();
  const result = useQuery<EncounterDetail>(`/v1/encounters/${row.encounterId}`);
  const cmd = useCommand();
  const [panel, setPanel] = useState("notes"),
    [completed, setCompleted] = useState(false),
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
    !!narrative.trim() ||
      Object.keys(filled).length > 0 ||
      !!diagnosis.trim() ||
      finish ||
      cmd.unknown,
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
  if (completed)
    return (
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Visit completed</h2>
        <p className="text-sm text-muted-foreground">
          {row.appointmentId
            ? "The linked appointment will update after processing. You can review its status in Appointments."
            : "This was an unbooked visit. Existing appointments have not been completed by this visit."}
        </p>
        <p>
          The visit was saved and closed. Your notes remain in the patient’s
          medical history.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => go("consultations")}>
            Back to consultations
          </Button>
          <Button
            variant="outline"
            onClick={() => go(`patients?patient=${row.patientId}`)}
          >
            Patient history
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-6">
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
            <div className="rounded-lg border p-5 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {patientDisplayName(
                      row.patientId,
                      `${result.data.patient.givenName} ${result.data.patient.familyName ?? ""}`.trim(),
                    )}{" "}
                    <TestPatientBadge patientId={row.patientId} />
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    MRN {result.data.patient.mrn} · {row.encounterNo} ·{" "}
                    {row.attendingName ||
                      practitioners.find(
                        (p) => p.staffId === row.attendingStaffId,
                      )?.name ||
                      "Treating doctor"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => go(`patients?patient=${row.patientId}`)}
                >
                  Open patient record
                </Button>
              </div>
              <p className="text-sm">
                {active
                  ? "Review patient history, document findings and concerns, sign your notes, then complete the visit."
                  : `Closed visit · ${label(result.data.encounter.disposition ?? result.data.encounter.status)}. For today’s care, start a new visit.`}
              </p>
              {!active && can("encounters.manage") && (
                <Button
                  onClick={() =>
                    go(`consultations?new=1&patient=${row.patientId}`)
                  }
                >
                  Create an unbooked visit
                </Button>
              )}
              <Status value={result.data.encounter.status} />
              <p className="text-sm">
                Reason for visit:{" "}
                {result.data.encounter.chiefComplaint ?? "Not recorded"}
              </p>
              <nav
                aria-label="Consultation sections"
                className={`grid ${active ? "grid-cols-4" : "grid-cols-3"} gap-2 border-t pt-4`}
              >
                {[
                  {
                    id: "notes",
                    name: active ? "1. Visit note" : "Saved notes",
                  },
                  { id: "findings", name: "Vitals & findings" },
                  { id: "history", name: "Patient history" },
                  ...(active
                    ? [{ id: "completion", name: "Complete visit" }]
                    : []),
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant={panel === item.id ? "default" : "outline"}
                    aria-pressed={panel === item.id}
                    onClick={() => setPanel(item.id)}
                  >
                    {item.name}
                  </Button>
                ))}
              </nav>
            </div>
            <div className="space-y-6">
              <div className="min-w-0 space-y-6">
                <section hidden={panel !== "history"} className="space-y-4">
                  <h2 className="text-lg font-semibold">Patient history</h2>
                  <PatientChart patientId={row.patientId} editable={false} />
                </section>
                <section hidden={panel !== "findings"} className="space-y-5">
                  <h2 className="text-lg font-semibold">Vitals & findings</h2>
                  <p className="text-sm">
                    Reason for visit:{" "}
                    {result.data.encounter.chiefComplaint ?? "Not recorded"}
                  </p>
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
                            {v.valueNum ?? v.valueText} {v.unit} ·{" "}
                            {label(v.status)}
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
                </section>
                <section hidden={panel !== "notes"} className="space-y-5">
                  <h2 className="text-lg font-semibold">
                    {active ? "Visit note" : "Saved visit notes"}
                  </h2>
                  {!active && (
                    <p className="text-sm text-muted-foreground">
                      This visit is closed.
                    </p>
                  )}
                  {assignedDoctor &&
                    can("encounters.manage") &&
                    result.data.encounter.status === "arrived" && (
                      <Button
                        disabled={cmd.busy || cmd.unknown}
                        onClick={async () => {
                          if (
                            await cmd.run(
                              `/v1/encounters/${row.encounterId}/start`,
                            )
                          )
                            refresh();
                        }}
                      >
                        <Stethoscope />
                        Start consultation
                      </Button>
                    )}
                  <div className="space-y-4">
                    <h3 id="visit-notes" className="font-semibold">
                      Clinical notes
                    </h3>
                    {!result.data.notes.length && (
                      <p className="text-sm text-muted-foreground">
                        No notes were saved for this visit.
                      </p>
                    )}
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
                    {active &&
                      (assignedDoctor || nurse) &&
                      can("clinical.write") && (
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
                            templateFields(template.schema).map(
                              ([key, title]) => (
                                <Field
                                  key={key}
                                  title={title}
                                  id={`note-${key}`}
                                >
                                  <Textarea
                                    id={`note-${key}`}
                                    maxLength={20000}
                                    rows={3}
                                    value={fields[key] ?? ""}
                                    onChange={(e) =>
                                      setFields({
                                        ...fields,
                                        [key]: e.target.value,
                                      })
                                    }
                                  />
                                </Field>
                              ),
                            )}
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
                    {!result.data.diagnoses.length && (
                      <p className="text-sm text-muted-foreground">
                        No diagnoses recorded.
                      </p>
                    )}
                    {result.data.diagnoses.map((d) => (
                      <p key={d.encounterDiagnosisId} className="text-sm">
                        {d.display} · {label(d.role)} ·{" "}
                        {label(d.verificationStatus)}
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
                          disabled={
                            cmd.busy || cmd.unknown || !diagnosis.trim()
                          }
                        >
                          Add diagnosis
                        </Button>
                      </form>
                    )}
                  </div>
                </section>
                <section hidden={panel !== "findings"} className="space-y-5">
                  <AllergiesProblems
                    patientId={row.patientId}
                    allergies={result.data.allergies}
                    problems={result.data.problems}
                    editable={active}
                    onChanged={refresh}
                  />
                </section>
              </div>
              <aside
                hidden={!active || panel !== "completion"}
                id="visit-completion"
                className="max-w-3xl rounded-lg border p-5 space-y-5"
              >
                <h2 className="text-lg font-semibold">Complete visit</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt>Signed notes</dt>
                    <dd>
                      {
                        result.data.notes.filter((n) => n.status === "signed")
                          .length
                      }
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Draft notes to resolve</dt>
                    <dd>
                      {
                        result.data.notes.filter((n) => n.status === "draft")
                          .length
                      }
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Recorded diagnoses</dt>
                    <dd>{result.data.diagnoses.length}</dd>
                  </div>
                </dl>
                {(!assignedDoctor || !can("encounters.manage")) && (
                  <p className="text-sm">
                    The assigned doctor completes this visit.
                  </p>
                )}
                {assignedDoctor &&
                  result.data.encounter.status === "arrived" && (
                    <p className="text-sm">
                      Start the consultation before completing it.
                    </p>
                  )}
                {!active && (
                  <p className="text-sm">
                    This visit is closed. Its saved notes and records remain
                    available for review.
                  </p>
                )}
                {assignedDoctor &&
                  can("encounters.manage") &&
                  result.data.encounter.status === "in_progress" && (
                    <div className="space-y-3 border-t pt-5">
                      {noteReady || diagnosis.trim() ? (
                        <Hint>
                          Save or clear your unsaved note and diagnosis before
                          completing the visit.
                        </Hint>
                      ) : result.data.notes.some(
                          (n) => n.status === "draft",
                        ) ? (
                        <Hint>
                          Sign the draft notes before finishing this
                          consultation.
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
                              setCompleted(true);
                              onChanged();
                            }
                          }}
                        >
                          <Field title="Outcome of this visit" id="disposition">
                            <Choice
                              label="Outcome of this visit"
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
                          <Button
                            type="submit"
                            disabled={cmd.busy || cmd.unknown}
                          >
                            Confirm visit completion
                          </Button>
                        </form>
                      ) : (
                        <Button onClick={() => setFinish(true)}>
                          Choose outcome & complete
                        </Button>
                      )}
                    </div>
                  )}
              </aside>
            </div>
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
            {active &&
              note.status === "draft" &&
              can(
                note.noteType === "nursing"
                  ? "clinical.sign_nursing"
                  : "clinical.sign",
              ) && (
                <Button
                  disabled={cmd.busy || cmd.unknown}
                  onClick={async () => {
                    if (await cmd.run(`/v1/notes/${note.noteId}/sign`))
                      onSaved();
                  }}
                >
                  Sign note
                </Button>
              )}
            <details className="text-sm">
              <summary className="cursor-pointer py-2 text-muted-foreground">
                Correct a saved note
              </summary>
              <Button variant="outline" onClick={() => setVoiding(true)}>
                Mark entered in error
              </Button>
            </details>
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
    </form>
  );
}

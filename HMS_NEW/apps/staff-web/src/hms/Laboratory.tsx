// Laboratory and imaging (ERD m06): worklists for the clinic — collect specimens, receive or reject
// them, enter results (with critical-value calls and microbiology), verify and release reports; run
// imaging studies, record PC-PNDT Form F and submit the monthly register; and the clinician's list of
// released results waiting for acknowledgement. Each tab shows only with its permission.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { label } from "./model";
import { refusal } from "./forms";
import { Choice, Empty, ErrorMessage, Field, LoadingState, Status } from "./ui";
import {
  DIAGNOSTICS_REASONS,
  flagMark,
  LAB_TABS,
  nextStudyStatus,
  referenceText,
  REJECTION_REASONS,
  resultValue,
  type FormFRow,
  type LabItem,
  type LabWorkRow,
  type SpecimenRow,
  type StudyRow,
  type UnacknowledgedRow,
} from "./diagnostics";

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const r = refusal(cmd.failure) ?? (cmd.failure?.details?.reason as string | undefined);
  return <ErrorMessage text={(r && DIAGNOSTICS_REASONS[r]) || cmd.error} />;
}

export function Laboratory() {
  const { can } = useWorkspace();
  const tabs = LAB_TABS.filter((t) => [t.permission].flat().some((p) => can(p)));
  const [tab, setTab] = useState<string>(tabs[0]?.key ?? "collect");
  return (
    <div className="space-y-6">
      <PageTitle title="Lab & imaging" description="Specimens, results, reports and imaging studies for this clinic." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="h-auto flex-wrap justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === "collect" && <Collect />}
      {tab === "receive" && <Receive />}
      {tab === "result" && <LabStage stage="result" />}
      {tab === "verify" && <LabStage stage="verify" />}
      {tab === "imaging" && <Imaging />}
      {tab === "formf" && <FormFRegister />}
      {tab === "mine" && <MyResults />}
      {!tabs.length && <Empty>You have no laboratory or imaging permissions at this clinic.</Empty>}
    </div>
  );
}

const worklist = (facilityId: string, stage: string) => `/v1/lab/worklist?${query({ facilityId, stage })}`;

function Collect() {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: LabWorkRow[] }>(worklist(facility.facilityId, "collect"), 30_000);
  const cmd = useCommand();
  const [picked, setPicked] = useState<string[]>([]),
    [type, setType] = useState(""),
    [notice, setNotice] = useState("");
  const rows = list.data?.items ?? [];
  const patient = rows.find((r) => r.orderItemId === picked[0])?.patientId;
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <LoadingState loading={list.loading} error={list.error} refresh={() => void list.refresh()}>
          {!rows.length ? (
            <Empty>No tests are waiting for a specimen.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Patient</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead>Specimen</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.orderItemId}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Collect ${r.name}`}
                        checked={picked.includes(r.orderItemId)}
                        disabled={!!patient && patient !== r.patientId}
                        onChange={(e) => setPicked(e.target.checked ? [...picked, r.orderItemId] : picked.filter((x) => x !== r.orderItemId))}
                      />
                    </TableCell>
                    <TableCell>
                      {r.patientName} <span className="text-muted-foreground">{r.mrn}</span>
                    </TableCell>
                    <TableCell>
                      {r.name}
                      {r.panelName ? <span className="text-muted-foreground"> · {r.panelName}</span> : null}
                    </TableCell>
                    <TableCell>{r.specimenType ? label(r.specimenType) : "—"}</TableCell>
                    <TableCell>{r.priority !== "routine" ? <Badge variant="destructive">{label(r.priority)}</Badge> : "Routine"}</TableCell>
                    <TableCell>{when(r.orderedAt)}</TableCell>
                    <TableCell>
                      {r.needsRecollection && r.rejectedSpecimenId && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cmd.busy}
                          onClick={async () => {
                            const res = await cmd.run<{ accessionNo: string }>(`/v1/specimens/${r.rejectedSpecimenId}/recollect`, {}, true);
                            if (res) {
                              setNotice(`Recollected as ${res.accessionNo}.`);
                              void list.refresh();
                            }
                          }}
                        >
                          Recollect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </LoadingState>
        <div className="flex flex-wrap items-end gap-3">
          <Field title="Specimen type (when tests differ)" id="collect-type">
            <Choice label="Specimen type" value={type} onChange={setType} options={[{ value: "", label: "From the tests" }, ...["whole_blood", "serum", "plasma", "urine", "stool", "csf", "sputum", "swab", "tissue", "fluid", "other"].map((v) => ({ value: v, label: label(v) }))]} />
          </Field>
          <Button
            disabled={cmd.busy || !picked.length}
            onClick={async () => {
              const res = await cmd.run<{ accessionNo: string; barcode: string }>("/v1/specimens", { orderItemIds: picked, ...(type ? { specimenType: type } : {}) }, true);
              if (res) {
                setNotice(`Collected ${res.accessionNo} — label ${res.barcode}.`);
                setPicked([]);
                void list.refresh();
              }
            }}
          >
            Collect specimen ({picked.length})
          </Button>
        </div>
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

function Receive() {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: SpecimenRow[] }>(worklist(facility.facilityId, "receive"), 30_000);
  const cmd = useCommand();
  const [rejecting, setRejecting] = useState(""),
    [why, setWhy] = useState<string>("haemolysed"),
    [note, setNote] = useState("");
  const rows = list.data?.items ?? [];
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <LoadingState loading={list.loading} error={list.error} refresh={() => void list.refresh()}>
          {!rows.length ? (
            <Empty>No specimens are on their way to the lab.</Empty>
          ) : (
            rows.map((s) => (
              <div key={s.specimenId} className="border-b pb-2 space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{s.accessionNo}</span>
                  <span>
                    {s.patientName} <span className="text-muted-foreground">{s.mrn}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {label(s.specimenType)} · {s.tests} · collected {when(s.collectedAt)}
                  </span>
                  <Button size="sm" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/specimens/${s.specimenId}/receive`)) && void list.refresh()}>
                    Receive
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(rejecting === s.specimenId ? "" : s.specimenId)}>
                    Reject
                  </Button>
                </div>
                {rejecting === s.specimenId && (
                  <form
                    className="flex flex-wrap gap-2 items-end"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await cmd.run(`/v1/specimens/${s.specimenId}/reject`, { reason: why, ...(note.trim() ? { note: note.trim() } : {}) })) {
                        setRejecting("");
                        setNote("");
                        void list.refresh();
                      }
                    }}
                  >
                    <Field title="Reason" id="reject-reason">
                      <Choice label="Rejection reason" value={why} onChange={setWhy} options={REJECTION_REASONS.map((v) => ({ value: v, label: label(v) }))} />
                    </Field>
                    <Input aria-label="Note" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} className="w-64" />
                    <Button type="submit" variant="destructive" disabled={cmd.busy}>
                      Reject specimen
                    </Button>
                  </form>
                )}
              </div>
            ))
          )}
        </LoadingState>
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

function LabStage({ stage }: { stage: "result" | "verify" }) {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: LabWorkRow[] }>(worklist(facility.facilityId, stage), 30_000);
  const [open, setOpen] = useState("");
  const rows = list.data?.items ?? [];
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <LoadingState loading={list.loading} error={list.error} refresh={() => void list.refresh()}>
          {!rows.length ? (
            <Empty>{stage === "result" ? "No received specimens are waiting for results." : "No reports are waiting for verification."}</Empty>
          ) : (
            rows.map((r) => (
              <div key={r.orderItemId} className="border-b pb-2 space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{r.name}</span>
                  {r.panelName && <span className="text-muted-foreground">{r.panelName}</span>}
                  <span>
                    {r.patientName} <span className="text-muted-foreground">{r.mrn}</span>
                  </span>
                  {r.accessionNo && <span className="text-muted-foreground">{r.accessionNo}</span>}
                  {r.priority !== "routine" && <Badge variant="destructive">{label(r.priority)}</Badge>}
                  {r.hasCritical && <Badge variant="destructive">Critical</Badge>}
                  {r.reportStatus && <Status value={r.reportStatus} />}
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === r.orderItemId ? "" : r.orderItemId)}>
                    {open === r.orderItemId ? "Close" : stage === "result" ? "Enter results" : "Review"}
                  </Button>
                </div>
                {open === r.orderItemId && (
                  <LabItemPanel
                    orderItemId={r.orderItemId}
                    stage={stage}
                    onDone={() => {
                      setOpen("");
                      void list.refresh();
                    }}
                  />
                )}
              </div>
            ))
          )}
        </LoadingState>
      </CardContent>
    </Card>
  );
}

function LabItemPanel({ orderItemId, stage, onDone }: { orderItemId: string; stage: "result" | "verify"; onDone: () => void }) {
  const { can } = useWorkspace();
  const item = useQuery<LabItem>(`/v1/order-items/${orderItemId}/lab`);
  const cmd = useCommand();
  const [values, setValues] = useState<Record<string, string>>({}),
    [conclusion, setConclusion] = useState("");
  const data = item.data;
  if (!data) return <LoadingState loading={item.loading} error={item.error} refresh={() => void item.refresh()}>{null}</LoadingState>;
  const reload = () => void item.refresh();
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        {data.requisitionNo} · ordered by {data.orderedByName}
        {data.clinicalIndication ? ` · ${data.clinicalIndication}` : ""}
      </p>
      {data.tests.map((t) => {
        const pending = t.definitions.filter((d) => !t.results.some((r) => r.observationDefinitionId === d.observationDefinitionId));
        return (
          <div key={t.orderItemId} className="space-y-2">
            <p className="font-medium text-sm">
              {t.name} <Status value={t.status} />
            </p>
            {t.results.map((r) => (
              <ResultLine key={r.resultItemId} result={r} editable={stage === "result" || can("lab.process")} onChanged={reload} />
            ))}
            {stage === "result" && t.status === "in_progress" && pending.length > 0 && (
              <form
                className="grid grid-cols-3 gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const entries = pending
                    .filter((d) => (values[d.observationDefinitionId] ?? "").trim() !== "")
                    .map((d) => {
                      const v = values[d.observationDefinitionId]!.trim();
                      return {
                        observationDefinitionId: d.observationDefinitionId,
                        ...(d.valueType === "numeric" ? { valueNum: Number(v) } : d.valueType === "coded" ? { valueOptionId: v } : { valueText: v }),
                      };
                    });
                  if (entries.length && (await cmd.run(`/v1/order-items/${t.orderItemId}/results`, { values: entries }))) {
                    setValues({});
                    reload();
                  }
                }}
              >
                {pending.map((d) => (
                  <Field key={d.observationDefinitionId} title={`${d.name}${d.unit ? ` (${d.unit})` : ""}${d.low !== null || d.high !== null ? ` · ${referenceText({ refLow: d.low, refHigh: d.high })}` : ""}`} id={`res-${d.observationDefinitionId}`}>
                    {d.valueType === "coded" ? (
                      <Choice label={d.name} value={values[d.observationDefinitionId] ?? ""} onChange={(v) => setValues({ ...values, [d.observationDefinitionId]: v })} options={d.options.map((o) => ({ value: o.answerOptionId, label: o.display }))} />
                    ) : (
                      <Input
                        id={`res-${d.observationDefinitionId}`}
                        inputMode={d.valueType === "numeric" ? "decimal" : "text"}
                        value={values[d.observationDefinitionId] ?? ""}
                        onChange={(e) => setValues({ ...values, [d.observationDefinitionId]: e.target.value })}
                      />
                    )}
                  </Field>
                ))}
                <div className="col-span-3">
                  <Button type="submit" disabled={cmd.busy}>
                    Save results
                  </Button>
                </div>
              </form>
            )}
            {t.section === "microbiology" && <Microbiology test={t} editable={stage === "result" && ["in_progress", "resulted"].includes(t.status)} onChanged={reload} />}
          </div>
        );
      })}
      {stage === "verify" && (
        <div className="space-y-2 border-t pt-3">
          <Field title="Conclusion" id="report-conclusion">
            <Textarea id="report-conclusion" maxLength={4000} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
          </Field>
          <Button
            disabled={cmd.busy}
            onClick={async () => {
              // A report is drafted (snapshotting the results) if none exists yet, then released.
              let report = data.report;
              if (!report) {
                const draft = await cmd.run<{ reportId: string; version: number; status: string; versionNo: number }>(`/v1/order-items/${orderItemId}/report`, {});
                if (!draft) return;
                report = { reportId: draft.reportId, version: draft.version, status: draft.status, versionNo: draft.versionNo, conclusion: null };
              }
              if (await cmd.run(`/v1/diagnostic-reports/${report.reportId}/release`, { version: report.version, ...(conclusion.trim() ? { conclusion: conclusion.trim() } : {}) })) onDone();
              else reload();
            }}
          >
            Verify and release
          </Button>
        </div>
      )}
      <Refused cmd={cmd} />
    </div>
  );
}

function ResultLine({ result: r, editable, onChanged }: { result: LabItem["tests"][number]["results"][number]; editable: boolean; onChanged: () => void }) {
  const { practitioners } = useWorkspace();
  const cmd = useCommand();
  const [mode, setMode] = useState<"" | "correct" | "call">(""),
    [value, setValue] = useState(""),
    [why, setWhy] = useState(""),
    [to, setTo] = useState(""),
    [channel, setChannel] = useState("phone"),
    [readBack, setReadBack] = useState(true);
  const called = r.criticalAlerts.length > 0;
  return (
    <div className="text-sm space-y-1">
      <div className={`flex flex-wrap items-center gap-2 ${r.isCritical ? "text-destructive font-medium" : ""}`}>
        <span>{r.name}</span>
        <span>
          {resultValue(r)} {flagMark(r.abnormalFlag)}
        </span>
        <span className="text-muted-foreground">
          {referenceText(r)} · {label(r.status)} · {r.enteredByName}
        </span>
        {r.isCritical && (called ? <Badge variant="secondary">Called: {r.criticalAlerts.map((a) => a.notifiedTo).join(", ")}</Badge> : <Badge variant="destructive">Call required</Badge>)}
        {editable && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setMode(mode === "correct" ? "" : "correct")}>
              Correct
            </Button>
            {r.isCritical && (
              <Button size="sm" variant="ghost" onClick={() => setMode(mode === "call" ? "" : "call")}>
                Log call
              </Button>
            )}
          </>
        )}
      </div>
      {mode === "correct" && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = value.trim();
            const body = { ...(r.valueNum !== null ? { valueNum: Number(v) } : { valueText: v }), reason: why.trim() };
            if (await cmd.run(`/v1/result-items/${r.resultItemId}/correct`, body)) {
              setMode("");
              onChanged();
            }
          }}
        >
          <Input aria-label="Corrected value" placeholder="Corrected value" value={value} onChange={(e) => setValue(e.target.value)} className="w-40" />
          <Input aria-label="Reason" placeholder="Reason" value={why} onChange={(e) => setWhy(e.target.value)} className="w-64" />
          <Button type="submit" disabled={cmd.busy || !value.trim() || why.trim().length < 3}>
            Save correction
          </Button>
        </form>
      )}
      {mode === "call" && (
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const known = practitioners.find((p) => p.staffId === to);
            if (await cmd.run(`/v1/result-items/${r.resultItemId}/critical-alerts`, { ...(known ? { notifiedToStaffId: known.staffId } : { notifiedToName: to.trim() }), channel, readBackConfirmed: readBack })) {
              setMode("");
              onChanged();
            }
          }}
        >
          <Field title="Told" id="call-to">
            <Choice label="Doctor told" value={to} onChange={setTo} options={practitioners.map((p) => ({ value: p.staffId, label: p.name }))} />
          </Field>
          <Field title="How" id="call-channel">
            <Choice label="Channel" value={channel} onChange={setChannel} options={["phone", "in_person", "app"].map((v) => ({ value: v, label: label(v) }))} />
          </Field>
          <div className="flex items-center gap-2">
            <Switch id="call-readback" checked={readBack} onCheckedChange={setReadBack} />
            <Label htmlFor="call-readback">Read back</Label>
          </div>
          <Button type="submit" disabled={cmd.busy || !to}>
            Log critical call
          </Button>
        </form>
      )}
      <Refused cmd={cmd} />
    </div>
  );
}

function Microbiology({ test, editable, onChanged }: { test: LabItem["tests"][number]; editable: boolean; onChanged: () => void }) {
  const cmd = useCommand();
  const [organism, setOrganism] = useState(""),
    [count, setCount] = useState(""),
    [ab, setAb] = useState<Record<string, { name: string; zone: string; sir: string }>>({});
  return (
    <div className="pl-3 space-y-2 text-sm">
      {test.isolates.map((i) => {
        const a = ab[i.isolateId] ?? { name: "", zone: "", sir: "S" };
        return (
          <div key={i.isolateId} className="space-y-1">
            <p>
              Isolate {i.sequence}: <span className="font-medium">{i.organism}</span> {i.colonyCount ?? ""}
            </p>
            <p className="text-muted-foreground">{i.susceptibilities.map((s) => `${s.antibiotic} ${s.interpretation}`).join(" · ") || "No susceptibilities yet."}</p>
            {editable && (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await cmd.run(`/v1/micro-isolates/${i.isolateId}/susceptibilities`, { antibioticName: a.name.trim(), method: "disc", zoneMm: Number(a.zone), interpretation: a.sir })) {
                    setAb({ ...ab, [i.isolateId]: { name: "", zone: "", sir: "S" } });
                    onChanged();
                  }
                }}
              >
                <Input aria-label="Antibiotic" placeholder="Antibiotic" value={a.name} onChange={(e) => setAb({ ...ab, [i.isolateId]: { ...a, name: e.target.value } })} className="w-40" />
                <Input aria-label="Zone (mm)" placeholder="Zone mm" inputMode="decimal" value={a.zone} onChange={(e) => setAb({ ...ab, [i.isolateId]: { ...a, zone: e.target.value } })} className="w-24" />
                <Choice label="Interpretation" value={a.sir} onChange={(v) => setAb({ ...ab, [i.isolateId]: { ...a, sir: v } })} options={["S", "I", "R"].map((v) => ({ value: v, label: v }))} />
                <Button type="submit" size="sm" disabled={cmd.busy || a.name.trim().length < 2 || !a.zone}>
                  Add
                </Button>
              </form>
            )}
          </div>
        );
      })}
      {editable && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await cmd.run(`/v1/order-items/${test.orderItemId}/isolates`, { organismName: organism.trim(), ...(count.trim() ? { colonyCount: count.trim() } : {}) })) {
              setOrganism("");
              setCount("");
              onChanged();
            }
          }}
        >
          <Input aria-label="Organism" placeholder="Organism isolated" value={organism} onChange={(e) => setOrganism(e.target.value)} className="w-56" />
          <Input aria-label="Colony count" placeholder="Colony count" value={count} onChange={(e) => setCount(e.target.value)} className="w-40" />
          <Button type="submit" size="sm" variant="outline" disabled={cmd.busy || organism.trim().length < 2}>
            Add isolate
          </Button>
        </form>
      )}
      <Refused cmd={cmd} />
    </div>
  );
}

function Imaging() {
  const { facility, can } = useWorkspace();
  const list = useQuery<{ items: StudyRow[] }>(`/v1/imaging/worklist?${query({ facilityId: facility.facilityId })}`, 30_000);
  const [open, setOpen] = useState("");
  const rows = list.data?.items ?? [];
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <LoadingState loading={list.loading} error={list.error} refresh={() => void list.refresh()}>
          {!rows.length ? (
            <Empty>No imaging studies are scheduled or waiting for a report.</Empty>
          ) : (
            rows.map((s) => (
              <div key={s.imagingStudyId} className="border-b pb-2 space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{s.accessionNo}</span>
                  <span>{s.name}</span>
                  <span>
                    {s.patientName} <span className="text-muted-foreground">{s.mrn}</span>
                  </span>
                  <Status value={s.status} />
                  {s.priority !== "routine" && <Badge variant="destructive">{label(s.priority)}</Badge>}
                  {s.isObstetric && <Badge variant={s.formFComplete ? "secondary" : "destructive"}>Form F {s.formFComplete ? "complete" : "needed"}</Badge>}
                  {s.reportStatus && <span className="text-muted-foreground">Report {label(s.reportStatus)}</span>}
                  <Button size="sm" variant="outline" onClick={() => setOpen(open === s.imagingStudyId ? "" : s.imagingStudyId)}>
                    {open === s.imagingStudyId ? "Close" : "Open"}
                  </Button>
                </div>
                {open === s.imagingStudyId && <StudyPanel study={s} canRun={can("imaging.manage")} canReport={can("imaging.report")} canFormF={can("pcpndt.manage")} onChanged={() => void list.refresh()} />}
              </div>
            ))
          )}
        </LoadingState>
      </CardContent>
    </Card>
  );
}

function StudyPanel({ study: s, canRun, canReport, canFormF, onChanged }: { study: StudyRow; canRun: boolean; canReport: boolean; canFormF: boolean; onChanged: () => void }) {
  const cmd = useCommand();
  const next = nextStudyStatus(s.status);
  const [reason, setReason] = useState(""),
    [findings, setFindings] = useState(""),
    [impression, setImpression] = useState(""),
    [form, setForm] = useState({ indication: s.clinicalIndication ?? "", lmp: "", referringDoctor: "" }),
    [patientDeclared, setPatientDeclared] = useState(false),
    [doctorDeclared, setDoctorDeclared] = useState(false);
  const move = (status: string, extra: Record<string, unknown> = {}) => cmd.run(`/v1/imaging-studies/${s.imagingStudyId}/status`, { version: s.version, status, ...extra });
  return (
    <div className="border rounded-lg p-4 space-y-4 text-sm">
      {canRun && (next || s.status !== "completed") && (
        <div className="flex flex-wrap items-center gap-2">
          {next && (
            <Button disabled={cmd.busy} onClick={async () => (await move(next)) && onChanged()}>
              Mark {label(next).toLowerCase()}
            </Button>
          )}
          {s.modality === "US" && s.status !== "completed" && (
            <Button variant="outline" disabled={cmd.busy} onClick={async () => (await move(s.status, { isObstetric: !s.isObstetric })) && onChanged()}>
              {s.isObstetric ? "Not obstetric" : "Obstetric (Form F)"}
            </Button>
          )}
          {["scheduled", "arrived", "in_progress"].includes(s.status) && (
            <>
              <Input aria-label="Reason for cancelling" placeholder="Reason to cancel" value={reason} onChange={(e) => setReason(e.target.value)} className="w-56" />
              <Button variant="destructive" disabled={cmd.busy || reason.trim().length < 3} onClick={async () => (await move("cancelled", { reason: reason.trim() })) && onChanged()}>
                Cancel study
              </Button>
            </>
          )}
        </div>
      )}
      {s.isObstetric && canFormF && !s.formFComplete && (
        <form
          className="grid grid-cols-3 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await cmd.run(`/v1/imaging-studies/${s.imagingStudyId}/form-f`, { formData: form, patientDeclared, doctorDeclared, ...(s.formFVersion ? { version: s.formFVersion } : {}) }, false, "PUT")
            )
              onChanged();
          }}
        >
          <p className="col-span-3 font-medium">PC-PNDT Form F</p>
          <Field title="Indication" id="ff-indication">
            <Input id="ff-indication" value={form.indication} onChange={(e) => setForm({ ...form, indication: e.target.value })} />
          </Field>
          <Field title="LMP" id="ff-lmp">
            <Input id="ff-lmp" type="date" value={form.lmp} onChange={(e) => setForm({ ...form, lmp: e.target.value })} />
          </Field>
          <Field title="Referring doctor" id="ff-ref">
            <Input id="ff-ref" value={form.referringDoctor} onChange={(e) => setForm({ ...form, referringDoctor: e.target.value })} />
          </Field>
          <div className="flex items-center gap-2">
            <Switch id="ff-patient" checked={patientDeclared} onCheckedChange={setPatientDeclared} />
            <Label htmlFor="ff-patient">Patient declaration signed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ff-doctor" checked={doctorDeclared} onCheckedChange={setDoctorDeclared} />
            <Label htmlFor="ff-doctor">I declare (performing doctor)</Label>
          </div>
          <div>
            <Button type="submit" disabled={cmd.busy || !form.indication.trim()}>
              Save Form F
            </Button>
          </div>
        </form>
      )}
      {canReport && s.status === "completed" && (
        <div className="space-y-2">
          <Field title="Findings" id="img-findings">
            <Textarea id="img-findings" value={findings} onChange={(e) => setFindings(e.target.value)} />
          </Field>
          <Field title="Impression" id="img-impression">
            <Input id="img-impression" value={impression} onChange={(e) => setImpression(e.target.value)} />
          </Field>
          <Button
            disabled={cmd.busy || (!findings.trim() && !impression.trim())}
            onClick={async () => {
              const text = { ...(findings.trim() ? { findings: findings.trim() } : {}), ...(impression.trim() ? { impression: impression.trim() } : {}) };
              const draft = await cmd.run<{ reportId: string; version: number }>(`/v1/order-items/${s.orderItemId}/report`, { ...text, ...(s.reportVersion ? { version: s.reportVersion } : {}) });
              if (draft && (await cmd.run(`/v1/diagnostic-reports/${draft.reportId}/release`, { version: draft.version }))) onChanged();
            }}
          >
            Sign and release report
          </Button>
        </div>
      )}
      <Refused cmd={cmd} />
    </div>
  );
}

function FormFRegister() {
  const { facility } = useWorkspace();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)),
    [ref, setRef] = useState(""),
    [notice, setNotice] = useState("");
  const list = useQuery<{ items: FormFRow[] }>(/^\d{4}-\d{2}$/.test(month) ? `/v1/form-f?${query({ facilityId: facility.facilityId, month })}` : null);
  const cmd = useCommand();
  const rows = list.data?.items ?? [];
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field title="Month" id="ff-month">
            <Input id="ff-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Input aria-label="Submission reference" placeholder="Submission reference" value={ref} onChange={(e) => setRef(e.target.value)} className="w-56" />
          <Button
            disabled={cmd.busy || !rows.some((r) => !r.submittedAt)}
            onClick={async () => {
              const res = await cmd.run<{ submitted: number; incomplete: number }>("/v1/form-f/submit", { facilityId: facility.facilityId, month, ...(ref.trim() ? { submissionRef: ref.trim() } : {}) });
              if (res) {
                setNotice(`Submitted ${res.submitted}; ${res.incomplete} still incomplete.`);
                void list.refresh();
              }
            }}
          >
            Mark submitted to the Appropriate Authority
          </Button>
        </div>
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <Refused cmd={cmd} />
        <LoadingState loading={list.loading} error={list.error} refresh={() => void list.refresh()}>
          {!rows.length ? (
            <Empty>No Form F records for this month.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Accession</TableHead>
                  <TableHead>Declarations</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Keep until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.formFId}>
                    <TableCell>
                      {r.patientName} <span className="text-muted-foreground">{r.mrn}</span>
                    </TableCell>
                    <TableCell>{r.accessionNo}</TableCell>
                    <TableCell>
                      {r.patientDeclarationAt ? "Patient ✓" : "Patient —"} · {r.doctorDeclarationAt ? `Doctor ✓ ${r.doctorName ?? ""}` : "Doctor —"}
                    </TableCell>
                    <TableCell>{r.submittedAt ? `${when(r.submittedAt)}${r.submissionRef ? ` · ${r.submissionRef}` : ""}` : "—"}</TableCell>
                    <TableCell>{r.retainUntil}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </LoadingState>
      </CardContent>
    </Card>
  );
}

function MyResults() {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: UnacknowledgedRow[] }>(`/v1/results/unacknowledged?${query({ facilityId: facility.facilityId })}`, 60_000);
  const cmd = useCommand();
  const [action, setAction] = useState<Record<string, string>>({});
  const rows = list.data?.items ?? [];
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <LoadingState loading={list.loading} error={list.error} refresh={() => void list.refresh()}>
          {!rows.length ? (
            <Empty>Every released result on your orders is acknowledged.</Empty>
          ) : (
            rows.map((r) => (
              <form
                key={r.reportId}
                className="flex flex-wrap items-center gap-3 text-sm border-b pb-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const a = (action[r.reportId] ?? "").trim();
                  if (await cmd.run(`/v1/diagnostic-reports/${r.reportId}/acknowledge`, a ? { actionTaken: a } : {})) void list.refresh();
                }}
              >
                {r.isCritical && <Badge variant="destructive">Critical</Badge>}
                <span className="font-medium">{r.name}</span>
                <span>
                  {r.patientName} <span className="text-muted-foreground">{r.mrn}</span>
                </span>
                <span className="text-muted-foreground">
                  {r.requisitionNo} · released {when(r.releasedAt)}
                </span>
                <Input aria-label="Action taken" placeholder="Action taken" value={action[r.reportId] ?? ""} onChange={(e) => setAction({ ...action, [r.reportId]: e.target.value })} className="w-64" />
                <Button type="submit" size="sm" variant="outline" disabled={cmd.busy}>
                  Acknowledge
                </Button>
              </form>
            ))
          )}
        </LoadingState>
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

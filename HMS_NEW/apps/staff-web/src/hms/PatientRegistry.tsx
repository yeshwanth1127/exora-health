// The rest of a patient's registry record (ERD m02): identifiers, related people, clinical consents,
// flags, care assignments and duplicate handling. The API checks every permission; buttons follow it.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { label } from "./model";
import { E164, refusal } from "./forms";
import { Choice, Empty, ErrorMessage, LoadingState, Status } from "./ui";
import { PatientLookup } from "./Patients";
import type { Patient } from "./types";

type Registry = {
  patientId: string;
  status: string;
  mergedIntoPatientId: string | null;
  nkaConfirmedAt: string | null;
  deceasedAt: string | null;
  identifiers: { identifierId: string; system: string; value: string; issuer: string | null; verifiedAt: string | null; isPrimary: boolean }[];
  relatedPersons: {
    relatedPersonId: string;
    name: string;
    relationship: string;
    phone: string | null;
    isGuardian: boolean;
    isEmergencyContact: boolean;
    isLegalRepresentative: boolean;
    validTo: string | null;
    version: number;
  }[];
  consents: { consentId: string; consentType: string; status: string; signedBy: string; signerName: string | null; witnessName: string | null; signedAt: string; withdrawnAt: string | null; notes: string | null }[];
  flags: { flagId: string; flagType: string; activeFrom: string; activeTo: string | null; setByName: string; reason: string | null; active: boolean }[];
  links: { linkId: string; survivorPatientId: string; survivorMrn: string; otherPatientId: string; otherMrn: string; linkType: string; decidedBy: string | null; reason: string | null }[];
};

const REASONS: Record<string, string> = {
  duplicate_identifier: "This identifier is already recorded for a patient.",
  bad_format: "That isn't the right format for this kind of identifier.",
  signer_required: "Choose the related person who signed.",
  not_guardian: "That person isn't recorded as a guardian.",
  not_representative: "That person isn't recorded as a legal representative.",
  already_set: "This flag is already set.",
  already_proposed: "These records are already proposed as duplicates.",
  same_person: "Someone else must decide this.",
  merged: "This record was merged; use the surviving record.",
  has_allergies: "The patient has active allergies recorded.",
};
function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const r = refusal(cmd.failure);
  return <ErrorMessage text={(r && REASONS[r]) || cmd.error} />;
}
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "");

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

export function PatientRegistry({ patientId, onMerged }: { patientId: string; onMerged?: () => void }) {
  const { can } = useWorkspace();
  const reg = useQuery<Registry>(`/v1/patients/${patientId}/registry`);
  const refresh = () => void reg.refresh();
  return (
    <LoadingState {...reg}>
      {reg.data && (
        <div className="space-y-4">
          {reg.data.deceasedAt && <p className="text-sm font-medium">Deceased {day(reg.data.deceasedAt)}</p>}
          {can("clinical.write") && reg.data.status !== "merged" && <ConfirmNka patientId={patientId} confirmedAt={reg.data.nkaConfirmedAt} onDone={refresh} />}
          <Flags r={reg.data} editable={can("patient_flags.manage")} onChanged={refresh} />
          <Identifiers r={reg.data} editable={can("patients.update") && reg.data.status !== "merged"} onChanged={refresh} />
          <Related r={reg.data} editable={can("patients.update") && reg.data.status !== "merged"} onChanged={refresh} />
          <Consents r={reg.data} editable={can("consents.record") && reg.data.status !== "merged"} onChanged={refresh} />
          {can("care_assignment.manage") && <CareTeam patientId={patientId} />}
          <Duplicates r={reg.data} canPropose={can("patients.update")} canDecide={can("patients.merge")} onChanged={() => { refresh(); onMerged?.(); }} />
        </div>
      )}
    </LoadingState>
  );
}

const FLAGS = ["isolation", "fall_risk", "allergy_alert", "safeguarding", "vip", "confidential", "mlc", "do_not_resuscitate"];

function Flags({ r, editable, onChanged }: { r: Registry; editable: boolean; onChanged: () => void }) {
  const cmd = useCommand();
  const [type, setType] = useState("fall_risk"),
    [why, setWhy] = useState("");
  const active = r.flags.filter((f) => f.active);
  return (
    <Block title="Flags">
      <div className="flex flex-wrap gap-2">
        {active.map((f) => (
          <span key={f.flagId} className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-1">
            {label(f.flagType)}
            {f.reason ? ` · ${f.reason}` : ""}
            {editable && (
              <button
                type="button"
                className="ml-1 text-muted-foreground"
                aria-label={`Clear ${label(f.flagType)}`}
                onClick={async () => {
                  const reason = window.prompt("Why is this flag being cleared?");
                  if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/patient-flags/${f.flagId}/clear`, { reason: reason.trim() }))) onChanged();
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!active.length && <span className="text-sm text-muted-foreground">No active flags.</span>}
      </div>
      {editable && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await cmd.run(`/v1/patients/${r.patientId}/flags`, { flagType: type, reason: why.trim() }, true)) {
              setWhy("");
              onChanged();
            }
          }}
        >
          <div className="w-44">
            <Choice label="Flag" value={type} onChange={setType} options={FLAGS.map((v) => ({ value: v, label: label(v) }))} />
          </div>
          <Input aria-label="Flag reason" placeholder="Reason" maxLength={500} value={why} onChange={(e) => setWhy(e.target.value)} />
          <Button type="submit" variant="outline" disabled={cmd.busy || why.trim().length < 3}>Set flag</Button>
        </form>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

const SYSTEMS = ["abha_number", "abha_address", "pan", "passport", "voter_id", "driving_licence", "insurer_member_no", "scheme_id", "other"];

function Identifiers({ r, editable, onChanged }: { r: Registry; editable: boolean; onChanged: () => void }) {
  const cmd = useCommand();
  const [system, setSystem] = useState("abha_number"),
    [value, setValue] = useState(""),
    [issuer, setIssuer] = useState(""),
    [verified, setVerified] = useState(false);
  return (
    <Block title="Identifiers">
      {r.identifiers.map((i) => (
        <div key={i.identifierId} className="flex items-center justify-between text-sm">
          <span>
            {label(i.system)}: {i.value}
            {i.issuer ? ` (${i.issuer})` : ""}
            {i.verifiedAt ? " · verified" : ""}
            {i.isPrimary ? " · primary" : ""}
          </span>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                const reason = window.prompt("Why is this identifier being removed?");
                if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/patient-identifiers/${i.identifierId}/remove`, { reason: reason.trim() }))) onChanged();
              }}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
      {!r.identifiers.length && <p className="text-sm text-muted-foreground">No identifiers recorded.</p>}
      {editable && (
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await cmd.run(
              `/v1/patients/${r.patientId}/identifiers`,
              { system, value: value.trim(), ...(issuer.trim() ? { issuer: issuer.trim() } : {}), ...(verified ? { verifiedVia: "document" } : {}), isPrimary: true },
              true,
            );
            if (ok) {
              setValue("");
              setIssuer("");
              onChanged();
            }
          }}
        >
          <Choice label="Identifier type" value={system} onChange={setSystem} options={SYSTEMS.map((v) => ({ value: v, label: label(v) }))} />
          <Input aria-label="Identifier value" placeholder="Number" maxLength={64} value={value} onChange={(e) => setValue(e.target.value)} />
          {["insurer_member_no", "scheme_id", "other"].includes(system) && (
            <Input aria-label="Issuer" placeholder="Insurer or scheme" maxLength={100} value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Checked against the document
          </label>
          <Button type="submit" variant="outline" disabled={cmd.busy || value.trim().length < 2}>Add identifier</Button>
        </form>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

const RELATIONSHIPS = ["spouse", "parent", "child", "sibling", "grandparent", "grandchild", "guardian", "relative", "friend", "other"];

function Related({ r, editable, onChanged }: { r: Registry; editable: boolean; onChanged: () => void }) {
  const cmd = useCommand();
  const blank = { name: "", relationship: "spouse", phone: "", isGuardian: false, isEmergencyContact: true, isLegalRepresentative: false };
  const [f, setF] = useState(blank),
    [open, setOpen] = useState(false);
  const current = r.relatedPersons.filter((p) => !p.validTo);
  return (
    <Block title="Related people" action={editable && <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? "Close" : "Add"}</Button>}>
      {current.map((p) => (
        <div key={p.relatedPersonId} className="flex items-center justify-between text-sm">
          <span>
            {p.name} · {label(p.relationship)}
            {p.phone ? ` · ${p.phone}` : ""}
            {[p.isGuardian && "guardian", p.isEmergencyContact && "emergency contact", p.isLegalRepresentative && "legal representative"].filter(Boolean).map((t) => ` · ${t}`)}
          </span>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                if (await cmd.run(`/v1/related-persons/${p.relatedPersonId}`, { version: p.version, ended: true }, false, "PATCH")) onChanged();
              }}
            >
              No longer related
            </Button>
          )}
        </div>
      ))}
      {!current.length && <p className="text-sm text-muted-foreground">No related people recorded.</p>}
      {open && (
        <form
          className="grid grid-cols-2 gap-2 border rounded-lg p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await cmd.run(
              `/v1/patients/${r.patientId}/related-persons`,
              { ...f, name: f.name.trim(), phone: f.phone || null, representativeScope: null, relatedPatientId: null },
              true,
            );
            if (ok) {
              setF(blank);
              setOpen(false);
              onChanged();
            }
          }}
        >
          <Input aria-label="Name" placeholder="Name" maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Choice label="Relationship" value={f.relationship} onChange={(v) => setF({ ...f, relationship: v })} options={RELATIONSHIPS.map((v) => ({ value: v, label: label(v) }))} />
          <Input aria-label="Phone" type="tel" placeholder="+919876543210" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.trim() })} />
          <div />
          {(["isGuardian", "isEmergencyContact", "isLegalRepresentative"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <Label htmlFor={`rel-${k}`} className="text-sm font-normal">{label(k.replace(/^is/, "").replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).slice(1))}</Label>
              <Switch id={`rel-${k}`} checked={f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} />
            </div>
          ))}
          <div className="col-span-2">
            <Button type="submit" variant="outline" disabled={cmd.busy || f.name.trim().length < 2 || (!!f.phone && !E164.test(f.phone))}>Save</Button>
          </div>
        </form>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

const CONSENTS = ["treatment", "admission", "procedure", "anaesthesia", "blood_transfusion", "high_risk", "teleconsult", "data_sharing_abdm", "research", "lama_dama"];

function Consents({ r, editable, onChanged }: { r: Registry; editable: boolean; onChanged: () => void }) {
  const cmd = useCommand();
  const [type, setType] = useState("treatment"),
    [status, setStatus] = useState("signed"),
    [signer, setSigner] = useState("patient"),
    [notes, setNotes] = useState("");
  const relatives = r.relatedPersons.filter((p) => !p.validTo && (p.isGuardian || p.isLegalRepresentative));
  return (
    <Block title="Consents">
      {r.consents.map((c) => (
        <div key={c.consentId} className="flex items-center justify-between text-sm">
          <span>
            {label(c.consentType)} · {label(c.status)} by {c.signerName ?? "patient"} · witnessed by {c.witnessName ?? "—"} · {day(c.signedAt)}
          </span>
          {editable && c.status === "signed" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                const reason = window.prompt("Why is the consent being withdrawn?");
                if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/patient-consents/${c.consentId}/withdraw`, { reason: reason.trim() }))) onChanged();
              }}
            >
              Withdraw
            </Button>
          )}
        </div>
      ))}
      {!r.consents.length && <p className="text-sm text-muted-foreground">No consents recorded.</p>}
      {editable && (
        <form
          className="grid grid-cols-2 gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const who = signer === "patient" ? { signedBy: "patient" } : (() => {
              const p = relatives.find((x) => x.relatedPersonId === signer)!;
              return { signedBy: p.isGuardian ? "guardian" : "representative", relatedPersonId: p.relatedPersonId };
            })();
            if (await cmd.run(`/v1/patients/${r.patientId}/consents`, { consentType: type, status, ...who, ...(notes.trim() ? { notes: notes.trim() } : {}) }, true)) {
              setNotes("");
              onChanged();
            }
          }}
        >
          <Choice label="Consent" value={type} onChange={setType} options={CONSENTS.map((v) => ({ value: v, label: label(v) }))} />
          <Choice label="Outcome" value={status} onChange={setStatus} options={[{ value: "signed", label: "Signed" }, { value: "refused", label: "Refused" }]} />
          <Choice label="Signed by" value={signer} onChange={setSigner} options={[{ value: "patient", label: "Patient" }, ...relatives.map((p) => ({ value: p.relatedPersonId, label: `${p.name} (${p.isGuardian ? "guardian" : "representative"})` }))]} />
          <Input aria-label="Consent notes" placeholder="Notes (optional)" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="submit" variant="outline" disabled={cmd.busy}>Record consent</Button>
          <p className="text-xs text-muted-foreground col-span-2">You are recorded as the witness. Messaging permission is set separately.</p>
        </form>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

type Assignment = { careAssignmentId: string; staffId: string; staffName: string; reason: string; validFrom: string; validTo: string | null };
type Staff = { staffId: string; displayName: string; staffType: string; status: string };

function CareTeam({ patientId }: { patientId: string }) {
  const { facility, can } = useWorkspace(),
    cmd = useCommand();
  const list = useQuery<{ items: Assignment[] }>(`/v1/care-assignments?patientId=${patientId}`);
  const staff = useQuery<{ items: Staff[] }>(can("access.manage") ? `/v1/staff-accounts?facilityId=${facility.facilityId}` : null);
  const [who, setWho] = useState(""),
    [reason, setReason] = useState("nursing"),
    [now] = useState(() => new Date().toISOString());
  const current = (list.data?.items ?? []).filter((a) => !a.validTo || a.validTo > now);
  return (
    <Block title="Care team (chart access)">
      {current.map((a) => (
        <div key={a.careAssignmentId} className="flex items-center justify-between text-sm">
          <span>{a.staffName} · {label(a.reason)} · since {day(a.validFrom)}</span>
          <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => { if (await cmd.run(`/v1/care-assignments/${a.careAssignmentId}/end`, { reason: "No longer caring" })) void list.refresh(); }}>
            End
          </Button>
        </div>
      ))}
      {!current.length && <p className="text-sm text-muted-foreground">Only the encounter team has access.</p>}
      {staff.data && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await cmd.run("/v1/care-assignments", { staffId: who, patientId, reason, validTo: null }, true)) void list.refresh();
          }}
        >
          <div className="w-48">
            <Choice label="Staff member" value={who} onChange={setWho} options={staff.data.items.filter((s) => s.status === "active" && ["doctor", "nurse"].includes(s.staffType)).map((s) => ({ value: s.staffId, label: s.displayName }))} />
          </div>
          <div className="w-36">
            <Choice label="Role in care" value={reason} onChange={setReason} options={["attending", "consulting", "nursing", "cover", "other"].map((v) => ({ value: v, label: label(v) }))} />
          </div>
          <Button type="submit" variant="outline" disabled={cmd.busy || !who}>Give access</Button>
        </form>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

function Duplicates({ r, canPropose, canDecide, onChanged }: { r: Registry; canPropose: boolean; canDecide: boolean; onChanged: () => void }) {
  const { me } = useWorkspace(),
    cmd = useCommand();
  const [open, setOpen] = useState(false),
    [other, setOther] = useState<Patient | null>(null),
    [why, setWhy] = useState("");
  return (
    <Block title="Duplicate records" action={canPropose && r.status !== "merged" && <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? "Close" : "Report a duplicate"}</Button>}>
      {r.mergedIntoPatientId && <p className="text-sm">Merged into another record; its history shows there.</p>}
      {r.links.map((l) => (
        <div key={l.linkId} className="flex items-center justify-between text-sm">
          <span>
            {l.survivorMrn} ← {l.otherMrn} · <Status value={l.linkType} />
          </span>
          {canDecide && l.linkType === "possible_duplicate" && l.decidedBy !== me.staffId && (
            <span className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => {
                const reason = window.prompt("Confirm the merge: how was it checked?");
                if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/patient-links/${l.linkId}/decide`, { decision: "merge", reason: reason.trim() }))) onChanged();
              }}>
                Merge
              </Button>
              <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => { if (await cmd.run(`/v1/patient-links/${l.linkId}/decide`, { decision: "not_duplicate", reason: "Different people" })) onChanged(); }}>
                Not the same
              </Button>
            </span>
          )}
          {canDecide && l.linkType === "merged" && (
            <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => {
              const reason = window.prompt("Why is the merge being reversed?");
              if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/patient-links/${l.linkId}/unmerge`, { reason: reason.trim() }))) onChanged();
            }}>
              Unmerge
            </Button>
          )}
        </div>
      ))}
      {open && (
        <div className="space-y-2 border rounded-lg p-3">
          {other ? (
            <p className="text-sm">
              {other.name} · {other.mrn}{" "}
              <Button variant="ghost" size="sm" onClick={() => setOther(null)}>Change</Button>
            </p>
          ) : (
            <PatientLookup onSelect={(p) => p.patientId !== r.patientId && setOther(p)} />
          )}
          <Input aria-label="Why they are the same" placeholder="Why they are the same person" maxLength={500} value={why} onChange={(e) => setWhy(e.target.value)} />
          <Button
            variant="outline"
            disabled={cmd.busy || !other || why.trim().length < 3}
            onClick={async () => {
              if (await cmd.run("/v1/patient-links", { survivorPatientId: r.patientId, otherPatientId: other!.patientId, reason: why.trim() }, true)) {
                setOpen(false);
                setOther(null);
                setWhy("");
                onChanged();
              }
            }}
          >
            Propose merge into this record
          </Button>
          <p className="text-xs text-muted-foreground">A second person with merge rights decides. Nothing changes until then.</p>
        </div>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

/** Open duplicate proposals across the hospital, for people who decide merges. */
export function DuplicateQueue() {
  const { me } = useWorkspace(),
    cmd = useCommand();
  const links = useQuery<{ items: Registry["links"] & { decidedByName: string | null }[] }>("/v1/patient-links?open=true");
  const items = links.data?.items ?? [];
  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-3">
        <h2 className="font-semibold">Possible duplicates to decide</h2>
        <LoadingState {...links}>
          {items.map((l) => (
            <div key={l.linkId} className="flex items-center justify-between text-sm border-b pb-2">
              <span>
                Keep {l.survivorMrn}, merge {l.otherMrn} · {l.reason}
              </span>
              {l.decidedBy !== me.staffId ? (
                <span className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={cmd.busy} onClick={async () => {
                    const reason = window.prompt("Confirm the merge: how was it checked?");
                    if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/patient-links/${l.linkId}/decide`, { decision: "merge", reason: reason.trim() }))) void links.refresh();
                  }}>
                    Merge
                  </Button>
                  <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => { if (await cmd.run(`/v1/patient-links/${l.linkId}/decide`, { decision: "not_duplicate", reason: "Different people" })) void links.refresh(); }}>
                    Not the same
                  </Button>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">You proposed this</span>
              )}
            </div>
          ))}
          {!items.length && <Empty>No duplicates waiting.</Empty>}
        </LoadingState>
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

/** "No known allergies" — distinguishes none from not asked. */
export function ConfirmNka({ patientId, confirmedAt, onDone }: { patientId: string; confirmedAt: string | null; onDone: () => void }) {
  const cmd = useCommand();
  if (confirmedAt) return <p className="text-xs text-muted-foreground">No known allergies confirmed {day(confirmedAt)}.</p>;
  return (
    <div>
      <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => { if (await cmd.run(`/v1/patients/${patientId}/no-known-allergies`)) onDone(); }}>
        Confirm no known allergies
      </Button>
      <Refused cmd={cmd} />
    </div>
  );
}

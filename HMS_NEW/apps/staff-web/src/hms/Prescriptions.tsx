// Prescriptions and the medication chart on one encounter (ERD m09). Doctors write a draft, sign it (giving a
// reason for each allergy / duplicate-therapy warning), stop, hold or resume lines, and cancel. Nurses chart
// doses on the MAR (a witness for controlled and high-alert drugs) and send patient indents to the pharmacy.
// The API checks the permission at the encounter's clinic and the care relationship.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { label } from "./model";
import { Choice, ErrorMessage, Field, Status } from "./ui";
import { lineText, PHARMACY_REASONS, qty, when, type Rx, type RxLine } from "./medicines";

export function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const r = cmd.failure?.details?.reason as string | undefined;
  const next = cmd.failure?.details?.nextAllowedAt as string | undefined;
  const text = (r && PHARMACY_REASONS[r]) || cmd.error;
  return <ErrorMessage text={text && next ? `${text} Next dose from ${when(next)}.` : text} />;
}

type Drug = { itemId: string; name: string; genericName: string; strength: string | null; dosageForm: string; defaultRoute: string | null; schedule: string; isNdps: boolean; isHighAlert: boolean; baseUom: string };

const FREQUENCIES = ["OD", "BD", "TDS", "QID", "HS", "SOS", "STAT", "Q4H", "Q6H", "Q8H", "WEEKLY"];
const ROUTES = ["oral", "iv", "im", "sc", "topical", "inhalation", "sublingual", "rectal", "ophthalmic", "otic", "nasal", "vaginal", "other"];
const PER_DAY: Record<string, number> = { OD: 1, BD: 2, TDS: 3, QID: 4, HS: 1, Q4H: 6, Q6H: 4, Q8H: 3 };

export function DrugFlags({ l }: { l: { schedule: string; isNdps: boolean; isHighAlert: boolean } }) {
  return (
    <>
      {l.schedule !== "none" && <Badge variant="outline">Sch {l.schedule}</Badge>}
      {l.isNdps && <Badge variant="destructive">NDPS</Badge>}
      {l.isHighAlert && <Badge variant="destructive">High alert</Badge>}
    </>
  );
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
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

export function EncounterPrescriptions({ encounterId, active }: { encounterId: string; active: boolean }) {
  const { can, me } = useWorkspace();
  const readable = can("prescriptions.read");
  const list = useQuery<{ prescriptions: Rx[] }>(readable ? `/v1/encounters/${encounterId}/prescriptions` : null);
  const [writing, setWriting] = useState(false);
  if (!readable) return null;
  const refresh = () => void list.refresh();
  return (
    <Section
      title="Prescriptions"
      action={
        active &&
        can("prescriptions.write") && (
          <Button variant="ghost" size="sm" onClick={() => setWriting(!writing)}>
            {writing ? "Close" : "New prescription"}
          </Button>
        )
      }
    >
      {writing && (
        <WritePrescription
          encounterId={encounterId}
          onSaved={() => {
            setWriting(false);
            refresh();
          }}
        />
      )}
      <ErrorMessage text={list.error} />
      {list.data?.prescriptions.map((rx) => <PrescriptionCard key={rx.prescriptionId} rx={rx} mine={rx.prescriberStaffId === me.staffId} onChanged={refresh} />)}
      {list.data && !list.data.prescriptions.length && <p className="text-sm text-muted-foreground">No prescriptions on this visit.</p>}
    </Section>
  );
}

type Draft = { drug: Drug; dose: string; doseUnit: string; route: string; frequencyCode: string; durationValue: string; durationUnit: string; quantity: string; instructions: string; foodRelation: string; substitutionAllowed: boolean };

function WritePrescription({ encounterId, onSaved }: { encounterId: string; onSaved: () => void }) {
  const cmd = useCommand();
  const [term, setTerm] = useState(""),
    [lines, setLines] = useState<Draft[]>([]),
    [advice, setAdvice] = useState(""),
    [setting, setSetting] = useState("");
  const search = useQuery<{ items: Drug[] }>(term.trim().length >= 2 ? `/v1/pharmacy/drugs?${query({ q: term.trim() })}` : null);
  const update = (i: number, patch: Partial<Draft>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const autoQty = (l: Draft) => {
    const perDay = PER_DAY[l.frequencyCode];
    const days = Number(l.durationValue) * (l.durationUnit === "weeks" ? 7 : l.durationUnit === "months" ? 30 : 1);
    return perDay && days && l.durationUnit !== "doses" ? String(perDay * days * (Number(l.dose) || 1)) : l.quantity;
  };
  const save = async () => {
    const items = lines.map((l) => ({
      itemId: l.drug.itemId,
      dose: Number(l.dose),
      doseUnit: l.doseUnit.trim(),
      route: l.route,
      frequencyCode: l.frequencyCode,
      ...(l.durationValue ? { durationValue: Number(l.durationValue), durationUnit: l.durationUnit } : {}),
      ...((l.quantity || autoQty(l)) ? { quantity: Number(l.quantity || autoQty(l)) } : {}),
      ...(l.instructions.trim() ? { instructions: l.instructions.trim() } : {}),
      foodRelation: l.foodRelation,
      substitutionAllowed: l.substitutionAllowed,
    }));
    if (await cmd.run(`/v1/encounters/${encounterId}/prescriptions`, { items, ...(advice.trim() ? { advice: advice.trim() } : {}), ...(setting ? { setting } : {}) }, true)) onSaved();
  };
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <Field title="Find a drug" id="rx-search">
        <Input id="rx-search" placeholder="Generic or brand name" value={term} onChange={(e) => setTerm(e.target.value)} />
      </Field>
      {search.data?.items.map((d) => (
        <div key={d.itemId} className="flex items-center justify-between gap-2 text-sm">
          <span>
            {d.name} <span className="text-muted-foreground">· {d.genericName} {d.strength} {label(d.dosageForm)}</span> <DrugFlags l={d} />
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLines([...lines, { drug: d, dose: "1", doseUnit: d.baseUom, route: d.defaultRoute ?? "", frequencyCode: "BD", durationValue: "5", durationUnit: "days", quantity: "", instructions: "", foodRelation: "after_food", substitutionAllowed: true }]);
              setTerm("");
            }}
          >
            Add
          </Button>
        </div>
      ))}
      {lines.map((l, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>
              {i + 1}. {l.drug.name} <DrugFlags l={l.drug} />
            </span>
            <Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field title="Dose" id={`rx-dose-${i}`}>
              <Input id={`rx-dose-${i}`} type="number" min="0" step="any" value={l.dose} onChange={(e) => update(i, { dose: e.target.value })} />
            </Field>
            <Field title="Unit" id={`rx-unit-${i}`}>
              <Input id={`rx-unit-${i}`} value={l.doseUnit} onChange={(e) => update(i, { doseUnit: e.target.value })} />
            </Field>
            <Choice label="Route" value={l.route} onChange={(v) => update(i, { route: v })} options={[...(l.route ? [] : [{ value: "", label: "Pick" }]), ...ROUTES.map((r) => ({ value: r, label: label(r) }))]} />
            <Choice label="Frequency" value={l.frequencyCode} onChange={(v) => update(i, { frequencyCode: v })} options={FREQUENCIES.map((f) => ({ value: f, label: f }))} />
            <Field title="Duration" id={`rx-dur-${i}`}>
              <Input id={`rx-dur-${i}`} type="number" min="1" value={l.durationValue} onChange={(e) => update(i, { durationValue: e.target.value })} />
            </Field>
            <Choice label="Duration unit" value={l.durationUnit} onChange={(v) => update(i, { durationUnit: v })} options={["days", "weeks", "months", "doses"].map((u) => ({ value: u, label: label(u) }))} />
            <Field title={`Quantity (${l.drug.baseUom})`} id={`rx-qty-${i}`}>
              <Input id={`rx-qty-${i}`} type="number" min="0" step="any" placeholder={autoQty(l) || "for take-home"} value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} onFocus={() => !l.quantity && update(i, { quantity: autoQty(l) })} />
            </Field>
            <Choice label="Food" value={l.foodRelation} onChange={(v) => update(i, { foodRelation: v })} options={["after_food", "before_food", "with_food", "empty_stomach", "any"].map((u) => ({ value: u, label: label(u) }))} />
            <Field title="Instructions" id={`rx-ins-${i}`}>
              <Input id={`rx-ins-${i}`} value={l.instructions} onChange={(e) => update(i, { instructions: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm pt-6">
              <input type="checkbox" checked={l.substitutionAllowed} onChange={(e) => update(i, { substitutionAllowed: e.target.checked })} /> Generic substitution allowed
            </label>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <Field title="Advice" id="rx-advice">
          <Input id="rx-advice" value={advice} onChange={(e) => setAdvice(e.target.value)} />
        </Field>
        <Choice label="Kind" value={setting} onChange={setSetting} options={[{ value: "", label: "From the visit" }, ...["outpatient", "inpatient", "discharge", "virtual"].map((s) => ({ value: s, label: label(s) }))]} />
      </div>
      <Refused cmd={cmd} />
      <Button disabled={cmd.busy || !lines.length || lines.some((l) => !(Number(l.dose) > 0) || !l.doseUnit.trim() || !l.route)} onClick={save}>
        Save draft
      </Button>
    </div>
  );
}

function PrescriptionCard({ rx, mine, onChanged }: { rx: Rx; mine: boolean; onChanged: () => void }) {
  const { can } = useWorkspace();
  const cmd = useCommand();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const pending = cmd.failure?.details?.reason === "override_required" ? (cmd.failure.details.lines as { lineNo: number; warnings: { kind: string; detail: string }[] }[]) : [];
  const sign = async () => {
    if (await cmd.run(`/v1/prescriptions/${rx.prescriptionId}/sign`, Object.keys(overrides).length ? { overrides } : {})) onChanged();
  };
  const writer = can("prescriptions.write");
  const live = ["signed", "verified", "partially_dispensed", "on_hold"].includes(rx.status);
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Status value={rx.status} />
        <span className="text-muted-foreground">
          {label(rx.setting)} · {rx.prescriberName} · {rx.signedAt ? `signed ${when(rx.signedAt)}` : "draft"}
        </span>
        {rx.verifications.length > 0 && (
          <span className="text-muted-foreground">
            · pharmacist: {label(rx.verifications.at(-1)!.outcome)}
            {rx.verifications.at(-1)!.notes ? ` — ${rx.verifications.at(-1)!.notes}` : ""}
          </span>
        )}
      </div>
      {rx.items.map((l) => (
        <div key={l.prescriptionItemId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {l.lineNo}. <span className="font-medium">{l.genericName}</span> {l.strength} {l.brandName ? `(${l.brandName})` : ""} — {lineText(l)}
            {l.quantityPrescribed && ` · ${qty(l.quantityDispensed)}/${qty(l.quantityPrescribed)} ${l.baseUom} dispensed`}
            {l.instructions && ` · ${l.instructions}`} <DrugFlags l={l} />
            {l.status !== "active" && <Status value={l.status} />}
            {l.warnings.length > 0 && (
              <Badge variant="outline" title={`${l.warnings.map((w) => w.detail).join("; ")} — override: ${l.overrideReason}`}>
                Warning overridden
              </Badge>
            )}
          </span>
          {writer && live && (l.status === "active" || l.status === "held") && (
            <span className="flex gap-1">
              {(["stop", l.status === "held" ? "resume" : "hold"] as const).map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant="ghost"
                  disabled={cmd.busy}
                  onClick={async () => {
                    const why = a === "resume" ? "" : window.prompt(`Why ${a} ${l.genericName}?`);
                    if (why === null) return;
                    if (await cmd.run(`/v1/prescription-items/${l.prescriptionItemId}/${a}`, why ? { reason: why } : {})) onChanged();
                  }}
                >
                  {label(a)}
                </Button>
              ))}
            </span>
          )}
        </div>
      ))}
      {rx.advice && <p className="text-sm text-muted-foreground">Advice: {rx.advice}</p>}
      {rx.cancelReason && <p className="text-sm text-muted-foreground">Cancelled: {rx.cancelReason}</p>}
      {pending.map((p) => (
        <Field key={p.lineNo} title={`Line ${p.lineNo}: ${p.warnings.map((w) => w.detail).join("; ")} — reason to override`} id={`ovr-${rx.prescriptionId}-${p.lineNo}`}>
          <Input id={`ovr-${rx.prescriptionId}-${p.lineNo}`} value={overrides[p.lineNo] ?? ""} onChange={(e) => setOverrides({ ...overrides, [p.lineNo]: e.target.value })} />
        </Field>
      ))}
      <Refused cmd={cmd} />
      {writer && mine && (
        <div className="flex gap-2">
          {rx.status === "draft" && (
            <Button size="sm" disabled={cmd.busy} onClick={sign}>
              {pending.length ? "Sign with overrides" : "Sign"}
            </Button>
          )}
          {(rx.status === "draft" || live) && (
            <Button
              size="sm"
              variant="outline"
              disabled={cmd.busy}
              onClick={async () => {
                const why = window.prompt("Why cancel this prescription?");
                if (why && (await cmd.run(`/v1/prescriptions/${rx.prescriptionId}/cancel`, { reason: why }))) onChanged();
              }}
            >
              Cancel prescription
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- MAR ---------------------------------------------------------------------------------------------------
type Dose = { administrationId: string; prescriptionItemId: string; scheduledAt: string | null; administeredAt: string | null; status: string; doseGiven: string | null; doseUnit: string | null; reason: string | null; prnReason: string | null; administeredBy: string; witness: string | null };
type MarLine = RxLine & { prescriberName: string; doses: Dose[] };
type Store = { id: string; name: string; status: string; can_dispense_to_patient: boolean };

const localInput = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function EncounterMar({ encounterId, active }: { encounterId: string; active: boolean }) {
  const { can, facility } = useWorkspace();
  const charting = can("medication.administer");
  const mar = useQuery<{ lines: MarLine[] }>(charting ? `/v1/encounters/${encounterId}/mar` : null);
  const witnesses = useQuery<{ items: { staffId: string; name: string; staffType: string }[] }>(charting ? `/v1/pharmacy/witnesses?${query({ facilityId: facility.facilityId })}` : null);
  const [indenting, setIndenting] = useState(false);
  if (!charting || !mar.data?.lines.length) return null;
  const refresh = () => void mar.refresh();
  return (
    <Section
      title="Medication chart (MAR)"
      action={
        active &&
        can("pharmacy.indent") && (
          <Button variant="ghost" size="sm" onClick={() => setIndenting(!indenting)}>
            {indenting ? "Close" : "Request from pharmacy"}
          </Button>
        )
      }
    >
      {indenting && <PatientIndent encounterId={encounterId} lines={mar.data.lines.filter((l) => l.status === "active")} onDone={() => setIndenting(false)} />}
      {mar.data.lines.map((l) => (
        <MarRow key={l.prescriptionItemId} line={l} witnesses={witnesses.data?.items ?? []} onChanged={refresh} />
      ))}
    </Section>
  );
}

function MarRow({ line, witnesses, onChanged }: { line: MarLine; witnesses: { staffId: string; name: string }[]; onChanged: () => void }) {
  const { me } = useWorkspace();
  const cmd = useCommand();
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState("given"),
    [at, setAt] = useState(localInput()),
    [witness, setWitness] = useState(""),
    [why, setWhy] = useState(""),
    [site, setSite] = useState("");
  const giving = status === "given" || status === "self_administered";
  const record = async () => {
    const t = new Date(at).toISOString();
    const body = {
      status,
      ...(line.isPrn ? (giving ? { administeredAt: t } : {}) : { scheduledAt: t, ...(giving ? { administeredAt: new Date().toISOString() } : {}) }),
      ...(witness ? { witnessStaffId: witness } : {}),
      ...(site.trim() ? { site: site.trim() } : {}),
      ...(giving ? (line.isPrn ? { prnReason: why.trim() } : {}) : { reason: why.trim() }),
    };
    if (await cmd.run(`/v1/prescription-items/${line.prescriptionItemId}/administrations`, body, true)) {
      setOpen(false);
      setWhy("");
      onChanged();
    }
  };
  return (
    <div className="border rounded-lg p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{line.genericName}</span> {line.strength} — {lineText(line)} {line.isPrn && <Badge variant="outline">PRN</Badge>} <DrugFlags l={line} />
          {line.status !== "active" && <Status value={line.status} />}
        </span>
        {line.status === "active" && (
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Chart dose"}
          </Button>
        )}
      </div>
      {open && (
        <div className="grid grid-cols-3 gap-2">
          <Choice label="Outcome" value={status} onChange={setStatus} options={["given", "not_given", "held", "refused", "self_administered"].map((s) => ({ value: s, label: label(s) }))} />
          <Field title={line.isPrn ? "Given at" : "Scheduled time"} id={`mar-at-${line.prescriptionItemId}`}>
            <Input id={`mar-at-${line.prescriptionItemId}`} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
          <Field title={giving ? (line.isPrn ? "Indication" : "Site") : "Reason"} id={`mar-why-${line.prescriptionItemId}`}>
            {giving && !line.isPrn ? (
              <Input id={`mar-why-${line.prescriptionItemId}`} value={site} onChange={(e) => setSite(e.target.value)} />
            ) : (
              <Input id={`mar-why-${line.prescriptionItemId}`} value={why} onChange={(e) => setWhy(e.target.value)} />
            )}
          </Field>
          {line.requiresWitness && (
            <Choice label="Witness" value={witness} onChange={setWitness} options={[{ value: "", label: "Choose…" }, ...witnesses.filter((w) => w.staffId !== me.staffId).map((w) => ({ value: w.staffId, label: w.name }))]} />
          )}
          <div className="col-span-3 space-y-2">
            <Refused cmd={cmd} />
            <Button size="sm" disabled={cmd.busy || (line.requiresWitness && status === "given" && !witness)} onClick={record}>
              Record
            </Button>
          </div>
        </div>
      )}
      {line.doses.slice(0, 6).map((d) => (
        <div key={d.administrationId} className="text-muted-foreground">
          {d.scheduledAt ? `${when(d.scheduledAt)} slot · ` : ""}
          {label(d.status)} {d.administeredAt ? when(d.administeredAt) : ""} {d.doseGiven ? `· ${qty(d.doseGiven)} ${d.doseUnit}` : ""} · {d.administeredBy}
          {d.witness ? ` (witness ${d.witness})` : ""}
          {d.reason ? ` · ${d.reason}` : ""}
          {d.prnReason ? ` · for ${d.prnReason}` : ""}
        </div>
      ))}
    </div>
  );
}

function PatientIndent({ encounterId, lines, onDone }: { encounterId: string; lines: MarLine[]; onDone: () => void }) {
  const { facility } = useWorkspace();
  const cmd = useCommand();
  const stores = useQuery<{ items: Store[] }>(`/v1/inventory/stores?${query({ facilityId: facility.facilityId })}`);
  const pharmacies = (stores.data?.items ?? []).filter((s) => s.status === "active" && s.can_dispense_to_patient);
  const [store, setStore] = useState(""),
    [amounts, setAmounts] = useState<Record<string, string>>({});
  const chosen = store || pharmacies[0]?.id || "";
  const picked = lines.filter((l) => Number(amounts[l.prescriptionItemId]) > 0);
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <Choice label="Pharmacy" value={chosen} onChange={setStore} options={pharmacies.map((s) => ({ value: s.id, label: s.name }))} />
      {lines.map((l) => (
        <Field key={l.prescriptionItemId} title={`${l.genericName} ${l.strength ?? ""} (${l.baseUom})`} id={`ind-${l.prescriptionItemId}`}>
          <Input id={`ind-${l.prescriptionItemId}`} type="number" min="0" step="any" value={amounts[l.prescriptionItemId] ?? ""} onChange={(e) => setAmounts({ ...amounts, [l.prescriptionItemId]: e.target.value })} />
        </Field>
      ))}
      <Refused cmd={cmd} />
      <Button
        disabled={cmd.busy || !chosen || !picked.length}
        onClick={async () => {
          if (await cmd.run(`/v1/encounters/${encounterId}/patient-indents`, { pharmacyStoreId: chosen, lines: picked.map((l) => ({ prescriptionItemId: l.prescriptionItemId, quantity: Number(amounts[l.prescriptionItemId]) })) }, true)) onDone();
        }}
      >
        Send to pharmacy
      </Button>
    </div>
  );
}

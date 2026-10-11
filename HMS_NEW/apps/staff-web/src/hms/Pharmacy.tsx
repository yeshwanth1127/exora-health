// Pharmacy (ERD m09): verify prescriptions, dispense them and ward indents from a dispensing store (FEFO
// batches, MRP-capped price, approved generic substitution), hand over, take returns, and read the Schedule
// H1 / X and NDPS register. Each tab shows only with its permission.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { label, money, today } from "./model";
import { Choice, Empty, ErrorMessage, Field, LoadingState, Status } from "./ui";
import { DrugFlags, Refused } from "./Prescriptions";
import { lineText, qty, when, type Rx } from "./medicines";

const TABS = [
  { key: "verify", name: "Verify", permission: "pharmacy.verify" },
  { key: "dispense", name: "Dispense", permission: "pharmacy.dispense" },
  { key: "indents", name: "Ward indents", permission: "pharmacy.dispense" },
  { key: "dispensed", name: "Dispensed & returns", permission: "pharmacy.dispense" },
  { key: "register", name: "H1 / NDPS register", permission: "pharmacy.registers" },
] as const;

type QueueRow = { prescriptionId?: string; patientIndentId?: string; status: string; setting?: string; signedAt?: string; requestedAt?: string; mrn: string; patientName: string; prescriberName?: string; requestedBy?: string; openLines?: number; pharmacyStore?: string };
type Batch = { itemBatchId: string; batchNo: string; expiryDate: string | null; mrpMinor: number | null; onHand: string };
type IndentLine = { patientIndentLineId: string; itemId: string; itemName: string; baseUom: string; qtyRequested: string; qtyDispensed: string; prescriptionItemId: string | null; dose: string | null; doseUnit: string | null; frequencyCode: string | null };
type DispenseLine = { dispenseLineId: string; itemName: string; batchNo: string; expiryDate: string | null; quantity: string; returnedQty: string; mrpMinor: number | null; unitPriceMinor: number; substitutedFromItemId: string | null };
type Dispense = { dispenseId: string; dispenseNo: string; status: string; dispensedAt: string; handedOverTo: string | null; mrn: string; patientName: string; dispensedBy: string; lines: DispenseLine[] };
type View = {
  patient: { mrn: string; name: string; sex: string; birthDate: string | null };
  allergies: { substance: string; reaction: string | null; severity: string | null }[];
  prescription: Rx | null;
  indent: { patientIndentId: string; status: string; notes: string | null; lines: IndentLine[] } | null;
  stock: Record<string, { batches: Batch[]; alternatives: { itemId: string; name: string; onHand: string }[] }>;
  dispenses: Dispense[];
};
type Store = { id: string; name: string; status: string; can_dispense_to_patient: boolean };

export function Pharmacy() {
  const { can } = useWorkspace();
  const tabs = TABS.filter((t) => can(t.permission));
  const [tab, setTab] = useState<string>(tabs[0]?.key ?? "");
  if (!tabs.length) return <Empty>You have no pharmacy permissions at this clinic.</Empty>;
  return (
    <div className="space-y-4">
      <PageTitle title="Pharmacy" description="Verify, dispense, returns and controlled-drug register" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {(tab === "verify" || tab === "dispense" || tab === "indents") && <Queue key={tab} stage={tab} />}
      {tab === "dispensed" && <Dispensed />}
      {tab === "register" && <Register />}
    </div>
  );
}

function usePharmacyStores() {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: Store[] }>(`/v1/inventory/stores?${query({ facilityId: facility.facilityId })}`);
  return (list.data?.items ?? []).filter((s) => s.status === "active" && s.can_dispense_to_patient);
}

function Queue({ stage }: { stage: "verify" | "dispense" | "indents" }) {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: QueueRow[] }>(`/v1/pharmacy/queue?${query({ facilityId: facility.facilityId, stage })}`);
  const [open, setOpen] = useState<QueueRow | null>(null);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
      <Card>
        <CardContent className="p-3 space-y-1">
          <LoadingState loading={list.loading} error={list.error} refresh={list.refresh}>
            {list.data?.items.length === 0 && <Empty>Nothing waiting.</Empty>}
            {list.data?.items.map((r) => (
              <button
                key={r.prescriptionId ?? r.patientIndentId}
                className={`w-full text-left rounded-md p-2 text-sm hover:bg-muted ${open === r ? "bg-muted" : ""}`}
                onClick={() => setOpen(r)}
              >
                <div className="font-medium">
                  {r.patientName} <span className="text-muted-foreground">· {r.mrn}</span>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-2 items-center">
                  <Status value={r.status} />
                  {r.setting && label(r.setting)} {r.prescriberName ?? r.requestedBy} · {when(r.signedAt ?? r.requestedAt)}
                </div>
              </button>
            ))}
          </LoadingState>
        </CardContent>
      </Card>
      {open ? (
        <Detail
          key={open.prescriptionId ?? open.patientIndentId}
          row={open}
          stage={stage}
          onDone={() => {
            setOpen(null);
            void list.refresh();
          }}
        />
      ) : (
        <Empty>Pick a {stage === "indents" ? "ward indent" : "prescription"}.</Empty>
      )}
    </div>
  );
}

type Plan = { quantity: string; itemBatchId: string; substituteItemId: string };

function Detail({ row, stage, onDone }: { row: QueueRow; stage: string; onDone: () => void }) {
  const stores = usePharmacyStores();
  const [store, setStore] = useState("");
  const storeId = store || stores[0]?.id || "";
  const base = row.prescriptionId ? `/v1/prescriptions/${row.prescriptionId}/dispensing` : `/v1/patient-indents/${row.patientIndentId}/dispensing`;
  const view = useQuery<View>(storeId ? `${base}?${query({ storeId })}` : null);
  const cmd = useCommand();
  const [notes, setNotes] = useState(""),
    [handedOverTo, setHandedOverTo] = useState(""),
    [plan, setPlan] = useState<Record<string, Plan>>({});
  const v = view.data;
  const rx = v?.prescription;

  // Lines to fill: prescription lines still open, or indent lines not yet filled.
  const targets = rx
    ? rx.items
        .filter((l) => l.status === "active")
        .map((l) => ({ key: l.prescriptionItemId, itemId: l.itemId, title: `${l.genericName} ${l.strength ?? ""} — ${lineText(l)}`, flags: l, uom: l.baseUom, left: l.quantityPrescribed ? Number(l.quantityPrescribed) - Number(l.quantityDispensed) : 0, substitution: l.substitutionAllowed }))
    : (v?.indent?.lines ?? []).map((l) => ({ key: l.patientIndentLineId, itemId: l.itemId, title: `${l.itemName}${l.dose ? ` — ${qty(l.dose)} ${l.doseUnit} ${l.frequencyCode}` : ""}`, flags: null, uom: l.baseUom, left: Number(l.qtyRequested) - Number(l.qtyDispensed), substitution: !!l.prescriptionItemId }));
  const planOf = (k: string, left: number): Plan => plan[k] ?? { quantity: left > 0 ? String(left) : "", itemBatchId: "", substituteItemId: "" };

  const verify = async (outcome: "approved" | "query" | "rejected") => {
    if (await cmd.run(`/v1/prescriptions/${row.prescriptionId}/verify`, { outcome, ...(notes.trim() ? { notes: notes.trim() } : {}) })) onDone();
  };
  const dispense = async () => {
    const lines = targets
      .map((t) => ({ t, p: planOf(t.key, t.left) }))
      .filter(({ p }) => Number(p.quantity) > 0)
      .map(({ t, p }) => ({
        ...(rx ? { prescriptionItemId: t.key } : { patientIndentLineId: t.key }),
        quantity: Number(p.quantity),
        ...(p.itemBatchId ? { itemBatchId: p.itemBatchId } : {}),
        ...(p.substituteItemId ? { substituteItemId: p.substituteItemId } : {}),
      }));
    const body = { ...(rx ? { prescriptionId: row.prescriptionId } : { patientIndentId: row.patientIndentId }), storeId, lines, ...(handedOverTo.trim() ? { handedOverTo: handedOverTo.trim() } : {}) };
    if (await cmd.run("/v1/dispenses", body, true)) onDone();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <LoadingState loading={view.loading} error={view.error} refresh={view.refresh}>
          {v && (
            <>
              <div>
                <div className="font-semibold">
                  {v.patient.name} <span className="text-muted-foreground font-normal">· {v.patient.mrn} · {label(v.patient.sex)}{v.patient.birthDate ? ` · born ${v.patient.birthDate}` : ""}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-sm">
                  {v.allergies.length ? (
                    v.allergies.map((a) => (
                      <Badge key={a.substance} variant="destructive">
                        Allergy: {a.substance}
                        {a.reaction ? ` (${a.reaction})` : ""}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">No active allergies recorded</span>
                  )}
                </div>
              </div>
              {rx && (
                <div className="text-sm space-y-1">
                  <div className="text-muted-foreground">
                    {label(rx.setting)} · {rx.prescriberName} · signed {when(rx.signedAt)} · <Status value={rx.status} />
                  </div>
                  {rx.items.map((l) => (
                    <div key={l.prescriptionItemId}>
                      {l.lineNo}. <span className="font-medium">{l.genericName}</span> {l.strength} — {lineText(l)} {l.quantityPrescribed && `· ${qty(l.quantityDispensed)}/${qty(l.quantityPrescribed)}`} <DrugFlags l={l} /> {l.status !== "active" && <Status value={l.status} />}
                      {l.warnings.length > 0 && (
                        <div className="text-destructive">
                          ⚠ {l.warnings.map((w) => w.detail).join("; ")} — prescriber: “{l.overrideReason}”
                        </div>
                      )}
                    </div>
                  ))}
                  {rx.advice && <div className="text-muted-foreground">Advice: {rx.advice}</div>}
                  {rx.verifications.map((c, i) => (
                    <div key={i} className="text-muted-foreground">
                      {label(c.outcome)} by {c.verifiedBy} {when(c.verifiedAt)}
                      {c.notes ? ` — ${c.notes}` : ""}
                    </div>
                  ))}
                </div>
              )}

              {stage === "verify" ? (
                <div className="space-y-2 border-t pt-3">
                  <Field title="Notes (required to query or reject)" id="verify-notes">
                    <Input id="verify-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </Field>
                  <Refused cmd={cmd} />
                  <div className="flex gap-2">
                    <Button disabled={cmd.busy} onClick={() => verify("approved")}>
                      Approve
                    </Button>
                    <Button variant="outline" disabled={cmd.busy || !notes.trim()} onClick={() => verify("query")}>
                      Query prescriber
                    </Button>
                    <Button variant="outline" disabled={cmd.busy || !notes.trim()} onClick={() => verify("rejected")}>
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 border-t pt-3">
                  <Choice label="Dispense from" value={storeId} onChange={setStore} options={stores.map((s) => ({ value: s.id, label: s.name }))} />
                  {targets.map((t) => {
                    const p = planOf(t.key, t.left);
                    const set = (patch: Partial<Plan>) => setPlan({ ...plan, [t.key]: { ...p, ...patch } });
                    const shown = v.stock[p.substituteItemId || t.itemId] ?? { batches: [], alternatives: [] };
                    const alts = v.stock[t.itemId]?.alternatives ?? [];
                    return (
                      <div key={t.key} className="border rounded-md p-3 space-y-2 text-sm">
                        <div className="font-medium">
                          {t.title} {t.flags && <DrugFlags l={t.flags} />}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Field title={`Quantity (${t.uom})`} id={`q-${t.key}`}>
                            <Input id={`q-${t.key}`} type="number" min="0" step="any" value={p.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                          </Field>
                          <Choice
                            label="Batch"
                            value={p.itemBatchId}
                            onChange={(x) => set({ itemBatchId: x })}
                            options={[{ value: "", label: "Earliest expiry first" }, ...shown.batches.map((b) => ({ value: b.itemBatchId, label: `${b.batchNo} · exp ${b.expiryDate ?? "—"} · ${qty(b.onHand)} · MRP ${b.mrpMinor == null ? "—" : money(b.mrpMinor)}` }))]}
                          />
                          {t.substitution && alts.length > 0 && (
                            <Choice label="Substitute (same generic)" value={p.substituteItemId} onChange={(x) => set({ substituteItemId: x, itemBatchId: "" })} options={[{ value: "", label: "As prescribed" }, ...alts.map((a) => ({ value: a.itemId, label: `${a.name} · ${qty(a.onHand)} in stock` }))]} />
                          )}
                        </div>
                        {!shown.batches.length && <span className="text-destructive">No usable stock in this store.</span>}
                      </div>
                    );
                  })}
                  <Field title="Handed over to (leave empty to prepare only)" id="handover">
                    <Input id="handover" placeholder="Patient / attendant name" value={handedOverTo} onChange={(e) => setHandedOverTo(e.target.value)} />
                  </Field>
                  <Refused cmd={cmd} />
                  <Button disabled={cmd.busy || !storeId || !targets.some((t) => Number(planOf(t.key, t.left).quantity) > 0)} onClick={dispense}>
                    Dispense
                  </Button>
                </div>
              )}
              {v.dispenses.length > 0 && (
                <div className="border-t pt-3 text-sm space-y-1">
                  <div className="font-medium">Dispensed so far</div>
                  {v.dispenses.map((d) => (
                    <div key={d.dispenseId} className="text-muted-foreground">
                      {d.dispenseNo} · {when(d.dispensedAt)} · {d.lines.map((l) => `${l.itemName} ${qty(l.quantity)} (${l.batchNo})`).join(", ")}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </LoadingState>
      </CardContent>
    </Card>
  );
}

function Dispensed() {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: Dispense[] }>(`/v1/dispenses?${query({ facilityId: facility.facilityId, days: 14 })}`);
  const cmd = useCommand();
  const refresh = () => void list.refresh();
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Refused cmd={cmd} />
        <LoadingState loading={list.loading} error={list.error} refresh={list.refresh}>
          {list.data?.items.length === 0 && <Empty>Nothing dispensed in the last 14 days.</Empty>}
          {list.data?.items.map((d) => (
            <div key={d.dispenseId} className="border rounded-md p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{d.dispenseNo}</span>
                <Status value={d.status} />
                <span className="text-muted-foreground">
                  {d.patientName} · {d.mrn} · {when(d.dispensedAt)} · {d.dispensedBy}
                  {d.handedOverTo ? ` · to ${d.handedOverTo}` : ""}
                </span>
                {d.status === "prepared" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cmd.busy}
                    onClick={async () => {
                      const to = window.prompt("Handed over to (name)");
                      if (to && to.trim().length >= 2 && (await cmd.run(`/v1/dispenses/${d.dispenseId}/hand-over`, { handedOverTo: to.trim() }))) refresh();
                    }}
                  >
                    Hand over
                  </Button>
                )}
              </div>
              {d.lines.map((l) => {
                const returnable = Number(l.quantity) - Number(l.returnedQty);
                return (
                  <div key={l.dispenseLineId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {l.itemName} · {l.batchNo} · {qty(l.quantity)} × {money(l.unitPriceMinor)}
                      {l.substitutedFromItemId ? " · substituted" : ""}
                      {Number(l.returnedQty) > 0 ? ` · ${qty(l.returnedQty)} returned` : ""}
                    </span>
                    {returnable > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cmd.busy}
                        onClick={async () => {
                          const n = Number(window.prompt(`How many to take back (up to ${returnable})?`, String(returnable)));
                          if (!(n > 0)) return;
                          const why = window.prompt("Why is it being returned?");
                          if (!why || why.trim().length < 3) return;
                          const restock = window.confirm("Can it go back on the shelf (sealed, in date)? OK = restock, Cancel = do not restock.");
                          if (await cmd.run(`/v1/dispense-lines/${l.dispenseLineId}/returns`, { quantity: n, reason: why.trim(), isRestockable: restock }, true)) refresh();
                        }}
                      >
                        Return
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </LoadingState>
      </CardContent>
    </Card>
  );
}

type RegisterRow = { dispenseNo: string; dispensedAt: string; mrn: string; patientName: string; prescriberName: string | null; itemName: string; genericName: string; schedule: string; isNdps: boolean; batchNo: string; quantity: string; returnedQty: string };

function Register() {
  const { facility } = useWorkspace();
  const [from, setFrom] = useState(today(facility.timezone).slice(0, 8) + "01"),
    [to, setTo] = useState(today(facility.timezone));
  const list = useQuery<{ items: RegisterRow[] }>(from && to ? `/v1/pharmacy/register?${query({ facilityId: facility.facilityId, from, to })}` : null);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <Field title="From" id="reg-from">
            <Input id="reg-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field title="To" id="reg-to">
            <Input id="reg-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <ErrorMessage text={list.error} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Dispense</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Prescriber</TableHead>
              <TableHead>Drug</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{when(r.dispensedAt)}</TableCell>
                <TableCell>{r.dispenseNo}</TableCell>
                <TableCell>
                  {r.patientName} · {r.mrn}
                </TableCell>
                <TableCell>{r.prescriberName ?? "—"}</TableCell>
                <TableCell>
                  {r.itemName} <Badge variant="outline">{r.isNdps ? "NDPS" : `Sch ${r.schedule}`}</Badge>
                </TableCell>
                <TableCell>{r.batchNo}</TableCell>
                <TableCell>
                  {qty(r.quantity)}
                  {Number(r.returnedQty) > 0 ? ` (−${qty(r.returnedQty)} returned)` : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {list.data?.items.length === 0 && <Empty>No controlled-drug dispenses in this period.</Empty>}
      </CardContent>
    </Card>
  );
}

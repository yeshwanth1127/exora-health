// Inventory (ERD m10): stock by store with batches and expiry, low-stock and expiring lists, issues and
// opening stock, indents and transfers, purchase orders with goods receipt and supplier invoices, stock
// counts, and the item / supplier / store masters. Each tab shows only with its permission.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { label, money } from "./model";
import { Choice, Empty, ErrorMessage, Field, LoadingState, Status } from "./ui";

const INVENTORY_TABS = [
  { key: "stock", name: "Stock", permission: "inventory.read" },
  { key: "issue", name: "Issue & adjust", permission: "inventory.issue" },
  { key: "indents", name: "Indents & transfers", permission: "inventory.read" },
  { key: "purchasing", name: "Purchasing", permission: "inventory.read" },
  { key: "counts", name: "Stock counts", permission: "inventory.count" },
  { key: "masters", name: "Items & suppliers", permission: "inventory.read" },
] as const;

const REASONS: Record<string, string> = {
  insufficient_stock: "Not enough usable stock in this store.",
  batch_unavailable: "That batch is on hold (quarantined or recalled).",
  batch_expired: "That batch has expired.",
  expired_on_arrival: "That batch has already expired — reject it at receipt.",
  expiry_required: "This item needs an expiry date.",
  batch_required: "Give the batch number.",
  mrp_required: "Drugs need the MRP printed on the pack.",
  batch_mismatch: "This batch number is on file with a different expiry date.",
  own_order: "Someone other than whoever raised the order approves it.",
  own_request: "Someone other than the requester approves the indent.",
  own_count: "Someone other than the counter approves the variance.",
  own_invoice: "Someone other than whoever recorded the invoice approves it.",
  stock_moved: "Stock moved since the count opened — reject it and recount.",
  over_receipt: "More than was ordered (or sent).",
  over_issue: "More than is approved and not yet issued.",
  over_approval: "Approve no more than was requested.",
  not_on_indent: "That item is not on the indent.",
  discrepancy_reason_required: "Say why less arrived than was sent.",
  variance_reason_required: "The invoice does not match the goods received — give a reason to accept it.",
  already_invoiced: "A receipt is already on another invoice.",
  total_mismatch: "The total must equal taxable value + GST + round-off.",
  uncounted_lines: "Count every line before submitting.",
  duplicate: "That already exists (or a count is already open for this store).",
  drug_licence_required: "A store dispensing to patients needs its drug licence number.",
  drug_profile: "A drug needs a drug profile.",
  unknown_uom: "That pack size is not set up for the item.",
  po_line_mismatch: "Each line must match a line of the order.",
  other_facility: "Transfers and indents stay within one clinic.",
  same_store: "Pick two different stores.",
  supplier_blocked: "This supplier is blocked.",
  store_inactive: "That store is inactive.",
  reason_required: "Give a reason.",
  module_inactive: "Inventory is switched off for this hospital.",
  stale_version: "Someone else changed this — reload and try again.",
};

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");
const qty = (v: string | number | null | undefined) => (v === null || v === undefined ? "—" : String(Number(v)));
const rupees = (minor: number) => money(minor);
const toMinor = (rupeesText: string) => Math.round(Number(rupeesText) * 100);

function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const r = cmd.failure?.details?.reason as string | undefined;
  return <ErrorMessage text={(r && REASONS[r]) || cmd.error} />;
}

type Store = { id: string; code: string; name: string; store_type: string; status: string; can_dispense_to_patient: boolean };
type Item = { id: string; code: string; name: string; item_type: string; base_uom: string; generic_name: string | null; strength: string | null; regulatory_schedule: string | null; status: string };
type Supplier = { id: string; code: string; name: string; gstin: string | null; payment_terms_days: number; status: string };

function useStores() {
  const { facility } = useWorkspace();
  const list = useQuery<{ items: Store[] }>(`/v1/inventory/stores?${query({ facilityId: facility.facilityId })}`);
  return { ...list, stores: (list.data?.items ?? []).filter((s) => s.status === "active") };
}
function useItems() {
  const list = useQuery<{ items: Item[] }>(`/v1/inventory/items?limit=500`);
  return list.data?.items ?? [];
}
function useSuppliers() {
  const list = useQuery<{ items: Supplier[] }>(`/v1/inventory/suppliers`);
  return (list.data?.items ?? []).filter((s) => s.status === "active");
}

function StorePicker({ value, onChange, stores, title = "Store", id }: { value: string; onChange: (v: string) => void; stores: Store[]; title?: string; id: string }) {
  return (
    <Field title={title} id={id}>
      <Choice label={title} value={value} onChange={onChange} options={[{ value: "", label: "Choose a store" }, ...stores.map((s) => ({ value: s.id, label: s.name }))]} />
    </Field>
  );
}
function ItemPicker({ value, onChange, items, id }: { value: string; onChange: (v: string) => void; items: Item[]; id: string }) {
  return (
    <Field title="Item" id={id}>
      <Choice label="Item" value={value} onChange={onChange} options={[{ value: "", label: "Choose an item" }, ...items.filter((i) => i.status === "active").map((i) => ({ value: i.id, label: `${i.name} (${i.base_uom})` }))]} />
    </Field>
  );
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <h3 className="font-medium">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export function Inventory() {
  const { can } = useWorkspace();
  const tabs = INVENTORY_TABS.filter((t) => can(t.permission));
  const [tab, setTab] = useState<string>(tabs[0]?.key ?? "stock");
  return (
    <div className="space-y-6">
      <PageTitle title="Inventory" description="Stores, stock by batch and expiry, indents, purchasing and counts for this clinic." />
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="h-auto flex-wrap justify-start">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tab === "stock" && <StockTab />}
      {tab === "issue" && <IssueTab />}
      {tab === "indents" && <IndentsTab />}
      {tab === "purchasing" && <PurchasingTab />}
      {tab === "counts" && <CountsTab />}
      {tab === "masters" && <MastersTab />}
      {!tabs.length && <Empty>You have no inventory permissions at this clinic.</Empty>}
    </div>
  );
}

// ---- stock ----------------------------------------------------------------------------------------------

type StockRow = { itemId: string; code: string; name: string; baseUom: string; onHand: number; usable: number; minLevel: number; low: boolean; binLocation: string | null; batches: { batchId: string; batchNo: string; expiryDate: string | null; mrpMinor: number | null; status: string; onHand: number }[] };

function StockTab() {
  const { facility, can } = useWorkspace();
  const { stores } = useStores();
  const [storeId, setStoreId] = useState(""),
    [q, setQ] = useState("");
  const store = storeId || stores[0]?.id || "";
  const stock = useQuery<{ items: StockRow[] }>(store ? `/v1/inventory/stores/${store}/stock?${query({ q })}` : null, 60_000);
  const low = useQuery<{ items: { storeName: string; name: string; level: number; usable: number; baseUom: string; reorderQty: number | null }[] }>(`/v1/inventory/low-stock?${query({ facilityId: facility.facilityId })}`);
  const expiring = useQuery<{ items: { store_name: string; name: string; batch_no: string; expiry_date: string; on_hand: string; base_uom: string }[] }>(`/v1/inventory/expiring?${query({ facilityId: facility.facilityId, days: 90 })}`);
  const cmd = useCommand();
  const [holding, setHolding] = useState(""),
    [why, setWhy] = useState("");
  const rows = stock.data?.items ?? [];
  if (!stores.length) return <Empty>No stores are set up at this clinic yet{can("inventory.manage") ? " — add one under Items & suppliers." : "."}</Empty>;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <StorePicker id="stock-store" value={store} onChange={setStoreId} stores={stores} />
            <Input aria-label="Search items" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          </div>
          <LoadingState loading={stock.loading} error={stock.error} refresh={() => void stock.refresh()}>
            {!rows.length ? (
              <Empty>Nothing in stock here.</Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead>Usable</TableHead>
                    <TableHead>Batches (earliest expiry first)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.itemId}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.code}
                          {r.binLocation ? ` · bin ${r.binLocation}` : ""}
                        </div>
                        {r.low && <Badge variant="destructive">Below level {r.minLevel}</Badge>}
                      </TableCell>
                      <TableCell>
                        {r.onHand} {r.baseUom}
                      </TableCell>
                      <TableCell>{r.usable}</TableCell>
                      <TableCell className="space-y-1">
                        {r.batches.map((b) => (
                          <div key={b.batchId} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">{b.batchNo}</span>
                            <span className="text-muted-foreground">exp {day(b.expiryDate)}</span>
                            {b.mrpMinor !== null && <span className="text-muted-foreground">MRP {rupees(b.mrpMinor)}</span>}
                            <span>× {b.onHand}</span>
                            {b.status !== "available" && <Status value={b.status} />}
                            {can("inventory.manage") && b.status === "available" && (
                              <Button size="sm" variant="ghost" onClick={() => setHolding(holding === b.batchId ? "" : b.batchId)}>
                                Hold
                              </Button>
                            )}
                            {can("inventory.manage") && b.status === "quarantined" && (
                              <Button size="sm" variant="ghost" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/batches/${b.batchId}/status`, { status: "available" })) && void stock.refresh()}>
                                Release
                              </Button>
                            )}
                            {holding === b.batchId && (
                              <form
                                className="flex gap-2"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (await cmd.run(`/v1/inventory/batches/${b.batchId}/status`, { status: "quarantined", reason: why.trim() })) {
                                    setHolding("");
                                    setWhy("");
                                    void stock.refresh();
                                  }
                                }}
                              >
                                <Input aria-label="Reason to hold" placeholder="Why hold this batch?" value={why} onChange={(e) => setWhy(e.target.value)} className="w-56" />
                                <Button size="sm" type="submit" variant="destructive" disabled={cmd.busy || why.trim().length < 3}>
                                  Quarantine
                                </Button>
                              </form>
                            )}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </LoadingState>
          <Refused cmd={cmd} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Below level">
          {!(low.data?.items ?? []).length ? (
            <Empty>Everything is above its level.</Empty>
          ) : (
            (low.data?.items ?? []).map((l, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{l.name}</span> · {l.storeName}: {l.usable} of {l.level} {l.baseUom}
                {l.reorderQty ? <span className="text-muted-foreground"> · reorder {l.reorderQty}</span> : null}
              </div>
            ))
          )}
        </Section>
        <Section title="Expiring within 90 days">
          {!(expiring.data?.items ?? []).length ? (
            <Empty>No batches expire in the next 90 days.</Empty>
          ) : (
            (expiring.data?.items ?? []).map((e, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{e.name}</span> · {e.batch_no} · {e.store_name}: {qty(e.on_hand)} {e.base_uom} · exp {day(e.expiry_date)}
              </div>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

// ---- issue, adjust, opening stock -------------------------------------------------------------------------

function IssueTab() {
  const { can } = useWorkspace();
  const { stores } = useStores();
  const items = useItems();
  const cmd = useCommand();
  const [storeId, setStoreId] = useState(""),
    [kind, setKind] = useState("consumption"),
    [itemId, setItemId] = useState(""),
    [amount, setAmount] = useState(""),
    [why, setWhy] = useState(""),
    [notice, setNotice] = useState("");
  const [open, setOpen] = useState({ storeId: "", itemId: "", batchNo: "", expiryDate: "", mrp: "", cost: "", quantity: "" });
  const kinds = [
    { value: "consumption", label: "Consumption (FEFO)" },
    { value: "damage", label: "Damage" },
    { value: "expiry_disposal", label: "Expiry disposal" },
    ...(can("inventory.approve") ? [{ value: "adjustment", label: "Book correction (±)" }] : []),
  ];
  const batchNeeded = kind !== "consumption";
  const stock = useQuery<{ items: StockRow[] }>(storeId && batchNeeded ? `/v1/inventory/stores/${storeId}/stock` : null);
  const batches = stock.data?.items.find((s) => s.itemId === itemId)?.batches ?? [];
  const [batchId, setBatchId] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Take stock out">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await cmd.run<{ adjustmentNo: string; moved: { quantity: number }[] }>(
              `/v1/inventory/stores/${storeId}/adjustments`,
              { kind, reason: why.trim(), lines: [{ itemId, quantity: Number(amount), ...(batchNeeded ? { batchId } : {}) }] },
              true,
            );
            if (res) {
              setNotice(`Posted ${res.adjustmentNo} (${res.moved.length} batch line${res.moved.length === 1 ? "" : "s"}).`);
              setAmount("");
              setWhy("");
            }
          }}
        >
          <StorePicker id="issue-store" value={storeId} onChange={setStoreId} stores={stores} />
          <Field title="Kind" id="issue-kind">
            <Choice label="Kind" value={kind} onChange={setKind} options={kinds} />
          </Field>
          <ItemPicker id="issue-item" value={itemId} onChange={setItemId} items={items} />
          {batchNeeded && (
            <Field title="Batch" id="issue-batch">
              <Choice label="Batch" value={batchId} onChange={setBatchId} options={[{ value: "", label: "Choose a batch" }, ...batches.map((b) => ({ value: b.batchId, label: `${b.batchNo} · exp ${day(b.expiryDate)} · ${b.onHand}` }))]} />
            </Field>
          )}
          <Field title={kind === "adjustment" ? "Quantity (+ found, − missing)" : "Quantity"} id="issue-qty">
            <Input id="issue-qty" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field title="Reason / department" id="issue-why">
            <Input id="issue-why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. OPD dressing room" />
          </Field>
          <Button type="submit" disabled={cmd.busy || !storeId || !itemId || !Number(amount) || why.trim().length < 3 || (batchNeeded && !batchId)}>
            Post
          </Button>
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        </form>
      </Section>
      <Section title="Opening stock">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await cmd.run<{ adjustmentNo: string }>(
              `/v1/inventory/stores/${open.storeId}/opening`,
              {
                lines: [
                  {
                    itemId: open.itemId,
                    quantity: Number(open.quantity),
                    ...(open.batchNo.trim() ? { batchNo: open.batchNo.trim() } : {}),
                    ...(open.expiryDate ? { expiryDate: open.expiryDate } : {}),
                    ...(open.mrp ? { mrpMinor: toMinor(open.mrp) } : {}),
                    ...(open.cost ? { unitCostMinor: toMinor(open.cost) } : {}),
                  },
                ],
              },
              true,
            );
            if (res) {
              setNotice(`Opening stock posted as ${res.adjustmentNo}.`);
              setOpen({ ...open, batchNo: "", expiryDate: "", mrp: "", cost: "", quantity: "" });
            }
          }}
        >
          <StorePicker id="open-store" value={open.storeId} onChange={(v) => setOpen({ ...open, storeId: v })} stores={stores} />
          <ItemPicker id="open-item" value={open.itemId} onChange={(v) => setOpen({ ...open, itemId: v })} items={items} />
          <div className="grid grid-cols-2 gap-3">
            <Field title="Batch no." id="open-batch">
              <Input id="open-batch" value={open.batchNo} onChange={(e) => setOpen({ ...open, batchNo: e.target.value })} />
            </Field>
            <Field title="Expiry" id="open-exp">
              <Input id="open-exp" type="date" value={open.expiryDate} onChange={(e) => setOpen({ ...open, expiryDate: e.target.value })} />
            </Field>
            <Field title="MRP per unit (₹)" id="open-mrp">
              <Input id="open-mrp" inputMode="decimal" value={open.mrp} onChange={(e) => setOpen({ ...open, mrp: e.target.value })} />
            </Field>
            <Field title="Cost per unit (₹)" id="open-cost">
              <Input id="open-cost" inputMode="decimal" value={open.cost} onChange={(e) => setOpen({ ...open, cost: e.target.value })} />
            </Field>
            <Field title="Quantity (base units)" id="open-qty">
              <Input id="open-qty" inputMode="decimal" value={open.quantity} onChange={(e) => setOpen({ ...open, quantity: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" disabled={cmd.busy || !open.storeId || !open.itemId || !(Number(open.quantity) > 0)}>
            Post opening stock
          </Button>
        </form>
      </Section>
      <div className="lg:col-span-2">
        <Refused cmd={cmd} />
      </div>
    </div>
  );
}

// ---- indents and transfers ----------------------------------------------------------------------------------

type Indent = { id: string; indent_no: string; status: string; requesting_store: string; supplying_store: string; requested_by_name: string | null; requested_at: string; note: string | null; lines: { id: string; item_id: string; item_name: string; base_uom: string; qty_requested: string; qty_approved: string | null; qty_issued: string }[] };
type Transfer = { id: string; transfer_no: string; status: string; from_store: string; to_store: string; indent_no: string | null; dispatched_at: string; lines: { id: string; item_name: string; batch_no: string; base_uom: string; qty_sent: string; qty_received: string | null; discrepancy_reason: string | null }[] };

function IndentsTab() {
  const { facility, can } = useWorkspace();
  const { stores } = useStores();
  const items = useItems();
  const indents = useQuery<{ items: Indent[] }>(`/v1/inventory/requisitions?${query({ facilityId: facility.facilityId })}`, 60_000);
  const transfers = useQuery<{ items: Transfer[] }>(`/v1/inventory/transfers?${query({ facilityId: facility.facilityId, status: "in_transit" })}`, 60_000);
  const cmd = useCommand();
  const [form, setForm] = useState({ from: "", to: "", itemId: "", quantity: "", note: "" });
  const [short, setShort] = useState<Record<string, { quantity: string; reason: string }>>({});
  const refresh = () => {
    void indents.refresh();
    void transfers.refresh();
  };
  return (
    <div className="space-y-4">
      {can("inventory.indent") && (
        <Section title="Raise an indent">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await cmd.run(`/v1/inventory/requisitions`, { requestingStoreId: form.from, supplyingStoreId: form.to, ...(form.note.trim() ? { note: form.note.trim() } : {}), lines: [{ itemId: form.itemId, quantity: Number(form.quantity) }] }, true)) {
                setForm({ ...form, itemId: "", quantity: "", note: "" });
                refresh();
              }
            }}
          >
            <StorePicker id="ind-from" title="For store" value={form.from} onChange={(v) => setForm({ ...form, from: v })} stores={stores} />
            <StorePicker id="ind-to" title="From store" value={form.to} onChange={(v) => setForm({ ...form, to: v })} stores={stores} />
            <ItemPicker id="ind-item" value={form.itemId} onChange={(v) => setForm({ ...form, itemId: v })} items={items} />
            <Field title="Quantity" id="ind-qty">
              <Input id="ind-qty" inputMode="decimal" className="w-28" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Input aria-label="Note" placeholder="Note" className="w-48" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <Button type="submit" disabled={cmd.busy || !form.from || !form.to || !form.itemId || !(Number(form.quantity) > 0)}>
              Raise indent
            </Button>
          </form>
        </Section>
      )}
      <Section title="Indents">
        <LoadingState loading={indents.loading} error={indents.error} refresh={() => void indents.refresh()}>
          {!(indents.data?.items ?? []).length ? (
            <Empty>No indents yet.</Empty>
          ) : (
            (indents.data?.items ?? []).map((r) => (
              <div key={r.id} className="border-b pb-2 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{r.indent_no}</span>
                  <Status value={r.status} />
                  <span>
                    {r.requesting_store} ← {r.supplying_store}
                  </span>
                  <span className="text-muted-foreground">
                    {r.requested_by_name} · {day(r.requested_at)}
                  </span>
                  {r.status === "submitted" && can("inventory.approve") && (
                    <Button size="sm" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/requisitions/${r.id}/approve`, {})) && refresh()}>
                      Approve
                    </Button>
                  )}
                  {["approved", "partially_issued"].includes(r.status) && can("inventory.issue") && (
                    <Button
                      size="sm"
                      disabled={cmd.busy}
                      onClick={async () => {
                        const lines = r.lines.map((l) => ({ itemId: l.item_id, quantity: Number(l.qty_approved ?? 0) - Number(l.qty_issued) })).filter((l) => l.quantity > 0);
                        if (await cmd.run(`/v1/inventory/transfers`, { requisitionId: r.id, lines }, true)) refresh();
                      }}
                    >
                      Dispatch
                    </Button>
                  )}
                  {["submitted", "approved"].includes(r.status) && can("inventory.indent") && (
                    <Button size="sm" variant="ghost" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/requisitions/${r.id}/cancel`, { reason: "Cancelled by the store" })) && refresh()}>
                      Cancel
                    </Button>
                  )}
                </div>
                {r.lines.map((l) => (
                  <div key={l.id} className="text-muted-foreground">
                    {l.item_name}: requested {qty(l.qty_requested)}, approved {qty(l.qty_approved)}, issued {qty(l.qty_issued)} {l.base_uom}
                  </div>
                ))}
              </div>
            ))
          )}
        </LoadingState>
      </Section>
      <Section title="In transit">
        {!(transfers.data?.items ?? []).length ? (
          <Empty>Nothing is in transit.</Empty>
        ) : (
          (transfers.data?.items ?? []).map((t) => (
            <form
              key={t.id}
              className="border-b pb-2 space-y-2 text-sm"
              onSubmit={async (e) => {
                e.preventDefault();
                const lines = t.lines.filter((l) => short[l.id]?.quantity !== undefined && short[l.id]?.quantity !== "").map((l) => ({ lineId: l.id, quantity: Number(short[l.id]!.quantity), ...(short[l.id]!.reason.trim() ? { reason: short[l.id]!.reason.trim() } : {}) }));
                if (await cmd.run(`/v1/inventory/transfers/${t.id}/receive`, lines.length ? { lines } : {})) refresh();
              }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{t.transfer_no}</span>
                <span>
                  {t.from_store} → {t.to_store}
                </span>
                {t.indent_no && <span className="text-muted-foreground">{t.indent_no}</span>}
                <span className="text-muted-foreground">sent {day(t.dispatched_at)}</span>
                {can("inventory.receive") && (
                  <Button size="sm" type="submit" disabled={cmd.busy}>
                    Receive
                  </Button>
                )}
              </div>
              {t.lines.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span>
                    {l.item_name} · {l.batch_no}: sent {qty(l.qty_sent)} {l.base_uom}
                  </span>
                  {can("inventory.receive") && (
                    <>
                      <Input aria-label={`Received ${l.item_name}`} placeholder="Received (if short)" className="w-36" inputMode="decimal" value={short[l.id]?.quantity ?? ""} onChange={(e) => setShort({ ...short, [l.id]: { reason: short[l.id]?.reason ?? "", quantity: e.target.value } })} />
                      <Input aria-label={`Why short ${l.item_name}`} placeholder="Why short?" className="w-48" value={short[l.id]?.reason ?? ""} onChange={(e) => setShort({ ...short, [l.id]: { quantity: short[l.id]?.quantity ?? "", reason: e.target.value } })} />
                    </>
                  )}
                </div>
              ))}
            </form>
          ))
        )}
      </Section>
      <Refused cmd={cmd} />
    </div>
  );
}

// ---- purchasing ---------------------------------------------------------------------------------------------

type Po = { id: string; po_no: string; status: string; supplier_id: string; supplier_name: string; store_id: string; store_name: string; total_minor: number; created_by: string; created_by_name: string | null; expected_on: string | null; lines: { id: string; item_id: string; item_name: string; base_uom: string; uom: string; factor_to_base: string; quantity: string; unit_price_minor: number; gst_rate_bp: number; received_base_qty: string }[] };
type Grn = { id: string; grn_no: string; received_at: string; supplier_id: string; supplier_name: string; store_name: string; po_no: string | null; value_minor: number; supplier_invoice_ref: string | null };
type Invoice = { id: string; invoice_no: string; invoice_date: string; due_on: string; total_minor: number; taxable_minor: number; expected_minor: number; match_status: string; status: string; supplier_name: string };

function PurchasingTab() {
  const { facility, can, me } = useWorkspace();
  const { stores } = useStores();
  const items = useItems();
  const suppliers = useSuppliers();
  const pos = useQuery<{ items: Po[] }>(`/v1/inventory/purchase-orders?${query({ facilityId: facility.facilityId })}`, 60_000);
  const grns = useQuery<{ items: Grn[] }>(`/v1/inventory/goods-receipts?${query({ facilityId: facility.facilityId, uninvoiced: true })}`);
  const invoices = useQuery<{ items: Invoice[] }>(`/v1/inventory/supplier-invoices?${query({ facilityId: facility.facilityId })}`);
  const cmd = useCommand();
  const [po, setPo] = useState({ storeId: "", supplierId: "", itemId: "", uom: "", quantity: "", price: "", gst: "1200" });
  const [receiving, setReceiving] = useState("");
  const [grnLines, setGrnLines] = useState<Record<string, { batchNo: string; expiryDate: string; mrp: string; quantity: string }>>({});
  const [inv, setInv] = useState({ grnId: "", invoiceNo: "", invoiceDate: "", taxable: "", cgst: "", sgst: "", igst: "", total: "", reason: "" });
  const refresh = () => {
    void pos.refresh();
    void grns.refresh();
    void invoices.refresh();
  };
  const receivingPo = (pos.data?.items ?? []).find((p) => p.id === receiving);
  const grn = (grns.data?.items ?? []).find((g) => g.id === inv.grnId);
  return (
    <div className="space-y-4">
      {can("inventory.purchase") && (
        <Section title="New purchase order">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await cmd.run(
                  `/v1/inventory/purchase-orders`,
                  { storeId: po.storeId, supplierId: po.supplierId, lines: [{ itemId: po.itemId, ...(po.uom.trim() ? { uom: po.uom.trim() } : {}), quantity: Number(po.quantity), unitPriceMinor: toMinor(po.price), gstRateBp: Number(po.gst) }] },
                  true,
                )
              ) {
                setPo({ ...po, itemId: "", uom: "", quantity: "", price: "" });
                refresh();
              }
            }}
          >
            <StorePicker id="po-store" title="Deliver to" value={po.storeId} onChange={(v) => setPo({ ...po, storeId: v })} stores={stores} />
            <Field title="Supplier" id="po-sup">
              <Choice label="Supplier" value={po.supplierId} onChange={(v) => setPo({ ...po, supplierId: v })} options={[{ value: "", label: "Choose a supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
            </Field>
            <ItemPicker id="po-item" value={po.itemId} onChange={(v) => setPo({ ...po, itemId: v })} items={items} />
            <Field title="Pack (blank = base unit)" id="po-uom">
              <Input id="po-uom" className="w-28" value={po.uom} onChange={(e) => setPo({ ...po, uom: e.target.value })} placeholder="strip" />
            </Field>
            <Field title="Qty" id="po-qty">
              <Input id="po-qty" className="w-20" inputMode="decimal" value={po.quantity} onChange={(e) => setPo({ ...po, quantity: e.target.value })} />
            </Field>
            <Field title="Price per pack (₹)" id="po-price">
              <Input id="po-price" className="w-28" inputMode="decimal" value={po.price} onChange={(e) => setPo({ ...po, price: e.target.value })} />
            </Field>
            <Field title="GST" id="po-gst">
              <Choice label="GST" value={po.gst} onChange={(v) => setPo({ ...po, gst: v })} options={["0", "500", "1200", "1800", "2800"].map((v) => ({ value: v, label: `${Number(v) / 100}%` }))} />
            </Field>
            <Button type="submit" disabled={cmd.busy || !po.storeId || !po.supplierId || !po.itemId || !(Number(po.quantity) > 0) || po.price === ""}>
              Raise order
            </Button>
          </form>
        </Section>
      )}
      <Section title="Purchase orders">
        <LoadingState loading={pos.loading} error={pos.error} refresh={() => void pos.refresh()}>
          {!(pos.data?.items ?? []).length ? (
            <Empty>No purchase orders yet.</Empty>
          ) : (
            (pos.data?.items ?? []).map((o) => (
              <div key={o.id} className="border-b pb-2 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{o.po_no}</span>
                  <Status value={o.status} />
                  <span>
                    {o.supplier_name} → {o.store_name}
                  </span>
                  <span>{rupees(o.total_minor)}</span>
                  <span className="text-muted-foreground">by {o.created_by_name}</span>
                  {o.status === "draft" && can("inventory.approve") && o.created_by !== me.staffId && (
                    <Button size="sm" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/purchase-orders/${o.id}/approve`, {})) && refresh()}>
                      Approve
                    </Button>
                  )}
                  {o.status === "approved" && can("inventory.purchase") && (
                    <Button size="sm" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/purchase-orders/${o.id}/send`, {})) && refresh()}>
                      Mark sent
                    </Button>
                  )}
                  {["approved", "sent", "partially_received"].includes(o.status) && can("inventory.receive") && (
                    <Button size="sm" variant="outline" onClick={() => setReceiving(receiving === o.id ? "" : o.id)}>
                      Receive goods
                    </Button>
                  )}
                  {o.status === "partially_received" && can("inventory.purchase") && (
                    <Button size="sm" variant="ghost" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/purchase-orders/${o.id}/close`, {})) && refresh()}>
                      Short-close
                    </Button>
                  )}
                  {["draft", "approved", "sent"].includes(o.status) && can("inventory.purchase") && (
                    <Button size="sm" variant="ghost" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/purchase-orders/${o.id}/cancel`, { reason: "Cancelled by purchasing" })) && refresh()}>
                      Cancel
                    </Button>
                  )}
                </div>
                {o.lines.map((l) => (
                  <div key={l.id} className="text-muted-foreground">
                    {l.item_name}: {qty(l.quantity)} {l.uom} @ {rupees(l.unit_price_minor)} + {l.gst_rate_bp / 100}% GST · received {qty(l.received_base_qty)} of {Number(l.quantity) * Number(l.factor_to_base)} {l.base_uom}
                  </div>
                ))}
              </div>
            ))
          )}
        </LoadingState>
      </Section>
      {receivingPo && (
        <Section title={`Receive against ${receivingPo.po_no} (quantities in base units)`}>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const lines = receivingPo.lines
                .filter((l) => Number(grnLines[l.id]?.quantity) > 0)
                .map((l) => {
                  const g = grnLines[l.id]!;
                  return { purchaseOrderLineId: l.id, itemId: l.item_id, batchNo: g.batchNo.trim(), qtyReceived: Number(g.quantity), ...(g.expiryDate ? { expiryDate: g.expiryDate } : {}), ...(g.mrp ? { mrpMinor: toMinor(g.mrp) } : {}) };
                });
              const res = await cmd.run<{ grnNo: string }>(`/v1/inventory/goods-receipts`, { storeId: receivingPo.store_id, purchaseOrderId: receivingPo.id, lines }, true);
              if (res) {
                setReceiving("");
                setGrnLines({});
                refresh();
              }
            }}
          >
            {receivingPo.lines.map((l) => {
              const g = grnLines[l.id] ?? { batchNo: "", expiryDate: "", mrp: "", quantity: "" };
              const set = (patch: Partial<typeof g>) => setGrnLines({ ...grnLines, [l.id]: { ...g, ...patch } });
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-48 font-medium">{l.item_name}</span>
                  <Input aria-label={`Batch for ${l.item_name}`} placeholder="Batch no." className="w-28" value={g.batchNo} onChange={(e) => set({ batchNo: e.target.value })} />
                  <Input aria-label={`Expiry for ${l.item_name}`} type="date" className="w-40" value={g.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} />
                  <Input aria-label={`MRP for ${l.item_name}`} placeholder="MRP/unit ₹" className="w-28" inputMode="decimal" value={g.mrp} onChange={(e) => set({ mrp: e.target.value })} />
                  <Input aria-label={`Quantity for ${l.item_name}`} placeholder={`Qty (${l.base_uom})`} className="w-28" inputMode="decimal" value={g.quantity} onChange={(e) => set({ quantity: e.target.value })} />
                </div>
              );
            })}
            <Button type="submit" disabled={cmd.busy}>
              Post goods receipt
            </Button>
          </form>
        </Section>
      )}
      {can("inventory.purchase") && (
        <Section title="Record a supplier invoice">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!grn) return;
              const res = await cmd.run<{ matchStatus: string }>(
                `/v1/inventory/supplier-invoices`,
                { supplierId: grn.supplier_id, invoiceNo: inv.invoiceNo.trim(), invoiceDate: inv.invoiceDate, taxableMinor: toMinor(inv.taxable), cgstMinor: toMinor(inv.cgst || "0"), sgstMinor: toMinor(inv.sgst || "0"), igstMinor: toMinor(inv.igst || "0"), totalMinor: toMinor(inv.total), goodsReceiptIds: [grn.id] },
                true,
              );
              if (res) {
                setInv({ grnId: "", invoiceNo: "", invoiceDate: "", taxable: "", cgst: "", sgst: "", igst: "", total: "", reason: "" });
                refresh();
              }
            }}
          >
            <Field title="Goods receipt" id="inv-grn">
              <Choice label="Goods receipt" value={inv.grnId} onChange={(v) => setInv({ ...inv, grnId: v })} options={[{ value: "", label: "Choose a receipt" }, ...(grns.data?.items ?? []).map((g) => ({ value: g.id, label: `${g.grn_no} · ${g.supplier_name} · ${rupees(g.value_minor)}` }))]} />
            </Field>
            <Field title="Invoice no." id="inv-no">
              <Input id="inv-no" className="w-32" value={inv.invoiceNo} onChange={(e) => setInv({ ...inv, invoiceNo: e.target.value })} />
            </Field>
            <Field title="Date" id="inv-date">
              <Input id="inv-date" type="date" value={inv.invoiceDate} onChange={(e) => setInv({ ...inv, invoiceDate: e.target.value })} />
            </Field>
            {(["taxable", "cgst", "sgst", "igst", "total"] as const).map((k) => (
              <Field key={k} title={`${k.toUpperCase()} (₹)`} id={`inv-${k}`}>
                <Input id={`inv-${k}`} className="w-24" inputMode="decimal" value={inv[k]} onChange={(e) => setInv({ ...inv, [k]: e.target.value })} />
              </Field>
            ))}
            <Button type="submit" disabled={cmd.busy || !grn || !inv.invoiceNo.trim() || !inv.invoiceDate || inv.taxable === "" || inv.total === ""}>
              Record invoice
            </Button>
          </form>
        </Section>
      )}
      <Section title="Supplier invoices">
        {!(invoices.data?.items ?? []).length ? (
          <Empty>No supplier invoices yet.</Empty>
        ) : (
          (invoices.data?.items ?? []).map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-3 border-b pb-2 text-sm">
              <span className="font-medium">{v.invoice_no}</span>
              <span>{v.supplier_name}</span>
              <span>{rupees(v.total_minor)}</span>
              <Badge variant={v.match_status === "matched" ? "secondary" : "destructive"}>{v.match_status === "matched" ? "Matched" : `Variance ${rupees(v.taxable_minor - v.expected_minor)}`}</Badge>
              <Status value={v.status} />
              <span className="text-muted-foreground">due {day(v.due_on)}</span>
              {v.status === "recorded" && can("inventory.approve") && (
                <>
                  {v.match_status === "variance" && <Input aria-label="Reason to accept the variance" placeholder="Why accept the variance?" className="w-56" value={inv.reason} onChange={(e) => setInv({ ...inv, reason: e.target.value })} />}
                  <Button size="sm" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/supplier-invoices/${v.id}/approve`, inv.reason.trim() ? { reason: inv.reason.trim() } : {})) && refresh()}>
                    Approve for payment
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </Section>
      <Refused cmd={cmd} />
    </div>
  );
}

// ---- stock counts -------------------------------------------------------------------------------------------

type Count = { id: string; count_no: string; status: string; store_name: string; created_at: string; submitted_by: string | null };
type CountSheet = Count & { lines: { id: string; item_name: string; base_uom: string; batch_no: string; expiry_date: string | null; system_qty: string; counted_qty: string | null }[] };

function CountsTab() {
  const { facility, can, me } = useWorkspace();
  const { stores } = useStores();
  const counts = useQuery<{ items: Count[] }>(`/v1/inventory/counts?${query({ facilityId: facility.facilityId })}`);
  const [openId, setOpenId] = useState("");
  const sheet = useQuery<CountSheet>(openId ? `/v1/inventory/counts/${openId}` : null);
  const cmd = useCommand();
  const [storeId, setStoreId] = useState(""),
    [counted, setCounted] = useState<Record<string, string>>({});
  const refresh = () => {
    void counts.refresh();
    void sheet.refresh();
  };
  const s = sheet.data;
  return (
    <div className="space-y-4">
      <Section title="Open a count">
        <div className="flex flex-wrap items-end gap-3">
          <StorePicker id="count-store" value={storeId} onChange={setStoreId} stores={stores} />
          <Button
            disabled={cmd.busy || !storeId}
            onClick={async () => {
              const res = await cmd.run<{ stockCountId: string }>(`/v1/inventory/stores/${storeId}/counts`, undefined, true);
              if (res) {
                setOpenId(res.stockCountId);
                void counts.refresh();
              }
            }}
          >
            Open count sheet
          </Button>
        </div>
        {(counts.data?.items ?? []).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
            <Button size="sm" variant="link" onClick={() => setOpenId(c.id)}>
              {c.count_no}
            </Button>
            <span>{c.store_name}</span>
            <Status value={c.status} />
            <span className="text-muted-foreground">{day(c.created_at)}</span>
          </div>
        ))}
      </Section>
      {s && (
        <Section title={`${s.count_no} · ${s.store_name}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Counted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.item_name}</TableCell>
                  <TableCell>
                    {l.batch_no} <span className="text-muted-foreground">exp {day(l.expiry_date)}</span>
                  </TableCell>
                  <TableCell>
                    {qty(l.system_qty)} {l.base_uom}
                  </TableCell>
                  <TableCell>
                    {s.status === "open" ? (
                      <Input aria-label={`Counted ${l.item_name} ${l.batch_no}`} className="w-24" inputMode="decimal" value={counted[l.id] ?? (l.counted_qty === null ? "" : String(Number(l.counted_qty)))} onChange={(e) => setCounted({ ...counted, [l.id]: e.target.value })} />
                    ) : (
                      <span className={Number(l.counted_qty) !== Number(l.system_qty) ? "font-medium text-destructive" : ""}>{qty(l.counted_qty)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap gap-2">
            {s.status === "open" && (
              <>
                <Button
                  variant="outline"
                  disabled={cmd.busy || !Object.keys(counted).length}
                  onClick={async () => {
                    const lines = Object.entries(counted).filter(([, v]) => v !== "").map(([lineId, v]) => ({ lineId, countedQty: Number(v) }));
                    if (await cmd.run(`/v1/inventory/counts/${s.id}/record`, { lines })) {
                      setCounted({});
                      refresh();
                    }
                  }}
                >
                  Save counts
                </Button>
                <Button disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/counts/${s.id}/submit`)) && refresh()}>
                  Submit for approval
                </Button>
              </>
            )}
            {s.status === "submitted" && can("inventory.approve") && s.submitted_by !== me.staffId && (
              <>
                <Button disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/counts/${s.id}/approve`, {})) && refresh()}>
                  Approve variances
                </Button>
                <Button variant="ghost" disabled={cmd.busy} onClick={async () => (await cmd.run(`/v1/inventory/counts/${s.id}/approve`, { reject: true })) && refresh()}>
                  Send back for recount
                </Button>
              </>
            )}
          </div>
        </Section>
      )}
      <Refused cmd={cmd} />
    </div>
  );
}

// ---- masters ------------------------------------------------------------------------------------------------

function MastersTab() {
  const { facility, can } = useWorkspace();
  const [q, setQ] = useState("");
  const items = useQuery<{ items: Item[] }>(`/v1/inventory/items?${query({ q, limit: 200 })}`);
  const suppliers = useQuery<{ items: Supplier[] }>(`/v1/inventory/suppliers`);
  const stores = useStores();
  const cmd = useCommand();
  const blankItem = { code: "", name: "", itemType: "drug", baseUom: "tablet", hsnCode: "", genericName: "", strength: "", dosageForm: "tablet", schedule: "none", packUom: "", packFactor: "" };
  const [item, setItem] = useState(blankItem);
  const [sup, setSup] = useState({ code: "", name: "", gstin: "", phone: "" });
  const [store, setStore] = useState({ code: "", name: "", storeType: "pharmacy", licence: "", dispense: false });
  const manage = can("inventory.manage");
  return (
    <div className="space-y-4">
      <Section title="Items">
        <Input aria-label="Search items" placeholder="Search by name, code or generic" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
        <LoadingState loading={items.loading} error={items.error} refresh={() => void items.refresh()}>
          {(items.data?.items ?? []).map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{i.name}</span>
              <span className="text-muted-foreground">{i.code}</span>
              <Badge variant="secondary">{label(i.item_type)}</Badge>
              {i.generic_name && <span className="text-muted-foreground">{[i.generic_name, i.strength].filter(Boolean).join(" ")}</span>}
              {i.regulatory_schedule && i.regulatory_schedule !== "none" && <Badge variant="outline">Schedule {i.regulatory_schedule}</Badge>}
            </div>
          ))}
        </LoadingState>
        {manage && (
          <form
            className="flex flex-wrap items-end gap-3 border-t pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const drug = item.itemType === "drug" ? { drug: { genericName: item.genericName.trim(), dosageForm: item.dosageForm, regulatorySchedule: item.schedule, ...(item.strength.trim() ? { strength: item.strength.trim() } : {}) } } : {};
              const uoms = item.packUom.trim() && Number(item.packFactor) > 0 ? { uoms: [{ uom: item.packUom.trim(), factorToBase: Number(item.packFactor), isPurchaseUom: true }] } : {};
              if (await cmd.run(`/v1/inventory/items`, { code: item.code.trim(), name: item.name.trim(), itemType: item.itemType, baseUom: item.baseUom.trim(), ...(item.hsnCode.trim() ? { hsnCode: item.hsnCode.trim() } : {}), ...drug, ...uoms }, true)) {
                setItem(blankItem);
                void items.refresh();
              }
            }}
          >
            <Field title="Code" id="it-code">
              <Input id="it-code" className="w-28" value={item.code} onChange={(e) => setItem({ ...item, code: e.target.value })} />
            </Field>
            <Field title="Name" id="it-name">
              <Input id="it-name" className="w-56" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
            </Field>
            <Field title="Type" id="it-type">
              <Choice label="Type" value={item.itemType} onChange={(v) => setItem({ ...item, itemType: v })} options={["drug", "consumable", "implant", "reagent", "vaccine", "general"].map((v) => ({ value: v, label: label(v) }))} />
            </Field>
            <Field title="Base unit" id="it-uom">
              <Input id="it-uom" className="w-24" value={item.baseUom} onChange={(e) => setItem({ ...item, baseUom: e.target.value })} />
            </Field>
            <Field title="HSN" id="it-hsn">
              <Input id="it-hsn" className="w-24" value={item.hsnCode} onChange={(e) => setItem({ ...item, hsnCode: e.target.value })} />
            </Field>
            {item.itemType === "drug" && (
              <>
                <Field title="Generic" id="it-gen">
                  <Input id="it-gen" className="w-40" value={item.genericName} onChange={(e) => setItem({ ...item, genericName: e.target.value })} />
                </Field>
                <Field title="Strength" id="it-str">
                  <Input id="it-str" className="w-24" value={item.strength} onChange={(e) => setItem({ ...item, strength: e.target.value })} />
                </Field>
                <Field title="Form" id="it-form">
                  <Choice label="Form" value={item.dosageForm} onChange={(v) => setItem({ ...item, dosageForm: v })} options={["tablet", "capsule", "syrup", "suspension", "injection", "infusion", "ointment", "cream", "drops", "inhaler", "other"].map((v) => ({ value: v, label: label(v) }))} />
                </Field>
                <Field title="Schedule" id="it-sch">
                  <Choice label="Schedule" value={item.schedule} onChange={(v) => setItem({ ...item, schedule: v })} options={["none", "G", "H", "H1", "X"].map((v) => ({ value: v, label: v === "none" ? "None" : `Schedule ${v}` }))} />
                </Field>
              </>
            )}
            <Field title="Pack unit / size" id="it-pack">
              <div className="flex gap-1">
                <Input id="it-pack" className="w-20" placeholder="strip" value={item.packUom} onChange={(e) => setItem({ ...item, packUom: e.target.value })} />
                <Input aria-label="Units per pack" className="w-16" placeholder="10" inputMode="decimal" value={item.packFactor} onChange={(e) => setItem({ ...item, packFactor: e.target.value })} />
              </div>
            </Field>
            <Button type="submit" disabled={cmd.busy || !item.code.trim() || item.name.trim().length < 2 || (item.itemType === "drug" && item.genericName.trim().length < 2)}>
              Add item
            </Button>
          </form>
        )}
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Suppliers">
          {(suppliers.data?.items ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">{s.gstin ?? s.code}</span>
              <span className="text-muted-foreground">{s.payment_terms_days} days</span>
              {s.status !== "active" && <Status value={s.status} />}
            </div>
          ))}
          {manage && (
            <form
              className="flex flex-wrap items-end gap-2 border-t pt-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await cmd.run(`/v1/inventory/suppliers`, { code: sup.code.trim(), name: sup.name.trim(), ...(sup.gstin.trim() ? { gstin: sup.gstin.trim() } : {}), ...(sup.phone.trim() ? { phone: sup.phone.trim() } : {}) }, true)) {
                  setSup({ code: "", name: "", gstin: "", phone: "" });
                  void suppliers.refresh();
                }
              }}
            >
              <Input aria-label="Supplier code" placeholder="Code" className="w-24" value={sup.code} onChange={(e) => setSup({ ...sup, code: e.target.value })} />
              <Input aria-label="Supplier name" placeholder="Name" className="w-48" value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} />
              <Input aria-label="GSTIN" placeholder="GSTIN" className="w-44" value={sup.gstin} onChange={(e) => setSup({ ...sup, gstin: e.target.value })} />
              <Input aria-label="Phone" placeholder="+91…" className="w-36" value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value })} />
              <Button type="submit" disabled={cmd.busy || !sup.code.trim() || sup.name.trim().length < 2}>
                Add supplier
              </Button>
            </form>
          )}
        </Section>
        <Section title="Stores at this clinic">
          {(stores.data?.items ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">{s.code}</span>
              <Badge variant="secondary">{label(s.store_type)}</Badge>
              {s.can_dispense_to_patient && <Badge variant="outline">Dispenses</Badge>}
              {s.status !== "active" && <Status value={s.status} />}
            </div>
          ))}
          {manage && (
            <form
              className="flex flex-wrap items-end gap-2 border-t pt-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await cmd.run(
                    `/v1/inventory/stores`,
                    { facilityId: facility.facilityId, code: store.code.trim(), name: store.name.trim(), storeType: store.storeType, ...(store.dispense ? { canDispenseToPatient: true } : {}), ...(store.licence.trim() ? { drugLicenceNo: store.licence.trim() } : {}) },
                    true,
                  )
                ) {
                  setStore({ code: "", name: "", storeType: "pharmacy", licence: "", dispense: false });
                  void stores.refresh();
                }
              }}
            >
              <Input aria-label="Store code" placeholder="Code" className="w-24" value={store.code} onChange={(e) => setStore({ ...store, code: e.target.value })} />
              <Input aria-label="Store name" placeholder="Name" className="w-44" value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
              <Choice label="Store type" value={store.storeType} onChange={(v) => setStore({ ...store, storeType: v })} options={["central", "pharmacy", "ward", "theatre", "icu", "lab", "emergency"].map((v) => ({ value: v, label: label(v) }))} />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={store.dispense} onChange={(e) => setStore({ ...store, dispense: e.target.checked })} /> Dispenses to patients
              </label>
              {store.dispense && <Input aria-label="Drug licence number" placeholder="Drug licence no." className="w-44" value={store.licence} onChange={(e) => setStore({ ...store, licence: e.target.value })} />}
              <Button type="submit" disabled={cmd.busy || !store.code.trim() || store.name.trim().length < 2}>
                Add store
              </Button>
            </form>
          )}
        </Section>
      </div>
      <Refused cmd={cmd} />
    </div>
  );
}

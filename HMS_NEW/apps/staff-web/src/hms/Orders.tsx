// Orders & results on one encounter (ERD m06): order lab tests, panels, imaging and other services
// (searched from the catalogue or taken from an order set), cancel what has no result yet, read the
// released reports and acknowledge them. The API checks the permission at the encounter's clinic and
// the care relationship.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { label } from "./model";
import { refusal } from "./forms";
import { Choice, ErrorMessage, Field, Status } from "./ui";
import {
  cancellable,
  DIAGNOSTICS_REASONS,
  flagMark,
  referenceText,
  released,
  resultValue,
  type OrderItemView,
  type Orderable,
  type OrderSet,
  type OrderView,
  type Priority,
} from "./diagnostics";

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const r = refusal(cmd.failure);
  return <ErrorMessage text={(r && DIAGNOSTICS_REASONS[r]) || cmd.error} />;
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

export function EncounterOrders({ encounterId, active }: { encounterId: string; active: boolean }) {
  const { can } = useWorkspace();
  const readable = can("results.read");
  const orders = useQuery<{ orders: OrderView[] }>(readable ? `/v1/encounters/${encounterId}/orders` : null);
  const [ordering, setOrdering] = useState(false);
  if (!readable && !can("orders.place")) return null;
  return (
    <Section
      title="Orders & results"
      action={
        active &&
        can("orders.place") && (
          <Button variant="ghost" size="sm" onClick={() => setOrdering(!ordering)}>
            {ordering ? "Close" : "Place order"}
          </Button>
        )
      }
    >
      {ordering && (
        <PlaceOrder
          encounterId={encounterId}
          onPlaced={() => {
            setOrdering(false);
            void orders.refresh();
          }}
        />
      )}
      <ErrorMessage text={orders.error} />
      {orders.data?.orders.map((o) => (
        <div key={o.orderId} className="border rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{o.requisitionNo}</span>
            <Status value={o.status} />
            {o.priority !== "routine" && <Badge variant="destructive">{label(o.priority)}</Badge>}
            <span className="text-muted-foreground">
              {when(o.orderedAt)} · {o.orderedByName}
              {o.clinicalIndication ? ` · ${o.clinicalIndication}` : ""}
            </span>
          </div>
          {o.items.map((i) => (
            <Item key={i.orderItemId} item={i} onChanged={() => void orders.refresh()} />
          ))}
        </div>
      ))}
      {readable && orders.data && !orders.data.orders.length && <p className="text-sm text-muted-foreground">No orders on this visit.</p>}
    </Section>
  );
}

function PlaceOrder({ encounterId, onPlaced }: { encounterId: string; onPlaced: () => void }) {
  const { facility } = useWorkspace();
  const cmd = useCommand();
  const [term, setTerm] = useState(""),
    [cart, setCart] = useState<Orderable[]>([]),
    [priority, setPriority] = useState<Priority>("routine"),
    [indication, setIndication] = useState(""),
    [setName, setSetName] = useState(""),
    [notice, setNotice] = useState("");
  const search = useQuery<{ items: Orderable[] }>(term.trim().length >= 2 ? `/v1/orderables?${query({ facilityId: facility.facilityId, q: term.trim() })}` : null);
  const sets = useQuery<{ items: OrderSet[] }>(`/v1/order-sets?${query({ facilityId: facility.facilityId })}`);
  const place = async (body: Record<string, unknown>) => {
    if (await cmd.run(`/v1/encounters/${encounterId}/orders`, { priority, ...(indication.trim() ? { clinicalIndication: indication.trim() } : {}), ...body }, true)) {
      setCart([]);
      onPlaced();
    }
  };
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field title="Search tests and services" id="order-search">
          <Input id="order-search" placeholder="e.g. haemoglobin, x-ray" value={term} onChange={(e) => setTerm(e.target.value)} />
        </Field>
        <Field title="Priority" id="order-priority">
          <Choice label="Priority" value={priority} onChange={(v) => setPriority(v as Priority)} options={["routine", "urgent", "stat"].map((v) => ({ value: v, label: label(v) }))} />
        </Field>
      </div>
      {search.data?.items.map((s) => (
        <div key={s.serviceItemId} className="flex items-center justify-between text-sm border-b pb-1">
          <span>
            {s.name} <span className="text-muted-foreground">· {label(s.category)}{s.specimenType ? ` · ${label(s.specimenType)}` : ""}</span>
          </span>
          <Button size="sm" variant="outline" disabled={cart.some((c) => c.serviceItemId === s.serviceItemId)} onClick={() => setCart([...cart, s])}>
            Add
          </Button>
        </div>
      ))}
      {term.trim().length >= 2 && search.data && !search.data.items.length && <p className="text-sm text-muted-foreground">Nothing matches.</p>}
      {cart.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cart.map((c) => (
            <Badge key={c.serviceItemId} variant="secondary">
              {c.name}{" "}
              <button type="button" aria-label={`Remove ${c.name}`} onClick={() => setCart(cart.filter((x) => x.serviceItemId !== c.serviceItemId))}>
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Field title="Clinical indication" id="order-indication">
        <Input id="order-indication" maxLength={1000} value={indication} onChange={(e) => setIndication(e.target.value)} />
      </Field>
      <Refused cmd={cmd} />
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <div className="flex flex-wrap gap-2 items-end">
        <Button disabled={cmd.busy || !cart.length} onClick={() => void place({ items: cart.map((c) => ({ serviceItemId: c.serviceItemId, ...(c.modality === "US" && /obstetric|pregnan/i.test(c.name) ? { details: { obstetric: true } } : {}) })) })}>
          Place order
        </Button>
        <Input aria-label="Order set name" className="w-48" placeholder="Save as my set…" value={setName} onChange={(e) => setSetName(e.target.value)} />
        <Button
          variant="outline"
          disabled={cmd.busy || !cart.length || setName.trim().length < 2}
          onClick={async () => {
            if (await cmd.run("/v1/order-sets", { name: setName.trim(), items: cart.map((c) => ({ serviceItemId: c.serviceItemId })) }, true)) {
              setNotice(`Saved "${setName.trim()}" to your order sets.`);
              setSetName("");
              void sets.refresh();
            }
          }}
        >
          Save set
        </Button>
      </div>
      {!!sets.data?.items.length && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Order sets</p>
          {sets.data.items.map((s) => (
            <div key={s.orderSetId} className="flex items-center justify-between text-sm">
              <span>
                {s.name} <span className="text-muted-foreground">· {s.scope === "personal" ? "mine" : s.departmentName} · {s.items.map((i) => i.name).join(", ")}</span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" disabled={cmd.busy} onClick={() => void place({ orderSetId: s.orderSetId })}>
                  Order set
                </Button>
                {s.scope === "personal" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={cmd.busy}
                    onClick={async () => {
                      if (await cmd.run(`/v1/order-sets/${s.orderSetId}/retire`, { version: s.version })) void sets.refresh();
                    }}
                  >
                    Retire
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Results({ rows }: { rows: OrderItemView["results"] }) {
  if (!rows.length) return null;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.resultItemId} className={r.isCritical ? "text-destructive font-medium" : r.abnormalFlag && r.abnormalFlag !== "normal" ? "font-medium" : ""}>
            <td className="py-0.5">{r.name}</td>
            <td>
              {resultValue(r)} {flagMark(r.abnormalFlag)}
            </td>
            <td className="text-muted-foreground">{referenceText(r)}</td>
            <td className="text-muted-foreground">{label(r.status)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Item({ item, onChanged }: { item: OrderItemView; onChanged: () => void }) {
  const { me, can } = useWorkspace();
  const cmd = useCommand();
  const [cancelling, setCancelling] = useState(false),
    [reason, setReason] = useState(""),
    [action, setAction] = useState("");
  const report = item.report;
  const acked = report?.acknowledgements.some((a) => a.staffId === me.staffId);
  return (
    <div className="pl-3 border-l space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{item.name}</span>
        <Status value={item.status} />
        {item.imagingStudy && <span className="text-muted-foreground">{item.imagingStudy.accessionNo}</span>}
        {item.specimens.map((s) => (
          <span key={s.specimenId} className="text-muted-foreground">
            {s.accessionNo} ({label(s.status)}
            {s.rejectionReason ? `: ${label(s.rejectionReason)}` : ""})
          </span>
        ))}
        {item.cancelReason && <span className="text-muted-foreground">— {item.cancelReason}</span>}
        {can("orders.cancel") && cancellable(item.status) && !cancelling && (
          <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
            Cancel
          </Button>
        )}
      </div>
      {cancelling && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await cmd.run(`/v1/order-items/${item.orderItemId}/cancel`, { reason: reason.trim() })) {
              setCancelling(false);
              onChanged();
            }
          }}
        >
          <Input aria-label="Reason for cancelling" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="destructive" disabled={cmd.busy || reason.trim().length < 3}>
            Cancel item
          </Button>
          <Button type="button" variant="ghost" onClick={() => setCancelling(false)}>
            Keep
          </Button>
        </form>
      )}
      <Results rows={item.results} />
      {item.tests.map((t) => (
        <div key={t.orderItemId} className="pl-3">
          <p className="text-sm text-muted-foreground">
            {t.name} · {label(t.status)}
          </p>
          <Results rows={t.results} />
        </div>
      ))}
      {report && (
        <div className="text-sm space-y-1">
          <p>
            Report <Status value={report.status} /> v{report.versionNo}
            {released(report.status) && ` · ${report.releasedByName ?? ""} ${when(report.releasedAt)}`}
          </p>
          {report.body.findings && <p className="whitespace-pre-wrap">Findings: {report.body.findings}</p>}
          {report.body.impression && <p>Impression: {report.body.impression}</p>}
          {report.conclusion && <p>Conclusion: {report.conclusion}</p>}
          {report.amendmentReason && <p className="text-muted-foreground">Amended: {report.amendmentReason}</p>}
          {report.acknowledgements.map((a) => (
            <p key={a.staffId} className="text-muted-foreground">
              Acknowledged by {a.staffName} {when(a.acknowledgedAt)}
              {a.actionTaken ? ` — ${a.actionTaken}` : ""}
            </p>
          ))}
          {released(report.status) && !acked && can("results.acknowledge") && (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await cmd.run(`/v1/diagnostic-reports/${report.reportId}/acknowledge`, action.trim() ? { actionTaken: action.trim() } : {})) onChanged();
              }}
            >
              <Input aria-label="Action taken" placeholder="Action taken (optional)" value={action} onChange={(e) => setAction(e.target.value)} />
              <Button type="submit" variant="outline" disabled={cmd.busy}>
                Acknowledge
              </Button>
            </form>
          )}
        </div>
      )}
      <Refused cmd={cmd} />
    </div>
  );
}

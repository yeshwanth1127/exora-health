import { GrowthMetric } from "./GrowthMetric";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RotateCw } from "lucide-react";
import { toast } from "@/components/toast-events";
import { GrowthBadge as Badge } from "./GrowthBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/arc/search-field/search-field";
import { SharedField } from "@/components/shared-field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queue, type Category, type LogEntry, type Status, type WaData } from "./whatsapp-data";
import { clock, maskPhone, Pick, startOfToday, statusLabels, Ticks, useNow, type Change } from "./whatsapp-ui";

const categoryText: Record<Category, string> = { service: "Service", utility: "Utility", marketing: "Marketing" };
const PAGE = 50;

export function Activity({ data, change }: { data: WaData; change: Change }) {
  const now = useNow(60_000);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "all">(() => {
    const s = new URLSearchParams(location.search).get("status");
    return s && s in statusLabels ? (s as Status) : "all";
  });
  const [category, setCategory] = useState<Category | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = data.log.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      (category === "all" || e.category === category) &&
      `${e.patient} ${e.phone} ${e.kind} ${e.template ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const todayOut = data.log.filter((e) => e.direction === "out" && e.at >= startOfToday(now));
  const count = (s: Status[]) => todayOut.filter((e) => s.includes(e.status)).length;
  const open = data.log.find((e) => e.id === openId) ?? null;
  const retry = (e: LogEntry) => {
    change((d) => queue(d, { patient: e.patient, phone: e.phone, kind: `${e.kind} · retry`, template: e.template, category: e.category, body: e.body }, Date.now())[0]);
    setOpenId(null);
    toast.success("Sending again");
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {(
          [
            ["Sent today", todayOut.length],
            ["Delivered", count(["delivered", "read"])],
            ["Read", count(["read"])],
            ["Failed", count(["failed"])],
          ] as const
        ).map(([label, n]) => (
          <GrowthMetric key={label} label={label} value={n} context="Today · browser preview message log" />
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="arc-demo-scope w-80">
          <SearchField label="Search messages" placeholder="Patient, number or template" value={q} onValueChange={setQ} />
        </div>
        <SharedField id="wa-log-status" label="Status"><Pick
          id="wa-log-status" className="w-44"
          value={status}
          options={[["all", "All statuses"], ...(Object.entries(statusLabels) as [Status, string][])]}
          onChange={setStatus}
        /></SharedField>
        <SharedField id="wa-log-category" label="Type"><Pick
          id="wa-log-category" className="w-44"
          value={category}
          options={[["all", "All types"], ...(Object.entries(categoryText) as [Category, string][])]}
          onChange={setCategory}
        /></SharedField>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> Live
        </span>
      </div>
      <Card className="gap-0 overflow-hidden p-0 shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Time</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, shown).map((e) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => setOpenId(e.id)}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {e.at < startOfToday(now) && `${new Date(e.at).toLocaleDateString([], { day: "numeric", month: "short" })} `}
                  {clock(e.at)}
                </TableCell>
                <TableCell>
                  <p className="flex items-center gap-1.5">
                    {e.direction === "in" ? <ArrowDownLeft className="size-3.5 text-sky-600" aria-label="Incoming" /> : <ArrowUpRight className="size-3.5 text-muted-foreground" aria-label="Outgoing" />}
                    {e.patient}
                  </p>
                  <p className="text-xs text-muted-foreground">{maskPhone(e.phone)}</p>
                </TableCell>
                <TableCell className="max-w-72">
                  <p className="truncate">{e.kind}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{e.template ?? e.body}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">{categoryText[e.category]}</Badge>
                </TableCell>
                <TableCell>
                  <span className={`flex items-center gap-1.5 text-sm ${e.status === "failed" ? "text-destructive" : ""}`}>
                    <Ticks status={e.status} /> {statusLabels[e.status]}
                    {e.error && <span className="text-xs text-muted-foreground">#{e.error.code}</span>}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No messages match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {rows.length > shown && (
        <Button variant="outline" className="w-full" onClick={() => setShown(shown + PAGE)}>
          Show more ({rows.length - shown} older)
        </Button>
      )}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.kind}</SheetTitle>
                <SheetDescription>
                  {open.direction === "in" ? "From" : "To"} {open.patient} · {open.phone}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6 text-sm">
                {open.error && (
                  <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="font-medium text-destructive">Failed · Meta error {open.error.code}</p>
                    <p>{open.error.text}</p>
                    {open.error.retry && (
                      <Button size="sm" variant="outline" onClick={() => retry(open)}>
                        <RotateCw /> Try again
                      </Button>
                    )}
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Type</dt>
                    <dd>{categoryText[open.category]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Template</dt>
                    <dd className="font-mono text-xs">{open.template ?? (open.direction === "in" ? "—" : "None (inside 24 h window)")}</dd>
                  </div>
                </dl>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Message</p>
                  <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{open.body}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Timeline</p>
                  <ol className="space-y-2 border-l pl-4">
                    {open.history.map((h) => (
                      <li key={h.status} className="flex items-center gap-2">
                        <Ticks status={h.status} />
                        <span className="flex-1">{statusLabels[h.status]}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(h.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

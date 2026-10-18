import { useState } from "react";
import { Megaphone, Plus, Send } from "lucide-react";
import { toast } from "@/components/toast-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  audienceSize,
  render,
  templateIssues,
  uid,
  type Audience,
  type Campaign,
  type CampaignStatus,
  type WaData,
} from "./whatsapp-data";
import type { Attachment } from "./whatsapp-setup";
import { FileSlot, Pick, TemplatePreview, type Change, type Clinic } from "./whatsapp-ui";

const STOP = "Stop promotions";
const statusText: Record<CampaignStatus, string> = {
  in_review: "In review at Meta",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  rejected: "Rejected",
};

export function Promotions({
  data,
  change,
  clinic,
  clinicName,
  canManage,
}: {
  data: WaData;
  change: Change;
  clinic: Clinic;
  clinicName: string;
  canManage: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const specialties = [...new Set(clinic.departments.map((d) => d.name).concat(clinic.doctors.map((d) => d.specialtyName ?? "").filter(Boolean)))];
  const describe = (a: Audience) =>
    a.kind === "all" ? "Everyone opted in" : a.kind === "specialty" ? `${a.value} patients` : `Not seen in ${a.months} months`;
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Promotions go only to the {data.optedIn.toLocaleString()} patients who opted in. Every message has a {STOP} button. Meta bills marketing messages per delivery.
        </p>
        <Button disabled={!canManage} onClick={() => setComposing(true)}>
          <Plus /> New promotion
        </Button>
      </div>
      {data.campaigns.length ? (
        <Card className="gap-0 overflow-hidden p-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promotion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Read</TableHead>
                <TableHead className="text-right">Replied</TableHead>
                <TableHead className="text-right">Opted out</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {describe(c.audience)} · {c.size.toLocaleString()} patients
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.status === "rejected" ? "destructive" : c.status === "sent" ? "outline" : "secondary"} className="font-normal">
                      {c.status === "sending" && <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" />}
                      {statusText[c.status]}
                      {c.status === "scheduled" && c.sendAt ? ` · ${new Date(c.sendAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.stats?.sent.toLocaleString() ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.stats ? pct(c.stats.delivered, c.stats.sent) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.stats ? pct(c.stats.read, c.stats.delivered) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.stats?.replied ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.stats?.optedOut ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {(c.status === "in_review" || c.status === "scheduled") && canManage && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          window.confirm(`Cancel “${c.name}”? Nothing has been sent yet.`) &&
                          change((d) => ({ ...d, campaigns: d.campaigns.filter((x) => x.id !== c.id) }))
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="items-center p-10 text-center shadow-none">
          <Megaphone className="size-5 text-muted-foreground" />
          <p className="font-medium">No promotions yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Announce a health camp, a new doctor or a package to patients who opted in.</p>
        </Card>
      )}
      <Sheet open={composing} onOpenChange={setComposing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>New promotion</SheetTitle>
            <SheetDescription>Meta reviews every promotion before it sends, usually within minutes.</SheetDescription>
          </SheetHeader>
          {composing && (
            <Composer
              specialties={specialties}
              optedIn={data.optedIn}
              clinicName={clinicName}
              onSubmit={(c) => {
                change((d) => ({ ...d, campaigns: [c, ...d.campaigns] }));
                setComposing(false);
                toast.success("Submitted to Meta. It sends once approved.");
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Composer({
  specialties,
  optedIn,
  clinicName,
  onSubmit,
}: {
  specialties: string[];
  optedIn: number;
  clinicName: string;
  onSubmit: (c: Campaign) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Audience["kind"]>("all");
  const [specialty, setSpecialty] = useState(specialties[0] ?? "");
  const [months, setMonths] = useState("6");
  const [header, setHeader] = useState<Attachment | null>(null);
  const [body, setBody] = useState("Hello {{patient_name}}, ");
  const [button, setButton] = useState("Book now");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState("");
  const audience: Audience = kind === "all" ? { kind } : kind === "specialty" ? { kind, value: specialty } : { kind, months: Number(months) };
  const size = audienceSize(audience, optedIn, Math.max(specialties.length, 1));
  const buttons = [button, STOP].filter((b) => b.trim());
  const issues = [
    ...(name.trim() ? [] : ["Name the promotion."]),
    ...templateIssues({ body, buttons }),
    ...(/\{\{\s*(doctor_name|date|time|booking_ref)\s*\}\}/.test(body) ? ["Promotions can only use the patient's name and the clinic name."] : []),
    ...(when === "later" && !(sendAt && new Date(sendAt).getTime() > Date.now()) ? ["Pick a send time in the future."] : []),
  ];
  return (
    <div className="grid gap-6 px-4 pb-6 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="promo-name">Name (only your team sees this)</Label>
          <Input id="promo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Free diabetes screening camp" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-audience">Send to</Label>
          <div className="flex flex-wrap gap-2">
            <Pick
              id="promo-audience"
              className="w-56"
              value={kind}
              options={[["all", "Everyone opted in"], ...(specialties.length ? [["specialty", "Patients of a speciality"] as const] : []), ["lapsed", "Patients not seen recently"]]}
              onChange={setKind}
            />
            {kind === "specialty" && <Pick className="w-48" value={specialty} options={specialties.map((s) => [s, s] as const)} onChange={setSpecialty} />}
            {kind === "lapsed" && (
              <Pick className="w-40" value={months} options={[["3", "3 months"], ["6", "6 months"], ["12", "12 months"]]} onChange={setMonths} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">About {size.toLocaleString()} patients. Patients who opted out are always left out.</p>
        </div>
        <div className="space-y-2">
          <Label>Header image</Label>
          <FileSlot id="promo:new" label="Header image" accept="image/jpeg,image/png" value={header} onChange={setHeader} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-body">Message</Label>
          <Textarea id="promo-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Use {"{{patient_name}}"} and {"{{clinic_name}}"} to personalise. {body.length}/1024
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="promo-button">Button</Label>
            <Input id="promo-button" maxLength={25} value={button} onChange={(e) => setButton(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Always added</Label>
            <p className="pt-2 text-sm text-muted-foreground">{STOP}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-when">When</Label>
          <div className="flex flex-wrap gap-2">
            <Pick id="promo-when" className="w-56" value={when} options={[["now", "As soon as Meta approves"], ["later", "At a set time"]]} onChange={setWhen} />
            {when === "later" && <Input type="datetime-local" className="w-56" aria-label="Send at" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />}
          </div>
        </div>
        {issues.length > 0 && (
          <ul className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {issues.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <Button
          disabled={issues.length > 0}
          onClick={() =>
            onSubmit({
              id: uid(),
              name: name.trim(),
              body,
              buttons,
              header,
              audience,
              size,
              sendAt: when === "later" ? new Date(sendAt).getTime() : null,
              status: "in_review",
              changedAt: Date.now(),
              stats: null,
            })
          }
        >
          <Send /> Submit to Meta
        </Button>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
        <TemplatePreview
          title={clinicName}
          slot="promo:new"
          header={header}
          text={render(body, { patient_name: "Ravi", clinic_name: clinicName })}
          buttons={buttons}
          footer="Reply STOP to opt out"
        />
      </div>
    </div>
  );
}

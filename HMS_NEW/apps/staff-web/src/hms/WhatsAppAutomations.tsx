import { useRef, useState } from "react";
import { AlertTriangle, Plus, Send, Undo2, X } from "lucide-react";
import { toast } from "@/components/toast-events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GrowthSwitch as Switch } from "./GrowthControls";
import { Textarea } from "@/components/ui/textarea";
import {
  automationInfo,
  render,
  templateIssues,
  templateState,
  variableLabels,
  variables,
  type Automation,
  type AutomationId,
  type Stage,
  type Variable,
  type WaData,
} from "./whatsapp-data";
import { FileSlot, MetaBadge, Pick, TemplatePreview, type Change } from "./whatsapp-ui";

const stages: [Stage, string][] = [
  ["before", "Before the visit"],
  ["change", "If plans change"],
  ["after", "After the visit"],
  ["staff", "Staff templates"],
];

export function Automations({
  data,
  change,
  clinicName,
  doctor,
  canManage,
}: {
  data: WaData;
  change: Change;
  clinicName: string;
  doctor: string;
  canManage: boolean;
}) {
  const [id, setId] = useState<AutomationId>(() => {
    const q = new URLSearchParams(location.search).get("id");
    return q && q in automationInfo ? (q as AutomationId) : "confirmation";
  });
  const set = (target: AutomationId, patch: Partial<Automation>) =>
    change((d) => ({ ...d, automations: d.automations.map((a) => (a.id === target ? { ...a, ...patch } : a)) }));
  const a = data.automations.find((x) => x.id === id)!;
  const q = data.settings.quiet;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every message here is a Meta-approved template, so it can reach patients any time.{" "}
        {q.on ? `Automated sends wait during quiet hours (${q.from}–${q.to}).` : "Quiet hours are off."}
      </p>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <nav className="space-y-5" aria-label="Automations">
          {stages.map(([stage, label]) => (
            <div key={stage}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
              <Card className="gap-0 divide-y p-0 shadow-none">
                {data.automations
                  .filter((x) => automationInfo[x.id].stage === stage)
                  .map((x) => {
                    const info = automationInfo[x.id];
                    return (
                      <div key={x.id} className={`flex items-center gap-3 px-4 py-3 ${x.id === id ? "bg-muted/60" : ""}`}>
                        <button type="button" onClick={() => setId(x.id)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-medium">{info.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {x.on && !x.approved ? (
                              <span className="text-amber-700">Waiting for Meta approval</span>
                            ) : (
                              info.timings.find(([k]) => k === x.timing)?.[1]
                            )}
                          </p>
                        </button>
                        {stage !== "staff" && (
                          <Switch
                            checked={x.on}
                            disabled={!canManage}
                            aria-label={`Send ${info.title}`}
                            onCheckedChange={(on) => set(x.id, { on })}
                          />
                        )}
                      </div>
                    );
                  })}
              </Card>
            </div>
          ))}
        </nav>
        <Editor key={a.id} a={a} set={(p) => set(a.id, p)} clinicName={clinicName} doctor={doctor} canManage={canManage} />
      </div>
    </div>
  );
}

function Editor({
  a,
  set,
  clinicName,
  doctor,
  canManage,
}: {
  a: Automation;
  set: (patch: Partial<Automation>) => void;
  clinicName: string;
  doctor: string;
  canManage: boolean;
}) {
  const info = automationInfo[a.id];
  const state = templateState(a);
  const issues = templateIssues(a);
  const box = useRef<HTMLTextAreaElement>(null);
  const insert = (v: Variable) => {
    const el = box.current;
    const at = el?.selectionStart ?? a.body.length;
    const token = `{{${v}}}`;
    set({ body: a.body.slice(0, at) + token + a.body.slice(el?.selectionEnd ?? at) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  const sample = { patient_name: "Ravi", doctor_name: doctor || "Dr. Rao", clinic_name: clinicName, date: "Thu, 16 Oct", time: "10:30 am", booking_ref: "EX-4821" };
  const editable = canManage && state !== "in_review";
  return (
    <Card className="gap-0 p-0 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div>
          <h2 className="font-semibold">{info.title}</h2>
          <p className="text-sm text-muted-foreground">{info.description}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{info.name} · Utility</p>
        </div>
        <MetaBadge t={a} />
      </div>
      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <fieldset disabled={!editable} className="space-y-5">
          {a.on && !a.approved && (
            <Note>Turned on, but nothing sends until Meta approves this template. Approval usually takes a few minutes.</Note>
          )}
          {state === "edited" && <Note>Patients keep getting the approved version until Meta approves your edit.</Note>}
          {state === "rejected" && <Note tone="error">Meta rejected this template: {a.rejection ?? "no reason given"}. Edit it and submit again.</Note>}
          {state === "in_review" && <Note>Meta is reviewing this template. You can edit it again once the review finishes.</Note>}
          {info.timings.length > 1 && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="wa-timing">When it sends</Label>
              <Pick id="wa-timing" value={a.timing} options={info.timings} onChange={(timing) => set({ timing })} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="wa-body">Message</Label>
            <Textarea
              id="wa-body"
              ref={box}
              rows={5}
              value={a.body}
              onChange={(e) => set({ body: e.target.value, review: a.review === "rejected" ? "none" : a.review })}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Insert</span>
              {variables.map((v) => (
                <Button key={v} size="xs" variant="outline" onClick={() => insert(v)}>
                  {variableLabels[v]}
                </Button>
              ))}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{a.body.length}/1024</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Quick-reply buttons</Label>
            {a.buttons.map((b, i) => (
              <div key={i} className="flex max-w-sm items-center gap-2">
                <Input
                  value={b}
                  maxLength={25}
                  aria-label={`Button ${i + 1}`}
                  onChange={(e) => set({ buttons: a.buttons.map((x, j) => (j === i ? e.target.value : x)) })}
                />
                <Button size="icon-xs" variant="ghost" aria-label={`Remove button ${i + 1}`} onClick={() => set({ buttons: a.buttons.filter((_, j) => j !== i) })}>
                  <X />
                </Button>
              </div>
            ))}
            {a.buttons.length < 3 && (
              <Button size="xs" variant="outline" onClick={() => set({ buttons: [...a.buttons, ""] })}>
                <Plus /> Add button
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label>Header</Label>
            <FileSlot id={`tpl:${a.id}`} label="Header image or PDF" value={a.header} onChange={(header) => set({ header })} />
          </div>
          {issues.length > 0 && (
            <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {issues.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={issues.length > 0 || state === "approved"}
              onClick={() => {
                set({ review: "in_review", submittedAt: Date.now(), rejection: null });
                toast.success("Submitted to Meta for review");
              }}
            >
              <Send /> {state === "approved" ? "Approved" : "Submit to Meta"}
            </Button>
            {state === "edited" && a.approved && (
              <Button variant="ghost" onClick={() => set({ body: a.approved!.body, buttons: a.approved!.buttons })}>
                <Undo2 /> Discard edits
              </Button>
            )}
          </div>
        </fieldset>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Preview with sample details</p>
          <TemplatePreview title={clinicName} slot={`tpl:${a.id}`} header={a.header} text={render(a.body, sample)} buttons={a.buttons} />
        </div>
      </div>
    </Card>
  );
}

export function Note({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "error" }) {
  return (
    <p className={`flex gap-2 rounded-md p-3 text-sm ${tone === "error" ? "bg-destructive/5 text-destructive" : "bg-amber-500/10 text-amber-900 dark:text-amber-200"}`}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

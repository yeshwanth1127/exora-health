// Workspace administration panels shown under Workspace settings and the Activity log (ERD m01):
// module switches, professional registrations and invites, teleconsultation consent documents, and
// the break-glass review queue. The API enforces every permission; panels follow it.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { label, today } from "./model";
import { refusal } from "./forms";
import { Choice, Empty, ErrorMessage, Field, LoadingState, Status } from "./ui";

const REASONS: Record<string, string> = {
  core_module: "Core modules are always on.",
  invalid_transition: "That change isn't possible from the module's current state.",
  stale_version: "Someone else changed this first. Refresh and try again.",
  duplicate_registration: "That registration is already recorded.",
  self: "Someone else must do this.",
  already_linked: "This person has already signed in.",
  already_reviewed: "This emergency access was already reviewed.",
  published: "A published document is frozen; draft a new version.",
  duplicate_version: "That version already exists for this language.",
};
function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const r = refusal(cmd.failure);
  return <ErrorMessage text={(r && REASONS[r]) || cmd.error} />;
}
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

type ModuleRow = { module: string; state: string; core: boolean; version: number };
const NEXT: Record<string, string[]> = {
  not_provisioned: ["configured", "active"],
  configured: ["validated", "active", "not_provisioned"],
  validated: ["active", "configured"],
  active: ["suspended"],
  suspended: ["active", "retired"],
  retired: ["configured"],
};

export function ModuleSwitches() {
  const { me } = useWorkspace(),
    cmd = useCommand();
  const mods = useQuery<{ items: ModuleRow[] }>("/v1/modules");
  const manage = (me.permissions["tenant.manage"] ?? []).includes("*");
  return (
    <Card className="mb-7">
      <CardHeader>
        <CardTitle className="text-base">Modules</CardTitle>
        <CardDescription>
          A suspended module stops new work (bookings, orders, bills…) but keeps its records readable. Core modules are always on.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoadingState {...mods}>
          <div className="grid sm:grid-cols-2 gap-2">
            {(mods.data?.items ?? []).map((m) => (
              <div key={m.module} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                <span>
                  {label(m.module)} <Status value={m.state} />
                </span>
                {manage && !m.core && (
                  <span className="flex gap-1">
                    {NEXT[m.state]!.map((to) => (
                      <Button
                        key={to}
                        variant="ghost"
                        size="sm"
                        disabled={cmd.busy}
                        onClick={async () => {
                          const reason = window.prompt(`Why set ${label(m.module)} to ${label(to)}?`);
                          if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/modules/${m.module}`, { state: to, version: m.version, reason: reason.trim() }, false, "PUT"))) void mods.refresh();
                        }}
                      >
                        {label(to)}
                      </Button>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </LoadingState>
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

type StaffRow = { staffId: string; displayName: string; staffType: string; status: string; account: { status: string; linked: boolean; inviteExpiresAt: string | null } | null };
type Registration = { registrationId: string; council: string; registrationNo: string; validUntil: string | null; verifiedAt: string | null; verifiedBy: string | null; version: number };

export function Registrations() {
  const { facility, me, can } = useWorkspace(),
    cmd = useCommand();
  const staff = useQuery<{ items: StaffRow[] }>(can("access.manage") ? `/v1/staff-accounts?facilityId=${facility.facilityId}` : null);
  const [who, setWho] = useState("");
  const regs = useQuery<{ items: Registration[] }>(who ? `/v1/staff/${who}/registrations` : null);
  const [council, setCouncil] = useState(""),
    [number, setNumber] = useState(""),
    [until, setUntil] = useState(""),
    [now] = useState(() => new Date().toISOString());
  if (!can("staff.manage") || !can("access.manage")) return null;
  const person = staff.data?.items.find((s) => s.staffId === who);
  const expired = (staff.data?.items ?? []).filter((s) => s.account && !s.account.linked && s.account.inviteExpiresAt && s.account.inviteExpiresAt < now);
  return (
    <Card className="mb-7">
      <CardHeader>
        <CardTitle className="text-base">Professional registrations and invites</CardTitle>
        <CardDescription>Doctors and nurses need a current council registration to sign notes. Invites last 14 days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {expired.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Expired invites</p>
            {expired.map((s) => (
              <div key={s.staffId} className="flex items-center justify-between text-sm">
                <span>{s.displayName} · expired {when(s.account!.inviteExpiresAt)}</span>
                <Button variant="outline" size="sm" disabled={cmd.busy} onClick={async () => { if (await cmd.run(`/v1/staff/${s.staffId}/invite/renew`)) void staff.refresh(); }}>
                  Renew invite
                </Button>
              </div>
            ))}
          </div>
        )}
        <Field title="Staff member" id="reg-staff">
          <Choice label="Staff member" value={who} onChange={setWho} options={(staff.data?.items ?? []).filter((s) => ["doctor", "nurse", "pharmacist", "technician"].includes(s.staffType)).map((s) => ({ value: s.staffId, label: `${s.displayName} · ${label(s.staffType)}` }))} />
        </Field>
        {person && (
          <LoadingState {...regs}>
            {(regs.data?.items ?? []).map((r) => {
              const lapsed = !!r.validUntil && r.validUntil < today(facility.timezone);
              return (
                <div key={r.registrationId} className="flex items-center justify-between text-sm">
                  <span>
                    {r.council} · {r.registrationNo} · {r.validUntil ? `valid until ${r.validUntil}` : "no expiry"}
                    {lapsed && " · expired"} · {r.verifiedAt ? "verified" : "not verified"}
                  </span>
                  <span className="flex gap-1">
                    {!r.verifiedAt && who !== me.staffId && (
                      <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => { if (await cmd.run(`/v1/staff-registrations/${r.registrationId}`, { version: r.version, verify: true }, false, "PATCH")) void regs.refresh(); }}>
                        Mark verified
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cmd.busy}
                      onClick={async () => {
                        const v = window.prompt("New expiry date (YYYY-MM-DD)", r.validUntil ?? "");
                        if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && (await cmd.run(`/v1/staff-registrations/${r.registrationId}`, { version: r.version, validUntil: v }, false, "PATCH"))) void regs.refresh();
                      }}
                    >
                      Renew
                    </Button>
                  </span>
                </div>
              );
            })}
            {!regs.data?.items.length && <Empty>No registration recorded: they can't sign clinical notes yet.</Empty>}
            <form
              className="grid sm:grid-cols-4 gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await cmd.run(`/v1/staff/${who}/registrations`, { council: council.trim(), registrationNo: number.trim(), validUntil: until || null }, true)) {
                  setNumber("");
                  void regs.refresh();
                }
              }}
            >
              <Input aria-label="Council" placeholder="Council (e.g. NMC)" maxLength={100} value={council} onChange={(e) => setCouncil(e.target.value)} />
              <Input aria-label="Registration number" placeholder="Registration number" maxLength={40} value={number} onChange={(e) => setNumber(e.target.value)} />
              <Input aria-label="Valid until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              <Button type="submit" variant="outline" disabled={cmd.busy || council.trim().length < 2 || number.trim().length < 2}>Add registration</Button>
            </form>
          </LoadingState>
        )}
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

type ConsentDoc = { documentId: string; docVersion: string; language: string; title: string; body: string; publishedAt: string | null; retiredAt: string | null; version: number; state: string; current: boolean };

export function ConsentDocuments() {
  const { me } = useWorkspace(),
    cmd = useCommand();
  const manage = (me.permissions["consent_documents.manage"] ?? []).includes("*");
  const docs = useQuery<{ items: ConsentDoc[] }>(manage ? "/v1/consent-documents" : null);
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<ConsentDoc | null>(null),
    [v, setV] = useState(""),
    [lang, setLang] = useState("en"),
    [title, setTitle] = useState("Video consultation consent"),
    [body, setBody] = useState("");
  if (!manage) return null;
  const start = (d: ConsentDoc | null) => {
    setOpen(true);
    setEditing(d);
    setV(d ? d.docVersion : "");
    setLang(d?.language ?? "en");
    setTitle(d?.title ?? "Video consultation consent");
    setBody(d?.body ?? "");
  };
  return (
    <Card className="mb-7">
      <CardHeader>
        <CardTitle className="text-base">Teleconsultation consent documents</CardTitle>
        <CardDescription>Patients agree to the current published version before a video visit. Published versions can't be edited; publish a new one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <LoadingState {...docs}>
          {(docs.data?.items ?? []).map((d) => (
            <div key={d.documentId} className="flex items-center justify-between text-sm">
              <span>
                {d.title} · v{d.docVersion} · {d.language} · <Status value={d.current ? "current" : d.state} />
              </span>
              <span className="flex gap-1">
                {d.state === "draft" && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => start(d)}>Edit</Button>
                    <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => { if (await cmd.run(`/v1/consent-documents/${d.documentId}/publish`)) void docs.refresh(); }}>Publish</Button>
                  </>
                )}
                {d.current && (
                  <Button variant="ghost" size="sm" disabled={cmd.busy} onClick={async () => {
                    const reason = window.prompt("Retiring switches video consent off until another version is published. Why?");
                    if (reason && reason.trim().length >= 3 && (await cmd.run(`/v1/consent-documents/${d.documentId}/retire`, { reason: reason.trim() }))) void docs.refresh();
                  }}>
                    Retire
                  </Button>
                )}
              </span>
            </div>
          ))}
          {!docs.data?.items.length && <Empty>No consent document yet: video consultations can't start.</Empty>}
        </LoadingState>
        <Button variant="outline" size="sm" onClick={() => start(null)}>New version</Button>
        {open && (
          <form
            className="space-y-3 border rounded-lg p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = editing
                ? await cmd.run(`/v1/consent-documents/${editing.documentId}`, { version: editing.version, title: title.trim(), body: body.trim() }, false, "PATCH")
                : await cmd.run("/v1/consent-documents", { docVersion: v.trim(), language: lang, title: title.trim(), body: body.trim() }, true);
              if (ok) {
                setOpen(false);
                setEditing(null);
                void docs.refresh();
              }
            }}
          >
            {!editing && (
              <div className="grid grid-cols-2 gap-3">
                <Field title="Version" id="cd-version"><Input id="cd-version" maxLength={40} value={v} placeholder="2026.1" onChange={(e) => setV(e.target.value)} /></Field>
                <Field title="Language" id="cd-lang"><Input id="cd-lang" maxLength={6} value={lang} onChange={(e) => setLang(e.target.value)} /></Field>
              </div>
            )}
            <Field title="Title" id="cd-title"><Input id="cd-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field title="Text the patient agrees to" id="cd-body"><Textarea id="cd-body" rows={8} maxLength={50000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
            <Button type="submit" disabled={cmd.busy || body.trim().length < 20 || title.trim().length < 3 || (!editing && !/^[A-Za-z0-9._-]{1,40}$/.test(v))}>
              {editing ? "Save draft" : "Save as draft"}
            </Button>
          </form>
        )}
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

type Grant = { grantId: string; staffName: string; patientId: string; mrn: string; reason: string; grantedAt: string; expiresAt: string; reviewerName: string | null; reviewedAt: string | null; reviewOutcome: string | null; chartViews: number; staffId: string };

export function BreakGlassReview() {
  const { me } = useWorkspace(),
    cmd = useCommand();
  const [status, setStatus] = useState("pending");
  const allowed = (me.permissions["break_glass.review"] ?? []).includes("*");
  const grants = useQuery<{ items: Grant[] }>(allowed ? `/v1/break-glass?status=${status}` : null);
  if (!allowed) return null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Emergency access review</CardTitle>
        <CardDescription>Every break-glass chart access is reviewed by someone other than the person who used it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="w-44">
          <Choice label="Review status" value={status} onChange={setStatus} options={[{ value: "pending", label: "To review" }, { value: "reviewed", label: "Reviewed" }, { value: "all", label: "All" }]} />
        </div>
        <LoadingState {...grants}>
          {(grants.data?.items ?? []).map((g) => (
            <div key={g.grantId} className="border rounded-lg p-3 text-sm space-y-2">
              <p>
                <span className="font-medium">{g.staffName}</span> opened MRN {g.mrn} · {when(g.grantedAt)} → {when(g.expiresAt)} · {g.chartViews} recorded actions
              </p>
              <p className="text-muted-foreground">“{g.reason}”</p>
              {g.reviewedAt ? (
                <p>
                  <Status value={g.reviewOutcome ?? ""} /> by {g.reviewerName} · {when(g.reviewedAt)}
                </p>
              ) : g.staffId === me.staffId ? (
                <p className="text-xs text-muted-foreground">Your own access is reviewed by someone else.</p>
              ) : (
                <div className="flex gap-2">
                  {(["appropriate", "inappropriate"] as const).map((o) => (
                    <Button
                      key={o}
                      variant={o === "appropriate" ? "outline" : "destructive"}
                      size="sm"
                      disabled={cmd.busy}
                      onClick={async () => {
                        const note = window.prompt(`Record why the access was ${o}`);
                        if (note && note.trim().length >= 3 && (await cmd.run(`/v1/break-glass/${g.grantId}/review`, { outcome: o, note: note.trim() }))) void grants.refresh();
                      }}
                    >
                      {label(o)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!grants.data?.items.length && <Empty>Nothing to review.</Empty>}
        </LoadingState>
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

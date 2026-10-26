// Workspace administration panels shown under Workspace settings and the Activity log (ERD m01):
// module switches, professional registrations and invites, teleconsultation consent documents, and
// the break-glass review queue. The API enforces every permission; panels follow it.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery, useWorkspace } from "./hooks";
import {
  useRecoverableCommand,
  type RecoverableCommand,
} from "./operational-command";
import { RecoveryNotice } from "./OperationalRecovery";
import { request } from "./client";
import { useUnsaved, requestLeave } from "./leave";
import type { MutationIntent } from "./operational-intent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { label, today } from "./model";
import { refusal } from "./forms";
import { Choice, Empty, ErrorMessage, Field, LoadingState, Status } from "./ui";

const REASONS: Record<string, string> = {
  core_module: "Core modules are always on.",
  invalid_transition:
    "That change isn't possible from the module's current state.",
  stale_version: "Someone else changed this first. Refresh and try again.",
  duplicate_registration: "That registration is already recorded.",
  self: "Someone else must do this.",
  already_linked: "This person has already signed in.",
  already_reviewed: "This emergency access was already reviewed.",
  published: "A published document is frozen; draft a new version.",
  duplicate_version: "That version already exists for this language.",
};
function Refused({ cmd }: { cmd: RecoverableCommand }) {
  const r = refusal(cmd.failure);
  return <ErrorMessage text={(r && REASONS[r]) || cmd.error} />;
}
type Review = {
  title: string;
  description: string;
  path: string;
  method?: string;
  body?: Record<string, unknown>;
  field?: "reason" | "note" | "validUntil";
  value?: string;
  dateMin?: string;
  action: string;
  destructive?: boolean;
};
function ReviewDialog({
  review,
  command,
  close,
  done,
  verify,
}: {
  review: Review | null;
  command: RecoverableCommand;
  close: () => void;
  done: () => void;
  verify?: (intent: MutationIntent) => Promise<boolean>;
}) {
  const [value, setValue] = useState(review?.value ?? ""),
    [noExpiry, setNoExpiry] = useState(
      review?.field === "validUntil" && !review.value,
    );
  useUnsaved(
    !!review &&
      (value !== (review.value ?? "") ||
        noExpiry !== (review.field === "validUntil" && !review.value) ||
        command.busy ||
        command.unknown),
  );
  const invalid =
    review?.field === "validUntil"
      ? !noExpiry &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          (!!review.dateMin && value < review.dateMin))
      : !!review?.field && value.trim().length < 3;
  return (
    <Dialog
      open={!!review}
      onOpenChange={(open) => {
        if (!open && !command.busy && !command.unknown) requestLeave(close);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{review?.title}</DialogTitle>
          <DialogDescription>{review?.description}</DialogDescription>
        </DialogHeader>
        <RecoveryNotice command={command} verify={verify} onRecovered={done} />
        <fieldset
          disabled={command.busy || command.unknown}
          className="space-y-4"
        >
          {review?.field && (
            <Field
              title={
                review.field === "validUntil" ? "New expiry date" : "Reason"
              }
              id="admin-review-value"
            >
              <Input
                id="admin-review-value"
                type={review.field === "validUntil" ? "date" : "text"}
                maxLength={500}
                min={review.dateMin}
                disabled={review.field === "validUntil" && noExpiry}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
          )}
          {review?.field === "validUntil" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noExpiry}
                onChange={(e) => setNoExpiry(e.target.checked)}
              />
              No expiry
            </label>
          )}
          <Refused cmd={command} />
          <Button
            variant={review?.destructive ? "destructive" : "default"}
            disabled={invalid}
            onClick={async () => {
              if (!review) return;
              const body = {
                ...review.body,
                ...(review.field
                  ? {
                      [review.field]:
                        review.field === "validUntil"
                          ? noExpiry
                            ? null
                            : value
                          : value.trim(),
                    }
                  : {}),
              };
              if (
                await command.run(
                  review.path,
                  body,
                  false,
                  review.method ?? "POST",
                )
              )
                done();
            }}
          >
            {review?.action ?? "Apply change"}
          </Button>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
const when = (iso: string | null, timezone: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      })
    : "—";

type ModuleRow = {
  module: string;
  state: string;
  core: boolean;
  version: number;
};
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
    cmd = useRecoverableCommand();
  const [review, setReview] = useState<Review | null>(null);
  useUnsaved(cmd.busy || cmd.unknown);
  const mods = useQuery<{ items: ModuleRow[] }>("/v1/modules");
  const manage = (me.permissions["tenant.manage"] ?? []).includes("*");
  return (
    <Card className="mb-7">
      <CardHeader>
        <CardTitle className="text-base">Modules</CardTitle>
      </CardHeader>
      <CardContent>
        <LoadingState {...mods}>
          <div className="grid sm:grid-cols-2 gap-2">
            {(mods.data?.items ?? []).map((m) => (
              <div
                key={m.module}
                className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm"
              >
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
                        disabled={cmd.busy || cmd.unknown}
                        onClick={() =>
                          setReview({
                            title: `${to === "suspended" ? "Suspend" : to === "active" ? "Activate" : "Change"} ${label(m.module)}`,
                            description: `Organisation-wide module state: ${label(m.state)} → ${label(to)}. ${to === "suspended" ? "New work stops; existing records stay readable." : "This changes availability for every clinic."}`,
                            path: `/v1/modules/${m.module}`,
                            method: "PUT",
                            body: { state: to, version: m.version },
                            field: "reason",
                            action:
                              to === "suspended"
                                ? "Suspend module"
                                : to === "active"
                                  ? "Activate module"
                                  : "Apply module state",
                            destructive: ["suspended", "retired"].includes(to),
                          })
                        }
                      >
                        {to === "suspended"
                          ? "Suspend module"
                          : to === "active"
                            ? "Activate module"
                            : `Set ${label(to)}`}
                      </Button>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </LoadingState>
        <ReviewDialog
          key={review?.path ?? "none"}
          review={review}
          command={cmd}
          close={() => setReview(null)}
          done={() => {
            setReview(null);
            void mods.refresh();
          }}
          verify={async (intent) => {
            const rows = await request<{ items: ModuleRow[] }>("/v1/modules");
            const saved = rows.items.find(
              (m) => m.module === intent.path.split("/").at(-1),
            );
            const body = intent.options.body as {
              state: string;
              version: number;
            };
            return (
              !!saved &&
              saved.state === body.state &&
              saved.version > body.version
            );
          }}
        />
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

type StaffRow = {
  staffId: string;
  displayName: string;
  staffType: string;
  status: string;
  account: {
    status: string;
    linked: boolean;
    inviteExpiresAt: string | null;
  } | null;
};
type Registration = {
  registrationId: string;
  council: string;
  registrationNo: string;
  validUntil: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  version: number;
};

export function Registrations() {
  const { facility, me, can } = useWorkspace(),
    cmd = useRecoverableCommand();
  const staff = useQuery<{ items: StaffRow[] }>(
    can("access.manage")
      ? `/v1/staff-accounts?facilityId=${facility.facilityId}`
      : null,
  );
  const [who, setWho] = useState("");
  const regs = useQuery<{ items: Registration[] }>(
    who ? `/v1/staff/${who}/registrations` : null,
  );
  const [council, setCouncil] = useState(""),
    [number, setNumber] = useState(""),
    [until, setUntil] = useState(""),
    [now] = useState(() => new Date().toISOString()),
    [review, setReview] = useState<Review | null>(null);
  useUnsaved(!!council || !!number || !!until || cmd.busy || cmd.unknown);
  if (!can("staff.manage") || !can("access.manage")) return null;
  const person = staff.data?.items.find((s) => s.staffId === who);
  const expired = (staff.data?.items ?? []).filter(
    (s) =>
      s.account &&
      !s.account.linked &&
      s.account.inviteExpiresAt &&
      s.account.inviteExpiresAt < now,
  );
  return (
    <Card className="mb-7">
      <CardHeader>
        <CardTitle className="text-base">
          Professional registrations and invites
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {expired.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Expired invites</p>
            {expired.map((s) => (
              <div
                key={s.staffId}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {s.displayName} · expired{" "}
                  {when(s.account!.inviteExpiresAt, facility.timezone)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cmd.busy || cmd.unknown}
                  onClick={async () => {
                    if (await cmd.run(`/v1/staff/${s.staffId}/invite/renew`))
                      void staff.refresh();
                  }}
                >
                  Renew invite
                </Button>
              </div>
            ))}
          </div>
        )}
        <Field title="Staff member" id="reg-staff">
          <Choice
            label="Staff member"
            disabled={cmd.busy || cmd.unknown}
            value={who}
            onChange={(value) =>
              requestLeave(() => {
                setWho(value);
                setCouncil("");
                setNumber("");
                setUntil("");
              })
            }
            options={(staff.data?.items ?? [])
              .filter((s) =>
                ["doctor", "nurse", "pharmacist", "technician"].includes(
                  s.staffType,
                ),
              )
              .map((s) => ({
                value: s.staffId,
                label: `${s.displayName} · ${label(s.staffType)}`,
              }))}
          />
        </Field>
        {person && (
          <LoadingState {...regs}>
            {(regs.data?.items ?? []).map((r) => {
              const lapsed =
                !!r.validUntil && r.validUntil < today(facility.timezone);
              return (
                <div
                  key={r.registrationId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {r.council} · {r.registrationNo} ·{" "}
                    {r.validUntil ? `valid until ${r.validUntil}` : "no expiry"}
                    {lapsed && " · expired"} ·{" "}
                    {r.verifiedAt ? "verified" : "not verified"}
                  </span>
                  <span className="flex gap-1">
                    {!r.verifiedAt && who !== me.staffId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cmd.busy || cmd.unknown}
                        onClick={async () => {
                          if (
                            await cmd.run(
                              `/v1/staff-registrations/${r.registrationId}`,
                              { version: r.version, verify: true },
                              false,
                              "PATCH",
                            )
                          )
                            void regs.refresh();
                        }}
                      >
                        Mark verified
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cmd.busy || cmd.unknown}
                      onClick={() =>
                        setReview({
                          title: `Renew ${r.council} registration`,
                          description: `${person.displayName} · ${r.registrationNo}. The saved expiry determines whether clinical signing is allowed.`,
                          path: `/v1/staff-registrations/${r.registrationId}`,
                          method: "PATCH",
                          body: { version: r.version },
                          field: "validUntil",
                          value: r.validUntil ?? "",
                          dateMin: today(facility.timezone),
                          action: "Save registration expiry",
                        })
                      }
                    >
                      Renew
                    </Button>
                  </span>
                </div>
              );
            })}
            {!regs.data?.items.length && (
              <Empty>
                No registration recorded: they can't sign clinical notes yet.
              </Empty>
            )}
            <fieldset disabled={cmd.busy || cmd.unknown}>
              <form
                className="grid grid-cols-4 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await cmd.run(
                      `/v1/staff/${who}/registrations`,
                      {
                        council: council.trim(),
                        registrationNo: number.trim(),
                        validUntil: until || null,
                      },
                      true,
                    )
                  ) {
                    setNumber("");
                    void regs.refresh();
                  }
                }}
              >
                <Input
                  aria-label="Council"
                  placeholder="Council (e.g. NMC)"
                  maxLength={100}
                  value={council}
                  onChange={(e) => setCouncil(e.target.value)}
                />
                <Input
                  aria-label="Registration number"
                  placeholder="Registration number"
                  maxLength={40}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <Input
                  aria-label="Valid until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    cmd.busy ||
                    council.trim().length < 2 ||
                    number.trim().length < 2
                  }
                >
                  Add registration
                </Button>
              </form>
            </fieldset>
          </LoadingState>
        )}
        <RecoveryNotice
          command={cmd}
          onRecovered={() => {
            setNumber("");
            void regs.refresh();
            void staff.refresh();
          }}
          verify={async (intent) => {
            if (intent.path.endsWith("/invite/renew")) {
              const rows = await request<{ items: StaffRow[] }>(
                `/v1/staff-accounts?facilityId=${facility.facilityId}`,
              );
              const id = intent.path.split("/")[3];
              const saved = rows.items.find((s) => s.staffId === id);
              return (
                !!saved?.account?.inviteExpiresAt &&
                saved.account.inviteExpiresAt > new Date().toISOString()
              );
            }
            const rows = await request<{ items: Registration[] }>(
              `/v1/staff/${who}/registrations`,
            );
            const saved = rows.items.find(
              (r) => r.registrationId === intent.path.split("/").at(-1),
            );
            const body = intent.options.body as {
              version: number;
              validUntil?: string | null;
              verify?: boolean;
            };
            return (
              !!saved &&
              saved.version > body.version &&
              (body.verify
                ? !!saved.verifiedAt
                : saved.validUntil === body.validUntil)
            );
          }}
        />
        <ReviewDialog
          key={review?.path ?? "none"}
          review={review}
          command={cmd}
          close={() => setReview(null)}
          done={() => {
            setReview(null);
            void regs.refresh();
          }}
          verify={async (intent) => {
            const rows = await request<{ items: Registration[] }>(
              `/v1/staff/${who}/registrations`,
            );
            const saved = rows.items.find(
              (r) => r.registrationId === intent.path.split("/").at(-1),
            );
            const body = intent.options.body as {
              version: number;
              validUntil: string | null;
            };
            return (
              !!saved &&
              saved.version > body.version &&
              saved.validUntil === body.validUntil
            );
          }}
        />
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

type ConsentDoc = {
  documentId: string;
  docVersion: string;
  language: string;
  title: string;
  body: string;
  publishedAt: string | null;
  retiredAt: string | null;
  version: number;
  state: string;
  current: boolean;
};

export function ConsentDocuments() {
  const { me } = useWorkspace(),
    cmd = useRecoverableCommand();
  const manage = (me.permissions["consent_documents.manage"] ?? []).includes(
    "*",
  );
  const docs = useQuery<{ items: ConsentDoc[] }>(
    manage ? "/v1/consent-documents" : null,
  );
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<ConsentDoc | null>(null),
    [v, setV] = useState(""),
    [lang, setLang] = useState("en"),
    [title, setTitle] = useState("Video consultation consent"),
    [body, setBody] = useState(""),
    [review, setReview] = useState<Review | null>(null);
  useUnsaved(
    (open &&
      (v !== (editing?.docVersion ?? "") ||
        lang !== (editing?.language ?? "en") ||
        title !== (editing?.title ?? "Video consultation consent") ||
        body !== (editing?.body ?? ""))) ||
      cmd.busy ||
      cmd.unknown,
  );
  if (!manage) return null;
  const start = (d: ConsentDoc | null) =>
    requestLeave(() => {
      setOpen(true);
      setEditing(d);
      setV(d ? d.docVersion : "");
      setLang(d?.language ?? "en");
      setTitle(d?.title ?? "Video consultation consent");
      setBody(d?.body ?? "");
    });
  return (
    <Card className="mb-7">
      <CardHeader>
        <CardTitle className="text-base">
          Teleconsultation consent documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <LoadingState {...docs}>
          {(docs.data?.items ?? []).map((d) => (
            <div
              key={d.documentId}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {d.title} · v{d.docVersion} · {d.language} ·{" "}
                <Status value={d.current ? "current" : d.state} />
              </span>
              <span className="flex gap-1">
                {d.state === "draft" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cmd.busy || cmd.unknown}
                      onClick={() => start(d)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cmd.busy || cmd.unknown}
                      onClick={() =>
                        setReview({
                          title: `Publish ${d.title}`,
                          description: `Version ${d.docVersion} · ${d.language}. This becomes the current text patients agree to before a video visit. Published text cannot be edited.`,
                          path: `/v1/consent-documents/${d.documentId}/publish`,
                          action: "Publish consent document",
                        })
                      }
                    >
                      Publish
                    </Button>
                  </>
                )}
                {d.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cmd.busy || cmd.unknown}
                    onClick={() =>
                      setReview({
                        title: `Retire ${d.title}`,
                        description: `Version ${d.docVersion} · ${d.language}. Video consent is unavailable until another version is published. Existing consent records are retained.`,
                        path: `/v1/consent-documents/${d.documentId}/retire`,
                        field: "reason",
                        action: "Retire consent document",
                        destructive: true,
                      })
                    }
                  >
                    Retire
                  </Button>
                )}
              </span>
            </div>
          ))}
          {!docs.data?.items.length && (
            <Empty>
              No consent document yet: video consultations can't start.
            </Empty>
          )}
        </LoadingState>
        <Button
          variant="outline"
          size="sm"
          disabled={cmd.busy || cmd.unknown}
          onClick={() => start(null)}
        >
          New version
        </Button>
        {open && (
          <fieldset disabled={cmd.busy || cmd.unknown}>
            <form
              className="space-y-3 border rounded-lg p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = editing
                  ? await cmd.run(
                      `/v1/consent-documents/${editing.documentId}`,
                      {
                        version: editing.version,
                        title: title.trim(),
                        body: body.trim(),
                      },
                      false,
                      "PATCH",
                    )
                  : await cmd.run(
                      "/v1/consent-documents",
                      {
                        docVersion: v.trim(),
                        language: lang,
                        title: title.trim(),
                        body: body.trim(),
                      },
                      true,
                    );
                if (ok) {
                  setOpen(false);
                  setEditing(null);
                  void docs.refresh();
                }
              }}
            >
              {!editing && (
                <div className="grid grid-cols-2 gap-3">
                  <Field title="Version" id="cd-version">
                    <Input
                      id="cd-version"
                      maxLength={40}
                      value={v}
                      placeholder="2026.1"
                      onChange={(e) => setV(e.target.value)}
                    />
                  </Field>
                  <Field title="Language" id="cd-lang">
                    <Input
                      id="cd-lang"
                      maxLength={6}
                      value={lang}
                      onChange={(e) => setLang(e.target.value)}
                    />
                  </Field>
                </div>
              )}
              <Field title="Title" id="cd-title">
                <Input
                  id="cd-title"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field title="Text the patient agrees to" id="cd-body">
                <Textarea
                  id="cd-body"
                  rows={8}
                  maxLength={50000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                disabled={
                  cmd.busy ||
                  body.trim().length < 20 ||
                  title.trim().length < 3 ||
                  (!editing && !/^[A-Za-z0-9._-]{1,40}$/.test(v))
                }
              >
                {editing ? "Save draft" : "Save as draft"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  requestLeave(() => {
                    setOpen(false);
                    setEditing(null);
                  })
                }
              >
                Cancel editing
              </Button>
            </form>
          </fieldset>
        )}
        <RecoveryNotice
          command={cmd}
          onRecovered={() => {
            setOpen(false);
            setEditing(null);
            void docs.refresh();
          }}
          verify={async (intent) => {
            const rows = await request<{ items: ConsentDoc[] }>(
              "/v1/consent-documents",
            );
            const id = intent.path.split("/")[3],
              saved = rows.items.find((d) => d.documentId === id),
              body = intent.options.body as Record<string, unknown>;
            if (!saved) return false;
            if (intent.path.endsWith("/retire")) return !!saved.retiredAt;
            if (intent.path.endsWith("/publish")) return !!saved.publishedAt;
            return (
              saved.version > Number(body.version) &&
              saved.title === body.title &&
              saved.body === body.body
            );
          }}
        />
        <ReviewDialog
          key={review?.path ?? "none"}
          review={review}
          command={cmd}
          close={() => setReview(null)}
          done={() => {
            setReview(null);
            void docs.refresh();
          }}
          verify={async (intent) => {
            const rows = await request<{ items: ConsentDoc[] }>(
              "/v1/consent-documents",
            );
            return rows.items.some(
              (d) =>
                d.documentId === intent.path.split("/")[3] &&
                (intent.path.endsWith("/publish")
                  ? !!d.publishedAt
                  : !!d.retiredAt),
            );
          }}
        />
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

type Grant = {
  grantId: string;
  staffName: string;
  patientId: string;
  mrn: string;
  reason: string;
  grantedAt: string;
  expiresAt: string;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewOutcome: string | null;
  chartViews: number;
  staffId: string;
};

export function BreakGlassReview() {
  const { me, facility } = useWorkspace(),
    cmd = useRecoverableCommand();
  const [status, setStatus] = useState("pending"),
    [review, setReview] = useState<Review | null>(null);
  useUnsaved(cmd.busy || cmd.unknown);
  const allowed = (me.permissions["break_glass.review"] ?? []).includes("*");
  const grants = useQuery<{ items: Grant[] }>(
    allowed ? `/v1/break-glass?status=${status}` : null,
  );
  if (!allowed) return null;
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Emergency access review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="w-44">
          <Choice
            label="Review status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "pending", label: "To review" },
              { value: "reviewed", label: "Reviewed" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        <LoadingState {...grants}>
          {(grants.data?.items ?? []).map((g) => (
            <div
              key={g.grantId}
              className="border rounded-lg p-3 text-sm space-y-2"
            >
              <p>
                <span className="font-medium">{g.staffName}</span> opened MRN{" "}
                {g.mrn} · {when(g.grantedAt, facility.timezone)} →{" "}
                {when(g.expiresAt, facility.timezone)} · {g.chartViews} recorded
                actions
              </p>
              <p className="text-muted-foreground">“{g.reason}”</p>
              {g.reviewedAt ? (
                <p>
                  <Status value={g.reviewOutcome ?? ""} /> by {g.reviewerName} ·{" "}
                  {when(g.reviewedAt, facility.timezone)}
                </p>
              ) : g.staffId === me.staffId ? (
                <p className="text-xs text-muted-foreground">
                  Awaiting another reviewer
                </p>
              ) : (
                <div className="flex gap-2">
                  {(["appropriate", "inappropriate"] as const).map((o) => (
                    <Button
                      key={o}
                      variant={o === "appropriate" ? "outline" : "destructive"}
                      size="sm"
                      disabled={cmd.busy || cmd.unknown}
                      onClick={() =>
                        setReview({
                          title: `Mark access ${label(o).toLowerCase()}`,
                          description: `${g.staffName} · MRN ${g.mrn} · ${g.chartViews} recorded actions. This records your review and does not change the original access log.`,
                          path: `/v1/break-glass/${g.grantId}/review`,
                          body: { outcome: o },
                          field: "note",
                          action: "Record access review",
                          destructive: o === "inappropriate",
                        })
                      }
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
        <ReviewDialog
          key={review?.path ?? "none"}
          review={review}
          command={cmd}
          close={() => setReview(null)}
          done={() => {
            setReview(null);
            void grants.refresh();
          }}
          verify={async (intent) => {
            const rows = await request<{ items: Grant[] }>(
              "/v1/break-glass?status=all",
            );
            return rows.items.some(
              (g) =>
                g.grantId === intent.path.split("/")[3] &&
                !!g.reviewedAt &&
                g.reviewOutcome ===
                  (intent.options.body as { outcome: string }).outcome &&
                g.reviewerName === me.displayName,
            );
          }}
        />
        <Refused cmd={cmd} />
      </CardContent>
    </Card>
  );
}

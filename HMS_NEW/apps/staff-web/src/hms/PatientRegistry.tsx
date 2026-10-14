// Patient overview keeps related people and duplicate records together. Clinical flags belong in history.
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { label } from "./model";
import { useUnsaved } from "./leave";
import { E164, refusal } from "./forms";
import { Choice, Empty, ErrorMessage, LoadingState, Status } from "./ui";
import { PatientLookup, TestPatientBadge } from "./Patients";
import { patientDisplayName } from "./patient-presentation";
import type { Patient } from "./types";

type Registry = {
  patientId: string;
  status: string;
  mergedIntoPatientId: string | null;
  nkaConfirmedAt: string | null;
  deceasedAt: string | null;
  identifiers: {
    identifierId: string;
    system: string;
    value: string;
    issuer: string | null;
    verifiedAt: string | null;
    isPrimary: boolean;
  }[];
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
  consents: {
    consentId: string;
    consentType: string;
    status: string;
    signedBy: string;
    signerName: string | null;
    witnessName: string | null;
    signedAt: string;
    withdrawnAt: string | null;
    notes: string | null;
  }[];
  flags: {
    flagId: string;
    flagType: string;
    activeFrom: string;
    activeTo: string | null;
    setByName: string;
    reason: string | null;
    active: boolean;
  }[];
  links: {
    linkId: string;
    survivorPatientId: string;
    survivorMrn: string;
    otherPatientId: string;
    otherMrn: string;
    linkType: string;
    decidedBy: string | null;
    reason: string | null;
  }[];
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
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "";

function Block({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
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

export function PatientRegistry({
  patientId,
  onMerged,
  section = "overview",
  allowNka = true,
}: {
  patientId: string;
  onMerged?: () => void;
  section?: "overview" | "history";
  allowNka?: boolean;
}) {
  const { can } = useWorkspace();
  const reg = useQuery<Registry>(`/v1/patients/${patientId}/registry`);
  const refresh = () => void reg.refresh();
  return (
    <LoadingState {...reg}>
      {reg.data && (
        <div className="space-y-5">
          {reg.data.deceasedAt && (
            <p className="text-sm font-medium">
              Deceased {day(reg.data.deceasedAt)}
            </p>
          )}
          {section === "overview" && (
            <>
              <Card>
                <CardContent className="p-5">
                  <Related
                    r={reg.data}
                    editable={
                      can("patients.update") && reg.data.status !== "merged"
                    }
                    onChanged={refresh}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <Duplicates
                    r={reg.data}
                    canPropose={can("patients.update")}
                    canDecide={can("patients.merge")}
                    onChanged={() => {
                      refresh();
                      onMerged?.();
                    }}
                  />
                </CardContent>
              </Card>
            </>
          )}
          {section === "history" && (
            <>
              {allowNka &&
                can("clinical.write") &&
                reg.data.status !== "merged" && (
                  <ConfirmNka
                    patientId={patientId}
                    confirmedAt={reg.data.nkaConfirmedAt}
                    onDone={refresh}
                  />
                )}
              <Flags
                r={reg.data}
                editable={can("patient_flags.manage")}
                onChanged={refresh}
              />
              <Block title="External records">
                {reg.data.identifiers.length > 0 && (
                  <Identifiers r={reg.data} />
                )}
              </Block>
            </>
          )}
        </div>
      )}
    </LoadingState>
  );
}

const FLAGS = [
  "isolation",
  "fall_risk",
  "allergy_alert",
  "safeguarding",
  "vip",
  "confidential",
  "mlc",
  "do_not_resuscitate",
];

function Flags({
  r,
  editable,
  onChanged,
}: {
  r: Registry;
  editable: boolean;
  onChanged: () => void;
}) {
  const cmd = useCommand();
  const [type, setType] = useState("fall_risk"),
    [why, setWhy] = useState("");
  useUnsaved(!!why.trim() || cmd.unknown);
  const active = r.flags.filter((f) => f.active);
  return (
    <Block title="Flags">
      <div className="flex flex-wrap gap-2">
        {active.map((f) => (
          <span
            key={f.flagId}
            className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-1"
          >
            {label(f.flagType)}
            {f.reason ? ` · ${f.reason}` : ""}
            {editable && (
              <button
                type="button"
                className="ml-1 text-muted-foreground"
                aria-label={`Clear ${label(f.flagType)}`}
                onClick={async () => {
                  const reason = window.prompt(
                    "Why is this flag being cleared?",
                  );
                  if (
                    reason &&
                    reason.trim().length >= 3 &&
                    (await cmd.run(`/v1/patient-flags/${f.flagId}/clear`, {
                      reason: reason.trim(),
                    }))
                  )
                    onChanged();
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!active.length && (
          <span className="text-sm text-muted-foreground">
            No active flags.
          </span>
        )}
      </div>
      {editable && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await cmd.run(
                `/v1/patients/${r.patientId}/flags`,
                { flagType: type, reason: why.trim() },
                true,
              )
            ) {
              setWhy("");
              onChanged();
            }
          }}
        >
          <div className="w-44">
            <Choice
              label="Flag"
              value={type}
              onChange={setType}
              options={FLAGS.map((v) => ({ value: v, label: label(v) }))}
            />
          </div>
          <Input
            aria-label="Flag reason"
            placeholder="Reason"
            maxLength={500}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={cmd.busy || why.trim().length < 3}
          >
            Set flag
          </Button>
        </form>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

function Identifiers({ r }: { r: Registry }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      {r.identifiers.map((item) => (
        <div key={item.identifierId}>
          <dt className="text-muted-foreground">
            {label(item.system)}
            {item.issuer ? ` · ${item.issuer}` : ""}
          </dt>
          <dd className="font-medium">{item.value}</dd>
          <dd className="text-xs text-muted-foreground">
            {item.verifiedAt
              ? `Document checked ${day(item.verifiedAt)}`
              : "Not verified"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const RELATIONSHIPS = [
  "spouse",
  "parent",
  "child",
  "sibling",
  "grandparent",
  "grandchild",
  "guardian",
  "relative",
  "friend",
  "other",
];

function Related({
  r,
  editable,
  onChanged,
}: {
  r: Registry;
  editable: boolean;
  onChanged: () => void;
}) {
  const cmd = useCommand();
  const blank = {
    name: "",
    relationship: "spouse",
    phone: "",
    isGuardian: false,
    isEmergencyContact: true,
    isLegalRepresentative: false,
  };
  const [f, setF] = useState(blank),
    [open, setOpen] = useState(false);
  const current = r.relatedPersons.filter((p) => !p.validTo);
  return (
    <Block
      title="Related people"
      action={
        editable && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Add"}
          </Button>
        )
      }
    >
      {current.map((p) => (
        <div
          key={p.relatedPersonId}
          className="flex items-center justify-between text-sm"
        >
          <span>
            {p.name} · {label(p.relationship)}
            {p.phone ? ` · ${p.phone}` : ""}
            {[
              p.isGuardian && "guardian",
              p.isEmergencyContact && "emergency contact",
              p.isLegalRepresentative && "legal representative",
            ]
              .filter(Boolean)
              .map((t) => ` · ${t}`)}
          </span>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                if (
                  await cmd.run(
                    `/v1/related-persons/${p.relatedPersonId}`,
                    { version: p.version, ended: true },
                    false,
                    "PATCH",
                  )
                )
                  onChanged();
              }}
            >
              No longer related
            </Button>
          )}
        </div>
      ))}
      {!current.length && (
        <p className="text-sm text-muted-foreground">
          No related people recorded.
        </p>
      )}
      {open && (
        <form
          className="grid grid-cols-2 gap-2 border rounded-lg p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await cmd.run(
              `/v1/patients/${r.patientId}/related-persons`,
              {
                ...f,
                name: f.name.trim(),
                phone: f.phone || null,
                representativeScope: null,
                relatedPatientId: null,
              },
              true,
            );
            if (ok) {
              setF(blank);
              setOpen(false);
              onChanged();
            }
          }}
        >
          <Input
            aria-label="Name"
            placeholder="Name"
            maxLength={100}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <Choice
            label="Relationship"
            value={f.relationship}
            onChange={(v) => setF({ ...f, relationship: v })}
            options={RELATIONSHIPS.map((v) => ({ value: v, label: label(v) }))}
          />
          <Input
            aria-label="Phone"
            type="tel"
            placeholder="+919876543210"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value.trim() })}
          />
          <div />
          {(
            [
              "isGuardian",
              "isEmergencyContact",
              "isLegalRepresentative",
            ] as const
          ).map((k) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <Label htmlFor={`rel-${k}`} className="text-sm font-normal">
                {label(
                  k
                    .replace(/^is/, "")
                    .replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
                    .slice(1),
                )}
              </Label>
              <Switch
                id={`rel-${k}`}
                checked={f[k]}
                onCheckedChange={(v) => setF({ ...f, [k]: v })}
              />
            </div>
          ))}
          <div className="col-span-2">
            <Button
              type="submit"
              variant="outline"
              disabled={
                cmd.busy ||
                f.name.trim().length < 2 ||
                (!!f.phone && !E164.test(f.phone))
              }
            >
              Save
            </Button>
          </div>
        </form>
      )}
      <Refused cmd={cmd} />
    </Block>
  );
}

function Duplicates({
  r,
  canPropose,
  canDecide,
  onChanged,
}: {
  r: Registry;
  canPropose: boolean;
  canDecide: boolean;
  onChanged: () => void;
}) {
  const { me } = useWorkspace(),
    cmd = useCommand();
  const [open, setOpen] = useState(false),
    [other, setOther] = useState<Patient | null>(null),
    [why, setWhy] = useState("");
  return (
    <Block
      title="Duplicate records"
      action={
        canPropose &&
        r.status !== "merged" && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Report a duplicate"}
          </Button>
        )
      }
    >
      {r.mergedIntoPatientId && (
        <p className="text-sm">
          Merged into another record; its history shows there.
        </p>
      )}
      {r.links.map((l) => (
        <div
          key={l.linkId}
          className="flex items-center justify-between text-sm"
        >
          <span>
            {l.survivorMrn} ← {l.otherMrn} · <Status value={l.linkType} />
          </span>
          {canDecide &&
            l.linkType === "possible_duplicate" &&
            l.decidedBy !== me.staffId && (
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cmd.busy}
                  onClick={async () => {
                    const reason = window.prompt(
                      "Confirm the merge: how was it checked?",
                    );
                    if (
                      reason &&
                      reason.trim().length >= 3 &&
                      (await cmd.run(`/v1/patient-links/${l.linkId}/decide`, {
                        decision: "merge",
                        reason: reason.trim(),
                      }))
                    )
                      onChanged();
                  }}
                >
                  Merge
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cmd.busy}
                  onClick={async () => {
                    if (
                      await cmd.run(`/v1/patient-links/${l.linkId}/decide`, {
                        decision: "not_duplicate",
                        reason: "Different people",
                      })
                    )
                      onChanged();
                  }}
                >
                  Not the same
                </Button>
              </span>
            )}
          {canDecide && l.linkType === "merged" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cmd.busy}
              onClick={async () => {
                const reason = window.prompt(
                  "Why is the merge being reversed?",
                );
                if (
                  reason &&
                  reason.trim().length >= 3 &&
                  (await cmd.run(`/v1/patient-links/${l.linkId}/unmerge`, {
                    reason: reason.trim(),
                  }))
                )
                  onChanged();
              }}
            >
              Unmerge
            </Button>
          )}
        </div>
      ))}
      {open && (
        <div className="space-y-2 border rounded-lg p-3">
          {other ? (
            <p className="text-sm">
              {patientDisplayName(other.patientId, other.name)} · {other.mrn}{" "}
              <TestPatientBadge patientId={other.patientId} />
              <Button variant="ghost" size="sm" onClick={() => setOther(null)}>
                Change
              </Button>
            </p>
          ) : (
            <PatientLookup
              onSelect={(p) => p.patientId !== r.patientId && setOther(p)}
            />
          )}
          <Input
            aria-label="Why they are the same"
            placeholder="Why they are the same person"
            maxLength={500}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={cmd.busy || !other || why.trim().length < 3}
            onClick={async () => {
              if (
                await cmd.run(
                  "/v1/patient-links",
                  {
                    survivorPatientId: r.patientId,
                    otherPatientId: other!.patientId,
                    reason: why.trim(),
                  },
                  true,
                )
              ) {
                setOpen(false);
                setOther(null);
                setWhy("");
                onChanged();
              }
            }}
          >
            Propose merge into this record
          </Button>
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
  const links = useQuery<{
    items: Registry["links"] & { decidedByName: string | null }[];
  }>("/v1/patient-links?open=true");
  const items = links.data?.items ?? [];
  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-3">
        <h2 className="font-semibold">Possible duplicates to decide</h2>
        <LoadingState {...links}>
          {items.map((l) => (
            <div
              key={l.linkId}
              className="flex items-center justify-between text-sm border-b pb-2"
            >
              <span>
                Keep {l.survivorMrn}, merge {l.otherMrn} · {l.reason}
              </span>
              {l.decidedBy !== me.staffId ? (
                <span className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cmd.busy}
                    onClick={async () => {
                      const reason = window.prompt(
                        "Confirm the merge: how was it checked?",
                      );
                      if (
                        reason &&
                        reason.trim().length >= 3 &&
                        (await cmd.run(`/v1/patient-links/${l.linkId}/decide`, {
                          decision: "merge",
                          reason: reason.trim(),
                        }))
                      )
                        void links.refresh();
                    }}
                  >
                    Merge
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cmd.busy}
                    onClick={async () => {
                      if (
                        await cmd.run(`/v1/patient-links/${l.linkId}/decide`, {
                          decision: "not_duplicate",
                          reason: "Different people",
                        })
                      )
                        void links.refresh();
                    }}
                  >
                    Not the same
                  </Button>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  You proposed this
                </span>
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
export function ConfirmNka({
  patientId,
  confirmedAt,
  onDone,
}: {
  patientId: string;
  confirmedAt: string | null;
  onDone: () => void;
}) {
  const cmd = useCommand();
  if (confirmedAt)
    return (
      <p className="text-xs text-muted-foreground">
        No known allergies confirmed {day(confirmedAt)}.
      </p>
    );
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Record allergy status after checking with the patient.
      </p>
      <Button
        variant="outline"
        disabled={cmd.busy || cmd.unknown}
        onClick={async () => {
          if (await cmd.run(`/v1/patients/${patientId}/no-known-allergies`))
            onDone();
        }}
      >
        Record no known allergies
      </Button>
      <Refused cmd={cmd} />
    </div>
  );
}

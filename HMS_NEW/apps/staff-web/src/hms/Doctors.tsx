// Doctors at the selected clinic, and everything about them that booking uses: the booking profile
// (specialty, qualifications, languages, video visits), name and phone, the clinics they work at, their
// own fees, and their calendar. Each change is authorised by the API at the clinic it affects:
// catalog.manage (profile, clinics), pricing.manage (fees), staff.manage (name, phone), schedules.manage
// (calendar). A doctor without a calendar or weekly hours can't be booked, and the page says so.
import { useState } from "react";
import { CalendarPlus, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { can as canAt, label, money, today } from "./model";
import { confirmLeave, useUnsaved } from "./leave";
import {
  E164,
  addDays,
  isStale,
  listFromText,
  refusal,
  rupeesToMinor,
} from "./forms";
import { Choice, Empty, ErrorMessage, Field, Hint, LoadingState } from "./ui";
import type {
  ClinicDirectory,
  PriceBookItem,
  PriceMode,
  PractitionerDetail,
  Specialty,
} from "./types";

const REASONS: Record<string, string> = {
  stale_version:
    "Someone else saved this first. Close and reopen the doctor to see their change.",
  already_affiliated:
    "The doctor already works in that department for those dates.",
  future_appointments:
    "They still have booked visits at this clinic from that date. Move or cancel them first.",
  published_hours:
    "They still have weekly hours here from that date. End them in Schedules → Weekly hours first.",
  not_affiliated: "The doctor doesn't work at this clinic on that date.",
  past_date: "Choose today or a later date.",
  slug_required: "A published profile needs a web address.",
  duplicate_slug: "Another doctor already uses that web address.",
};
function Refused({ cmd }: { cmd: ReturnType<typeof useCommand> }) {
  const reason = refusal(cmd.failure);
  return (
    <ErrorMessage
      text={
        (reason && REASONS[reason]) ||
        (isStale(cmd.failure) ? REASONS.stale_version : cmd.error)
      }
    />
  );
}

type Fee = {
  healthcareServiceId: string | null;
  serviceName: string | null;
  visitMode: string;
  feeMinor: number | null;
};

export function Doctors() {
  const { facility, practitioners, can, reloadPractitioners } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
      new URLSearchParams(location.search).get("doctor"),
    ),
    [adding, setAdding] = useState(false);
  const selected = practitioners.find((p) => p.staffId === selectedId) ?? null;
  return (
    <>
      <PageTitle
        title="Doctors"
        description="Booking profiles, clinics, fees and calendars of the doctors at this clinic."
        action={
          can("catalog.manage") ? (
            <Button onClick={() => setAdding(true)}>
              <UserPlus />
              Add doctor to this clinic
            </Button>
          ) : undefined
        }
      />
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead>Department & clinic</TableHead>
              <TableHead>Fee</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {practitioners.map((p) => (
              <TableRow key={p.staffId}>
                <TableCell className="font-medium">
                  {p.name}
                  <p className="text-xs text-muted-foreground font-normal mt-1">
                    {p.specialtyName ?? "Specialty not provided"}
                    {p.acceptsVirtual ? " · video visits" : ""}
                  </p>
                </TableCell>
                <TableCell>
                  {p.department}
                  <p className="text-xs text-muted-foreground mt-1">
                    {facility.name}
                  </p>
                </TableCell>
                <TableCell>
                  <Fees staffId={p.staffId} />
                </TableCell>
                <TableCell>
                  {p.calendarId ? (
                    "Calendar ready"
                  ) : can("schedules.manage") ? (
                    <SetUpCalendar
                      staffId={p.staffId}
                      onDone={() => reloadPractitioners?.()}
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      No calendar yet
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedId(p.staffId)}
                  >
                    Doctor details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!practitioners.length && (
          <Empty>
            No doctors work at this clinic yet. Add one to start booking.
          </Empty>
        )}
      </Card>
      <p className="mt-4 text-xs text-muted-foreground">
        Fees are quoted for the services each doctor holds weekly hours for in
        the next two weeks, exactly as booking prices them. A doctor is bookable
        once they have a calendar and weekly hours (Schedules).
      </p>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && confirmLeave()) {
            setSelectedId(null);
            history.replaceState(null, "", location.pathname);
          }
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>
              Booking profile, clinics and fees.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <DoctorDetails
              key={selected.staffId}
              staffId={selected.staffId}
              onChanged={() => reloadPractitioners?.()}
            />
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={adding}
        onOpenChange={(open) => {
          if (open || confirmLeave()) setAdding(open);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add doctor to {facility.name}</SheetTitle>
            <SheetDescription>
              New to the hospital? Invite them first in Workspace settings → Add
              staff member, then add them here.
            </SheetDescription>
          </SheetHeader>
          {adding && (
            <AddDoctor
              onAdded={() => {
                setAdding(false);
                reloadPractitioners?.();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SetUpCalendar({
  staffId,
  onDone,
}: {
  staffId: string;
  onDone: () => void;
}) {
  const cmd = useCommand();
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={cmd.busy}
        onClick={async () => {
          if (await cmd.run(`/v1/practitioners/${staffId}/calendar`)) onDone();
        }}
      >
        <CalendarPlus />
        Set up calendar
      </Button>
      <ErrorMessage text={cmd.error} />
    </div>
  );
}

type StaffAccount = {
  staffId: string;
  displayName: string;
  staffType: string;
  status: string;
};

/** Picks a staff member (doctors first) and adds them to a department here, then opens their calendar. */
function AddDoctor({ onAdded }: { onAdded: () => void }) {
  const { facility, practitioners, can } = useWorkspace(),
    cmd = useCommand();
  const listable = can("access.manage");
  const staff = useQuery<{ items: StaffAccount[] }>(
    listable ? `/v1/staff-accounts?facilityId=${facility.facilityId}` : null,
  );
  const directory = useQuery<ClinicDirectory>(
    `/v1/facilities/${facility.facilityId}/directory`,
  );
  const here = new Set(practitioners.map((p) => p.staffId));
  const candidates = (staff.data?.items ?? [])
    .filter((s) => s.status === "active" && !here.has(s.staffId))
    .sort(
      (a, b) =>
        Number(b.staffType === "doctor") - Number(a.staffType === "doctor") ||
        a.displayName.localeCompare(b.displayName),
    );
  const [staffId, setStaffId] = useState(""),
    [departmentId, setDepartmentId] = useState(""),
    [roleTitle, setRoleTitle] = useState(""),
    [from, setFrom] = useState(today(facility.timezone));
  const dept =
    departmentId || directory.data?.departments[0]?.departmentId || "";
  useUnsaved(!!staffId);
  if (!listable)
    return (
      <div className="p-6">
        <Hint>
          Adding a doctor needs access management at this clinic to see the
          staff list. Ask an administrator.
        </Hint>
      </div>
    );
  return (
    <form
      className="p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const added = await cmd.run(
          `/v1/practitioners/${staffId}/affiliations`,
          {
            facilityId: facility.facilityId,
            departmentId: dept,
            validFrom: from,
            ...(roleTitle.trim() ? { roleTitle: roleTitle.trim() } : {}),
          },
          true,
        );
        if (!added) return;
        // A calendar lets the doctor be given weekly hours; it's shared by every clinic they work at.
        if (can("schedules.manage"))
          await cmd.run(`/v1/practitioners/${staffId}/calendar`);
        onAdded();
      }}
    >
      <LoadingState {...staff}>
        <Field title="Staff member" id="add-doctor">
          <Choice
            label="Staff member"
            value={staffId}
            onChange={setStaffId}
            options={candidates.map((s) => ({
              value: s.staffId,
              label: `${s.displayName} · ${label(s.staffType)}`,
            }))}
          />
        </Field>
        {!candidates.length && (
          <Empty>Everyone with access here already works at this clinic.</Empty>
        )}
      </LoadingState>
      <Field title="Department" id="add-doctor-dept">
        <Choice
          label="Department"
          value={dept}
          onChange={setDepartmentId}
          options={(directory.data?.departments ?? []).map((d) => ({
            value: d.departmentId,
            label: d.name,
          }))}
        />
      </Field>
      {!directory.data?.departments.length && (
        <Hint>Add a department in the Hospital catalogue first.</Hint>
      )}
      <Field title="Role title (optional)" id="add-doctor-title">
        <Input
          id="add-doctor-title"
          value={roleTitle}
          maxLength={80}
          placeholder="Consultant"
          onChange={(e) => setRoleTitle(e.target.value)}
        />
      </Field>
      <Field title="Works here from" id="add-doctor-from">
        <Input
          id="add-doctor-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </Field>
      <Refused cmd={cmd} />
      <Button type="submit" disabled={cmd.busy || !staffId || !dept || !from}>
        <Plus />
        {cmd.busy ? "Adding…" : "Add to this clinic"}
      </Button>
    </form>
  );
}

function DoctorDetails({
  staffId,
  onChanged,
}: {
  staffId: string;
  onChanged: () => void;
}) {
  const { facility } = useWorkspace();
  const detail = useQuery<PractitionerDetail>(
    `/v1/practitioners/${staffId}/profile?facilityId=${facility.facilityId}`,
  );
  const changed = () => {
    void detail.refresh();
    onChanged();
  };
  return (
    <div className="p-6 space-y-8">
      <LoadingState {...detail}>
        {detail.data && (
          <>
            <ProfileForm
              key={`p${detail.data.profile?.version ?? 0}`}
              d={detail.data}
              onSaved={changed}
            />
            <ContactForm
              key={`c${detail.data.staffVersion}`}
              d={detail.data}
              onSaved={changed}
            />
            <Clinics d={detail.data} onChanged={changed} />
            <DoctorFees staffId={staffId} />
          </>
        )}
      </LoadingState>
    </div>
  );
}

function ProfileForm({
  d,
  onSaved,
}: {
  d: PractitionerDetail;
  onSaved: () => void;
}) {
  const { me, facility } = useWorkspace(),
    cmd = useCommand();
  const specialties = useQuery<{ items: Specialty[] }>("/v1/specialties");
  // The profile is shown at every clinic the doctor works at; editing needs catalog.manage at each.
  const current = d.affiliations
    .filter((a) => !a.validTo || a.validTo > today(facility.timezone))
    .map((a) => a.facilityId);
  const editable = current.length
    ? current.every((f) => canAt(me, "catalog.manage", f))
    : (me.permissions["catalog.manage"] ?? []).includes("*");
  const p = d.profile;
  const start = {
    specialty: p?.specialty ?? "none",
    qualifications: (p?.qualifications ?? []).join(", "),
    languages: (p?.languages ?? []).join(", "),
    experience:
      p?.experienceYears === null || p?.experienceYears === undefined
        ? ""
        : String(p.experienceYears),
    bio: p?.bio ?? "",
    acceptsVirtual: p?.acceptsVirtual ?? false,
    publicSlug: p?.publicSlug ?? "",
    published: p?.published ?? false,
  };
  const [f, setF] = useState(start);
  const set =
    <K extends keyof typeof start>(k: K) =>
    (v: (typeof start)[K]) =>
      setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  useUnsaved(dirty);
  const years = f.experience.trim() === "" ? null : Number(f.experience);
  const problems = [
    years !== null &&
      !(Number.isInteger(years) && years >= 0 && years <= 80) &&
      "Experience is whole years from 0 to 80.",
    f.publicSlug &&
      !/^[a-z0-9][a-z0-9-]{1,80}$/.test(f.publicSlug) &&
      "A web address uses lower-case letters, digits and -.",
    f.published && !f.publicSlug && "A published profile needs a web address.",
  ].filter(Boolean) as string[];
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await cmd.run(
          `/v1/practitioners/${d.staffId}/profile`,
          {
            ...(p ? { version: p.version } : {}),
            specialty: f.specialty === "none" ? null : f.specialty,
            qualifications: listFromText(f.qualifications),
            languages: listFromText(f.languages),
            experienceYears: years,
            bio: f.bio.trim() || null,
            acceptsVirtual: f.acceptsVirtual,
            publicSlug: f.publicSlug.trim() || null,
            published: f.published,
          },
          false,
          "PUT",
        );
        if (ok) onSaved();
      }}
    >
      <h3 className="font-semibold">Booking profile</h3>
      <fieldset disabled={!editable} className="space-y-4">
        <Field title="Specialty" id="doc-specialty">
          <Choice
            label="Specialty"
            value={f.specialty}
            disabled={!editable}
            onChange={set("specialty")}
            options={[
              { value: "none", label: "Not set" },
              ...(specialties.data?.items ?? []).map((s) => ({
                value: s.code,
                label: s.name,
              })),
            ]}
          />
        </Field>
        <Field title="Qualifications (comma separated)" id="doc-quals">
          <Input
            id="doc-quals"
            value={f.qualifications}
            placeholder="MBBS, MD (General Medicine)"
            onChange={(e) => set("qualifications")(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field title="Languages" id="doc-langs">
            <Input
              id="doc-langs"
              value={f.languages}
              placeholder="English, Kannada"
              onChange={(e) => set("languages")(e.target.value)}
            />
          </Field>
          <Field title="Experience (years)" id="doc-years">
            <Input
              id="doc-years"
              type="number"
              min={0}
              max={80}
              value={f.experience}
              onChange={(e) => set("experience")(e.target.value)}
            />
          </Field>
        </div>
        <Field title="About (shown to patients)" id="doc-bio">
          <Textarea
            id="doc-bio"
            maxLength={2000}
            value={f.bio}
            onChange={(e) => set("bio")(e.target.value)}
          />
        </Field>
        <div className="flex justify-between gap-4">
          <Label htmlFor="doc-virtual">Accepts video consultations</Label>
          <Switch
            id="doc-virtual"
            checked={f.acceptsVirtual}
            disabled={!editable}
            onCheckedChange={set("acceptsVirtual")}
          />
        </div>
        <Field title="Web address (for the public profile)" id="doc-slug">
          <Input
            id="doc-slug"
            value={f.publicSlug}
            placeholder="dr-asha-rao"
            onChange={(e) => set("publicSlug")(e.target.value.toLowerCase())}
          />
        </Field>
        <div className="flex justify-between gap-4">
          <Label htmlFor="doc-published">Show on the hospital website</Label>
          <Switch
            id="doc-published"
            checked={f.published}
            disabled={!editable}
            onCheckedChange={set("published")}
          />
        </div>
      </fieldset>
      {!editable && (
        <p className="text-xs text-muted-foreground">
          Read-only: the profile is shared by every clinic this doctor works at,
          so an administrator for each of them edits it.
        </p>
      )}
      {problems.map((x) => (
        <p key={x} className="text-sm text-destructive">
          {x}
        </p>
      ))}
      <Refused cmd={cmd} />
      {editable && (
        <Button
          type="submit"
          disabled={cmd.busy || !dirty || problems.length > 0}
        >
          {cmd.busy ? "Saving…" : "Save profile"}
        </Button>
      )}
    </form>
  );
}

function ContactForm({
  d,
  onSaved,
}: {
  d: PractitionerDetail;
  onSaved: () => void;
}) {
  const { can } = useWorkspace(),
    cmd = useCommand();
  const [name, setName] = useState(d.displayName),
    [phone, setPhone] = useState(d.phone ?? "");
  const dirty = name.trim() !== d.displayName || phone !== (d.phone ?? "");
  useUnsaved(dirty);
  if (!can("staff.manage"))
    return (
      <div className="space-y-1 text-sm">
        <h3 className="font-semibold">Contact</h3>
        <p>
          {d.phone ?? "No work phone recorded"} · {d.email ?? "No email"}
        </p>
      </div>
    );
  const valid = name.trim().length >= 2 && (!phone || E164.test(phone));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = {
          version: d.staffVersion,
          ...(name.trim() !== d.displayName
            ? { displayName: name.trim() }
            : {}),
          ...(phone !== (d.phone ?? "") ? { phone: phone || null } : {}),
        };
        if (await cmd.run(`/v1/staff/${d.staffId}`, body, false, "PATCH"))
          onSaved();
      }}
    >
      <h3 className="font-semibold">Name and contact</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field title="Name" id="doc-name">
          <Input
            id="doc-name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field title="Work phone" id="doc-phone">
          <Input
            id="doc-phone"
            type="tel"
            value={phone}
            placeholder="+919876543210"
            onChange={(e) => setPhone(e.target.value.trim())}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Work email: {d.email ?? "not recorded"} (tied to their sign-in; change
        it in Workspace settings by inviting the new address).
      </p>
      {phone && !E164.test(phone) && (
        <p className="text-sm text-destructive">
          Use the international phone format, e.g. +919876543210.
        </p>
      )}
      <Refused cmd={cmd} />
      <Button
        type="submit"
        variant="outline"
        disabled={cmd.busy || !dirty || !valid}
      >
        {cmd.busy ? "Saving…" : "Save name and phone"}
      </Button>
    </form>
  );
}

function Clinics({
  d,
  onChanged,
}: {
  d: PractitionerDetail;
  onChanged: () => void;
}) {
  const { me, facility } = useWorkspace(),
    cmd = useCommand();
  const day = today(facility.timezone);
  const [ending, setEnding] = useState<string | null>(null),
    [until, setUntil] = useState(addDays(day, 1)),
    [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Clinics</h3>
      {d.affiliations.map((a) => {
        const current = !a.validTo || a.validTo > day;
        return (
          <div
            key={a.affiliationId}
            className="border rounded-lg p-3 text-sm space-y-2"
          >
            <div className="flex justify-between gap-3">
              <span>
                {a.facilityName} · {a.departmentName}
                {a.roleTitle ? ` · ${a.roleTitle}` : ""}
              </span>
              <span className="text-muted-foreground">
                from {a.validFrom}
                {a.validTo ? ` until ${addDays(a.validTo, -1)}` : ""}
              </span>
            </div>
            {current &&
              canAt(me, "catalog.manage", a.facilityId) &&
              ending !== a.affiliationId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEnding(a.affiliationId);
                    setReason("");
                  }}
                >
                  Stop working here
                </Button>
              )}
            {ending === a.affiliationId && (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await cmd.run(
                      `/v1/practitioner-affiliations/${a.affiliationId}/end`,
                      { validTo: until, reason: reason.trim() },
                    )
                  ) {
                    setEnding(null);
                    onChanged();
                  }
                }}
              >
                <Field
                  title="First day they no longer work here"
                  id="aff-until"
                >
                  <Input
                    id="aff-until"
                    type="date"
                    min={day}
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                </Field>
                <Field title="Reason" id="aff-reason">
                  <Input
                    id="aff-reason"
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Hint>
                  Their booked visits and weekly hours here from that date must
                  be moved or ended first.
                </Hint>
                <Refused cmd={cmd} />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={cmd.busy || reason.trim().length < 3}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEnding(null)}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
          </div>
        );
      })}
      {!d.affiliations.length && <Empty>Not added to any clinic.</Empty>}
    </div>
  );
}

const MODES: { value: PriceMode; label: string }[] = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Video" },
  { value: "any", label: "Any visit type" },
];

/** The doctor's own fees at this clinic, per service; blank means the service's default fee applies. */
function DoctorFees({ staffId }: { staffId: string }) {
  const { facility, can } = useWorkspace(),
    cmd = useCommand();
  const day = today(facility.timezone);
  const directory = useQuery<ClinicDirectory>(
    `/v1/facilities/${facility.facilityId}/directory`,
  );
  const prices = useQuery<{ items: PriceBookItem[] }>(
    `/v1/facilities/${facility.facilityId}/price-book?on=${day}`,
  );
  const [serviceId, setServiceId] = useState(""),
    [mode, setMode] = useState<PriceMode>("any"),
    [feeText, setFeeText] = useState(""),
    [from, setFrom] = useState(day);
  const services = directory.data?.services ?? [];
  const svc = serviceId || services[0]?.healthcareServiceId || "";
  const items = prices.data?.items ?? [];
  const own = items.filter((i) => i.staffId === staffId);
  const feeMinor = rupeesToMinor(feeText);
  const name = (id: string) =>
    services.find((s) => s.healthcareServiceId === id)?.name ?? "Service";
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Fees at {facility.name}</h3>
      <LoadingState {...prices}>
        {own.length ? (
          own.map((i) => (
            <p
              key={`${i.healthcareServiceId}:${i.mode}:${i.validFrom}`}
              className="text-sm"
            >
              {money(i.feeMinor)} · {name(i.healthcareServiceId)} ·{" "}
              {MODES.find((m) => m.value === i.mode)?.label} · from{" "}
              {i.validFrom}
              {i.validTo ? ` until ${addDays(i.validTo, -1)}` : ""}
            </p>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No fee of their own: each service's default fee applies.
          </p>
        )}
      </LoadingState>
      {can("pricing.manage") && services.length > 0 && (
        <form
          className="space-y-3 border rounded-lg p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await cmd.run(
                `/v1/practitioners/${staffId}/fees`,
                {
                  healthcareServiceId: svc,
                  mode,
                  feeMinor,
                  effectiveFrom: from,
                },
                false,
                "PUT",
              )
            ) {
              setFeeText("");
              void prices.refresh();
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field title="Service" id="fee-service">
              <Choice
                label="Fee service"
                value={svc}
                onChange={setServiceId}
                options={services.map((s) => ({
                  value: s.healthcareServiceId,
                  label: s.name,
                }))}
              />
            </Field>
            <Field title="Visit type" id="fee-mode">
              <Choice
                label="Fee visit type"
                value={mode}
                onChange={(v) => setMode(v as PriceMode)}
                options={MODES}
              />
            </Field>
            <Field title="Their fee (₹, blank = service fee)" id="fee-amount">
              <Input
                id="fee-amount"
                inputMode="decimal"
                value={feeText}
                onChange={(e) => setFeeText(e.target.value)}
              />
            </Field>
            <Field title="From" id="fee-from">
              <Input
                id="fee-from"
                type="date"
                min={day}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
          </div>
          {feeMinor === undefined && (
            <p className="text-sm text-destructive">
              Enter the fee in rupees, e.g. 800 or 750.50.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Visits already booked keep the fee they were booked at.{" "}
            {feeMinor === null
              ? "Saving with no amount returns them to the service fee from that date."
              : ""}
          </p>
          <Refused cmd={cmd} />
          <Button
            type="submit"
            variant="outline"
            disabled={cmd.busy || !svc || feeMinor === undefined}
          >
            {cmd.busy ? "Saving…" : "Save fee"}
          </Button>
        </form>
      )}
    </div>
  );
}

/** Fee per service and visit mode for the next two weeks of weekly hours, priced as booking prices it. */
function Fees({ staffId }: { staffId: string }) {
  const { facility } = useWorkspace();
  const fees = useQuery<{ items: Fee[] }>(
    `/v1/practitioners/${staffId}/fees?${query({ facilityId: facility.facilityId, on: today(facility.timezone) })}`,
  );
  if (fees.loading)
    return <span className="text-muted-foreground">Loading…</span>;
  if (fees.error)
    return <span className="text-muted-foreground">Unavailable</span>;
  if (!fees.data?.items.length)
    return (
      <span className="text-muted-foreground">
        No weekly hours in the next two weeks
      </span>
    );
  return (
    <div className="space-y-1">
      {fees.data.items.map((f) => (
        <div key={`${f.healthcareServiceId}:${f.visitMode}`}>
          {f.feeMinor === null ? "Not priced" : money(f.feeMinor)}
          <span className="text-xs text-muted-foreground">
            {" "}
            · {f.serviceName ?? "No service"} · {label(f.visitMode)}
          </span>
        </div>
      ))}
    </div>
  );
}

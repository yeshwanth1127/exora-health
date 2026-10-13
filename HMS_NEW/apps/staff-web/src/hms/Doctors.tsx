// Doctors at the selected clinic, and everything about them that booking uses: the booking profile
// (specialty, qualifications, languages, video visits), name and phone, the clinics they work at, their
// own fees, and their calendar. Each change is authorised by the API at the clinic it affects:
// catalog.manage (profile, clinics), pricing.manage (fees), staff.manage (name, phone), schedules.manage
// (calendar). A doctor without a calendar or weekly hours can't be booked, and the page says so.
import { useEffect, useState } from "react";
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
import { query, request } from "./client";
import { can as canAt, label, money, today } from "./model";
import { requestLeave, useUnsaved } from "./leave";
import {
  CODE,
  E164,
  addDays,
  isStale,
  listFromText,
  refusal,
  rupeesToMinor,
} from "./forms";
import { Choice, Empty, ErrorMessage, Field, Hint, LoadingState } from "./ui";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import type {
  ClinicDirectory,
  PriceBookItem,
  PriceMode,
  PractitionerDetail,
  Specialty,
  Practitioner,
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
  const { facility, can, go, reloadPractitioners } = useWorkspace();
  const doctors = useQuery<{ items: Practitioner[] }>(
    `/v1/practitioners?facilityId=${facility.facilityId}`,
  );
  const practitioners =
    doctors.data?.items.filter((p) => p.facilityId === facility.facilityId) ??
    [];
  const refresh = () => {
    void doctors.refresh();
    reloadPractitioners?.();
  };
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
      <LoadingState {...doctors}>
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Department & clinic</TableHead>
                <TableHead className="w-40">Fee</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead className="sticky right-0 z-10 bg-card w-40">
                  Action
                </TableHead>
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
                  <TableCell className="max-w-40 whitespace-normal">
                    <Fees compact staffId={p.staffId} />
                  </TableCell>
                  <TableCell>
                    {p.calendarId ? (
                      "Calendar ready"
                    ) : can("schedules.manage") ? (
                      <SetUpCalendar staffId={p.staffId} onDone={refresh} />
                    ) : (
                      <span className="text-muted-foreground">
                        No calendar yet
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-card">
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
            <WorkspaceEmpty
              title={
                can("catalog.manage")
                  ? "Add your first doctor"
                  : "This clinic has no doctors set up"
              }
              description="Connect a doctor to this clinic, then set their consultation and hours."
              action={
                can("catalog.manage")
                  ? { label: "Add doctor", onClick: () => setAdding(true) }
                  : {
                      label: "View setup requirements",
                      onClick: () => go("overview"),
                    }
              }
            />
          )}
        </Card>
      </LoadingState>
      <p className="mt-4 text-xs text-muted-foreground">
        Fees are quoted for the services each doctor holds weekly hours for in
        the next two weeks, exactly as booking prices them. Booking also needs a
        compatible consultation, an effective fee and available published hours.
        Review the booking flow before confirming.
      </p>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open)
            requestLeave(() => {
              setSelectedId(null);
              history.replaceState(history.state, "", location.pathname);
            });
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
              onChanged={refresh}
            />
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={adding}
        onOpenChange={(open) => {
          if (open) setAdding(true);
          else requestLeave(() => setAdding(false));
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Add doctor to {facility.name}</SheetTitle>
            <SheetDescription>
              Choose an existing doctor or create the missing staff account and
              department here. Invitation, clinic affiliation and calendar are
              separate saved steps.
            </SheetDescription>
          </SheetHeader>
          {adding && (
            <AddDoctor
              onAdded={() => {
                setAdding(false);
                refresh();
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
  useUnsaved(false, { pending: cmd.busy || cmd.unknown });
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        disabled={cmd.busy}
        onClick={async () => {
          if (
            await cmd.run(
              `/v1/practitioners/${staffId}/calendar`,
              undefined,
              true,
            )
          )
            onDone();
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
    cmd = useCommand(),
    calendarCmd = useCommand();
  const [affiliated, setAffiliated] = useState<string | null>(null);
  const [prerequisite, setPrerequisite] = useState<
      "staff" | "department" | null
    >(null),
    [notice, setNotice] = useState(""),
    [focusTarget, setFocusTarget] = useState("");
  useEffect(() => {
    if (!prerequisite && focusTarget) {
      const frame = requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(`[aria-label="${focusTarget}"]`)
          ?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [prerequisite, focusTarget]);
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
  useUnsaved(
    calendarCmd.busy ||
      calendarCmd.unknown ||
      cmd.unknown ||
      (!affiliated &&
        (!!staffId ||
          !!departmentId ||
          !!roleTitle ||
          from !== today(facility.timezone))),
    {
      pending:
        cmd.busy || cmd.unknown || calendarCmd.busy || calendarCmd.unknown,
    },
  );
  if (!listable)
    return (
      <div className="p-6">
        <Hint>
          Adding a doctor needs access management at this clinic to see the
          staff list. Ask an administrator.
        </Hint>
      </div>
    );
  if (prerequisite)
    return (
      <DoctorPrerequisite
        kind={prerequisite}
        onBack={() => setPrerequisite(null)}
        onCreated={async (id) => {
          if (prerequisite === "staff") {
            const current = await request<{ items: StaffAccount[] }>(
              `/v1/staff-accounts?facilityId=${facility.facilityId}`,
            );
            const created = current.items.find(
              (s) => s.staffId === id && s.status === "active",
            );
            if (!created)
              throw new Error(
                "The saved staff account is not yet visible as active at this clinic. Check access before continuing; it will not be created again.",
              );
            if (!(await staff.refresh()))
              throw new Error(
                "The staff account was saved but the selector could not refresh. Retry this saved-record check before continuing.",
              );
            setStaffId(id);
            setFocusTarget("Staff member");
            setNotice(
              "Staff account saved and selected. Sign-in invitation is pending; delivery and professional registration are separate checks.",
            );
          } else {
            const current = await request<ClinicDirectory>(
              `/v1/facilities/${facility.facilityId}/directory`,
            );
            if (
              current.facilityId !== facility.facilityId ||
              !current.departments.some(
                (d) => d.departmentId === id && d.status === "active",
              )
            )
              throw new Error(
                "The saved department is not yet visible as active at this clinic. Retry the read before continuing; it will not be created again.",
              );
            if (!(await directory.refresh()))
              throw new Error(
                "The department was saved but the selector could not refresh. Retry this saved-record check before continuing.",
              );
            setDepartmentId(id);
            setFocusTarget("Department");
            setNotice(
              "Department saved and selected. Your doctor details were kept.",
            );
          }
          setPrerequisite(null);
        }}
      />
    );
  if (affiliated)
    return (
      <div className="p-6 space-y-4">
        <h3 className="font-medium">
          Doctor added. Calendar setup needs attention.
        </h3>
        <p className="text-sm text-muted-foreground">
          The clinic affiliation was saved. It will not be added again.{" "}
          {can("schedules.manage")
            ? "Continue with the calendar before publishing hours."
            : "An administrator with schedule management access must set up the calendar."}
        </p>
        <Refused cmd={calendarCmd} />
        {calendarCmd.unknown && (
          <Hint>
            The calendar outcome is uncertain. Retrying this naturally
            idempotent operation checks or creates this same doctor's calendar.
          </Hint>
        )}
        {can("schedules.manage") && (
          <Button
            disabled={calendarCmd.busy}
            onClick={async () => {
              if (
                await calendarCmd.run(
                  `/v1/practitioners/${affiliated}/calendar`,
                  undefined,
                  true,
                )
              )
                onAdded();
            }}
          >
            {calendarCmd.busy ? "Checking…" : "Resume calendar setup"}
          </Button>
        )}
        <Button variant="outline" disabled={calendarCmd.busy} onClick={onAdded}>
          Return to doctors
        </Button>
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
        setAffiliated(staffId);
        if (
          can("schedules.manage") &&
          (await calendarCmd.run(
            `/v1/practitioners/${staffId}/calendar`,
            undefined,
            true,
          ))
        )
          onAdded();
      }}
    >
      {notice && <Hint>{notice}</Hint>}
      <fieldset disabled={cmd.busy || cmd.unknown} className="space-y-4">
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
          {can("staff.manage") && can("access.manage") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrerequisite("staff")}
            >
              <UserPlus />
              Create doctor staff account
            </Button>
          )}
          {!candidates.length && (
            <Empty>
              Everyone with access here already works at this clinic.
            </Empty>
          )}
        </LoadingState>
        <LoadingState {...directory}>
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
          {can("facility.manage") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrerequisite("department")}
            >
              <Plus />
              Add department
            </Button>
          )}
          {!directory.data?.departments.length && !can("facility.manage") && (
            <Hint>
              A clinic administrator needs to add a department. Your current
              selection remains here.
            </Hint>
          )}
        </LoadingState>
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
      </fieldset>
      <Refused cmd={cmd} />
      <Button
        type="submit"
        disabled={
          cmd.busy ||
          calendarCmd.busy ||
          staff.loading ||
          !!staff.error ||
          directory.loading ||
          !!directory.error ||
          !staffId ||
          !dept ||
          !from
        }
      >
        <Plus />
        {cmd.busy
          ? "Adding…"
          : cmd.unknown
            ? "Check original doctor request"
            : "Add to this clinic"}
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
            <div className="space-y-2">
              <h3 className="font-semibold">Booking fee preview</h3>
              <Fees staffId={staffId} />
            </div>
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
  useUnsaved(dirty, { pending: cmd.busy || cmd.unknown });
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
  useUnsaved(dirty, { pending: cmd.busy || cmd.unknown });
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
  useUnsaved(!!ending && (!!reason || until !== addDays(day, 1)), {
    pending: cmd.busy || cmd.unknown,
  });
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
  useUnsaved(!!feeText || !!serviceId || mode !== "any" || from !== day, {
    pending: cmd.busy || cmd.unknown,
  });
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
              setServiceId("");
              setMode("any");
              setFrom(day);
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
function Fees({
  staffId,
  compact = false,
}: {
  staffId: string;
  compact?: boolean;
}) {
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
  if (compact) {
    const amounts = fees.data.items
      .map((f) => f.feeMinor)
      .filter((v): v is number => v !== null);
    return (
      <div className="space-y-1">
        <span>
          {amounts.length
            ? `${money(Math.min(...amounts))}${Math.max(...amounts) !== Math.min(...amounts) ? `–${money(Math.max(...amounts))}` : ""}`
            : "Not priced"}
        </span>
        <p className="text-xs text-muted-foreground">
          {fees.data.items.length} price
          {fees.data.items.length === 1 ? "" : "s"} · see details
        </p>
      </div>
    );
  }
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

/** One prerequisite editor within the same doctor sheet; affiliation draft remains in its parent. */
function DoctorPrerequisite({
  kind,
  onBack,
  onCreated,
}: {
  kind: "staff" | "department";
  onBack: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const { facility, can } = useWorkspace(),
    cmd = useCommand();
  const allowed =
    kind === "staff"
      ? can("staff.manage") && can("access.manage")
      : can("facility.manage");
  const roles = useQuery<{
    roles: { roleId: string; name: string; permissions: string[] }[];
  }>(kind === "staff" && allowed ? "/v1/roles" : null);
  const specialties = useQuery<{ items: Specialty[] }>(
    kind === "department" && allowed ? "/v1/specialties" : null,
  );
  useEffect(() => {
    document.getElementById("doctor-prereq-name")?.focus();
  }, []);
  const [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [role, setRole] = useState(""),
    [specialty, setSpecialty] = useState("none"),
    [savedId, setSavedId] = useState(""),
    [readError, setReadError] = useState(""),
    [unidentified, setUnidentified] = useState(false),
    [checking, setChecking] = useState(false);
  const valid =
    name.trim().length >= 2 &&
    (kind === "staff"
      ? /^[A-Za-z0-9._/-]{1,30}$/.test(code) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
        !!role &&
        (!phone || E164.test(phone)) &&
        !!roles.data &&
        !roles.error
      : CODE.test(code));
  const draftDirty =
    !savedId &&
    !!(name || code || email || phone || role || specialty !== "none");
  const pending = cmd.busy || cmd.unknown || checking || unidentified;
  useUnsaved(draftDirty, { pending });
  const back = () => {
    if (pending) return;
    if (draftDirty) requestLeave(onBack);
    else onBack();
  };
  async function resume(id: string) {
    setChecking(true);
    setReadError("");
    try {
      await onCreated(id);
    } catch (e) {
      setReadError(
        e instanceof Error ? e.message : "Could not verify the created record.",
      );
    } finally {
      setChecking(false);
    }
  }
  if (!allowed)
    return (
      <div className="p-6 space-y-4">
        <Hint>
          Your current clinic permissions do not allow this prerequisite. Ask
          the clinic administrator.
        </Hint>
        <Button variant="outline" onClick={back}>
          Back to doctor
        </Button>
      </div>
    );
  if (savedId)
    return (
      <div className="p-6 space-y-4">
        <h3 className="font-medium">
          {kind === "staff" ? "Staff account" : "Department"} saved
        </h3>
        <p className="text-sm text-muted-foreground">
          Confirming the actual saved record at this clinic before selecting it.
          This step will not create another record.
        </p>
        <ErrorMessage text={readError} />
        <Button disabled={checking} onClick={() => void resume(savedId)}>
          {checking ? "Checking…" : "Retry saved-record check"}
        </Button>
        <Button variant="outline" disabled={checking} onClick={back}>
          Back to doctor
        </Button>
      </div>
    );
  return (
    <form
      className="p-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || unidentified) return;
        const result =
          kind === "staff"
            ? await cmd.run<{ staffId: string }>(
                "/v1/staff-accounts",
                {
                  displayName: name.trim(),
                  employeeNo: code.trim(),
                  staffType: "doctor",
                  email: email.trim(),
                  ...(phone ? { phone } : {}),
                  roleId: role,
                  facilityId: facility.facilityId,
                },
                true,
              )
            : await cmd.run<{ departmentId: string }>(
                `/v1/facilities/${facility.facilityId}/departments`,
                {
                  code: code.trim(),
                  name: name.trim(),
                  kind: "clinical",
                  specialty: specialty === "none" ? null : specialty,
                },
                true,
              );
        if (!result) return;
        const id = "staffId" in result ? result.staffId : result.departmentId;
        if (typeof id !== "string" || !id) {
          setUnidentified(true);
          setReadError(
            "The server did not identify the saved record. Keep this form open and review the request with the administrator.",
          );
          return;
        }
        setSavedId(id);
        await resume(id);
      }}
    >
      <h3 className="font-semibold">
        {kind === "staff"
          ? "Create doctor staff account"
          : "Add clinical department"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {facility.name} · Your doctor affiliation draft stays here while you
        complete this step.
      </p>
      <fieldset
        disabled={cmd.busy || cmd.unknown || unidentified}
        className="space-y-4"
      >
        <Field
          title={kind === "staff" ? "Doctor’s full name" : "Department name"}
          id="doctor-prereq-name"
        >
          <Input
            id="doctor-prereq-name"
            value={name}
            maxLength={kind === "staff" ? 100 : 120}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          title={kind === "staff" ? "Employee number" : "Department code"}
          id="doctor-prereq-code"
        >
          <Input
            id="doctor-prereq-code"
            value={code}
            maxLength={30}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        {kind === "staff" ? (
          <>
            <Field title="Work email" id="doctor-prereq-email">
              <Input
                id="doctor-prereq-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field
              title="Mobile (optional, +country code)"
              id="doctor-prereq-phone"
            >
              <Input
                id="doctor-prereq-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim())}
              />
            </Field>
            <LoadingState {...roles}>
              <Field title="Role at this clinic" id="doctor-prereq-role">
                <Choice
                  label="Role at this clinic"
                  value={role}
                  onChange={setRole}
                  options={(roles.data?.roles ?? []).map((r) => ({
                    value: r.roleId,
                    label: r.name,
                  }))}
                />
              </Field>
              {role && (
                <details>
                  <summary className="text-sm cursor-pointer">
                    Review role permissions
                  </summary>
                  <p className="text-xs text-muted-foreground">
                    {roles.data?.roles
                      .find((r) => r.roleId === role)
                      ?.permissions.join(", ")}
                  </p>
                </details>
              )}
            </LoadingState>
            <Hint>
              Creates a doctor-type staff record, a pending sign-in invitation
              and the selected role at this clinic. Invitation delivery,
              clinical registration, affiliation and calendar are separate. The
              server checks whether you may grant this role.
            </Hint>
          </>
        ) : (
          <LoadingState {...specialties}>
            <Field title="Specialty (optional)" id="doctor-prereq-specialty">
              <Choice
                label="Department specialty"
                value={specialty}
                onChange={setSpecialty}
                options={[
                  { value: "none", label: "Not set" },
                  ...(specialties.data?.items ?? []).map((s) => ({
                    value: s.code,
                    label: s.name,
                  })),
                ]}
              />
            </Field>
          </LoadingState>
        )}
      </fieldset>
      <Refused cmd={cmd} />
      <ErrorMessage text={readError} />
      <div className="flex gap-3">
        <Button type="submit" disabled={cmd.busy || unidentified || !valid}>
          {cmd.busy
            ? "Saving…"
            : cmd.unknown
              ? "Check original request"
              : kind === "staff"
                ? "Create staff account"
                : "Create department"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={cmd.busy || cmd.unknown || unidentified}
          onClick={back}
        >
          Back to doctor
        </Button>
      </div>
    </form>
  );
}

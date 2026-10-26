import { TimeField } from "@/components/WorkspaceFields";
import { useContext, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { OriginalResourceContext, isDraft } from "@/components/resource-source";
import { requestLeave, useUnsaved } from "@/hms/leave";
import { useLegacyCommand } from "@/hms/operational-command";
import { RecoveryNotice } from "@/hms/OperationalRecovery";
import { FullPage } from "@/hms/FullPage";
import { dateTime, type Catalogue } from "@/lib/api";
import {
  Action,
  Choice,
  Field,
  Resource,
  useApi,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Doctor } from "./clinic-types";
import type { DeskAppointment } from "./NurseDesk";
import { AppointmentActions } from "./appointment-actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function ScheduleSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-b pb-6">
      <header className="flex items-start gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

type Group = { days: number[]; windows: { start: string; end: string }[] };
type Template = { groups: Group[]; slot_minutes: number };
type Preview = {
  affected_appointments: DeskAppointment[];
  can_save: boolean;
  other_published_hours: {
    branch: string;
    consultation_type: string;
    weekday: number;
    start: string;
    end: string;
  }[];
};
const timeOK = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const tomorrow = () =>
  new Date(Date.now() + 330 * 60000 + 86400000).toISOString().slice(0, 10);

export function WeeklyHours({
  doctor,
  branch: initialBranch,
  initialMode = "in_person",
  onDoctorProfile,
  onOneOff,
  day,
  allowed,
  onClose,
  onSaved,
}: {
  doctor: Doctor;
  catalogue: Catalogue;
  branch: string;
  initialMode?: "in_person" | "virtual";
  onDoctorProfile?: (id: string) => void;
  onOneOff?: () => void;
  day: string;
  allowed: Record<string, boolean>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const source = useContext(OriginalResourceContext);
  const [branch, setBranch] = useState(
    initialBranch || doctor.branches[0]?.id || "",
  );
  const [mode, setMode] = useState<string>(initialMode);
  const virtualUnavailable = mode === "virtual" && !doctor.accepts_virtual;
  const [starts] = useState(() => (day > tomorrow() ? day : tomorrow()));
  const template = useResource<Template>(
    branch && !isDraft(source) && !virtualUnavailable
      ? "/api/v1/admin/schedule-timeline/weekly?" +
          new URLSearchParams({
            doctor_id: doctor.id,
            branch_id: branch,
            consultation_type: mode,
            day: starts,
          })
      : null,
  );
  return (
    <FullPage
      title={
        mode === "virtual"
          ? `${doctor.name} · Teleconsultation hours`
          : `${doctor.name} · In-person hours`
      }
      back="Back to schedules"
      onBack={onClose}
    >
      <div className="max-w-3xl pb-6 space-y-6">
        <div className="flex flex-col gap-5 border-b pb-6">
          <Choice
            label="Visit type"
            value={mode}
            onChange={(v) => {
              requestLeave(() => {
                setMode(v);
                if (!source) setBranch("");
              });
            }}
            options={[
              ["in_person", "In person"],
              ["virtual", "Teleconsultation"],
            ]}
          />
          {virtualUnavailable && (
            <Alert>
              <AlertDescription>
                Teleconsultations are disabled on this doctor's profile. Enable
                “Accepts video consultations” in Doctors before publishing
                teleconsultation hours. Scheduling permissions remain required.
                {onDoctorProfile && (
                  <Button
                    variant="link"
                    className="h-auto p-0 mt-2 block"
                    onClick={() => onDoctorProfile(doctor.id)}
                  >
                    Open doctor profile
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
            <p className="text-sm text-muted-foreground">
              Recurring changes start tomorrow or later.
            </p>
            {onOneOff && (
              <Button
                variant="outline"

                onClick={() => requestLeave(onOneOff)}
              >
                Edit today’s time
              </Button>
            )}
          </div>
        </div>
        {isDraft(source) && (
          <Alert>
            <AlertDescription>
              Draft only. Published weekly hours cannot be loaded yet. Editing
              this sheet does not change the schedule, and review/save are
              unavailable.
            </AlertDescription>
          </Alert>
        )}
        {virtualUnavailable ? null : branch && isDraft(source) ? (
          <WeeklyEditor
            key={`${branch}:${mode}`}
            initial={{ groups: [], slot_minutes: 30 }}
            doctor={doctor}
            branch={branch}
            mode={mode}
            first={starts}
            allowed={allowed}
            onSaved={onSaved}
            onClose={onClose}
          />
        ) : (
          branch && (
            <Resource {...template}>
              {template.fresh && template.data && (
                <WeeklyEditor
                  key={`${branch}:${mode}`}
                  initial={template.data}
                  doctor={doctor}
                  branch={branch}
                  mode={mode}
                  first={starts}
                  allowed={allowed}
                  onSaved={onSaved}
                  onClose={onClose}
                />
              )}
            </Resource>
          )
        )}
      </div>
    </FullPage>
  );
}

function WeeklyEditor({
  initial,
  doctor,
  branch,
  mode,
  first,
  allowed,
  onSaved,
  onClose,
}: {
  initial: Template;
  doctor: Doctor;
  branch: string;
  mode: string;
  first: string;
  allowed: Record<string, boolean>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const draft = isDraft(useContext(OriginalResourceContext));
  const api = useApi();
  const command = useLegacyCommand();
  const [previewBusy, setPreviewBusy] = useState(false);
  const [ongoing, setOngoing] = useState(true);
  const [minimumDate] = useState(tomorrow);
  const [groups, setGroups] = useState<Group[]>(initial.groups);
  const [from, setFrom] = useState(first),
    [until, setUntil] = useState("");
  const [minutes, setMinutes] = useState(String(initial.slot_minutes));
  const [review, setReview] = useState<{
    signature: string;
    result: Preview;
  } | null>(null);
  const [editing, setEditing] = useState<DeskAppointment | null>(null);
  const [error, setError] = useState("");
  useUnsaved(
    JSON.stringify(groups) !== JSON.stringify(initial.groups) ||
      from !== first ||
      until !== "" ||
      !ongoing ||
      minutes !== String(initial.slot_minutes) ||
      previewBusy,
    { pending: previewBusy },
  );
  const days = groups.flatMap((g) => g.days);
  const fromError =
    !/^\d{4}-\d{2}-\d{2}$/.test(from) || from < minimumDate
      ? "Choose tomorrow or a later date. Use the timeline to edit today."
      : "";
  const untilError =
    !ongoing && !until
      ? "Choose the final date for these hours."
      : until && until < from
        ? "Repeat until must be on or after Start repeating."
        : "";
  const slotError =
    !Number.isInteger(Number(minutes)) ||
    Number(minutes) < 10 ||
    Number(minutes) > 240
      ? "Enter a slot length from 10 to 240 minutes."
      : "";
  const groupError = (g: Group) =>
    !g.days.length
      ? "Select at least one day for this group, or remove it."
      : days.length !== new Set(days).size
        ? "A day can belong to only one group. Remove it from the other group first."
        : "";
  const windowError = (g: Group, index: number, end: boolean) => {
    const w = g.windows[index];
    if (!timeOK(end ? w.end : w.start))
      return "Use 24-hour HH:MM, for example 19:00.";
    if (end && timeOK(w.start) && w.end <= w.start)
      return "End must be after start. For 10 PM, use 22:00.";
    if (
      end &&
      g.windows.some(
        (other, i) =>
          i !== index &&
          timeOK(other.start) &&
          timeOK(other.end) &&
          other.start < w.end &&
          other.end > w.start,
      )
    )
      return "This range overlaps another range in this group.";
    return "";
  };
  const valid =
    !fromError &&
    !untilError &&
    !slotError &&
    groups.every(
      (g) =>
        !groupError(g) &&
        g.windows.length > 0 &&
        g.windows.every(
          (_, i) => !windowError(g, i, false) && !windowError(g, i, true),
        ),
    );
  const body = {
    doctor_id: doctor.id,
    branch_id: branch,
    consultation_type: mode,
    effective_from: from,
    effective_until: until || null,
    slot_minutes: Number(minutes),
    groups,
  };
  const signature = JSON.stringify(body);
  const current = review?.signature === signature ? review.result : null;
  const updateGroup = (index: number, value: Group) => {
    setGroups((gs) => gs.map((g, i) => (i === index ? value : g)));
    setError("");
  };
  const preview = async () => {
    setError("");
    setPreviewBusy(true);
    try {
      const result = await api<Preview>(
        "/api/v1/admin/schedule-timeline/weekly/preview",
        { method: "POST", body },
      );
      setReview({ signature, result });
    } catch (e) {
      setReview(null);
      setError(
        e instanceof Error ? e.message : "Could not review weekly hours.",
      );
      throw e;
    } finally {
      setPreviewBusy(false);
    }
  };
  return (
    <div className="space-y-8">
      <RecoveryNotice
        command={command}
        onRecovered={() => {
          onSaved();
          onClose();
        }}
      />
      <fieldset
        disabled={command.busy || command.unknown || previewBusy}
        className="flex flex-col gap-6 border-0 p-0 min-w-0"
      >
        <ScheduleSection
          title="Repeat dates"
        >
          <label className="flex items-center gap-3 text-base ">
            <input
              type="checkbox"
              className="accent-primary"
              checked={ongoing}
              onChange={(e) => {
                setOngoing(e.target.checked);
                setUntil("");
              }}
            />
            Keep these hours ongoing
          </label>
          <div className="grid grid-cols-2 gap-6">
            <Field label="Start repeating" id="weekly-from" error={fromError}>
              <Input
                id="weekly-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                onInput={(e) => setFrom(e.currentTarget.value)}
                aria-invalid={!!fromError}
                aria-describedby={fromError ? "weekly-from-error" : undefined}
              />
            </Field>
            <Field
              label="Final date"
              id="weekly-until"
              error={untilError || undefined}
              hint={
                ongoing
                  ? "No final date while Ongoing is selected."
                  : "This final date is included."
              }
            >
              <Input
                id="weekly-until"
                disabled={ongoing}
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                onInput={(e) => setUntil(e.currentTarget.value)}
                aria-invalid={!!untilError}
                aria-describedby={untilError ? "weekly-until-error" : undefined}
              />
            </Field>
          </div>
        </ScheduleSection>
        <ScheduleSection
          title="Days & working hours"
        >
          <p className="text-sm text-muted-foreground">
            {draft
              ? "Unselected days are excluded from this draft."
              : "Unselected days will be closed."}
          </p>
          {groups.map((g, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Day group {index + 1}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove day group ${index + 1}`}
                  onClick={() =>
                    setGroups((gs) => gs.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Field
                label="Repeat on"
                id={`weekly-days-${index}`}
                error={groupError(g)}
              >
                <div
                  id={`weekly-days-${index}`}
                  className="flex flex-wrap gap-3"
                  role="group"
                  aria-label={`Days for group ${index + 1}`}
                  aria-invalid={!!groupError(g)}
                >
                  {DAYS.map((d, n) => (
                    <Button
                      key={d}
                      className="h-11 min-w-16 px-4 text-base"
                      variant={g.days.includes(n) ? "default" : "outline"}
                      aria-pressed={g.days.includes(n)}
                      disabled={!g.days.includes(n) && days.includes(n)}
                      onClick={() =>
                        updateGroup(index, {
                          ...g,
                          days: g.days.includes(n)
                            ? g.days.filter((v) => v !== n)
                            : [...g.days, n].sort(),
                        })
                      }
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </Field>
              {g.windows.map((w, j) => (
                <div
                  key={j}
                  className="grid grid-cols-[1fr_1fr_auto] gap-6 items-start"
                >
                  <Field
                    label="From · 24-hour"
                    id={`weekly-start-${index}-${j}`}
                    error={windowError(g, j, false)}
                  >
                    <TimeField id={`weekly-start-${index}-${j}`} label="From · 24-hour" value={w.start}
                      onValueChange={(value) => updateGroup(index, { ...g,
                        windows: g.windows.map((v, i) => i === j ? { ...v, start: value } : v),
                      })} />
                  </Field>
                  <Field
                    label="To · 24-hour"
                    id={`weekly-end-${index}-${j}`}
                    error={windowError(g, j, true)}
                  >
                    <TimeField id={`weekly-end-${index}-${j}`} label="To · 24-hour" value={w.end}
                      onValueChange={(value) => updateGroup(index, { ...g,
                        windows: g.windows.map((v, i) => i === j ? { ...v, end: value } : v),
                      })} />
                  </Field>
                  <Button
                    className="mt-6 h-11 w-11"
                    size="icon"
                    variant="ghost"
                    disabled={g.windows.length === 1}
                    aria-label={`Remove range ${j + 1} from group ${index + 1}`}
                    onClick={() =>
                      updateGroup(index, {
                        ...g,
                        windows: g.windows.filter((_, i) => i !== j),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"

                disabled={g.windows.length >= 6}
                onClick={() =>
                  updateGroup(index, {
                    ...g,
                    windows: [...g.windows, { start: "19:00", end: "22:00" }],
                  })
                }
              >
                <Plus />
                Add time range
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-4 [&_button]:h-11 [&_button]:px-5 [&_button]:text-base">
            <Button
              variant="outline"
              disabled={days.length === 7}
              onClick={() =>
                setGroups((gs) => [
                  ...gs,
                  {
                    days: DAYS.map((_, n) => n).filter(
                      (n) => !days.includes(n),
                    ),
                    windows: [{ start: "17:00", end: "19:00" }],
                  },
                ])
              }
            >
              <Plus />
              Add day group
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                requestLeave(() =>
                  setGroups([
                    {
                      days: [2, 3, 4],
                      windows: [
                        { start: "10:00", end: "14:00" },
                        { start: "19:00", end: "22:00" },
                      ],
                    },
                    {
                      days: [0, 1, 5, 6],
                      windows: [{ start: "17:00", end: "19:00" }],
                    },
                  ]),
                )
              }
            >
              Use split-shift example
            </Button>
          </div>
          {groups.length === 0 && (
            <Alert>
              <AlertDescription>
                {draft
                  ? "No draft day groups yet. Add a group or use the split-shift example. Existing published hours have not been loaded."
                  : "All seven days will be closed. Review existing appointments before saving."}
              </AlertDescription>
            </Alert>
          )}
        </ScheduleSection>
        <ScheduleSection
          title="Slot duration & review"
        >
          <div className="grid grid-cols-[minmax(240px,1fr)_2fr] items-start gap-8">
            <Field
              label="Patient booking slot · minutes"
              id="weekly-slots"
              error={slotError}
              hint={
                draft
                  ? "Saving slot length isn't available yet."
                  : "Staff can still book any exact start and end time within these hours."
              }
            >
              <Input
                id="weekly-slots"
                type="number"
                min={10}
                max={240}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                aria-invalid={!!slotError}
              />
            </Field>
            <div className="flex flex-wrap gap-3 pt-6">
              {[10, 15, 20, 30].map((n) => (
                <Button
                  key={n}
                  variant={minutes === String(n) ? "default" : "outline"}
                  aria-pressed={minutes === String(n)}

                  onClick={() => setMinutes(String(n))}
                >
                  {n} min
                </Button>
              ))}
            </div>
          </div>
          <div className="border-t pt-5 space-y-3">
            <h3 className="font-semibold">Your proposed weekly schedule</h3>
            <p className="text-sm leading-relaxed">
              {doctor.name} ·{" "}
              {mode === "virtual" ? "Teleconsultation" : "In person"} · from{" "}
              {from}
              {ongoing
                ? " onwards"
                : ` through ${until || "a final date"}`} ·{" "}
              {groups
                .map(
                  (g) =>
                    `${g.days.map((d) => DAYS[d]).join(", ")}: ${g.windows.map((w) => `${w.start}–${w.end}`).join(", ")}`,
                )
                .join("; ") || "No days selected"}{" "}
              · {minutes} minute slots.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {draft
                ? "This draft has not been checked against published hours, existing bookings or blocks. Nothing is replaced or saved."
                : "This replaces published hours for this clinic and visit type during the dates above. Earlier dates and existing time blocks are kept."}
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between gap-6 border-t pt-6 ">
            <p className="text-sm text-muted-foreground">
              {current
                ? "Review complete. Check the result below."
                : "Review checks conflicts; it does not publish changes."}
            </p>
            <Action
              variant={current ? "outline" : "default"}
              disabled={!valid}
              run={preview}
            >
              Review weekly hours
            </Action>
          </div>
          {current && (
            <div className="space-y-6 border-t pt-6 text-base">
              {current.affected_appointments.length ? (
                <>
                  <Alert variant="destructive">
                    <AlertDescription>
                      Move or cancel these{" "}
                      {current.affected_appointments.length} appointments before
                      saving. They fall outside the proposed hours.
                    </AlertDescription>
                  </Alert>
                  {current.affected_appointments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-6 rounded-lg border bg-background p-5 text-base"
                    >
                      <div>
                        <p className="font-medium">{a.patient_name}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {dateTime(a.starts_at)}–{dateTime(a.ends_at)}
                        </p>
                      </div>
                      <Button
                        variant="outline"

                        onClick={() => setEditing(a)}
                      >
                        Resolve
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-base font-medium">
                  Ready to save. No existing appointments fall outside these
                  hours.
                </p>
              )}
              {!!current.other_published_hours.length && (
                <details className="rounded-lg border bg-background p-5 text-sm text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Hours also offered at other clinics or for virtual visits
                  </summary>
                  <p className="mt-2">
                    These published hours are kept. Every booking still checks
                    the doctor's appointments across all clinics.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {current.other_published_hours.map((h, i) => (
                      <li key={i}>
                        {DAYS[h.weekday]} · {h.start}–{h.end} · {h.branch}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex justify-end ">
                <Action
                  disabled={!valid || !current.can_save}
                  run={async () => {
                    try {
                      await command.write(
                        "/api/v1/admin/schedule-timeline/weekly",
                        {
                          method: "PUT",
                          body,
                        },
                      );
                      onSaved();
                      onClose();
                    } catch (e) {
                      setReview(null);
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Could not save weekly hours.",
                      );
                      throw e;
                    }
                  }}
                  success="Weekly hours saved"
                >
                  Save weekly hours
                </Action>
              </div>
            </div>
          )}
        </ScheduleSection>
        <Sheet
          open={!!editing}
          onOpenChange={(v) => {
            if (!v) requestLeave(() => setEditing(null));
          }}
        >
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Resolve appointment</SheetTitle>
              <SheetDescription>{editing?.patient_name}</SheetDescription>
            </SheetHeader>
            {editing && (
              <div className="px-4">
                <AppointmentActions
                  key={editing.id}
                  item={editing}
                  allowed={allowed}
                  onSaved={() => {
                    setEditing(null);
                    setReview(null);
                    onSaved();
                  }}
                />
              </div>
            )}
          </SheetContent>
        </Sheet>
      </fieldset>
    </div>
  );
}

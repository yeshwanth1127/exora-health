import { useContext, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { OriginalResourceContext, isDraft } from "@/components/resource-source";
import { confirmLeave, useUnsaved } from "@/hms/leave";
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
  catalogue,
  branch: initialBranch,
  day,
  allowed,
  onClose,
  onSaved,
}: {
  doctor: Doctor;
  catalogue: Catalogue;
  branch: string;
  day: string;
  allowed: Record<string, boolean>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const source = useContext(OriginalResourceContext);
  const [branch, setBranch] = useState(
    initialBranch || doctor.branches[0]?.id || "",
  );
  const [mode, setMode] = useState("in_person");
  const [starts] = useState(() => (day > tomorrow() ? day : tomorrow()));
  const branches = catalogue.branches.filter(
    (b) =>
      b.is_active &&
      (source
        ? doctor.branches.some((c) => c.id === b.id)
        : mode === "virtual"
          ? b.is_virtual && doctor.accepts_virtual
          : !b.is_virtual && doctor.branches.some((c) => c.id === b.id)),
  );
  const template = useResource<Template>(
    branch && !isDraft(source)
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
    <Sheet
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        style={{ width: "min(100vw, 560px)", maxWidth: "100vw" }}
        className="overflow-y-auto"
      >
        <SheetHeader className="pr-10">
          <SheetTitle>Weekly hours</SheetTitle>
          <SheetDescription>
            {doctor.name} · repeat selected hours every week · IST
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-5">
          <Choice
            label="Visit type"
            value={mode}
            onChange={(v) => {
              if (!confirmLeave()) return;
              setMode(v);
              setBranch("");
            }}
            options={[
              ["in_person", "In person"],
              ...(doctor.accepts_virtual
                ? [["virtual", "Virtual"] as [string, string]]
                : []),
            ]}
          />
          <Choice
            label="Clinic"
            value={branch}
            onChange={(v) => {
              if (confirmLeave()) setBranch(v);
            }}
            options={branches.map((b) => [b.id, b.name])}
            error={
              !branches.some((b) => b.id === branch)
                ? "Choose a clinic for these weekly hours."
                : undefined
            }
          />
          {isDraft(source) && (
            <Alert>
              <AlertDescription>
                Draft only. Published weekly hours cannot be loaded yet. Editing
                this sheet does not change the schedule, and review/save are
                unavailable.
              </AlertDescription>
            </Alert>
          )}
          {branch && isDraft(source) ? (
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
      </SheetContent>
    </Sheet>
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
      minutes !== String(initial.slot_minutes),
  );
  const days = groups.flatMap((g) => g.days);
  const fromError =
    !/^\d{4}-\d{2}-\d{2}$/.test(from) || from < minimumDate
      ? "Choose tomorrow or a later date. Use the timeline to edit today."
      : "";
  const untilError =
    until && until < from
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
    }
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
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
          label="Repeat until · optional"
          id="weekly-until"
          error={untilError || undefined}
          hint="Leave empty to keep repeating."
        >
          <Input
            id="weekly-until"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            onInput={(e) => setUntil(e.currentTarget.value)}
            aria-invalid={!!untilError}
            aria-describedby={untilError ? "weekly-until-error" : undefined}
          />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        Choose days that share the same hours. Add another range for split
        shifts.{" "}
        {draft
          ? "Unselected days are excluded from this draft."
          : "Unselected days are closed."}
      </p>
      {groups.map((g, index) => (
        <div key={index} className="space-y-4 border-b pb-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Day group {index + 1}</p>
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
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={`Days for group ${index + 1}`}
              aria-invalid={!!groupError(g)}
            >
              {DAYS.map((d, n) => (
                <Button
                  key={d}
                  size="sm"
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
              className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start"
            >
              <Field
                label="From · 24-hour"
                id={`weekly-start-${index}-${j}`}
                error={windowError(g, j, false)}
              >
                <Input
                  id={`weekly-start-${index}-${j}`}
                  value={w.start}
                  maxLength={5}
                  placeholder="10:00"
                  aria-invalid={!!windowError(g, j, false)}
                  aria-describedby={
                    windowError(g, j, false)
                      ? `weekly-start-${index}-${j}-error`
                      : undefined
                  }
                  onChange={(e) =>
                    updateGroup(index, {
                      ...g,
                      windows: g.windows.map((v, i) =>
                        i === j ? { ...v, start: e.target.value } : v,
                      ),
                    })
                  }
                />
              </Field>
              <Field
                label="To · 24-hour"
                id={`weekly-end-${index}-${j}`}
                error={windowError(g, j, true)}
              >
                <Input
                  id={`weekly-end-${index}-${j}`}
                  value={w.end}
                  maxLength={5}
                  placeholder="14:00"
                  aria-invalid={!!windowError(g, j, true)}
                  aria-describedby={
                    windowError(g, j, true)
                      ? `weekly-end-${index}-${j}-error`
                      : undefined
                  }
                  onChange={(e) =>
                    updateGroup(index, {
                      ...g,
                      windows: g.windows.map((v, i) =>
                        i === j ? { ...v, end: e.target.value } : v,
                      ),
                    })
                  }
                />
              </Field>
              <Button
                className="mt-6"
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
            size="sm"
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
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={days.length === 7}
          onClick={() =>
            setGroups((gs) => [
              ...gs,
              {
                days: DAYS.map((_, n) => n).filter((n) => !days.includes(n)),
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
            ])
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
      <Field
        label="Patient booking slot · minutes"
        id="weekly-slots"
        error={slotError}
        hint={
          draft
            ? "The original exact-time booking workflow is retained as a draft; saving needs backend support."
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
      <p className="text-xs text-muted-foreground">
        {draft
          ? "This draft has not been checked against published hours, existing bookings or blocks. Nothing is replaced or saved."
          : "This replaces published hours for this clinic and visit type during the dates above. Earlier dates and existing time blocks are kept."}
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Action variant="outline" disabled={!valid} run={preview}>
        Review weekly hours
      </Action>
      {current && (
        <div className="space-y-3">
          {current.affected_appointments.length ? (
            <>
              <Alert variant="destructive">
                <AlertDescription>
                  Move or delete these {current.affected_appointments.length}{" "}
                  appointments before saving. They fall outside the proposed
                  hours.
                </AlertDescription>
              </Alert>
              {current.affected_appointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 border-b pb-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateTime(a.starts_at)}–{dateTime(a.ends_at)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(a)}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm">
              Ready to save. No existing appointments fall outside these hours.
            </p>
          )}
          {!!current.other_published_hours.length && (
            <details className="rounded-md border p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Hours also offered at other clinics or for virtual visits
              </summary>
              <p className="mt-2">
                These published hours are kept. Every booking still checks the
                doctor's appointments across all clinics.
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
          <Action
            disabled={!valid || !current.can_save}
            run={async () => {
              try {
                await api("/api/v1/admin/schedule-timeline/weekly", {
                  method: "PUT",
                  body,
                });
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
      )}
      <Sheet
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
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
    </div>
  );
}

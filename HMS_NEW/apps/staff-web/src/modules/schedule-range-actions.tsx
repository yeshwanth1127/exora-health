import { OriginalResourceContext, isDraft } from "@/components/resource-source";
import { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { Plus, LockKeyhole, CalendarPlus } from "lucide-react";
import { dateTime, type Catalogue } from "@/lib/api";
import {
  Action,
  Choice,
  Field,
  useApi,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { clockLabel, minute, type Doctor } from "./clinic-types";
import type { DeskAppointment } from "./NurseDesk";
import { AppointmentActions } from "./appointment-actions";
import { requestLeave, useUnsaved, leaveState } from "@/hms/leave";
import { useLegacyCommand } from "@/hms/operational-command";
import { RecoveryNotice } from "@/hms/OperationalRecovery";

export type ScheduleRange = {
  doctor: Doctor;
  day: string;
  start: number;
  end: number;
  branch: string;
  mode?: string;
  slotMinutes?: number;
  overbook?: boolean;
};
const timeValue = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
type Context = {
  range: ScheduleRange;
  branch: string;
  mode: string;
  start: string;
  end: string;
  saved: () => void;
  allowed: Record<string, boolean>;
  valid: boolean;
  refresh: () => void;
  onTimeError: (error: string) => void;
  onSelectSlot: (startsAt: string, endsAt: string) => void;
};
const timestamp = (day: string, time: string) =>
  new Date(`${day}T${time}:00+05:30`).toISOString();

export function ScheduleRangeActions({
  range,
  catalogue,
  allowed,
  onClose,
  onSaved,
}: {
  range: ScheduleRange;
  catalogue: Catalogue;
  allowed: Record<string, boolean>;
  onClose: () => void;
  onSaved: (day?: string) => void;
}) {
  const source = useContext(OriginalResourceContext);
  const locked = useSyncExternalStore(
    leaveState.subscribe,
    leaveState.isBlocked,
  );
  const permissions = { can: (key: string) => !!allowed[key] };
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const [day, setDay] = useState(range.day);
  const [timeError, setTimeError] = useState("");
  const [start, setStart] = useState(timeValue(range.start)),
    [end, setEnd] = useState(timeValue(range.end)),
    [branch, setBranch] = useState(range.branch),
    [mode, setMode] = useState(range.mode ?? "in_person"),
    bookCapability = range.overbook
      ? "appointments.overbook"
      : "appointments.create",
    [action, setAction] = useState(() =>
      permissions.can(bookCapability)
        ? "book"
        : permissions.can("schedule.block")
          ? "block"
          : "open",
    );
  useUnsaved(
    day !== range.day ||
      start !== timeValue(range.start) ||
      end !== timeValue(range.end) ||
      branch !== range.branch ||
      mode !== (range.mode ?? "in_person"),
  );
  const branches = catalogue.branches.filter(
    (b) =>
      b.is_active &&
      (source
        ? range.doctor.branches.some((c) => c.id === b.id)
        : mode === "virtual"
          ? b.is_virtual && range.doctor.accepts_virtual
          : !b.is_virtual && range.doctor.branches.some((c) => c.id === b.id)),
  );
  const location = branches.find((b) => b.id === branch);
  const timeOK = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const dayOK =
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(new Date(`${day}T12:00:00+05:30`).getTime());
  const today = new Date(now + 330 * 60000).toISOString().slice(0, 10);
  const dateError = !dayOK
    ? "Choose an appointment date."
    : day < today
      ? "This date has passed. Choose today or a future date."
      : "";
  const startError = !timeOK(start)
    ? "Enter a start time in 24-hour format, for example 11:10."
    : dayOK &&
        !dateError &&
        new Date(`${day}T${start}:00+05:30`).getTime() <= now
      ? "This start time has already passed. Choose a later time or change the date."
      : "";
  const endError = !timeOK(end)
    ? "Enter an end time in 24-hour format, for example 17:40."
    : timeOK(start) && minute(end) <= minute(start)
      ? "End time must be after start time. Use 17:40 for 5:40 PM."
      : "";
  const clinicError = !location
    ? "Choose a clinic where this doctor offers this visit type."
    : "";
  const valid = !dateError && !startError && !endError && !clinicError;
  const context = {
    range: { ...range, day },
    branch,
    mode,
    start,
    end,
    allowed,
    valid,
    onTimeError: setTimeError,
    onSelectSlot: (begins: string, finishes: string) => {
      const localTime = (value: string) =>
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(value));
      setStart(localTime(begins));
      setEnd(localTime(finishes));
    },
    refresh: () => onSaved(),
    saved: () => {
      // The parent closes a confirmed save without treating its persisted draft as unsaved.
      onSaved(day);
    },
  };
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) requestLeave(onClose);
      }}
    >
      <SheetContent
        style={{ width: "min(100vw, 460px)", maxWidth: "100vw" }}
        className="overflow-y-auto"
      >
        <SheetHeader className="pr-10">
          <SheetTitle>Plan this time</SheetTitle>
          <SheetDescription>
            {range.doctor.name} ·{" "}
            {new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeZone: "Asia/Kolkata",
            }).format(
              new Date(`${dayOK ? day : range.day}T12:00:00+05:30`),
            )}{" "}
            · IST
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-5">
          <fieldset disabled={locked} className="space-y-5 min-w-0">
            {isDraft(source) && (
              <Alert>
                <AlertDescription>
                  Draft only. Open, block, exact-time booking and conflict
                  review need backend integration. No changes can be saved from
                  this sheet.
                </AlertDescription>
              </Alert>
            )}
            <Field label="Appointment date" id="range-date" error={dateError}>
              <Input
                id="range-date"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                onInput={(e) => setDay(e.currentTarget.value)}
                aria-invalid={!!dateError}
                aria-describedby={dateError ? "range-date-error" : undefined}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="From · IST (24-hour)"
                id="range-start"
                error={startError}
              >
                <Input
                  id="range-start"
                  type="text"
                  placeholder="HH:MM"
                  maxLength={5}
                  value={start}
                  aria-invalid={!!startError}
                  aria-describedby={
                    startError ? "range-start-error" : undefined
                  }
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field
                label="To · IST (24-hour)"
                id="range-end"
                error={
                  endError || (valid && action === "book" ? timeError : "")
                }
              >
                <Input
                  id="range-end"
                  type="text"
                  placeholder="HH:MM"
                  maxLength={5}
                  value={end}
                  aria-invalid={
                    !!endError || (valid && action === "book" && !!timeError)
                  }
                  aria-describedby={
                    endError || (valid && action === "book" && timeError)
                      ? "range-end-error"
                      : undefined
                  }
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Use any minute. 10:00 = 10 AM · 14:00 = 2 PM · 19:00 = 7 PM.
            </p>
            <Choice
              label="Visit type"
              value={mode}
              onChange={(v) => {
                requestLeave(() => {
                  setMode(v);
                  setBranch("");
                });
              }}
              options={[
                ["in_person", "In person"],
                ...(range.doctor.accepts_virtual
                  ? [["virtual", "Virtual"] as [string, string]]
                  : []),
              ]}
            />
            <Choice
              label="Clinic"
              error={clinicError}
              value={location?.id ?? ""}
              onChange={(value) => requestLeave(() => setBranch(value))}
              options={branches.map((b) => [b.id, b.name])}
            />
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-label="Time range action"
            >
              {[
                ["book", "Appointment", CalendarPlus, bookCapability],
                ["block", "Block time", LockKeyhole, "schedule.block"],
                ["open", "Open time", Plus, "schedules.manage"],
              ].map(([key, title, Icon, capability]) => {
                const Symbol = Icon as typeof Plus;
                return (
                  <Button
                    key={String(key)}
                    variant={action === key ? "default" : "outline"}
                    className="h-auto py-3 flex-col gap-2 text-xs"
                    aria-pressed={action === key}
                    disabled={!permissions.can(String(capability))}
                    onClick={() => {
                      if (action !== key)
                        requestLeave(() => setAction(String(key)));
                    }}
                  >
                    <Symbol className="size-4" />
                    {String(title)}
                  </Button>
                );
              })}
            </div>
          </fieldset>
          <div key={`${action}:${branch}:${mode}`}>
            {action === "book" && permissions.can(bookCapability) && (
              <BookRange {...context} />
            )}
            {action === "block" && permissions.can("schedule.block") && (
              <BlockRange {...context} />
            )}
            {action === "open" && permissions.can("schedules.manage") && (
              <OpenRange {...context} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BlockRange({
  range,
  branch,
  start,
  end,
  saved,
  allowed,
  refresh,
  valid,
}: Context) {
  const api = useApi();
  const command = useLegacyCommand();
  const locked = useSyncExternalStore(
    leaveState.subscribe,
    leaveState.isBlocked,
  );
  const [previewBusy, setPreviewBusy] = useState(false);
  const [editing, setEditing] = useState<DeskAppointment | null>(null);
  const [reason, setReason] = useState(""),
    [review, setReview] = useState<{
      signature: string;
      items: DeskAppointment[];
    } | null>(null);
  const body = {
    doctor_id: range.doctor.id,
    branch_id: branch,
    starts_at: valid ? timestamp(range.day, start) : "",
    ends_at: valid ? timestamp(range.day, end) : "",
    reason: reason.trim(),
  };
  const signature = JSON.stringify(body);
  const preview = review?.signature === signature ? review.items : null;
  const setPreview = (items: DeskAppointment[] | null) =>
    setReview(items ? { signature, items } : null);
  useUnsaved(!!reason.trim() || previewBusy, { pending: previewBusy });
  return (
    <div className="space-y-4">
      <RecoveryNotice command={command} onRecovered={saved} />
      <fieldset disabled={locked || previewBusy} className="space-y-4 min-w-0">
        <p className="text-sm text-muted-foreground">
          Move or delete every overlapping appointment before blocking this
          range. We check for new conflicts again when you save.
        </p>
        <Field
          label="Reason for blocking"
          id="range-reason"
          error={
            reason.trim().length < 2
              ? "Enter a block reason with at least 2 characters."
              : undefined
          }
        >
          <Input
            id="range-reason"
            value={reason}
            maxLength={240}
            onChange={(e) => {
              setReason(e.target.value);
              setPreview(null);
            }}
            placeholder="Break, leave or clinic meeting"
          />
        </Field>
        {preview === null ? (
          <Action
            disabled={!valid || reason.trim().length < 2}
            run={async () => {
              setPreviewBusy(true);
              try {
                const result = await api<{
                  affected_appointments: DeskAppointment[];
                }>("/api/v1/admin/schedule-exceptions/preview", {
                  method: "POST",
                  body,
                });
                setPreview(result.affected_appointments);
              } finally {
                setPreviewBusy(false);
              }
            }}
          >
            Review affected appointments
          </Action>
        ) : (
          <>
            <Alert>
              <AlertDescription>
                {preview.length
                  ? `${preview.length} ${preview.length === 1 ? "appointment overlaps" : "appointments overlap"} this range. Resolve each one before blocking.`
                  : "No existing appointments overlap this range."}
              </AlertDescription>
            </Alert>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {preview.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 border rounded-md p-3"
                >
                  <p className="text-sm">
                    {a.patient_name}
                    <span className="block text-xs text-muted-foreground mt-1">
                      {dateTime(a.starts_at)}
                    </span>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(a)}
                  >
                    Move / delete
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Review again
            </Button>
            <Action
              disabled={!valid || preview.length > 0}
              run={async () => {
                await command.write("/api/v1/admin/schedule-exceptions", {
                  method: "POST",
                  body: {
                    ...body,
                    acknowledged_appointments: [],
                  },
                });
                saved();
              }}
              success="Time blocked"
            >
              Block selected time
            </Action>
          </>
        )}
      </fieldset>
      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) requestLeave(() => setEditing(null));
        }}
      >
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.patient_name}</SheetTitle>
            <SheetDescription>
              {editing && dateTime(editing.starts_at)} · resolve this visit
              before blocking
            </SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="px-4">
              <AppointmentActions
                key={editing.id}
                item={editing}
                allowed={allowed}
                onSaved={() => {
                  setEditing(null);
                  setPreview(null);
                  refresh();
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OpenRange({ range, branch, mode, start, end, saved, valid }: Context) {
  const command = useLegacyCommand();
  const [minutes, setMinutes] = useState(range.slotMinutes ?? 30);
  useUnsaved(minutes !== (range.slotMinutes ?? 30));
  return (
    <div className="space-y-4">
      <RecoveryNotice command={command} onRecovered={saved} />
      <fieldset
        disabled={command.busy || command.unknown}
        className="space-y-4 min-w-0"
      >
        <p className="text-sm text-muted-foreground">
          Open or extend hours for this date only. Already-open hours are kept;
          only missing ranges are added. Use Unblock to reopen an existing
          block.
        </p>
        <Choice
          label="Standard patient slot length"
          value={String(minutes)}
          onChange={(v) => setMinutes(Number(v))}
          options={[10, 15, 20, 30, 45, 60].map((n) => [
            String(n),
            `${n} minutes`,
          ])}
        />
        <p className="text-sm tabular-nums">
          {clockLabel(start)}–{clockLabel(end)} · staff can use exact minutes
        </p>
        <Action
          disabled={!valid}
          run={async () => {
            if (!valid) return;
            await command.write("/api/v1/admin/schedule-timeline/open", {
              method: "POST",
              body: {
                doctor_id: range.doctor.id,
                branch_id: branch,
                consultation_type: mode,
                schedule_date: range.day,
                effective_from: range.day,
                effective_until: range.day,
                starts_at_local: start,
                ends_at_local: end,
                slot_minutes: minutes,
              },
            });
            saved();
          }}
          success="Hours opened for the selected date"
        >
          Open selected time
        </Action>
      </fieldset>
    </div>
  );
}

function BookRange({
  range,
  branch,
  mode,
  start,
  end,
  saved,
  valid,
  onTimeError,
  onSelectSlot,
  allowed,
}: Context) {
  const command = useLegacyCommand();
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [reason, setReason] = useState(""),
    [overbookReason, setOverbookReason] = useState(""),
    [error, setError] = useState<{ key: string; message: string } | null>(null);
  const draftKey = JSON.stringify([
    range.doctor.id,
    range.day,
    branch,
    mode,
    start,
    end,
    name,
    phone,
    reason,
    overbookReason,
  ]);
  const visibleError = error?.key === draftKey ? error.message : "";
  useUnsaved(
    !!name.trim() || !!phone || !!reason.trim() || !!overbookReason.trim(),
  );
  const startsAt = valid ? timestamp(range.day, start) : "",
    endsAt = valid ? timestamp(range.day, end) : "";
  const check = useResource<{
    overlapping_bookings: number;
    overbook_required?: boolean;
    range_unsupported?: boolean;
    overbooking_slots?: { starts_at: string; ends_at: string }[];
  }>(
    valid
      ? "/api/v1/admin/schedule-timeline/check?" +
          new URLSearchParams({
            doctor_id: range.doctor.id,
            branch_id: branch,
            consultation_type: mode,
            starts_at: startsAt,
            ends_at: endsAt,
          })
      : null,
  );
  useEffect(() => {
    onTimeError(valid && !check.loading && check.error ? check.error : "");
  }, [valid, check.loading, check.error, onTimeError]);
  const overbook =
    !!check.fresh &&
    !!check.data?.overbook_required &&
    !!allowed["appointments.overbook"];
  const compactPhone = phone.replace(/[\s()-]/g, ""),
    normalizedPhone = /^\d{10}$/.test(compactPhone)
      ? "+91" + compactPhone
      : compactPhone;
  const validPhone = /^\+[1-9][0-9]{6,14}$/.test(normalizedPhone);
  return (
    <div className="space-y-4">
      <RecoveryNotice command={command} onRecovered={saved} />
      <fieldset
        disabled={command.busy || command.unknown}
        className="space-y-4 min-w-0"
      >
        {valid && check.loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Checking this time…
          </p>
        ) : valid && check.error ? (
          <Button variant="outline" size="sm" onClick={check.refresh}>
            Check again
          </Button>
        ) : valid && check.fresh && check.data ? (
          <p className="text-sm text-muted-foreground">
            {range.overbook && !check.data.overlapping_bookings
              ? "This time is free now. Use Book appointment instead."
              : check.data.range_unsupported
                ? "Overbooking supports one whole published booked slot. Choose a slot below to replace the selected range explicitly."
                : overbook
                  ? "This published slot is booked. This will add an extra appointment for the full slot and requires a reason."
                  : check.data.overlapping_bookings
                    ? "This range is occupied. Choose an available range."
                    : "This time is available. We check it again when you save."}
          </p>
        ) : null}
        {check.fresh && check.data?.range_unsupported && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Your chosen {start}–{end} range is unchanged. Available published
              overbooking slots:
            </p>
            {check.data.overbooking_slots?.map((slot) => (
              <Button
                key={slot.starts_at}
                variant="outline"
                size="sm"
                onClick={() => onSelectSlot(slot.starts_at, slot.ends_at)}
              >
                Select {dateTime(slot.starts_at)} to{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  timeZone: "Asia/Kolkata",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(slot.ends_at))}
              </Button>
            ))}
          </div>
        )}
        <Field
          label="Patient name"
          id="timeline-patient"
          error={
            name.trim().length < 2
              ? "Enter a patient name with at least 2 characters."
              : undefined
          }
        >
          <Input
            id="timeline-patient"
            aria-invalid={name.trim().length < 2}
            aria-describedby={
              name.trim().length < 2 ? "timeline-patient-error" : undefined
            }
            autoComplete="off"
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Patient phone"
          id="timeline-phone"
          error={
            !validPhone
              ? "Enter a 10-digit Indian phone number, or + followed by country code and number."
              : undefined
          }
          hint="Enter a 10-digit Indian number, or include + and the country code for another country."
        >
          <Input
            id="timeline-phone"
            aria-invalid={!validPhone}
            aria-describedby={!validPhone ? "timeline-phone-error" : undefined}
            type="tel"
            placeholder="9876543210 or +919876543210"
            maxLength={24}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Visit reason · optional" id="timeline-visit-reason">
          <Textarea
            id="timeline-visit-reason"
            maxLength={800}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {overbook && (
          <Field
            label="Reason for the extra appointment"
            id="timeline-overbook-reason"
            error={
              overbookReason.trim().length < 3
                ? "Enter a reason with at least 3 characters."
                : undefined
            }
            hint="At most 3 extra appointments per doctor session. The reason is recorded with the booking."
          >
            <Textarea
              id="timeline-overbook-reason"
              aria-invalid={overbookReason.trim().length < 3}
              maxLength={500}
              value={overbookReason}
              onChange={(e) => setOverbookReason(e.target.value)}
            />
          </Field>
        )}
        {visibleError && (
          <Alert variant="destructive">
            <AlertDescription>{visibleError}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          Consultation fee:{" "}
          {range.doctor.consultation_fee === null
            ? "Not provided"
            : `₹${range.doctor.consultation_fee}`}
          . No WhatsApp message is sent by this action.
        </p>
        <Action
          disabled={
            !valid ||
            check.loading ||
            !!check.error ||
            !check.data ||
            !check.fresh ||
            name.trim().length < 2 ||
            !validPhone ||
            !!check.data.range_unsupported ||
            (!!check.data.overlapping_bookings && !overbook) ||
            (overbook && overbookReason.trim().length < 3)
          }
          run={async () => {
            const body = {
              doctor_id: range.doctor.id,
              branch_id: branch,
              consultation_type: mode,
              starts_at: startsAt,
              ends_at: endsAt,
              patient_name: name.trim(),
              patient_phone: normalizedPhone,
              reason: reason.trim() || null,
              ...(overbook
                ? { overbook: true, overbook_reason: overbookReason.trim() }
                : {}),
            };
            try {
              await command.write(
                "/api/v1/admin/schedule-timeline/appointments",
                {
                  method: "POST",
                  body,
                },
              );
              saved();
            } catch (e) {
              setError({
                key: draftKey,
                message:
                  e instanceof Error
                    ? e.message
                    : "Could not book this appointment.",
              });
              check.refresh();
              throw e;
            }
          }}
          success="Appointment booked"
        >
          {overbook ? "Add extra appointment" : "Book appointment"}
        </Action>
      </fieldset>
    </div>
  );
}

import { useLegacyCommand } from "@/hms/operational-command";
import { RecoveryNotice } from "@/hms/OperationalRecovery";
import { useUnsaved, requestLeave } from "@/hms/leave";
import type { MutationIntent } from "@/hms/operational-intent";
import { useEffect, useState } from "react";
import { bookingPhone } from "@/lib/phone";
import { api, istDateTime, type Catalogue } from "@/lib/api";
import {
  Action,
  Choice,
  Field,
  Resource,
  usePermissions,
  useResource,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppointmentActions } from "./appointment-actions";
import type { DeskAppointment } from "./NurseDesk";
type Doctor = { id: string; name: string };
type Block = {
  id: string;
  doctor_id: string;
  branch_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string;
};
type Slot = { starts_at: string; ends_at: string };
type Wait = {
  id: string;
  patient_name: string;
  phone: string;
  doctor_id: string;
  doctor_name?: string | null;
  branch_id: string;
  consultation_type: string;
  start_date: string;
  end_date: string;
  status: string;
  notes?: string | null;
  booked_by?: DeskAppointment["booked_by"];
  booking_party_id?: string;
  patient_id?: string | null;
  offer?: {
    id: string;
    starts_at: string;
    ends_at: string;
    expires_at: string;
  } | null;
};
const time = (s: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
const ist = (s: string) => {
  const value = new Date(s + ":00+05:30");
  return Number.isFinite(value.getTime()) ? value.toISOString() : "";
};
export function ScheduleBlocks() {
  const permissions = usePermissions();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const r = useResource<Block[]>("/api/v1/admin/schedule-exceptions"),
    d = useResource<Doctor[]>("/api/v1/admin/doctors"),
    c = useResource<Catalogue>("/api/v1/admin/catalogue");
  const [open, setOpen] = useState(false),
    [doctor, setDoctor] = useState(""),
    [branch, setBranch] = useState("all"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState<DeskAppointment[] | null>(null),
    [remove, setRemove] = useState<Block | null>(null),
    canBlock = permissions.can("schedule.block");
  const startError = !ist(start)
    ? "Choose the start date and time."
    : new Date(ist(start)).getTime() <= now
      ? "Choose a start time in the future."
      : "";
  const endError = !ist(end)
    ? "Choose the end date and time."
    : start >= end
      ? "End must be after start."
      : "";
  const body = {
    doctor_id: doctor,
    branch_id: branch === "all" ? null : branch,
    starts_at: ist(start),
    ends_at: ist(end),
    reason,
  };
  function change(set: (v: string) => void, v: string) {
    set(v);
    setPreview(null);
  }
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Doctor leave and blocked time</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          disabled={!canBlock}
          onClick={() => {
            setOpen(true);
            setPreview(null);
          }}
        >
          Block unavailable time
        </Button>
        <Resource {...r}>
          {r.data?.length ? (
            r.data.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap justify-between gap-3 border-t pt-4"
              >
                <div>
                  <p className="font-medium">
                    {d.data?.find((a) => a.id === b.doctor_id)?.name} ·{" "}
                    {b.reason}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {time(b.starts_at)} – {time(b.ends_at)} ·{" "}
                    {b.branch_id
                      ? c.data?.branches.find((a) => a.id === b.branch_id)?.name
                      : "All clinics"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={!canBlock}
                  onClick={() => setRemove(b)}
                >
                  Unblock
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No blocked time.</p>
          )}
        </Resource>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block unavailable time</DialogTitle>
            <DialogDescription>
              Times entered here are India Standard Time. Check affected visits
              before saving. No patient notification is sent by this action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Choice
              label="Doctor"
              error={
                !doctor
                  ? "Select a doctor before reviewing this block."
                  : undefined
              }
              value={doctor}
              onChange={(v) => change(setDoctor, v)}
              options={(d.data ?? []).map((a) => [a.id, a.name])}
            />
            <Choice
              label="Clinic"
              value={branch}
              onChange={(v) => change(setBranch, v)}
              options={[
                ["all", "All clinics"],
                ...(c.data?.branches ?? []).map(
                  (a) => [a.id, a.name] as [string, string],
                ),
              ]}
            />
            <Field label="From · IST" id="block-from" error={startError}>
              <Input
                id="block-from"
                type="datetime-local"
                value={start}
                onChange={(e) => change(setStart, e.target.value)}
                onInput={(e) => change(setStart, e.currentTarget.value)}
              />
            </Field>
            <Field label="To · IST" id="block-to" error={endError}>
              <Input
                id="block-to"
                type="datetime-local"
                value={end}
                onChange={(e) => change(setEnd, e.target.value)}
                onInput={(e) => change(setEnd, e.currentTarget.value)}
              />
            </Field>
            <Field
              label="Reason"
              id="block-reason"
              error={
                reason.trim().length < 2
                  ? "Enter a block reason with at least 2 characters."
                  : undefined
              }
            >
              <Input
                id="block-reason"
                value={reason}
                onChange={(e) => change(setReason, e.target.value)}
              />
            </Field>
            <Action
              disabled={
                !doctor ||
                !!startError ||
                !!endError ||
                reason.trim().length < 2
              }
              run={async () =>
                setPreview(
                  (
                    await api<{ affected_appointments: DeskAppointment[] }>(
                      "/api/v1/admin/schedule-exceptions/preview",
                      { method: "POST", body },
                    )
                  ).affected_appointments,
                )
              }
              success="Affected visits reviewed"
            >
              Check affected visits
            </Action>
            {preview && (
              <>
                <Alert>
                  <AlertDescription>
                    {preview.length
                      ? `Move or delete all ${preview.length} overlapping appointments before blocking this time.`
                      : "No appointments overlap this time. We check again when you save."}
                  </AlertDescription>
                </Alert>
                <div className="max-h-40 overflow-auto space-y-2">
                  {preview.map((a) => (
                    <div key={a.id} className="space-y-2 border-b pb-2">
                      <p className="text-sm">
                        {a.patient_name} · {time(a.starts_at)} ·{" "}
                        {a.confirmation_code}
                      </p>
                      <AppointmentActions
                        item={a}
                        allowed={permissions.data?.allowed ?? {}}
                        onSaved={() => {
                          setPreview(null);
                          r.refresh();
                        }}
                      />
                    </div>
                  ))}
                </div>
                <Action
                  disabled={preview.length > 0}
                  run={async () => {
                    await api("/api/v1/admin/schedule-exceptions", {
                      method: "POST",
                      body: {
                        ...body,
                        acknowledged_appointments: [],
                      },
                    });
                    setOpen(false);
                    r.refresh();
                  }}
                  success="Unavailable time blocked"
                >
                  Block this time
                </Action>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(v) => {
          if (!v) setRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this block?</DialogTitle>
            <DialogDescription>
              This can make unoccupied times bookable again. It does not change
              appointments.
            </DialogDescription>
          </DialogHeader>
          <Action
            run={async () => {
              await api("/api/v1/admin/schedule-exceptions/" + remove!.id, {
                method: "DELETE",
              });
              setRemove(null);
              r.refresh();
            }}
            success="Time unblocked"
          >
            Unblock time
          </Action>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
export function RescheduleVisit({
  item,
  onSaved,
}: {
  item: DeskAppointment;
  onSaved: (item: DeskAppointment) => void;
}) {
  const [open, setOpen] = useState(false),
    [date, setDate] = useState(""),
    [slots, setSlots] = useState<Slot[]>([]),
    [chosen, setChosen] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setChosen("");
    setSlots([]);
    if (!open || !date || !item.doctor || !item.branch) return;
    api<{ slots: Slot[] }>(
      "/api/v1/availability?" +
        new URLSearchParams({
          doctor_id: item.doctor.id,
          branch_id: item.branch.id,
          start_date: date,
          end_date: date,
          consultation_type: item.consultation_type,
        }),
    )
      .then((r) => {
        if (live) setSlots(r.slots);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [open, date, item]);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Reschedule visit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agree a replacement time</DialogTitle>
            <DialogDescription>
              Same doctor, clinic and fee. The old time remains booked until
              this change commits. An outbox event is not proof of patient
              notification.
            </DialogDescription>
          </DialogHeader>
          <Field
            label="Date"
            id="move-date"
            error={!date ? "Choose a replacement date." : undefined}
          >
            <Input
              id="move-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Choice
            label="Available replacement"
            error={
              !chosen
                ? date && !slots.length
                  ? "No available times on this date. Choose another date."
                  : "Choose an available replacement time."
                : undefined
            }
            value={chosen}
            onChange={setChosen}
            options={slots.map((s) => [s.starts_at, time(s.starts_at)])}
          />
          <Field
            label="Agreement / reason"
            id="move-reason"
            error={
              reason.trim().length < 2
                ? "Enter a reason with at least 2 characters."
                : undefined
            }
          >
            <Input
              id="move-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Action
            disabled={!chosen || reason.trim().length < 2}
            run={async () => {
              const slot = slots.find((s) => s.starts_at === chosen)!;
              const result = await api<DeskAppointment>(
                "/api/v1/admin/appointments/" + item.id + "/reschedule",
                {
                  method: "POST",
                  body: {
                    ...slot,
                    reason,
                    idempotency_key: crypto.randomUUID(),
                  },
                },
              );
              onSaved(result);
              setOpen(false);
            }}
            success="Visit rescheduled"
          >
            Confirm agreed replacement
          </Action>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function WaitlistDesk() {
  const permissions = usePermissions(),
    command = useLegacyCommand(),
    call = command.write,
    canBook = permissions.can("appointments.book"),
    canCancel = permissions.can("appointments.cancel");
  const [status, setStatus] = useState("active"),
    [doctorFilter, setDoctorFilter] = useState("all");
  const r = useResource<Wait[]>(
      "/api/v1/admin/waitlist?" +
        new URLSearchParams({
          status,
          doctor_id: doctorFilter === "all" ? "" : doctorFilter,
        }),
    ),
    d = useResource<Doctor[]>("/api/v1/admin/doctors");
  const [item, setItem] = useState<Wait | null>(null),
    [date, setDate] = useState(""),
    [chosen, setChosen] = useState(""),
    [adding, setAdding] = useState(false),
    [preference, setPreference] = useState("dates"),
    [form, setForm] = useState({
      name: "",
      phone: "",
      doctor: "",
      from: "",
      to: "",
      notes: "",
    }),
    [withdraw, setWithdraw] = useState<Wait | null>(null),
    [reason, setReason] = useState(""),
    [today] = useState(() => istDateTime(new Date()).slice(0, 10));
  const sixtyDaysFromToday = new Date(
    Date.parse(today + "T00:00:00Z") + 60 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const rangeTooLong =
    !!form.from &&
    !!form.to &&
    Date.parse(form.to) - Date.parse(form.from) > 60 * 86400000;
  const normalizedPhone = bookingPhone(form.phone);
  const phoneError =
    form.phone && !normalizedPhone
      ? "Enter a 10-digit Indian mobile number, or include + and the country code."
      : undefined;
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useUnsaved(
    command.busy ||
      command.unknown ||
      (adding &&
        (!!form.name ||
          !!form.phone ||
          !!form.doctor ||
          !!form.notes ||
          preference !== "dates" ||
          form.from !== today ||
          form.to !== today)) ||
      (!!item && !!chosen) ||
      (!!withdraw && !!reason),
  );
  const close = (action: () => void) => {
    if (!command.busy && !command.unknown) requestLeave(action);
  };
  const recovered = () => {
    setAdding(false);
    setItem(null);
    setWithdraw(null);
    r.refresh();
  };
  const verify = async (intent: MutationIntent) => {
    // A status from the request list cannot attribute an uncertain command to us.
    // Decline/accept/withdraw use the frozen original key for safe replay instead.
    if (intent.path.includes("/waitlist-offers/")) {
      const offerId = intent.path.split("/").at(-2);
      const outcome = await command.read<{ outcome: string }>(`/api/v1/admin/waitlist-offers/${offerId}`);
      if (outcome.outcome === "expired") throw new Error("This offer expired. Its expiry does not confirm your answer. Retry the original request to check its saved receipt.");
    }
    return false;
  };
  const offerDateValid =
    !!item &&
    !!date &&
    date >= today &&
    date >= item.start_date &&
    date <= item.end_date;
  const available = useResource<{ slots: Slot[] }>(
    offerDateValid && item
      ? "/api/v1/availability?" +
          new URLSearchParams({
            doctor_id: item.doctor_id,
            branch_id: item.branch_id,
            start_date: date,
            end_date: date,
            consultation_type: item.consultation_type,
          })
      : null,
  );
  const slots = available.data?.slots ?? [],
    set = (k: keyof typeof form) => (v: string) =>
      setForm((f) => ({ ...f, [k]: v }));
  const answer = (w: Wait, outcome: "accept" | "decline") => {
    return call(
      "/api/v1/admin/waitlist-offers/" + w.offer!.id + "/" + outcome,
      {
        method: "POST",
      },
    ).then(r.refresh);
  };
  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Cancellation waitlist</CardTitle>
        </div>
        {canBook && (
          <Button
            onClick={() => {
              setForm({
                name: "",
                phone: "",
                doctor: "",
                from: today,
                to: today,
                notes: "",
              });
              setPreference("dates");
              setAdding(true);
            }}
          >
            Add request
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <RecoveryNotice
          command={command}
          verify={
            command.intent?.path.endsWith("/decline") ? undefined : verify
          }
          onRecovered={recovered}
        />
        {command.error && !command.unknown && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {command.error}
          </p>
        )}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Choice
            label="Status"
            value={status}
            disabled={command.busy || command.unknown}
            onChange={setStatus}
            options={[
              ["active", "Waiting or offered"],
              ["accepted", "Accepted"],
              ["withdrawn", "Withdrawn"],
            ]}
          />
          <Choice
            label="Doctor"
            value={doctorFilter}
            disabled={command.busy || command.unknown}
            onChange={setDoctorFilter}
            options={[
              ["all", "All doctors"],
              ...(d.data ?? []).map((a): [string, string] => [a.id, a.name]),
            ]}
          />
        </div>
        <Resource {...r}>
          {r.data?.length ? (
            r.data.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap justify-between gap-3 border-t py-4"
              >
                <div>
                  <p className="font-medium">
                    {w.booked_by && !w.booked_by.patient_linked
                      ? `Booked by ${w.booked_by.name}`
                      : w.patient_name}{" "}
                    · {w.status}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {w.phone} ·{" "}
                    {w.doctor_name ??
                      d.data?.find((a) => a.id === w.doctor_id)?.name}{" "}
                    · {w.start_date} – {w.end_date}
                  </p>
                  {w.notes && (
                    <p className="text-sm text-muted-foreground">{w.notes}</p>
                  )}
                  {w.offer && (
                    <p className="text-sm">
                      Offered {time(w.offer.starts_at)} · held until{" "}
                      {time(w.offer.expires_at)}
                      {Date.parse(w.offer.expires_at) <= clockNow
                        ? " · expired"
                        : ` · ${Math.ceil((Date.parse(w.offer.expires_at) - clockNow) / 60000)} min remaining`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {w.status === "waiting" && canBook && (
                    <Button
                      variant="outline"
                      disabled={command.busy || command.unknown}
                      onClick={() => {
                        setItem(w);
                        setDate(w.start_date < today ? today : w.start_date);
                        setChosen("");
                      }}
                    >
                      Prepare slot offer
                    </Button>
                  )}
                  {w.status === "offered" && w.offer && canBook && (
                    <>
                      <Action
                        disabled={
                          command.busy ||
                          command.unknown ||
                          Date.parse(w.offer!.expires_at) <= clockNow
                        }
                        run={() => answer(w, "accept")}
                        success="Appointment booked"
                      >
                        Accept offer
                      </Action>
                      <Action
                        variant="outline"
                        disabled={
                          command.busy ||
                          command.unknown ||
                          Date.parse(w.offer!.expires_at) <= clockNow
                        }
                        run={() => answer(w, "decline")}
                        success="Slot released; request is waiting again"
                      >
                        Decline offer
                      </Action>
                    </>
                  )}
                  {w.offer && Date.parse(w.offer.expires_at) <= clockNow && (
                    <Button variant="outline" onClick={r.refresh}>
                      Find another time
                    </Button>
                  )}
                  {(w.status === "waiting" || w.status === "offered") &&
                    canCancel && (
                      <Button
                        variant="ghost"
                        disabled={command.busy || command.unknown}
                        onClick={() => {
                          setWithdraw(w);
                          setReason("");
                        }}
                      >
                        Withdraw
                      </Button>
                    )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No waitlist requests.
            </p>
          )}
        </Resource>
      </CardContent>
      <Dialog
        open={!!item}
        onOpenChange={(v) => {
          if (!v) close(() => setItem(null));
        }}
      >
        <DialogContent>
          <RecoveryNotice
            command={command}
            verify={
              command.intent?.path.endsWith("/decline") ? undefined : verify
            }
            onRecovered={recovered}
          />
          <fieldset
            disabled={command.busy || command.unknown}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Prepare an expiring offer</DialogTitle>
              <DialogDescription>
                Saving holds a real slot for 15 minutes. Phone the caller, then
                record whether they accepted or declined. Unanswered offers
                lapse and the request waits again.
              </DialogDescription>
            </DialogHeader>
            <Field
              label="Doctor"
              id="offer-doctor"
              hint="This request is for the doctor selected when it was added."
            >
              <Input
                id="offer-doctor"
                readOnly
                value={
                  item?.doctor_name ??
                  d.data?.find((doctor) => doctor.id === item?.doctor_id)
                    ?.name ??
                  "Doctor unavailable"
                }
              />
            </Field>
            <Field
              label="Preferred date"
              id="offer-date"
              error={
                !date
                  ? "Choose a date within the patient’s requested range."
                  : !offerDateValid
                    ? "Choose a date within the requested range, from today onward."
                    : undefined
              }
            >
              <Input
                id="offer-date"
                type="date"
                value={date}
                min={item && item.start_date < today ? today : item?.start_date}
                max={item?.end_date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setChosen("");
                }}
              />
            </Field>
            {available.error && (
              <Alert variant="destructive">
                <AlertDescription>{available.error}</AlertDescription>
              </Alert>
            )}
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">
                Available times · India Standard Time
              </legend>
              {["Morning", "Afternoon", "Evening"].map((period) => {
                const matching = slots.filter((slot) => {
                  const hour = Number(
                    new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      hourCycle: "h23",
                    }).format(new Date(slot.starts_at)),
                  );
                  return (
                    (hour < 12
                      ? "Morning"
                      : hour < 17
                        ? "Afternoon"
                        : "Evening") === period
                  );
                });
                return (
                  matching.length > 0 && (
                    <div key={period}>
                      <p className="mb-2 text-xs text-muted-foreground">
                        {period}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {matching.map((slot) => (
                          <Button
                            key={slot.starts_at}
                            variant={
                              chosen === slot.starts_at ? "default" : "outline"
                            }
                            aria-pressed={chosen === slot.starts_at}
                            onClick={() => setChosen(slot.starts_at)}
                          >
                            {new Intl.DateTimeFormat("en-IN", {
                              timeZone: "Asia/Kolkata",
                              timeStyle: "short",
                            }).format(new Date(slot.starts_at))}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )
                );
              })}
              {available.loading && (
                <p className="text-sm text-muted-foreground">
                  Checking available times…
                </p>
              )}
              {date &&
                available.fresh &&
                !available.loading &&
                !slots.length && (
                  <p className="text-sm text-muted-foreground">
                    No available times on this date. Choose another date.
                  </p>
                )}
            </fieldset>
            {chosen && slots.some((slot) => slot.starts_at === chosen) && (
              <p className="text-sm">
                Offer {time(chosen)} to{" "}
                {item?.booked_by?.name ?? item?.patient_name}.
              </p>
            )}
            <Action
              disabled={
                !offerDateValid ||
                !available.fresh ||
                !chosen ||
                !slots.some((slot) => slot.starts_at === chosen)
              }
              run={async () => {
                await call("/api/v1/admin/waitlist/" + item!.id + "/offer", {
                  method: "POST",
                  body: {
                    ...slots.find((s) => s.starts_at === chosen),
                  },
                });
                setItem(null);
                r.refresh();
              }}
              success="Offer saved for 15 minutes; phone the caller now"
            >
              Save expiring offer
            </Action>
          </fieldset>
        </DialogContent>
      </Dialog>
      <Dialog
        open={adding}
        onOpenChange={(open) =>
          open ? setAdding(true) : close(() => setAdding(false))
        }
      >
        <DialogContent>
          <RecoveryNotice
            command={command}
            verify={
              command.intent?.path.endsWith("/decline") ? undefined : verify
            }
            onRecovered={recovered}
          />
          <fieldset
            disabled={command.busy || command.unknown}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Add to the waitlist</DialogTitle>
              <DialogDescription>
                Record who to call when a slot opens with this doctor. Requests
                cover up to 60 days.
              </DialogDescription>
            </DialogHeader>
            <Field
              label="Name"
              id="wait-name"
              required
              error={
                !form.name.trim()
                  ? "Enter the name of the person to contact."
                  : undefined
              }
            >
              <Input
                id="wait-name"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
              />
            </Field>
            <Field
              label="Mobile number"
              id="wait-phone"
              hint="10 digits or +country code"
              required
              error={!form.phone ? "Enter a mobile number." : phoneError}
            >
              <Input
                id="wait-phone"
                type="tel"
                required
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value.trim())}
              />
            </Field>
            <Choice
              label="Doctor"
              value={form.doctor}
              onChange={set("doctor")}
              error={!form.doctor ? "Choose a doctor." : undefined}
              options={(d.data ?? []).map((a) => [a.id, a.name])}
            />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Preferred availability
              </legend>
              <div className="flex gap-5">
                {[
                  ["dates", "Specific dates"],
                  ["anytime", "Any time in next 60 days"],
                ].map(([value, name]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="wait-preference"
                      checked={preference === value}
                      onChange={() => {
                        setPreference(value);
                        if (value === "anytime")
                          setForm((current) => ({
                            ...current,
                            from: today,
                            to: sixtyDaysFromToday,
                          }));
                      }}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
            {preference === "anytime" && (
              <p className="text-sm text-muted-foreground">
                Any available time with this doctor, from {today} through{" "}
                {sixtyDaysFromToday}. This request ends on that date.
              </p>
            )}
            {preference === "dates" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" id="wait-from">
                  <Input
                    id="wait-from"
                    type="date"
                    required
                    min={today}
                    value={form.from}
                    onChange={(e) => set("from")(e.target.value)}
                  />
                </Field>
                <Field
                  label="To"
                  id="wait-to"
                  error={
                    form.to && form.to < form.from
                      ? "Must be on or after the start."
                      : rangeTooLong
                        ? "Choose a range of up to 60 days."
                        : undefined
                  }
                >
                  <Input
                    id="wait-to"
                    type="date"
                    required
                    min={form.from || today}
                    value={form.to}
                    onChange={(e) => set("to")(e.target.value)}
                  />
                </Field>
              </div>
            )}
            <Field label="Notes (optional)" id="wait-notes">
              <Input
                id="wait-notes"
                maxLength={500}
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
              />
            </Field>
            <Action
              disabled={
                !form.name.trim() ||
                !normalizedPhone ||
                !form.doctor ||
                !form.from ||
                !form.to ||
                form.to < form.from ||
                form.from < today ||
                rangeTooLong
              }
              run={async () => {
                if (!normalizedPhone)
                  throw new Error("Check the mobile number before saving.");
                const body = {
                  patient_name: form.name.trim(),
                  phone: normalizedPhone,
                  doctor_id: form.doctor,
                  start_date: form.from,
                  end_date: form.to,
                  notes: form.notes.trim(),
                };
                await call("/api/v1/admin/waitlist", {
                  method: "POST",
                  body: {
                    ...body,
                  },
                });
                setAdding(false);
                r.refresh();
              }}
              success="Added to the waitlist"
            >
              Add request
            </Action>
          </fieldset>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!withdraw}
        onOpenChange={(v) => {
          if (!v) close(() => setWithdraw(null));
        }}
      >
        <DialogContent>
          <RecoveryNotice
            command={command}
            verify={
              command.intent?.path.endsWith("/decline") ? undefined : verify
            }
            onRecovered={recovered}
          />
          <fieldset
            disabled={command.busy || command.unknown}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Withdraw this request</DialogTitle>
              <DialogDescription>
                Any slot held for it is released. This is recorded with your
                reason.
              </DialogDescription>
            </DialogHeader>
            <Field
              label="Reason"
              id="wait-reason"
              error={
                reason.trim().length < 3 ? "Give a short reason." : undefined
              }
            >
              <Input
                id="wait-reason"
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Action
              variant="destructive"
              disabled={reason.trim().length < 3}
              run={async () => {
                await call(
                  "/api/v1/admin/waitlist/" + withdraw!.id + "/withdraw",
                  {
                    method: "POST",
                    body: { reason: reason.trim() },
                  },
                );
                setWithdraw(null);
                r.refresh();
              }}
              success="Request withdrawn"
            >
              Withdraw request
            </Action>
          </fieldset>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query, request } from "./client";
import { today, time, money } from "./model";
import { useUnsaved } from "./leave";
import { PatientLookup, RegisterPatient } from "./Patients";
import { Choice, Empty, ErrorMessage, Field, Hint, LoadingState } from "./ui";
import type { Appointment, BookingResult, Hold, Patient, Slot } from "./types";

export function Booking({
  onBooked,
  move,
}: {
  onBooked: (id: string) => void;
  move?: Appointment;
}) {
  const { facility, practitioners, can } = useWorkspace(),
    cmd = useCommand();
  const bookable = practitioners.filter((p) => p.calendarId);
  const [chosen, setStaffId] = useState(move?.practitionerStaffId ?? ""),
    [date, setDate] = useState(move?.sessionOn ?? today(facility.timezone));
  // The doctor list loads after the sheet can open, so the first bookable doctor is the default once known.
  const staffId = chosen || bookable[0]?.staffId || "";
  const [patient, setPatient] = useState<Patient | null>(null),
    [register, setRegister] = useState(false),
    // A phone caller can be booked before they are registered; the desk links the patient at check-in.
    [caller, setCaller] = useState(false),
    [callerName, setCallerName] = useState(""),
    [callerPhone, setCallerPhone] = useState(""),
    [hold, setHold] = useState<Hold | null>(null),
    [reason, setReason] = useState("");
  const callerReady = caller && callerName.trim().length > 0 && /^\+[1-9][0-9]{7,14}$/.test(callerPhone);
  const who = !!move || !!patient || callerReady;
  const [clock, setClock] = useState(() => Date.now()),
    [result, setResult] = useState<BookingResult | null>(null);
  useUnsaved(cmd.unknown);
  const activeHold = useRef<Hold | null>(null);
  const slots = useQuery<{ items: Slot[] }>(
    staffId
      ? `/v1/practitioners/${staffId}/slots?${query({ facilityId: facility.facilityId, from: date, to: date })}`
      : null,
  );
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      const current = activeHold.current;
      if (current)
        void request(`/v1/holds/${current.reservationId}`, {
          method: "DELETE",
        }).catch(() => {});
    };
  }, []);
  const seconds = hold
    ? Math.max(0, Math.floor((Date.parse(hold.holdExpiresAt) - clock) / 1000))
    : 0;
  async function release() {
    if (hold) {
      await request(`/v1/holds/${hold.reservationId}`, {
        method: "DELETE",
      }).catch(() => {});
      activeHold.current = null;
      setHold(null);
      slots.refresh();
    }
  }
  if (result)
    return (
      <div className="space-y-5">
        <Badge variant="secondary">
          {move ? "Appointment moved" : "Appointment confirmed"}
        </Badge>
        <h3 className="text-xl font-semibold">{result.confirmationCode}</h3>
        <p className="text-sm">Booked fee: {money(result.feeMinor)}</p>
        <Hint>
          Contact the patient to confirm the change. Automatic notifications are
          not available.
        </Hint>
        <Button onClick={() => onBooked(result.appointmentId)}>
          View appointment
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      {move ? (
        <Hint>
          Moving creates a new appointment and keeps the cancelled original in
          history.
        </Hint>
      ) : patient ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{patient.name}</p>
            <p className="text-xs text-muted-foreground">{patient.mrn}</p>
          </div>
          <Button
            variant="ghost"
            disabled={cmd.busy || !!hold}
            onClick={() => setPatient(null)}
          >
            Change patient
          </Button>
        </div>
      ) : caller ? (
        <div className="space-y-3 border rounded-lg p-4">
          <p className="text-sm font-medium">Caller (not registered yet)</p>
          <Field title="Caller's name" id="caller-name">
            <Input id="caller-name" value={callerName} maxLength={100} disabled={!!hold || cmd.busy} onChange={(e) => setCallerName(e.target.value)} />
          </Field>
          <Field title="Caller's phone (with country code)" id="caller-phone">
            <Input id="caller-phone" type="tel" placeholder="+919876543210" value={callerPhone} disabled={!!hold || cmd.busy} onChange={(e) => setCallerPhone(e.target.value.trim())} />
          </Field>
          <p className="text-xs text-muted-foreground">
            The patient is registered and linked when they arrive, before check-in.
          </p>
          <Button variant="ghost" disabled={!!hold || cmd.busy} onClick={() => setCaller(false)}>
            Find a registered patient instead
          </Button>
        </div>
      ) : (
        <>
          <PatientLookup onSelect={setPatient} />
          <div className="flex flex-wrap gap-2">
            {can("patients.register") && (
              <Button variant="ghost" onClick={() => setRegister((v) => !v)}>
                {register ? "Back to search" : "Register a new patient"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setCaller(true)}>
              Book for a caller who isn't registered
            </Button>
          </div>
          {register && (
            <RegisterPatient
              onCreated={(p) => {
                setPatient(p);
                setRegister(false);
              }}
            />
          )}
        </>
      )}
      <Field title="Doctor" id="booking-doctor">
        <Choice
          label="Doctor"
          value={staffId}
          onChange={setStaffId}
          disabled={!!hold || cmd.busy}
          options={bookable.map((p) => ({ value: p.staffId, label: p.name }))}
        />
      </Field>
      {!bookable.length && (
        <Hint>
          No doctor here has a calendar yet. Set one up on the Doctors page, then give them weekly hours in
          Schedules.
        </Hint>
      )}
      <Field title="Date" id="booking-date">
        <Input
          id="booking-date"
          type="date"
          min={today(facility.timezone)}
          value={date}
          disabled={!!hold || cmd.busy}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      {hold ? (
        <div className="space-y-3 border rounded-lg p-4">
          <p className="font-medium">
            {time(hold.slotStart, facility.timezone)} –{" "}
            {time(hold.slotEnd, facility.timezone)}
          </p>
          <p role="status" className="text-sm">
            {seconds
              ? `Held for ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} more`
              : "Hold expired. Choose a slot again."}
          </p>
          <Button
            variant="outline"
            disabled={cmd.busy}
            onClick={() => void release()}
          >
            Choose another slot
          </Button>
        </div>
      ) : (
        <LoadingState {...slots}>
          <div className="grid grid-cols-3 gap-2">
            {slots.data?.items
              .filter((s) => s.status === "free")
              .map((s) => (
                <Button
                  key={s.slotStart}
                  variant="outline"
                  disabled={cmd.busy || !who}
                  className="h-auto py-3 flex-col"
                  onClick={async () => {
                    const value = await cmd.run<Hold>(
                      "/v1/holds",
                      { staffId, slotStart: s.slotStart },
                      true,
                    );
                    if (value) {
                      setHold(value);
                      activeHold.current = value;
                    }
                  }}
                >
                  <span>{time(s.slotStart, facility.timezone)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.visitMode === "virtual" ? "Video" : "In person"}
                  </span>
                </Button>
              ))}
          </div>
          {slots.data?.items.filter((s) => s.status === "free").length ===
            0 && (
            <Empty>
              No bookable slots on this day. Try another date, or check the doctor's weekly hours in Schedules.
            </Empty>
          )}
        </LoadingState>
      )}
      <Field
        title={move ? "Reason for move (optional)" : "Visit reason (optional)"}
        id="booking-reason"
      >
        <Textarea
          id="booking-reason"
          maxLength={500}
          value={reason}
          disabled={cmd.busy}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        The booked fee is confirmed when the appointment is saved. A fee quote
        is not available yet.
      </p>
      <ErrorMessage text={cmd.error} />
      <Button
        disabled={cmd.busy || !hold || seconds === 0 || !who}
        onClick={async () => {
          if (!hold) return;
          const path = move
            ? `/v1/appointments/${move.appointmentId}/reschedule`
            : "/v1/appointments";
          const body = move
            ? {
                newReservationId: hold.reservationId,
                ...(reason ? { reason } : {}),
              }
            : {
                reservationId: hold.reservationId,
                ...(patient
                  ? { patientId: patient.patientId }
                  : { bookingParty: { name: callerName.trim(), phone: callerPhone } }),
                originChannel: "front_desk",
                ...(reason ? { reason } : {}),
              };
          const value = await cmd.run<BookingResult>(path, body, true);
          if (value) {
            activeHold.current = null;
            setHold(null);
            setResult(value);
          }
        }}
      >
        {cmd.busy ? "Saving…" : move ? "Confirm move" : "Confirm appointment"}
      </Button>
    </div>
  );
}

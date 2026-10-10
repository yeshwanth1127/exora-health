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
  const [staffId, setStaffId] = useState(
      move?.practitionerStaffId ?? practitioners[0]?.staffId ?? "",
    ),
    [date, setDate] = useState(move?.sessionOn ?? today(facility.timezone));
  const [patient, setPatient] = useState<Patient | null>(null),
    [register, setRegister] = useState(false),
    [hold, setHold] = useState<Hold | null>(null),
    [reason, setReason] = useState("");
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
      ) : (
        <>
          <PatientLookup onSelect={setPatient} />
          {can("patients.register") && (
            <Button variant="ghost" onClick={() => setRegister((v) => !v)}>
              {register ? "Back to search" : "Register a new patient"}
            </Button>
          )}
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
          options={practitioners
            .filter((p) => p.calendarId)
            .map((p) => ({ value: p.staffId, label: p.name }))}
        />
      </Field>
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
                  disabled={cmd.busy || (!move && !patient)}
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
            0 && <Empty>No bookable slots on this day.</Empty>}
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
        disabled={cmd.busy || !hold || seconds === 0 || (!move && !patient)}
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
                patientId: patient!.patientId,
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

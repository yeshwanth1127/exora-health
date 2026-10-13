import { ArrowRight } from "lucide-react";
import {
  activeAppointments,
  appointmentModeLabel,
  type AppointmentMode,
} from "./booking-workflow";
import { dailyAvailability, monthRange } from "./availability-calendar";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { ExistingAppointments } from "./PatientVisits";
import { usePatientAppointments } from "./patient-visits-hooks";
import { patientDisplayName } from "./patient-presentation";
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
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { Choice, ErrorMessage, Field, Hint, LoadingState } from "./ui";
import type {
  Appointment,
  BookingResult,
  Hold,
  Patient,
  PatientDetail,
  Slot,
} from "./types";

export function Booking({
  onBooked,
  move,
}: {
  onBooked: (id: string) => void;
  move?: Appointment;
}) {
  const { facility, practitioners, can, go } = useWorkspace(),
    cmd = useCommand();
  const [step, setStep] = useState(move ? 2 : 1);
  const [visitMode, setVisitMode] = useState<AppointmentMode>(() =>
    (move?.visitMode ?? new URLSearchParams(location.search).get("mode")) ===
    "virtual"
      ? "virtual"
      : "in_person",
  );
  const [acknowledged, setAcknowledged] = useState("");
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
  const initialPatientId = new URLSearchParams(location.search).get("patient");
  const initialPatient = useQuery<PatientDetail>(
    initialPatientId && !move && can("patients.read")
      ? `/v1/patients/${initialPatientId}`
      : null,
  );
  useEffect(() => {
    const p = initialPatient.data;
    if (p?.status === "active")
      setPatient({
        patientId: p.patientId,
        mrn: p.mrn,
        name: `${p.givenName} ${p.familyName ?? ""}`.trim(),
        phone: p.contacts.find((c) => c.kind === "phone")?.value ?? null,
        birthDate: p.birthDate,
        sex: p.sex,
        status: p.status,
      });
  }, [initialPatient.data]);
  const existing = usePatientAppointments(
    move?.patientId ?? patient?.patientId,
  );
  const duplicates = activeAppointments(
    existing.data ?? [],
    move?.appointmentId,
  );
  const duplicateKey = JSON.stringify([
    patient?.patientId,
    duplicates.map((a) => a.appointmentId),
  ]);
  const duplicateReady =
    !!move || !duplicates.length || acknowledged === duplicateKey;
  const checkReady =
    !existing.enabled ||
    (!existing.loading && !existing.error && existing.data !== null);
  const callerReady =
    caller &&
    callerName.trim().length > 0 &&
    /^\+[1-9][0-9]{7,14}$/.test(callerPhone);
  const who = !!move || !!patient || callerReady;
  const clinicToday = today(facility.timezone);
  const [clock, setClock] = useState(() => Date.now()),
    [result, setResult] = useState<BookingResult | null>(null),
    [releasing, setReleasing] = useState(false);
  useUnsaved(
    releasing ||
      (!result &&
        (cmd.unknown ||
          !!hold ||
          !!patient ||
          !!callerName.trim() ||
          !!callerPhone ||
          !!reason.trim() ||
          !!chosen ||
          date !== (move?.sessionOn ?? clinicToday) ||
          visitMode !== (move?.visitMode ?? "in_person"))),
    { pending: releasing || cmd.busy || cmd.unknown },
  );
  const activeHold = useRef<Hold | null>(null);
  const range = monthRange(date.slice(0, 7), clinicToday);
  const slots = useQuery<{ items: Slot[] }>(
    staffId && step === 2 && range.from <= range.to
      ? `/v1/practitioners/${staffId}/slots?${query({ facilityId: facility.facilityId, ...range, includeUnavailable: true })}`
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
  const availability = dailyAvailability(
    slots.data?.items ?? [],
    visitMode,
    facility.facilityId,
    facility.timezone,
    clock,
  );
  const availableSlots = availability.get(date)?.available ?? [];
  const seconds = hold
    ? Math.max(0, Math.floor((Date.parse(hold.holdExpiresAt) - clock) / 1000))
    : 0;
  async function release() {
    const current = activeHold.current;
    if (!current) return;
    // Claim cleanup before awaiting so unmount cannot release the same hold twice.
    activeHold.current = null;
    setReleasing(true);
    try {
      await request(`/v1/holds/${current.reservationId}`, {
        method: "DELETE",
      }).catch(() => {});
      setHold(null);
      slots.refresh();
    } finally {
      setReleasing(false);
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
      <ol
        className="grid grid-cols-3 gap-3 border-b pb-5 text-sm"
        aria-label="Booking steps"
      >
        {["Patient", "Doctor & time", "Review & confirm"].map((title, i) => (
          <li key={title} aria-current={step === i + 1 ? "step" : undefined}>
            <span
              className={
                step === i + 1
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {i + 1}. {title}
            </span>
          </li>
        ))}
      </ol>
      <div className={`${step === 2 ? "max-w-6xl" : "max-w-3xl"} space-y-6`}>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Appointment type</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["in_person", "virtual"] as const).map((mode) => (
              <Button
                key={mode}
                variant={visitMode === mode ? "default" : "outline"}

                aria-pressed={visitMode === mode}
                disabled={!!hold || cmd.busy || cmd.unknown}
                onClick={() => setVisitMode(mode)}
              >
                {appointmentModeLabel(mode)}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {visitMode === "virtual"
              ? "Choose a published teleconsultation slot. The saved appointment creates the video consultation."
              : "The patient visits the clinic in person."}
            {hold &&
              " Release the selected slot before changing appointment type."}
          </p>
        </section>
        {existing.loading && (
          <p className="text-sm text-muted-foreground">
            Checking this patient’s existing appointments…
          </p>
        )}
        {existing.error && (
          <div className="space-y-2">
            <ErrorMessage text="Could not check existing appointments. Retry before confirming." />
            <Button variant="outline" onClick={() => void existing.refresh()}>
              Retry appointment check
            </Button>
          </div>
        )}
        <ExistingAppointments items={duplicates} warning />
        <ErrorMessage text={initialPatient.error} />
        {step === 1 && (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold">Choose the patient</h2>
            <p className="text-sm text-muted-foreground">
              Search for a returning patient, register a new patient, or record
              a booking contact to link at arrival.
            </p>
            {move ? (
              <Hint>
                Moving creates a new appointment and keeps the cancelled
                original in history.
              </Hint>
            ) : patient ? (
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="font-medium">
                    {patientDisplayName(patient.patientId, patient.name)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    MRN {patient.mrn}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={cmd.busy || !!hold}
                  onClick={() => setPatient(null)}
                >
                  Change patient
                </Button>
              </div>
            ) : caller ? (
              <div className="space-y-3 border rounded-lg p-4">
                <p className="text-sm font-medium">
                  Booking contact (patient not registered yet)
                </p>
                <Field title="Name" id="caller-name">
                  <Input
                    id="caller-name"
                    value={callerName}
                    maxLength={100}
                    disabled={!!hold || cmd.busy}
                    onChange={(e) => setCallerName(e.target.value)}
                  />
                </Field>
                <Field
                  title="Caller's phone (with country code)"
                  id="caller-phone"
                >
                  <Input
                    id="caller-phone"
                    type="tel"
                    placeholder="+919876543210"
                    value={callerPhone}
                    disabled={!!hold || cmd.busy}
                    onChange={(e) => setCallerPhone(e.target.value.trim())}
                  />
                </Field>
                <p className="text-sm text-muted-foreground">
                  The patient is registered and linked when they arrive, before
                  check-in.
                </p>
                <Button
                  variant="ghost"
                  disabled={!!hold || cmd.busy}
                  onClick={() => setCaller(false)}
                >
                  Find a registered patient instead
                </Button>
              </div>
            ) : (
              <>
                <PatientLookup onSelect={setPatient} />
                <div className="flex flex-wrap gap-2">
                  {can("patients.register") && (
                    <Button
                      variant="outline"
                      onClick={() => setRegister((v) => !v)}
                    >
                      {register ? "Back to search" : "Register a new patient"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setCaller(true)}>
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
            <div className="flex items-center justify-between gap-4 border-t pt-5">
              <p className="font-medium">
                {who
                  ? "Patient selected. Choose a doctor and time next."
                  : "Select a patient or enter the booking contact to continue."}
              </p>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={!who || cmd.busy}
                onClick={() => setStep(2)}
              >
                Continue to doctor & time <ArrowRight className="size-5" />
              </Button>
            </div>
          </section>
        )}
        {step === 2 && (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold">
              Choose a doctor and available time
            </h2>
            <Field title="Doctor" id="booking-doctor">
              <Choice
                label="Doctor"
                value={staffId}
                onChange={setStaffId}
                disabled={!!hold || cmd.busy}
                options={bookable.map((p) => ({
                  value: p.staffId,
                  label: p.name,
                }))}
              />
            </Field>
            {!bookable.length && (
              <Hint>
                No doctor here has a calendar yet. Set one up on the Doctors
                page, then give them weekly hours in Schedules.
              </Hint>
            )}
            <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(260px,1fr)] items-start gap-6">
              <AvailabilityCalendar
                date={date}
                today={clinicToday}
                mode={visitMode}
                days={availability}
                loading={slots.loading}
                failed={!!slots.error}
                disabled={!staffId || !!hold || cmd.busy || cmd.unknown}
                onSelect={setDate}
              />
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="font-semibold">
                    {appointmentModeLabel(visitMode)} times
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "full",
                      timeZone: "UTC",
                    }).format(new Date(`${date}T12:00:00Z`))}{" "}
                    · {facility.timezone}
                  </p>
                </div>
                <ErrorMessage text={cmd.error} />
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
                      disabled={releasing || cmd.busy || cmd.unknown}
                      onClick={() => void release()}
                    >
                      Choose another slot
                    </Button>
                  </div>
                ) : (
                  <LoadingState {...slots}>
                    <div className="grid grid-cols-2 gap-2">
                      {availableSlots.map((s) => (
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
                          <span className="text-sm text-muted-foreground">
                            {appointmentModeLabel(s.visitMode)}
                          </span>
                        </Button>
                      ))}
                    </div>
                    {availableSlots.length === 0 && (
                      <WorkspaceEmpty
                        title={`No open ${appointmentModeLabel(visitMode).toLowerCase()} times on ${date}`}
                        description={
                          availability.get(date)?.published
                            ? "Published times are booked, held or blocked. Choose another day marked with open times; this doctor does not need setup repeated."
                            : "No upcoming bookable slots were returned for this date and visit type. Choose another day or review the doctor's published hours."
                        }
                      />
                    )}
                  </LoadingState>
                )}
                {slots.error && (
                  <Button
                    variant="outline"
                    onClick={() => void slots.refresh()}
                  >
                    Retry availability
                  </Button>
                )}
                {visitMode === "virtual" && !hold && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      {bookable.find((p) => p.staffId === staffId)
                        ?.acceptsVirtual
                        ? "Teleconsultation availability comes from this doctor’s published weekly hours."
                        : "Teleconsultations are not enabled on this doctor’s booking profile. Enable them and publish weekly hours before booking."}
                    </p>
                    {can("schedules.manage") ? (
                      <Button
                        variant="outline"
                        disabled={!staffId || cmd.busy || cmd.unknown}
                        onClick={() =>
                          go(`schedules?doctor=${staffId}&mode=virtual`)
                        }
                      >
                        Set teleconsultation hours
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Ask the clinic administrator to publish teleconsultation
                        hours.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-5">
              <div className="flex items-center gap-3">
                {!move && (
                  <Button
                    variant="outline"
                    disabled={cmd.busy || cmd.unknown}
                    onClick={async () => {
                      await release();
                      setStep(1);
                    }}
                  >
                    Back to patient
                  </Button>
                )}
              </div>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={!hold || seconds === 0 || cmd.busy}
                onClick={() => setStep(3)}
              >
                Review appointment <ArrowRight className="size-5" />
              </Button>
            </div>
          </section>
        )}
        {step === 3 && (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold">Review before confirming</h2>
            <div className="rounded-lg border p-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Patient / booking contact
                </p>
                <p className="font-medium">
                  {patientDisplayName(
                    move?.patientId ?? patient?.patientId,
                    move?.patientName ?? patient?.name ?? callerName,
                  )}
                </p>
                <p className="text-sm">{patient?.mrn ?? callerPhone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Doctor</p>
                <p className="font-medium">
                  {bookable.find((p) => p.staffId === staffId)?.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date & time</p>
                <p>
                  {date} · {hold && time(hold.slotStart, facility.timezone)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Appointment type
                </p>
                <p>{appointmentModeLabel(visitMode)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Slot hold</p>
                <p role="status">
                  {seconds
                    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} remaining`
                    : "Expired. Return to choose a time."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              disabled={cmd.busy || cmd.unknown}
              onClick={() => setStep(2)}
            >
              Change doctor or time
            </Button>
            <Field
              title={
                move ? "Reason for move (optional)" : "Visit reason (optional)"
              }
              id="booking-reason"
            >
              <Textarea
                id="booking-reason"
                maxLength={500}
                value={reason}
                disabled={cmd.busy || cmd.unknown}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <p className="text-sm text-muted-foreground">
              The booked fee is confirmed when the appointment is saved. A fee
              quote is not available yet.
            </p>
            {!move && duplicates.length > 0 && (
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={acknowledged === duplicateKey}
                  disabled={cmd.busy || cmd.unknown}
                  onChange={(e) =>
                    setAcknowledged(e.target.checked ? duplicateKey : "")
                  }
                />
                Create an additional appointment. I reviewed the existing
                booking; this is not a replacement.
              </label>
            )}
            <ErrorMessage text={cmd.error} />
            <div className="flex items-center justify-between gap-4 border-t pt-5">
              <p className="font-medium">
                Confirm these details to save the appointment.
              </p>
              <Button
                disabled={
                  cmd.busy ||
                  !hold ||
                  seconds === 0 ||
                  !who ||
                  (!cmd.unknown && (!checkReady || !duplicateReady))
                }
                onClick={async () => {
                  if (!hold) return;
                  if (!cmd.unknown && existing.enabled) {
                    const checked = await existing.refresh();
                    if (!checked) return;
                    const currentDuplicates = activeAppointments(
                      checked,
                      move?.appointmentId,
                    );
                    const currentKey = JSON.stringify([
                      patient?.patientId,
                      currentDuplicates.map((a) => a.appointmentId),
                    ]);
                    if (
                      !move &&
                      currentDuplicates.length &&
                      acknowledged !== currentKey
                    )
                      return;
                  }
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
                          : {
                              bookingParty: {
                                name: callerName.trim(),
                                phone: callerPhone,
                              },
                            }),
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
                {cmd.busy
                  ? "Saving…"
                  : cmd.unknown
                    ? "Recover appointment request"
                    : move
                      ? "Confirm move"
                      : "Confirm appointment"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

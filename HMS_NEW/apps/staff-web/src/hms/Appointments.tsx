import { useTodayVisits } from "./patient-visits-hooks";
import { patientDisplayName } from "./patient-presentation";
import { useEffect, useState } from "react";
import { CalendarPlus, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageTitle } from "@/components/workspace";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { today, time, money, label, filterLoadedAppointments } from "./model";
import {
  Choice,
  Empty,
  ErrorMessage,
  Field,
  Hint,
  LoadingState,
  Status,
} from "./ui";
import { PatientLookup, RegisterPatient, TestPatientBadge } from "./Patients";
import { FullPage } from "./FullPage";
import { Booking } from "./Booking";
import { AppointmentMessages } from "./AppointmentMessages";
import { MessagingContacts } from "./MessagingContacts";
import type { Appointment, Patient, PatientDetail } from "./types";

export function Appointments() {
  const { facility, practitioners, can } = useWorkspace();
  const [date, setDate] = useState(today(facility.timezone)),
    [staffId, setStaffId] = useState("all"),
    [status, setStatus] = useState("all"),
    [mode, setMode] = useState("all"),
    [text, setText] = useState(""),
    [search, setSearch] = useState(""),
    // Cursors of the pages before the current one; the last entry is the current page's cursor.
    [pages, setPages] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(() =>
      new URLSearchParams(location.search).get("appointment"),
    ),
    [book, setBook] = useState(
      () => new URLSearchParams(location.search).get("book") === "1",
    );
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const filters = JSON.stringify([date, staffId, status, search]);
  const [pagedFor, setPagedFor] = useState(filters);
  if (pagedFor !== filters) {
    setPagedFor(filters);
    setPages([]);
  }
  const result = useQuery<{ items: Appointment[]; nextCursor: string | null }>(
    `/v1/appointments?${query({ facilityId: facility.facilityId, from: date, to: date, staffId: staffId === "all" ? undefined : staffId, status: status === "all" ? undefined : status, q: search.length >= 2 ? search : undefined, cursor: pages.at(-1), limit: 100 })}`,
    10000,
  );
  const items = filterLoadedAppointments(
    result.data?.items ?? [],
    "",
    mode === "all" ? "" : mode,
  );
  if (book)
    return (
      <FullPage
        title="Book appointment"
        description="Choose the patient, select a time, then review and confirm."
        back="Back to appointments"
        onBack={() => setBook(false)}
      >
        <Booking
          onBooked={(id) => {
            setBook(false);
            setSelected(id);
            result.refresh();
          }}
        />
      </FullPage>
    );
  if (selected)
    return (
      <FullPage
        title="Appointment"
        description="Manage the booking and arrival. Clinical notes are recorded in the consultation."
        back="Back to appointments"
        onBack={() => setSelected(null)}
      >
        <AppointmentDetails
          key={selected}
          id={selected}
          onChanged={result.refresh}
          onMoved={(id) => {
            setSelected(id);
            result.refresh();
          }}
        />
      </FullPage>
    );
  return (
    <>
      <PageTitle
        title="Appointments"
        description="Bookings, arrivals and follow-up for your clinic."
        action={
          can("appointments.book") ? (
            <Button onClick={() => setBook(true)}>
              <CalendarPlus />
              Book appointment
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium">Date</p>
              <Input
                type="date"
                aria-label="Appointment date"
                className="w-40"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="w-48 space-y-2">
              <p className="text-xs font-medium">Doctor</p>
              <Choice
                label="Doctor filter"
                value={staffId}
                onChange={setStaffId}
                options={[
                  { value: "all", label: "All doctors" },
                  ...practitioners.map((p) => ({
                    value: p.staffId,
                    label: p.name,
                  })),
                ]}
              />
            </div>
            <div className="w-40 space-y-2">
              <p className="text-xs font-medium">Booking status</p>
              <Choice
                label="Status filter"
                value={status}
                onChange={setStatus}
                options={[
                  "all",
                  "confirmed",
                  "checked_in",
                  "completed",
                  "cancelled",
                  "no_show",
                ].map((v) => ({
                  value: v,
                  label: v === "all" ? "All statuses" : label(v),
                }))}
              />
            </div>
            <div className="w-36 space-y-2">
              <p className="text-xs font-medium">Visit type</p>
              <Choice
                label="Visit mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "all", label: "All visits" },
                  { value: "in_person", label: "In person" },
                  { value: "virtual", label: "Video" },
                ]}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh appointments"
              onClick={result.refresh}
            >
              <RefreshCw />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              aria-label="Search appointments"
              placeholder="Search name, phone, MRN or confirmation code"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Searches this day on the server (at least 2 characters). 100
            appointments per page.
          </p>
        </CardContent>
        <LoadingState {...result}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.appointmentId}>
                  <TableCell>
                    <div className="font-medium">
                      {patientDisplayName(a.patientId, a.patientName)}{" "}
                      {a.patientId && (
                        <TestPatientBadge patientId={a.patientId} />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.mrn ?? `Booked by ${a.bookingPartyName ?? "caller"}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    {time(a.startsAt, facility.timezone)}
                    <div className="text-xs text-muted-foreground">
                      {a.visitMode === "virtual" ? "Video" : "In person"}
                      {a.tokenNo ? ` · Token ${a.tokenNo}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>{a.practitionerName}</TableCell>
                  <TableCell>
                    <Status value={a.status} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {label(a.originChannel)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      onClick={() => setSelected(a.appointmentId)}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {items.length === 0 && (
            <Empty>No matching appointments for this day.</Empty>
          )}
          {(pages.length > 0 || result.data?.nextCursor) && (
            <div className="flex justify-end gap-2 p-3">
              <Button
                variant="outline"
                disabled={!pages.length}
                onClick={() => setPages((p) => p.slice(0, -1))}
              >
                Previous page
              </Button>
              <Button
                variant="outline"
                disabled={!result.data?.nextCursor}
                onClick={() =>
                  setPages((p) => [...p, result.data!.nextCursor!])
                }
              >
                Next page
              </Button>
            </div>
          )}
          {result.data?.items.length === 500 && (
            <div className="p-4">
              <Hint>
                This result reached the 500-record limit. Narrow the filters;
                additional records may exist.
              </Hint>
            </div>
          )}
        </LoadingState>
      </Card>
    </>
  );
}
function AppointmentDetails({
  id,
  onChanged,
  onMoved,
}: {
  id: string;
  onChanged: () => void;
  onMoved: (id: string) => void;
}) {
  const { facility, can, go } = useWorkspace(),
    cmd = useCommand();
  const result = useQuery<Appointment>(`/v1/appointments/${id}`, 10000);
  const [patient, setPatient] = useState<Patient | null>(null),
    [register, setRegister] = useState(false),
    [move, setMove] = useState(false),
    [action, setAction] = useState(""),
    [reason, setReason] = useState(""),
    [notice, setNotice] = useState("");
  const a = result.data;
  const visit = useQuery<{ encounterId: string; status: string }>(
    a &&
      ["checked_in", "completed"].includes(a.status) &&
      can("encounters.read")
      ? `/v1/appointments/${id}/encounter`
      : null,
    5000,
  );
  const todayVisits = useTodayVisits(a?.patientId);
  const completedUnbooked = todayVisits.items.some(
    (v) =>
      v.status === "finished" &&
      !v.appointmentId &&
      v.attendingStaffId === a?.practitionerStaffId,
  );
  async function changed() {
    result.refresh();
    onChanged();
    setAction("");
    setReason("");
    setNotice(
      "Appointment updated. Contact the patient to confirm the change.",
    );
  }
  return (
    <div className="max-w-5xl space-y-6">
      <LoadingState {...result}>
        {a && (
          <>
            <div className="flex justify-between gap-6 items-start">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">
                  {patientDisplayName(a.patientId, a.patientName)}{" "}
                  {a.patientId && <TestPatientBadge patientId={a.patientId} />}
                </h2>
                <p className="text-sm text-muted-foreground">
                  MRN {a.mrn ?? "Not linked"} · Booking {a.confirmationCode}
                </p>
                {a.patientId && can("patients.read") && (
                  <Button
                    variant="link"
                    className="px-0"
                    onClick={() => go(`patients?patient=${a.patientId}`)}
                  >
                    Patient details & medical history →
                  </Button>
                )}
              </div>
              {visit.data && can("clinical.read") && (
                <Button
                  onClick={() =>
                    go(`consultations?encounter=${visit.data!.encounterId}`)
                  }
                >
                  {a.status === "completed" || visit.data.status === "finished"
                    ? "View this visit’s summary"
                    : "Continue consultation"}
                </Button>
              )}
            </div>
            <div className="rounded-lg border p-5 space-y-3">
              <Status value={a.status} />
              <p className="text-sm">
                {a.status === "confirmed"
                  ? a.sessionOn > today(facility.timezone)
                    ? `Scheduled for ${a.sessionOn}. Check-in is available on that date. To see the patient earlier, move this appointment to today through the front desk.`
                    : a.sessionOn < today(facility.timezone)
                      ? "The appointment date has passed. Check-in is unavailable; ask the front desk to review this booking."
                      : a.visitMode === "virtual"
                        ? "This is a teleconsultation. Open Teleconsultations to manage patient identity, consent and joining the visit."
                        : "Check in the patient when they arrive. Then open the linked consultation."
                  : a.status === "checked_in"
                    ? visit.data?.status === "finished"
                      ? "The clinical visit is completed. The appointment status is waiting for processing."
                      : "Patient checked in. The doctor records notes and completes this visit in Consultations."
                    : a.status === "completed"
                      ? "This appointment is complete. View this visit’s summary for its notes and outcome."
                      : "This booking is closed. Its details are kept for reference."}
              </p>
              {a.status === "confirmed" && completedUnbooked && (
                <Hint>
                  A separate unbooked visit was completed today. This
                  appointment is still scheduled; that visit did not complete
                  this booking. Review whether this booking is still needed.
                </Hint>
              )}
              {a.status === "confirmed" &&
                a.visitMode === "virtual" &&
                can("teleconsult.read") && (
                  <Button
                    variant="outline"
                    onClick={() => go("teleconsultations")}
                  >
                    Open teleconsultations
                  </Button>
                )}
              {a.status === "checked_in" &&
                !visit.data &&
                can("encounters.read") && (
                  <p className="text-sm text-muted-foreground">
                    {visit.failure?.status === 404
                      ? "The clinical visit is being prepared. Refresh shortly."
                      : visit.error || "Loading clinical visit…"}
                  </p>
                )}
              {a.status === "completed" && visit.error && (
                <ErrorMessage text="This visit summary could not be opened. Check your clinical access or retry." />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Doctor</p>
                {a.practitionerName}
              </div>
              <div>
                <p className="text-muted-foreground">Visit</p>
                {a.sessionOn} · {time(a.startsAt, facility.timezone)}
              </div>
              <div>
                <p className="text-muted-foreground">Booked fee</p>
                {money(a.feeMinor)}
              </div>
              <div>
                <p className="text-muted-foreground">Booking party</p>
                {a.bookingPartyName ?? "Not recorded"}
                <br />
                {a.bookingPartyPhone}
              </div>
            </div>
            {a.patientId && <PatientContact id={a.patientId} />}
            <p className="text-sm">
              Visit reason: {a.reason ?? "Not recorded"}
            </p>
            {a.rescheduledFromId && (
              <p className="text-xs text-muted-foreground">
                Moved from appointment {a.rescheduledFromId}
              </p>
            )}
            {a.cancelReason && (
              <p className="text-sm">Cancellation reason: {a.cancelReason}</p>
            )}
            {notice && <Hint>{notice}</Hint>}
            {can("comms.read") && (
              <AppointmentMessages
                key={a.appointmentId}
                appointmentId={a.appointmentId}
              />
            )}
            {can("comms.read") &&
              (a.patientId ? (
                <MessagingContacts
                  key={`patient:${a.patientId}`}
                  patientId={a.patientId}
                />
              ) : a.bookingPartyId ? (
                <MessagingContacts
                  key={`caller:${a.bookingPartyId}`}
                  bookingPartyId={a.bookingPartyId}
                />
              ) : null)}
            {move ? (
              <Booking key={a.appointmentId} move={a} onBooked={onMoved} />
            ) : (
              <>
                {a.status === "confirmed" &&
                  can("appointments.check_in") &&
                  a.sessionOn === today(facility.timezone) && (
                    <div className="space-y-4">
                      {!a.patientId && (
                        <>
                          <h3 className="font-semibold">
                            Link the arriving patient
                          </h3>
                          {patient ? (
                            <p>
                              {patient.name} · {patient.mrn}
                              <Button
                                variant="ghost"
                                disabled={cmd.busy}
                                onClick={() => setPatient(null)}
                              >
                                Change
                              </Button>
                            </p>
                          ) : (
                            <PatientLookup onSelect={setPatient} />
                          )}
                          {can("patients.register") && !patient && (
                            <Button
                              variant="ghost"
                              onClick={() => setRegister((v) => !v)}
                            >
                              Register patient
                            </Button>
                          )}
                          {register && !patient && (
                            <RegisterPatient
                              onCreated={(p) => {
                                setPatient(p);
                                setRegister(false);
                              }}
                            />
                          )}
                        </>
                      )}
                      <Button
                        disabled={cmd.busy || (!a.patientId && !patient)}
                        onClick={async () => {
                          const value = await cmd.run<{ tokenNo: number }>(
                            `/v1/appointments/${id}/check-in`,
                            patient ? { patientId: patient.patientId } : {},
                            true,
                          );
                          if (value) {
                            await changed();
                            setNotice(
                              `Checked in${value.tokenNo ? ` · Token ${value.tokenNo}` : ""}. The consultation appears after the worker opens the encounter.`,
                            );
                          }
                        }}
                      >
                        Check in patient
                      </Button>
                    </div>
                  )}
                {a.status === "checked_in" && can("encounters.read") && (
                  <Button variant="outline" onClick={() => go("consultations")}>
                    Open consultation worklist
                  </Button>
                )}
                {a.status === "confirmed" && (
                  <div className="flex flex-wrap gap-2">
                    {can("appointments.reschedule") && (
                      <Button variant="outline" onClick={() => setMove(true)}>
                        Move appointment
                      </Button>
                    )}
                    {can("appointments.cancel") && (
                      <Button
                        variant="outline"
                        onClick={() => setAction("cancel")}
                      >
                        Cancel appointment
                      </Button>
                    )}
                    {can("appointments.check_in") && (
                      <Button
                        variant="outline"
                        onClick={() => setAction("no-show")}
                      >
                        Mark no-show
                      </Button>
                    )}
                  </div>
                )}
                {action && (
                  <form
                    className="space-y-3 border rounded-lg p-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const value = await cmd.run<Record<string, unknown>>(
                        `/v1/appointments/${id}/${action}`,
                        action === "cancel"
                          ? { reason: reason.trim() }
                          : undefined,
                      );
                      if (value) await changed();
                    }}
                  >
                    <Field
                      title={
                        action === "cancel"
                          ? "Cancellation reason"
                          : "Confirm no-show"
                      }
                      id="cancel-reason"
                    >
                      {action === "cancel" ? (
                        <Textarea
                          id="cancel-reason"
                          required
                          value={reason}
                          maxLength={500}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      ) : (
                        <p className="text-sm">
                          This marks the patient as not attended. The service
                          enforces its no-show rules.
                        </p>
                      )}
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={
                          cmd.busy ||
                          cmd.unknown ||
                          (action === "cancel" && !reason.trim())
                        }
                      >
                        Confirm{" "}
                        {action === "cancel" ? "cancellation" : "no-show"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={cmd.busy}
                        onClick={() => setAction("")}
                      >
                        Back
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
            <ErrorMessage text={cmd.error} />
            {cmd.unknown && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (await result.refresh()) {
                    cmd.reconciled();
                    onChanged();
                  }
                }}
              >
                Refresh saved appointment
              </Button>
            )}
          </>
        )}
      </LoadingState>
    </div>
  );
}
function PatientContact({ id }: { id: string }) {
  const result = useQuery<PatientDetail>(`/v1/patients/${id}`);
  return (
    <div>
      <ErrorMessage text={result.error} />
      {result.data && (
        <p className="text-sm">
          Patient contact:{" "}
          {result.data.contacts
            .filter((c) => c.kind === "phone")
            .map((c) => c.value)
            .join(", ") || "Not recorded"}
        </p>
      )}
    </div>
  );
}

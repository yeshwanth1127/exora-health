import { useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { PatientLookup, RegisterPatient } from "./Patients";
import { confirmLeave } from "./leave";
import { Booking } from "./Booking";
import type { Appointment, Patient, PatientDetail } from "./types";

export function Appointments() {
  const { facility, practitioners, can } = useWorkspace();
  const [date, setDate] = useState(today(facility.timezone)),
    [staffId, setStaffId] = useState("all"),
    [status, setStatus] = useState("all"),
    [mode, setMode] = useState("all"),
    [text, setText] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [book, setBook] = useState(false);
  const result = useQuery<{ items: Appointment[] }>(
    `/v1/appointments?${query({ facilityId: facility.facilityId, from: date, to: date, staffId: staffId === "all" ? undefined : staffId, status: status === "all" ? undefined : status, limit: 500 })}`,
    10000,
  );
  const items = filterLoadedAppointments(
    result.data?.items ?? [],
    text,
    mode === "all" ? "" : mode,
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
          <div className="flex flex-wrap gap-3">
            <Input
              type="date"
              aria-label="Appointment date"
              className="w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <div className="w-48">
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
            <div className="w-40">
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
            <div className="w-36">
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
              aria-label="Filter loaded appointments"
              placeholder="Filter loaded names, phone, MRN or confirmation"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Search filters this loaded day only (up to 500 records). Full server
            search and paging are pending.
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
                      {a.patientName ?? "Patient not linked"}
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
      <Sheet
        open={book}
        onOpenChange={(open) => {
          if (open || confirmLeave()) setBook(open);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Book appointment</SheetTitle>
            <SheetDescription>
              Select a patient and an available published slot.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6">
            <Booking
              onBooked={(id) => {
                setBook(false);
                setSelected(id);
                result.refresh();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
      {selected && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open && confirmLeave()) setSelected(null);
          }}
        >
          <SheetContent className="overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Appointment details</SheetTitle>
              <SheetDescription>
                Arrival, booking and visit history.
              </SheetDescription>
            </SheetHeader>
            <AppointmentDetails
              id={selected}
              onChanged={result.refresh}
              onMoved={(id) => {
                setSelected(id);
                result.refresh();
              }}
            />
          </SheetContent>
        </Sheet>
      )}
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
    <div className="p-6 space-y-5">
      <LoadingState {...result}>
        {a && (
          <>
            <div>
              <h2 className="text-xl font-semibold">
                {a.patientName ?? "Patient not linked"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {a.confirmationCode} ·{" "}
                {a.mrn ?? "Identity required before arrival"}
              </p>
            </div>
            <Status value={a.status} />
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

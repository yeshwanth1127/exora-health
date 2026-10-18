import { CopyButton } from "@/components/arc/copy-button/copy-button";
import { useTodayVisits } from "./patient-visits-hooks";
import { patientDisplayName } from "./patient-presentation";
import { useEffect, useState } from "react";
import {
  CalendarPlus,
  RefreshCw,
  CalendarClock,
  XCircle,
  UserX,
  ArrowRight,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/brand-icons";
import { filterOptionValue, doctorFilterOptions } from "./arc-filter-data";
import { SearchField } from "@/components/arc/search-field/search-field";
import { FilterToolbar } from "@/components/arc/filter-toolbar/filter-toolbar";
import { Button } from "@/components/ui/button";
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
import { today, time, money, label } from "./model";
import { ErrorMessage, Field, LoadingState, Status } from "./ui";
import { PatientLookup, RegisterPatient, TestPatientBadge } from "./Patients";
import { WorkspaceEmpty } from "./WorkspaceEmpty";
import { DayNavigator } from "@/components/date-controls";
import { requestLeave, useUnsaved } from "./leave";
import { FullPage } from "./FullPage";
import { Booking } from "./Booking";
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
  const doctorOptions = doctorFilterOptions(practitioners);
  const filters = JSON.stringify([date, staffId, status, search, mode]);
  const [pagedFor, setPagedFor] = useState(filters);
  if (pagedFor !== filters) {
    setPagedFor(filters);
    setPages([]);
  }
  const result = useQuery<{ items: Appointment[]; nextCursor: string | null }>(
    `/v1/appointments?${query({ facilityId: facility.facilityId, from: date, to: date, staffId: staffId === "all" ? undefined : staffId, status: status === "all" ? undefined : status, q: search.length >= 2 ? search : undefined, visitMode: mode === "all" ? undefined : mode, cursor: pages.at(-1), limit: 100 })}`,
    10000,
  );
  const items = result.data?.items ?? [];
  if (book)
    return (
      <FullPage
        title="Book appointment"
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
        action={
          can("appointments.book") ? (
            <Button onClick={() => setBook(true)}>
              <CalendarPlus />
              Book appointment
            </Button>
          ) : undefined
        }
      />
      <Card className="overflow-visible">
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <DayNavigator
              value={date}
              onChange={setDate}
              timezone={facility.timezone}
              label="Appointment date"
            />
            <Button
              variant="outline"
              size="icon"
              className="mt-7"
              aria-label="Refresh appointments"
              onClick={result.refresh}
            >
              <RefreshCw />
            </Button>
            <div className="arc-demo-scope appointment-search ml-auto min-w-[360px] max-w-xl flex-1">
              <SearchField variant="soft" label="Search appointments" value={text} onValueChange={setText}
                autoComplete="off" placeholder="Patient name, phone, MRN or confirmation code"
                aria-describedby="appointment-search-hint" aria-busy={text.trim().length >= 2 && (text.trim() !== search || result.loading)} />
              <p id="appointment-search-hint" className="mt-2 text-xs text-muted-foreground" role="status">
                {text.trim().length === 1 ? "Type at least 2 characters to search." : text.trim().length >= 2
                  ? text.trim() !== search || result.loading ? "Searching appointments…" : result.error ? "Search could not load. Try again." : `${items.length}${result.data?.nextCursor ? "+" : ""} matching ${items.length === 1 ? "appointment" : "appointments"} for the selected date and filters.`
                  : "Search within the selected date and filters."}
              </p>
            </div>
          </div>
          <div className="arc-demo-scope">
            <FilterToolbar
              label="Appointment filters"
              filters={[
                ...(staffId !== "all" ? [{ id: "doctor", label: "Doctor", value: doctorOptions.find((option) => option.value === staffId)?.label ?? "Selected doctor" }] : []),
                ...(status !== "all" ? [{ id: "status", label: "Booking status", value: label(status) }] : []),
                ...(mode !== "all" ? [{ id: "mode", label: "Appointment type", value: mode === "virtual" ? "Video" : "In person" }] : []),
              ]}
              onRemove={(id) => { if (id === "doctor") setStaffId("all"); else if (id === "status") setStatus("all"); else if (id === "mode") setMode("all"); }}
              onClearAll={() => { setStaffId("all"); setStatus("all"); setMode("all"); }}
              addFilter={{
                fields: [
                  { id: "doctor", label: "Doctor", options: doctorOptions },
                  { id: "status", label: "Booking status", options: ["confirmed", "checked_in", "completed", "cancelled", "no_show"].map((value) => ({ value, label: label(value) })) },
                  { id: "mode", label: "Appointment type", options: [{ value: "in_person", label: "In person" }, { value: "virtual", label: "Video" }] },
                ],
                onAdd: (chip, field) => {
                  // Arc emits the visible label; API filters require the stable option value.
                  const value = filterOptionValue(chip, field);
                  if (value === undefined) return;
                  if (chip.id === "doctor") setStaffId(value);
                  else if (chip.id === "status") setStatus(value);
                  else if (chip.id === "mode") setMode(value);
                },
              }}
            />
          </div>

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
            <WorkspaceEmpty
              title={
                mode !== "all"
                  ? "No appointments match these filters"
                  : staffId !== "all" || status !== "all" || search
                    ? "No appointments match these filters"
                    : `No appointments for ${date}`
              }
              action={
                staffId !== "all" ||
                status !== "all" ||
                search ||
                mode !== "all"
                  ? {
                      label: "Clear filters",
                      onClick: () => {
                        setStaffId("all");
                        setStatus("all");
                        setText("");
                        setSearch("");
                        setMode("all");
                      },
                    }
                  : can("appointments.book")
                    ? {
                        label: "Book appointment",
                        onClick: () => setBook(true),
                      }
                    : undefined
              }
            />
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
  useUnsaved(!!reason.trim() || !!patient || cmd.unknown);
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
    setPatient(null);
    setNotice(
      "Appointment updated. Contact the patient to confirm the change.",
    );
  }
  const checkInEligible =
    !!a &&
    a.status === "confirmed" &&
    can("appointments.check_in") &&
    a.sessionOn === today(facility.timezone);
  const locked = cmd.busy || cmd.unknown;
  const checkIn = async () => {
    const value = await cmd.run<{ tokenNo: number }>(
      `/v1/appointments/${id}/check-in`,
      patient ? { patientId: patient.patientId } : {},
      true,
    );
    if (value) {
      await changed();
      setNotice(
        `Checked in${value.tokenNo ? ` · Token ${value.tokenNo}` : ""}.`,
      );
    }
  };
  return (
    <div className="max-w-5xl space-y-6">
      <LoadingState {...result}>
        {a && (
          <>
            <header className="space-y-4">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">
                      {patientDisplayName(a.patientId, a.patientName)}
                    </h2>
                    {a.patientId && (
                      <TestPatientBadge patientId={a.patientId} />
                    )}
                    <Status value={a.status} />
                  </div>
                  <p className="text-sm font-medium">
                    {a.practitionerName} · {a.sessionOn} ·{" "}
                    {time(a.startsAt, facility.timezone)}{" "}
                    {a.endsAt ? `– ${time(a.endsAt, facility.timezone)}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.visitMode === "virtual"
                      ? "Teleconsultation"
                      : "In-person visit"}{" "}
                    · MRN {a.mrn ?? "Not linked"} · Booking {a.confirmationCode}
                    <span className="arc-demo-scope ml-2"><CopyButton value={a.confirmationCode} label="Copy booking code" iconOnly variant="plain" /></span>
                    {a.tokenNo ? ` · Token ${a.tokenNo}` : ""}
                  </p>
                  {a.originChannel === "whatsapp" && (
                    <span className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-800">
                      <WhatsAppIcon className="size-4" />
                      Booked through WhatsApp
                    </span>
                  )}
                </div>
                <div className="shrink-0 space-y-2 [&_button]:bg-blue-600 [&_button]:text-white [&_button:hover]:bg-blue-700">
                  {visit.data && can("clinical.read") ? (
                    <Button
                      disabled={locked}
                      onClick={() =>
                        go(`consultations?encounter=${visit.data!.encounterId}`)
                      }
                    >
                      {a.status === "completed" ||
                      visit.data.status === "finished"
                        ? "View visit summary"
                        : "Open consultation"}
                      <ArrowRight />
                    </Button>
                  ) : a.status === "confirmed" &&
                    a.visitMode === "virtual" &&
                    can("teleconsult.read") ? (
                    <Button
                      disabled={locked}
                      onClick={() => go("teleconsultations")}
                    >
                      Open teleconsultations
                      <ArrowRight />
                    </Button>
                  ) : checkInEligible ? (
                    <Button
                      disabled={locked || move}
                      onClick={
                        a.patientId || patient
                          ? checkIn
                          : () =>
                              document
                                .getElementById("arrival-patient")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                      }
                    >
                      {a.patientId || patient
                        ? "Check in patient"
                        : "Link patient to check in"}
                    </Button>
                  ) : a.status === "checked_in" && can("encounters.read") ? (
                    <Button
                      disabled={locked}
                      onClick={() => go("consultations")}
                    >
                      Open consultation worklist
                      <ArrowRight />
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                {a.patientId && can("patients.read") && (
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() => go(`patients?patient=${a.patientId}`)}
                  >
                    Patient details & medical history
                  </Button>
                )}
                {a.status === "confirmed" && (
                  <>
                    {can("appointments.reschedule") && (
                      <Button
                        variant="outline"
                        disabled={locked || move}
                        onClick={() =>
                          requestLeave(() => {
                            setAction("");
                            setReason("");
                            setMove(true);
                          })
                        }
                      >
                        <CalendarClock />
                        Move appointment
                      </Button>
                    )}
                    {can("appointments.cancel") && (
                      <Button
                        variant="destructive"
                        disabled={locked || move}
                        onClick={() =>
                          requestLeave(() => {
                            setAction("cancel");
                            setReason("");
                          })
                        }
                      >
                        <XCircle />
                        Cancel appointment
                      </Button>
                    )}
                    {can("appointments.check_in") && (
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
                        disabled={locked || move}
                        onClick={() =>
                          requestLeave(() => {
                            setAction("no-show");
                            setReason("");
                          })
                        }
                      >
                        <UserX />
                        Mark no-show
                      </Button>
                    )}
                  </>
                )}
              </div>
            </header>
            {action && (
              <form
                className="space-y-4 border-l-2 border-destructive pl-5 py-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const value = await cmd.run<Record<string, unknown>>(
                    `/v1/appointments/${id}/${action}`,
                    action === "cancel" ? { reason: reason.trim() } : undefined,
                    action === "cancel",
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
                      Mark this booking as not attended.
                    </p>
                  )}
                </Field>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={
                      cmd.busy ||
                      cmd.unknown ||
                      (action === "cancel" && !reason.trim())
                    }
                  >
                    Confirm {action === "cancel" ? "cancellation" : "no-show"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={locked}
                    onClick={() =>
                      requestLeave(() => {
                        setAction("");
                        setReason("");
                      })
                    }
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
            {a.status === "confirmed" && completedUnbooked && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                A separate unbooked visit was completed today. This booking is
                still scheduled.
              </p>
            )}
            {a.status === "checked_in" &&
              !visit.data &&
              can("encounters.read") && (
                <p className="text-sm text-muted-foreground">
                  {visit.failure?.status === 404
                    ? "Preparing the consultation…"
                    : visit.error || "Loading consultation…"}
                </p>
              )}
            {a.status === "completed" && visit.error && (
              <ErrorMessage text="This visit summary could not be opened. Check your clinical access or retry." />
            )}
            <section className="space-y-4 border-t pt-6">
              <h3 className="mb-4 font-semibold">Booking information</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 text-sm">
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
              <div className="mt-6 space-y-4 border-t pt-5">
                {a.patientId && <PatientContact id={a.patientId} />}
                <div className="text-sm">
                  <p className="text-muted-foreground">Visit reason</p>
                  <p className="mt-1">{a.reason ?? "Not recorded"}</p>
                </div>
              </div>
              {a.rescheduledFromId && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Moved from appointment {a.rescheduledFromId}
                </p>
              )}
              {a.cancelReason && (
                <p className="mt-4 text-sm">
                  Cancellation reason: {a.cancelReason}
                </p>
              )}
            </section>
            {notice && (
              <p role="status" className="text-sm font-medium text-blue-800">
                {notice}
              </p>
            )}
            {move ? (
              <Booking key={a.appointmentId} move={a} onBooked={onMoved} />
            ) : (
              <>
                {a.status === "confirmed" &&
                  can("appointments.check_in") &&
                  a.sessionOn === today(facility.timezone) &&
                  !a.patientId && (
                    <section
                      id="arrival-patient"
                      className="space-y-4 space-y-4 border-t pt-6"
                    >
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
                                disabled={locked}
                                onClick={() => setPatient(null)}
                              >
                                Change
                              </Button>
                            </p>
                          ) : !register ? (
                            <PatientLookup onSelect={setPatient} />
                          ) : null}
                          {can("patients.register") && !patient && (
                            <Button
                              variant="ghost"
                              onClick={() => requestLeave(() => setRegister((v) => !v))}
                            >
                              {register ? "Back to patient search" : "Register patient"}
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
                    </section>
                  )}
              </>
            )}
            <ErrorMessage text={cmd.error} />
            {cmd.unknown && (
              <Button variant="outline" disabled={cmd.busy} onClick={async () => {
                if (cmd.canReplay) {
                  if (await cmd.replay()) await changed();
                } else {
                  await result.refresh();
                }
              }}>
                {cmd.canReplay ? "Check original request" : "Refresh appointment (outcome still unconfirmed)"}
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

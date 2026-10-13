import { ExistingAppointments } from "./PatientVisits";
import { usePatientAppointments, useTodayVisits } from "./patient-visits-hooks";
import { today } from "./model";
import { query, request } from "./client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { PatientLookup, TestPatientBadge } from "./Patients";
import { patientDisplayName } from "./patient-presentation";
import { Choice, ErrorMessage, Field, Hint, LoadingState } from "./ui";
import { useUnsaved } from "./leave";
import type { Patient, PatientDetail, EncounterRow } from "./types";

// Opens a clinical visit for someone present now; it does not reserve a future slot.
export function NewConsultation({
  onOpened,
}: {
  onOpened: (id: string) => void;
}) {
  const { me, facility, practitioners, can, go } = useWorkspace();
  const cmd = useCommand();
  const initialId = new URLSearchParams(location.search).get("patient");
  const initial = useQuery<PatientDetail>(
    initialId ? `/v1/patients/${initialId}` : null,
  );
  const [chosen, setChosen] = useState<Patient | null>(null);
  const [search, setSearch] = useState(!initialId);
  const [staffId, setStaffId] = useState(
    me.staffType === "doctor" ? me.staffId : "",
  );
  const [complaint, setComplaint] = useState("");
  const p = initial.data;
  const patient =
    chosen ??
    (!search && p
      ? {
          patientId: p.patientId,
          mrn: p.mrn,
          name: `${p.givenName} ${p.familyName ?? ""}`.trim(),
          sex: p.sex,
          birthDate: p.birthDate,
          status: p.status,
          phone: p.contacts.find((c) => c.kind === "phone")?.value ?? null,
        }
      : null);
  const bookings = usePatientAppointments(patient?.patientId);
  const visits = useTodayVisits(patient?.patientId);
  const sameDoctorVisits = visits.items.filter(
    (v) => v.attendingStaffId === staffId,
  );
  const activeVisit = sameDoctorVisits.find((v) =>
    ["arrived", "in_progress"].includes(v.status),
  );
  const completedVisits = sameDoctorVisits.filter(
    (v) => v.status === "finished",
  );
  const [acknowledged, setAcknowledged] = useState("");
  const [notice, setNotice] = useState("");
  const contextKey = JSON.stringify([
    patient?.patientId,
    staffId,
    bookings.data?.map((a) => a.appointmentId),
    completedVisits.map((v) => v.encounterId),
  ]);
  const needsAcknowledgement =
    !!bookings.data?.length || !!completedVisits.length;
  const ready =
    !visits.loading &&
    !visits.error &&
    !bookings.loading &&
    !bookings.error &&
    !activeVisit &&
    (!needsAcknowledgement || acknowledged === contextKey);
  useUnsaved(!!complaint.trim() || cmd.unknown);
  if (
    !can("encounters.manage") ||
    !can("clinical.read") ||
    !can("patients.read") ||
    !can("encounters.read")
  )
    return (
      <Hint>
        Your account cannot open a clinical visit at this clinic. Ask the clinic
        administrator.
      </Hint>
    );
  return (
    <form
      className="max-w-3xl space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!patient || patient.status !== "active" || !staffId) return;
        if (!cmd.unknown) {
          if (!ready) return;
          const current = await request<{ items: EncounterRow[] }>(
            `/v1/encounters?${query({ facilityId: facility.facilityId, date: today(facility.timezone) })}`,
          ).catch(() => null);
          if (!current) {
            setNotice("Could not check today’s visits. Refresh and try again.");
            return;
          }
          if (
            current.items.some(
              (v) =>
                v.patientId === patient.patientId &&
                v.attendingStaffId === staffId &&
                ["arrived", "in_progress"].includes(v.status),
            )
          ) {
            setNotice(
              "This doctor already has an open visit for the patient. Continue it instead.",
            );
            visits.refresh();
            return;
          }
          if (bookings.enabled) {
            const currentBookings = await bookings.refresh();
            if (!currentBookings) return;
            const key = JSON.stringify([
              patient.patientId,
              staffId,
              currentBookings.map((a) => a.appointmentId),
              current.items
                .filter(
                  (v) =>
                    v.patientId === patient.patientId &&
                    v.attendingStaffId === staffId &&
                    v.status === "finished",
                )
                .map((v) => v.encounterId),
            ]);
            if (
              (currentBookings.length || completedVisits.length) &&
              acknowledged !== key
            )
              return;
          }
        }
        const opened = await cmd.run<{ encounterId: string }>(
          "/v1/encounters",
          {
            patientId: patient.patientId,
            facilityId: facility.facilityId,
            attendingStaffId: staffId,
            encounterClass: "outpatient",
            ...(complaint.trim() ? { chiefComplaint: complaint.trim() } : {}),
          },
          true,
        );
        if (opened) {
          setComplaint("");
          onOpened(opened.encounterId);
        }
      }}
    >
      <Hint>
        Creates a new, unbooked visit for a patient who is here now. It does not
        start or complete an existing appointment. For a booked visit, open its
        appointment and check in on the appointment date.
      </Hint>
      <section className="rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold">1. Patient</h2>
        {!search && initialId && !patient && (
          <>
            <LoadingState {...initial}>{null}</LoadingState>
            {initial.error && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSearch(true)}
              >
                Search for a patient instead
              </Button>
            )}
          </>
        )}
        {patient ? (
          <>
            <p className="text-lg font-semibold">
              {patientDisplayName(patient.patientId, patient.name)}{" "}
              <TestPatientBadge patientId={patient.patientId} />
            </p>
            <p className="text-sm text-muted-foreground">
              MRN {patient.mrn} · {patient.phone ?? "Phone not recorded"}
            </p>
            {patient.status !== "active" && (
              <Hint>
                This patient record is inactive. Select an active record.
              </Hint>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={cmd.busy || cmd.unknown}
              onClick={() => {
                setChosen(null);
                setSearch(true);
              }}
            >
              Choose another patient
            </Button>
          </>
        ) : (
          search && <PatientLookup onSelect={setChosen} />
        )}
      </section>
      {patient && (
        <section className="space-y-3">
          {(bookings.loading || visits.loading) && (
            <p className="text-sm">Checking appointments and today’s visits…</p>
          )}
          <ErrorMessage text={bookings.error || visits.error || notice} />
          <ExistingAppointments items={bookings.data ?? []} warning />
          {!!bookings.data?.some(
            (a) => a.sessionOn > today(facility.timezone),
          ) && (
            <Hint>
              A future booking cannot be started early here. Reschedule that
              appointment to today through the front desk if this care belongs
              to that booking.
            </Hint>
          )}
          {activeVisit && (
            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-semibold">
                A visit is already open with this doctor
              </p>
              <Button
                type="button"
                onClick={() =>
                  go(`consultations?encounter=${activeVisit.encounterId}`)
                }
              >
                Continue existing visit
              </Button>
            </div>
          )}
          {completedVisits.map((v) => (
            <div
              key={v.encounterId}
              className="rounded-lg border p-4 flex items-center justify-between gap-3"
            >
              <p className="text-sm font-medium">
                Completed today · {v.encounterNo}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => go(`consultations?encounter=${v.encounterId}`)}
              >
                View completed visit
              </Button>
            </div>
          ))}
        </section>
      )}
      <section className="rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">2. Today’s visit</h2>
        {me.staffType === "doctor" ? (
          <p className="text-sm">Treating doctor: {me.displayName}</p>
        ) : (
          <Field title="Treating doctor" id="visit-doctor">
            <Choice
              label="Treating doctor"
              value={staffId}
              disabled={cmd.busy || cmd.unknown}
              onChange={setStaffId}
              options={[
                { value: "", label: "Choose a doctor" },
                ...practitioners.map((d) => ({
                  value: d.staffId,
                  label: d.name,
                })),
              ]}
            />
          </Field>
        )}
        <Field title="Reason for today’s visit (optional)" id="visit-reason">
          <Textarea
            id="visit-reason"
            value={complaint}
            disabled={cmd.busy || cmd.unknown}
            maxLength={500}
            rows={3}
            onChange={(e) => setComplaint(e.target.value)}
          />
        </Field>
      </section>
      {patient && needsAcknowledgement && !activeVisit && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged === contextKey}
            disabled={cmd.busy || cmd.unknown}
            onChange={(e) =>
              setAcknowledged(e.target.checked ? contextKey : "")
            }
          />
          Create a separate, unbooked visit. Existing appointments and completed
          visits stay unchanged.
        </label>
      )}
      <ErrorMessage text={cmd.error} />
      {cmd.unknown && (
        <Hint>
          The outcome is not confirmed. Retry this same request to recover it
          before changing the form.
        </Hint>
      )}
      <Button
        type="submit"
        disabled={
          cmd.busy ||
          !patient ||
          patient.status !== "active" ||
          !staffId ||
          (!cmd.unknown && !ready)
        }
      >
        {cmd.unknown
          ? "Recover visit request"
          : cmd.busy
            ? "Opening visit…"
            : "Create unbooked consultation"}
      </Button>
    </form>
  );
}

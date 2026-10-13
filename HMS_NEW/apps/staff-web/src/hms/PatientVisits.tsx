import { Button } from "@/components/ui/button";
import { useWorkspace } from "./hooks";
import { usePatientAppointments, useTodayVisits } from "./patient-visits-hooks";
import { time } from "./model";
import { appointmentModeLabel } from "./booking-workflow";
import { ErrorMessage, LoadingState, Status } from "./ui";
import type { Appointment } from "./types";

export function ExistingAppointments({
  items,
  warning = false,
}: {
  items: Appointment[];
  warning?: boolean;
}) {
  const { facility, go } = useWorkspace();
  if (!items.length) return null;
  return (
    <section
      role={warning ? "alert" : undefined}
      className="rounded-lg border p-4 space-y-3"
    >
      <h3 className="font-semibold">
        {warning
          ? "Possible duplicate: patient already has an appointment"
          : "Existing appointments"}
      </h3>
      {warning && (
        <p className="text-sm">
          Review the existing booking before creating another. To change its
          time, open it and use Move appointment.
        </p>
      )}
      {items.map((a) => (
        <div
          key={a.appointmentId}
          className="flex justify-between gap-4 items-center border-t pt-3 text-sm"
        >
          <div>
            <p className="font-medium">
              {a.sessionOn}
              {a.startsAt
                ? ` · ${time(a.startsAt, facility.timezone)}`
                : ""} · {a.practitionerName}
            </p>
            <p className="text-muted-foreground">
              {appointmentModeLabel(a.visitMode)} · {a.confirmationCode} ·{" "}
              <Status value={a.status} />
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => go(`appointments?appointment=${a.appointmentId}`)}
          >
            View appointment
          </Button>
        </div>
      ))}
    </section>
  );
}

export function PatientVisitActions({ patientId }: { patientId: string }) {
  const { can, go } = useWorkspace();
  const visits = useTodayVisits(patientId);
  const bookings = usePatientAppointments(patientId);
  const active = visits.items.some((v) =>
    ["arrived", "in_progress"].includes(v.status),
  );
  const clinical =
    can("clinical.read") &&
    can("encounters.manage") &&
    can("patients.read") &&
    can("encounters.read");
  return (
    <section className="space-y-4">
      {can("encounters.read") && (
        <div className="rounded-lg border p-5 space-y-3">
          <h2 className="font-semibold">Today’s visits</h2>
          <LoadingState {...visits}>
            {visits.items.length ? (
              visits.items.map((v) => (
                <div
                  key={v.encounterId}
                  className="border-t pt-3 flex items-center justify-between gap-4 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {v.attendingName} · {v.encounterNo}
                    </p>
                    <p className="text-muted-foreground">
                      {v.status === "finished"
                        ? "Completed"
                        : v.status === "in_progress"
                          ? "Consultation in progress"
                          : v.status === "arrived"
                            ? "Ready for consultation"
                            : "Cancelled"}{" "}
                      ·{" "}
                      {v.appointmentId
                        ? "Linked to appointment"
                        : "Unbooked visit"}
                    </p>
                  </div>
                  {can("clinical.read") && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        go(`consultations?encounter=${v.encounterId}`)
                      }
                    >
                      {v.status === "finished"
                        ? "View completed visit"
                        : "Open visit"}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No clinical visit opened today.
              </p>
            )}
          </LoadingState>
        </div>
      )}
      {bookings.enabled && (
        <>
          <ErrorMessage text={bookings.error} />
          {bookings.loading && (
            <p className="text-sm text-muted-foreground">
              Checking existing appointments…
            </p>
          )}
          <ExistingAppointments items={bookings.data ?? []} />
        </>
      )}
      {clinical && !active && (
        <div className="space-y-2">
          <Button
            variant="outline"
            disabled={
              visits.loading ||
              !!visits.error ||
              bookings.loading ||
              !!bookings.error
            }
            onClick={() => go(`consultations?new=1&patient=${patientId}`)}
          >
            {visits.items.some((v) => v.status === "finished")
              ? "Create another unbooked visit"
              : "Create an unbooked visit"}
          </Button>
          <p className="text-xs text-muted-foreground">
            For care without a booking. For an existing appointment, open its
            booking and check in; an unbooked visit does not complete that
            appointment.
          </p>
        </div>
      )}
    </section>
  );
}

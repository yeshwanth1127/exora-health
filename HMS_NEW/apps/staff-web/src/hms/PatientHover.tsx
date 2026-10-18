import {
  HoverCard,
  HoverCardProfile,
} from "@/components/arc/hover-card/hover-card";
import { useQuery, useWorkspace } from "./hooks";
import { patientPreview } from "./patient-preview";
import { today } from "./model";
import type { Appointment, PatientDetail } from "./types";

/** Mounted by the source HoverCard only while its preview is open. No per-row appointment prefetch. */
type PreviewContext = { reason?: string | null; appointmentId?: string | null };
function PatientHoverContent({
  patientId,
  detail,
  reason,
  appointmentId,
}: { patientId: string; detail?: PatientDetail } & PreviewContext) {
  const { can, facility } = useWorkspace();
  const appointment = useQuery<Appointment>(
    appointmentId && can("appointments.read")
      ? `/v1/appointments/${appointmentId}`
      : null,
  );
  const result = useQuery<PatientDetail>(
    detail ? null : `/v1/patients/${patientId}`,
  );
  const data = detail ?? result.data;
  if (result.error)
    return (
      <p role="status" className="p-2 text-sm">
        Patient details could not be loaded.
      </p>
    );
  if (!data)
    return (
      <p role="status" className="p-2 text-sm">
        Loading patient details…
      </p>
    );
  return (
    <>
      <HoverCardProfile
        {...patientPreview(
          data,
          reason ??
            (appointment.data?.patientId === patientId &&
            appointment.data.facilityId === facility.facilityId
              ? appointment.data.reason
              : null),
          today(facility.timezone),
        )}
      />
      {appointmentId && appointment.error && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Visit context could not be loaded.
        </p>
      )}
    </>
  );
}

export function PatientHover({
  patientId,
  name,
  detail,
  reason,
  appointmentId,
}: {
  patientId: string;
  name: string;
  detail?: PatientDetail;
} & PreviewContext) {
  const { can, go } = useWorkspace();
  if (!can("patients.read")) return <span>{name}</span>;
  return (
    <HoverCard
      content={
        <PatientHoverContent
          patientId={patientId}
          detail={detail}
          reason={reason}
          appointmentId={appointmentId}
        />
      }
    >
      <button
        type="button"
        className="text-left underline decoration-border underline-offset-4 hover:decoration-current"
        aria-label={`Open patient ${name}`}
        onClick={() => go(`patients?patient=${patientId}`)}
      >
        {name}
      </button>
    </HoverCard>
  );
}

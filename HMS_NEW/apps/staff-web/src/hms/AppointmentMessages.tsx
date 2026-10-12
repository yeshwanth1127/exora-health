import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useWorkspace } from "./hooks";
import { query } from "./client";
import { label } from "./model";
import { Empty, Hint, LoadingState } from "./ui";
import {
  decodeCapabilities,
  decodeMessages,
  messagingAvailability,
  notificationReason,
  notificationState,
} from "./comms-model";

export function AppointmentMessages({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const { facility } = useWorkspace();
  const capability = useQuery(
    `/v1/comms/capabilities?${query({ facilityId: facility.facilityId })}`,
    0,
    decodeCapabilities,
  );
  const history = useQuery(
    `/v1/appointments/${appointmentId}/messages`,
    10000,
    decodeMessages,
  );
  return (
    <section className="space-y-3 border-t pt-5" aria-label="Patient messages">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Patient messages</h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh patient messages"
          onClick={() => {
            void history.refresh();
            void capability.refresh();
          }}
        >
          <RefreshCw />
        </Button>
      </div>
      <LoadingState {...capability}>
        {capability.data && (
          <Hint>
            {messagingAvailability(capability.data.moduleStatus)} Contact the
            patient separately when needed.
          </Hint>
        )}
      </LoadingState>
      <LoadingState {...history}>
        {history.data?.items.map((job) => (
          <div key={job.id} className="space-y-1 border-b pb-3 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">{label(job.kind)}</span>
              <span>{notificationState(job)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: facility.timezone,
              }).format(new Date(job.dueAt))}
            </p>
            {job.reason && (
              <p className="text-xs text-muted-foreground">
                {notificationReason(job.reason)}
              </p>
            )}
          </div>
        ))}
        {history.data?.items.length === 0 && (
          <Empty>
            No notification jobs recorded for this visit. A booking alone does
            not grant messaging consent.
          </Empty>
        )}
      </LoadingState>
    </section>
  );
}

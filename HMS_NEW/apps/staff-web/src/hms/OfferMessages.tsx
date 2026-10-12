import { useQuery, useWorkspace } from "./hooks";
import { decodeNotificationHistory } from "./whatsapp-source";
import { label } from "./model";
import { Empty, Hint, LoadingState } from "./ui";
export function OfferMessages({ offerId }: { offerId: string }) {
  const { facility } = useWorkspace();
  const history = useQuery(
    `/v1/waitlist-offers/${offerId}/messages`,
    10000,
    decodeNotificationHistory,
  );
  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">Offer notification records</h3>
      <Hint>
        Local records do not contact the caller. Phone the caller separately
        before recording their response.
      </Hint>
      <LoadingState {...history}>
        {history.data?.items.map((job) => (
          <div key={job.id} className="space-y-1 border-b pb-2">
            <p className="text-sm font-medium">{label(job.status)}</p>
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: facility.timezone,
              }).format(new Date(job.dueAt))}
            </p>
            {job.reason && (
              <p className="text-xs text-muted-foreground">
                {label(job.reason)}
              </p>
            )}
          </div>
        ))}
        {history.data?.items.length === 0 && (
          <Empty>No notification records for this offer.</Empty>
        )}
      </LoadingState>
    </section>
  );
}

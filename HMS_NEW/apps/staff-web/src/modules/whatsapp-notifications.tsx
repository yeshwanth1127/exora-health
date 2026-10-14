import { useState } from "react";
import {
  Clock3,
  FileText,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { decodeCommsSummary, decodeWhatsAppDelivery } from "@/hms/comms-model";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Choice,
  Empty,
  Resource,
  SectionTitle,
  StateBadge,
  TaskLink,
} from "@/components/workspace";
import { useQuery, useWorkspace } from "@/hms/hooks";
import { query } from "@/hms/client";
import { label } from "@/hms/model";
export function NotificationOverview({
  go,
  onAppointments,
}: {
  go: (page: string) => void;
  onAppointments: () => void;
}) {
  const { facility } = useWorkspace();
  const r = useQuery(
    `/v1/comms/summary?${query({ facilityId: facility.facilityId })}`,
    10000,
    decodeCommsSummary,
  );
  return (
    <Resource
      loading={r.loading}
      error={r.error}
      refresh={() => {
        void r.refresh();
      }}
    >
      {r.data && (
        <>
          <div className="mb-6 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Notification records at your clinic
              </h2>
            </div>
            <StateBadge value={r.data.moduleStatus} />
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
            {[
              [
                "Scheduled records",
                r.data.counts.scheduled,
                "Waiting for local evaluation",
              ],
              [
                "Queued records",
                r.data.counts.queued,
                "Local transport · never delivered",
              ],
              [
                "Skipped records",
                r.data.counts.skipped,
                "Review consent, timing or expiry",
              ],
              [
                "Cancelled records",
                r.data.counts.cancelled,
                "Visit or consent changed",
              ],
            ].map(([title, value, note]) => (
              <Card key={title} className="gap-0 p-0">
                <CardContent className="p-5">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{title}</span>
                    <Clock3 className="size-4" />
                  </div>
                  <div className="text-3xl font-semibold tracking-tight mt-5 tabular-nums">
                    {value}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{note}</p>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Open ${title}`}
                      onClick={() => go("delivery")}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid xl:grid-cols-[1.5fr_1fr] gap-6">
            <div className="space-y-6">
              <Card className="gap-0 p-0">
                <CardHeader className="p-5 border-b">
                  <CardTitle className="text-base">Your next steps</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <TaskLink
                    title="Review notification history"
                    onClick={() => go("delivery")}
                  />
                  <TaskLink
                    title="Configure visit reminders"
                    onClick={() => go("followups")}
                  />
                  <TaskLink
                    title="Open appointments"
                    onClick={onAppointments}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Inbox, content and campaigns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <FileText className="size-4 shrink-0 mt-1" />
                    <p>
                      Conversation, campaign and template metrics are
                      unavailable. No provider data has been connected.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-muted/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  Before patient contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm text-muted-foreground">
                <p>
                  Patient messaging permission is separate from clinical
                  consent.
                </p>
                <p>STOP cancels unsent work for matching phone contacts.</p>
                <p>
                  This transport saves local records without contacting
                  patients. Reception must contact patients separately when
                  needed.
                </p>
                <p className="text-xs">
                  As of{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: facility.timezone,
                  }).format(new Date(r.data.asOf))}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </Resource>
  );
}
export function NotificationDelivery() {
  const { facility } = useWorkspace();
  const [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [cursor, setCursor] = useState<string | undefined>(),
    [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const filter = (set: (value: string) => void) => (value: string) => {
    set(value);
    setCursor(undefined);
    setPrevious([]);
  };
  const validFrom = from ? new Date(from) : null,
    validTo = to ? new Date(to) : null;
  const datesValid =
    (!validFrom || Number.isFinite(validFrom.getTime())) &&
    (!validTo || Number.isFinite(validTo.getTime())) &&
    (!validFrom || !validTo || validFrom <= validTo);
  const r = useQuery(
    datesValid
      ? `/v1/whatsapp/outbound?${query({ facilityId: facility.facilityId, status, kind, from: validFrom && datesValid ? validFrom.toISOString() : undefined, to: validTo && datesValid ? validTo.toISOString() : undefined, limit: 25, cursor })}`
      : null,
    0,
    decodeWhatsAppDelivery,
  );
  return (
    <Resource
      loading={r.loading}
      error={
        !datesValid
          ? "Choose a valid date range with the end after the start."
          : r.error
      }
      refresh={() => {
        void r.refresh();
      }}
    >
      <SectionTitle
        title="Delivery history"
        action={
          <Button
            variant="outline"
            onClick={() => {
              void r.refresh();
            }}
          >
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <div className="mb-5 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Choice
          label="Record status"
          value={status}
          onChange={filter(setStatus)}
          options={[
            ["", "All statuses"],
            ...[
              "scheduled",
              "queued",
              "cancelled",
              "skipped_no_consent",
              "skipped",
              "excluded",
            ].map((v) => [v, label(v)] as [string, string]),
          ]}
        />
        <Choice
          label="Purpose"
          value={kind}
          onChange={filter(setKind)}
          options={[
            ["", "All purposes"],
            ...[
              "confirmation",
              "reschedule",
              "cancellation",
              "day_before",
              "same_day",
              "follow_up",
              "feedback",
              "no_show",
              "waitlist_offer",
              "reply",
              "campaign",
            ].map((v) => [v, label(v)] as [string, string]),
          ]}
        />
        <label className="text-xs space-y-2">
          Recorded from · computer time
          <Input
            type="datetime-local"
            value={from}
            onChange={(e) => filter(setFrom)(e.target.value)}
          />
        </label>
        <label className="text-xs space-y-2">
          Recorded to · computer time
          <Input
            type="datetime-local"
            value={to}
            onChange={(e) => filter(setTo)(e.target.value)}
          />
        </label>
      </div>
      {r.data?.items.length ? (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Recorded at</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data.items.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-xs">
                    {`${label(j.kind)} ${j.relatedId.slice(-8)}`}
                  </TableCell>
                  <TableCell>{label(j.kind)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: facility.timezone,
                    }).format(new Date(j.createdAt))}
                  </TableCell>
                  <TableCell>
                    <StateBadge value={j.status} />
                    {j.reason && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        {label(j.reason)}
                      </p>
                    )}
                    <p className="text-xs mt-1">
                      Local transport · not delivered
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        !r.loading &&
        !r.error && (
          <Empty
            title="No matching records"
          />
        )
      )}
      <div className="flex justify-end gap-3 mt-4">
        <Button
          variant="outline"
          disabled={!previous.length || r.loading}
          onClick={() => {
            setCursor(previous.at(-1));
            setPrevious(previous.slice(0, -1));
          }}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!r.data?.nextCursor || r.loading}
          onClick={() => {
            setPrevious([...previous, cursor]);
            setCursor(r.data?.nextCursor ?? undefined);
          }}
        >
          Next
        </Button>
      </div>
    </Resource>
  );
}

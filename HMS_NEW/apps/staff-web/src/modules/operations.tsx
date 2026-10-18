import { ChartDataDisclosure } from "@/components/ChartDataDisclosure";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { BarChart as ArcBarChart } from "@/components/arc/bar-chart/bar-chart";
import type { ReactNode } from "react";
import { SplitBar } from "@/components/arc/split-bar/split-bar";
import { splitSegments } from "./split-segments";
import { MorphBlock, SkeletonMorph } from "@/components/arc/skeleton-morph/skeleton-morph";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageTitle,
  Resource,
  StateBadge,
  Empty,
  useResource,
} from "@/components/workspace";
import { dateTime, type Appointment, type Catalogue } from "@/lib/api";

type Analytics = {
  summary: Record<string, number>;
  daily_bookings: { date: string; bookings: number }[];
  by_status: { label: string; value: number }[];
  by_channel: { label: string; value: number }[];
  recent_appointments: Appointment[];
};
type Event = {
  id: string;
  event_type: string;
  aggregate_id: string;
  created_at: string;
  processed_at: string | null;
  status: string;
};
type Doctor = { id: string; name: string; departments: { id: string }[] };

const METRIC_SKELETON = 194;
// Demo blocks wrap text and size to it; these wrap cards, charts and a table, so they keep the column width.
const FILL = { width: "100%" };
function HealthSplit({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return rows.some((d) => d.value > 0) ? (
    <SplitBar title={title} segments={splitSegments(rows)} unit="appointments" />
  ) : (
    <Empty title="No appointments yet" />
  );
}

export function OperationsModule({
  page,
  setup,
}: {
  page: string;
  setup?: ReactNode;
}) {
  return page === "catalogue" ? (
    <CataloguePage />
  ) : (
    <ActivityPage overview={page === "overview"} setup={setup} />
  );
}
function ActivityPage({
  overview,
  setup,
}: {
  overview: boolean;
  setup?: ReactNode;
}) {
  const r = useResource<Analytics>("/api/v1/admin/analytics");
  const events = useResource<Event[]>(
    overview ? null : "/api/v1/admin/operations",
  );
  const health = useResource<{ ready: boolean }>(
    overview ? null : "/api/health/ready",
  );
  const refresh = () => {
    r.refresh();
    events.refresh();
    health.refresh();
  };
  const s = r.data?.summary ?? {};
  const metrics = overview
    ? [
        [
          "Total appointments",
          s.appointments_total,
          `All time · ${s.appointments_upcoming ?? 0} confirmed for today or later`,
        ],
        [
          "Retained confirmations",
          `${s.conversion_rate ?? 0}%`,
          `All time · ${s.appointments_confirmed ?? 0} confirmed, checked in or completed / ${s.appointments_total ?? 0} total bookings; not attendance`,
        ],
        [
          "Doctors with active hours",
          s.active_doctors,
          `Effective today · ${s.schedule_rules ?? 0} weekly rules`,
        ],
        [
          "Local notification jobs",
          s.pending_notifications,
          `Current scheduled or queued jobs · not delivery receipts. ${s.active_holds ?? 0} unexpired holds`,
        ],
        [
          "Voice bookings",
          s.voice_bookings,
          s.voice_sessions_total == null
            ? "Call sessions not connected"
            : `All time · ${s.voice_sessions_total} recorded call sessions`,
        ],
      ]
    : [
        [
          "Local notification jobs",
          s.pending_notifications,
          "Scheduled or queued locally · not sent",
        ],
        ["Active holds", s.active_holds, "Temporary reservations"],
        [
          "API readiness",
          health.loading
            ? "Checking…"
            : health.data?.ready
              ? "Ready"
              : "Unavailable",
          "Database connectivity check",
        ],
      ];
  return (
    <>
      <PageTitle
        title={overview ? "Overview" : "System status"}
        action={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      {overview && setup}
      <Resource
        loading={!overview && (r.loading || events.loading)}
        error={r.error || (!overview ? events.error || health.error : "")}
        refresh={refresh}
      >
        <SkeletonMorph loading={overview && r.loading} loadingLabel="Loading overview" className="arc-morph-tokens">
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {metrics.map(([label, value, detail]) => {
            const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+(?:\.\d+)?%$/.test(value) ? Number(value.slice(0, -1)) : null;
            return numeric !== null ? (
              <MorphBlock style={FILL} key={String(label)} height={METRIC_SKELETON} radius={34} className="arc-demo-scope">
                <MetricCard label={String(label)} value={numeric} suffix={typeof value === "string" && value.endsWith("%") ? "%" : undefined} context={String(detail)} />
              </MorphBlock>
            ) : overview && r.loading ? (
              <MorphBlock style={FILL} key={String(label)} height={METRIC_SKELETON} radius={34} className="arc-demo-scope" />
            ) : (
              <Card key={String(label)}>
                <CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-3xl tabular-nums">{value ?? "—"}</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
              </Card>
            );
          })}
        </div>
        {overview ? (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily bookings</CardTitle>
                  <CardDescription>
                    Last 14 days · bookings made, by clinic date.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MorphBlock style={FILL} height={304} className="arc-demo-scope mb-5">
                    <ArcBarChart
                      label="Daily bookings"
                      period="Last 14 days · clinic dates"
                      unit="bookings"
                      averageLabel="Daily average"
                      valueLabel="Bookings"
                      data={(r.data?.daily_bookings ?? []).map((day) => ({ key: day.date, label: day.date, axisLabel: day.date.slice(5), value: day.bookings }))}
                    />
                  </MorphBlock>
                  <ChartDataDisclosure>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Bookings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(r.data?.daily_bookings ?? []).map((d) => (
                          <TableRow key={d.date}>
                            <TableCell>{d.date}</TableCell>
                            <TableCell>{d.bookings}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ChartDataDisclosure>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Appointment health</CardTitle>
                  <CardDescription>
                    All-time bookings · current statuses and originating
                    channels.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MorphBlock style={FILL} height={196} className="arc-demo-scope arc-section-frame mb-5">
                    <div className="space-y-8">
                      <HealthSplit title="By status" rows={r.data?.by_status ?? []} />
                      <HealthSplit title="By channel" rows={r.data?.by_channel ?? []} />
                    </div>
                  </MorphBlock>
                  <ChartDataDisclosure>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Appointments</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(r.data?.by_status ?? []).map((d) => (
                          <TableRow key={d.label}>
                            <TableCell>
                              <StateBadge value={d.label} />
                            </TableCell>
                            <TableCell>{d.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Table className="mt-6">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Channel</TableHead>
                          <TableHead>Appointments</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(r.data?.by_channel ?? []).map((d) => (
                          <TableRow key={d.label}>
                            <TableCell>
                              <StateBadge value={d.label} />
                            </TableCell>
                            <TableCell>{d.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ChartDataDisclosure>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Recent appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <MorphBlock style={FILL} lines={4} lineHeight={36}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor & clinic</TableHead>
                      <TableHead>Visit</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(r.data?.recent_appointments ?? []).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.patient_name}
                          <p className="text-xs text-muted-foreground">
                            {a.patient_phone}
                          </p>
                        </TableCell>
                        <TableCell>
                          {a.doctor?.name}
                          <p className="text-xs text-muted-foreground">
                            {a.branch?.name}
                          </p>
                        </TableCell>
                        <TableCell>
                          {a.starts_at ? dateTime(a.starts_at) : "Walk-in"}
                        </TableCell>
                        <TableCell>
                          <StateBadge value={a.origin_channel} />
                        </TableCell>
                        <TableCell>
                          <StateBadge value={a.status} />
                        </TableCell>
                        <TableCell>{a.confirmation_code}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!r.data?.recent_appointments.length && (
                  <Empty
                    title="No appointments yet"
                  />
                )}
                </MorphBlock>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Event outbox</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Record</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(events.data ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.event_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.aggregate_id}
                      </TableCell>
                      <TableCell>{dateTime(e.created_at)}</TableCell>
                      <TableCell>
                        {e.processed_at ? dateTime(e.processed_at) : "Pending"}
                      </TableCell>
                      <TableCell>
                        <StateBadge value={e.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!events.data?.length && (
                <Empty
                  title="No operational events"
                />
              )}
            </CardContent>
          </Card>
        )}
        </SkeletonMorph>
      </Resource>
    </>
  );
}
function CataloguePage() {
  const r = useResource<Catalogue>("/api/v1/admin/catalogue");
  const doctors = useResource<Doctor[]>("/api/v1/admin/doctors");
  const refresh = () => {
    r.refresh();
    doctors.refresh();
  };
  return (
    <>
      <PageTitle
        title="Hospital catalogue"
        action={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
      <Resource
        loading={r.loading || doctors.loading}
        error={r.error || doctors.error}
        refresh={refresh}
      >
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinic branches</CardTitle>
              <CardDescription>
                {r.data?.branches.length ?? 0} locations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(r.data?.branches ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {b.name}
                        <p className="text-xs text-muted-foreground">
                          {b.area}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StateBadge
                          value={b.is_active ? "active" : "inactive"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Departments</CardTitle>
              <CardDescription>
                {r.data?.departments.length ?? 0} clinical services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Doctors</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(r.data?.departments ?? []).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.name}</TableCell>
                      <TableCell>
                        {
                          (doctors.data ?? []).filter((doctor) =>
                            doctor.departments.some((dept) => dept.id === d.id),
                          ).length
                        }
                      </TableCell>
                      <TableCell>
                        <StateBadge
                          value={d.is_active ? "active" : "inactive"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Resource>
    </>
  );
}

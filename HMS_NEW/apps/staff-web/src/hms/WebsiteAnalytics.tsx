import { useState, type ComponentType } from "react";
import {
  ArrowRight,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/workspace";
import {
  GoogleIcon,
  PostHogIcon,
  WhatsAppIcon,
} from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useWorkspace } from "./hooks";
import { Delta } from "./GoogleBusiness";
import { Pick } from "./whatsapp-ui";
import { Settings, Websites } from "./WebsiteAnalyticsSetup";
import { request, IntentKeys } from "./client";
import {
  deviceNames,
  percent,
  ranked,
  regions,
  sourceNames,
  summarize,
  type AnalyticsData,
  type Device,
  type Source,
} from "./website-analytics";

export type AChange = (
  fn: (d: AnalyticsData) => AnalyticsData,
) => Promise<void>;
export type Clinic = {
  facilityId: string;
  name: string;
  bookUrl: string;
  doctors: string[];
};

export function WebsiteAnalytics() {
  const { facility } = useWorkspace();
  return <AnalyticsPage key={facility.facilityId} />;
}

function AnalyticsPage() {
  const { facility, practitioners } = useWorkspace();
  const links = useQuery<{
    items: { facilityId: string; bookingUrl: string }[];
  }>(`/v1/booking-links?facilityId=${facility.facilityId}`);
  if (links.loading)
    return (
      <p className="text-sm text-muted-foreground">
        Loading website analytics…
      </p>
    );
  const clinic: Clinic = {
    facilityId: facility.facilityId,
    name: facility.name,
    bookUrl:
      links.data?.items.find((l) => l.facilityId === facility.facilityId)
        ?.bookingUrl ??
      new URL(
        `book.html?branch=${facility.facilityId}`,
        location.origin + import.meta.env.BASE_URL,
      ).toString(),
    doctors: practitioners
      .filter((p) => p.facilityId === facility.facilityId)
      .map((p) => p.name),
  };
  return <Analytics clinic={clinic} />;
}

const tabs = [
  ["overview", "Overview"],
  ["websites", "Websites"],
  ["settings", "Settings"],
] as const;
export type ATab = (typeof tabs)[number][0];

function Analytics({ clinic }: { clinic: Clinic }) {
  const { can } = useWorkspace();
  const canManage = can("growth.manage");
  const [days, setDays] = useState("30");
  const state = useQuery<AnalyticsData>(
    `/v1/website-analytics?facilityId=${clinic.facilityId}&days=${days}`,
    30000,
  );
  const [intents] = useState(() => new IntentKeys());
  const [tab, setTab] = useState<ATab>("overview");
  const [busy, setBusy] = useState(false);
  const data = state.data;
  const change: AChange = async (fn) => {
    if (!data || busy) return;
    setBusy(true);
    try {
      const next = fn(data),
        added = next.sites.find(
          (s) => !data.sites.some((old) => old.id === s.id),
        ),
        removed = data.sites.find(
          (s) => !next.sites.some((n) => n.id === s.id),
        );
      const path = added
        ? "/v1/website-analytics/sites"
        : removed
          ? `/v1/website-analytics/sites/${removed.id}?facilityId=${clinic.facilityId}`
          : null;
      const body = added
        ? { facilityId: clinic.facilityId, url: added.url }
        : undefined;
      if (path) {
        await request(path, {
          method: added ? "POST" : "DELETE",
          body,
          idempotencyKey: intents.for(path, body),
        });
        intents.complete(path, body);
      }
      await state.refresh();
      if (path) toast.success(added ? "Website added" : "Website removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save website.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle title="Website analytics" />
      <div className="space-y-6">
        {state.loading && (
          <p className="text-sm text-muted-foreground">
            Loading website analytics…
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}{" "}
            <Button variant="link" onClick={() => void state.refresh()}>
              Retry
            </Button>
          </p>
        )}
        {data && !data.available && (
          <Card className="p-6 shadow-none">
            <h2 className="font-semibold">
              Website analytics is being prepared
            </h2>
            <p className="text-sm text-muted-foreground">
              Exora will make it available here. You do not need to create an
              analytics account.
            </p>
          </Card>
        )}
        {data?.available && (
          <>
            <Tabs value={tab} onValueChange={(v) => setTab(v as ATab)}>
              <TabsList variant="line">
                {tabs.map(([k, label]) => (
                  <TabsTrigger key={k} value={k}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {data.status === "service_unavailable" && (
              <p role="alert" className="text-sm text-destructive">
                Visitor numbers are temporarily unavailable. Please try again.
              </p>
            )}
            <fieldset disabled={busy} className="min-w-0 space-y-6">
              {tab === "overview" && data.status !== "service_unavailable" && (
                <Overview
                  data={data}
                  open={setTab}
                  range={days}
                  setRange={setDays}
                />
              )}
              {tab === "websites" && (
                <Websites
                  data={data}
                  change={change}
                  clinic={clinic}
                  canManage={canManage}
                />
              )}
              {tab === "settings" && (
                <Settings data={data} canManage={canManage} />
              )}
            </fieldset>
          </>
        )}
      </div>
    </>
  );
}

const ranges = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
] as const;
const sourceIcons: Record<Source, ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  maps: ({ className }) => <MapPin className={`${className} text-[#ea4335]`} />,
  whatsapp: WhatsAppIcon,
  social: Share2,
  direct: Link2,
  other: Globe,
};
const deviceColors: Record<Device, string> = {
  mobile: "bg-primary",
  desktop: "bg-primary/55",
  tablet: "bg-primary/25",
};
const n = (v: number) => v.toLocaleString("en-IN");

function Overview({
  data,
  open,
  range,
  setRange,
}: {
  data: AnalyticsData;
  open: (t: ATab) => void;
  range: string;
  setRange: (v: string) => void;
}) {
  const days = Number(range);
  const summary = summarize(data.days, days);
  const series = summary.series,
    now = data.totals ?? summary.now,
    before = data.before ?? summary.before;
  const label = `previous ${days} days`;
  const rate = percent(now.booked, now.visitors);
  const sources = ranked(now.sources);
  const top = sources[0];
  const max = Math.max(...series.map((d) => d.visitors), 1);
  const ph = data.posthog;
  const ownSites = data.sites.filter((s) => s.kind === "own");
  return (
    <div className="space-y-6">
      {!data.bookingsTracked && (
        <p className="text-xs text-muted-foreground">
          Bookings are not attributed to website visitors yet. A dash means
          unavailable.
        </p>
      )}
      {ph?.status === "testing" && (
        <p className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Loader2 className="size-4 animate-spin" /> Checking your PostHog
          keys. Numbers keep showing while we connect.
        </p>
      )}
      {!ownSites.length && (
        <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4 shadow-none">
          <p className="text-sm">
            <span className="font-medium">Connect your public website.</span>{" "}
            Install the code once to start seeing visits here.
          </p>
          <Button size="sm" onClick={() => open("websites")}>
            Add your website <ArrowRight />
          </Button>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {data.provider === "posthog" ? (
            <PostHogIcon className="size-4 text-foreground" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          Counted by{" "}
          {data.provider === "posthog" ? "PostHog" : "Exora analytics"}
        </p>
        <div className="flex items-center gap-2">
          {ph?.status === "connected" && (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`${regions[ph.region].app}/project/${ph.projectId}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              Open in PostHog <ExternalLink />
            </Button>
          )}
          <Pick
            id="analytics-range"
            className="w-40"
            value={range}
            options={ranges}
            onChange={setRange}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Visitors", n(now.visitors), now.visitors, before.visitors],
            ["Pages viewed", n(now.views), now.views, before.views],
            [
              "Booked from your website",
              data.bookingsTracked ? n(now.booked) : "—",
              now.booked,
              before.booked,
            ],
            [
              "Bookings / measured visitors",
              data.bookingsTracked ? `${rate.toFixed(1)}%` : "—",
              rate,
              percent(before.booked, before.visitors),
            ],
          ] as const
        ).map(([title, shown, value, prev]) => (
          <Card key={title} className="gap-1 p-4 shadow-none">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tabular-nums">{shown}</p>
            {(title === "Visitors" ||
              title === "Pages viewed" ||
              data.bookingsTracked) && (
              <Delta now={value} before={prev} label={label} />
            )}
          </Card>
        ))}
      </div>
      {top && data.bookingsTracked && (
        <p className="text-sm">
          Most recorded referrals came from{" "}
          <span className="font-medium">{sourceNames[top[0]]}</span>. About{" "}
          {Math.round(rate)} confirmed website bookings per 100 measured visitors.
          Visit tracking can be blocked, so this is an aggregate ratio.
        </p>
      )}
      <Card className="gap-3 p-5 shadow-none">
        <h2 className="text-sm font-semibold">Visits each day</h2>
        <div
          className="flex h-40 items-end gap-px"
          role="img"
          aria-label={`Visits each day, ${ranges.find(([k]) => k === range)?.[1].toLowerCase()}`}
        >
          {series.map((d) => (
            <div
              key={d.date}
              className="flex-1 rounded-t-sm bg-primary/70 transition-colors hover:bg-primary"
              style={{ height: `${(d.visitors / max) * 100}%` }}
              title={`${new Date(d.date).toLocaleDateString([], { day: "numeric", month: "short" })}: ${d.visitors} visits`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>
            {series[0] &&
              new Date(series[0].date).toLocaleDateString([], {
                day: "numeric",
                month: "short",
              })}
          </span>
          <span>Today</span>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-4 p-5 shadow-none">
          <h2 className="text-sm font-semibold">Where visitors came from</h2>
          <ul className="space-y-3">
            {sources.map(([k, v]) => {
              const Icon = sourceIcons[k];
              return (
                <li
                  key={k}
                  className="grid grid-cols-[1rem_7.5rem_1fr_2.5rem] items-center gap-2.5 sm:grid-cols-[1.25rem_10rem_1fr_3rem] sm:gap-3 text-sm"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="truncate">{sourceNames[k]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{ width: `${percent(v, sources[0][1])}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {Math.round(
                      percent(
                        v,
                        Object.values(now.sources).reduce((a, b) => a + b, 0),
                      ),
                    )}
                    %
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Sources are grouped from recorded referrals.
          </p>
        </Card>
        <Card className="gap-4 p-5 shadow-none">
          <h2 className="text-sm font-semibold">From visit to booking</h2>
          <ol className="space-y-4">
            {(
              [
                ["Visited your website", now.visitors, null],
                ["Opened booking", now.started, now.visitors],
                ["Booked an appointment", now.booked, now.started],
              ] as const
            ).map(([title, v, prev]) => (
              <li key={title} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{title}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">
                      {title === "Booked an appointment" &&
                      !data.bookingsTracked
                        ? "—"
                        : n(v)}
                    </span>
                    {prev !== null &&
                      (title !== "Booked an appointment" ||
                        data.bookingsTracked) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {Math.round(percent(v, prev))}% of the step before
                        </span>
                      )}
                  </span>
                </div>
                <span className="block h-3 overflow-hidden rounded bg-muted">
                  <span
                    className="block h-full rounded bg-emerald-600/80"
                    style={{
                      width: `${Math.max(
                        percent(
                          v,
                          Object.values(now.sources).reduce((a, b) => a + b, 0),
                        ),
                        1.5,
                      )}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Bookings are counted from your appointment book, so they match the
            Appointments page.
          </p>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="gap-0 p-0 shadow-none">
          <h2 className="px-5 pt-5 pb-3 text-sm font-semibold">
            Most visited pages
          </h2>
          <ul className="divide-y">
            {[...data.pages]
              .sort((a, b) => b.share - a.share)
              .map((p) => (
                <li
                  key={p.path}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.path}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {n(Math.round(now.views * p.share))} views
                  </span>
                </li>
              ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card className="gap-3 p-5 shadow-none">
            <h2 className="text-sm font-semibold">What visitors tapped</h2>
            <ul className="space-y-2.5">
              {(
                [
                  [Phone, "Call", "call"],
                  [WhatsAppIcon, "WhatsApp", "whatsapp"],
                  [Navigation, "Directions", "directions"],
                ] as const
              ).map(([Icon, title, k]) => (
                <li key={k} className="flex items-center gap-3 text-sm">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{title}</span>
                  <span className="font-semibold tabular-nums">
                    {n(now.clicks[k])}
                  </span>
                  <span className="w-28 text-right">
                    <Delta
                      now={now.clicks[k]}
                      before={before.clicks[k]}
                      label="before"
                    />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="gap-3 p-5 shadow-none">
            <h2 className="text-sm font-semibold">Devices</h2>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {(Object.keys(deviceNames) as Device[]).map((k) => (
                <span
                  key={k}
                  className={deviceColors[k]}
                  style={{ width: `${percent(now.devices[k], now.visitors)}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(Object.keys(deviceNames) as Device[]).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${deviceColors[k]}`} />
                  {deviceNames[k]}{" "}
                  {Math.round(percent(now.devices[k], now.visitors))}%
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

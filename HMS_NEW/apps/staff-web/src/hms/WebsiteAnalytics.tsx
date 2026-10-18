import { GrowthBar, GrowthSplit } from "./GrowthCharts";
import { GrowthMetric } from "./GrowthMetric";
import { LineChart as ArcLineChart } from "@/components/arc/line-chart/line-chart";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, Loader2, Navigation, Phone, ShieldCheck } from "lucide-react";
import { toast } from "@/components/toast-events";
import { PageTitle } from "@/components/workspace";
import { PostHogIcon, WhatsAppIcon } from "@/components/brand-icons";
import { GrowthBadge as Badge } from "./GrowthBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { useQuery, useWorkspace } from "./hooks";
import { Delta } from "./GoogleBusiness";
import { Pick } from "./whatsapp-ui";
import { options, PostHogDialog, preview, Settings, Websites } from "./WebsiteAnalyticsSetup";
import {
  deviceNames,
  empty,
  percent,
  progress,
  ranked,
  regions,
  seed,
  sourceNames,
  summarize,
  type AnalyticsData,
  type Device,
  type PostHogLink,
  type Provider,
} from "./website-analytics";

export type AChange = (fn: (d: AnalyticsData) => AnalyticsData) => void;
export type Clinic = { facilityId: string; name: string; bookUrl: string; doctors: string[] };

export function WebsiteAnalytics() {
  const { facility } = useWorkspace();
  return <AnalyticsPage key={facility.facilityId} />;
}

function AnalyticsPage() {
  const { facility, practitioners } = useWorkspace();
  const links = useQuery<{ items: { facilityId: string; bookingUrl: string }[] }>(`/v1/booking-links?facilityId=${facility.facilityId}`);
  if (links.loading) return <p className="text-sm text-muted-foreground">Loading website analytics…</p>;
  const clinic: Clinic = {
    facilityId: facility.facilityId,
    name: facility.name,
    bookUrl:
      links.data?.items.find((l) => l.facilityId === facility.facilityId)?.bookingUrl ??
      new URL(`book.html?branch=${facility.facilityId}`, location.origin + import.meta.env.BASE_URL).toString(),
    doctors: practitioners.filter((p) => p.facilityId === facility.facilityId).map((p) => p.name),
  };
  return <Analytics clinic={clinic} />;
}

// ponytail: UI-first phase keeps setup and sample numbers in this browser; the backend phase reads /v1/website-analytics.
function useAnalytics(key: string) {
  const [data, set] = useState<AnalyticsData>(() => {
    try {
      const old = JSON.parse(localStorage.getItem(key) ?? "null") as AnalyticsData | null;
      return old?.v === 1 ? old : empty();
    } catch {
      return empty();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* Private mode: changes last for this visit. */
    }
  }, [key, data]);
  useEffect(() => {
    const t = setInterval(() => set((d) => progress(d, Date.now())), 1000);
    return () => clearInterval(t);
  }, []);
  return [data, set] as const;
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
  const [data, change] = useAnalytics(`exora:analytics:${clinic.facilityId}`);
  const [tab, setTab] = useState<ATab>(() => {
    const t = new URLSearchParams(location.search).get("tab");
    return tabs.some(([k]) => k === t) ? (t as ATab) : "overview";
  });
  const [connecting, setConnecting] = useState(false);
  const open = (t: ATab) => {
    setTab(t);
    history.replaceState(history.state, "", `?tab=${t}`);
  };
  /** Sets the option in use. Past numbers stay; PostHog keys are dropped when leaving PostHog. */
  const use = (provider: Provider, posthog: PostHogLink | null = null) =>
    change((d) => ({
      ...(d.days.length ? d : seed(clinic, Date.now())),
      provider,
      posthog,
      switchedAt: d.provider && d.provider !== provider ? Date.now() : d.switchedAt,
    }));
  const badge = preview && <Badge variant="outline" className="font-normal">UI preview · sample numbers</Badge>;
  const dialog = (
    <PostHogDialog
      open={connecting}
      onOpenChange={setConnecting}
      onSave={(link) => {
        use("posthog", link);
        setConnecting(false);
        toast.success("Checking your PostHog keys");
      }}
    />
  );
  if (!data.provider)
    return (
      <>
        <PageTitle title="Website analytics" action={badge} />
        <Choose canManage={canManage} onExora={() => (use("exora"), toast.success("Exora analytics is on"))} onPostHog={() => setConnecting(true)} />
        {dialog}
      </>
    );
  const waiting = data.sites.filter((s) => s.kind === "own" && s.status !== "live").length;
  return (
    <>
      <PageTitle title="Website analytics" action={badge} />
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => open(v as ATab)} className="arc-workflow-root">
          <div className="arc-demo-scope">
          <TabsList aria-label="Website analytics workspace">
            {tabs.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                <span className="inline-flex items-center gap-2">{label}
                {k === "websites" && waiting > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">{waiting}</span>
                )}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          </div>
        {!canManage && <p className="rounded-md border bg-muted/40 p-3 text-sm">You can see the numbers. Ask an administrator to change settings or add websites.</p>}
        <TabsContent value="overview" className="arc-workflow-panel"><Overview data={data} open={open} /></TabsContent>
        <TabsContent value="websites" className="arc-workflow-panel"><Websites data={data} change={change} clinic={clinic} canManage={canManage} /></TabsContent>
        <TabsContent value="settings" className="arc-workflow-panel"><Settings data={data} canManage={canManage} onExora={() => (use("exora"), toast.success("Switched to Exora analytics"))} onPostHog={() => setConnecting(true)} /></TabsContent>
        </Tabs>
      </div>
      {dialog}
    </>
  );
}

function Choose({ canManage, onExora, onPostHog }: { canManage: boolean; onExora: () => void; onPostHog: () => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">See how patients find you online</h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Visitors, where they came from, and how many went on to book. Your Exora booking page is counted from the start. Add your own website in one step.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(["exora", "posthog"] as const).map((p) => {
          const o = options[p];
          return (
            <Card key={p} className={`gap-4 p-6 shadow-none ${p === "exora" ? "border-primary" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                {o.icon}
                <Badge variant={p === "exora" ? "default" : "outline"} className="font-normal">
                  {o.tag}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold">{o.name}</h3>
              <ul className="flex-1 space-y-2 text-sm">
                {o.points.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {t}
                  </li>
                ))}
              </ul>
              <Button variant={p === "exora" ? "default" : "outline"} disabled={!canManage || !preview} onClick={p === "exora" ? onExora : onPostHog}>
                {p === "exora" ? "Use Exora analytics" : <><PostHogIcon className="size-4" /> Connect PostHog</>}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {!preview
          ? "Website analytics opens with the next update."
          : canManage
            ? "You can switch later. The code on your website stays the same."
            : "Ask an administrator to switch on website analytics."}
      </p>
    </div>
  );
}

const ranges = [
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
] as const;
const n = (v: number) => v.toLocaleString("en-IN");

function Overview({ data, open }: { data: AnalyticsData; open: (t: ATab) => void }) {
  const [range, setRange] = useState<(typeof ranges)[number][0]>("30");
  const days = Number(range);
  const { series, now, before } = summarize(data.days, days);
  const label = `previous ${days} days`;
  const rate = percent(now.booked, now.visitors);
  const sources = ranked(now.sources);
  const top = sources[0];

  const ph = data.posthog;
  const ownSites = data.sites.filter((s) => s.kind === "own");
  return (
    <div className="space-y-6">
      {ph?.status === "testing" && (
        <p className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Loader2 className="size-4 animate-spin" /> Checking your PostHog keys. Numbers keep showing while we connect.
        </p>
      )}
      {!ownSites.length && (
        <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4 shadow-none">
          <p className="text-sm">
            <span className="font-medium">Only your booking page is counted.</span> Add your clinic website to see everyone who visits it.
          </p>
          <Button size="sm" onClick={() => open("websites")}>
            Add your website <ArrowRight />
          </Button>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {data.provider === "posthog" ? <PostHogIcon className="size-4 text-foreground" /> : <ShieldCheck className="size-4" />}
          Counted by {data.provider === "posthog" ? "PostHog" : "Exora analytics"}
        </p>
        <div className="flex items-center gap-2">
          {ph?.status === "connected" && (
            <Button size="sm" variant="outline" nativeButton={false} render={<a href={`${regions[ph.region].app}/project/${ph.projectId}`} target="_blank" rel="noreferrer" />}>
              Open in PostHog <ExternalLink />
            </Button>
          )}
          <Pick id="analytics-range" className="w-40" value={range} options={ranges} onChange={setRange} />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {(
          [
            ["Visitors", n(now.visitors), now.visitors, before.visitors],
            ["Pages viewed", n(now.views), now.views, before.views],
            ["Booked from your website", n(now.booked), now.booked, before.booked],
            ["Visitors who booked", `${rate.toFixed(1)}%`, rate, percent(before.booked, before.visitors)],
          ] as const
        ).map(([title, , value, prev]) => (
          <GrowthMetric key={title} label={title} value={value} before={prev} suffix={title === "Visitors who booked" ? "%" : undefined} decimals={title === "Visitors who booked" ? 1 : 0} context={`Last ${days} days · compared with ${label}`} />
        ))}
      </div>
      {top && (
        <p className="text-sm">
          Most visitors found you on <span className="font-medium">{sourceNames[top[0]]}</span>. About {Math.max(1, Math.round(rate))} in every 100 visitors booked an
          appointment.
        </p>
      )}
      <Card className="gap-3 p-5 shadow-none">
        <h2 className="text-sm font-semibold">Visitors each day</h2>
        <div className="arc-demo-scope">
          <ArcLineChart
            label="Visitors each day"
            series={[{ key: "visitors", label: "Visitors" }]}
            data={series.map((day) => ({ key: day.date, label: day.date, axisLabel: day.date.slice(5), values: { visitors: day.visitors } }))}
          />
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-4 p-5 shadow-none">
          <h2 className="text-sm font-semibold">Where visitors came from</h2>
          <GrowthSplit label="Visitor sources" segments={sources.map(([id, value]) => ({ id, label: sourceNames[id], value }))} />
          <p className="text-xs text-muted-foreground">Links from your Google listing and WhatsApp messages are tagged, so they show up by name.</p>
        </Card>
        <Card className="gap-4 p-5 shadow-none">
          <h2 className="text-sm font-semibold">From visit to booking</h2>
          <GrowthBar label="People at each booking stage" period={`Last ${days} days`} category="Stage" averageLabel="Average per stage"
            data={[
              { key: "visit", label: "Visited your website", axisLabel: "Visited", value: now.visitors },
              { key: "start", label: "Opened booking", axisLabel: "Opened booking", value: now.started },
              { key: "book", label: "Booked an appointment", axisLabel: "Booked", value: now.booked },
            ]} />
          <p className="text-xs text-muted-foreground">Opened booking: {Math.round(percent(now.started, now.visitors))}% of visitors. Booked: {Math.round(percent(now.booked, now.started))}% of people who opened booking.</p>
          <p className="text-xs text-muted-foreground">Bookings are counted from your appointment book, so they match the Appointments page.</p>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="gap-0 p-0 shadow-none">
          <h2 className="px-5 pt-5 pb-3 text-sm font-semibold">Most visited pages</h2>
          <ul className="divide-y">
            {[...data.pages].sort((a, b) => b.share - a.share).map((p) => (
              <li key={p.path} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{p.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.path}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{n(Math.round(now.views * p.share))} views</span>
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
                  <span className="font-semibold tabular-nums">{n(now.clicks[k])}</span>
                  <span className="w-28 text-right">
                    <Delta now={now.clicks[k]} before={before.clicks[k]} label="before" />
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="gap-3 p-5 shadow-none">
            <h2 className="text-sm font-semibold">Devices</h2>
            <GrowthSplit label="Visitor devices" segments={(Object.keys(deviceNames) as Device[]).map(id => ({ id, label: deviceNames[id], value: now.devices[id] }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}

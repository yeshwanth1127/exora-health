import { useEffect, useState, type ComponentType } from "react";
import { ArrowRight, Check, ExternalLink, Globe, Link2, Loader2, MapPin, Navigation, Phone, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/workspace";
import { GoogleIcon, PostHogIcon, WhatsAppIcon } from "@/components/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  type Source,
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
        <Tabs value={tab} onValueChange={(v) => open(v as ATab)}>
          <TabsList variant="line">
            {tabs.map(([k, label]) => (
              <TabsTrigger key={k} value={k} className="flex-none px-3">
                {label}
                {k === "websites" && waiting > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">{waiting}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {!canManage && <p className="rounded-md border bg-muted/40 p-3 text-sm">You can see the numbers. Ask an administrator to change settings or add websites.</p>}
        {tab === "overview" && <Overview data={data} open={open} />}
        {tab === "websites" && <Websites data={data} change={change} clinic={clinic} canManage={canManage} />}
        {tab === "settings" && <Settings data={data} canManage={canManage} onExora={() => (use("exora"), toast.success("Switched to Exora analytics"))} onPostHog={() => setConnecting(true)} />}
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
const sourceIcons: Record<Source, ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  maps: ({ className }) => <MapPin className={`${className} text-[#ea4335]`} />,
  whatsapp: WhatsAppIcon,
  social: Share2,
  direct: Link2,
  other: Globe,
};
const deviceColors: Record<Device, string> = { mobile: "bg-primary", desktop: "bg-primary/55", tablet: "bg-primary/25" };
const n = (v: number) => v.toLocaleString("en-IN");

function Overview({ data, open }: { data: AnalyticsData; open: (t: ATab) => void }) {
  const [range, setRange] = useState<(typeof ranges)[number][0]>("30");
  const days = Number(range);
  const { series, now, before } = summarize(data.days, days);
  const label = `previous ${days} days`;
  const rate = percent(now.booked, now.visitors);
  const sources = ranked(now.sources);
  const top = sources[0];
  const max = Math.max(...series.map((d) => d.visitors), 1);
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Visitors", n(now.visitors), now.visitors, before.visitors],
            ["Pages viewed", n(now.views), now.views, before.views],
            ["Booked from your website", n(now.booked), now.booked, before.booked],
            ["Visitors who booked", `${rate.toFixed(1)}%`, rate, percent(before.booked, before.visitors)],
          ] as const
        ).map(([title, shown, value, prev]) => (
          <Card key={title} className="gap-1 p-4 shadow-none">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tabular-nums">{shown}</p>
            <Delta now={value} before={prev} label={label} />
          </Card>
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
        <div className="flex h-40 items-end gap-px" role="img" aria-label={`Visitors each day, ${ranges.find(([k]) => k === range)?.[1].toLowerCase()}`}>
          {series.map((d) => (
            <div
              key={d.date}
              className="flex-1 rounded-t-sm bg-primary/70 transition-colors hover:bg-primary"
              style={{ height: `${(d.visitors / max) * 100}%` }}
              title={`${new Date(d.date).toLocaleDateString([], { day: "numeric", month: "short" })}: ${d.visitors} visitors`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{series[0] && new Date(series[0].date).toLocaleDateString([], { day: "numeric", month: "short" })}</span>
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
                <li key={k} className="grid grid-cols-[1rem_7.5rem_1fr_2.5rem] items-center gap-2.5 sm:grid-cols-[1.25rem_10rem_1fr_3rem] sm:gap-3 text-sm">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="truncate">{sourceNames[k]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary/70" style={{ width: `${percent(v, sources[0][1])}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{Math.round(percent(v, now.visitors))}%</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Links from your Google listing and WhatsApp messages are tagged, so they show up by name.</p>
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
                    <span className="font-semibold">{n(v)}</span>
                    {prev !== null && <span className="ml-2 text-xs text-muted-foreground">{Math.round(percent(v, prev))}% of the step before</span>}
                  </span>
                </div>
                <span className="block h-3 overflow-hidden rounded bg-muted">
                  <span className="block h-full rounded bg-emerald-600/80" style={{ width: `${Math.max(percent(v, now.visitors), 1.5)}%` }} />
                </span>
              </li>
            ))}
          </ol>
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
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {(Object.keys(deviceNames) as Device[]).map((k) => (
                <span key={k} className={deviceColors[k]} style={{ width: `${percent(now.devices[k], now.visitors)}%` }} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(Object.keys(deviceNames) as Device[]).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${deviceColors[k]}`} />
                  {deviceNames[k]} {Math.round(percent(now.devices[k], now.visitors))}%
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
} from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand-icons";
import { toast } from "sonner";
import { PageTitle } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { request } from "./client";
import { useQuery, useWorkspace } from "./hooks";
import { today } from "./model";
import { addDays } from "./forms";
import type { FacilityDetail, Practitioner, Session } from "./types";
import { RegisterFirst, useClinicBasics } from "./clinic-basics";
import { chatLink } from "./whatsapp-setup";
import {
  checkedFields,
  describeHours,
  hoursFromSessions,
  progress,
  score,
  seed,
  suggestCategories,
  tasks,
  type Exora,
  type GbpData,
  type Listing,
  type Period,
  type Task,
} from "./google-profile";
import { Profile } from "./GoogleProfile";
import { Insights, Photos, Posts, Reviews } from "./GoogleEngage";

export type GChange = (fn: (d: GbpData) => GbpData) => void;

export function GoogleBusiness() {
  const { facility } = useWorkspace();
  return <GooglePage key={facility.facilityId} />;
}

const localHM = (value: string, timeZone: string) =>
  /^\d\d:\d\d/.test(value)
    ? value.slice(0, 5)
    : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));

/** Clinic opening hours = every doctor's sessions over the next two weeks, per weekday. */
function useClinicHours(doctors: Practitioner[], facilityId: string, timeZone: string) {
  const [hours, setHours] = useState<Period[] | null>(null);
  const ids = doctors.filter((d) => d.calendarId).map((d) => d.staffId).slice(0, 30).join(",");
  useEffect(() => {
    let off = false;
    const from = today(timeZone);
    Promise.all(
      ids
        .split(",")
        .filter(Boolean)
        .map((id) =>
          request<{ items: Session[] }>(`/v1/practitioners/${id}/sessions?from=${from}&to=${addDays(from, 13)}`).catch(() => ({ items: [] as Session[] })),
        ),
    ).then((rs) => {
      if (off) return;
      const all = rs.flatMap((r) => r.items).filter((s) => s.facilityId === facilityId);
      setHours(hoursFromSessions(all.map((s) => ({ sessionOn: s.sessionOn, open: localHM(s.startsAt, timeZone), close: localHM(s.endsAt, timeZone) }))));
    });
    return () => {
      off = true;
    };
  }, [ids, facilityId, timeZone]);
  return hours;
}

function GooglePage() {
  const { facility } = useWorkspace();
  const basics = useClinicBasics();
  const detail = useQuery<FacilityDetail>(`/v1/facilities/${facility.facilityId}`);
  const links = useQuery<{ items: { facilityId: string; bookingUrl: string }[] }>(`/v1/booking-links?facilityId=${facility.facilityId}`);
  const hours = useClinicHours(basics.loading ? [] : basics.clinic.doctors, facility.facilityId, facility.timezone);
  if (basics.loading || detail.loading || links.loading || hours === null)
    return <p className="text-sm text-muted-foreground">Loading Google Business…</p>;
  if (basics.missing.length)
    return (
      <RegisterFirst
        title="Google Business"
        missing={basics.missing}
        text="Your Google listing shows your real hours, specialities and a Book button. Finish these first so patients find the right details."
      />
    );
  const d = detail.data;
  let wa: string | null = null;
  try {
    const phone = JSON.parse(localStorage.getItem(`exora:whatsapp-setup:${facility.facilityId}`) ?? "{}")?.connected?.phone;
    wa = phone ? chatLink(phone) : null;
  } catch {
    /* WhatsApp not set up in this browser. */
  }
  const { clinic, directory, prices } = basics;
  const specialities = [
    ...new Set([...clinic.departments.map((x) => x.name), ...clinic.doctors.map((x) => x.specialtyName ?? "").filter(Boolean)]),
  ];
  const exora: Exora = {
    name: facility.name,
    phone: d?.phone ?? "",
    address: [d?.addressLine1, d?.addressLine2, d?.city, d?.pincode].filter(Boolean).join(", "),
    city: d?.city ?? facility.city ?? "",
    facilityType: d?.facilityType ?? facility.facilityType,
    hours,
    specialities,
    doctors: clinic.doctors.length,
    services: (directory?.services ?? [])
      .filter((s) => s.isPublic && s.status !== "inactive")
      .slice(0, 15)
      .map((s) => {
        const fees = prices.filter((p) => p.healthcareServiceId === s.healthcareServiceId).map((p) => p.feeMinor / 100);
        return { name: s.name, price: fees.length ? Math.min(...fees) : null };
      }),
    bookUrl:
      links.data?.items.find((l) => l.facilityId === facility.facilityId)?.bookingUrl ??
      new URL(`book.html?branch=${facility.facilityId}`, location.origin + import.meta.env.BASE_URL).toString(),
    whatsappUrl: wa,
  };
  return <Google exora={exora} />;
}

// ponytail: UI-first phase keeps the Google listing in this browser; the backend phase reads and writes Google.
function useGbp(key: string, make: () => GbpData) {
  const [data, set] = useState<GbpData>(() => {
    try {
      const old = JSON.parse(localStorage.getItem(key) ?? "null") as GbpData | null;
      return old?.v === 1 ? old : make();
    } catch {
      return make();
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
  ["profile", "Profile"],
  ["reviews", "Reviews"],
  ["posts", "Posts"],
  ["photos", "Photos"],
  ["insights", "Insights"],
] as const;
export type GTab = (typeof tabs)[number][0];

function Google({ exora }: { exora: Exora }) {
  const { facility, can } = useWorkspace();
  const [data, change] = useGbp(`exora:google:${facility.facilityId}`, () => seed(exora, Date.now()));
  const [tab, setTab] = useState<GTab>(() => {
    const t = new URLSearchParams(location.search).get("tab");
    return tabs.some(([k]) => k === t) ? (t as GTab) : "overview";
  });
  const [section, setSection] = useState<string | null>(null);
  const canManage = can("growth.manage");
  const open = (t: GTab, s: string | null = null) => {
    setTab(t);
    setSection(s);
    history.replaceState(history.state, "", `?tab=${t}`);
  };
  const preview = <Badge variant="outline" className="font-normal">UI preview · saved in this browser</Badge>;
  if (!data.account)
    return (
      <>
        <PageTitle title="Google Business" icon={<GoogleIcon className="size-7" />} action={preview} />
        <Connect exora={exora} canManage={canManage} onConnected={(email) => change((d) => ({ ...d, account: { email, listing: d.listing.name } }))} />
      </>
    );
  const unreplied = data.reviews.filter((r) => !r.reply).length;
  return (
    <>
      <PageTitle title="Google Business" icon={<GoogleIcon className="size-7" />} action={preview} />
      <div className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => open(v as GTab)}>
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList variant="line">
              {tabs.map(([k, label]) => (
                <TabsTrigger key={k} value={k} className="flex-none px-3">
                  {label}
                  {k === "reviews" && unreplied > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#1a73e8] px-1 text-[10px] font-semibold text-white">{unreplied}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
        {!canManage && <p className="rounded-md border bg-muted/40 p-3 text-sm">You can see the listing. Ask an administrator to make changes.</p>}
        {tab === "overview" && <Overview data={data} change={change} exora={exora} open={open} canManage={canManage} />}
        {tab === "profile" && <Profile key={section ?? ""} data={data} change={change} exora={exora} section={section} canManage={canManage} />}
        {tab === "reviews" && <Reviews data={data} change={change} exora={exora} canManage={canManage} />}
        {tab === "posts" && <Posts data={data} change={change} exora={exora} canManage={canManage} />}
        {tab === "photos" && <Photos data={data} change={change} canManage={canManage} />}
        {tab === "insights" && <Insights data={data} />}
      </div>
    </>
  );
}

function Connect({ exora, canManage, onConnected }: { exora: Exora; canManage: boolean; onConnected: (email: string) => void }) {
  const [step, setStep] = useState<"closed" | "signin" | "pick">("closed");
  const [ownerHelp, setOwnerHelp] = useState(false);
  const ask = `Hi, please add me as a manager of our Google listing “${exora.name}” so I can keep it updated from Exora. Google Business Profile → Menu → Business Profile settings → Managers → Add → my email.`;
  const sample: Listing = { ...seed(exora, Date.now()).listing, phone: exora.phone, bookUrl: exora.bookUrl, whatsappUrl: exora.whatsappUrl ?? "wa.me", hours: exora.hours, categories: suggestCategories(exora.specialities) };
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Get more patients from Google</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Connect your Google listing once. We fill it in from what you've set up here and keep it right when your hours or doctors change.
          </p>
        </div>
        <ul className="space-y-3">
          {(
            [
              [CalendarCheck, "A Book button", "Patients book straight from Google Search and Maps."],
              [WhatsAppIcon, "A WhatsApp button", "For patients who'd rather message than call."],
              [Clock, "Hours that are always right", "Taken from your doctors' schedules, holidays included."],
              [Star, "Reviews in one place", "Reply quickly with suggested replies that keep patient details private."],
            ] as const
          ).map(([Icon, title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1a73e8]/10">
                <Icon className="size-4 text-[#1a73e8]" />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!canManage} onClick={() => setStep("signin")}>
            <GoogleIcon className="size-4" /> Connect Google
          </Button>
          <span className="text-xs text-muted-foreground">Sign in with the Google account that manages your listing on Maps.</span>
        </div>
        {!canManage && <p className="text-sm text-muted-foreground">Ask an administrator to connect Google.</p>}
        <Card className="gap-0 divide-y p-0 shadow-none">
          <Help title="No listing on Google yet?">
            Create it on Google first. It takes about 5 minutes, then Google verifies it, usually by video or a phone call.{" "}
            <a className="text-[#1a73e8] underline-offset-2 hover:underline" href="https://business.google.com/create" target="_blank" rel="noreferrer">
              Create a listing
            </a>
          </Help>
          <Help title="Someone else manages the listing?">
            Ask them to add you as a manager.{" "}
            <button type="button" className="text-[#1a73e8] underline-offset-2 hover:underline" onClick={() => setOwnerHelp(true)}>
              Show a message to send them
            </button>
            {ownerHelp && (
              <div className="mt-2 space-y-2 rounded-md bg-muted/50 p-3 text-xs">
                <p>{ask}</p>
                <Button size="xs" variant="outline" onClick={() => copy(ask, "Message copied")}>
                  <Copy /> Copy
                </Button>
              </div>
            )}
          </Help>
        </Card>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">How your listing can look</p>
        <ListingCard listing={sample} rating={null} />
      </div>
      <Dialog open={step !== "closed"} onOpenChange={(o) => !o && setStep("closed")}>
        <DialogContent>
          {step === "signin" ? (
            <>
              <DialogHeader>
                <DialogTitle>Connect Google</DialogTitle>
                <DialogDescription>Google opens a window where you:</DialogDescription>
              </DialogHeader>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                <li>Pick the Google account that manages your listing</li>
                <li>Allow Exora Health to manage your Business Profile</li>
                <li>Come back here and choose the listing for {exora.name}</li>
              </ol>
              <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                Google sign-in is switched on once Exora's Google access is approved.
                {import.meta.env.DEV && " In development you can simulate it."}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("closed")}>
                  Cancel
                </Button>
                {import.meta.env.DEV && <Button onClick={() => setStep("pick")}>Simulate sign-in</Button>}
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Choose your listing</DialogTitle>
                <DialogDescription>We matched these by phone number and address.</DialogDescription>
              </DialogHeader>
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-lg border border-primary bg-muted/40 p-4 text-left"
                onClick={() => {
                  onConnected("admin@clinic.example");
                  setStep("closed");
                  toast.success("Google connected");
                }}
              >
                <MapPin className="mt-0.5 size-4 text-[#ea4335]" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{exora.name}</span>
                  <span className="block text-xs text-muted-foreground">{exora.address || exora.city}</span>
                  <span className="mt-1 flex gap-1.5">
                    <Badge variant="outline" className="font-normal">Verified</Badge>
                    <Badge variant="outline" className="font-normal">You're an owner</Badge>
                  </span>
                </span>
                <ArrowRight className="size-4 self-center" />
              </button>
              <p className="text-xs text-muted-foreground">
                Not in the list? It may be under another Google account, or not verified yet.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Help({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 text-sm">
      <p className="font-medium">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

export const copy = (text: string, done: string) =>
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(done))
    .catch(() => toast.error("Copy failed. Select the text instead."));

function Overview({
  data,
  change,
  exora,
  open,
  canManage,
}: {
  data: GbpData;
  change: GChange;
  exora: Exora;
  open: (t: GTab, s?: string | null) => void;
  canManage: boolean;
}) {
  const { go } = useWorkspace();
  const list = tasks(data, exora, Date.now());
  const s = score(list);
  const todo = list.filter((t) => !t.done);
  const [showDone, setShowDone] = useState(false);
  const setListing = (patch: Partial<Listing>) => change((d) => ({ ...d, listing: { ...d.listing, ...patch } }));
  const reach = Math.min(100, s + todo.slice(0, 3).reduce((n, t) => n + t.weight, 0));
  /** One-tap fixes where Exora already has the answer; everything else opens the right place. */
  const quick: Partial<Record<string, [string, () => void]>> = {
    book: ["Add", () => (setListing({ bookUrl: exora.bookUrl }), toast.success("Book button added"))],
    whatsapp: exora.whatsappUrl
      ? ["Add", () => (setListing({ whatsappUrl: exora.whatsappUrl }), toast.success("WhatsApp button added"))]
      : ["Set up WhatsApp", () => go("whatsapp")],
    hours: exora.hours.length ? ["Use my schedule", () => (setListing({ hours: exora.hours }), toast.success("Hours updated on Google"))] : undefined,
    categories: suggestCategories(exora.specialities).length
      ? [`Add ${suggestCategories(exora.specialities).length} specialities`, () => (setListing({ categories: suggestCategories(exora.specialities) }), toast.success("Specialities added"))]
      : undefined,
    services: exora.services.length >= 3 ? ["Add from Catalogue", () => (setListing({ services: exora.services }), toast.success("Services added"))] : undefined,
    phone: exora.phone ? ["Use " + exora.phone, () => (change((d) => ({ ...d, listing: { ...d.listing, phone: exora.phone }, googleChanges: d.googleChanges.filter((c) => c.field !== "phone") })), toast.success("Phone number updated"))] : undefined,
  };
  const action = (t: Task) => quick[t.id] ?? ["Open", () => open(t.tab, t.section ?? null)];
  const avg = data.reviews.reduce((n, r) => n + r.stars, 0) / Math.max(data.reviews.length, 1);
  return (
    <div className="space-y-6">
      {data.googleChanges.map((c) => (
        <Card key={c.field} className="flex-row flex-wrap items-center gap-3 border-amber-500/40 bg-amber-500/5 p-4 shadow-none">
          <AlertTriangle className="size-4 text-amber-600" />
          <p className="flex-1 text-sm">
            <span className="font-medium">Google changed your {c.label.toLowerCase()}</span> to {c.theirs} after a public suggestion. Yours is {c.ours || "not set"}.
          </p>
          <Button
            size="sm"
            disabled={!canManage}
            onClick={() => {
              change((d) => ({ ...d, listing: { ...d.listing, [c.field]: c.ours }, googleChanges: d.googleChanges.filter((x) => x !== c) }));
              toast.success("Changed back on Google");
            }}
          >
            Use ours
          </Button>
          <Button size="sm" variant="ghost" disabled={!canManage} onClick={() => change((d) => ({ ...d, googleChanges: d.googleChanges.filter((x) => x !== c) }))}>
            Keep Google's
          </Button>
        </Card>
      ))}
      {checkedFields.filter((f) => data.checking[f]).map((f) => (
        <p key={f} className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <Clock className="size-4 text-muted-foreground" /> Google is checking your new {f === "primaryCategory" ? "main category" : f}. This usually takes a few days.
        </p>
      ))}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="gap-0 p-0 shadow-none">
            <div className="flex items-center gap-5 border-b p-5">
              <ScoreRing value={s} />
              <div>
                <p className="text-lg font-semibold">Profile score {s}/100</p>
                <p className="text-sm text-muted-foreground">
                  {todo.length ? `${Math.min(3, todo.length)} quick fix${todo.length === 1 ? "" : "es"} to reach ${reach}.` : "Your listing is complete. Keep posting and replying to reviews."}
                </p>
              </div>
            </div>
            <ul className="divide-y">
              {todo.map((t) => {
                const [label, run] = action(t);
                return (
                  <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-medium text-muted-foreground">+{t.weight}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.why}</p>
                    </div>
                    <Button size="sm" variant={quick[t.id] ? "default" : "outline"} disabled={!canManage && !!quick[t.id]} onClick={run}>
                      {label}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {list.length > todo.length && (
              <>
                <button type="button" onClick={() => setShowDone(!showDone)} className="flex w-full items-center gap-2 border-t px-5 py-3 text-left text-sm text-muted-foreground">
                  <ChevronDown className={`size-4 transition-transform ${showDone ? "rotate-180" : ""}`} /> Done ({list.length - todo.length})
                </button>
                {showDone && (
                  <ul className="divide-y border-t">
                    {list.filter((t) => t.done).map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm text-muted-foreground">
                        <Check className="size-4 text-emerald-600" /> {t.title}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">This month on Google</h2>
              <Button size="xs" variant="ghost" onClick={() => open("insights")}>
                Insights <ArrowRight />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {(
                [
                  ["Profile views", data.month.search + data.month.maps, data.lastMonth.search + data.lastMonth.maps],
                  ["Calls", data.month.calls, data.lastMonth.calls],
                  ["Directions", data.month.directions, data.lastMonth.directions],
                  ["Website clicks", data.month.website, data.lastMonth.website],
                  ["Bookings", data.month.bookings, data.lastMonth.bookings],
                ] as const
              ).map(([label, n, before]) => (
                <Card key={label} className="gap-0 p-4 shadow-none">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-semibold tabular-nums">{n.toLocaleString()}</p>
                  <Delta now={n} before={before} />
                </Card>
              ))}
            </div>
          </div>
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Your listing on Google now</p>
          <ListingCard listing={data.listing} rating={data.reviews.length ? { avg, count: data.reviews.length } : null} />
        </div>
      </div>
    </div>
  );
}

export function Delta({ now, before, label = "last month" }: { now: number; before: number; label?: string }) {
  if (!before) return <p className="text-[11px] text-muted-foreground">{now ? "New" : "—"}</p>;
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <p className={`text-[11px] ${pct > 0 ? "text-emerald-700" : pct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct)}% vs {label}
    </p>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 26,
    c = 2 * Math.PI * r;
  const color = value >= 80 ? "#188038" : value >= 50 ? "#f9ab00" : "#d93025";
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0" role="img" aria-label={`Profile score ${value} out of 100`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" className="fill-foreground text-[15px] font-semibold">
        {value}
      </text>
    </svg>
  );
}

/** A Google Search / Maps style card, so changes are seen the way patients see them. */
export function ListingCard({ listing: l, rating }: { listing: Listing; rating: { avg: number; count: number } | null }) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const hm = now.toTimeString().slice(0, 5);
  const todays = l.hours.filter((p) => p.day === day);
  const openNow = todays.find((p) => p.open <= hm && hm < p.close);
  const actions: [ComponentType<{ className?: string }>, string, boolean][] = [
    [CalendarCheck, "Book", !!l.bookUrl],
    [WhatsAppIcon, "WhatsApp", !!l.whatsappUrl],
    [Navigation, "Directions", true],
    [Phone, "Call", !!l.phone],
    [Globe, "Website", !!l.website],
    [Share2, "Share", true],
  ];
  const photo = [...l.photos.cover, ...l.photos.outside, ...l.photos.inside][0];
  return (
    <div className="overflow-hidden rounded-xl border bg-white text-[#202124] shadow-sm dark:bg-white">
      <div className="grid h-28 grid-cols-3 gap-0.5 bg-[#f1f3f4]">
        {[photo, l.photos.inside[0], l.photos.team[0]].map((p, i) => (
          <div key={i} className="grid place-items-center overflow-hidden text-[10px] text-[#5f6368]">
            {p ? <PhotoThumb name={p.name} id={p.id} /> : i === 0 ? "No photos yet" : ""}
          </div>
        ))}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-[22px] leading-tight">{l.name}</p>
        <p className="flex items-center gap-1 text-sm text-[#70757a]">
          {rating ? (
            <>
              <span className="text-[#202124]">{rating.avg.toFixed(1)}</span>
              <span className="text-[#fbbc04]">{"★".repeat(Math.round(rating.avg))}</span>({rating.count}) ·
            </>
          ) : null}{" "}
          {l.primaryCategory}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {actions
            .filter(([, , on]) => on)
            .map(([Icon, label]) => (
              <span
                key={label}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${label === "Book" ? "border-[#1a73e8] bg-[#1a73e8] text-white" : label === "WhatsApp" ? "border-[#25d366] text-[#128c7e]" : "border-[#dadce0] text-[#1a73e8]"}`}
              >
                <Icon className="size-3.5" /> {label}
              </span>
            ))}
        </div>
        {l.description && <p className="line-clamp-3 text-[13px] text-[#4d5156]">{l.description}</p>}
        <dl className="space-y-1.5 border-t pt-3 text-[13px]">
          {l.address && (
            <p className="flex gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" /> {l.address}
            </p>
          )}
          <p className="flex gap-2">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" />
            {l.hours.length ? (
              <span>
                <span className={openNow ? "text-[#188038]" : "text-[#d93025]"}>{openNow ? "Open" : "Closed"}</span>
                {openNow ? ` · Closes ${openNow.close}` : todays[0] ? ` · Opens ${todays[0].open}` : ""}
                <span className="block text-[11px] text-[#70757a]">{describeHours(l.hours)}</span>
              </span>
            ) : (
              <span className="text-[#70757a]">Add opening hours</span>
            )}
          </p>
          {l.phone && (
            <p className="flex gap-2">
              <Phone className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" /> {l.phone}
            </p>
          )}
          {l.website && (
            <p className="flex gap-2 truncate">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" /> {l.website.replace(/^https?:\/\//, "")}
            </p>
          )}
        </dl>
        {l.categories.length > 0 && <p className="text-[11px] text-[#70757a]">Also: {l.categories.slice(0, 4).join(" · ")}</p>}
      </div>
    </div>
  );
}

export function PhotoThumb({ id, name }: { id: string; name: string }) {
  const url = photoUrls.get(id);
  return url ? <img src={url} alt={name} className="size-full object-cover" /> : <span className="truncate px-2">{name}</span>;
}
/** Object URLs for photos picked this visit. */
export const photoUrls = new Map<string, string>();

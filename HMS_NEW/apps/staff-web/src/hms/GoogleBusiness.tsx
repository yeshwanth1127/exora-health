import { useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Share2,
} from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "@/components/brand-icons";
import { toast } from "sonner";
import { PageTitle } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntentKeys, request } from "./client";
import { useQuery, useWorkspace } from "./hooks";
import { today } from "./model";
import { addDays } from "./forms";
import type { FacilityDetail, Practitioner, Session } from "./types";
import { useClinicBasics } from "./clinic-basics";
import {
  checkedFields,
  describeHours,
  hoursFromSessions,
  score,
  suggestCategories,
  tasks,
  type Exora,
  type GbpData,
  type Listing,
  type Period,
  type Task,
} from "./google-profile";
import { Profile } from "./GoogleProfile";
import { Posts, Reviews } from "./GoogleEngage";

export type GChange = (fn: (d: GbpData) => GbpData) => Promise<boolean>;

export function GoogleBusiness() {
  const { facility } = useWorkspace();
  return <GooglePage key={facility.facilityId} />;
}

const localHM = (value: string, timeZone: string) =>
  /^\d\d:\d\d/.test(value)
    ? value.slice(0, 5)
    : new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value));

/** Clinic opening hours = every doctor's sessions over the next two weeks, per weekday. */
function useClinicHours(
  doctors: Practitioner[],
  facilityId: string,
  timeZone: string,
) {
  const [hours, setHours] = useState<Period[] | null>(null);
  const ids = doctors
    .filter((d) => d.calendarId)
    .map((d) => d.staffId)
    .slice(0, 30)
    .join(",");
  useEffect(() => {
    let off = false;
    const from = today(timeZone);
    Promise.all(
      ids
        .split(",")
        .filter(Boolean)
        .map((id) =>
          request<{ items: Session[] }>(
            `/v1/practitioners/${id}/sessions?from=${from}&to=${addDays(from, 13)}`,
          ).catch(() => ({ items: [] as Session[] })),
        ),
    ).then((rs) => {
      if (off) return;
      const all = rs
        .flatMap((r) => r.items)
        .filter((s) => s.facilityId === facilityId);
      setHours(
        hoursFromSessions(
          all.map((s) => ({
            sessionOn: s.sessionOn,
            open: localHM(s.startsAt, timeZone),
            close: localHM(s.endsAt, timeZone),
          })),
        ),
      );
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
  const detail = useQuery<FacilityDetail>(
    `/v1/facilities/${facility.facilityId}`,
  );
  const links = useQuery<{
    items: { facilityId: string; bookingUrl: string }[];
  }>(`/v1/booking-links?facilityId=${facility.facilityId}`);
  const hours = useClinicHours(
    basics.loading ? [] : basics.clinic.doctors,
    facility.facilityId,
    facility.timezone,
  );
  if (basics.loading || detail.loading || links.loading || hours === null)
    return (
      <p className="text-sm text-muted-foreground">Loading Google Business…</p>
    );
  const d = detail.data;
  const wa: string | null = null;
  const { clinic, directory, prices } = basics;
  const specialities = [
    ...new Set([
      ...clinic.departments.map((x) => x.name),
      ...clinic.doctors.map((x) => x.specialtyName ?? "").filter(Boolean),
    ]),
  ];
  const exora: Exora = {
    name: facility.name,
    phone: d?.phone ?? "",
    address: [d?.addressLine1, d?.addressLine2, d?.city, d?.pincode]
      .filter(Boolean)
      .join(", "),
    city: d?.city ?? facility.city ?? "",
    facilityType: d?.facilityType ?? facility.facilityType,
    hours,
    specialities,
    doctors: clinic.doctors.length,
    services: (directory?.services ?? [])
      .filter((s) => s.isPublic && s.status !== "inactive")
      .slice(0, 15)
      .map((s) => {
        const fees = prices
          .filter((p) => p.healthcareServiceId === s.healthcareServiceId)
          .map((p) => p.feeMinor / 100);
        return { name: s.name, price: fees.length ? Math.min(...fees) : null };
      }),
    bookUrl:
      links.data?.items.find((l) => l.facilityId === facility.facilityId)
        ?.bookingUrl ??
      new URL(
        `book.html?branch=${facility.facilityId}`,
        location.origin + import.meta.env.BASE_URL,
      ).toString(),
    whatsappUrl: wa,
  };
  return <Google exora={exora} />;
}

function useGbp(facilityId: string) {
  const query = useQuery<GbpData>(
    `/v1/google-business?facilityId=${facilityId}`,
    60000,
  );
  const [busy, setBusy] = useState(false);
  const [keys] = useState(() => new IntentKeys());
  const [guard] = useState(() => ({ busy: false }));
  const change: GChange = async (fn) => {
    if (!query.data || guard.busy) return false;
    const old = query.data,
      next = fn(old);
    const action: any = { version: old.version };
    const different = (a: unknown, b: unknown) =>
      JSON.stringify(a) !== JSON.stringify(b);
    if (different(next.listing, old.listing)) {
      action.action = "profile";
      action.patch = {};
      const supported = [
        "name",
        "phone",
        "website",
        "description",
        "hours",
      ] as const;
      const changed = Object.keys(old.listing).filter((k) =>
        different(
          next.listing[k as keyof Listing],
          old.listing[k as keyof Listing],
        ),
      );
      if (
        changed.some(
          (k) => !supported.includes(k as (typeof supported)[number]),
        )
      ) {
        toast.error(
          "This field is not available for publishing from Exora yet.",
        );
        return false;
      }
      for (const k of supported)
        if (different(next.listing[k], old.listing[k]))
          action.patch[k] = next.listing[k];
    } else if (different(next.reviews, old.reviews)) {
      const review = next.reviews.find((r) =>
        different(r.reply, old.reviews.find((o) => o.id === r.id)?.reply),
      );
      if (!review) return false;
      action.action = "reply";
      action.reviewId = review.id;
      action.text = review.reply?.text ?? null;
    } else if (different(next.posts, old.posts)) {
      const added = next.posts.find(
          (p) => !old.posts.some((o) => o.id === p.id),
        ),
        removed = old.posts.find((p) => !next.posts.some((o) => o.id === p.id));
      if (added) {
        if (added.image) {
          toast.error("Post images are not available yet.");
          return false;
        }
        Object.assign(action, {
          action: "post",
          kind: added.kind,
          title: added.title,
          text: added.text,
          button: added.button,
          url:
            added.button === "book" ? exoraBookingUrl() : old.listing.website,
          ...(added.dates ? { dates: added.dates } : {}),
          ...(added.status === "scheduled"
            ? { publishAt: new Date(added.at).toISOString() }
            : {}),
        });
      } else if (removed) {
        action.action = "delete_post";
        action.postId = removed.id;
      } else return false;
    } else {
      toast.error("This setting is not available yet.");
      return false;
    }
    function exoraBookingUrl() {
      return old.listing.bookUrl || old.listing.website;
    }
    guard.busy = true;
    setBusy(true);
    const path = `/v1/google-business/actions?facilityId=${facilityId}`;
    return request(path, {
      method: "POST",
      body: action,
      idempotencyKey: keys.for(path, action),
    })
      .then(async (result: any) => {
        keys.complete(path, action);
        await query.refresh();
        toast.success(
          result.scheduled
            ? "Post scheduled."
            : "Google accepted the change. Some changes may need review.",
        );
        return true;
      })
      .catch((e) => {
        toast.error(e.message);
        void query.refresh();
        return false;
      })
      .finally(() => {
        guard.busy = false;
        setBusy(false);
      });
  };
  return {
    data: query.data,
    change,
    busy,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
  };
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
  const remote = useGbp(facility.facilityId);
  const { data, change } = remote;
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
  const preview = (
    <div className="flex gap-2">
      {remote.busy && <Badge variant="outline">Saving…</Badge>}
      {data?.account && canManage && (
        <Button
          size="sm"
          variant="outline"
          disabled={remote.busy}
          onClick={() => {
            if (window.confirm("Disconnect this Google listing from Exora?"))
              void request(
                `/v1/managed-connections/google?facilityId=${facility.facilityId}`,
                { method: "DELETE", idempotencyKey: crypto.randomUUID() },
              )
                .then(() => remote.refresh())
                .catch((e) => toast.error(e.message));
          }}
        >
          Disconnect Google
        </Button>
      )}
    </div>
  );
  if (remote.loading)
    return (
      <p className="text-sm text-muted-foreground">Loading Google Business…</p>
    );
  if (remote.error || !data)
    return (
      <p role="alert" className="text-sm text-destructive">
        {remote.error || "Google Business could not load."}{" "}
        <Button variant="link" onClick={() => void remote.refresh()}>
          Retry
        </Button>
      </p>
    );
  if (!data.account)
    return (
      <>
        <PageTitle
          title="Google Business"
          icon={<GoogleIcon className="size-7" />}
          action={preview}
        />
        <Connect
          exora={exora}
          canManage={canManage}
          available={!!data.available}
          onConnected={() => void remote.refresh()}
        />
      </>
    );
  const unreplied = data.reviews.filter((r) => !r.reply).length;
  return (
    <>
      <PageTitle
        title="Google Business"
        icon={<GoogleIcon className="size-7" />}
        action={preview}
      />
      <div className="space-y-6">
        {data.status === "service_unavailable" && (
          <p role="alert" className="text-sm text-destructive">
            Google data is temporarily unavailable.{" "}
            <Button variant="link" onClick={() => void remote.refresh()}>
              Retry
            </Button>
          </p>
        )}
        <fieldset
          disabled={remote.busy || data.status === "service_unavailable"}
          className="min-w-0 space-y-6"
        >
          <Tabs value={tab} onValueChange={(v) => open(v as GTab)}>
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList variant="line">
                {tabs.map(([k, label]) => (
                  <TabsTrigger key={k} value={k} className="flex-none px-3">
                    {label}
                    {k === "reviews" && unreplied > 0 && (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#1a73e8] px-1 text-[10px] font-semibold text-white">
                        {unreplied}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
          {!canManage && (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">
              You can see the listing. Ask an administrator to make changes.
            </p>
          )}
          {tab === "overview" && (
            <Overview
              data={data}
              change={change}
              exora={exora}
              open={open}
              canManage={canManage}
            />
          )}
          {tab === "profile" && (
            <Profile
              key={section ?? ""}
              data={data}
              change={change}
              exora={exora}
              section={section}
              canManage={canManage}
            />
          )}
          {tab === "reviews" && data.capabilities?.reviews === false && (
            <p>Reviews are temporarily unavailable.</p>
          )}
          {tab === "reviews" && data.capabilities?.reviews !== false && (
            <Reviews
              data={data}
              change={change}
              exora={exora}
              canManage={canManage}
            />
          )}
          {tab === "posts" && data.capabilities?.posts === false && (
            <p>Posts are temporarily unavailable.</p>
          )}
          {tab === "posts" && data.capabilities?.posts !== false && (
            <Posts
              data={data}
              change={change}
              exora={exora}
              canManage={canManage}
            />
          )}
          {tab === "photos" && (
            <p className="text-sm text-muted-foreground">
              Photo publishing is not available yet.
            </p>
          )}
          {tab === "insights" && <GooglePerformance />}
        </fieldset>
      </div>
    </>
  );
}

function Connect({
  exora,
  canManage,
  available,
  onConnected,
}: {
  exora: Exora;
  canManage: boolean;
  available: boolean;
  onConnected: () => void;
}) {
  const { facility } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [items, setItems] = useState<
      { id: string; name: string; address: string; account: string }[]
    >([]);
  const [keys] = useState(() => new IntentKeys());
  const load = async () => {
    try {
      const d = await request<{ items: typeof items }>(
        `/v1/google-business/locations?facilityId=${facility.facilityId}`,
      );
      setItems(d.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load listings.");
    }
  };
  useEffect(() => {
    if (canManage && available) void load();
  }, []);
  const connect = async () => {
    setBusy(true);
    try {
      const body = { facilityId: facility.facilityId },
        path = "/v1/google-business/connect";
      const result = await request<{ authorizationUrl: string }>(path, {
        method: "POST",
        body,
        idempotencyKey: keys.for(path, body),
      });
      keys.complete(path, body);
      location.assign(result.authorizationUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect Google.");
      setBusy(false);
    }
  };
  const choose = async (locationId: string) => {
    setBusy(true);
    const body = { facilityId: facility.facilityId, locationId },
      path = "/v1/google-business/location";
    try {
      await request(path, {
        method: "POST",
        body,
        idempotencyKey: keys.for(path, body),
      });
      keys.complete(path, body);
      history.replaceState(history.state, "", location.pathname);
      onConnected();
      toast.success("Google listing connected");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not connect this listing.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Manage your Google listing here
        </h2>
        <p className="text-muted-foreground">
          Connect the Google account that manages {exora.name}, then choose your
          clinic. Reply to reviews, publish updates, and keep contact details
          and opening hours current.
        </p>
        <Button
          disabled={!canManage || !available || busy}
          onClick={() => void connect()}
        >
          <GoogleIcon className="size-4" /> Connect Google
        </Button>
        {!available && (
          <p className="text-sm text-muted-foreground">
            Exora is preparing Google connections. No account keys or technical
            setup are needed from you.
          </p>
        )}
        {new URLSearchParams(location.search).get("google") === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            Google could not connect. Please try again.
          </p>
        )}
        {items.length > 0 && (
          <Card className="gap-3 p-5 shadow-none">
            <h3 className="font-medium">Choose your clinic listing</h3>
            {items.map((l) => (
              <Button
                className="h-auto justify-start whitespace-normal text-left"
                variant="outline"
                key={l.id}
                disabled={busy}
                onClick={() => void choose(l.id)}
              >
                <span>
                  {l.name}
                  <span className="block text-xs text-muted-foreground">
                    {l.address} · {l.account}
                  </span>
                </span>
              </Button>
            ))}
          </Card>
        )}
        <p className="text-xs text-muted-foreground">
          You need owner or manager access to the listing. Google handles
          sign-in and consent securely.
        </p>
      </div>
      <Card className="gap-3 self-start p-6 shadow-none">
        <h3 className="font-medium">One place for your clinic</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>Clinic details and opening hours</li>
          <li>Patient reviews and replies</li>
          <li>Updates, events and offers</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Google may review changes before showing them publicly.
        </p>
      </Card>
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
  const setListing = (patch: Partial<Listing>) =>
    change((d) => ({ ...d, listing: { ...d.listing, ...patch } }));
  const reach = Math.min(
    100,
    s + todo.slice(0, 3).reduce((n, t) => n + t.weight, 0),
  );
  /** One-tap fixes where Exora already has the answer; everything else opens the right place. */
  const quick: Partial<Record<string, [string, () => void]>> = {
    book: ["Add", () => setListing({ bookUrl: exora.bookUrl })],
    whatsapp: exora.whatsappUrl
      ? ["Add", () => setListing({ whatsappUrl: exora.whatsappUrl })]
      : ["Set up WhatsApp", () => go("whatsapp")],
    hours: exora.hours.length
      ? ["Use my schedule", () => setListing({ hours: exora.hours })]
      : undefined,
    categories: suggestCategories(exora.specialities).length
      ? [
          `Add ${suggestCategories(exora.specialities).length} specialities`,
          () =>
            setListing({ categories: suggestCategories(exora.specialities) }),
        ]
      : undefined,
    services:
      exora.services.length >= 3
        ? ["Add from Catalogue", () => setListing({ services: exora.services })]
        : undefined,
    phone: exora.phone
      ? [
          "Use " + exora.phone,
          () =>
            change((d) => ({
              ...d,
              listing: { ...d.listing, phone: exora.phone },
              googleChanges: d.googleChanges.filter((c) => c.field !== "phone"),
            })),
        ]
      : undefined,
  };
  const action = (t: Task) =>
    quick[t.id] ?? ["Open", () => open(t.tab, t.section ?? null)];
  const avg =
    data.reviews.reduce((n, r) => n + r.stars, 0) /
    Math.max(data.reviews.length, 1);
  return (
    <div className="space-y-6">
      {data.googleChanges.map((c) => (
        <Card
          key={c.field}
          className="flex-row flex-wrap items-center gap-3 border-amber-500/40 bg-amber-500/5 p-4 shadow-none"
        >
          <AlertTriangle className="size-4 text-amber-600" />
          <p className="flex-1 text-sm">
            <span className="font-medium">
              Google changed your {c.label.toLowerCase()}
            </span>{" "}
            to {c.theirs} after a public suggestion. Yours is{" "}
            {c.ours || "not set"}.
          </p>
          <Button
            size="sm"
            disabled={!canManage}
            onClick={() => {
              change((d) => ({
                ...d,
                listing: { ...d.listing, [c.field]: c.ours },
                googleChanges: d.googleChanges.filter((x) => x !== c),
              }));
            }}
          >
            Use ours
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canManage}
            onClick={() =>
              change((d) => ({
                ...d,
                googleChanges: d.googleChanges.filter((x) => x !== c),
              }))
            }
          >
            Keep Google's
          </Button>
        </Card>
      ))}
      {checkedFields
        .filter((f) => data.checking[f])
        .map((f) => (
          <p
            key={f}
            className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm"
          >
            <Clock className="size-4 text-muted-foreground" /> Google is
            checking your new {f === "primaryCategory" ? "main category" : f}.
            This usually takes a few days.
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
                  {todo.length
                    ? `${Math.min(3, todo.length)} quick fix${todo.length === 1 ? "" : "es"} to reach ${reach}.`
                    : "Your listing is complete. Keep posting and replying to reviews."}
                </p>
              </div>
            </div>
            <ul className="divide-y">
              {todo.map((t) => {
                const [label, run] = action(t);
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-medium text-muted-foreground">
                      +{t.weight}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.why}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={quick[t.id] ? "default" : "outline"}
                      disabled={!canManage && !!quick[t.id]}
                      onClick={run}
                    >
                      {label}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {list.length > todo.length && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDone(!showDone)}
                  className="flex w-full items-center gap-2 border-t px-5 py-3 text-left text-sm text-muted-foreground"
                >
                  <ChevronDown
                    className={`size-4 transition-transform ${showDone ? "rotate-180" : ""}`}
                  />{" "}
                  Done ({list.length - todo.length})
                </button>
                {showDone && (
                  <ul className="divide-y border-t">
                    {list
                      .filter((t) => t.done)
                      .map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 px-5 py-2.5 text-sm text-muted-foreground"
                        >
                          <Check className="size-4 text-emerald-600" />{" "}
                          {t.title}
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </Card>
          <GooglePerformance />
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Your listing on Google now
          </p>
          <ListingCard
            listing={data.listing}
            rating={
              data.reviews.length ? { avg, count: data.reviews.length } : null
            }
          />
        </div>
      </div>
    </div>
  );
}

export function Delta({
  now,
  before,
  label = "last month",
}: {
  now: number;
  before: number;
  label?: string;
}) {
  if (!before)
    return (
      <p className="text-[11px] text-muted-foreground">{now ? "New" : "—"}</p>
    );
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <p
      className={`text-[11px] ${pct > 0 ? "text-emerald-700" : pct < 0 ? "text-destructive" : "text-muted-foreground"}`}
    >
      {pct > 0 ? "▲" : pct < 0 ? "▼" : ""} {Math.abs(pct)}% vs {label}
    </p>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 26,
    c = 2 * Math.PI * r;
  const color = value >= 80 ? "#188038" : value >= 50 ? "#f9ab00" : "#d93025";
  return (
    <svg
      viewBox="0 0 64 64"
      className="size-16 shrink-0"
      role="img"
      aria-label={`Profile score ${value} out of 100`}
    >
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity=".1"
        strokeWidth="6"
      />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        className="fill-foreground text-[15px] font-semibold"
      >
        {value}
      </text>
    </svg>
  );
}

/** A Google Search / Maps style card, so changes are seen the way patients see them. */
export function ListingCard({
  listing: l,
  rating,
}: {
  listing: Listing;
  rating: { avg: number; count: number } | null;
}) {
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
          <div
            key={i}
            className="grid place-items-center overflow-hidden text-[10px] text-[#5f6368]"
          >
            {p ? (
              <PhotoThumb name={p.name} id={p.id} />
            ) : i === 0 ? (
              "No photos yet"
            ) : (
              ""
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-[22px] leading-tight">{l.name}</p>
        <p className="flex items-center gap-1 text-sm text-[#70757a]">
          {rating ? (
            <>
              <span className="text-[#202124]">{rating.avg.toFixed(1)}</span>
              <span className="text-[#fbbc04]">
                {"★".repeat(Math.round(rating.avg))}
              </span>
              ({rating.count}) ·
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
        {l.description && (
          <p className="line-clamp-3 text-[13px] text-[#4d5156]">
            {l.description}
          </p>
        )}
        <dl className="space-y-1.5 border-t pt-3 text-[13px]">
          {l.address && (
            <p className="flex gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" />{" "}
              {l.address}
            </p>
          )}
          <p className="flex gap-2">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" />
            {l.hours.length ? (
              <span>
                <span className={openNow ? "text-[#188038]" : "text-[#d93025]"}>
                  {openNow ? "Open" : "Closed"}
                </span>
                {openNow
                  ? ` · Closes ${openNow.close}`
                  : todays[0]
                    ? ` · Opens ${todays[0].open}`
                    : ""}
                <span className="block text-[11px] text-[#70757a]">
                  {describeHours(l.hours)}
                </span>
              </span>
            ) : (
              <span className="text-[#70757a]">Add opening hours</span>
            )}
          </p>
          {l.phone && (
            <p className="flex gap-2">
              <Phone className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" />{" "}
              {l.phone}
            </p>
          )}
          {l.website && (
            <p className="flex gap-2 truncate">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-[#1a73e8]" />{" "}
              {l.website.replace(/^https?:\/\//, "")}
            </p>
          )}
        </dl>
        {l.categories.length > 0 && (
          <p className="text-[11px] text-[#70757a]">
            Also: {l.categories.slice(0, 4).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function PhotoThumb({ id, name }: { id: string; name: string }) {
  const url = photoUrls.get(id);
  return url ? (
    <img src={url} alt={name} className="size-full object-cover" />
  ) : (
    <span className="truncate px-2">{name}</span>
  );
}
/** Object URLs for photos picked this visit. */
export const photoUrls = new Map<string, string>();

function GooglePerformance() {
  const { facility } = useWorkspace();
  type Metrics = {
    search: number | null;
    maps: number | null;
    calls: number | null;
    website: number | null;
    directions: number | null;
  };
  const q = useQuery<{
    status: string;
    current: Metrics | null;
    previous: Metrics | null;
    daily: { date: string; views: number }[];
    from?: string;
    to?: string;
  }>(`/v1/google-business/performance?facilityId=${facility.facilityId}`);
  if (q.loading)
    return (
      <p className="text-sm text-muted-foreground">
        Loading Google performance…
      </p>
    );
  if (q.error || q.data?.status !== "ready")
    return (
      <Card className="p-5 shadow-none">
        <h2 className="text-sm font-semibold">Google performance</h2>
        <p className="text-sm text-muted-foreground">
          {q.data?.status === "no_data"
            ? "Google has not returned performance data yet."
            : "Google performance is temporarily unavailable."}
        </p>
        <Button size="sm" variant="outline" onClick={() => void q.refresh()}>
          Refresh
        </Button>
      </Card>
    );
  const data = q.data,
    max = Math.max(1, ...data.daily.map((d) => d.views));
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Google performance</h2>
        <p className="text-xs text-muted-foreground">
          {data.from} – {data.to} · Previous 30 complete days. Google may report
          with a delay.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["search", "Search impressions"],
            ["maps", "Maps impressions"],
            ["calls", "Call clicks"],
            ["directions", "Directions"],
            ["website", "Website clicks"],
          ] as const
        ).map(([key, title]) => (
          <Card key={key} className="gap-1 p-4 shadow-none">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-semibold">
              {data.current?.[key]?.toLocaleString() ?? "—"}
            </p>
            {data.current?.[key] != null && data.previous?.[key] != null && (
              <Delta
                now={data.current[key]!}
                before={data.previous[key]!}
                label="previous 30 days"
              />
            )}
          </Card>
        ))}
      </div>
      {data.daily.length > 0 && (
        <Card className="gap-3 p-5 shadow-none">
          <p className="text-sm font-medium">
            Search and Maps impressions by day
          </p>
          <div
            className="flex h-32 items-end gap-1"
            role="img"
            aria-label="Google impressions per day"
          >
            {data.daily.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-t bg-primary/70"
                style={{ height: `${(d.views / max) * 100}%` }}
                title={`${d.date}: ${d.views}`}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

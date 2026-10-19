// Website analytics model. Pure: no React, so it runs under node:test.

export const DAY = 86_400_000;

export type Provider = "exora" | "posthog";
export type Region = "us" | "eu";
export type Source =
  "google" | "maps" | "whatsapp" | "social" | "direct" | "other";
export type Device = "mobile" | "desktop" | "tablet";
export type Click = "call" | "whatsapp" | "directions";

export const sourceNames: Record<Source, string> = {
  google: "Google Search",
  maps: "Google Maps",
  whatsapp: "WhatsApp",
  social: "Instagram & Facebook",
  direct: "Direct",
  other: "Other websites",
};
export const deviceNames: Record<Device, string> = {
  mobile: "Mobile",
  desktop: "Computer",
  tablet: "Tablet",
};
export const regions: Record<Region, { name: string; app: string }> = {
  us: { name: "US Cloud", app: "https://us.posthog.com" },
  eu: { name: "EU Cloud", app: "https://eu.posthog.com" },
};

/** One clinic, one day. The backend fills the same shape from Exora's counters or from PostHog. */
export type Day = {
  date: string;
  visitors: number;
  views: number;
  started: number;
  booked: number;
  sources: Record<Source, number>;
  devices: Record<Device, number>;
  clicks: Record<Click, number>;
};
export type Site = {
  id: string;
  url: string;
  kind: "booking" | "own";
  status: "waiting" | "checking" | "live" | "not_found";
  addedAt: number;
  checkAt?: number;
  lastVisit?: number;
  code?: string | null;
};
/** Only the last 4 characters of each key are ever kept in the browser. */
export type PostHogLink = {
  region: Region;
  projectId: string;
  keyEnd: string;
  readKeyEnd: string;
  status: "testing" | "connected";
  since: number;
};
export type TopPage = { path: string; title: string; share: number };
export type AnalyticsData = {
  v: 1;
  provider: Provider | null;
  posthog: PostHogLink | null;
  switchedAt: number | null;
  sites: Site[];
  days: Day[];
  pages: TopPage[];
  available?: boolean;
  status?: string;
  posthogEnabled?: boolean;
  totals?: Totals | null;
  before?: Totals | null;
  bookingsTracked?: boolean;
  breakdownsAvailable?: boolean;
};

export const empty = (): AnalyticsData => ({
  v: 1,
  provider: null,
  posthog: null,
  switchedAt: null,
  sites: [],
  days: [],
  pages: [],
});

/** "srilakshmi.in", "https://www.x.com/about" → the site's origin; null when it isn't a public web address. */
export function siteUrl(input: string): string | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname)
      ? u.origin
      : null;
  } catch {
    return null;
  }
}
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
export const sameSite = (a: string, b: string) => host(a) === host(b);
export const siteKey = (facilityId: string) =>
  `ex_${facilityId.replace(/-/g, "").slice(0, 12)}`;
export const snippet = (origin: string, key: string) =>
  `<script defer src="${origin}/a.js" data-site="${key}"></script>`;

export function posthogIssues(f: {
  projectId: string;
  projectKey: string;
  readKey: string;
}) {
  return [
    !/^\d+$/.test(f.projectId.trim()) &&
      "The project ID is a number, like 84213.",
    !/^phc_\w{20,}$/.test(f.projectKey.trim()) &&
      "The project API key starts with phc_.",
    !/^phx_\w{20,}$/.test(f.readKey.trim()) &&
      "The personal API key starts with phx_.",
  ].filter(Boolean) as string[];
}

export type Totals = Omit<Day, "date">;
const zero = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
const sourceKeys = Object.keys(sourceNames) as Source[];
const deviceKeys = Object.keys(deviceNames) as Device[];
const clickKeys = ["call", "whatsapp", "directions"] as const;

export function total(days: Day[]): Totals {
  const t: Totals = {
    visitors: 0,
    views: 0,
    started: 0,
    booked: 0,
    sources: zero(sourceKeys),
    devices: zero(deviceKeys),
    clicks: zero(clickKeys),
  };
  for (const d of days) {
    t.visitors += d.visitors;
    t.views += d.views;
    t.started += d.started;
    t.booked += d.booked;
    for (const k of sourceKeys) t.sources[k] += d.sources[k];
    for (const k of deviceKeys) t.devices[k] += d.devices[k];
    for (const k of clickKeys) t.clicks[k] += d.clicks[k];
  }
  return t;
}

/** The last `n` days against the `n` days before them. `days` is oldest first. */
export function summarize(days: Day[], n: number) {
  const series = days.slice(-n);
  return { series, now: total(series), before: total(days.slice(-2 * n, -n)) };
}

export const percent = (part: number, whole: number) =>
  whole ? (part / whole) * 100 : 0;

/** Sources with any visitors, biggest first. */
export const ranked = <K extends string>(r: Record<K, number>) =>
  (Object.entries(r) as [K, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

// ponytail: stand-in for the backend. Checks pass after 3s and PostHog connects after 2s; the real ones come from /ingest and the key test.
export function progress(d: AnalyticsData, now: number): AnalyticsData {
  let changed = false;
  const sites = d.sites.map((s) => {
    if (s.status !== "checking" || (s.checkAt ?? 0) > now - 3000) return s;
    changed = true;
    return { ...s, status: "live" as const, lastVisit: now };
  });
  let posthog = d.posthog;
  if (posthog?.status === "testing" && posthog.since <= now - 2000) {
    changed = true;
    posthog = { ...posthog, status: "connected" };
  }
  return changed ? { ...d, sites, posthog } : d;
}

/** Deterministic per clinic, so the preview doesn't jump between reloads. */
function random(seedText: string) {
  let a =
    [...seedText].reduce(
      (h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619),
      2166136261,
    ) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const split = <K extends string>(
  n: number,
  shares: Record<K, number>,
  r: () => number,
) => {
  const out = {} as Record<K, number>;
  let left = n;
  const keys = Object.keys(shares) as K[];
  keys.forEach((k, i) => {
    const v =
      i === keys.length - 1
        ? left
        : Math.min(left, Math.round(n * shares[k] * (0.85 + r() * 0.3)));
    out[k] = v;
    left -= v;
  });
  return out;
};

export function seed(
  clinic: { facilityId: string; bookUrl: string; doctors: string[] },
  now: number,
): AnalyticsData {
  const r = random(clinic.facilityId);
  const start = new Date(now - 119 * DAY);
  const days: Day[] = [];
  for (let i = 0; i < 120; i++) {
    const date = new Date(start.getTime() + i * DAY);
    const weekday = date.getDay();
    const growth = 0.8 + (i / 120) * 0.35;
    const visitors = Math.round(
      (weekday === 0 ? 120 : weekday === 6 ? 150 : 190) *
        growth *
        (0.8 + r() * 0.4),
    );
    const started = Math.round(visitors * (0.06 + r() * 0.03));
    days.push({
      date: date.toISOString().slice(0, 10),
      visitors,
      views: Math.round(visitors * (2 + r() * 0.6)),
      started,
      booked: Math.round(started * (0.5 + r() * 0.15)),
      sources: split(
        visitors,
        {
          google: 0.45,
          maps: 0.21,
          whatsapp: 0.13,
          direct: 0.12,
          social: 0.06,
          other: 0.03,
        },
        r,
      ),
      devices: split(
        visitors,
        { mobile: 0.78, desktop: 0.19, tablet: 0.03 },
        r,
      ),
      clicks: {
        call: Math.round(visitors * 0.04 * (0.8 + r() * 0.4)),
        whatsapp: Math.round(visitors * 0.03 * (0.8 + r() * 0.4)),
        directions: Math.round(visitors * 0.05 * (0.8 + r() * 0.4)),
      },
    });
  }
  const doctorPages = clinic.doctors.slice(0, 3).map((name, i) => ({
    path: `/doctors/${name
      .toLowerCase()
      .replace(/^dr\.?\s*/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`,
    title: name,
    share: [0.09, 0.07, 0.05][i],
  }));
  return {
    v: 1,
    provider: null,
    posthog: null,
    switchedAt: null,
    sites: [
      {
        id: "booking",
        url: clinic.bookUrl,
        kind: "booking",
        status: "live",
        addedAt: now - 119 * DAY,
        lastVisit: now - 4 * 60_000,
      },
    ],
    days,
    pages: [
      { path: "/", title: "Home", share: 0.31 },
      { path: "/book", title: "Book an appointment", share: 0.22 },
      { path: "/doctors", title: "Our doctors", share: 0.14 },
      ...doctorPages,
      { path: "/contact", title: "Contact and directions", share: 0.06 },
    ],
  };
}

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sql, type DB, type Kysely } from "@hms/db";
import {
  invalid,
  notFound,
  preconditionFailed,
  runCommand,
  runQuery,
  setTransactionContext,
} from "@hms/platform";
import type { Caller } from "../../caller.ts";
import { providerJson, type ManagedSettings } from "./managed-config.ts";

export const AnalyticsSiteInput = z.strictObject({
  facilityId: z.uuid(),
  url: z.url().max(300),
});
export const AnalyticsEvent = z.strictObject({
  site: z.uuid(),
  event: z.enum([
    "pageview",
    "booking_open",
    "call_click",
    "whatsapp_click",
    "directions_click",
  ]),
  page: z.enum(["/", "/doctors", "/services", "/contact", "/book", "/other"]),
  source: z.enum(["google", "maps", "whatsapp", "social", "direct", "other"]),
  device: z.enum(["mobile", "desktop", "tablet"]),
});
type SiteRow = {
  id: string;
  tenant_id: string;
  facility_id: string;
  origin: string;
  kind: "own" | "booking";
  umami_id: string;
  enabled: boolean;
  created_at: Date;
  last_event_at: Date | null;
};
export function websiteOrigin(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    !/^[a-z\d-]+(?:\.[a-z\d-]+)*\.[a-z]{2,}$/i.test(u.hostname) ||
    /\.(local|internal|localhost)$/i.test(u.hostname)
  )
    throw invalid("Enter the public HTTPS website address.");
  return u.origin;
}
const ready = (s: ManagedSettings) => {
  if (!s.umami)
    throw preconditionFailed(
      "Website analytics is being prepared. Please try again later.",
    );
  return s.umami;
};
const binding = (t: string, f: string) => `exora:${t}:${f}`;
async function siteRows(db: Kysely<DB>, caller: Caller, facility: string) {
  return runQuery(db, caller.tenantId, async (tx) => {
    if (
      !(await tx
        .selectFrom("platform.facility")
        .select("id")
        .where("id", "=", facility)
        .executeTakeFirst())
    )
      throw notFound("clinic");
    return (
      await sql<SiteRow>`SELECT * FROM comms.analytics_site WHERE facility_id=${facility} AND NOT retired ORDER BY created_at,id`.execute(
        tx,
      )
    ).rows;
  });
}
export async function addAnalyticsSite(
  db: Kysely<DB>,
  caller: Caller,
  input: z.infer<typeof AnalyticsSiteInput>,
  key: string,
  settings: ManagedSettings,
) {
  const config = ready(settings),
    origin = websiteOrigin(input.url);
  const reservation = await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.analytics_site_add",
      request: { ...input, url: origin },
      idempotencyKey: key,
    },
    async (ctx) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${binding(caller.tenantId, input.facilityId) + ":analytics"},0))`.execute(
        ctx.tx,
      );
      if (
        !(await ctx.tx
          .selectFrom("platform.facility")
          .select("id")
          .where("id", "=", input.facilityId)
          .executeTakeFirst())
      )
        throw notFound("clinic");
      const {
        rows: [existing],
      } =
        await sql<SiteRow>`SELECT * FROM comms.analytics_site WHERE facility_id=${input.facilityId} AND origin=${origin}`.execute(
          ctx.tx,
        );
      if (existing) {
        await sql`UPDATE comms.analytics_site SET retired=false WHERE id=${existing.id}`.execute(
          ctx.tx,
        );
        return existing;
      }
      const {
        rows: [count],
      } = await sql<{
        n: number;
      }>`SELECT count(*)::int AS n FROM comms.analytics_site WHERE facility_id=${input.facilityId}`.execute(
        ctx.tx,
      );
      if (count!.n >= 5) throw invalid("You can connect up to five websites.");
      const {
        rows: [created],
      } =
        await sql<SiteRow>`INSERT INTO comms.analytics_site(tenant_id,facility_id,origin,kind,umami_id,enabled,created_by)
      VALUES(${caller.tenantId},${input.facilityId},${origin},'own',${randomUUID()},false,${caller.actor.staffId!}) RETURNING *`.execute(
          ctx.tx,
        );
      ctx.audit({
        action: "create",
        subjectType: "comms.analytics_site",
        subjectId: created!.id,
        diff: { origin },
      });
      return created!;
    },
  );
  const row = (await siteRows(db, caller, input.facilityId)).find(
    (r) => r.id === reservation.id,
  );
  if (!row) throw notFound("website");
  // Reserve the ID before external work. A timeout is reconciled against that same ID, never creates a second website.
  const path = `${config.origin}/api/websites`,
    headers = {
      Authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
    };
  let website: any;
  if (!row.enabled) {
    try {
      website = await providerJson(settings, path, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: row.umami_id,
          name: binding(caller.tenantId, input.facilityId),
          domain: new URL(origin).hostname,
          ...(config.teamId ? { teamId: config.teamId } : {}),
        }),
      });
    } catch {
      website = await providerJson(settings, `${path}/${row.umami_id}`, {
        headers,
      });
    }
    if (
      website.id !== row.umami_id ||
      website.domain !== new URL(origin).hostname ||
      website.name !== binding(caller.tenantId, input.facilityId)
    )
      throw preconditionFailed(
        "Website setup could not be confirmed. Please try again.",
      );
    await runCommand(
      db,
      { ...caller, module: "comms", name: "comms.analytics_site_ready" },
      async (ctx) => {
        await sql`UPDATE comms.analytics_site SET enabled=true WHERE id=${row.id} AND facility_id=${input.facilityId}`.execute(
          ctx.tx,
        );
        ctx.audit({
          action: "update",
          subjectType: "comms.analytics_site",
          subjectId: row.id,
          diff: { enabled: true },
        });
      },
    );
  }
  return { id: row.id };
}
export async function removeAnalyticsSite(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  id: string,
  key: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.analytics_site_remove",
      request: { facilityId, id },
      idempotencyKey: key,
    },
    async (ctx) => {
      const {
        rows: [r],
      } =
        await sql<SiteRow>`UPDATE comms.analytics_site SET enabled=false,retired=true WHERE id=${id} AND facility_id=${facilityId} AND NOT retired RETURNING *`.execute(
          ctx.tx,
        );
      if (!r) throw notFound("website");
      // Keep provider history private; disabling the local mapping immediately blocks collection and read access.
      ctx.audit({
        action: "update",
        subjectType: "comms.analytics_site",
        subjectId: id,
        diff: { enabled: false },
      });
      return { removed: true };
    },
  );
}
const zero = () => ({
  visitors: 0,
  views: 0,
  started: 0,
  booked: 0,
  sources: { google: 0, maps: 0, whatsapp: 0, social: 0, direct: 0, other: 0 },
  devices: { mobile: 0, desktop: 0, tablet: 0 },
  clicks: { call: 0, whatsapp: 0, directions: 0 },
});
const number = (n: any) => {
  const v = typeof n === "object" && n !== null ? n.value : n;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
    throw Error("Invalid analytics count");
  return v;
};
export async function analyticsDashboard(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  days: number,
  settings: ManagedSettings,
) {
  const rows = await siteRows(db, caller, facilityId);
  const base = {
    v: 1,
    provider: rows.some((r) => r.enabled) ? "exora" : null,
    posthog: null,
    switchedAt: null,
    available: !!settings.umami,
    posthogEnabled: !!settings.posthog,
    status: !settings.umami
      ? "unavailable"
      : rows.some((r) => r.enabled)
        ? "ready"
        : "not_started",
    sites: rows.map((r) => ({
      id: r.id,
      url: r.origin,
      kind: r.kind,
      status: r.last_event_at ? "live" : "waiting",
      addedAt: new Date(r.created_at).getTime(),
      ...(r.last_event_at
        ? { lastVisit: new Date(r.last_event_at).getTime() }
        : {}),
      code: settings.publicOrigin
        ? `<script defer src="${settings.publicOrigin}/a.js" data-site="${r.id}"></script>`
        : null,
    })),
    days: [] as any[],
    pages: [] as any[],
    totals: zero(),
    before: zero(),
    bookingsTracked: false,
    breakdownsAvailable: false,
  };
  if (!settings.umami || !rows.some((r) => r.enabled)) return base;
  const timezone = await runQuery(
    db,
    caller.tenantId,
    async (tx) =>
      (
        await tx
          .selectFrom("platform.facility")
          .select("timezone")
          .where("id", "=", facilityId)
          .executeTakeFirstOrThrow()
      ).timezone,
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const endDate = date,
    startDate = new Date(Date.parse(date) - 86400000 * (days - 1))
      .toISOString()
      .slice(0, 10);
  base.bookingsTracked = !!settings.booking?.sites.some(
    (s) =>
      s.tenantId === caller.tenantId &&
      s.facilityId === facilityId &&
      rows.some((r) => r.enabled && s.origins.includes(r.origin)),
  );
  const series = new Map<string, ReturnType<typeof zero> & { date: string }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse(startDate) + i * 86400000)
      .toISOString()
      .slice(0, 10);
    series.set(date, { date, ...zero() });
  }
  const pageViews = new Map<string, number>();
  try {
    const reports = await Promise.all(
      rows
        .filter((r) => r.enabled)
        .map(async (row) => {
          const q = new URLSearchParams({
              startDate,
              endDate,
              timezone,
              unit: "day",
              compare: "prev",
            }),
            root = `${settings.umami!.origin}/api/websites/${row.umami_id}`;
          const get = (path: string) =>
            providerJson(settings, `${root}/${path}`, {
              headers: { Authorization: `Bearer ${settings.umami!.key}` },
            });
          const [stats, chart, events, referrers, devices, pages] =
            await Promise.all([
              get(`stats?${q}`),
              get(`pageviews?${q}`),
              get(`metrics?${q}&type=event`),
              get(`metrics?${q}&type=referrer`),
              get(`metrics?${q}&type=device`),
              get(`metrics?${q}&type=path`),
            ]);
          if (
            !Array.isArray(chart.pageviews) ||
            !Array.isArray(chart.sessions) ||
            !Array.isArray(events)
          )
            throw Error();
          if (![referrers, devices, pages].every(Array.isArray)) throw Error();
          return { stats, chart, events, referrers, devices, pages };
        }),
    );
    for (const { stats, chart, events, referrers, devices, pages } of reports) {
      base.totals.views += number(stats.pageviews);
      base.totals.visitors += number(stats.visitors);
      const prev = stats.comparison ?? {};
      base.before.views += number(prev.pageviews ?? stats.pageviews?.prev ?? 0);
      base.before.visitors += number(
        prev.visitors ?? stats.visitors?.prev ?? 0,
      );
      for (const p of chart.pageviews) {
        const d = series.get(String(p.x).slice(0, 10));
        if (d) d.views += number(p.y);
      }
      for (const p of chart.sessions) {
        const d = series.get(String(p.x).slice(0, 10));
        if (d) d.visitors += number(p.y);
      }
      for (const r of referrers) {
        let source: keyof typeof base.totals.sources = "other";
        const ref = String(r.x ?? "");
        if (!ref) source = "direct";
        else if (/maps\.google/.test(ref)) source = "maps";
        else if (/(^|[/.])google\./.test(ref)) source = "google";
        else if (/wa\.me|whatsapp/.test(ref)) source = "whatsapp";
        else if (/facebook|instagram/.test(ref)) source = "social";
        base.totals.sources[source] += number(r.y);
      }
      for (const d of devices) {
        if (["mobile", "desktop", "tablet"].includes(d.x))
          base.totals.devices[d.x as keyof typeof base.totals.devices] +=
            number(d.y);
      }
      for (const p of pages) {
        if (
          [
            "/",
            "/doctors",
            "/services",
            "/contact",
            "/book",
            "/other",
          ].includes(p.x)
        )
          pageViews.set(p.x, (pageViews.get(p.x) ?? 0) + number(p.y));
      }
      for (const e of events) {
        const n = number(e.y);
        if (e.x === "booking_open") base.totals.started += n;
        else if (e.x === "call_click") base.totals.clicks.call += n;
        else if (e.x === "whatsapp_click") base.totals.clicks.whatsapp += n;
        else if (e.x === "directions_click") base.totals.clicks.directions += n;
      }
    }
    if (base.bookingsTracked) {
      const previousStart = new Date(Date.parse(startDate) - days * 86400000)
        .toISOString()
        .slice(0, 10);
      const counts = await runQuery(
        db,
        caller.tenantId,
        async (tx) =>
          (
            await sql<{
              day: string;
              n: number;
            }>`SELECT (a.created_at AT TIME ZONE ${timezone})::date::text AS day,count(*)::int AS n
        FROM comms.booking_attribution a JOIN comms.analytics_site s ON s.id=a.site_id AND s.tenant_id=a.tenant_id
        WHERE s.facility_id=${facilityId} AND (a.created_at AT TIME ZONE ${timezone})::date BETWEEN ${previousStart}::date AND ${endDate}::date GROUP BY 1`.execute(
              tx,
            )
          ).rows,
      );
      for (const c of counts) {
        if (c.day >= startDate) {
          base.totals.booked += c.n;
          const d = series.get(c.day);
          if (d) d.booked += c.n;
        } else base.before.booked += c.n;
      }
    }
    base.days = [...series.values()];
    base.breakdownsAvailable = true;
    const pageTotal = [...pageViews.values()].reduce((a, b) => a + b, 0);
    base.pages = [...pageViews]
      .sort((a, b) => b[1] - a[1])
      .map(([path, count]) => ({
        path,
        title: path === "/" ? "Home" : path.slice(1),
        share: pageTotal ? (count / pageTotal) * 100 : 0,
      }));
    return base;
  } catch {
    return {
      ...base,
      status: "service_unavailable",
      days: [],
      totals: null,
      before: null,
    };
  }
}
export async function collectAnalytics(
  db: Kysely<DB>,
  input: z.infer<typeof AnalyticsEvent>,
  origin: string,
  ip: string,
  userAgent: string,
  settings: ManagedSettings,
) {
  const config = ready(settings);
  const {
    rows: [owner],
  } = await sql<{
    tenant_id: string | null;
  }>`SELECT comms.analytics_site_tenant(${input.site}) AS tenant_id`.execute(
    db,
  );
  if (!owner?.tenant_id) throw notFound("website");
  const tenant = owner.tenant_id;
  const site = await runQuery(
    db,
    tenant,
    async (tx) =>
      (
        await sql<SiteRow>`SELECT * FROM comms.analytics_site WHERE id=${input.site} AND enabled`.execute(
          tx,
        )
      ).rows[0],
  );
  if (!site || origin !== site.origin)
    throw invalid("Website origin does not match.");
  // No titles, queries, arbitrary event properties, names, form contents, patient or appointment IDs cross this boundary.
  const referrers = {
    google: "https://www.google.com",
    maps: "https://maps.google.com",
    whatsapp: "https://wa.me",
    social: "https://www.instagram.com",
    direct: "",
    other: "https://referrer.invalid",
  };
  const result = await providerJson(settings, `${config.origin}/api/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": userAgent.slice(0, 500),
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({
      type: "event",
      payload: {
        website: site.umami_id,
        hostname: new URL(site.origin).hostname,
        url: input.page,
        title: "",
        referrer: referrers[input.source],
        language: "en",
        screen:
          input.device === "mobile"
            ? "390x844"
            : input.device === "tablet"
              ? "768x1024"
              : "1440x900",
        ...(input.event === "pageview" ? {} : { name: input.event }),
      },
    }),
  });
  if (result?.error)
    throw preconditionFailed("Visit collection could not be confirmed.");
  await runCommand(
    db,
    {
      tenantId: tenant,
      actor: { kind: "system" },
      module: "comms",
      name: "comms.analytics_event",
    },
    async (ctx) => {
      await sql`UPDATE comms.analytics_site SET last_event_at=now() WHERE id=${site.id} AND enabled`.execute(
        ctx.tx,
      );
    },
  );
  if (settings.posthog)
    await queueMirror(db, tenant, site.id, {
      event: input.event,
      page: input.page,
      source: input.source,
      device: input.device,
    });
  return { accepted: true };
}
/** Public IDs only: resolve from the configured runtime origin, never the incoming Host header. */
export async function hostedAnalyticsSite(db: Kysely<DB>, tenant: string, facility: string, settings: ManagedSettings) {
  if (!settings.umami || !settings.publicOrigin) return null;
  return runQuery(db, tenant, async tx => {
    const site = await tx.selectFrom('comms.analytics_site').select('id')
      .where('facility_id', '=', facility).where('origin', '=', settings.publicOrigin!)
      .where('enabled', '=', true).where('retired', '=', false).executeTakeFirst();
    return site ? { siteId: site.id, script: '/a.js' } : null;
  });
}
export const trackerScript = `(()=>{const s=document.currentScript;if(!s||navigator.globalPrivacyControl||navigator.doNotTrack==='1'||location.pathname.startsWith('/staff')||location.pathname.startsWith('/tele'))return;const site=s.dataset.site,base=new URL(s.src).origin;let route='';const page=()=>{const p=location.pathname;return /^\\/(book|booking)(\\.html|\\/|$)/.test(p)?'/book':p==='/'?'/':['doctors','services','contact'].includes(p.split('/')[1])?'/'+p.split('/')[1]:'/other'};const source=()=>{const t=new URLSearchParams(location.search).get('utm_source')||'';if(/^(whatsapp|maps|google|social)$/.test(t))return t;try{const h=new URL(document.referrer).hostname;if(/(^|\\.)google\\./.test(h))return h==='maps.google.com'?'maps':'google';if(/(^|\\.)(facebook.com|instagram.com)$/.test(h))return 'social';return h&&h!==location.hostname?'other':'direct'}catch{return 'direct'}};const send=event=>{fetch(base+'/a/collect',{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'content-type':'text/plain'},body:JSON.stringify({site,event,page:page(),source:source(),device:innerWidth<640?'mobile':innerWidth<1024?'tablet':'desktop'})}).catch(()=>{})};const view=()=>{if(route===location.pathname)return;route=location.pathname;send('pageview')};view();for(const k of ['pushState','replaceState']){const f=history[k];history[k]=function(...a){const r=f.apply(this,a);view();return r}}addEventListener('popstate',view);document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a)return;const h=a.getAttribute('href')||'';if(h.startsWith('tel:'))send('call_click');else if(/^https:\\/\\/(wa.me|api.whatsapp.com)\\//.test(h))send('whatsapp_click');else if(/maps.google|google.com\\/maps/.test(h))send('directions_click');else if(/\\/(book|booking)(\\.html|\\/|\\?|$)/.test(h))send('booking_open')})})();`;

/** Only the booking route calls this, after a committed appointment and with its server-owned binding. */
export async function attributeBooking(
  db: Kysely<DB>,
  tenant: string,
  facility: string,
  origin: string,
  appointmentId: string,
  settings: ManagedSettings,
) {
  if (!settings.umami) return;
  await runCommand(
    db,
    {
      tenantId: tenant,
      actor: { kind: "system" },
      module: "comms",
      name: "comms.attribute_booking",
    },
    async (ctx) => {
      const {
        rows: [site],
      } = await sql<{
        id: string;
      }>`SELECT id FROM comms.analytics_site WHERE facility_id=${facility} AND origin=${origin} AND enabled AND NOT retired`.execute(
        ctx.tx,
      );
      if (!site) return;
      const {
        rows: [created],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.booking_attribution(tenant_id,site_id,appointment_id)
      SELECT ${tenant},${site.id},a.id FROM booking.appointment a WHERE a.id=${appointmentId} AND a.facility_id=${facility} AND a.origin_channel='web'
      ON CONFLICT DO NOTHING RETURNING id`.execute(ctx.tx);
      if (created && settings.posthog)
        await sql`INSERT INTO comms.analytics_mirror(tenant_id,site_id,payload) VALUES(${tenant},${site.id},${JSON.stringify({ event: "booking_completed", page: "/book", source: "direct", device: "unknown" })}::jsonb)`.execute(
          ctx.tx,
        );
    },
  );
}
async function queueMirror(
  db: Kysely<DB>,
  tenant: string,
  site: string,
  payload: Record<string, string>,
) {
  await runCommand(
    db,
    {
      tenantId: tenant,
      actor: { kind: "system" },
      module: "comms",
      name: "comms.analytics_mirror_queue",
    },
    async (ctx) => {
      await sql`INSERT INTO comms.analytics_mirror(tenant_id,site_id,payload) VALUES(${tenant},${site},${JSON.stringify(payload)}::jsonb)`.execute(
        ctx.tx,
      );
    },
  );
}
/** Durable optional mirror. Its UUID is reused on retries so PostHog can deduplicate uncertain requests. */
export async function dispatchAnalyticsMirror(
  db: Kysely<DB>,
  settings: ManagedSettings,
) {
  if (!settings.posthog) return 0;
  const { rows } = await sql<{
    tenant_id: string;
    id: string;
  }>`SELECT * FROM comms.analytics_mirror_candidates()`.execute(db);
  for (const r of rows)
    await db.transaction().execute(async (tx) => {
      await setTransactionContext(tx, r.tenant_id);
      await sql`SET LOCAL ROLE mod_comms`.execute(tx);
      const {
        rows: [job],
      } =
        await sql<any>`SELECT m.*,s.enabled,s.retired FROM comms.analytics_mirror m JOIN comms.analytics_site s ON s.tenant_id=m.tenant_id AND s.id=m.site_id
      WHERE m.id=${r.id} AND m.status='pending' AND m.next_attempt_at<=now() FOR UPDATE OF m SKIP LOCKED`.execute(
          tx,
        );
      if (!job) return;
      if (!job.enabled || job.retired) {
        await sql`UPDATE comms.analytics_mirror SET status='failed' WHERE id=${r.id}`.execute(
          tx,
        );
        return;
      }
      let success = false;
      try {
        await providerJson(settings, settings.posthog!.origin + "/i/v0/e/", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            api_key: settings.posthog!.key,
            uuid: job.id,
            timestamp: new Date(job.created_at).toISOString(),
            event: job.payload.event,
            properties: {
              distinct_id: job.id,
              $process_person_profile: false,
              site_id: job.site_id,
              page: job.payload.page,
              source: job.payload.source,
              device: job.payload.device,
            },
          }),
        });
        success = true;
      } catch {}
      const attempts = job.attempts + 1;
      await sql`UPDATE comms.analytics_mirror SET status=${success ? "done" : attempts >= 10 ? "failed" : "pending"},attempts=${attempts},next_attempt_at=now()+${Math.min(3600, 2 ** attempts)}*interval '1 second' WHERE id=${r.id}`.execute(
        tx,
      );
    });
  return rows.length;
}

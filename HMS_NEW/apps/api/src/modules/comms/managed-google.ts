import { createHash, randomBytes } from "node:crypto";
import { sql, type DB, type Kysely } from "@hms/db";
import {
  conflict,
  forbidden,
  invalid,
  notFound,
  preconditionFailed,
  runCommand,
  runQuery,
  setTransactionContext,
} from "@hms/platform";
import { z } from "zod";
import type { Caller } from "../../caller.ts";
import {
  seal,
  unseal,
  providerJson,
  type ManagedSettings,
} from "./managed-config.ts";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const aad = (tenant: string, facility: string) =>
  `${tenant}:${facility}:google`;
type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};
export type ConnectionRow = {
  id: string;
  tenant_id: string;
  facility_id: string;
  external_id: string;
  credential: string;
  metadata: any;
  version: number;
};
type Attempt = {
  id: string;
  facility_id: string;
  actor_staff_id: string;
  actor_user_id: string;
  verifier: string;
  credential: string | null;
  status: string;
  expires_at: Date;
};
function google(settings: ManagedSettings) {
  if (!settings.google || !settings.publicOrigin || !settings.encryptionKey)
    throw preconditionFailed(
      "Google connection is being prepared. Please try again later.",
    );
  return settings.google;
}
export async function startGoogle(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  key: string,
  settings: ManagedSettings,
) {
  const config = google(settings);
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.google_connect_start",
      request: { facilityId },
      idempotencyKey: key,
    },
    async (ctx) => {
      if (!caller.actor.staffId || !caller.actor.userId)
        throw forbidden("Sign in to connect Google.");
      if (
        !(await ctx.tx
          .selectFrom("platform.facility")
          .select("id")
          .where("id", "=", facilityId)
          .executeTakeFirst())
      )
        throw notFound("clinic");
      const state = randomBytes(32).toString("base64url"),
        verifier = randomBytes(32).toString("base64url");
      await sql`INSERT INTO comms.integration_attempt(tenant_id,facility_id,provider,actor_staff_id,actor_user_id,state_hash,verifier,expires_at)
      VALUES(${caller.tenantId},${facilityId},'google',${caller.actor.staffId},${caller.actor.userId},${digest(state)},${seal(settings, verifier, aad(caller.tenantId, facilityId))},now()+interval '10 minutes')`.execute(
        ctx.tx,
      );
      const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: settings.publicOrigin + "/integrations/google/callback",
        response_type: "code",
        scope: "https://www.googleapis.com/auth/business.manage",
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      });
      ctx.audit({
        action: "create",
        subjectType: "comms.google_connection",
        diff: { state: "awaiting_consent", facilityId },
      });
      return {
        authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${q}`,
        state,
      };
    },
  );
}
export async function googleCallback(
  db: Kysely<DB>,
  state: string,
  code: string,
  cookie: string | undefined,
  settings: ManagedSettings,
) {
  const config = google(settings);
  if (!/^[\w-]{43}$/.test(state) || cookie !== state)
    throw forbidden(
      "Google connection expired. Start again from the dashboard.",
    );
  const {
    rows: [owner],
  } = await sql<{
    tenant_id: string | null;
  }>`SELECT comms.integration_tenant(${digest(state)}) AS tenant_id`.execute(
    db,
  );
  if (!owner?.tenant_id)
    throw forbidden(
      "Google connection expired. Start again from the dashboard.",
    );
  const tenant = owner.tenant_id;
  const attempt = await runCommand(
    db,
    {
      tenantId: tenant,
      actor: { kind: "system" },
      module: "comms",
      name: "comms.google_exchange",
    },
    async (ctx) => {
      const {
        rows: [r],
      } =
        await sql<Attempt>`UPDATE comms.integration_attempt SET status='exchanging' WHERE state_hash=${digest(state)} AND provider='google' AND status='pending' AND expires_at>now() RETURNING *`.execute(
          ctx.tx,
        );
      if (!r)
        throw forbidden(
          "Google connection expired. Start again from the dashboard.",
        );
      return r;
    },
  );
  try {
    const result = await providerJson(
      settings,
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: settings.publicOrigin + "/integrations/google/callback",
          code_verifier: unseal<string>(
            settings,
            attempt.verifier,
            aad(tenant, attempt.facility_id),
          ),
        }).toString(),
      },
    );
    if (
      typeof result.access_token !== "string" ||
      typeof result.refresh_token !== "string" ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in <= 0
    )
      throw Error();
    if (
      typeof result.scope === "string" &&
      !result.scope
        .split(" ")
        .includes("https://www.googleapis.com/auth/business.manage")
    )
      throw Error();
    const token: Tokens = {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: Date.now() + result.expires_in * 1000,
    };
    await runCommand(
      db,
      {
        tenantId: tenant,
        actor: { kind: "system" },
        module: "comms",
        name: "comms.google_exchange_complete",
      },
      async (ctx) => {
        await sql`UPDATE comms.integration_attempt SET credential=${seal(settings, token, aad(tenant, attempt.facility_id))},verifier='',status='ready' WHERE id=${attempt.id} AND status='exchanging'`.execute(
          ctx.tx,
        );
      },
    );
  } catch {
    await runCommand(
      db,
      {
        tenantId: tenant,
        actor: { kind: "system" },
        module: "comms",
        name: "comms.google_exchange_failed",
      },
      async (ctx) => {
        await sql`UPDATE comms.integration_attempt SET status='failed',verifier='',credential=NULL WHERE id=${attempt.id}`.execute(
          ctx.tx,
        );
      },
    );
    throw preconditionFailed(
      "Google could not connect. Please return to the dashboard and try again.",
    );
  }
  return { facilityId: attempt.facility_id };
}
export async function connection(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
  provider: "google" | "whatsapp",
) {
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
      (
        await sql<ConnectionRow>`SELECT * FROM comms.managed_connection WHERE facility_id=${facility} AND provider=${provider} AND enabled`.execute(
          tx,
        )
      ).rows[0] ?? null
    );
  });
}
async function pending(db: Kysely<DB>, caller: Caller, facility: string) {
  return runQuery(
    db,
    caller.tenantId,
    async (tx) =>
      (
        await sql<Attempt>`SELECT * FROM comms.integration_attempt WHERE facility_id=${facility} AND provider='google' AND status='ready' AND actor_staff_id=${caller.actor.staffId!} AND actor_user_id=${caller.actor.userId!} AND expires_at>now() ORDER BY created_at DESC LIMIT 1`.execute(
          tx,
        )
      ).rows[0],
  );
}
async function access(
  db: Kysely<DB>,
  caller: Caller,
  row: ConnectionRow,
  settings: ManagedSettings,
) {
  const config = google(settings),
    tokens = unseal<Tokens>(
      settings,
      row.credential,
      aad(caller.tenantId, row.facility_id),
    );
  if (tokens.expires_at > Date.now() + 60000) return tokens.access_token;
  const result = await providerJson(
    settings,
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      }).toString(),
    },
  );
  if (
    typeof result.access_token !== "string" ||
    !Number.isFinite(result.expires_in) ||
    result.expires_in <= 0
  )
    throw preconditionFailed("Reconnect Google to continue.");
  const saved = {
    ...tokens,
    access_token: result.access_token,
    expires_at: Date.now() + result.expires_in * 1000,
  };
  await runCommand(
    db,
    { ...caller, module: "comms", name: "comms.google_refresh" },
    async (ctx) => {
      await sql`UPDATE comms.managed_connection SET credential=${seal(settings, saved, aad(caller.tenantId, row.facility_id))} WHERE id=${row.id} AND credential=${row.credential}`.execute(
        ctx.tx,
      );
    },
  );
  return saved.access_token;
}
const auth = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "content-type": "application/json",
});
async function locationsFor(settings: ManagedSettings, token: string) {
  const headers = auth(token),
    accounts = await providerJson(
      settings,
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20",
      { headers },
    );
  const items: any[] = [];
  for (const a of (accounts.accounts ?? []).slice(0, 20)) {
    if (!/^accounts\/\d+$/.test(a.name)) continue;
    let page = "";
    for (let i = 0; i < 10; i++) {
      const q = new URLSearchParams({
        readMask: "name,title,storefrontAddress,phoneNumbers,metadata",
        pageSize: "100",
        ...(page ? { pageToken: page } : {}),
      });
      const result = await providerJson(
        settings,
        `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?${q}`,
        { headers },
      );
      for (const l of result.locations ?? []) {
        if (!/^locations\/\d+$/.test(l.name)) continue;
        items.push({
          id: `${a.name}/${l.name}`,
          name: l.title,
          address: (l.storefrontAddress?.addressLines ?? []).join(", "),
          account: a.accountName ?? "Google account",
        });
      }
      if (!result.nextPageToken) break;
      page = result.nextPageToken;
      if (i === 9)
        throw preconditionFailed(
          "Too many listings to load. Contact Paperwhale to connect this account.",
        );
    }
  }
  if (accounts.nextPageToken)
    throw preconditionFailed(
      "Too many business accounts to load. Contact Paperwhale to connect this account.",
    );
  return items;
}
export async function googleLocations(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
  settings: ManagedSettings,
) {
  const attempt = await pending(db, caller, facility);
  if (!attempt?.credential) return { items: [] };
  const tokens = unseal<Tokens>(
    settings,
    attempt.credential,
    aad(caller.tenantId, facility),
  );
  return { items: await locationsFor(settings, tokens.access_token) };
}
export async function selectGoogleLocation(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  locationId: string,
  key: string,
  settings: ManagedSettings,
) {
  if (!/^accounts\/\d+\/locations\/\d+$/.test(locationId))
    throw invalid("Choose a Google listing.");
  return runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.google_select",
      request: { facilityId, locationId },
      idempotencyKey: key,
    },
    async (ctx) => {
      // Verify membership with the credential, never trust listing IDs or ownership supplied by the browser.
      const attempt = await pending(db, caller, facilityId);
      if (!attempt?.credential)
        throw preconditionFailed("Connect your Google account again.");
      const tokens = unseal<Tokens>(
        settings,
        attempt.credential,
        aad(caller.tenantId, facilityId),
      );
      const location = (await locationsFor(settings, tokens.access_token)).find(
        (l) => l.id === locationId,
      );
      if (!location)
        throw forbidden(
          "Choose a listing managed by your connected Google account.",
        );
      const {
        rows: [claimed],
      } =
        await sql<Attempt>`UPDATE comms.integration_attempt SET status='used',credential=NULL WHERE id=${attempt.id} AND status='ready' AND expires_at>now() RETURNING *`.execute(
          ctx.tx,
        );
      if (!claimed) throw conflict("Google connection expired. Connect again.");
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.managed_connection(tenant_id,facility_id,provider,external_id,credential,metadata,created_by)
      VALUES(${caller.tenantId},${facilityId},'google',${locationId},${attempt.credential},${JSON.stringify({ name: location.name, account: location.account })}::jsonb,${caller.actor.staffId!})
      ON CONFLICT(tenant_id,facility_id,provider) DO UPDATE SET external_id=EXCLUDED.external_id,credential=EXCLUDED.credential,metadata=EXCLUDED.metadata,enabled=true RETURNING id`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "update",
        subjectType: "comms.google_connection",
        subjectId: r!.id,
        diff: { state: "connected" },
      });
      return { connected: true };
    },
  );
}
const emptyListing = () => ({
  name: "",
  phone: "",
  website: "",
  address: "",
  primaryCategory: "",
  categories: [],
  description: "",
  hours: [],
  holidays: [],
  services: [],
  bookUrl: null,
  whatsappUrl: null,
  facts: {},
  social: {},
  photos: { logo: [], cover: [], outside: [], inside: [], team: [] },
});
export async function googleDashboard(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  settings: ManagedSettings,
) {
  const row = await connection(db, caller, facilityId, "google");
  const base = {
    v: 1,
    account: null as any,
    listing: emptyListing() as any,
    checking: {},
    reviews: [] as any[],
    posts: [] as any[],
    month: null,
    lastMonth: null,
    daily: [],
    keywords: [],
    googleChanges: [],
    askReviews: false,
    available: !!settings.google,
    status: row ? "connected" : "not_connected",
    version: row?.version ?? 0,
    capabilities: {
      profile: true,
      reviews: true,
      posts: true,
      photos: false,
      insights: false,
      reviewRequests: false,
    },
  };
  if (!row) return base;
  base.account = { email: row.metadata.account, listing: row.metadata.name };
  try {
    const token = await access(db, caller, row, settings),
      headers = auth(token),
      id = row.external_id.split("/").slice(-2).join("/");
    const l = await providerJson(
      settings,
      `https://mybusinessbusinessinformation.googleapis.com/v1/${id}?readMask=name,title,phoneNumbers,websiteUri,storefrontAddress,categories,profile,regularHours,metadata`,
      { headers },
    );
    base.listing = {
      ...emptyListing(),
      name: l.title ?? "",
      phone: l.phoneNumbers?.primaryPhone ?? "",
      website: l.websiteUri ?? "",
      address: [
        ...(l.storefrontAddress?.addressLines ?? []),
        l.storefrontAddress?.locality,
        l.storefrontAddress?.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
      primaryCategory: l.categories?.primaryCategory?.displayName ?? "",
      categories: (l.categories?.additionalCategories ?? []).map(
        (c: any) => c.displayName,
      ),
      description: l.profile?.description ?? "",
      hours: (l.regularHours?.periods ?? []).map((p: any) => ({
        day: [
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
          "SUNDAY",
        ].indexOf(p.openDay),
        open: `${String(p.openTime?.hours ?? 0).padStart(2, "0")}:${String(p.openTime?.minutes ?? 0).padStart(2, "0")}`,
        close: `${String(p.closeTime?.hours ?? 0).padStart(2, "0")}:${String(p.closeTime?.minutes ?? 0).padStart(2, "0")}`,
      })),
    };
    const [reviews, posts] = await Promise.allSettled([
      providerJson(
        settings,
        `https://mybusiness.googleapis.com/v4/${row.external_id}/reviews?pageSize=50&orderBy=updateTime%20desc`,
        { headers },
      ),
      providerJson(
        settings,
        `https://mybusiness.googleapis.com/v4/${row.external_id}/localPosts?pageSize=100`,
        { headers },
      ),
    ]);
    base.capabilities.reviews = reviews.status === "fulfilled";
    base.capabilities.posts = posts.status === "fulfilled";
    if (reviews.status === "fulfilled")
      base.reviews = (reviews.value.reviews ?? []).map((r: any) => ({
        id: r.reviewId,
        author: r.reviewer?.displayName ?? "Google user",
        stars: ["", "ONE", "TWO", "THREE", "FOUR", "FIVE"].indexOf(
          r.starRating,
        ),
        text: r.comment ?? "",
        at: Date.parse(r.createTime),
        reply: r.reviewReply
          ? {
              text: r.reviewReply.comment,
              at: Date.parse(r.reviewReply.updateTime),
            }
          : null,
      }));
    if (posts.status === "fulfilled")
      base.posts = (posts.value.localPosts ?? []).map((p: any) => ({
        id: p.name.split("/").at(-1),
        kind:
          p.topicType === "OFFER"
            ? "offer"
            : p.topicType === "EVENT"
              ? "event"
              : "update",
        title: p.event?.title ?? "",
        text: p.summary ?? "",
        button:
          p.callToAction?.actionType === "BOOK"
            ? "book"
            : p.callToAction?.actionType === "CALL"
              ? "call"
              : p.callToAction
                ? "learn"
                : null,
        image: null,
        at: Date.parse(p.createTime),
        status:
          p.state === "LIVE"
            ? "live"
            : p.state === "REJECTED"
              ? "rejected"
              : "checking",
        views: null,
      }));
    const local = await runQuery(
      db,
      caller.tenantId,
      async (tx) =>
        (
          await sql<any>`SELECT * FROM comms.google_scheduled_post WHERE facility_id=${facilityId} AND status IN('scheduled','claimed','unknown') ORDER BY due_at DESC LIMIT 100`.execute(
            tx,
          )
        ).rows,
    );
    base.posts = [
      ...local.map((j) => ({
        id: "scheduled-" + j.id,
        kind: j.payload.kind,
        title: j.payload.title,
        text: j.payload.text,
        button: j.payload.button,
        image: null,
        dates: j.payload.dates,
        at: new Date(j.due_at).getTime(),
        status: j.status === "scheduled" ? "scheduled" : "unknown",
        views: null,
      })),
      ...base.posts,
    ];
    base.version =
      (await connection(db, caller, facilityId, "google"))?.version ??
      base.version;
    return { ...base, reviewUrl: l.metadata?.newReviewUri ?? null };
  } catch {
    return {
      ...base,
      status: "service_unavailable",
      capabilities: {
        ...base.capabilities,
        profile: false,
        reviews: false,
        posts: false,
      },
    };
  }
}
const period = z
  .strictObject({
    day: z.number().int().min(0).max(6),
    open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((p) => p.close > p.open, "Closing time must follow opening time.");
export const GoogleAction = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("profile"),
    version: z.number().int().positive(),
    patch: z.strictObject({
      name: z.string().trim().min(1).max(200).optional(),
      phone: z.string().trim().max(30).optional(),
      website: z.url().max(300).optional(),
      description: z.string().max(750).optional(),
      hours: z.array(period).max(30).optional(),
    }),
  }),
  z.strictObject({
    action: z.literal("reply"),
    version: z.number().int().positive(),
    reviewId: z.string().regex(/^[\w-]{1,200}$/),
    text: z.string().trim().min(1).max(4096).nullable(),
  }),
  z.strictObject({
    action: z.literal("post"),
    version: z.number().int().positive(),
    kind: z.enum(["update", "event", "offer"]),
    title: z.string().trim().max(58),
    text: z.string().trim().min(1).max(1500),
    button: z.enum(["book", "call", "learn"]).nullable(),
    url: z.url().max(400).optional(),
    dates: z.strictObject({ from: z.iso.date(), to: z.iso.date() }).optional(),
    publishAt: z.iso.datetime({ offset: true }).optional(),
  }),
  z.strictObject({
    action: z.literal("delete_post"),
    version: z.number().int().positive(),
    postId: z.string().regex(/^[\w-]{1,200}$/),
  }),
]);
export async function googleAction(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  input: z.infer<typeof GoogleAction>,
  key: string,
  settings: ManagedSettings,
) {
  // Provider writes are at-most-once per intent. A committed attempt precedes the HTTP request; uncertain writes require refresh.
  const row = await connection(db, caller, facilityId, "google");
  if (!row) throw preconditionFailed("Connect Google first.");
  if (row.version !== input.version)
    throw conflict("Google connection changed. Reload before publishing.");
  if (
    input.action === "post" &&
    input.kind !== "update" &&
    (!input.dates || input.dates.to < input.dates.from || !input.title)
  )
    throw invalid(
      "Events and offers need a title and a valid start and end date.",
    );
  if (input.action === "post" && input.publishAt) {
    const due = new Date(input.publishAt);
    if (due <= new Date() || due.getTime() > Date.now() + 90 * 86400000)
      throw invalid("Choose a publishing time in the next 90 days.");
    if (
      input.button &&
      input.button !== "call" &&
      (!input.url || new URL(input.url).protocol !== "https:")
    )
      throw invalid("Choose a public HTTPS destination for this post.");
    return runCommand(
      db,
      {
        ...caller,
        module: "comms",
        name: "comms.google_schedule",
        request: { facilityId, ...input },
        idempotencyKey: key,
      },
      async (ctx) => {
        const { publishAt, ...payload } = input;
        const {
          rows: [job],
        } = await sql<{
          id: string;
        }>`INSERT INTO comms.google_scheduled_post(tenant_id,facility_id,connection_id,external_id,payload,due_at,actor_staff_id,actor_user_id)
        VALUES(${caller.tenantId},${facilityId},${row.id},${row.external_id},${JSON.stringify(payload)}::jsonb,${due},${caller.actor.staffId!},${caller.actor.userId!}) RETURNING id`.execute(
          ctx.tx,
        );
        ctx.audit({
          action: "create",
          subjectType: "comms.google_scheduled_post",
          subjectId: job!.id,
          diff: { dueAt: publishAt },
        });
        return { accepted: true, scheduled: true };
      },
    );
  }
  if (input.action === "delete_post" && input.postId.startsWith("scheduled-")) {
    const id = input.postId.slice(10);
    if (!z.uuid().safeParse(id).success)
      throw invalid("Invalid scheduled post.");
    return runCommand(
      db,
      {
        ...caller,
        module: "comms",
        name: "comms.google_schedule_cancel",
        request: { facilityId, ...input },
        idempotencyKey: key,
      },
      async (ctx) => {
        const { rows } =
          await sql`UPDATE comms.google_scheduled_post SET status='cancelled' WHERE id=${id} AND facility_id=${facilityId} AND status='scheduled' RETURNING id`.execute(
            ctx.tx,
          );
        if (!rows.length)
          throw conflict(
            "This post was already attempted. Refresh to check its result.",
          );
        ctx.audit({
          action: "update",
          subjectType: "comms.google_scheduled_post",
          subjectId: id,
          diff: { status: "cancelled" },
        });
        return { accepted: true };
      },
    );
  }
  const attempt = await runCommand(
    db,
    {
      ...caller,
      module: "comms",
      name: "comms.google_write",
      request: { facilityId, ...input },
      idempotencyKey: key,
    },
    async (ctx) => {
      const {
        rows: [r],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.integration_attempt(tenant_id,facility_id,provider,actor_staff_id,actor_user_id,state_hash,verifier,status,expires_at)
      VALUES(${caller.tenantId},${facilityId},'google',${caller.actor.staffId!},${caller.actor.userId!},${randomBytes(32).toString("hex")},'','exchanging',now()+interval '10 minutes') RETURNING id`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: "create",
        subjectType: "comms.google_operation",
        subjectId: r!.id,
        diff: { action: input.action, state: "started" },
      });
      return { id: r!.id };
    },
  );
  const claim = await runCommand(
    db,
    { ...caller, module: "comms", name: "comms.google_write_claim" },
    async (ctx) => {
      const { rows } =
        await sql`UPDATE comms.integration_attempt SET status='used' WHERE id=${attempt.id} AND status='exchanging' RETURNING id`.execute(
          ctx.tx,
        );
      return rows.length === 1;
    },
  );
  if (!claim)
    throw conflict(
      "This Google change was already attempted. Refresh the listing to check its result.",
    );
  const token = await access(db, caller, row, settings),
    headers = auth(token),
    root = `https://mybusiness.googleapis.com/v4/${row.external_id}`;
  const refreshed = await connection(db, caller, facilityId, "google");
  if (
    !refreshed ||
    unseal<Tokens>(
      settings,
      refreshed.credential,
      aad(caller.tenantId, facilityId),
    ).access_token !== token
  )
    throw conflict("This connection changed. Refresh before publishing.");
  await db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, caller.tenantId);
    await sql`SET LOCAL ROLE mod_comms`.execute(tx);
    await sql`SELECT pg_advisory_xact_lock(hashtextextended('access:' || ${caller.tenantId},0))`.execute(
      tx,
    );
    const {
      rows: [valid],
    } =
      await sql`SELECT c.id FROM comms.managed_connection c JOIN platform.facility f ON f.id=c.facility_id AND f.tenant_id=c.tenant_id AND f.status='active'
      JOIN platform.tenant t ON t.id=c.tenant_id AND t.status IN('active','trial')
      JOIN platform.staff s ON s.id=${caller.actor.staffId!} AND s.tenant_id=c.tenant_id AND s.status='active'
      JOIN platform.user_account u ON u.id=${caller.actor.userId!} AND u.staff_id=s.id AND u.tenant_id=c.tenant_id AND u.status='active'
      WHERE c.id=${row.id} AND c.enabled AND c.credential=${refreshed.credential} AND c.external_id=${row.external_id}
      AND EXISTS(SELECT 1 FROM platform.staff_permission p WHERE p.staff_id=s.id AND p.permission='growth.manage' AND (p.facility_id IS NULL OR p.facility_id=c.facility_id)) FOR SHARE OF c`.execute(
        tx,
      );
    if (!valid)
      throw forbidden("Publishing access has changed. Refresh the listing.");
    if (input.action === "reply")
      await providerJson(settings, `${root}/reviews/${input.reviewId}/reply`, {
        method: input.text === null ? "DELETE" : "PUT",
        headers,
        ...(input.text === null
          ? {}
          : { body: JSON.stringify({ comment: input.text }) }),
      });
    else if (input.action === "delete_post")
      await providerJson(settings, `${root}/localPosts/${input.postId}`, {
        method: "DELETE",
        headers,
      });
    else if (input.action === "profile") {
      const body: any = {},
        mask: string[] = [];
      for (const [k, v] of Object.entries(input.patch)) {
        if (k === "name") {
          body.title = v;
          mask.push("title");
        } else if (k === "phone") {
          body.phoneNumbers = { primaryPhone: v };
          mask.push("phoneNumbers");
        } else if (k === "website") {
          body.websiteUri = v;
          mask.push("websiteUri");
        } else if (k === "description") {
          body.profile = { description: v };
          mask.push("profile.description");
        } else if (k === "hours") {
          const days = [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY",
            "SATURDAY",
            "SUNDAY",
          ];
          body.regularHours = {
            periods: (v as z.infer<typeof period>[]).map((p) => ({
              openDay: days[p.day],
              closeDay: days[p.day],
              openTime: {
                hours: Number(p.open.slice(0, 2)),
                minutes: Number(p.open.slice(3)),
              },
              closeTime: {
                hours: Number(p.close.slice(0, 2)),
                minutes: Number(p.close.slice(3)),
              },
            })),
          };
          mask.push("regularHours");
        }
      }
      if (!mask.length) throw invalid("Choose a field to update.");
      await providerJson(
        settings,
        `https://mybusinessbusinessinformation.googleapis.com/v1/${row.external_id.split("/").slice(-2).join("/")}?updateMask=${encodeURIComponent(mask.join(","))}`,
        { method: "PATCH", headers, body: JSON.stringify(body) },
      );
    } else {
      const date = (v: string) => {
        const [year, month, day] = v.split("-").map(Number);
        return { year, month, day };
      };
      if (
        input.button &&
        input.button !== "call" &&
        (!input.url || new URL(input.url).protocol !== "https:")
      )
        throw invalid("Choose a public HTTPS destination for this post.");
      await providerJson(settings, `${root}/localPosts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          languageCode: "en",
          summary: input.text,
          topicType:
            input.kind === "event"
              ? "EVENT"
              : input.kind === "offer"
                ? "OFFER"
                : "STANDARD",
          ...(input.dates
            ? {
                event: {
                  title: input.title,
                  schedule: {
                    startDate: date(input.dates.from),
                    endDate: date(input.dates.to),
                  },
                },
              }
            : {}),
          ...(input.kind === "offer" ? { offer: {} } : {}),
          ...(input.button
            ? {
                callToAction: {
                  actionType:
                    input.button === "book"
                      ? "BOOK"
                      : input.button === "call"
                        ? "CALL"
                        : "LEARN_MORE",
                  ...(input.button === "call" ? {} : { url: input.url }),
                },
              }
            : {}),
        }),
      });
    }
  });
  await runCommand(
    db,
    { ...caller, module: "comms", name: "comms.google_write_completed" },
    async (ctx) => {
      ctx.audit({
        action: "update",
        subjectType: "comms.google_operation",
        subjectId: attempt.id,
        diff: { action: input.action, state: "accepted" },
      });
    },
  );
  return { accepted: true };
}

export async function googlePerformance(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  settings: ManagedSettings,
) {
  const row = await connection(db, caller, facilityId, "google");
  if (!row)
    return {
      status: "not_connected",
      current: null,
      previous: null,
      daily: [],
    };
  const token = await access(db, caller, row, settings);
  const tz = await runQuery(
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
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(
    new Date(),
  );
  const end = Date.parse(today) - 86400000,
    start = end - 59 * 86400000,
    boundary = end - 29 * 86400000;
  const metrics = [
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "CALL_CLICKS",
    "WEBSITE_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
  ];
  const q = new URLSearchParams();
  for (const metric of metrics) q.append("dailyMetrics", metric);
  for (const [k, ts] of [
    ["start_date", start],
    ["end_date", end],
  ] as const) {
    const d = new Date(ts);
    q.set(`dailyRange.${k}.year`, String(d.getUTCFullYear()));
    q.set(`dailyRange.${k}.month`, String(d.getUTCMonth() + 1));
    q.set(`dailyRange.${k}.day`, String(d.getUTCDate()));
  }
  const empty = () => ({
    search: null as number | null,
    maps: null as number | null,
    calls: null as number | null,
    website: null as number | null,
    directions: null as number | null,
  });
  try {
    const result = await providerJson(
      settings,
      `https://businessprofileperformance.googleapis.com/v1/${row.external_id.split("/").slice(-2).join("/")}:fetchMultiDailyMetricsTimeSeries?${q}`,
      { headers: auth(token) },
    );
    if (!Array.isArray(result.multiDailyMetricTimeSeries)) throw Error();
    const sums = new Map<string, { now: number; before: number }>(),
      daily = new Map<string, number>();
    for (const group of result.multiDailyMetricTimeSeries)
      for (const series of group.dailyMetricTimeSeries ?? []) {
        if (!metrics.includes(series.dailyMetric)) continue;
        const totals = { now: 0, before: 0 };
        for (const point of series.timeSeries?.datedValues ?? []) {
          const value = Number(point.value ?? 0),
            d = point.date;
          if (!d || !Number.isSafeInteger(value) || value < 0) throw Error();
          const date = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
            time = Date.parse(date);
          if (time < start || time > end) continue;
          if (time >= boundary) totals.now += value;
          else totals.before += value;
          if (
            time >= boundary &&
            series.dailyMetric.startsWith("BUSINESS_IMPRESSIONS_")
          )
            daily.set(date, (daily.get(date) ?? 0) + value);
        }
        sums.set(series.dailyMetric, totals);
      }
    const current = empty(),
      previous = empty();
    const mapping = {
      search: metrics.slice(0, 2),
      maps: metrics.slice(2, 4),
      calls: ["CALL_CLICKS"],
      website: ["WEBSITE_CLICKS"],
      directions: ["BUSINESS_DIRECTION_REQUESTS"],
    };
    for (const [k, names] of Object.entries(mapping))
      if (names.every((n) => sums.has(n))) {
        current[k as keyof typeof current] = names.reduce(
          (n, m) => n + sums.get(m)!.now,
          0,
        );
        previous[k as keyof typeof previous] = names.reduce(
          (n, m) => n + sums.get(m)!.before,
          0,
        );
      }
    return {
      status: sums.size ? "ready" : "no_data",
      current,
      previous,
      daily: [...daily].sort().map(([date, views]) => ({ date, views })),
      from: new Date(boundary).toISOString().slice(0, 10),
      to: new Date(end).toISOString().slice(0, 10),
    };
  } catch {
    return {
      status: "service_unavailable",
      current: null,
      previous: null,
      daily: [],
    };
  }
}

/** A committed claim precedes publishing. Unknown requests are never automatically repeated. */
export async function dispatchGooglePosts(
  db: Kysely<DB>,
  settings: ManagedSettings,
) {
  if (!settings.google) return 0;
  const { rows } = await sql<{
    tenant_id: string;
    id: string;
  }>`SELECT * FROM comms.google_post_candidates()`.execute(db);
  for (const r of rows) {
    const job = await db.transaction().execute(async (tx) => {
      await setTransactionContext(tx, r.tenant_id);
      await sql`SET LOCAL ROLE mod_comms`.execute(tx);
      const {
        rows: [locked],
      } =
        await sql`SELECT id FROM comms.google_scheduled_post WHERE id=${r.id} AND status='scheduled' AND due_at<=now() FOR UPDATE SKIP LOCKED`.execute(
          tx,
        );
      if (!locked) return null;
      const {
        rows: [j],
      } =
        await sql<any>`SELECT j.*,c.version AS connection_version FROM comms.google_scheduled_post j
        JOIN comms.managed_connection c ON c.id=j.connection_id AND c.tenant_id=j.tenant_id AND c.enabled AND c.external_id=j.external_id
        JOIN platform.facility f ON f.id=j.facility_id AND f.tenant_id=j.tenant_id AND f.status='active'
        JOIN platform.tenant t ON t.id=j.tenant_id AND t.status IN('active','trial')
        JOIN platform.staff s ON s.id=j.actor_staff_id AND s.tenant_id=j.tenant_id AND s.status='active'
        JOIN platform.user_account u ON u.id=j.actor_user_id AND u.staff_id=s.id AND u.tenant_id=j.tenant_id AND u.status='active'
        WHERE j.id=${r.id} AND j.status='scheduled' AND j.due_at<=now() AND j.due_at>now()-interval '1 day'
        AND EXISTS(SELECT 1 FROM platform.staff_permission p WHERE p.staff_id=s.id AND p.permission='growth.manage' AND (p.facility_id IS NULL OR p.facility_id=j.facility_id)) FOR UPDATE OF j SKIP LOCKED`.execute(
          tx,
        );
      if (!j) {
        await sql`UPDATE comms.google_scheduled_post SET status='cancelled' WHERE id=${r.id}`.execute(
          tx,
        );
        return null;
      }
      await sql`UPDATE comms.google_scheduled_post SET status='claimed' WHERE id=${j.id}`.execute(
        tx,
      );
      return j;
    });
    if (!job) continue;
    let status = "unknown";
    try {
      await googleAction(
        db,
        {
          tenantId: r.tenant_id,
          actor: {
            kind: "staff",
            staffId: job.actor_staff_id,
            userId: job.actor_user_id,
          },
        },
        job.facility_id,
        { ...job.payload, version: job.connection_version },
        job.id,
        settings,
      );
      status = "accepted";
    } catch {}
    await runCommand(
      db,
      {
        tenantId: r.tenant_id,
        actor: { kind: "system" },
        module: "comms",
        name: "comms.google_scheduled_result",
      },
      async (ctx) => {
        await sql`UPDATE comms.google_scheduled_post SET status=${status} WHERE id=${job.id}`.execute(
          ctx.tx,
        );
        ctx.audit({
          action: "update",
          subjectType: "comms.google_scheduled_post",
          subjectId: job.id,
          diff: { status },
        });
      },
    );
  }
  return rows.length;
}

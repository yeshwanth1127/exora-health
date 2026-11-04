import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startKit, type Kit, type Person } from "./test-kit.ts";
import {
  loadManagedSettings,
  seal,
  unseal,
  providerJson,
  type ManagedSettings,
} from "../modules/comms/managed-config.ts";
import { dispatchManagedWhatsApp } from "../modules/comms/managed-whatsapp.ts";
let k: Kit, other: Kit, admin: Person, desk: Person, outsider: Person;
const previousEnv = { ...process.env };
let chatId = "",
  contactId = "";
let sites = new Map<string, any>(),
  network: { url: string; init: RequestInit }[] = [],
  failAnalytics = false,
  failSend = false;
const settings: ManagedSettings = {
  encryptionKey: Buffer.alloc(32, 7),
  publicOrigin: "https://dashboard.example.com",
  google: {
    clientId: "google-client",
    clientSecret: "never-return-google-secret",
  },
  meta: {
    appId: "111111",
    appSecret: "never-return-meta-secret",
    configId: "222222",
    graphVersion: "v23.0",
  },
  whatsappSending: true,
  umami: {
    origin: "https://analytics.example.com",
    key: "never-return-umami-key",
  },
  posthog: {
    origin: "https://us.i.posthog.com",
    key: "never-return-posthog-key",
  },
  fetcher: async (url, init = {}) => {
    network.push({ url: String(url), init });
    const u = new URL(String(url));
    const json = (v: any) =>
      new Response(JSON.stringify(v), {
        headers: { "content-type": "application/json" },
      });
    if (u.host === "analytics.example.com") {
      if (failAnalytics)
        return new Response("sensitive-provider-body", { status: 503 });
      if (u.pathname === "/api/websites" && init.method === "POST") {
        const b = JSON.parse(String(init.body));
        if (sites.has(b.id)) return new Response("{}", { status: 409 });
        sites.set(b.id, b);
        return json(b);
      }
      const id = u.pathname.split("/")[3];
      if (u.pathname.endsWith("/stats"))
        return json({
          visitors: 11,
          pageviews: 22,
          comparison: { visitors: 3, pageviews: 5 },
        });
      if (u.pathname.endsWith("/pageviews"))
        return json({
          pageviews: [{ x: new Date().toISOString().slice(0, 10), y: 22 }],
          sessions: [{ x: new Date().toISOString().slice(0, 10), y: 15 }],
        });
      if (u.pathname.endsWith("/metrics"))
        return json(
          u.searchParams.get("type") === "referrer"
            ? [
                { x: "https://www.google.com", y: 7 },
                { x: "", y: 4 },
              ]
            : u.searchParams.get("type") === "device"
              ? [
                  { x: "mobile", y: 8 },
                  { x: "desktop", y: 3 },
                ]
              : u.searchParams.get("type") === "path"
                ? [
                    { x: "/", y: 10 },
                    { x: "/book", y: 12 },
                  ]
                : [{ x: "booking_open", y: 2 }],
        );
      if (u.pathname === "/api/send")
        return json({ cache: "internal-never-return" });
      if (sites.has(id!)) return json(sites.get(id!));
    }
    if (u.host === "businessprofileperformance.googleapis.com")
      return json({
        multiDailyMetricTimeSeries: [
          {
            dailyMetricTimeSeries: [
              "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
              "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
              "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
              "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
              "CALL_CLICKS",
              "WEBSITE_CLICKS",
              "BUSINESS_DIRECTION_REQUESTS",
            ].map((dailyMetric) => ({
              dailyMetric,
              timeSeries: {
                datedValues: [
                  {
                    date: (() => {
                      const d = new Date(Date.now() - 86400000);
                      return {
                        year: d.getUTCFullYear(),
                        month: d.getUTCMonth() + 1,
                        day: d.getUTCDate(),
                      };
                    })(),
                    value: "5",
                  },
                ],
              },
            })),
          },
        ],
      });
    if (u.host === "oauth2.googleapis.com")
      return json({
        access_token: "never-return-google-token",
        refresh_token: "never-return-refresh",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/business.manage",
      });
    if (u.host === "mybusinessaccountmanagement.googleapis.com")
      return json({
        accounts: [{ name: "accounts/111", accountName: "Clinic team" }],
      });
    if (u.host === "mybusinessbusinessinformation.googleapis.com") {
      if (u.pathname.endsWith("/locations"))
        return json({
          locations: [
            {
              name: "locations/222",
              title: "Real clinic",
              storefrontAddress: { addressLines: ["Main street"] },
            },
          ],
        });
      return json({
        name: "locations/222",
        title: "Real clinic",
        phoneNumbers: { primaryPhone: "+919876543210" },
        websiteUri: "https://clinic.example.com",
        metadata: {
          newReviewUri:
            "https://search.google.com/local/writereview?placeid=real",
        },
      });
    }
    if (u.host === "mybusiness.googleapis.com") {
      if (u.pathname.endsWith("/reviews"))
        return json({
          reviews: [
            {
              reviewId: "review_1",
              starRating: "FIVE",
              reviewer: { displayName: "Reviewer" },
              comment: "Helpful staff",
              createTime: new Date().toISOString(),
            },
          ],
        });
      if (u.pathname.endsWith("/localPosts") && init.method !== "POST")
        return json({ localPosts: [] });
      return json({ name: "accepted" });
    }
    if (u.host === "graph.facebook.com") {
      if (u.pathname.endsWith("/oauth/access_token"))
        return json({ access_token: "never-return-whatsapp-token" });
      if (u.pathname.endsWith("/phone_numbers"))
        return json({
          data: [
            {
              id: "123456789",
              display_phone_number: "+919876543210",
              verified_name: "Real clinic",
              code_verification_status: "VERIFIED", is_on_biz_app: true,
            },
          ],
        });
      if (u.pathname.endsWith("/messages")) {
        if (failSend) throw Error("network unknown with a secret");
        return json({ messages: [{ id: "wamid.actual_provider_id" }] });
      }
      if (u.pathname.endsWith("/smb_app_data")) return json({ request_id: "sync-request" });
      return json({ success: true });
    }
    if (u.host === "us.i.posthog.com") return json({ status: 1 });
    return new Response("{}", { status: 404 });
  },
};
const q = () => `facilityId=${k.tenant.facilityId}`;
const ok = (r: { status: number; body: any }) => {
  expect(r, JSON.stringify(r.body)).toMatchObject({ status: 200 });
  return r.body;
};
const privateFields = (value: any) => {
  const text = JSON.stringify(value);
  for (const s of [
    "never-return-",
    "credential",
    "clientSecret",
    "access_token",
    "refresh_token",
    "verifier",
    "umami_id",
    "phoneNumberId",
  ])
    expect(text).not.toContain(s);
};
beforeAll(async () => {
  process.env.WA_APP_SECRET = settings.meta!.appSecret;
  process.env.WA_VERIFY_TOKEN = "managed-test-verification";
  k = await startKit("managed-integrations", undefined, undefined, settings);
  other = await startKit("managed-other", undefined, undefined, settings);
  admin = await k.person("Admin", "tenant_admin", null);
  desk = await k.person("Desk", "front_desk", k.tenant.facilityId);
  outsider = await other.person("Outsider", "tenant_admin", null);
});
afterAll(async () => {
  await k.close();
  await other.close();
  for (const key of Object.keys(process.env))
    if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
});
describe("server-held provider credentials", () => {
  it("encrypts credentials with clinic binding and refuses tampering", () => {
    const encrypted = seal(settings, { token: "secret-value" }, "clinic-a");
    expect(encrypted).not.toContain("secret-value");
    expect(unseal(settings, encrypted, "clinic-a")).toEqual({
      token: "secret-value",
    });
    expect(() => unseal(settings, encrypted, "clinic-b")).toThrow("renewed");
    expect(() =>
      unseal(settings, encrypted.slice(0, -4) + "AAAA", "clinic-a"),
    ).toThrow();
  });
  it("fails closed on partial settings without printing supplied credentials", () => {
    expect(() =>
      loadManagedSettings({ UMAMI_API_KEY: "secret-value" }),
    ).toThrow("incomplete");
    expect(() =>
      loadManagedSettings({ INTEGRATIONS_ENCRYPTION_KEY: "secret-value" }),
    ).toThrow("32 bytes");
    expect(() =>
      loadManagedSettings({
        UMAMI_API_KEY: "key",
        UMAMI_ORIGIN: "https://u:secret-value@example.com",
      }),
    ).toThrow("HTTPS origins");
  });
  it("allows server-managed test sending without advertising embedded signup", () => {
    const loaded = loadManagedSettings({WA_APP_ID:"123456", WA_APP_SECRET:"test-only", WA_VERIFY_TOKEN:"verify", WA_GRAPH_VERSION:"v25.0", WA_MANAGED_SENDING_ENABLED:"true", INTEGRATIONS_ENCRYPTION_KEY:"08".repeat(32), INTEGRATIONS_PUBLIC_ORIGIN:"https://hospital.example"});
    expect(loaded.meta?.configId).toBe("");
    expect(loaded.whatsappSending).toBe(true);
    expect(() => loadManagedSettings({WA_MANAGED_SENDING_ENABLED:"true"})).toThrow("incomplete");
  });
  it("hides provider error bodies and network exceptions", async () => {
    await expect(
      providerJson(
        {
          ...settings,
          fetcher: async () => new Response("private-token", { status: 401 }),
        },
        "https://api.example.com",
      ),
    ).rejects.toThrow("connected service");
  });
});
describe("managed website analytics", () => {
  it("rejects missing identity, wrong permissions and other tenants", async () => {
    expect(
      (await k.app.inject({ url: `/v1/website-analytics?${q()}` })).statusCode,
    ).toBe(401);
    expect(
      (
        await k.call(desk, "POST", "/v1/website-analytics/sites", {
          facilityId: k.tenant.facilityId,
          url: "https://clinic.example.com",
        })
      ).status,
    ).toBe(403);
    expect(
      (await other.call(outsider, "GET", `/v1/website-analytics?${q()}`))
        .status,
    ).toBe(404);
  });
  it("creates one provider site, persists it and keeps setup private", async () => {
    const body = {
        facilityId: k.tenant.facilityId,
        url: "https://clinic.example.com",
      },
      key = "analytics-create-001";
    const first = ok(
      await k.call(admin, "POST", "/v1/website-analytics/sites", body, key),
    );
    expect(
      ok(await k.call(admin, "POST", "/v1/website-analytics/sites", body, key)),
    ).toEqual(first);
    const read = ok(await k.call(admin, "GET", `/v1/website-analytics?${q()}`));
    expect(read.sites).toHaveLength(1);
    expect(read.sites[0]).toMatchObject({ id: first.id, status: "waiting" });
    expect(read.sites[0].code).toContain("data-site=");
    expect(read.totals.visitors).toBe(11);
    expect(read.before.visitors).toBe(3);
    expect(read.bookingsTracked).toBe(false);
    expect(read.totals.sources.google).toBe(7);
    expect(read.totals.devices.mobile).toBe(8);
    expect(read.pages).toHaveLength(2);
    privateFields(read);
    expect(
      network.filter(
        (n) =>
          n.url === "https://analytics.example.com/api/websites" &&
          n.init.method === "POST",
      ),
    ).toHaveLength(1);
  });
  it("blocks public/private targets, bad ranges and spoofed installation success", async () => {
    for (const url of [
      "http://clinic.example.com",
      "https://127.0.0.1",
      "https://a.local",
      "https://user:pass@example.com",
      "https://clinic.example.com/?patient=private",
    ])
      expect(
        (
          await k.call(admin, "POST", "/v1/website-analytics/sites", {
            facilityId: k.tenant.facilityId,
            url,
          })
        ).status,
      ).toBe(400);
    expect(
      (await k.call(admin, "GET", `/v1/website-analytics?${q()}&days=1000`))
        .status,
    ).toBe(400);
    const read = ok(await k.call(admin, "GET", `/v1/website-analytics?${q()}`));
    expect(read.sites[0].status).toBe("waiting");
  });
  it("accepts only bounded events from the exact site origin and marks live only after provider acceptance", async () => {
    const site = ok(await k.call(admin, "GET", `/v1/website-analytics?${q()}`))
      .sites[0];
    const body = {
      site: site.id,
      event: "pageview",
      page: "/book",
      source: "google",
      device: "mobile",
    };
    const send = (payload: any, origin = "https://clinic.example.com") =>
      k.app.inject({
        method: "POST",
        url: "/a/collect",
        headers: {
          origin,
          "content-type": "text/plain",
          "user-agent": "browser-test",
        },
        payload: JSON.stringify(payload),
      });
    expect((await send(body, "https://evil.example.com")).statusCode).toBe(400);
    expect((await send({ ...body, patientName: "PRIVATE" })).statusCode).toBe(
      400,
    );
    expect(
      (await send({ ...body, page: "/book?patient=PRIVATE" })).statusCode,
    ).toBe(400);
    expect((await send(body)).statusCode).toBe(200);
    const read = ok(await k.call(admin, "GET", `/v1/website-analytics?${q()}`));
    expect(read.sites[0].status).toBe("live");
    privateFields(read);
    const collected = JSON.parse(
      String(network.findLast((n) => n.url.endsWith("/api/send"))!.init.body),
    );
    expect(collected.payload.url).toBe("/book");
    expect(collected.payload.title).toBe("");
    expect(collected).not.toHaveProperty("patientName");
  });
  it("shows service failure as unavailable instead of zero traffic", async () => {
    failAnalytics = true;
    const read = ok(await k.call(admin, "GET", `/v1/website-analytics?${q()}`));
    expect(read.status).toBe("service_unavailable");
    expect(read.totals).toBeNull();
    privateFields(read);
    failAnalytics = false;
  });
  it("stops collection immediately after removal", async () => {
    const site = ok(await k.call(admin, "GET", `/v1/website-analytics?${q()}`))
      .sites[0];
    ok(
      await k.call(
        admin,
        "DELETE",
        `/v1/website-analytics/sites/${site.id}?${q()}`,
      ),
    );
    const r = await k.app.inject({
      method: "POST",
      url: "/a/collect",
      headers: { origin: "https://clinic.example.com" },
      payload: {
        site: site.id,
        event: "pageview",
        page: "/",
        source: "direct",
        device: "desktop",
      },
    });
    expect(r.statusCode).toBe(404);
  });
});
describe("Google consent and dashboard writes", () => {
  it("uses state, PKCE, an HttpOnly callback cookie and a one-use code exchange", async () => {
    const started = await k.app.inject({
      method: "POST",
      url: "/v1/google-business/connect",
      headers: {
        authorization: `Bearer ${admin.token}`,
        "idempotency-key": "google-start-001",
      },
      payload: { facilityId: k.tenant.facilityId },
    });
    expect(started.statusCode).toBe(200);
    const u = new URL(started.json().authorizationUrl),
      state = u.searchParams.get("state")!;
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(started.headers["set-cookie"]).toContain("HttpOnly");
    privateFields(started.json());
    const callback = `/integrations/google/callback?state=${state}&code=one-use-code`;
    const missing = await k.app.inject({ url: callback });
    expect(missing.statusCode).toBe(302);
    expect(missing.headers.location).toContain("google=failed");
    const valid = await k.app.inject({
      url: callback,
      headers: { cookie: `hms_google_state=${state}` },
    });
    expect(valid.headers.location).toContain(
      "/staff/google_business?google=choose",
    );
    const replay = await k.app.inject({
      url: callback,
      headers: { cookie: `hms_google_state=${state}` },
    });
    expect(replay.headers.location).toContain("google=failed");
    const listings = ok(
      await k.call(admin, "GET", `/v1/google-business/locations?${q()}`),
    );
    expect(listings.items[0].name).toBe("Real clinic");
    expect(
      (
        await k.call(admin, "POST", "/v1/google-business/location", {
          facilityId: k.tenant.facilityId,
          locationId: "accounts/111/locations/999",
        })
      ).status,
    ).toBe(403);
    ok(
      await k.call(admin, "POST", "/v1/google-business/location", {
        facilityId: k.tenant.facilityId,
        locationId: listings.items[0].id,
      }),
    );
    const read = ok(await k.call(admin, "GET", `/v1/google-business?${q()}`));
    expect(read.account.listing).toBe("Real clinic");
    expect(read.reviews).toHaveLength(1);
    privateFields(read);
    const {
      rows: [row],
    } = await k.admin.query(
      "SELECT credential FROM comms.managed_connection WHERE tenant_id=$1 AND provider='google'",
      [k.tenant.tenantId],
    );
    expect(row.credential).not.toContain("never-return");
  });
  it("reads scoped Google performance without synthetic metrics", async () => {
    const r = ok(
      await k.call(admin, "GET", `/v1/google-business/performance?${q()}`),
    );
    expect(r).toMatchObject({
      status: "ready",
      current: { search: 10, maps: 10, calls: 5 },
    });
    privateFields(r);
  });
  it("rejects client-owned status and unsupported fields and attempts provider changes at most once", async () => {
    const read = ok(await k.call(admin, "GET", `/v1/google-business?${q()}`)),
      path = `/v1/google-business/actions?${q()}`;
    expect(
      (
        await k.call(admin, "POST", path, {
          action: "profile",
          version: read.version,
          patch: { credential: "private" },
        })
      ).status,
    ).toBe(400);
    const body = {
      action: "reply",
      version: read.version,
      reviewId: "review_1",
      text: "Thank you.",
    };
    ok(await k.call(admin, "POST", path, body, "google-reply-one"));
    expect(
      (await k.call(admin, "POST", path, body, "google-reply-one")).status,
    ).toBe(409);
    expect(
      network.filter((n) => n.url.endsWith("/reviews/review_1/reply")),
    ).toHaveLength(1);
    expect((await k.call(desk, "POST", path, body)).status).toBe(403);
  });
});
describe("WhatsApp persistence and provider connection", () => {
  it("persists drafts, rejects stale concurrent edits and cannot assert live booking", async () => {
    const read = ok(
      await k.call(admin, "GET", `/v1/whatsapp-workspace?${q()}`),
    );
    expect(read.connected).toBe(false);
    expect(read.data.conversations).toEqual([]);
    privateFields(read);
    const { connected: _, ...draft } = read.setup,
      body = {
        facilityId: k.tenant.facilityId,
        version: 0,
        draft,
        preferences: read.data.settings,
      };
    expect(
      (
        await k.call(admin, "PUT", "/v1/whatsapp-workspace", {
          ...body,
          draft: { ...draft, live: true },
        })
      ).status,
    ).toBe(422);
    const responses = await Promise.all([
      k.call(admin, "PUT", "/v1/whatsapp-workspace", body),
      k.call(admin, "PUT", "/v1/whatsapp-workspace", {
        ...body,
        preferences: { ...body.preferences, handoffWords: "receptionist" },
      }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await k.call(desk, "PUT", "/v1/whatsapp-workspace", body)).status,
    ).toBe(403);
  });
  it("exchanges the signup code server-side and verifies phone membership before binding", async () => {
    const start = ok(
      await k.call(admin, "POST", "/v1/whatsapp-workspace/connect", {
        facilityId: k.tenant.facilityId,
      }),
    );
    const body = {
      facilityId: k.tenant.facilityId,
      attemptId: start.attemptId,
      nonce: start.nonce,
      code: "meta-code",
      businessAccountId: "987654321",
      phoneNumberId: "123456789",
      path: "coexistence",
    };
    expect(
      (
        await other.call(
          outsider,
          "POST",
          "/v1/whatsapp-workspace/connect/complete",
          body,
        )
      ).status,
    ).toBe(403);
    ok(
      await k.call(
        admin,
        "POST",
        "/v1/whatsapp-workspace/connect/complete",
        body,
      ),
    );
    expect(
      (
        await k.call(
          admin,
          "POST",
          "/v1/whatsapp-workspace/connect/complete",
          body,
        )
      ).status,
    ).toBe(403);
    const read = ok(
      await k.call(admin, "GET", `/v1/whatsapp-workspace?${q()}`),
    );
    expect(read).toMatchObject({
      connected: true,
      setup: {
        connected: { phone: "+919876543210", name: "Real clinic" },
        live: false,
      },
      capabilities: { sending: true, booking: false },
    });
    privateFields(read);
  });
  it("ingests real signed callbacks, queues consented replies and claims them once across concurrent workers", async () => {
    const event = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "987654321",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "123456789" },
                messages: [
                  {
                    id: randomUUID(),
                    from: "919876543299",
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    text: { body: "human" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const payload = JSON.stringify(event),
      signature =
        "sha256=" +
        createHmac("sha256", settings.meta!.appSecret)
          .update(payload)
          .digest("hex");
    const call = () =>
      k.app.inject({
        method: "POST",
        url: "/v1/integrations/whatsapp/webhook",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
        },
        payload,
      });
    expect((await call()).statusCode).toBe(200);
    expect((await call()).statusCode).toBe(200);
    await k.dispatch();
    const {
      rows: [c],
    } = await k.admin.query(
      "SELECT id,contact_point_id FROM comms.conversation WHERE tenant_id=$1",
      [k.tenant.tenantId],
    );
    chatId = c.id;
    contactId = c.contact_point_id;
    const denied = await k.call(
      admin,
      "POST",
      `/v1/whatsapp-workspace/conversations/${chatId}/reply`,
      {
        version: ok(
          await k.call(
            admin,
            "GET",
            `/v1/whatsapp-workspace/conversations/${chatId}`,
          ),
        ).conversation.version,
        text: "Hello",
      },
    );
    expect(denied.status).toBe(422);
    ok(
      await k.call(admin, "POST", `/v1/contact-points/${contactId}/consents`, {
        purpose: "care",
        action: "opt_in",
        source: "staff",
        evidence: "Patient explicitly requested a reply.",
        explicitOptIn: true,
      }),
    );
    const read = ok(
      await k.call(
        admin,
        "GET",
        `/v1/whatsapp-workspace/conversations/${chatId}`,
      ),
    );
    expect(read.messages).toHaveLength(1);
    const body = {
      version: read.conversation.version,
      text: "Hello from reception",
    };
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/conversations/${chatId}/reply`,
        body,
        "reply-once-001",
      ),
    );
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/conversations/${chatId}/reply`,
        body,
        "reply-once-001",
      ),
    );
    await Promise.all([
      dispatchManagedWhatsApp(k.db, settings),
      dispatchManagedWhatsApp(k.db, settings),
    ]);
    expect(network.filter((n) => n.url.endsWith("/messages"))).toHaveLength(1);
    const latest = ok(
      await k.call(
        admin,
        "GET",
        `/v1/whatsapp-workspace/conversations/${chatId}`,
      ),
    );
    expect(latest.messages.at(-1)).toMatchObject({
      status: "sent",
      transport: "meta",
    });
    for (const status of ["delivered", "read", "sent", "delivered"]) {
      const raw = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "987654321",
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "123456789" },
                  statuses: [
                    {
                      id: "wamid.actual_provider_id",
                      status,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
      const r = await k.app.inject({
        method: "POST",
        url: "/v1/integrations/whatsapp/webhook",
        payload: raw,
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256":
            "sha256=" +
            createHmac("sha256", settings.meta!.appSecret)
              .update(raw)
              .digest("hex"),
        },
      });
      expect(r.statusCode).toBe(200);
      await k.dispatch();
    }
    expect(
      ok(
        await k.call(
          admin,
          "GET",
          `/v1/whatsapp-workspace/conversations/${chatId}`,
        ),
      ).messages.at(-1).status,
    ).toBe("read");
  });
  it("does not retry an unknown provider acceptance or send after consent withdrawal", async () => {
    let c = ok(
      await k.call(
        admin,
        "GET",
        `/v1/whatsapp-workspace/conversations/${chatId}`,
      ),
    ).conversation;
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/conversations/${chatId}/reply`,
        { version: c.version, text: "An uncertain reply" },
      ),
    );
    failSend = true;
    await dispatchManagedWhatsApp(k.db, settings);
    const count = network.filter((n) => n.url.endsWith("/messages")).length;
    await dispatchManagedWhatsApp(k.db, settings);
    expect(network.filter((n) => n.url.endsWith("/messages"))).toHaveLength(
      count,
    );
    failSend = false;
    expect(
      ok(
        await k.call(
          admin,
          "GET",
          `/v1/whatsapp-workspace/conversations/${chatId}`,
        ),
      ).messages.at(-1).status,
    ).toBe("unknown");
    c = ok(
      await k.call(
        admin,
        "GET",
        `/v1/whatsapp-workspace/conversations/${chatId}`,
      ),
    ).conversation;
    ok(
      await k.call(
        admin,
        "POST",
        `/v1/whatsapp-workspace/conversations/${chatId}/reply`,
        { version: c.version, text: "Must not send after STOP" },
      ),
    );
    ok(
      await k.call(admin, "POST", `/v1/contact-points/${contactId}/consents`, {
        purpose: "care",
        action: "stop",
        source: "staff",
        evidence: "Patient withdrew messaging consent.",
        explicitOptIn: false,
      }),
    );
    await dispatchManagedWhatsApp(k.db, settings);
    expect(network.filter((n) => n.url.endsWith("/messages"))).toHaveLength(
      count,
    );
  });
  it("does not dispatch simulation reminder rows or send anything without eligible replies", async () => {
    const before = network.length;
    expect(await dispatchManagedWhatsApp(k.db, settings)).toBe(0);
    expect(network.length).toBe(before);
  });
  it("disconnect removes credentials and hides connection status across sessions", async () => {
    ok(
      await k.call(admin, "DELETE", `/v1/managed-connections/whatsapp?${q()}`),
    );
    expect(
      ok(await k.call(admin, "GET", `/v1/whatsapp-workspace?${q()}`)).connected,
    ).toBe(false);
    const { rows } = await k.admin.query(
      "SELECT id FROM comms.managed_connection WHERE tenant_id=$1 AND provider='whatsapp' AND enabled",
      [k.tenant.tenantId],
    );
    expect(rows).toHaveLength(0);
  });
});

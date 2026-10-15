import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { preconditionFailed } from "@hms/platform";

export interface ManagedSettings {
  fetcher: typeof fetch;
  encryptionKey?: Buffer;
  publicOrigin?: string;
  google?: { clientId: string; clientSecret: string };
  meta?: {
    appId: string;
    appSecret: string;
    configId: string;
    graphVersion: string;
  };
  umami?: { origin: string; key: string; teamId?: string };
  whatsappSending?: boolean;
  posthog?: { origin: string; key: string };
}
export function loadManagedSettings(
  env: NodeJS.ProcessEnv = process.env,
): ManagedSettings {
  const settings: ManagedSettings = {
    fetcher: fetch,
    whatsappSending: env.WA_MANAGED_SENDING_ENABLED === "true",
  };
  const origin = (value: string, local = false) => {
    const u = new URL(value);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      (u.protocol !== "https:" &&
        !(
          local &&
          env.NODE_ENV !== "production" &&
          u.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(u.hostname)
        ))
    )
      throw Error("Managed integration addresses must be HTTPS origins");
    return u.origin;
  };
  if (env.INTEGRATIONS_ENCRYPTION_KEY) {
    if (!/^[a-f0-9]{64}$/i.test(env.INTEGRATIONS_ENCRYPTION_KEY))
      throw Error("INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes in hex");
    settings.encryptionKey = Buffer.from(
      env.INTEGRATIONS_ENCRYPTION_KEY,
      "hex",
    );
  }
  if (env.INTEGRATIONS_PUBLIC_ORIGIN)
    settings.publicOrigin = origin(env.INTEGRATIONS_PUBLIC_ORIGIN, true);
  if (env.GOOGLE_BUSINESS_CLIENT_ID || env.GOOGLE_BUSINESS_CLIENT_SECRET) {
    if (
      !env.GOOGLE_BUSINESS_CLIENT_ID ||
      !env.GOOGLE_BUSINESS_CLIENT_SECRET ||
      !settings.encryptionKey ||
      !settings.publicOrigin
    )
      throw Error("Google Business connection settings are incomplete");
    settings.google = {
      clientId: env.GOOGLE_BUSINESS_CLIENT_ID,
      clientSecret: env.GOOGLE_BUSINESS_CLIENT_SECRET,
    };
  }
  if (env.META_SIGNUP_CONFIG_ID) {
    if (
      !env.WA_APP_ID ||
      !env.WA_APP_SECRET ||
      !/^v\d+\.\d+$/.test(env.WA_GRAPH_VERSION ?? "") ||
      !settings.encryptionKey ||
      !settings.publicOrigin
    )
      throw Error("WhatsApp embedded connection settings are incomplete");
    settings.meta = {
      appId: env.WA_APP_ID,
      appSecret: env.WA_APP_SECRET,
      configId: env.META_SIGNUP_CONFIG_ID,
      graphVersion: env.WA_GRAPH_VERSION!,
    };
  }
  if (env.UMAMI_ORIGIN || env.UMAMI_API_KEY) {
    if (!env.UMAMI_ORIGIN || !env.UMAMI_API_KEY)
      throw Error("Managed analytics settings are incomplete");
    settings.umami = {
      origin: origin(env.UMAMI_ORIGIN, true),
      key: env.UMAMI_API_KEY,
      ...(env.UMAMI_TEAM_ID ? { teamId: env.UMAMI_TEAM_ID } : {}),
    };
  }
  if (env.MANAGED_POSTHOG_KEY) {
    if (
      !["https://us.i.posthog.com", "https://eu.i.posthog.com"].includes(
        env.MANAGED_POSTHOG_ORIGIN ?? "",
      )
    )
      throw Error("PostHog requires an approved ingestion origin");
    settings.posthog = {
      origin: env.MANAGED_POSTHOG_ORIGIN!,
      key: env.MANAGED_POSTHOG_KEY,
    };
  }
  return settings;
}
export function seal(
  settings: ManagedSettings,
  value: unknown,
  binding: string,
) {
  if (!settings.encryptionKey)
    throw preconditionFailed(
      "Secure connections are being prepared. Please try again later.",
    );
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", settings.encryptionKey, iv);
  cipher.setAAD(Buffer.from(binding));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), bytes]
    .map((v) => v.toString("base64url"))
    .join(".");
}
export function unseal<T>(
  settings: ManagedSettings,
  value: string,
  binding: string,
): T {
  try {
    const parts = value.split(".");
    if (
      parts.length !== 3 ||
      parts.some(
        (p) =>
          !p ||
          !/^[A-Za-z0-9_-]+$/.test(p) ||
          Buffer.from(p, "base64url").toString("base64url") !== p,
      )
    )
      throw Error();
    const [iv, tag, bytes] = parts.map((v) => Buffer.from(v, "base64url"));
    if (iv?.length !== 12 || tag?.length !== 16) throw Error();
    if (!settings.encryptionKey || !iv || !tag || !bytes) throw Error();
    const cipher = createDecipheriv("aes-256-gcm", settings.encryptionKey, iv);
    cipher.setAAD(Buffer.from(binding));
    cipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([cipher.update(bytes), cipher.final()]).toString(),
    ) as T;
  } catch {
    throw preconditionFailed(
      "This connection needs to be renewed. Connect the account again.",
    );
  }
}
/** Provider bodies and URLs can contain credentials. Never include them in an error or log. */
export async function providerJson(
  settings: ManagedSettings,
  url: string,
  init: RequestInit = {},
): Promise<any> {
  try {
    const response = await settings.fetcher(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error();
    if (response.status === 204) return {};
    const text = await response.text();
    if (text.length > 2_000_000) throw Error();
    return text ? JSON.parse(text) : {};
  } catch {
    throw preconditionFailed(
      "The connected service could not complete this request. Please retry or reconnect.",
    );
  }
}

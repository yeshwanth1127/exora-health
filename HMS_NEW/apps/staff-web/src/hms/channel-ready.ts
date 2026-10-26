import { useEffect, useState } from "react";
import { request } from "./client";

// Channels whose sidebar subpages stay hidden until setup is done; each reads the same status its page uses.
const checks: Record<string, (facilityId: string) => Promise<boolean>> = {
  whatsapp: async (f) =>
    !!(await request<{ setup: { connected?: unknown } }>(`/v1/whatsapp-workspace?facilityId=${f}`)).setup.connected,
  google_business: async (f) =>
    !!(await request<{ account?: unknown }>(`/v1/google-business?facilityId=${f}`)).account,
  apple_messages: async (f) => {
    const d = await request<{ configured: boolean; localDemo?: boolean }>(`/v1/apple-messages?facilityId=${f}`);
    return d.configured && !d.localDemo;
  },
  voice: async () => {
    const r = await fetch("/public/v1/voice/config", { cache: "no-store" });
    return r.ok && (await r.json()).enabled === true;
  },
};
export const gatedChannel = (key: string) => Object.hasOwn(checks, key);

/** Ready channels among `keys`. Rechecked on clinic change and on each navigation, so finishing setup shows the tabs. */
export function useReadyChannels(facilityId: string, keys: string[], page: string) {
  const [ready, setReady] = useState<ReadonlySet<string>>(new Set());
  const wanted = keys.filter(gatedChannel).join();
  useEffect(() => {
    if (!facilityId) return;
    let alive = true;
    void Promise.all(
      wanted.split(",").filter(Boolean).map(async (k) => [k, await checks[k]!(facilityId).catch(() => false)] as const),
    ).then((r) => alive && setReady(new Set(r.filter(([, ok]) => ok).map(([k]) => k))));
    return () => {
      alive = false;
    };
  }, [facilityId, wanted, page]);
  return ready;
}

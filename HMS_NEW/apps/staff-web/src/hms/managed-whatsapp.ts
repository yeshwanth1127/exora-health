import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IntentKeys, request } from "./client";
import { useQuery, useWorkspace } from "./hooks";
import { useUnsaved } from "./leave";
import { emptySetup, type WhatsAppSetup } from "./whatsapp-setup";
import type { WaData, WaSettings } from "./whatsapp-data";
import type { Patch } from "./WhatsApp";
export type WaRemote = {
  available: boolean;
  connected: boolean;
  version: number;
  setup: WhatsAppSetup;
  capabilities: {
    sending: boolean;
    booking: boolean;
    automations: boolean;
    campaigns: boolean;
  };
  data: WaData;
};
export function useManagedSetup() {
  const { facility } = useWorkspace();
  const q = useQuery<WaRemote>(
    `/v1/whatsapp-workspace?facilityId=${facility.facilityId}`,
  );
  const [setup, setSetup] = useState<WhatsAppSetup>(emptySetup),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const current = useRef(setup),
    version = useRef(0),
    loaded = useRef(false),
    dirty = useRef(false),
    busy = useRef(false),
    [revision, bump] = useState(0);
  const keys = useRef(new IntentKeys());
  useEffect(() => {
    if (q.data && !dirty.current && !busy.current) {
      current.current = q.data.setup;
      setSetup(q.data.setup);
      version.current = q.data.version;
      loaded.current = true;
    }
  }, [q.data, saving]);
  const refreshRef = useRef(q.refresh);
  refreshRef.current = q.refresh;
  useEffect(() => {
    const refresh = () => {
      void refreshRef.current();
    };
    window.addEventListener("hms-whatsapp-updated", refresh);
    return () => window.removeEventListener("hms-whatsapp-updated", refresh);
  }, [facility.facilityId]);
  const update = (patch: Patch) => {
    if (!loaded.current || error) return;
    const p = typeof patch === "function" ? patch(current.current) : patch;
    if (p.connected === null) {
      toast.error("Use Disconnect number to remove the connection.");
      return;
    }
    current.current = { ...current.current, ...p };
    dirty.current = true;
    setSetup(current.current);
    bump((r) => r + 1);
  };
  useUnsaved(dirty.current || saving, { pending: saving });
  useEffect(() => {
    if (!dirty.current || busy.current || !q.data || error) return;
    const timer = setTimeout(async () => {
      busy.current = true;
      setSaving(true);
      dirty.current = false;
      const { connected: _, ...draft } = current.current;
      const path = "/v1/whatsapp-workspace",
        body = {
          facilityId: facility.facilityId,
          version: version.current,
          draft,
          preferences: q.data!.data.settings,
        };
      try {
        const result = await request<{ version: number }>(path, {
          method: "PUT",
          body,
          idempotencyKey: keys.current.for(path, body),
        });
        version.current = result.version;
        keys.current.complete(path, body);
        await q.refresh();
        window.dispatchEvent(new Event("hms-whatsapp-updated"));
      } catch (e) {
        dirty.current = true;
        setError(
          e instanceof Error
            ? e.message
            : "WhatsApp settings could not be saved.",
        );
      } finally {
        busy.current = false;
        setSaving(false);
        bump((r) => r + 1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [revision, q.data, error, facility.facilityId]);
  return { setup, update, query: q, saving, error, refresh: q.refresh };
}
export async function connectMeta(
  facilityId: string,
  path: WhatsAppSetup["path"],
) {
  const start = await request<{
    attemptId: string;
    nonce: string;
    appId: string;
    configId: string;
    version: string;
  }>("/v1/whatsapp-workspace/connect", {
    method: "POST",
    body: { facilityId },
    idempotencyKey: crypto.randomUUID(),
  });
  const win = window as typeof window & {
    FB?: {
      init: (v: unknown) => void;
      login: (cb: (r: any) => void, v: unknown) => void;
    };
  };
  if (!win.FB) {
    await new Promise<void>((resolve, reject) => {
      let script = document.querySelector<HTMLScriptElement>(
        "script[data-exora-meta]",
      );
      if (script) {
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
          "error",
          () => reject(Error("Meta sign-in could not load.")),
          { once: true },
        );
        return;
      }
      script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.dataset.exoraMeta = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(Error("Meta sign-in could not load."));
      document.head.append(script);
    });
  }
  if (!win.FB) throw Error("Meta sign-in could not load.");
  win.FB.init({
    appId: start.appId,
    autoLogAppEvents: false,
    xfbml: false,
    version: start.version,
  });
  const result = await new Promise<{
    code: string;
    businessAccountId: string;
    phoneNumberId: string;
  }>((resolve, reject) => {
    let code = "",
      businessAccountId = "",
      phoneNumberId = "",
      finished = false;
    const clean = () => {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
    const fail = (message: string) => {
      if (finished) return;
      finished = true;
      clean();
      reject(Error(message));
    };
    const complete = () => {
      if (!finished && code && businessAccountId && (phoneNumberId || path === "coexistence")) {
        finished = true;
        clean();
        resolve({ code, businessAccountId, phoneNumberId });
      }
    };
    const receive = (event: MessageEvent) => {
      if (
        !["https://www.facebook.com", "https://web.facebook.com"].includes(
          event.origin,
        )
      )
        return;
      let data = event.data;
      try {
        if (typeof data === "string") data = JSON.parse(data);
      } catch {
        return;
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (
        ["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"].includes(
          data.event,
        )
      ) {
        businessAccountId = String(data.data?.waba_id ?? "");
        phoneNumberId = String(data.data?.phone_number_id ?? "");
        complete();
      } else if (["CANCEL", "ERROR"].includes(data.event))
        fail("WhatsApp connection was not completed. Please try again.");
    };
    const timer = setTimeout(
      () => fail("WhatsApp connection expired. Please try again."),
      180000,
    );
    window.addEventListener("message", receive);
    win.FB!.login(
      (r) => {
        code = r.authResponse?.code ?? "";
        if (!code) fail("WhatsApp connection was not completed.");
        else complete();
      },
      {
        config_id: start.configId,
        response_type: "code",
        override_default_response_type: true,
        // v4 products and coexistence are selected in the company's Login for Business configuration.
        extras: {},
      },
    );
  });
  await request("/v1/whatsapp-workspace/connect/complete", {
    method: "POST",
    body: {
      facilityId,
      path,
      attemptId: start.attemptId,
      nonce: start.nonce,
      ...result,
      phoneNumberId: result.phoneNumberId || undefined,
    },
  });
}
export async function saveWaPreferences(
  facilityId: string,
  remote: WaRemote,
  preferences: WaSettings,
  keys: IntentKeys,
) {
  const { connected: _, ...draft } = remote.setup,
    path = "/v1/whatsapp-workspace",
    body = { facilityId, version: remote.version, draft, preferences };
  await request(path, {
    method: "PUT",
    body,
    idempotencyKey: keys.for(path, body),
  });
  keys.complete(path, body);
}

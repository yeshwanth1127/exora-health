import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { HmsError, IntentKeys, request } from "./client";
import { can } from "./model";
import type { Facility, Me, Practitioner } from "./types";
export type Workspace = {
  me: Me;
  facility: Facility;
  practitioners: Practitioner[];
  go: (page: string) => void;
  /** Loads the clinic's doctors again (after a doctor is added, edited or leaves). */
  reloadPractitioners?: () => void;
};
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace context is missing");
  return {
    ...value,
    can: (permission: string) =>
      can(value.me, permission, value.facility.facilityId),
  };
}
export function useQuery<T>(path: string | null, pollMs = 0) {
  const { me, facility } = useWorkspace();
  const key = `${me.tenantId}:${facility.facilityId}:${path}`;
  const reload = useRef<(() => Promise<boolean>) | null>(null);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
    failure: HmsError | null;
  }>({ key: "", data: null, error: "", loading: true, failure: null });
  useEffect(() => {
    if (!path) {
      reload.current = null;
      return;
    }
    let alive = true,
      sequence = 0;
    let controller: AbortController;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load(): Promise<boolean> {
      const current = ++sequence;
      controller?.abort();
      clearTimeout(timer);
      controller = new AbortController();
      setState((old) => ({
        key,
        data: old.key === key ? old.data : null,
        error: "",
        failure: null,
        loading: old.key !== key || old.data === null,
      }));
      try {
        const data = await request<T>(path!, { signal: controller.signal });
        if (alive && current === sequence) {
          setState({ key, data, error: "", failure: null, loading: false });
          return true;
        }
      } catch (e) {
        if (
          alive &&
          current === sequence &&
          !(e instanceof Error && e.name === "AbortError")
        ) {
          const failure = e instanceof HmsError ? e : null;
          setState((old) => ({
            key,
            data: [401, 403, 404].includes(failure?.status ?? 0)
              ? null
              : old.key === key
                ? old.data
                : null,
            error: e instanceof Error ? e.message : "Could not load this page.",
            failure,
            loading: false,
          }));
        }
      } finally {
        if (
          alive &&
          current === sequence &&
          pollMs &&
          document.visibilityState === "visible"
        )
          timer = setTimeout(() => void load(), pollMs);
      }
      return false;
    }
    const visible = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible" && pollMs) void load();
    };
    reload.current = load;
    document.addEventListener("visibilitychange", visible);
    void load();
    return () => {
      alive = false;
      reload.current = null;
      controller?.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [path, key, pollMs]);
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : "",
    failure: state.key === key ? state.failure : null,
    loading: !!path && (state.key !== key || state.loading),
    refresh: useCallback(async () => (await reload.current?.()) ?? false, []),
  };
}
export function useCommand() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [failure, setFailure] = useState<HmsError | null>(null),
    [unknown, setUnknown] = useState(false);
  const keys = useRef(new IntentKeys()),
    inFlight = useRef(false),
    uncertainIntent = useRef("");
  async function run<T>(
    path: string,
    body?: unknown,
    keyed = false,
    method = "POST",
  ): Promise<T | undefined> {
    const fingerprint = JSON.stringify([path, body, method]);
    if (inFlight.current || (unknown && !keyed)) return;
    if (unknown && uncertainIntent.current !== fingerprint) {
      setError(
        "The previous change has an unknown outcome. Recover that request before starting another.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setFailure(null);
    try {
      const result = await request<T>(path, {
        method,
        body,
        ...(keyed ? { idempotencyKey: keys.current.for(path, body) } : {}),
      });
      keys.current.complete(path, body);
      setUnknown(false);
      return result;
    } catch (e) {
      const uncertain =
        unknown || (e instanceof HmsError && e.code === "outcome_unknown");
      setUnknown(uncertain);
      uncertainIntent.current = uncertain ? fingerprint : "";
      setFailure(e instanceof HmsError ? e : null);
      setError(
        e instanceof Error ? e.message : "The change could not be saved.",
      );
      return undefined;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    error,
    /** The last refusal, for reacting to its code (e.g. a stale version). */
    failure,
    unknown,
    reconciled: () => {
      setUnknown(false);
      setError("");
      setFailure(null);
    },
  };
}

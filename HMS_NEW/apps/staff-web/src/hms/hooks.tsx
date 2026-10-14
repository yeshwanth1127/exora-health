import { useUnsaved } from "./leave";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { HmsError, IntentKeys, request, identityRevision } from "./client";
import { nativeKeyed } from "./operational-intent";
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
export function useQuery<T>(
  path: string | null,
  pollMs = 0,
  decode?: (value: unknown) => T,
) {
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
        const response = await request<T>(path!, { signal: controller.signal });
        const data = decode ? decode(response) : response;
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
            data:
              [401, 403, 404].includes(failure?.status ?? 0) ||
              failure?.code === "invalid_response"
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
  }, [path, key, pollMs, decode]);
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
    [unknown, setUnknown] = useState(false),
    [recoverable, setRecoverable] = useState(false);
  useUnsaved(busy || unknown, { pending: busy || unknown });
  const frozen = useRef<{ path: string; body?: unknown; keyed: boolean; method: string; revision: number } | null>(null);
  const keys = useRef(new IntentKeys()),
    inFlight = useRef(false),
    uncertainIntent = useRef("");
  async function run<T>(
    path: string,
    body?: unknown,
    keyed = false,
    method = "POST",
  ): Promise<T | undefined> {
    keyed ||= nativeKeyed(path, method);
    if (unknown && frozen.current?.revision !== identityRevision()) {
      setError("The workspace changed. Recover this change in its original workspace.");
      return;
    }
    const fingerprint = JSON.stringify([path, body, method]);
    if (inFlight.current || (unknown && !keyed)) return;
    if (unknown && uncertainIntent.current !== fingerprint) {
      setError(
        "The previous change has an unknown outcome. Recover that request before starting another.",
      );
      return;
    }
    frozen.current = { path, body: structuredClone(body), keyed, method, revision: identityRevision() };
    setRecoverable(keyed);
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
        unknown || (e instanceof HmsError && ["outcome_unknown", "context_changed"].includes(e.code));
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
    canReplay: unknown && recoverable,
    replay: async <T,>(): Promise<T | undefined> => {
      const original = frozen.current;
      if (!unknown || !original?.keyed || original.revision !== identityRevision()) return undefined;
      return run<T>(original.path, structuredClone(original.body), true, original.method);
    },
    busy,
    error,
    /** The last refusal, for reacting to its code (e.g. a stale version). */
    failure,
    unknown,
    reconciled: () => {
      if (unknown) {
        setError("A refreshed record cannot confirm who saved this change. Check the original request, or ask an administrator to reconcile it.");
        return;
      }
      setUnknown(false);
      setError("");
      setFailure(null);
    },
  };
}

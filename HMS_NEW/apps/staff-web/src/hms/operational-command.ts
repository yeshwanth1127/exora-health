import { useContext, useRef, useState, useLayoutEffect } from "react";
import { useApi } from "@/components/workspace";
import { OriginalResourceContext } from "@/components/resource-source";
import { api } from "@/lib/api";
import { useUnsaved } from "./leave";
import { request, identityRevision, HmsError } from "./client";
import {
  OperationalIntent,
  legacyKeyed,
  nativeKeyed,
  type MutationIntent,
  type MutationOptions,
  type MutationTransport,
} from "./operational-intent";
export function useRecoverableCommand(
  transport: MutationTransport = request,
  context = "",
) {
  const live = useRef({ transport, context });
  const machine = useRef<OperationalIntent | null>(null);
  useLayoutEffect(() => {
    live.current = { transport, context };
    machine.current ??= new OperationalIntent(
      (path, options) => live.current.transport(path, options),
      () => `${identityRevision()}:${live.current.context}`,
    );
  }, [transport, context]);
  const getMachine = () => {
    if (!machine.current)
      throw new Error("The command workspace is not ready.");
    return machine.current;
  };
  const [snapshot, setSnapshot] = useState(() => ({
    busy: false,
    unknown: false,
    error: "",
    failure: null as HmsError | null,
    intent: null as MutationIntent | null,
  }));
  const changed = () => {
    const m = getMachine();
    setSnapshot({
      busy: m.busy,
      unknown: m.unknown,
      error: m.error,
      failure: m.failure,
      intent: m.intent,
    });
  };
  async function invoke<T>(operation: () => Promise<unknown>) {
    try {
      const promise = operation();
      changed();
      const result = await promise;
      return result as T;
    } finally {
      changed();
    }
  }
  useUnsaved(snapshot.busy || snapshot.unknown, {
    pending: snapshot.busy || snapshot.unknown,
  });
  return {
    ...snapshot,
    execute: <T>(path: string, options: MutationOptions = {}, keyed = false) =>
      invoke<T>(() => getMachine().execute(path, options, keyed || nativeKeyed(path, options.method))),
    run: async <T>(
      path: string,
      body?: unknown,
      keyed = false,
      method = "POST",
    ): Promise<T | undefined> => {
      try {
        return (
          (await invoke<T>(() =>
            getMachine().execute(path, { body, method }, keyed || nativeKeyed(path, method)),
          )) ?? (true as T)
        );
      } catch {
        return undefined;
      }
    },
    recover: () => invoke<unknown>(() => getMachine().replay()),
    check: (verify: (intent: MutationIntent) => Promise<boolean>) =>
      invoke<boolean>(() => getMachine().check(verify)),
  };
}
export type RecoverableCommand = ReturnType<typeof useRecoverableCommand>;
export function useLegacyCommand() {
  const call = useApi(),
    source = useContext(OriginalResourceContext);
  const command = useRecoverableCommand(
    (path, options) =>
      call(path, {
        method: options.method,
        body: options.idempotencyKey
          ? {
              ...((options.body as Record<string, unknown>) ?? {}),
              idempotency_key: options.idempotencyKey,
            }
          : options.body,
      }),
    source?.scope ?? "original",
  );
  return {
    ...command,
    write: <T>(path: string, options: MutationOptions = {}) =>
      command.execute<T>(path, options, legacyKeyed(path, options.method)),
    read: <T>(path: string) =>
      source ? source.read<T>(path, AbortSignal.timeout(20000)) : api<T>(path),
  };
}

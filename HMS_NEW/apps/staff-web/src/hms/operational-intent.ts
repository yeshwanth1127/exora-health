import { HmsError, identityRevision, IntentKeys } from "./client";
export type MutationOptions = {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
};
export type MutationIntent = {
  path: string;
  options: MutationOptions;
  keyed: boolean;
  revision: string | number;
};
export type MutationTransport = (
  path: string,
  options: MutationOptions,
) => Promise<unknown>;
/** Memory-only request snapshot. Recovery never creates a new intent or persists form data. */
export class OperationalIntent {
  busy = false;
  unknown = false;
  error = "";
  failure: HmsError | null = null;
  intent: MutationIntent | null = null;
  private keys = new IntentKeys();
  private transport: MutationTransport;
  private revision: () => string | number;
  constructor(
    transport: MutationTransport,
    revision: () => string | number = identityRevision,
  ) {
    this.transport = transport;
    this.revision = revision;
  }
  async execute(
    path: string,
    options: MutationOptions = {},
    keyed = false,
  ): Promise<unknown> {
    if (this.busy || this.unknown)
      throw new Error("Recover the pending change before starting another.");
    const snapshot = structuredClone(options);
    // Older editors generated a fresh key on every click. IntentKeys owns it instead.
    if (snapshot.body && typeof snapshot.body === "object")
      delete (snapshot.body as Record<string, unknown>).idempotency_key;
    snapshot.method ??= "POST";
    if (keyed) snapshot.idempotencyKey = this.keys.for(path, snapshot.body);
    this.intent = { path, options: snapshot, keyed, revision: this.revision() };
    return this.send();
  }
  async replay(): Promise<unknown> {
    if (!this.unknown || !this.intent?.keyed || this.busy)
      throw new Error("This operation cannot be replayed safely.");
    return this.send();
  }
  async check(
    verify: (intent: MutationIntent) => Promise<boolean>,
  ): Promise<boolean> {
    if (!this.unknown || !this.intent || this.busy) return false;
    this.checkContext();
    this.busy = true;
    try {
      if (!(await verify(structuredClone(this.intent)))) {
        this.error =
          "The saved record does not confirm this change. Keep this request open and ask an administrator to reconcile it.";
        return false;
      }
      this.checkContext();
      this.complete();
      return true;
    } finally {
      this.busy = false;
    }
  }
  private checkContext() {
    if (this.intent?.revision !== this.revision())
      throw new HmsError(
        "The workspace changed. This request must be checked in its original workspace.",
        409,
        "outcome_unknown",
      );
  }
  private complete() {
    if (this.intent)
      this.keys.complete(this.intent.path, this.intent.options.body);
    this.unknown = false;
    this.error = "";
    this.failure = null;
    this.intent = null;
  }
  private async send() {
    this.checkContext();
    this.busy = true;
    this.error = "";
    this.failure = null;
    const wasUnknown = this.unknown;
    try {
      const value = await this.transport(
        this.intent!.path,
        structuredClone(this.intent!.options),
      );
      this.checkContext();
      this.complete();
      return value;
    } catch (error) {
      this.failure = error instanceof HmsError ? error : null;
      this.unknown =
        wasUnknown ||
        ["outcome_unknown", "context_changed"].includes(
          this.failure?.code ?? "",
        );
      this.error =
        error instanceof Error
          ? error.message
          : "The change could not be saved.";
      throw error;
    } finally {
      this.busy = false;
    }
  }
}

/** Only these retained adapter routes forward an idempotency key to a keyed /v1 command. */
export function legacyKeyed(path: string, method = "POST") {
  if (method === "PUT" && path === "/api/v1/admin/schedule-timeline/weekly")
    return true;
  return (
    method === "POST" &&
    (path === "/api/v1/staff/users" ||
      path === "/api/v1/staff/roles" ||
      /^\/api\/v1\/staff\/users\/[^/]+\/grants$/.test(path) ||
      path === "/api/v1/admin/schedule-timeline/appointments" ||
      path === "/api/v1/admin/schedule-timeline/open" ||
      path === "/api/v1/admin/schedule-exceptions" ||
      /^\/api\/v1\/admin\/schedule-timeline\/appointments\/[0-9a-f-]{36}\/move$/.test(
        path,
      ) ||
      path === "/api/v1/admin/waitlist" ||
      /^\/api\/v1\/admin\/waitlist\/[^/]+\/offer$/.test(path) ||
      /^\/api\/v1\/admin\/waitlist-offers\/[^/]+\/accept$/.test(path))
  );
}

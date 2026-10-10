export class HmsError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  requestId?: string;
  constructor(
    message: string,
    status = 0,
    code = "outcome_unknown",
    details: Record<string, unknown> = {},
    requestId?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}
let accessToken = "";
let tenantId = "";
let sessionRevision = 0;
export function setIdentity(token: string, tenant = "") {
  accessToken = token;
  tenantId = tenant;
  sessionRevision++;
}
export function setTenant(tenant: string) {
  tenantId = tenant;
  sessionRevision++;
}
export function identityRevision() {
  return sessionRevision;
}
export type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
};
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!/^\/(v1\/|dev\/)/.test(path))
    throw new HmsError(
      "Unsupported API contract.",
      400,
      "unsupported_contract",
    );
  const revision = sessionRevision,
    requestId = crypto.randomUUID();
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        "X-Request-Id": requestId,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new HmsError(
      options.method && options.method !== "GET"
        ? "We could not confirm whether the change was saved. Refresh the record before trying again."
        : "The service could not be reached. Try again.",
      0,
      "outcome_unknown",
      {},
      requestId,
    );
  }
  if (revision !== sessionRevision)
    throw new HmsError(
      "Workspace context changed. Reload this record.",
      409,
      "context_changed",
    );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== "/dev/login")
      window.dispatchEvent(new Event("hms-signout"));
    const issues = data.error?.details?.issues as
      { path: string; message: string }[] | undefined;
    const message = issues?.length
      ? issues
          .map((issue) => `${issue.path || "Field"}: ${issue.message}`)
          .join(". ")
      : (data.error?.message ?? `The request failed (${response.status}).`);
    throw new HmsError(
      message,
      response.status,
      response.status >= 500
        ? "outcome_unknown"
        : (data.error?.code ?? "request_failed"),
      data.error?.details ?? {},
      data.requestId ?? requestId,
    );
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new HmsError(
      "The service response could not be read. Refresh the record to check the outcome.",
      0,
      "outcome_unknown",
      {},
      requestId,
    );
  }
}
export function query(
  values: Record<string, string | number | boolean | undefined>,
) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
/** Reuse the key for an unchanged intent until success, including uncertain outcomes. */
export class IntentKeys {
  private keys = new Map<string, string>();
  for(path: string, body: unknown) {
    const fingerprint = JSON.stringify([path, body]);
    let key = this.keys.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      this.keys.set(fingerprint, key);
    }
    return key;
  }
  complete(path: string, body: unknown) {
    this.keys.delete(JSON.stringify([path, body]));
  }
}

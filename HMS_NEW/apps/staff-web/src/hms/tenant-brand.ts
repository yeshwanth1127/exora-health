export const fallbackTenantName = "Your clinic";

export async function fetchTenantName(
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const response = await fetcher("/public/v1/bootstrap", {
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Tenant branding could not be loaded.");
  const payload = (await response.json()) as {
    tenant?: { name?: unknown };
  };
  const name =
    typeof payload.tenant?.name === "string" ? payload.tenant.name.trim() : "";
  return name || fallbackTenantName;
}

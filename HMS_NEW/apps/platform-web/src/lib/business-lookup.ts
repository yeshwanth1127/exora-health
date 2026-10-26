import type { ReachReport } from "./reach-report";
export type PublicBusiness = {
  id: string; name: string; address: string; category: string;
  mapsUrl: string; website: string; phone: string; hours: string[];
  rating?: number | null; reviewCount?: number | null; businessStatus: string;
  location?: { latitude: number; longitude: number } | null;
  openNow?: boolean | null; accessibility?: Record<string, boolean | null>;
  attributions: { name: string; url: string }[];
};

export async function businessLookup(params: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(`/business-lookup?${new URLSearchParams(params)}`, { signal, cache: "no-store", credentials: "omit" });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Google lookup is not connected on this deployment.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Google lookup is unavailable. Try again later.");
  return data as { report?: ReachReport; predictions?: { id: string; label: string }[]; configured?: boolean; places?: PublicBusiness[]; place?: PublicBusiness };
}

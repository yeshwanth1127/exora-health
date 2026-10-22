export type FacilityPlace = {
  source: "google" | "sample";
  photo?: { src: string; alt: string }; hoursSummary?: string;
  rating?: number; reviewCount?: number; phone?: string; hours?: string[]; category?: string; businessStatus?: string;
  id: string; name: string; address: string; city: string;
  lat: number; lng: number; website: string; mapsUrl: string;
  attributions: { provider: string; uri?: string }[];
};
export type FacilitySuggestion = { id: string; name: string; address: string; session?: string; resolved?: FacilityPlace };

// Explicit demo fixture: does not depend on Google Places credentials or billing.
const avocadoDemo: FacilityPlace = {
  source: "sample", id: "demo-avocado-cafe", name: "Avocado Cafe",
  address: "MG Road, Bengaluru, Karnataka — sample address", city: "Bengaluru",
  lat: 12.9756, lng: 77.6067, website: "",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=12.9756%2C77.6067",

  category: "Demo business · sample details", hoursSummary: "Mon–Sun, 9 AM–9 PM · sample hours",
  attributions: [],
};

function isAvocadoDemo(input: string) {
  return /\bavo(?:c(?:a(?:d(?:o)?)?)?)?\b/i.test(input) || /avocado/i.test(input);
}

export async function createFacilitySession() { return crypto.randomUUID(); }

async function placesRequest(mode: string, query: string, session?: string, signal?: AbortSignal): Promise<never> {
  void mode; void query; void session; void signal;
  throw new Error("Live facility lookup is not connected in this preview. Enter your facility name and city below, or search ‘Avocado’ for a labelled sample.");
}

type GooglePlaceResponse = {
  id: string; displayName?: { text: string }; formattedAddress?: string;
  addressComponents?: { types: string[]; longText: string }[]; location?: { latitude: number; longitude: number };
  websiteUri?: string; googleMapsUri?: string; attributions?: { provider: string; providerUri: string }[];
  rating?: number; userRatingCount?: number; nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] }; primaryTypeDisplayName?: { text: string }; businessStatus?: string;
};
function normalisePlace(place: GooglePlaceResponse): FacilityPlace {
  if (!place.location || !place.displayName) throw new Error("This place has no location details. Try another result or enter your details manually.");
  const locality = place.addressComponents?.find(component => component.types.includes("locality"))
    || place.addressComponents?.find(component => component.types.includes("administrative_area_level_2"));
  return {
    source: "google", id: place.id, name: place.displayName.text, address: place.formattedAddress || "", city: locality?.longText || "",
    lat: place.location.latitude, lng: place.location.longitude, website: place.websiteUri || "",
    mapsUrl: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName.text)}&query_place_id=${encodeURIComponent(place.id)}`,
    rating: place.rating, reviewCount: place.userRatingCount, phone: place.nationalPhoneNumber,
    hours: place.regularOpeningHours?.weekdayDescriptions, category: place.primaryTypeDisplayName?.text, businessStatus: place.businessStatus,
    attributions: (place.attributions || []).map(item => ({ provider: item.provider, uri: item.providerUri || undefined })),
  };
}
export async function suggestFacilities(input: string, session?: string, signal?: AbortSignal): Promise<FacilitySuggestion[]> {
  if (isAvocadoDemo(input)) return [{ id: avocadoDemo.id, name: avocadoDemo.name, address: "Bengaluru · Sample for demo", resolved: avocadoDemo }];
  return placesRequest("autocomplete", input, session, signal);
}
export async function getFacilityDetails(suggestion: FacilitySuggestion, signal?: AbortSignal) {
  if (suggestion.resolved) {
    return suggestion.resolved;
  }
  return normalisePlace(await placesRequest("details", suggestion.id, suggestion.session, signal));
}

export function parseFacilityLink(value: string): { placeId?: string; query?: string; error?: string } {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error();
  } catch { return { error: "Enter a website or Maps address, or search by facility name below." }; }
  if (url.hostname === "maps.app.goo.gl" || (url.hostname === "goo.gl" && url.pathname.startsWith("/maps")))
    return { error: "Paste the full Google Maps address, or search by facility name below." };
  const googleHost = /(^|\.)google\.(com|co\.in|co\.uk|in)$/.test(url.hostname);
  if (googleHost) {
    const placeId = url.searchParams.get("query_place_id") || url.searchParams.get("place_id");
    if (placeId) return { placeId };
    const query = url.searchParams.get("query") || url.searchParams.get("q");
    if (query?.startsWith("place_id:")) return { placeId: query.slice(9) };
    if (query) return { query };
    const match = url.pathname.match(/\/maps\/place\/([^/]+)/);
    if (match) { try { return { query: decodeURIComponent(match[1]).replace(/\+/g, " ") }; } catch { /* Fall back to name search. */ } }
    return { error: "This Maps link has no facility name. Search by name below." };
  }
  return { query: url.hostname.replace(/^www\./, "") };
}
export async function findFacilityFromLink(value: string, signal?: AbortSignal) {
  if (isAvocadoDemo(value)) return [avocadoDemo];
  const parsed = parseFacilityLink(value);
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.placeId) return [normalisePlace(await placesRequest("details", parsed.placeId, undefined, signal))];
  return placesRequest("search", parsed.query!, undefined, signal);
}

import { BRAND_NAME } from "./brand.ts";
import type { FacilityPlace } from "./google-facility-places";

export const quoteSteps = [
  { id: "facility", label: "Your facility", optional: false },
  { id: "volume", label: "Patient enquiries", optional: true },
  { id: "target", label: "Your goal", optional: true },
  { id: "marketing", label: "Your channels", optional: true },
  { id: "business", label: "Facility details", optional: true },
  { id: "website", label: "Your website", optional: true },
  { id: "contact", label: "Contact details", optional: true },
  { id: "offer", label: "Your Growth Suite", optional: false },
] as const;

export const facilityOptions = [
  { id: "practice", title: "Independent practice", detail: "One doctor or a small practice.", icon: "stethoscope", tone: "blue" },
  { id: "clinic", title: "Multi-doctor clinic", detail: "Several doctors, one shared team.", icon: "users", tone: "violet" },
  { id: "hospital", title: "Hospital or group", detail: "Departments, branches and larger teams.", icon: "hospital", tone: "orange" },
] as const;

export const volumeOptions = ["Under 20", "20–50", "51–100", "Over 100", "Not sure"];
export const targetOptions = ["20–50", "51–100", "101–200", "Over 200", "Help me choose"];
export const channelOptions = [
  { id: "Google Search & Maps", icon: "pin" },
  { id: "Referrals", icon: "users" },
  { id: "Social media", icon: "message" },
  { id: "Paid ads", icon: "megaphone" },
  { id: "WhatsApp campaigns", icon: "message" },
  { id: "Walk-ins & offline", icon: "hospital" },
  { id: "None yet", icon: "sparkles" },
] as const;

export const websiteOptions = [
  { id: "specialist", title: "Specialist practice", detail: "A personal introduction to your expertise." },
  { id: "clinic", title: "Multi-specialty clinic", detail: "Help patients find the right care team." },
  { id: "hospital", title: "Hospital & departments", detail: "Make services and locations easy to explore." },
] as const;

export const websiteApproaches = [
  { id: "keep-improve", title: "Use my website as a reference", detail: "Your current site stays unchanged. Choose a starting point for your new patient website." },
  { id: "choose", title: "Let me choose a template", detail: "Explore a new look for your facility." },
] as const;
export function websiteTemplates(_category: string) {
  return [{ id: "standard", name: "Standard clinic website", index: 0 }, { id: "sri-lakshmi", name: "Sri Lakshmi hospital website", index: 1 }, { id: "hospital-editorial", name: "Editorial hospital website", index: 2 }, { id: "swastikaa", name: "Swastikaa template", index: 3 }];
}
export function websiteDirection(draft: WizardDraft) {
  const approach = websiteApproaches.find(option => option.id === draft.websiteApproach)?.title;
  const category = websiteOptions.find(option => option.id === draft.websiteCategory)?.title;
  const template = websiteTemplates(draft.websiteCategory).find(option => option.id === draft.template)?.name;
  return [approach, category, template || ""].filter(Boolean).join(" · ") || "We’ll help you choose";
}

export type WizardDraft = {
  facility: string; volume: string; target: string; channels: string[];
  place: FacilityPlace | null;
  business: string; city: string; website: string; websiteApproach: string; websiteCategory: string; template: string;
  name: string; contactChannel: string; contact: string; consent: boolean;
};
export const initialWizardDraft: WizardDraft = {
  facility: "", volume: "", target: "", channels: [], place: null, business: "", city: "",
  website: "", websiteApproach: "", websiteCategory: "", template: "", name: "", contactChannel: "WhatsApp", contact: "",
  consent: false,
};

export function wizardBrief(draft: WizardDraft, skipped: string[]) {
  return [
    `${BRAND_NAME} Growth Suite · ${draft.business || "Your facility"}`, "",
    `Facility: ${facilityOptions.find(option => option.id === draft.facility)?.title || "Not selected"}`,
    `Location: ${draft.city || "Not provided"}`, `Website / listing: ${draft.website || "Not provided"}`,
    ...(draft.place ? [`Address: ${draft.place.address}`, `Map link: ${draft.place.mapsUrl}`, `${draft.place.source === "sample" ? "Demo sample ID" : "Google place ID"}: ${draft.place.id}`] : []),
    `Daily enquiries: ${draft.volume || "Not provided"}`, `Target daily enquiries: ${draft.target || "Not provided"}`,
    `Marketing channels: ${draft.channels.join(", ") || "Not provided"}`,
    `Website direction: ${websiteDirection(draft)}`,
    `Contact: ${draft.name || "Not provided"}`, `${draft.contactChannel}: ${draft.contact || "Not provided"}`,
    `Contact permission: ${draft.consent ? "Agreed for this request" : "Not given"}`, "",
    "Offer: the entire Growth Suite is free for two months, followed by a personalised offer.",
    "Includes AI reception, website appointments, WhatsApp automation and patient loyalty.",
    `Skipped questions: ${skipped.join(", ") || "None"}`,
    ("This summary is saved locally. It has not been sent to " + BRAND_NAME + " and does not activate a service."),
  ].join("\n");
}

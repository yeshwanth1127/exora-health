import type { WizardDraft } from "./quote-wizard";

export const ONBOARDING_KEY = "capture.onboarding.v1";
export type OnboardingIntake = {
  version: 1; expiresAt: number;
  profile: { name: string; email: string; phone: string; role: string };
  facility: { name: string; city: string; address: string; website: string; placeId: string; source: string; size: string };
  preferences: { channels: string[]; volume: string; target: string; websiteApproach: string; websiteCategory: string; template: string };
};
export function intakeFromQuote(draft: WizardDraft): OnboardingIntake {
  return {
    version: 1, expiresAt: Date.now() + 30 * 60 * 1000,
    profile: { name: draft.name, email: draft.contactChannel === "Email" ? draft.contact : "", phone: draft.contactChannel !== "Email" ? draft.contact : "", role: "" },
    facility: { name: draft.business, city: draft.city, address: draft.place?.address || "", website: draft.place?.website || draft.website, placeId: draft.place?.id || "", source: draft.place?.source || "manual", size: draft.facility },
    preferences: { channels: draft.channels, volume: draft.volume, target: draft.target, websiteApproach: draft.websiteApproach, websiteCategory: draft.websiteCategory, template: draft.template },
  };
}
export function readIntake(): OnboardingIntake | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(ONBOARDING_KEY) || "null");
    if (value?.version !== 1 || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() || value.expiresAt > Date.now() + 31 * 60 * 1000 || !value.profile || !value.facility || !value.preferences) { sessionStorage.removeItem(ONBOARDING_KEY); return null; }
    const validStrings = Object.values(value.profile).every(item => typeof item === "string" && item.length <= 254)
      && Object.values(value.facility).every(item => typeof item === "string" && item.length <= 2000);
    const pref=value.preferences;
    if(!Array.isArray(pref.channels)||!pref.channels.every((v:unknown)=>typeof v==="string"&&v.length<=100)||["volume","target","websiteApproach","websiteCategory","template"].some(key=>typeof pref[key]!=="string"||pref[key].length>200))return null;
    if (!validStrings || ["name", "email", "phone", "role"].some(key => typeof value.profile[key] !== "string") || ["name", "city", "address", "website", "placeId", "source", "size"].some(key => typeof value.facility[key] !== "string")) return null;
    return value;
  } catch { return null; }
}
export function saveIntake(intake: OnboardingIntake) {
  sessionStorage.setItem(ONBOARDING_KEY, JSON.stringify(intake));
}

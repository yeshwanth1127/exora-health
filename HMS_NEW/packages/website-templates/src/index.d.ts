export type WebsiteTemplateId =
  | "standard"
  | "sri-lakshmi"
  | "hospital-editorial"
  | "swastikaa"
  | "hospital-pathway"
  | "hospital-atlas"
  | "hospital-grove";
export type HospitalTemplateId =
  "swastikaa" | "hospital-pathway" | "hospital-atlas" | "hospital-grove";
export type WebsiteTemplate = {
  readonly id: WebsiteTemplateId;
  readonly name: string;
  readonly index: number;
  readonly engine: string;
  readonly reference?: string;
  readonly preview?: string;
};
export const websiteTemplates: readonly WebsiteTemplate[];
export const websiteTemplateIds: readonly WebsiteTemplateId[];
export const hospitalTemplateIds: readonly HospitalTemplateId[];
export function isHospitalTemplate(id: unknown): id is HospitalTemplateId;
export function isWebsiteTemplate(id: unknown): id is WebsiteTemplateId;

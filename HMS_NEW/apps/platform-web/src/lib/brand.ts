/** Change this line to rename the product across the website. */
export const BRAND_NAME = "Paperwhale";
export const BRAND_LOGO = "/assets/paperwhale-brand/medical-cross.png";
export const BRAND_ICON = "/paperwhale-cross-icon-v1.png";

/** Applies the configured name to saved HTML content and plain text assets. */
export function brandText(value: string): string {
  return value
    .replaceAll('/assets/capture-brand/reception-bell.png', BRAND_LOGO)
    .replaceAll('/capture-bell-icon-v3.png', BRAND_ICON)
    .replace(/\b(?:Capture|CAPTURE)\b/g, word => word === "CAPTURE" ? BRAND_NAME.toUpperCase() : BRAND_NAME);
}
export function brandContent<T>(value: T): T {
  if (typeof value === "string") return brandText(value) as T;
  if (Array.isArray(value)) return value.map(brandContent) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,brandContent(item)])) as T;
  return value;
}

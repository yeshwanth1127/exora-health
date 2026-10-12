/** Indian mobiles can omit +91. Other numbers must explicitly include their country code. */
export function bookingPhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

// Pure helpers shared by the editors (clinic, department, service, doctor, patient): only changed
// fields are sent, blank text clears a value, money is typed in rupees and sent in paise.
import type { HmsError } from "./client";

type Plain = string | number | boolean | null | string[] | Record<string, unknown>;

/** Blank text means "no value". */
export const blankToNull = (v: string) => (v.trim() === "" ? null : v.trim());

/**
 * The fields of `form` that differ from `before`, ready for a PATCH. Strings are trimmed and blank
 * strings become null, so clearing a field sends `null` and an untouched one sends nothing.
 */
export function changedFields<T extends Record<string, Plain | undefined>>(
  before: Partial<Record<keyof T, unknown>>,
  form: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(form) as (keyof T)[]) {
    const raw = form[key];
    if (raw === undefined) continue;
    const next = typeof raw === "string" ? blankToNull(raw) : raw;
    const was = before[key] ?? null;
    if (JSON.stringify(was) !== JSON.stringify(next)) out[key] = next as T[keyof T];
  }
  return out;
}

/** "450" or "450.50" rupees → 45050 paise; blank → null; anything else → undefined (invalid). */
export function rupeesToMinor(text: string): number | null | undefined {
  const t = text.trim().replaceAll(",", "");
  if (t === "") return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return undefined;
  const [whole, frac = ""] = t.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export const minorToRupees = (minor: number | null | undefined) =>
  minor === null || minor === undefined
    ? ""
    : minor % 100 === 0
      ? String(minor / 100)
      : (minor / 100).toFixed(2);

/** "MBBS, MD (General Medicine)" → ["MBBS", "MD (General Medicine)"]. */
export const listFromText = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Someone else saved first: the form must be reloaded before saving again. */
export const isStale = (e: HmsError | null | undefined) =>
  !!e && e.status === 409 && e.details?.reason === "stale_version";

/** The reason code of a refused change (409/422), for a specific message. */
export const refusal = (e: HmsError | null | undefined) =>
  e && (e.status === 409 || e.status === 422)
    ? (e.details?.reason as string | undefined)
    : undefined;

/** YYYY-MM-DD `days` after `day`. */
export function addDays(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const E164 = /^\+[1-9][0-9]{7,14}$/;
export const PINCODE = /^[1-9][0-9]{5}$/;
export const CODE = /^[A-Za-z0-9_-]{1,30}$/;

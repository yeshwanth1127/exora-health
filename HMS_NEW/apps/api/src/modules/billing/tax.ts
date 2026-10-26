// GST for a charge line. Rates are data (catalog.tax_rule, configured per deployment by the clinic's CA);
// a line no rule matches is treated as exempt, which is how clinical services by a clinical establishment
// are billed (bill of supply). Supplies are intra-state (place of supply = the facility's state), so tax
// is split CGST + SGST; each half is rounded half-up to the paisa per line.
import { sql, type DB, type Transaction } from '@hms/db';

export interface TaxMatch {
  taxRuleId: string | null;
  gstRateBp: number;
  exempt: boolean;
}

export interface TaxQuery {
  hsnSacCode?: string | null | undefined;
  serviceCategory?: string | null | undefined;
  itemType?: string | null | undefined;
  encounterClass?: string | null | undefined;
  unitPriceMinor: number;
  /** Service date, YYYY-MM-DD. */
  on: string;
}

/** The most specific active rule for a line (lowest priority value wins), or exempt when none applies. */
export async function resolveTax(tx: Transaction<DB>, q: TaxQuery): Promise<TaxMatch> {
  const { rows: [r] } = await sql<{ id: string; gst_rate_bp: number }>`
    SELECT id, gst_rate_bp FROM catalog.tax_rule
    WHERE valid_from <= ${q.on}::date AND (valid_to IS NULL OR valid_to > ${q.on}::date)
      AND (hsn_sac_code IS NULL OR hsn_sac_code = ${q.hsnSacCode ?? null})
      AND (service_category IS NULL OR service_category = ${q.serviceCategory ?? null})
      AND (item_type IS NULL OR item_type = ${q.itemType ?? null})
      AND (encounter_class IS NULL OR encounter_class = ${q.encounterClass ?? null})
      AND (min_unit_price_minor IS NULL OR ${q.unitPriceMinor} >= min_unit_price_minor)
      AND (hsn_sac_code IS NOT NULL OR service_category IS NOT NULL OR item_type IS NOT NULL)
    ORDER BY priority, (hsn_sac_code IS NOT NULL) DESC, tenant_id NULLS LAST
    LIMIT 1`.execute(tx);
  if (!r || r.gst_rate_bp === 0) return { taxRuleId: r?.id ?? null, gstRateBp: 0, exempt: true };
  return { taxRuleId: r.id, gstRateBp: r.gst_rate_bp, exempt: false };
}

/** Half-up rounding of a non-negative amount to whole paise. */
export const roundHalfUp = (value: number) => Math.floor(value + 0.5);

export interface LineAmounts {
  grossMinor: number;
  discountMinor: number;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  netMinor: number;
}

/** Amounts for quantity × unit price, less a discount, taxed at gstRateBp (0 = exempt). */
export function lineAmounts(quantity: number, unitPriceMinor: number, discountMinor: number, gstRateBp: number): LineAmounts {
  const grossMinor = roundHalfUp(quantity * unitPriceMinor);
  const discount = Math.min(discountMinor, grossMinor);
  const taxableMinor = grossMinor - discount;
  const half = roundHalfUp((taxableMinor * gstRateBp) / 2 / 10_000);
  return { grossMinor, discountMinor: discount, taxableMinor, cgstMinor: half, sgstMinor: half, igstMinor: 0, netMinor: taxableMinor + 2 * half };
}

/**
 * Amounts for a tax-inclusive price (medicines sold at or below MRP, which includes GST): the taxable
 * value is worked back out of the price, so the patient pays exactly quantity × price less discount.
 */
export function inclusiveLineAmounts(quantity: number, unitPriceMinor: number, discountMinor: number, gstRateBp: number): LineAmounts {
  const grossIncl = roundHalfUp(quantity * unitPriceMinor);
  const discount = Math.min(discountMinor, grossIncl);
  const ex = (v: number) => roundHalfUp((v * 10_000) / (10_000 + gstRateBp));
  const grossMinor = ex(grossIncl);
  const discountEx = Math.min(ex(discount), grossMinor);
  const taxableMinor = grossMinor - discountEx;
  const netMinor = grossIncl - discount;
  const tax = Math.max(0, netMinor - taxableMinor);
  const cgstMinor = roundHalfUp(tax / 2);
  return { grossMinor, discountMinor: discountEx, taxableMinor, cgstMinor, sgstMinor: tax - cgstMinor, igstMinor: 0, netMinor: taxableMinor + tax };
}

/** Indian financial year of a date (April–March), e.g. 2026-10-22 → '2026-27'. */
export function financialYear(isoDay: string): string {
  const [y, m] = isoDay.split('-').map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** The facility-local calendar date of an instant. */
export const localDay = (at: Date, timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(at);

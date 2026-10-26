/** Counts use exact supplied period totals. A missing/zero baseline is never Infinity or a made-up 100%. */
export function periodDelta(kpi: { kind: 'total'; lowerIsBetter?: boolean }, current: number, previous: number | null) {
  if (previous === null || (previous === 0 && current !== 0)) return {
    available: false, raw: 0, good: false, flat: true, sign: '', amount: 0, unit: '%',
    text: previous === null ? 'Comparison unavailable: incomplete previous period' : 'Comparison unavailable: previous period was zero',
  };
  const raw = previous === 0 ? 0 : (current - previous) / previous * 100;
  const flat = Math.abs(raw) < .05;
  const sign = flat ? '' : raw > 0 ? '+' : '−';
  const amount = Number(Math.abs(flat ? 0 : raw).toFixed(1));
  return { available: true, raw, good: kpi.lowerIsBetter ? raw < 0 : raw > 0, flat, sign, amount, unit: '%', text: `${sign}${amount.toFixed(1)}%` };
}

/** Every stored day is a vertex. Sparse clinic events must not lose peaks to demo resampling. */
export function countFrame(current: (number | null)[], previous: (number | null)[], compare: boolean) {
  const known = (compare ? [...current, ...previous] : current).filter((value): value is number => value !== null);
  const maximum = Math.max(1, ...known);
  const pad = maximum * .12;
  return { a: current, b: previous, min: -pad, max: maximum + pad, pad };
}

/** A missing/zero comparison is not a fabricated percentage increase. */
export function metricChange(
  value: number | null,
  before?: number,
): string | undefined {
  if (
    value === null ||
    before === undefined ||
    !Number.isFinite(value) ||
    !Number.isFinite(before)
  )
    return undefined;
  if (before === 0) return value > 0 ? "New" : undefined;
  const change = Math.round(((value - before) / before) * 100);
  return `${change > 0 ? "+" : ""}${change}%`;
}

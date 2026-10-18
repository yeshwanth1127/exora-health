/** Caption choices change only the displayed month; they never select or rewrite a birth date. */
export function calendarMonths(locale = "en-US") {
  return Array.from({ length: 12 }, (_, index) => ({ value: String(index), label: new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, index, 1)) }));
}
export function calendarYears(month: Date, today?: Date, min?: Date, max?: Date) {
  const current = today?.getFullYear() ?? month.getFullYear();
  const earliest = min?.getFullYear() ?? Math.min(current - 130, month.getFullYear());
  const latest = max?.getFullYear() ?? Math.max(current, month.getFullYear());
  return Array.from({ length: Math.max(0, latest - earliest + 1) }, (_, index) => {
    const year = latest - index;
    return { value: String(year), label: String(year) };
  });
}
export function changeCalendarMonth(current: Date, year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1 || year > 9999 || month < 0 || month > 11) return current;
  const next = new Date(current);
  next.setFullYear(year, month, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

export type BirthDateParts = { day: string; month: string; year: string };
export function birthDateParts(value: string): BirthDateParts {
  const [year = "", month = "", day = ""] = value.split("-");
  return { day, month, year };
}
/** Calendar-only validation. Do not round an impossible date into the following month. */
export function parseBirthDate(
  parts: BirthDateParts,
  max: string,
): { value: string; error: string } {
  const { day, month, year } = parts;
  if (!day && !month && !year) return { value: "", error: "" };
  if (
    !/^\d{1,2}$/.test(day) ||
    !/^\d{1,2}$/.test(month) ||
    !/^\d{4}$/.test(year)
  )
    return { value: "", error: "Enter the day, month and four-digit year." };
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1]!)
    return { value: "", error: "Enter a valid date of birth." };
  const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return value > max
    ? { value: "", error: "Date of birth cannot be in the future." }
    : { value, error: "" };
}

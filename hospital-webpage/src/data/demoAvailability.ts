import { addDays, format, isBefore, isValid, parseISO, startOfDay } from 'date-fns';

// Sample dates move with the calendar so the sample walkthrough never opens on an expired week.
export function demoStartDate(): Date {
  return startOfDay(addDays(new Date(), 1));
}

export function demoDateStrings(count = 15): string[] {
  const start = demoStartDate();
  return Array.from({ length: count }, (_, index) => format(addDays(start, index), 'yyyy-MM-dd'));
}

export function initialDemoDate(value?: string): Date {
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : null;
  const start = demoStartDate();
  return parsed && isValid(parsed) && !isBefore(parsed, start) ? parsed : start;
}

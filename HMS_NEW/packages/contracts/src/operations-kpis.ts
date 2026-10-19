import { z } from 'zod';

export const OperationsKpiIdSchema = z.enum(['bookings', 'visits', 'checkIns', 'completed', 'cancelled', 'noShows']);
export type OperationsKpiId = z.infer<typeof OperationsKpiIdSchema>;
export const REPORT_RANGES = ['7', '30', '90'] as const;
export type ReportRange = typeof REPORT_RANGES[number];
const count = z.number().int().nonnegative().safe();
const row = z.object({ id: z.string(), name: z.string(), value: count, previous: count.nullable() });
const period = z.object({
  current: count,
  previous: count.nullable(),
  complete: z.boolean(),
  breakdowns: z.object({ doctor: z.array(row), channel: z.array(row) }),
});
export const OperationsKpiReportSchema = z.object({
  facilityId: z.uuid(),
  end: z.iso.date(),
  timezone: z.string(),
  asOf: z.iso.datetime({ offset: true }),
  availableFrom: z.iso.date(),
  metrics: z.array(z.object({
    id: OperationsKpiIdSchema,
    label: z.string(),
    description: z.string(),
    lowerIsBetter: z.boolean(),
    // Null dates precede this clinic's recorded history. They must not become zeroes in charts.
    series: z.array(count.nullable()).length(180),
    periods: z.object({ '7': period, '30': period, '90': period }),
  })).length(6).refine((items) => new Set(items.map((m) => m.id)).size === 6, 'Duplicate KPI'),
});
export type OperationsKpiReport = z.infer<typeof OperationsKpiReportSchema>;

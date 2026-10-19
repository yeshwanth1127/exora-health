import { OperationsKpiReportSchema, type OperationsKpiReport } from '@hms/contracts';
import { HmsError } from './client';
import type { Kpi } from '../components/arc/kpi-drilldown/kpi-drilldown';

export function decodeOverviewKpis(value: unknown, expected: { facilityId: string; end: string; timezone: string }): OperationsKpiReport {
  const result = OperationsKpiReportSchema.safeParse(value);
  if (!result.success || result.data.facilityId !== expected.facilityId || result.data.end !== expected.end || result.data.timezone !== expected.timezone) {
    throw new HmsError('The activity report did not match this clinic and reporting date. Reload to try again.', 0, 'invalid_response');
  }
  return result.data;
}
export function overviewKpis(report: OperationsKpiReport): Kpi[] {
  return report.metrics.map((metric) => ({ ...metric, kind: 'total', format: { decimals: 0 } }));
}
export function reportStart(end: string, days: number): string {
  const d = new Date(`${end}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days + 1);
  return d.toISOString().slice(0, 10);
}

/** Date-only labels never pass through the user's local timezone. */
export function reportDateLabel(day: string): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day}T12:00:00Z`));
}

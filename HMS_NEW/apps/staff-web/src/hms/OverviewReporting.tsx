import { useMemo, useState } from 'react';
import type { OperationsKpiReport, ReportRange } from '@hms/contracts';
import { KpiDrilldown } from '@/components/arc/kpi-drilldown/kpi-drilldown';
import { overviewKpis, reportStart } from './overview-kpis';

const dimensions = [{ value: 'doctor', label: 'Doctor' }, { value: 'channel', label: 'Channel' }] as const;
export function OverviewReporting({ report }: { report: OperationsKpiReport }) {
  const [range, setRange] = useState<ReportRange>('30');
  const kpis = useMemo(() => overviewKpis(report), [report]);
  const start = reportStart(report.end, Number(range));
  const previousStart = reportStart(report.end, Number(range) * 2);
  return (
    <section aria-label="Clinic activity report" className="space-y-3 mb-6">
      <div className="text-sm text-muted-foreground space-y-1">
        <p>{start} – {report.end} · {report.timezone} · Today is partial.</p>
        <p>Open a card for daily counts, its date definition and a doctor or channel breakdown.</p>
        {start < report.availableFrom && <p role="status">Recorded history starts {report.availableFrom}. This period is incomplete; earlier dates are gaps.</p>}
        {previousStart < report.availableFrom && <p role="status">Previous-period comparison is unavailable where history is incomplete.</p>}
        <p className="text-xs">Updated {new Intl.DateTimeFormat('en-IN', { timeZone: report.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.asOf))}. A dash means comparison unavailable, including a zero baseline.</p>
      </div>
      <div className="arc-demo-scope">
        <KpiDrilldown title="Recorded clinic activity" kpis={kpis} dimensions={[...dimensions]} end={report.end} range={range} onRangeChange={setRange} />
      </div>
    </section>
  );
}

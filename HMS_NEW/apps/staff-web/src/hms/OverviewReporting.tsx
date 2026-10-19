import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import type { OperationsKpiReport, ReportRange } from '@hms/contracts';
import { KpiDrilldown } from '@/components/arc/kpi-drilldown/kpi-drilldown';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import { overviewKpis, reportStart, reportDateLabel } from './overview-kpis';

const dimensions = [{ value: 'doctor', label: 'Doctor' }, { value: 'channel', label: 'Channel' }] as const;
export function OverviewReporting({ report }: { report: OperationsKpiReport }) {
  const [range, setRange] = useState<ReportRange>('7');
  const kpis = useMemo(() => overviewKpis(report), [report]);
  const start = reportStart(report.end, Number(range));
  const previousStart = reportStart(report.end, Number(range) * 2);
  const incomplete = start < report.availableFrom;
  const comparisonUnavailable = previousStart < report.availableFrom;
  const updated = new Intl.DateTimeFormat('en-IN', { timeZone: report.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.asOf));
  return (
    <section aria-label="Clinic activity report" className="arc-demo-scope space-y-3 mb-6">
      <KpiDrilldown
        embedded title="Clinic activity"
        caption={`${reportDateLabel(start)} – ${reportDateLabel(report.end)} · ${report.timezone} · Today is partial`}
        kpis={kpis} dimensions={[...dimensions]} end={report.end} range={range} onRangeChange={setRange}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <p role="status">
          {incomplete ? `History since ${reportDateLabel(report.availableFrom)} · this period is incomplete` : `Compared with the previous ${range} days`}
          {comparisonUnavailable && ' · previous period unavailable'}
        </p>
        <Tooltip content={<div className="max-w-xs whitespace-normal space-y-2">
          <p>Updated {updated}.</p>
          <p>Open a card for its date definition and daily counts. Earlier dates before recorded history are gaps. Known dates with no events are zero.</p>
          <p>A dash means comparison unavailable: incomplete history or a zero previous baseline.</p>
        </div>}>
          <button type="button" aria-label="About this activity report" className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"><Info size={15} aria-hidden="true" /></button>
        </Tooltip>
      </div>
    </section>
  );
}

import type { ReactElement } from 'react';
import type { OperationsKpiReport, ReportRange } from '@hms/contracts';
export type Kpi = OperationsKpiReport['metrics'][number] & {
  kind: 'total';
  format: { prefix?: string; suffix?: string; divisor?: number; decimals?: number };
};
export interface KpiDrilldownProps {
  kpis: Kpi[];
  dimensions: { value: 'doctor' | 'channel'; label: string }[];
  end: string;
  defaultRange?: ReportRange;
  range?: ReportRange;
  onRangeChange?: (range: ReportRange) => void;
  selected?: string | null;
  onSelectedChange?: (id: string | null) => void;
  title?: string;
  /** Dashboard placement explicitly requested after rendered review. Default demo geometry stays intact. */
  embedded?: boolean;
  caption?: string;
  className?: string;
}
export function KpiDrilldown(props: KpiDrilldownProps): ReactElement;
export default KpiDrilldown;

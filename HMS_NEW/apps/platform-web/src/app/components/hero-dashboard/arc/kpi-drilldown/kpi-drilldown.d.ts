import type { ReactElement } from 'react';
type ReportRange = '7' | '30' | '90';
type Metric = { id: string; label: string; description: string; lowerIsBetter: boolean; series: (number | null)[]; periods: Record<string, { current: number; previous: number | null; complete: boolean; breakdowns: Record<string, {id:string;name:string;value:number;previous:number|null}[]> }> };
export type Kpi = Metric & {
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

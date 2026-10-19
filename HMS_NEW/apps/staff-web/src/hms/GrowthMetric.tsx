import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { metricChange } from "./growth-metrics";

/** Presentation only: callers retain the original data source and calculation. */
export function GrowthMetric({
  label,
  value,
  before,
  suffix,
  decimals,
  context,
}: {
  label: string;
  value: number | null;
  before?: number;
  suffix?: string;
  decimals?: number;
  context: string;
}) {
  return (
    <div className="arc-demo-scope min-w-0">
      <MetricCard
        label={label}
        value={value}
        suffix={suffix}
        decimals={decimals}
        context={context}
        change={metricChange(value, before)}
      />
    </div>
  );
}

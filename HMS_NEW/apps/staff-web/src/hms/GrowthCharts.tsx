import {
  BarChart,
  type BarChartDatum,
} from "@/components/arc/bar-chart/bar-chart";
import {
  SplitBar,
  type SplitSegment,
} from "@/components/arc/split-bar/split-bar";
import { ChartDataDisclosure } from "@/components/ChartDataDisclosure";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkspaceEmpty } from "./WorkspaceEmpty";

function Values({
  rows,
  category,
  measure,
}: {
  rows: { id: string; label: string; value: number }[];
  category: string;
  measure: string;
}) {
  return (
    <ChartDataDisclosure>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{category}</TableHead>
            <TableHead>{measure}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.label}</TableCell>
              <TableCell>{row.value.toLocaleString("en-IN")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartDataDisclosure>
  );
}

export function GrowthBar({
  data,
  label,
  period,
  category = "Category",
  averageLabel = "Average per category",
  showAverage = false,
}: {
  data: BarChartDatum[];
  label: string;
  period: string;
  category?: string;
  averageLabel?: string;
  showAverage?: boolean;
}) {
  if (!data.length)
    return <WorkspaceEmpty title={`No ${label.toLowerCase()} available`} />;
  return (
    <div className="space-y-4 min-w-0">
      <div className="arc-demo-scope">
        <BarChart
          data={data}
          label={label}
          period={period}
          categoryLabel={category}
          averageLabel={averageLabel}
          showAverage={showAverage}
        />
      </div>
      <Values
        rows={data.map((d) => ({ id: d.key, label: d.label, value: d.value }))}
        category={category}
        measure={label}
      />
    </div>
  );
}

/** Only mutually exclusive categories belong here; conversion steps overlap. */
export function GrowthSplit({
  segments,
  label,
}: {
  segments: SplitSegment[];
  label: string;
}) {
  return (
    <div className="space-y-4 min-w-0">
      {segments.some((s) => s.value > 0) ? (
        <div className="arc-demo-scope">
          <SplitBar
            segments={segments}
            label={label}
            totalLabel="Total"
            locale="en-IN"
          />
        </div>
      ) : (
        <WorkspaceEmpty title={`No ${label.toLowerCase()} available`} />
      )}
      <Values rows={segments} category="Category" measure="Count" />
    </div>
  );
}

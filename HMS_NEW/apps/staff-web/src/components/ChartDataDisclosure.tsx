import type { ReactNode } from "react";
import { ChevronDown, Table2 } from "lucide-react";
/** Keep the accessible exact-value table without the browser's native disclosure triangle. */
export function ChartDataDisclosure({ children, label = "View data table" }: { children: ReactNode; label?: string }) {
  return <details className="chart-data-disclosure">
    <summary><Table2 size={16} aria-hidden="true" /><span>{label}</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="mt-3">{children}</div>
  </details>;
}

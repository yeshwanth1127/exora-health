import type { ListRowStyles } from "../_styles";
import { cn } from "../lib/utils";
export type ListRowData = {
  href: string;
  label: string;
};
/** A list row. */
export default function ListRow({ d, styles }: { d: ListRowData; styles: ListRowStyles }) {
  return (
    <li className={cn("flow-2 type-9", styles.className)}>
      <a className={cn("row-9", styles.className2)} data-component="link" href={d.href}>
        <span className={cn("flow-2", styles.className3)}>
          {d.label}
        </span>
      </a>
    </li>
  );
}

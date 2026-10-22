import type { DittoNodeMetaMap } from "../ditto-meta";
import type { ListRowStyles } from "../_styles";
import { cn } from "../../lib/utils";
export type ListRowData = {
  href: string;
  label: string;
};
/** A list row. */
export default function ListRow({ d, meta, styles }: { d: ListRowData; meta: DittoNodeMetaMap; styles: ListRowStyles }) {
  return (
    <li data-ditto-id={meta[0]?.anchor} className={cn("list-item -mx-2 [list-style-type:none]", styles.className)}>
      <a data-ditto-id={meta[1]?.anchor} className="grid py-[0.1875rem] pr-4 pl-2 rounded-lg items-center gap-x-2 [grid-template-areas:'label'] text-foreground cursor-pointer grid-cols-1" data-component="link" href={d.href}>
        <span data-ditto-id={meta[2]?.anchor} className={cn("block self-center [grid-column-start:label] [grid-column-end:label] [grid-row-start:label] [grid-row-end:label] text-color-001 text-sm font-medium leading-5 underline", styles.className2)}>
          {d.label}
        </span>
      </a>
    </li>
  );
}

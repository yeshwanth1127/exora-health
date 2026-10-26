import type { DittoNodeMetaMap } from "../ditto-meta";
import type { ListRow2Styles } from "../_styles";
import { cn } from "../../lib/utils";
export type ListRow2Data = {
  href: string;
  label: string;
};
/** A list row. */
export default function ListRow2({ d, meta, styles }: { d: ListRow2Data; meta: DittoNodeMetaMap; styles: ListRow2Styles }) {
  return (
    <li data-ditto-id={meta[0]?.anchor} className={cn("list-item -mx-2 [list-style-type:none]", styles.className)}>
      <a data-ditto-id={meta[1]?.anchor} className="grid py-[0.1875rem] pr-4 pl-2 rounded-lg items-center gap-x-2 [grid-template-areas:'label'] text-foreground cursor-pointer grid-cols-1 focus:outline-foreground focus:[outline-style:none] focus:outline-0" data-component="link" href={d.href}>
        <span data-ditto-id={meta[2]?.anchor} className={cn("block self-center [grid-column-start:label] [grid-column-end:label] [grid-row-start:label] [grid-row-end:label] text-color-001 text-sm font-medium leading-5 underline hover:[text-decoration-color:var(--clr-0)] focus:outline-0 focus:[text-decoration-color:var(--clr-0)]", styles.className2)}>
          {d.label}
        </span>
      </a>
    </li>
  );
}

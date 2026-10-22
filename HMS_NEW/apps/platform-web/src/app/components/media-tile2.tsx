import type { DittoNodeMetaMap } from "../ditto-meta";
import type { ReactNode } from "react";
import type { MediaTile2Styles } from "../_styles";
import { cn } from "../../lib/utils";
export type MediaTile2Data = {
  icon: ReactNode;
  description: string;
  kind?: string;
  ariahidden?: import("react").AriaAttributes["aria-hidden"];
};
/** A media tile. */
export default function MediaTile2({ d, meta, styles }: { d: MediaTile2Data; meta: DittoNodeMetaMap; styles: MediaTile2Styles }) {
  return (
    <p data-ditto-id={meta[0]?.anchor} className="flex items-center gap-2 text-color-008 text-sm font-medium leading-5 whitespace-nowrap text-nowrap [font-feature-settings:normal]" aria-hidden={d.ariahidden}>
      <span data-ditto-id={meta[1]?.anchor} className="grid min-w-[fit-content] rounded-sm items-center shrink-0 justify-items-center aspect-square text-muted-foreground text-[1.5rem] grid-cols-[minmax(0,_1fr)]" aria-hidden="true">
        <svg data-ditto-id={meta[2]?.anchor} className={cn("h-6 block overflow-hidden align-middle", styles.className)} viewBox="0 0 20 20" width="1em" xmlns="http://www.w3.org/2000/svg" fill="currentColor" data-component={d.kind}>{d.icon}</svg>
      </span>
      {d.description}
    </p>
  );
}

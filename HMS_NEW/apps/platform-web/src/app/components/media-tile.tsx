import type { DittoNodeMetaMap } from "../ditto-meta";
import type { ReactNode } from "react";
export type MediaTileData = {
  icon: ReactNode;
  description: string;
};
/** A media tile. */
export default function MediaTile({ d, meta }: { d: MediaTileData; meta: DittoNodeMetaMap }) {
  return (
    <p data-ditto-id={meta[0]?.anchor} className="flex items-center gap-2 text-color-008 text-sm font-medium leading-5 whitespace-nowrap text-nowrap [font-feature-settings:normal]">
      <span data-ditto-id={meta[1]?.anchor} className="grid min-w-[fit-content] rounded-sm items-center shrink-0 justify-items-center aspect-square text-muted-foreground text-[1.5rem] grid-cols-[minmax(0,_1fr)]" aria-hidden="true">
        <svg data-ditto-id={meta[2]?.anchor} className="w-auto h-6 block overflow-hidden align-middle" data-component="icon" viewBox="0 0 20 20" width="1em" xmlns="http://www.w3.org/2000/svg" fill="currentColor">{d.icon}</svg>
      </span>
      {d.description}
    </p>
  );
}

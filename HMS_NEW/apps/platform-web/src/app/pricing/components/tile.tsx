import type { DittoNodeMetaMap } from "../ditto-meta";
import type { ReactNode } from "react";
export type TileData = {
  icon: ReactNode;
};
/** A content tile. */
export default function Tile({ d, meta }: { d: TileData; meta: DittoNodeMetaMap }) {
  return (
    <svg data-ditto-id={meta[0]?.anchor} className="w-auto h-4 block shrink-0 overflow-hidden" data-component="icon" aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" fill="currentColor">{d.icon}</svg>
  );
}

import type { DittoNodeMetaMap } from "../ditto-meta";
export type TileData = {
  imgSrc: string;
  srcSet: string;
};
/** A content tile. */
export default function Tile({ d, meta }: { d: TileData; meta: DittoNodeMetaMap }) {
  return (
    <img loading="lazy" decoding="async" data-ditto-id={meta[0]?.anchor} className="h-18 block isolate min-w-0 -mx-1 overflow-clip aspect-[auto_225/225] text-color-006 max-lg:w-12 max-lg:h-12" alt="" height="225" src={d.imgSrc} srcSet={d.srcSet} width="225" />
  );
}

import SiteImage from "../../components/site-image";
import type { DittoNodeMetaMap } from "../ditto-meta";
import type { TileStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type TileData = {
  alt: string;
  height: string;
  imgSrc: string;
  srcSet?: string;
  width: string;
};
/** A content tile. */
export default function Tile({ d, meta, styles }: { d: TileData; meta: DittoNodeMetaMap; styles: TileStyles }) {
  return (
    <SiteImage data-ditto-id={meta[0]?.anchor} className={cn("block overflow-clip text-color-006 max-md:w-24.5", styles.className)} data-component="image" alt={d.alt} height={d.height} src={d.imgSrc} srcSet={d.srcSet} width={d.width} />
  );
}

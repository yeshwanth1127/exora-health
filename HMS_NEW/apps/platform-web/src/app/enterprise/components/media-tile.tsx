import SiteImage from "../../components/site-image";
import type { DittoNodeMetaMap } from "../ditto-meta";
import type { MediaTileStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type MediaTileData = {
  alt: string;
  height: string;
  imgSrc: string;
  width: string;
  description: string;
  description2: string;
  description3: string;
  srcSet?: string;
};
/** A media tile. */
export default function MediaTile({ d, meta, styles }: { d: MediaTileData; meta: DittoNodeMetaMap; styles: MediaTileStyles }) {
  return (
    <article data-ditto-id={meta[0]?.anchor} className="flex rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full">
      <figure data-ditto-id={meta[1]?.anchor} className="flex py-6 px-8 flex-col flex-1 gap-6">
        <SiteImage data-ditto-id={meta[2]?.anchor} className={cn("h-7 block max-w-full overflow-clip text-color-006", styles.className)} data-component="image" alt={d.alt} height={d.height} src={d.imgSrc} width={d.width} srcSet={d.srcSet} />
        <blockquote className="flex items-center grow [font-family:'Lyon_Text',_Georgia,_YuMincho,_'Yu_Mincho',_'Hiragino_Mincho_ProN',_'Hiragino_Mincho_Pro',_'Songti_TC',_'Songti_SC',_SimSun,_'Nanum_Myeongjo',_NanumMyeongjo,_Batang,_serif] text-lg leading-7 indent-[-9px]">
          <p className={cn("w-full max-w-135 block text-foreground", styles.className2)}>
            {d.description}
          </p>
        </blockquote>
        <figcaption className="block">
          <p className="block text-xs font-semibold leading-4 tracking-[0.13px]">
            {d.description2}
          </p>
          <p className="block text-xs leading-4 tracking-[0.13px]">
            {d.description3}
          </p>
        </figcaption>
      </figure>
    </article>
  );
}

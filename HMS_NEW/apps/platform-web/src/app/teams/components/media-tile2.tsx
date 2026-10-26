import SiteImage from "../../components/site-image";
import type { DittoNodeMetaMap } from "../ditto-meta";
export type MediaTile2Data = {
  imgSrc: string;
  description: string;
  description2: string;
  href: string;
};
/** A media tile. */
export default function MediaTile2({ d, meta }: { d: MediaTile2Data; meta: DittoNodeMetaMap }) {
  return (
    <article data-ditto-id={meta[0]?.anchor} className="flex flex-col grow basis-[calc(33.3333%_-_16px)] gap-1 max-lg:basis-full">
      <div data-ditto-id={meta[1]?.anchor} className="block text-accent text-[1.75rem]">
        <div data-ditto-id={meta[2]?.anchor} className="block max-w-20 aspect-square">
          <SiteImage className="w-full h-20 block overflow-clip object-contain aspect-[auto_80/80]" data-component="image" alt="" height="80" src={d.imgSrc} width="80" />
        </div>
      </div>
      <p className="block text-foreground text-[1.375rem] font-bold leading-7 tracking-[-0.25px] [font-feature-settings:'lnum',_'locl'_0]">
        {d.description}
      </p>
      <p className="block [font-feature-settings:'lnum',_'locl'_0]">
        {d.description2}
      </p>
      <a className="h-6 flex items-center gap-1 text-primary cursor-pointer" data-component="link" href={d.href}>
        <span className="flex items-center gap-2">
          Learn more
        </span>
        <span className="block" aria-hidden="true">
          →
        </span>
      </a>
    </article>
  );
}

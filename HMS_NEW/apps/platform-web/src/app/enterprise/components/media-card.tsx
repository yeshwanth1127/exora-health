import SiteImage from "../../components/site-image";
import type { MediaCardStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type MediaCardData = {
  title: string;
  href: string;
  label: string;
  height: string;
  imgSrc: string;
  srcSet: string;
  width: string;
};
/** A card with media + heading. */
export default function MediaCard({ d, styles }: { d: MediaCardData; styles: MediaCardStyles }) {
  return (
    <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full">
      <div className="h-full flex rounded-xl flex-col overflow-clip">
        <div className="flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
          <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
            {d.title}
          </h3>
          <a className="h-6 flex items-center gap-1 text-primary cursor-pointer" data-component="link" href={d.href}>
            <span className="flex items-center gap-2">
              {d.label}
            </span>
            <span className="block" aria-hidden="true">
              →
            </span>
          </a>
        </div>
        <div className="block mb-7 mx-8 rounded-xl overflow-clip shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px]">
          <SiteImage className={cn("w-[16.0625rem] h-[10.0625rem] block max-w-full overflow-clip text-color-006 max-md:w-[17.1875rem] max-md:h-43 md:max-lg:w-142 md:max-lg:h-[22.1875rem]", styles.className)} data-component="image" alt="Acme Inc company wiki" height={d.height} src={d.imgSrc} srcSet={d.srcSet} width={d.width} />
        </div>
      </div>
    </article>
  );
}

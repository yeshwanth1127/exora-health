import type { MediaCardStyles } from "../_styles";
import { cn } from "../../lib/utils";
export type MediaCardData = {
  ariaLabel: string;
  href: string;
  imgSrc: string;
  srcSet: string;
  title: string;
};
/** A card with media + heading. */
export default function MediaCard({ d, styles }: { d: MediaCardData; styles: MediaCardStyles }) {
  return (
    <div className="w-full border border-solid border-color-003 flex relative p-6 rounded-xl flex-wrap justify-start items-start content-between gap-4 bg-background max-md:p-4 max-lg:items-center max-lg:[flex-wrap:initial] after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
      <a className="w-[210.5px] h-full block absolute top-0 left-0 min-w-0 text-foreground cursor-pointer max-md:w-[21.3125rem] md:max-lg:w-[40.675rem] 2xl:w-60.5" data-component="link" aria-label={d.ariaLabel} href={d.href}>
        {" "}
      </a>
      <div className="block relative pointer-events-none">
        <span className={cn("inline-grid min-w-[fit-content] rounded-full items-center justify-items-center text-accent text-[2.5rem] leading-15 pointer-events-none grid-cols-[minmax(0,_1fr)] grid-rows-1 aspect-square max-lg:text-[1.75rem] max-lg:leading-10.5", styles.className)}>
          <img loading="lazy" decoding="async" className="w-10 h-10 block overflow-clip aspect-[auto_48/48] text-color-006 pointer-events-none max-lg:w-7 max-lg:h-7" data-component="image" alt="" height="48" src={d.imgSrc} srcSet={d.srcSet} width="48" />
        </span>
      </div>
      <h3 className="block text-color-002 font-bold text-balance" data-component="heading">
        {d.title}
        <span className="inline-block ml-1" aria-hidden="true">
          →
        </span>
      </h3>
    </div>
  );
}

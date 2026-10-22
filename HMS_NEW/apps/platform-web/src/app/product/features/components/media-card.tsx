import MarketingAsset from "../../../components/marketing-asset";
import ProductArtwork from "../../../ProductArtwork";
import type { MediaCardStyles } from "../_styles";
import { cn } from "../../../../lib/utils";
export type MediaCardData = {
  arialabelledby: string;
  id: string;
  id2: string;
  title: string;
  description: string;
  alt: string;
  imgSrc: string;
  width: string;
  alt2: string;
  imgSrc2: string;
  srcSet: string;
  href: string;
  title2: string;
  description2: string;
  href2: string;
  title3: string;
  description3: string;
  href3: string;
  title4: string;
  description4: string;
  href4: string;
  title5: string;
  description5: string;
  href5: string;
  title6: string;
  description6: string;
  href6: string;
  title7: string;
  description7: string;
  href7: string;
  title8: string;
  description8: string;
  href8: string;
  title9: string;
  description9: string;
  href9: string;
  title10: string;
  description10: string;
};
/** A card with media + heading. */
export default function MediaCard({ d, styles }: { d: MediaCardData; styles: MediaCardStyles }) {
  return (
    <section className="block relative pb-20 bg-background max-lg:pb-10" aria-labelledby={d.arialabelledby} id={d.id}>
      <div className="flex mb-8 justify-between items-end gap-6 max-lg:mb-6 max-lg:flex-col-reverse max-lg:items-start">
        <div className="flex min-w-0 flex-col">
          <h2 className="block max-w-[693.7px] text-foreground text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance [font-feature-settings:'lnum',_'locl'_0] max-lg:max-w-[528.5px] max-lg:text-[2rem] max-lg:leading-10 max-lg:tracking-[-0.75px]" data-component="heading" id={d.id2}>
            <span className="inline">
              {d.title}
            </span>
          </h2>
          <p className="block max-w-140 mt-4 [font-feature-settings:'lnum',_'locl'_0]">
            {d.description}
          </p>
        </div>
        <div className="block max-w-[40%] shrink-0 max-lg:max-w-full max-lg:shrink-[initial]">
          <ProductArtwork name={d.id === "capture" ? "ai-reception" : d.id === "find" ? "whatsapp-outreach" : "google-business"} label={d.title} />
        </div>
      </div>
      <MarketingAsset name={d.id === "capture" ? "1a" : d.id === "find" ? "1b" : "1c"} />
      <div className="flex my-6 flex-wrap gap-6" role="group">
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href}>
                  {d.title2}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className={cn("block absolute top-0 inset-x-0 md:max-lg:h-28", styles.className2)} />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description2}
              </p>
            </div>
          </div>
        </article>
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href2}>
                  {d.title3}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className={cn("block absolute top-0 inset-x-0 md:max-lg:h-28", styles.className3)} />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description3}
              </p>
            </div>
          </div>
        </article>
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href3}>
                  {d.title4}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className={cn("block absolute top-0 inset-x-0 md:max-lg:h-28", styles.className4)} />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description4}
              </p>
            </div>
          </div>
        </article>
      </div>
      <div className="flex my-6 flex-wrap gap-6" role="group">
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href4}>
                  {d.title5}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className="h-34 block absolute top-0 inset-x-0 md:max-lg:h-28" />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description5}
              </p>
            </div>
          </div>
        </article>
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href5}>
                  {d.title6}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className="h-34 block absolute top-0 inset-x-0 md:max-lg:h-28" />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description6}
              </p>
            </div>
          </div>
        </article>
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href6}>
                  {d.title7}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className="h-34 block absolute top-0 inset-x-0 md:max-lg:h-28" />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description7}
              </p>
            </div>
          </div>
        </article>
      </div>
      <div className="flex mt-6 flex-wrap gap-6" role="group">
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href7}>
                  {d.title8}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className="h-34 block absolute top-0 inset-x-0 md:max-lg:h-28" />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description8}
              </p>
            </div>
          </div>
        </article>
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href8}>
                  {d.title9}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className="h-34 block absolute top-0 inset-x-0 md:max-lg:h-28" />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description9}
              </p>
            </div>
          </div>
        </article>
        <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
          <div className="h-full flex rounded-xl flex-col overflow-clip">
            <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
              <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
                <a className="inline cursor-pointer" data-component="link" href={d.href9}>
                  {d.title10}
                  <span className="inline-block ml-1" aria-hidden="true">
                    →
                  </span>
                  <span className="h-34 block absolute top-0 inset-x-0 md:max-lg:h-28" />
                </a>
              </h3>
              <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
                {d.description10}
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

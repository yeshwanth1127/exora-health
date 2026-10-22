import type { FeatureCardStyles } from "../_styles";
import { cn } from "../../../../lib/utils";
export type FeatureCardData = {
  href: string;
  title: string;
  description: string;
  href2: string;
  title2: string;
  description2: string;
  href3: string;
  title3: string;
  description3: string;
};
/** A feature card. */
export default function FeatureCard({ d, styles }: { d: FeatureCardData; styles: FeatureCardStyles }) {
  return (
    <div className={cn("flex flex-wrap gap-6", styles.className)} role="group">
      <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
        <div className="h-full flex rounded-xl flex-col overflow-clip">
          <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
            <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
              <a className="inline cursor-pointer" data-component="link" href={d.href}>
                {d.title}
                <span className="inline-block ml-1" aria-hidden="true">
                  →
                </span>
                <span className={cn("block absolute top-0 inset-x-0 md:max-lg:h-28", styles.className2)} />
              </a>
            </h3>
            <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
              {d.description}
            </p>
          </div>
        </div>
      </article>
      <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--color-006)_0px_0.175px_1.041px_0px,var(--color-006)_0px_0.8px_2.925px_0px,var(--color-006)_0px_2.025px_7.847px_0px,var(--color-006)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
        <div className="h-full flex rounded-xl flex-col overflow-clip">
          <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
            <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
              <a className="inline cursor-pointer" data-component="link" href={d.href2}>
                {d.title2}
                <span className="inline-block ml-1" aria-hidden="true">
                  →
                </span>
                <span className={cn("block absolute top-0 inset-x-0 md:max-lg:h-28", styles.className3)} />
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
              <a className="inline cursor-pointer" data-component="link" href={d.href3}>
                {d.title3}
                <span className="inline-block ml-1" aria-hidden="true">
                  →
                </span>
                <span className={cn("block absolute top-0 inset-x-0 md:max-lg:h-28", styles.className4)} />
              </a>
            </h3>
            <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
              {d.description3}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

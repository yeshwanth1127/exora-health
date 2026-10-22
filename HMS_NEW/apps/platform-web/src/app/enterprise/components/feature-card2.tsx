import type { FeatureCard2Styles } from "../_styles";
import { cn } from "../../../lib/utils";
export type FeatureCard2Data = {
  title: string;
  description: string;
  title2: string;
  description2: string;
  title3: string;
  description3: string;
};
/** A feature card. */
export default function FeatureCard2({ d, styles }: { d: FeatureCard2Data; styles: FeatureCard2Styles }) {
  return (
    <div className={cn("flex flex-wrap gap-6", styles.className)} role="group">
      <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full">
        <div className="h-full flex rounded-xl flex-col overflow-clip">
          <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
            <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
              {d.title}
            </h3>
            <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
              {d.description}
            </p>
          </div>
        </div>
      </article>
      <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full">
        <div className="h-full flex rounded-xl flex-col overflow-clip">
          <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
            <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
              {d.title2}
            </h3>
            <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
              {d.description2}
            </p>
          </div>
        </div>
      </article>
      <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full">
        <div className="h-full flex rounded-xl flex-col overflow-clip">
          <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
            <h3 className="block text-color-002 text-lg font-bold leading-7 tracking-[-0.12px] text-balance [font-feature-settings:'lnum',_'locl'_0]" data-component="heading">
              {d.title3}
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

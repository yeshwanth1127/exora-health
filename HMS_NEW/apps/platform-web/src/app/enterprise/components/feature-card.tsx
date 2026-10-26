export type FeatureCardData = {
  title: string;
  description: string;
};
/** A feature card. */
export default function FeatureCard({ d }: { d: FeatureCardData }) {
  return (
    <article className="border-2 border-solid border-border block relative rounded-xl grow basis-[calc(33.3333%_-_16px)] bg-border max-lg:basis-full">
      <div className="h-full flex rounded-xl flex-col overflow-clip">
        <div className="h-full flex py-7 px-8 flex-col grow basis-[fit-content] gap-1">
          <h3 className="block text-foreground text-[4rem] font-bold leading-16 tracking-[-2.13px] text-balance [font-feature-settings:'lnum',_'locl'_0] max-md:text-[2.625rem] max-md:leading-12 max-md:tracking-[-1.5px] md:max-lg:text-[3.375rem] md:max-lg:leading-14 md:max-lg:tracking-[-1.88px]" data-component="heading">
            {d.title}
          </h3>
          <p className="block text-foreground [font-feature-settings:'lnum',_'locl'_0]">
            {d.description}
          </p>
        </div>
      </div>
    </article>
  );
}

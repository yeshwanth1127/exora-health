import type { DittoNodeMetaMap } from "../ditto-meta";
export type ProductCard2Data = {
  variant: string;
  title: string;
  ariaLabel: string;
  href: string;
};
/** A product card. */
export default function ProductCard2({ d, meta }: { d: ProductCard2Data; meta: DittoNodeMetaMap }) {
  return (
    <div data-ditto-id={meta[0]?.anchor} className="w-full border border-solid border-border flex relative p-6 rounded-xl flex-wrap justify-start items-start content-between gap-4 bg-background max-md:p-4 max-lg:items-center max-lg:[flex-wrap:initial] after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--clr-10)_0px_0.175px_1.041px_0px,var(--clr-10)_0px_0.8px_2.925px_0px,var(--clr-10)_0px_2.025px_7.847px_0px,var(--clr-11)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl">
      <a data-ditto-id={meta[1]?.anchor} className="w-[210.5px] h-full block absolute top-0 left-0 min-w-0 text-foreground cursor-pointer max-md:w-[21.3125rem] md:max-lg:w-[40.675rem] 2xl:w-60.5 focus:outline-0" data-component="link" aria-label={d.ariaLabel} href={d.href}>
        {" "}
      </a>
      <ProductCard2Slot1 d={d} />
      <h3 data-ditto-id={meta[2]?.anchor} className="block text-color-003 font-bold text-balance" data-component="heading">
        {d.title}
        <span data-ditto-id={meta[3]?.anchor} className="inline-block ml-1" aria-hidden="true">
          →
        </span>
      </h3>
    </div>
  );
}

function ProductCard2Slot1({ d }: { d: ProductCard2Data }) {
  switch (d.variant) {
    case "triage-product-feedback":
      return (
        <div className="block relative pointer-events-none">
          <span className="inline-grid min-w-[fit-content] rounded-full items-center justify-items-center text-accent text-[2.5rem] leading-15 bg-accent pointer-events-none grid-cols-[minmax(0,_1fr)] grid-rows-1 aspect-square max-lg:text-[1.75rem] max-lg:leading-10.5">
            <img className="w-10 h-10 block overflow-clip aspect-[auto_48/48] text-clr-0 pointer-events-none max-lg:w-7 max-lg:h-7" data-ditto-id="style-image-17" data-component="image" alt="" height="48" src="/assets/capture-rebrand/records.svg" srcSet="/assets/capture-rebrand/records.svg 1x, /assets/capture-rebrand/records.svg 2x" width="48" />
          </span>
        </div>
      );
    case "resolve-support-tickets-in-slack":
      return (
        <div className="block relative pointer-events-none">
          <span className="inline-grid min-w-[fit-content] rounded-full items-center justify-items-center text-accent text-[2.5rem] leading-15 bg-clr-14 pointer-events-none grid-cols-[minmax(0,_1fr)] grid-rows-1 aspect-square max-lg:text-[1.75rem] max-lg:leading-10.5">
            <img className="w-10 h-10 block overflow-clip aspect-[auto_48/48] text-clr-0 pointer-events-none max-lg:w-7 max-lg:h-7" data-ditto-id="style-image-23" data-component="image" alt="" height="48" src="/assets/capture-rebrand/inbox.svg" srcSet="/assets/capture-rebrand/inbox.svg 1x, /assets/capture-rebrand/inbox.svg 2x" width="48" />
          </span>
        </div>
      );
    case "respond-to-security-alerts-faster":
      return (
        <div className="block relative pointer-events-none" data-ditto-id="style-div-45">
          <span className="inline-grid min-w-[fit-content] rounded-full items-center justify-items-center text-accent text-[2.5rem] leading-15 bg-clr-15 pointer-events-none grid-cols-[minmax(0,_1fr)] grid-rows-1 aspect-square max-lg:text-[1.75rem] max-lg:leading-10.5" data-ditto-id="style-span-86">
            <img className="w-10 h-10 block overflow-clip aspect-[auto_48/48] text-clr-0 pointer-events-none max-lg:w-7 max-lg:h-7" data-component="image" alt="" height="48" src="/assets/capture-rebrand/team.svg" srcSet="/assets/capture-rebrand/team.svg 1x, /assets/capture-rebrand/team.svg 2x" width="48" />
          </span>
        </div>
      );
    case "automate-weekly-reporting":
      return (
        <div className="block relative pointer-events-none" data-ditto-id="style-div-140">
          <span className="inline-grid min-w-[fit-content] rounded-full items-center justify-items-center text-accent text-[2.5rem] leading-15 bg-clr-16 pointer-events-none grid-cols-[minmax(0,_1fr)] grid-rows-1 aspect-square max-lg:text-[1.75rem] max-lg:leading-10.5" data-ditto-id="style-span-39">
            <img className="w-10 h-10 block overflow-clip aspect-[auto_48/48] text-clr-0 pointer-events-none max-lg:w-7 max-lg:h-7" data-ditto-id="style-image-24" data-component="image" alt="" height="48" src="/assets/capture-rebrand/appointments.svg" srcSet="/assets/capture-rebrand/appointments.svg 1x, /assets/capture-rebrand/appointments.svg 2x" width="48" />
          </span>
        </div>
      );
    case "create-your-own-developer-tools":
      return (
        <div className="block relative pointer-events-none">
          <span className="inline-grid min-w-[fit-content] rounded-full items-center justify-items-center text-accent text-[2.5rem] leading-15 bg-clr-17 pointer-events-none grid-cols-[minmax(0,_1fr)] grid-rows-1 aspect-square max-lg:text-[1.75rem] max-lg:leading-10.5" data-ditto-id="style-span-87">
            <img className="w-10 h-10 block overflow-clip aspect-[auto_48/48] text-clr-0 pointer-events-none max-lg:w-7 max-lg:h-7" data-ditto-id="style-image-25" data-component="image" alt="" height="48" src="/assets/capture-rebrand/records.svg" srcSet="/assets/capture-rebrand/records.svg 1x, /assets/capture-rebrand/records.svg 2x" width="48" />
          </span>
          <img className="w-6 h-6 block absolute -right-[1.35rem] bottom-[11.5px] overflow-clip aspect-[auto_24/24] text-clr-0 [rotate:8.84deg] pointer-events-none max-lg:-right-[0.525rem] max-lg:bottom-[0.3125rem]" data-ditto-id="style-image-26" data-component="image" alt="" height="24" src="/assets/capture-rebrand/inbox.svg" srcSet="/assets/capture-rebrand/inbox.svg 1x, /assets/capture-rebrand/inbox.svg 2x" width="24" />
        </div>
      );
    default:
      return null;
  }
}

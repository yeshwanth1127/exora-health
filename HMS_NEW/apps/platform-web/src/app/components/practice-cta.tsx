import { BRAND_NAME } from "../../lib/brand";

// "See Capture at your practice." closing block, shared by the care team pages and the reach report.
export default function PracticeCta({ text, className }: { text: string; className: string }) {
  return <section className={`flex py-16 px-8 flex-col justify-center items-center gap-3 text-center bg-border ${className}`} data-ditto-id="style-blockquote" aria-labelledby="practice-cta-title">
    <h2 className="block mb-1 text-foreground text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance [font-feature-settings:'lnum',_'locl'_0] max-lg:text-[1.625rem] max-lg:leading-8 max-lg:tracking-[-0.62px]" data-ditto-id="style-br-2" data-component="heading" id="practice-cta-title">
      See {BRAND_NAME} at your practice.
    </h2>
    <p className="block mb-3 text-xl leading-7 tracking-[-0.12px] [font-feature-settings:'lnum',_'locl'_0] max-md:[font-size:inherit] max-md:leading-[inherit] max-md:tracking-[inherit]" data-ditto-id="style-figcaption-2">
      {text}
    </p>
    <div className="flex justify-start items-stretch gap-2" data-ditto-id="style-span-50">
      <a className="border border-solid border-clr-0 flex py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-background font-medium [font-feature-settings:'lnum',_'locl'_0] bg-primary cursor-pointer" data-ditto-id="style-footer-3" data-component="button" href="/product/features">
        Explore the product
      </a>
      <a className="border border-solid border-clr-0 flex py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-accent font-medium [font-feature-settings:'lnum',_'locl'_0] bg-background cursor-pointer" data-ditto-id="style-ul-3" data-component="button" href="/contact-sales">
        Request a demo
      </a>
    </div>
  </section>;
}

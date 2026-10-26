import { BRAND_NAME } from "../../lib/brand";
import { ctaSectionContent } from "../content";
/** Cta section. */
export default function CtaSection({ content = ctaSectionContent } = {}) {
  return (
    <section className="block" aria-labelledby="_R_bm_-heading" id="_R_bm_">
      <div className="min-h-140 flex py-16 px-8 flex-col justify-center items-center gap-3 text-center bg-clr-20 max-lg:min-h-0 2xl:min-h-180">
        <h2 className="block mb-1 text-foreground text-[2.625rem] font-bold leading-12 tracking-[-1.5px] text-balance max-lg:text-[1.625rem] max-lg:leading-8 max-lg:tracking-[-0.62px]" data-ditto-id="style-r-bm-heading" data-component="heading" id="_R_bm_-heading">
          {content.title}
        </h2>
        <div className="w-[316.7px] flex justify-center items-center gap-3 max-md:w-[19.4375rem] max-md:flex-col max-md:items-stretch" data-ditto-id="style-div-149">
          <a className="h-9.5 border border-solid border-clr-1 flex py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-background font-medium bg-primary cursor-pointer hover:bg-clr-9 focus:bg-clr-24 focus:outline-background focus:[outline-style:none] focus:outline-0" data-ditto-id="style-section-3" data-component="button" href="/quote">
            Explore {BRAND_NAME}
          </a>
          <a className="h-9.5 border border-solid border-clr-1 flex py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-accent font-medium bg-background cursor-pointer hover:bg-clr-23 hover:text-color-003 hover:[text-decoration-color:var(--color-003)] focus:bg-clr-29 focus:text-color-003 focus:outline-color-003 focus:[outline-style:none] focus:outline-0 focus:[text-decoration-color:var(--color-003)]" data-ditto-id="style-div-9" data-component="button" href={content.actions[0].href}>
            {content.actions[0].label}
          </a>
        </div>
      </div>
    </section>
  );
}

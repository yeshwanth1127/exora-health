import { BRAND_NAME } from "../../lib/brand";
import CaptureBrand from "../components/brand";
import Icon2 from "../svgs/svg-icon2";
import Icon3 from "../svgs/svg-icon3";
/** Top navigation bar. */
export default function Navbar() {
  return (
    <div className="h-16 block sticky top-0 z-100 focus:outline-0" data-ditto-id="style-div">
      <div className="contents bg-background">
        <nav className="h-16 min-h-16 grid relative z-100 items-center justify-items-center bg-background shadow-[var(--clr-0)_0px_1px_0px_0px] grid-cols-[minmax(0,_1fr)]" data-component="nav" aria-label="Main">
          <div className="w-full grid py-3.5 px-6 justify-between items-center gap-4 grid-cols-[396.891px_406.203px_396.906px] overflow-auto max-lg:px-4 max-md:grid-cols-[140.578px_0px_170.422px] md:max-lg:grid-cols-[352px_0px_352px] 2xl:grid-cols-[716.891px_406.203px_716.906px]">
            <div className="block" data-ditto-id="style-div-57">
              <a className="h-8.5 flex max-h-9 items-center col-start-1 text-foreground cursor-pointer focus:outline-foreground focus:[outline-style:none] focus:outline-0" data-ditto-id="style-site-home" data-component="link" aria-label={(BRAND_NAME + " – Home")} href="/">
                <CaptureBrand />
              </a>
            </div>
            <div className="flex justify-center items-center gap-1 col-start-2 max-lg:hidden" data-ditto-id="style-main">
              <div className="block after:content-[''] after:block after:absolute after:top-[2.9375rem] after:-bottom-[0.8125rem] after:inset-x-0 after:z-99 after:w-320 after:h-7.5 max-lg:after:w-full max-lg:after:inset-y-auto max-lg:after:right-auto 2xl:after:w-480" data-ditto-id="style-div-46" id="product">
                <button className="h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center text-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer hover:bg-clr-12 hover:[background-position:0%_0%] focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-div-4" data-component="button" aria-expanded="false" aria-haspopup="true">
                  <span className="block text-sm font-medium leading-5 [font-feature-settings:normal] focus:outline-0" data-ditto-id="style-div-16">
                    Product
                  </span>
                  <span className="w-[0.65rem] h-[0.65rem] block focus:outline-0" data-ditto-id="style-span-9">
                    <Icon2 dittoId={"style-form"} />
                  </span>
                </button>
              </div>
              <div className="block after:content-[''] after:block after:absolute after:top-[2.9375rem] after:-bottom-[0.8125rem] after:inset-x-0 after:z-99 after:w-320 after:h-7.5 max-lg:after:w-full max-lg:after:inset-y-auto max-lg:after:right-auto 2xl:after:w-480" data-ditto-id="style-div-47" id="resources">
                <button className="h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center text-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer hover:bg-clr-12 hover:[background-position:0%_0%] focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-label" data-component="button" aria-expanded="false" aria-haspopup="true">
                  <span className="block text-sm font-medium leading-5 [font-feature-settings:normal] focus:outline-0" data-ditto-id="style-span-10">
                    Solutions
                  </span>
                  <span className="w-[0.65rem] h-[0.65rem] block focus:outline-0" data-ditto-id="style-div-17">
                    <Icon2 dittoId={"style-r-j6kbm"} />
                  </span>
                </button>
              </div>
              <a className="w-[66.3px] h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer hover:bg-clr-12 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-r-j6kbmh1" data-component="link" href="/pricing">
                <span className="block text-sm font-medium leading-5 [font-feature-settings:normal] focus:outline-0" data-ditto-id="style-button">
                  Pricing
                </span>
              </a>
              <a className="w-32 h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer hover:bg-clr-12 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-span" data-component="link" href="/contact-sales">
                <span className="block text-sm font-medium leading-5 [font-feature-settings:normal] focus:outline-0" data-ditto-id="style-div-18">
                  Request a demo
                </span>
              </a>
            </div>
            <div className="flex items-center gap-4 col-start-3">
              <span className="flex items-center gap-3 max-lg:hidden" data-ditto-id="style-footer-2">
                <a className="w-[60.5px] h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer hover:bg-clr-12 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-div-8" data-component="link" href={"/contact-sales"}>
                  <span className="block text-sm font-medium leading-5 [font-feature-settings:normal] focus:outline-0" data-ditto-id="style-div-19">
                    Talk to us
                  </span>
                </a>
              </span>
              <span className="flex" data-ditto-id="style-link-4">
                <a className="h-9 min-h-9 border border-solid border-clr-1 flex py-1 px-3.5 rounded-lg justify-center items-center text-background font-medium text-center [font-feature-settings:normal] bg-primary cursor-pointer hover:bg-clr-9 focus:bg-clr-9 focus:outline-background focus:[outline-style:none] focus:outline-0" data-ditto-id="style-span-8" data-component="link" href="/quote">
                  <span className="block text-sm leading-5 whitespace-nowrap [text-wrap:nowrap_pretty] focus:outline-0" data-ditto-id="style-div-20">
                    Explore {BRAND_NAME}
                  </span>
                </a>
              </span>
              <div className="hidden min-w-0 max-lg:flex">
                <button className="flex -m-[0.6875rem] p-[0.6875rem] justify-center items-center text-center [background-position:0px_50%] cursor-pointer max-lg:h-11" data-ditto-id="capture-mobile-nav" aria-label="Toggle main menu" type="button">
                  <Icon3 />
                </button>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

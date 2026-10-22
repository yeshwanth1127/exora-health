import { pageMetadata } from "../../lib/seo";
import { BRAND_NAME } from "../../lib/brand";
import CaptureBrand from "../components/brand";
import SiteFooter from "../components/site-footer";
import CareTeamPage from "../components/care-team-page";
import "./ditto.css";
import ListRow from "./components/list-row";
// Curated healthcare enterprise page; original navigation and section structure retained.
const ListRow_data = [
    { href: "/product/features", label: "Features" },
    { href: "/releases", label: "What's New" },
    { href: "/product/features", label: "AI reception" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact-sales", label: "Request a demo" },
    { href: "/product/features", label: "Download" }
];
const ListRow_data2 = [
    { href: "/product/features", label: "Customer stories" },
    { href: "/product/features", label: "Connections" },
    { href: "/product/features", label: "Marketplace" },
    { href: "/help", label: "Help Center" },
    { href: "/help", label: "Academy" },
    { href: "/product/features", label: "Community" }
];
const ListRow_data3 = [
    { href: "/product/features", label: "About us" },
    { href: "/product/features", label: "Careers" },
    { href: "/product/features", label: "Security" },
    { href: "/product/features", label: "Status" },
    { href: "/product/features", label: "Terms & privacy" },
    { href: "/product/features", label: "Your privacy rights" }
];
const ListRow_data4 = [
    { href: "/enterprise", label: "For hospitals" },
    { href: "/teams", label: "For clinics" },

    { href: "/product/features", label: "Developers" }
];
const ListRow_cids: string[][] = [
    ["n430", "style-ul-2", "style-company-2"],
    ["n433", "style-172", "style-45"],
    ["n436", "style-173", "style-46"],
    ["n439", "style-174", "style-47"],
    ["n442", "style-span-33", "style-link"],
    ["n445", "style-span-34", "style-section-5"]
];
const ListRow_cids2: string[][] = [
    ["n454", "style-span-7", "style-div-48"],
    ["n457", "style-52", "style-202"],
    ["n460", "style-53", "style-203"],
    ["n463", "style-div-14", "style-li"],
    ["n466", "style-span-52", "style-span-40"],
    ["n469", "style-button-2", "style-span-35"]
];
const ListRow_cids3: string[][] = [
    ["n474", "style-icon-3", "style-div-49"],
    ["n477", "style-span-37", "style-button-8"],
    ["n480", "style-p-9", "style-portal"],
    ["n483", "style-button-11", "style-span-41"],
    ["n486", "style-div-65", "style-div-50"],
    ["n489", "style-span-53", "style-div-51"]
];
const ListRow_cids4: string[][] = [
    ["n494", "style-icon-7", "style-div-52"],
    ["n497", "style-icon-8", "style-div-53"],
    ["n500", "style-div-66", "style-span-42"],
    ["n503", "style-li-2", "style-a"]
];
const ListRow_styles = [
    { className: "w-[5.1375rem]" },
    { className: "w-[6.4875rem]", className2: "whitespace-nowrap" },
    { className: "w-[85.7px]", className2: "whitespace-nowrap" },
    { className: "w-[70.3px]" },
    { className: "w-[8.2625rem]", className2: "whitespace-nowrap" },
    { className: "w-[90.9px]" }
];
const ListRow_styles2 = [
    { className: "w-[8.6875rem]", className2: "whitespace-nowrap" },
    { className: "w-[6.7875rem]" },
    { className: "w-[6.6875rem]" },
    { className: "w-[6.5rem]", className2: "whitespace-nowrap" },
    { className: "w-[5.4125rem]" },
    { className: "w-[6.3rem]" }
];
const ListRow_styles3 = [
    { className: "w-[5.25rem]", className2: "whitespace-nowrap" },
    { className: "w-[76.7px]" },
    { className: "w-[79.5px]" },
    { className: "w-[4.2rem]" },
    { className: "w-[8.1875rem]", className2: "whitespace-nowrap" },
    { className: "w-[149.5px]", className2: "whitespace-nowrap" }
];
const ListRow_styles4 = [
    { className: "w-[5.8rem]" },
    { className: "w-[8.7125rem]", className2: "whitespace-nowrap" },
    { className: "w-[81.7px]" },
    { className: "w-[99.7px]" }
];

export default function Page() {
  return (
    <>
      <div className="block" data-cid="n1" id="__next">
        <div className="contents text-color-001 bg-background" data-cid="n2">
          <div className="h-px block -mb-px" data-cid="n3" aria-hidden="true" />
          <div className="h-16 block sticky top-0 z-100" data-cid="n4">
            <div className="contents bg-background" data-cid="n5">
              <nav className="h-16 min-h-16 grid relative z-100 items-center justify-items-center bg-background shadow-[var(--color-006)_0px_1px_0px_0px] grid-cols-[minmax(0,_1fr)]" data-cid="n6" data-component="nav" aria-label="Main">
                <div className="w-full grid py-3.5 px-6 justify-between items-center gap-4 grid-cols-[396.891px_406.203px_396.906px] overflow-auto max-lg:px-4 max-md:grid-cols-[140.578px_0px_170.422px] md:max-lg:grid-cols-[352px_0px_352px] 2xl:grid-cols-[716.891px_406.203px_716.906px]" data-cid="n7">
                  <div className="block" data-cid="n8">
                    <a className="h-8.5 flex max-h-9 items-center col-start-1 text-foreground cursor-pointer" data-ditto-id="style-div-57" data-component="link" aria-label={(BRAND_NAME + " – Home")} href="/">
                      <CaptureBrand />
                    </a>
                  </div>
                  <div className="flex justify-center items-center gap-1 col-start-2 max-lg:hidden" data-cid="n11">
                    <div className="block after:content-[''] after:block after:absolute after:top-[2.9375rem] after:-bottom-[0.8125rem] after:inset-x-0 after:z-99 after:w-320 after:h-7.5 max-lg:after:w-full max-lg:after:inset-y-auto max-lg:after:right-auto 2xl:after:w-480" data-cid="n12" id="product">
                      <button className="h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center text-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer" data-ditto-id="style-div-46" data-component="button" aria-expanded="false" aria-haspopup="true">
                        <span className="block text-sm font-medium leading-5 [font-feature-settings:normal]" data-ditto-id="style-div-4">
                          Product
                        </span>
                        <span className="w-[0.65rem] h-[0.65rem] block" data-ditto-id="style-div-16">
                          <svg className="w-auto h-2.5 block shrink-0 overflow-hidden" data-ditto-id="style-span-9" data-component="icon" viewBox="0 0 30 30" fill="currentColor">
                            <polygon points="15,17.4 4.8,7 2,9.8 15,23 28,9.8 25.2,7 " />
                          </svg>
                        </span>
                      </button>
                    </div>
                    <div className="block after:content-[''] after:block after:absolute after:top-[2.9375rem] after:-bottom-[0.8125rem] after:inset-x-0 after:z-99 after:w-320 after:h-7.5 max-lg:after:w-full max-lg:after:inset-y-auto max-lg:after:right-auto 2xl:after:w-480" data-cid="n17" id="resources">
                      <button className="h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center text-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer" data-ditto-id="style-div-47" data-component="button" aria-expanded="false" aria-haspopup="true">
                        <span className="block text-sm font-medium leading-5 [font-feature-settings:normal]" data-ditto-id="style-label">
                          Solutions
                        </span>
                        <span className="w-[0.65rem] h-[0.65rem] block" data-ditto-id="style-span-10">
                          <svg className="w-auto h-2.5 block shrink-0 overflow-hidden" data-ditto-id="style-div-17" data-component="icon" viewBox="0 0 30 30" fill="currentColor">
                            <polygon points="15,17.4 4.8,7 2,9.8 15,23 28,9.8 25.2,7 " />
                          </svg>
                        </span>
                      </button>
                    </div>
                    <a className="w-[66.3px] h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer" data-ditto-id="style-r-j6kbm" data-component="link" href="/pricing">
                      <span className="block text-sm font-medium leading-5 [font-feature-settings:normal]" data-ditto-id="style-r-j6kbmh1">
                        Pricing
                      </span>
                    </a>
                    <a className="w-32 h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer" data-ditto-id="style-button" data-component="link" href="/contact-sales">
                      <span className="block text-sm font-medium leading-5 [font-feature-settings:normal]" data-ditto-id="style-span">
                        Request a demo
                      </span>
                    </a>
                  </div>
                  <div className="flex items-center gap-4 col-start-3" data-cid="n26">
                    <span className="flex items-center gap-3 max-lg:hidden" data-cid="n27">
                      <a className="w-[60.5px] h-7.5 flex py-[0.3125rem] px-2.5 rounded-sm justify-center items-center content-center shrink-0 gap-2 justify-items-center whitespace-nowrap [text-wrap:nowrap_pretty] cursor-pointer" data-ditto-id="style-footer-2" data-component="link" href={"/contact-sales"}>
                        <span className="block text-sm font-medium leading-5 [font-feature-settings:normal]" data-ditto-id="style-div-8">
                          Talk to us
                        </span>
                      </a>
                    </span>
                    <span className="flex" data-cid="n30">
                      <a className="h-9 min-h-9 border border-solid border-clr-0 flex py-1 px-3.5 rounded-lg justify-center items-center text-background font-medium text-center [font-feature-settings:normal] bg-primary cursor-pointer" data-ditto-id="style-link-4" data-component="link" href="/quote">
                        <span className="block text-sm leading-5 whitespace-nowrap [text-wrap:nowrap_pretty]" data-ditto-id="style-span-8">
                          Explore {BRAND_NAME}
                        </span>
                      </a>
                    </span>
                    <div className="hidden min-w-0 max-lg:flex" data-cid="n33">
                      <button className="flex -m-[0.6875rem] p-[0.6875rem] justify-center items-center text-center [background-position:0px_50%] cursor-pointer max-lg:h-11" data-cid="n34" data-ditto-id="capture-mobile-nav" aria-label="Toggle main menu" type="button">
                        <svg className="w-auto h-full block min-w-0 shrink-0 overflow-hidden max-lg:h-5.5" data-cid="n35" viewBox="0 0 30 30" fill="currentColor">
                          <path d="M2,4v2h26V4H2z M2,16h26v-2H2V16z M2,26h26v-2H2V26z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </nav>
            </div>
          </div>
          <CareTeamPage audience="enterprise" />
          <div className="contents bg-background" data-cid="n415">
            <SiteFooter />
          </div>
        </div>
      </div>
      <div className="block" data-cid="n523" id="portal" />
      {" "}
    </>
  );
}

export const metadata = pageMetadata("/enterprise");

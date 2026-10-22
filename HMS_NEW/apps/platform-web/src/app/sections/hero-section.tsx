import { BRAND_NAME } from "../../lib/brand";
import Tile from "../components/tile";
import Icon4 from "../svgs/svg-icon4";
import Logo from "../components/logo";
import { Tile_meta, Logo_meta } from "../ditto-meta";
import { Logo_styles } from "../_styles";
import { tileData as tileDataContent, logos as logosContent } from "../content";
/** Hero section — the page's lead block. */
export default function HeroSection({ tileData = tileDataContent, logos = logosContent } = {}) {
  return (
    <div className="block pb-4 focus:outline-0" data-ditto-id="style-header">
      <div data-reference-hero-grid="true" className="grid relative z-0 grid-cols-[[full-bleed-start]_0px_[full-start]_64px_[content-start]_72px_24px_[center-start]_468px_[center-mid-start]_24px_[center-mid-end]_468px_[center-end]_24px_72px_[content-end]_64px_[full-end]_0px_[full-bleed-end]] col-span-full max-lg:grid-cols-[1fr_10.573fr_12px_10.573fr_1fr] max-lg:static max-lg:inset-auto max-lg:z-[initial] 2xl:grid-cols-[[full-bleed-start]_270px_[full-start]_64px_[content-start]_122px_24px_[center-start]_468px_[center-mid-start]_24px_[center-mid-end]_468px_[center-end]_24px_122px_[content-end]_64px_[full-end]_270px_[full-bleed-end]] before:content-[''] before:block before:w-320 before:h-20 max-md:before:w-[23.4375rem] max-lg:before:h-10 md:max-lg:before:w-192 2xl:before:w-345 after:content-[''] after:block after:w-320 after:h-20 max-md:after:w-[23.4375rem] max-lg:after:h-10 md:max-lg:after:w-192 2xl:after:w-345" data-ditto-id="style-div-86">
        <div className="hidden min-w-0 [grid-column-start:content-start] [grid-column-end:content-end] max-lg:block" data-ditto-id="style-div-87">
          <div className="flex flex-wrap justify-center items-center" data-ditto-id="style-p-10">
            {tileData.map((d, i) => <Tile key={i} d={d} meta={Tile_meta[i]} />)}
          </div>
        </div>
        <div className="block min-w-0 [grid-column-start:content-start] [grid-column-end:content-end] max-lg:mt-6" data-ditto-id="style-div-58">
          <header className="h-full block text-center" data-ditto-id="style-r-3kkbm">
            <h1 className="block mb-3 text-foreground text-8xl font-semibold leading-25 tracking-[-4.6px] text-balance [font-feature-settings:normal] max-md:text-[2.625rem] max-md:leading-12 max-md:tracking-[-1.5px] md:max-lg:text-[3.8125rem] md:max-lg:leading-[4.125rem] md:max-lg:tracking-[-2.58px]" data-component="heading">
              {"Where teams and agents "}
              <span className="inline-flex py-2 px-7 rounded-full items-baseline gap-3 text-7xl font-medium leading-[5.4375rem] tracking-[-2px] bg-clr-2 max-lg:py-0.5 max-lg:px-3 max-lg:gap-1.5 max-md:text-[2rem] max-md:leading-[2.375rem] max-md:tracking-[-0.88px] max-md:bg-clr-3 md:max-lg:text-[2.875rem] md:max-lg:leading-[3.4375rem] md:max-lg:tracking-[-1.27px] md:max-lg:bg-clr-4 2xl:bg-clr-5 before:content-[''] before:block before:w-8 before:h-8 before:bg-clr-6 before:rounded-tl-full max-lg:before:w-4 max-lg:before:h-4 max-md:before:bg-clr-7 md:max-lg:before:bg-accent 2xl:before:bg-clr-8">
                <span className="block overflow-hidden whitespace-nowrap [text-wrap:nowrap_balance]">
                  <span className="inline-block">
                    Create
                  </span>
                </span>
              </span>
              {" together."}
            </h1>
            <p className="block mb-5 text-xl leading-7 tracking-[-0.12px] text-balance max-md:[font-size:inherit] max-md:leading-[inherit] max-md:tracking-[inherit]" data-ditto-id="style-p-29">
              {BRAND_NAME} context, find answers, and automate tasks with AI built for your team.
            </p>
            <div className="w-[20.4625rem] grid max-w-full mx-auto flex-wrap justify-center gap-4 grid-cols-2 max-md:w-[21.4375rem] max-md:flex max-md:gap-2 max-md:mx-0 max-md:grid-cols-[initial]">
              <a className="w-full h-9.5 border border-solid border-clr-1 flex max-w-70 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-background font-medium bg-primary cursor-pointer hover:bg-clr-9 focus:bg-clr-24 focus:outline-background focus:[outline-style:none] focus:outline-0" data-ditto-id="style-button-3" data-component="button" href="/quote">
                Explore {BRAND_NAME}
              </a>
              <a className="w-full h-9.5 border border-solid border-clr-1 flex max-w-70 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center gap-3 text-clr-9 font-medium bg-clr-4 cursor-pointer hover:bg-clr-22 focus:bg-clr-25 focus:outline-clr-9 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-div-15" data-component="button" href="/contact-sales">
                Request a demo
              </a>
            </div>
          </header>
        </div>
        <div className="block relative min-w-0 mt-20 [grid-column-start:center-start] [grid-column-end:center-end] max-lg:mt-0 2xl:[grid-column-start:content-start] 2xl:[grid-column-end:content-end]">
          <div className="w-40 h-42.5 block absolute right-0 z-2 transform-[matrix(1,0,0,1,0,-146)] pointer-events-none max-lg:hidden" aria-hidden="true">
            <picture className="inline pointer-events-none" data-ditto-id="style-picture-4">
              <source className="inline pointer-events-none" data-ditto-id="style-source-2" media="(min-width: 840px)" sizes="160px" srcSet="/assets/capture-illustrations/care-messaging-coral.webp 32w, /assets/capture-illustrations/care-messaging-coral.webp 48w, /assets/capture-illustrations/care-messaging-coral.webp 96w, /assets/capture-illustrations/care-messaging-coral.webp 128w, /assets/capture-illustrations/care-messaging-coral.webp 256w, /assets/capture-illustrations/care-messaging-coral.webp 384w, /assets/capture-illustrations/care-messaging-coral.webp 640w, /assets/capture-illustrations/care-messaging-coral.webp 1080w, /assets/capture-illustrations/care-messaging-coral.webp 1200w, /assets/capture-illustrations/care-messaging-coral.webp 1920w, /assets/capture-illustrations/care-messaging-coral.webp 2048w, /assets/capture-illustrations/care-messaging-coral.webp 3840w" />
              <img className="w-full h-42.5 block overflow-clip object-contain aspect-[auto_480/510] text-clr-0 pointer-events-none" data-ditto-id="style-portal-2" data-component="image" alt="" height="510" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="480" />
            </picture>
          </div>
          <div className="w-40 h-42.5 block absolute top-[clamp(300.4px,_50%,_calc(100%_-_300.4px))] z-2 transform-[matrix(1,0,0,1,-136,-85)] pointer-events-none max-lg:hidden" aria-hidden="true">
            <picture className="inline pointer-events-none" data-ditto-id="style-picture-5">
              <source className="inline pointer-events-none" media="(min-width: 840px)" sizes="160px" srcSet="/assets/capture-illustrations/appointments-blue.webp 32w, /assets/capture-illustrations/appointments-blue.webp 48w, /assets/capture-illustrations/appointments-blue.webp 96w, /assets/capture-illustrations/appointments-blue.webp 128w, /assets/capture-illustrations/appointments-blue.webp 256w, /assets/capture-illustrations/appointments-blue.webp 384w, /assets/capture-illustrations/appointments-blue.webp 640w, /assets/capture-illustrations/appointments-blue.webp 1080w, /assets/capture-illustrations/appointments-blue.webp 1200w, /assets/capture-illustrations/appointments-blue.webp 1920w, /assets/capture-illustrations/appointments-blue.webp 2048w, /assets/capture-illustrations/appointments-blue.webp 3840w" />
              <img className="w-full h-42.5 block overflow-clip object-contain aspect-[auto_480/510] text-clr-0 pointer-events-none" data-component="image" alt="" height="510" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="480" />
            </picture>
          </div>
          <div className="h-full block relative max-lg:hidden">
            <div className="h-full border border-solid border-border block relative max-w-full rounded-lg overflow-hidden shadow-[var(--clr-0)_0px_0.667px_3.502px_0px,var(--clr-10)_0px_2.933px_7.252px_0px,var(--clr-10)_0px_7.2px_14.462px_0px,var(--clr-10)_0px_13.867px_28.348px_0px,var(--clr-11)_0px_23.333px_52.123px_0px,var(--clr-11)_0px_36px_89px_0px]" data-ditto-id="style-div-88">
              <img className="w-full h-full object-contain" src="/assets/capture-rebrand/appointments.svg" alt={(BRAND_NAME + " appointments — illustrative product preview")} />
              <picture className="w-239.5 h-[37.4375rem] block absolute top-0 left-0 opacity-0 pointer-events-none">
                <source className="inline pointer-events-none" media="(min-width: 840px)" sizes="(min-width: 960px) 960px, 100vw" srcSet="/assets/capture-rebrand/records.svg 640w, /assets/capture-rebrand/records.svg 1080w, /assets/capture-rebrand/records.svg 1200w, /assets/capture-rebrand/records.svg 1920w, /assets/capture-rebrand/records.svg 2048w, /assets/capture-rebrand/records.svg 3840w" />
                <img className="w-full h-[37.4375rem] block overflow-clip object-cover aspect-[auto_960/600] pointer-events-none 2xl:h-[48.8125rem]" data-ditto-id="style-image-29" data-component="image" alt="" height="600" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="960" />
              </picture>
              <button className="w-8 h-8 flex absolute bottom-3 left-3 z-1 rounded-[50%] justify-center items-center text-background text-center bg-clr-12 [backdrop-filter:blur(12px)] cursor-pointer hover:transform-[matrix(1.04802,0,0,1.04802,0,0)] focus:outline-background focus:[outline-style:none] focus:outline-1 focus:transform-[matrix(1.00067,0,0,1.00067,0,0)]" data-ditto-id="style-button-4" data-component="button">
                <span className="w-3 h-3 flex ml-px justify-center items-center focus:outline-0" data-ditto-id="style-span-11">
                  <Icon4 dittoId={"style-icon-4"} />
                </span>
                <span className="w-px h-px block absolute min-w-0 overflow-hidden whitespace-nowrap [text-wrap:nowrap_pretty] [clip-path:inset(50%)] focus:outline-0" data-ditto-id="style-span-12">
                  Play
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="block max-w-296 mt-8 mx-auto text-color-004 text-sm leading-5 text-center" data-ditto-id="style-p-30">
        Built around the people who keep care moving.
      </p>
      <div className="contents relative" data-ditto-id="style-div-89">
        <div className="h-24 block sticky -bottom-12 z-1 isolate max-lg:bottom-0 max-lg:h-auto max-lg:static" data-ditto-id="style-div-90">
          <div className="h-full block relative mt-4 py-1 bg-background after:content-[''] after:block after:absolute after:top-0 after:bottom-[5.9375rem] after:inset-x-0 after:h-px after:bg-border after:opacity-0 max-lg:after:hidden max-lg:after:bottom-auto" data-ditto-id="style-div-132">
            <div className="h-full grid max-w-296 max-h-22 mx-auto py-1 flex-wrap justify-center gap-2 grid-cols-[116px_116px_116px_116px_116px_116px_116px_116px_116px] [grid-auto-rows:36px] overflow-hidden text-center max-lg:flex max-lg:[flex-wrap:initial] max-lg:[justify-content:initial] max-lg:gap-y-[initial] max-lg:[grid-auto-rows:initial]" data-ditto-id="style-div-2">
              <a className="h-9 border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-1 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-26 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-openai" data-component="link" aria-label="OpenAI" href="/product/features">
                <span className="w-full grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-openai-2" aria-hidden="true" aria-label="OpenAI" role="img">
                  <span className="grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-18.5 after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-span-13" aria-hidden="true">
                    <img className="w-16.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-1.svg\")" }} data-ditto-id="style-image-2" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-1.svg" width="96" />
                  </span>
                </span>
              </a>
              <span className="border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 row-start-1 font-medium bg-clr-1 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-5s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]" data-ditto-id="style-span-81">
                <span className="basis-full shrink-0 grid min-w-0 max-w-full items-center justify-items-center text-color-002 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]" data-ditto-id="style-a24" aria-label="A24" role="img">
                  <span className="grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]" data-ditto-id="style-span-82" aria-hidden="true">
                    <img className="w-14.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 pointer-events-none" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-4.svg\")" }} data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-4.svg" width="96" />
                  </span>
                </span>
              </span>
              <a className="h-9 border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-1 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-10s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-27 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-figma" data-component="link" aria-label="Figma" href="/product/features">
                <span className="w-full grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-figma-2" aria-hidden="true" aria-label="Figma" role="img">
                  <span className="grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-[4.4rem] after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-span-14" aria-hidden="true">
                    <img className="w-15.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-2.svg\")" }} data-ditto-id="style-image-3" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-2.svg" width="96" />
                  </span>
                </span>
              </a>
              <span className="border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 row-start-1 font-medium bg-clr-1 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-15s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]" data-ditto-id="style-r-14kkbm">
                <span className="basis-full shrink-0 grid min-w-0 max-w-full items-center justify-items-center text-color-002 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]" aria-label="Federal Express" role="img">
                  <span className="w-[4.6875rem] grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]" data-ditto-id="style-previous" aria-hidden="true">
                    <img className="w-[4.6875rem] h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 pointer-events-none" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-6.svg\")" }} data-ditto-id="style-span-43" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-6.svg" width="96" />
                  </span>
                </span>
              </span>
              <a className="h-9 border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-1 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-20s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-27 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-icon-2" data-component="link" aria-label="Ramp" href="/product/features">
                <span className="w-full grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-next" aria-hidden="true" aria-label="Ramp" role="img">
                  <span className="w-[4.8125rem] grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-[5.3125rem] after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-span-15" aria-hidden="true">
                    <img className="w-[4.8125rem] h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-3.svg\")" }} data-ditto-id="style-icon-5" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-3.svg" width="96" />
                  </span>
                </span>
              </a>
              <a className="h-9 border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-1 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-25s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-27 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-div-3" data-component="link" aria-label="Cursor" href="/product/features">
                <span className="w-full grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-r-r4kkbm" aria-hidden="true" aria-label="Cursor" role="img">
                  <span className="w-20.5 grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-22.5 after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-figure-2" aria-hidden="true">
                    <img className="w-20.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-1.svg\")" }} data-ditto-id="style-r-sr4kkbm" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-1.svg" width="96" />
                  </span>
                </span>
              </a>
              <span className="border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 row-start-1 font-medium bg-clr-1 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-30s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]">
                <span className="w-21 grid min-w-0 max-w-full items-center shrink-0 justify-items-center text-color-002 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]" aria-label="Substack" role="img">
                  <span className="grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]" data-ditto-id="style-r-1b4kkbm" aria-hidden="true">
                    <img className="w-21 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 pointer-events-none" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-2.svg\")" }} data-ditto-id="style-figure-5" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-2.svg" width="96" />
                  </span>
                </span>
              </span>
              <span className="border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 row-start-1 font-medium bg-clr-1 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-35s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]" data-ditto-id="style-r-tb4kkbm">
                <span className="w-21 grid min-w-0 max-w-full items-center shrink-0 justify-items-center text-color-002 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]" data-ditto-id="style-image-20" aria-label="Nvidia" role="img">
                  <span className="grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]" aria-hidden="true">
                    <img className="w-21 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 pointer-events-none" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-5.svg\")" }} data-ditto-id="style-r-1r4kkbm" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-5.svg" width="96" />
                  </span>
                </span>
              </span>
              <a className="h-9 border border-solid border-clr-1 flex relative max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-1 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-40s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-27 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-figure" data-component="link" aria-label="Toyota" href="/product/features">
                <span className="w-21.5 grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-r-tr4kkbm" aria-hidden="true" aria-label="Toyota" role="img">
                  <span className="grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-23.5 after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-image-4" aria-hidden="true">
                    <img className="w-21.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-4.svg\")" }} data-ditto-id="style-figcaption" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-4.svg" width="96" />
                  </span>
                </span>
              </a>
              <a className="h-9 border border-solid border-clr-1 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-2 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-45s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-27 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-r-2b4kkbm" data-component="link" aria-label="Clay" href="/product/features">
                <span className="w-full grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-figure-3" aria-hidden="true" aria-label="Clay" role="img">
                  <span className="w-17.5 grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-19.5 after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-r-ub4kkbm" aria-hidden="true">
                    <img className="w-17.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-5.svg\")" }} data-ditto-id="style-image-5" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-5.svg" width="96" />
                  </span>
                </span>
              </a>
              <span className="border border-solid border-clr-1 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 row-start-2 font-medium bg-clr-1 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-50s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]">
                <span className="w-21 grid min-w-0 max-w-full items-center shrink-0 justify-items-center text-color-002 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]" aria-label="Automobili Lamborghini" role="img">
                  <span className="grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]" aria-hidden="true">
                    <img className="w-21 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 pointer-events-none" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-6.svg\")" }} data-ditto-id="style-image-16" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-6.svg" width="96" />
                  </span>
                </span>
              </span>
              <span className="border border-solid border-clr-1 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 row-start-2 font-medium bg-clr-1 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-55s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]" data-ditto-id="style-span-83">
                <span className="w-21 grid min-w-0 max-w-full items-center shrink-0 justify-items-center text-color-002 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]" data-ditto-id="style-david-zwirner-inc" aria-label="David Zwirner, Inc." role="img">
                  <span className="grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]" aria-hidden="true">
                    <img className="w-21 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 pointer-events-none" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-0.svg\")" }} data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-0.svg" width="96" />
                  </span>
                </span>
              </span>
              <a className="h-9 border border-solid border-clr-1 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-2 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-60s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-28 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-vercel" data-component="link" aria-label="Vercel" href="/product/features">
                <span className="w-21.5 grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-vercel-2" aria-hidden="true" aria-label="Vercel" role="img">
                  <span className="grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-23.5 after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-span-16" aria-hidden="true">
                    <img className="w-21.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-4.svg\")" }} data-ditto-id="style-image-6" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-4.svg" width="96" />
                  </span>
                </span>
              </a>
              <a className="h-9 border border-solid border-clr-1 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-2 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-65s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-26 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-faire" data-component="link" aria-label="Faire" href="/product/features">
                <span className="w-21.5 grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-faire-2" aria-hidden="true" aria-label="Faire" role="img">
                  <span className="grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-23.5 after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-span-17" aria-hidden="true">
                    <img className="w-21.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-2.svg\")" }} data-ditto-id="style-image-7" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-2.svg" width="96" />
                  </span>
                </span>
              </a>
              {logos.map((d, i) => <Logo key={i} d={d} meta={Logo_meta[i]} styles={Logo_styles[i]} />)}
              <a className="w-29 h-9 border border-solid border-clr-1 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-2 rounded-lg justify-center items-center shrink-0 gap-2 row-start-3 font-medium bg-clr-1 cursor-pointer max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-105s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial] hover:bg-clr-20 focus:bg-clr-27 focus:outline-color-001 focus:[outline-style:none] focus:outline-0" data-ditto-id="style-div-5" data-component="link" aria-hidden="true" aria-label="Remote.com" href="/product/features">
                <span className="w-21.5 grid min-w-0 max-w-[calc(100%_-_12px)] items-center shrink-0 justify-items-center text-color-002 leading-0 grid-cols-[minmax(0,_1fr)] focus:outline-0" data-ditto-id="style-image-8" aria-hidden="true" aria-label="Remote.com" role="img">
                  <span className="grid relative max-w-21.5 items-center justify-items-center grid-cols-[minmax(0,_1fr)] after:content-[''] after:block after:absolute after:top-3 after:-right-3 after:bottom-2 after:left-23.5 after:w-1 after:h-1 after:bg-clr-13 after:rounded-tl-full focus:outline-0" data-ditto-id="style-article" aria-hidden="true">
                    <img className="w-21.5 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 focus:outline-0" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-3.svg\")" }} data-ditto-id="style-div-22" data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-3.svg" width="96" />
                  </span>
                </span>
              </a>
              <span className="w-29 h-9 border border-solid border-clr-1 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 row-start-3 font-medium bg-clr-1 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\_\_4H5qWW\_\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-delay:-110s] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]" data-ditto-id="style-div-136" aria-hidden="true">
                <span className="w-21 grid min-w-0 max-w-full items-center shrink-0 justify-items-center text-color-002 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]" aria-label="Patreon" role="img">
                  <span className="grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]" data-ditto-id="style-p-32" aria-hidden="true">
                    <img className="w-21 h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-002 pointer-events-none" style={{ maskImage: "url(\"/assets/capture-rebrand/capability-4.svg\")" }} data-component="image" alt="" height="24" src="/assets/capture-rebrand/capability-4.svg" width="96" />
                  </span>
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="h-px block relative -top-12 bottom-12 invisible -mt-px pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}

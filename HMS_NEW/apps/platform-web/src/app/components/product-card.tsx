import SiteImage from "./site-image";
import type { DittoNodeMetaMap } from "../ditto-meta";
import type { ProductCardStyles } from "../_styles";
import { cn } from "../../lib/utils";
export type ProductCardData = {
  variant: string;
  eyebrow: string;
  title: string;
  href: string;
};
/** A product card. */
export default function ProductCard({ d, meta, styles }: { d: ProductCardData; meta: DittoNodeMetaMap; styles: ProductCardStyles }) {
  return (
    <article data-ditto-id={meta[0]?.anchor} className={cn("block relative min-w-0 rounded-xl bg-background max-lg:rounded-md after:content-[''] after:block after:absolute after:inset-0 after:shadow-[var(--clr-10)_0px_0.175px_1.041px_0px,var(--clr-10)_0px_0.8px_2.925px_0px,var(--clr-10)_0px_2.025px_7.847px_0px,var(--clr-11)_0px_4px_18px_0px] after:opacity-0 after:rounded-tl-xl max-lg:after:rounded-tl-md", styles.className)}>
      <div className={cn("h-full flex relative rounded-xl justify-between overflow-hidden bg-background max-lg:rounded-md", styles.className2)}>
        <a data-ditto-id={meta[2]?.anchor} className="h-full block absolute top-0 inset-x-0 z-1 min-w-0 rounded-xl text-foreground cursor-pointer max-lg:rounded-md focus:outline-0" data-component="link" aria-label="Try it" href={d.href}>
          {" "}
        </a>
        <header data-ditto-id={meta[3]?.anchor} className={cn("flex z-2 p-6 flex-col flex-1 gap-2 bg-surface pointer-events-none max-md:p-4 focus:outline-0", styles.className3)}>
          <div data-ditto-id={meta[4]?.anchor} className="flex items-center gap-2 text-sm leading-5 pointer-events-none">
            {d.eyebrow}
          </div>
          <div data-ditto-id={meta[5]?.anchor} className={cn("flex gap-2 pointer-events-none", styles.className4)}>
            <h2 data-ditto-id={meta[6]?.anchor} className="block text-color-003 text-[1.375rem] font-bold leading-7 tracking-[-0.25px] text-balance pointer-events-none" data-component="heading">
              {d.title}
            </h2>
            <span className={cn("w-8 h-8 flex rounded-[100%] justify-center items-center shrink-0 text-background text-xl font-semibold leading-7 tracking-[-0.12px] bg-color-003 pointer-events-none", styles.className5)} aria-hidden="true">
              →
            </span>
          </div>
        </header>
        <ProductCardSlot1 d={d} />
      </div>
    </article>
  );
}

function ProductCardSlot1({ d }: { d: ProductCardData }) {
  switch (d.variant) {
    case "bring-everything-into-one-system-of-record":
      return (
        <div className="flex relative z-1 flex-col justify-start items-center overflow-hidden aspect-[1.33333/1] bg-surface pointer-events-none" data-ditto-id="style-div-138">
          <picture className="w-[33.4375rem] h-[31.9375rem] flex min-w-0 pt-6 px-6 justify-center items-end flex-1 transform-[matrix(1,0,0,1,0,1)] pointer-events-none max-md:w-[21.4375rem] max-md:h-[20.4375rem] max-md:pt-4 max-md:px-4 md:max-lg:w-[40.8125rem] md:max-lg:h-[39.3125rem] 2xl:w-153.5 2xl:h-147.5 focus:outline-0" data-ditto-id="style-picture">
            <source className="h-0 block pointer-events-none" media="(max-width: 839px)" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" srcSet="/assets/capture-rebrand/records.svg 384w, /assets/capture-rebrand/records.svg 640w, /assets/capture-rebrand/records.svg 1080w, /assets/capture-rebrand/records.svg 1200w, /assets/capture-rebrand/records.svg 1920w, /assets/capture-rebrand/records.svg 2048w, /assets/capture-rebrand/records.svg 3840w" />
            <SiteImage className="w-auto h-[30.4375rem] block rounded-tl-xl rounded-tr-xl overflow-clip object-contain aspect-[auto_1980/1980] text-clr-0 shadow-[var(--clr-10)_0px_0.175px_1.041px_0px,var(--clr-10)_0px_0.8px_2.925px_0px,var(--clr-10)_0px_2.025px_7.847px_0px,var(--clr-11)_0px_4px_18px_0px] pointer-events-none max-md:h-[19.4375rem] max-lg:rounded-tl-md max-lg:rounded-tr-md md:max-lg:h-[37.8125rem] 2xl:h-141.5" data-ditto-id="style-5s8e0eu3txevgrfrrwgxhb" data-component="image" alt="" height="1980" id="5s8E0EU3tXEvGrFrRwgxhb" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" src="/assets/capture-rebrand/records.svg" srcSet="/assets/capture-rebrand/records.svg 384w, /assets/capture-rebrand/records.svg 640w, /assets/capture-rebrand/records.svg 1080w, /assets/capture-rebrand/records.svg 1200w, /assets/capture-rebrand/records.svg 1920w, /assets/capture-rebrand/records.svg 2048w, /assets/capture-rebrand/records.svg 3840w" width="1980" />
          </picture>
          <div className="w-[30.45rem] h-[119.5px] block absolute bottom-0 left-[clamp(171.5px,_50%,_calc(100%_-_171.5px))] z-3 min-w-0 transform-[matrix(1,0,0,1,-243.602,0)] pointer-events-none max-md:w-[19.4375rem] max-md:h-[76.3px] max-md:-bottom-1 max-md:transform-[matrix(1,0,0,1,-155.5,0)] md:max-lg:w-[37.8rem] md:max-lg:h-[9.2375rem] md:max-lg:transform-[matrix(1,0,0,1,-302.406,0)] 2xl:w-141.5 2xl:h-[8.675rem] 2xl:transform-[matrix(1,0,0,1,-283,0)] focus:outline-0" data-ditto-id="style-div-25">
            <picture className="w-[30.4375rem] h-30 block pointer-events-none max-md:w-[19.4375rem] max-md:h-19 md:max-lg:w-[37.8125rem] md:max-lg:h-37 2xl:w-141.5 2xl:h-[8.6875rem]" data-ditto-id="style-picture-6">
              <SiteImage className="w-[30.4375rem] h-30 block overflow-clip aspect-[auto_3432/840] text-clr-0 pointer-events-none max-md:w-[19.4375rem] max-md:h-19 md:max-lg:w-[37.8125rem] md:max-lg:h-37 2xl:w-141.5 2xl:h-[8.6875rem]" data-ditto-id="style-5bqhi7eapc7aeatuutvtuh" data-component="image" alt="" height="840" id="5bqhI7eaPc7AeAtuuTvtuh" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" src="/assets/capture-rebrand/inbox.svg" srcSet="/assets/capture-rebrand/inbox.svg 384w, /assets/capture-rebrand/inbox.svg 640w, /assets/capture-rebrand/inbox.svg 1080w, /assets/capture-rebrand/inbox.svg 1200w, /assets/capture-rebrand/inbox.svg 1920w, /assets/capture-rebrand/inbox.svg 2048w, /assets/capture-rebrand/inbox.svg 3840w" width="3432" />
            </picture>
          </div>
          <div className="w-[25.0875rem] h-[3.1375rem] block absolute bottom-6 left-[clamp(171.5px,_50%,_calc(100%_-_171.5px))] z-3 min-w-0 [filter:drop-shadow(var(--clr-10)_0px_0.175px_1.041px)_drop-shadow(var(--clr-10)_0px_0.8px_2.925px)_drop-shadow(var(--clr-10)_0px_2.025px_7.847px)_drop-shadow(var(--clr-11)_0px_4px_18px)] transform-[matrix(1,0,0,1,-200.695,0)] pointer-events-none max-md:w-[257.3px] max-md:h-8 max-md:bottom-5 max-md:transform-[matrix(1,0,0,1,-128.625,0)] md:max-lg:w-[30.6rem] md:max-lg:h-[3.825rem] md:max-lg:transform-[matrix(1,0,0,1,-244.805,0)] 2xl:w-[460.5px] 2xl:h-[3.6rem] 2xl:transform-[matrix(1,0,0,1,-230.25,0)]">
            <picture className="w-[25.0625rem] h-12.5 block pointer-events-none max-md:w-[16.0625rem] max-md:h-8 md:max-lg:w-122.5 md:max-lg:h-[3.8125rem] 2xl:w-[28.8125rem] 2xl:h-14.5" data-ditto-id="style-picture-7">
              <SiteImage className="w-[25.0625rem] h-12.5 block overflow-clip aspect-[auto_2880/360] text-clr-0 pointer-events-none max-md:w-[16.0625rem] max-md:h-8 md:max-lg:w-122.5 md:max-lg:h-[3.8125rem] 2xl:w-[28.8125rem] 2xl:h-14.5" data-component="image" alt="" height="360" id="3wptjGyp47YX2bFx2LikSS" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" src="/assets/capture-rebrand/team.svg" srcSet="/assets/capture-rebrand/team.svg 384w, /assets/capture-rebrand/team.svg 640w, /assets/capture-rebrand/team.svg 1080w, /assets/capture-rebrand/team.svg 1200w, /assets/capture-rebrand/team.svg 1920w, /assets/capture-rebrand/team.svg 2048w, /assets/capture-rebrand/team.svg 3840w" width="2880" />
            </picture>
          </div>
        </div>
      );
    case "get-answers-instantly-with-citations":
      return (
        <div className="flex relative z-1 flex-col justify-start items-center overflow-hidden aspect-[1.33333/1] bg-surface pointer-events-none" data-ditto-id="style-div-91">
          <picture className="w-[33.4375rem] h-[31.9375rem] flex min-w-0 pt-6 px-6 justify-center items-end flex-1 transform-[matrix(1,0,0,1,0,1)] pointer-events-none max-md:w-[21.4375rem] max-md:h-[20.4375rem] max-md:pt-4 max-md:px-4 md:max-lg:w-[40.8125rem] md:max-lg:h-[39.3125rem] 2xl:w-153.5 2xl:h-147.5 focus:outline-0" data-ditto-id="style-picture-2">
            <source className="h-0 block pointer-events-none" data-ditto-id="style-source" media="(max-width: 839px)" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" srcSet="/assets/capture-rebrand/appointments.svg 384w, /assets/capture-rebrand/appointments.svg 640w, /assets/capture-rebrand/appointments.svg 1080w, /assets/capture-rebrand/appointments.svg 1200w, /assets/capture-rebrand/appointments.svg 1920w, /assets/capture-rebrand/appointments.svg 2048w, /assets/capture-rebrand/appointments.svg 3840w" />
            <SiteImage className="w-auto h-[30.4375rem] block rounded-tl-xl rounded-tr-xl overflow-clip object-contain aspect-[auto_1980/1980] text-clr-0 shadow-[var(--clr-10)_0px_0.175px_1.041px_0px,var(--clr-10)_0px_0.8px_2.925px_0px,var(--clr-10)_0px_2.025px_7.847px_0px,var(--clr-11)_0px_4px_18px_0px] pointer-events-none max-md:h-[19.4375rem] max-lg:rounded-tl-md max-lg:rounded-tr-md md:max-lg:h-[37.8125rem] 2xl:h-141.5" data-ditto-id="style-1foyxgfzha9kka1bvpqa4m" data-component="image" alt="" height="1980" id="1FOyxGfzHA9kKA1BVPQa4m" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" src="/assets/capture-rebrand/appointments.svg" srcSet="/assets/capture-rebrand/appointments.svg 384w, /assets/capture-rebrand/appointments.svg 640w, /assets/capture-rebrand/appointments.svg 1080w, /assets/capture-rebrand/appointments.svg 1200w, /assets/capture-rebrand/appointments.svg 1920w, /assets/capture-rebrand/appointments.svg 2048w, /assets/capture-rebrand/appointments.svg 3840w" width="1980" />
          </picture>
          <div className="w-[33.45rem] h-[278.5px] block absolute -bottom-2 left-[clamp(171.5px,_50%,_calc(100%_-_171.5px))] z-3 min-w-0 [filter:drop-shadow(var(--clr-10)_0px_0.175px_1.041px)_drop-shadow(var(--clr-10)_0px_0.8px_2.925px)_drop-shadow(var(--clr-10)_0px_2.025px_7.847px)_drop-shadow(var(--clr-11)_0px_4px_18px)] transform-[matrix(1,0,0,1,-267.602,0)] pointer-events-none max-md:w-[21.4375rem] max-md:h-[178.5px] max-md:-bottom-3 max-md:transform-[matrix(1,0,0,1,-171.5,0)] md:max-lg:w-[40.8rem] md:max-lg:h-[339.7px] md:max-lg:transform-[matrix(1,0,0,1,-326.406,0)] 2xl:w-153.5 2xl:h-[319.5px] 2xl:transform-[matrix(1,0,0,1,-307,0)] focus:outline-0" data-ditto-id="style-div-26">
            <picture className="w-[33.4375rem] h-69.5 block pointer-events-none max-md:w-[21.4375rem] max-md:h-44.5 md:max-lg:w-[40.8125rem] md:max-lg:h-85 2xl:w-153.5 2xl:h-[19.9375rem]">
              <SiteImage className="w-[33.4375rem] h-69.5 block overflow-clip aspect-[auto_3720/1935] text-clr-0 pointer-events-none max-md:w-[21.4375rem] max-md:h-44.5 md:max-lg:w-[40.8125rem] md:max-lg:h-85 2xl:w-153.5 2xl:h-[19.9375rem]" data-component="image" alt="" height="1935" id="3PH2HDqwPQKa0Xtq1EzIHs" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" src="/assets/capture-rebrand/records.svg" srcSet="/assets/capture-rebrand/records.svg 384w, /assets/capture-rebrand/records.svg 640w, /assets/capture-rebrand/records.svg 1080w, /assets/capture-rebrand/records.svg 1200w, /assets/capture-rebrand/records.svg 1920w, /assets/capture-rebrand/records.svg 2048w, /assets/capture-rebrand/records.svg 3840w" width="3720" />
            </picture>
          </div>
          <div className="w-[25.0875rem] h-[3.1375rem] block absolute bottom-6 left-[clamp(171.5px,_50%,_calc(100%_-_171.5px))] z-3 min-w-0 [filter:drop-shadow(var(--clr-10)_0px_0.175px_1.041px)_drop-shadow(var(--clr-10)_0px_0.8px_2.925px)_drop-shadow(var(--clr-10)_0px_2.025px_7.847px)_drop-shadow(var(--clr-11)_0px_4px_18px)] transform-[matrix(1,0,0,1,-200.695,0)] pointer-events-none max-md:w-[257.3px] max-md:h-8 max-md:bottom-5 max-md:transform-[matrix(1,0,0,1,-128.625,0)] md:max-lg:w-[30.6rem] md:max-lg:h-[3.825rem] md:max-lg:transform-[matrix(1,0,0,1,-244.805,0)] 2xl:w-[460.5px] 2xl:h-[3.6rem] 2xl:transform-[matrix(1,0,0,1,-230.25,0)]" data-ditto-id="style-div-54">
            <picture className="w-[25.0625rem] h-12.5 block pointer-events-none max-md:w-[16.0625rem] max-md:h-8 md:max-lg:w-122.5 md:max-lg:h-[3.8125rem] 2xl:w-[28.8125rem] 2xl:h-14.5" data-ditto-id="style-picture-3">
              <SiteImage className="w-[25.0625rem] h-12.5 block overflow-clip aspect-[auto_2880/360] text-clr-0 pointer-events-none max-md:w-[16.0625rem] max-md:h-8 md:max-lg:w-122.5 md:max-lg:h-[3.8125rem] 2xl:w-[28.8125rem] 2xl:h-14.5" data-ditto-id="style-4mw82wfspwlqm8p3sfchgp" data-component="image" alt="" height="360" id="4mw82WFsPwlqM8p3SFChGp" sizes="(min-width: 1464px) 614px, (min-width: 840px) 42vw, (min-width: 600px) 86vw, (min-width: 400px) calc(100vw - 64px), calc(100vw - 32px)" src="/assets/capture-rebrand/inbox.svg" srcSet="/assets/capture-rebrand/inbox.svg 384w, /assets/capture-rebrand/inbox.svg 640w, /assets/capture-rebrand/inbox.svg 1080w, /assets/capture-rebrand/inbox.svg 1200w, /assets/capture-rebrand/inbox.svg 1920w, /assets/capture-rebrand/inbox.svg 2048w, /assets/capture-rebrand/inbox.svg 3840w" width="2880" />
            </picture>
          </div>
        </div>
      );
    case "keep-work-moving-24-7-with-agents":
      return (
        <div className="flex relative z-1 flex-col justify-start items-center flex-1 overflow-hidden aspect-[2/1] bg-surface pointer-events-none max-lg:aspect-[1.33333/1] max-lg:grow-[initial] max-lg:basis-[initial]" data-ditto-id="style-div-61">
          <picture className="w-[20.4375rem] h-[17.0625rem] flex absolute top-6 right-0 z-2 min-w-0 rounded-tl-xl justify-end items-end shrink-0 overflow-hidden shadow-[var(--clr-10)_0px_0.175px_1.041px_0px,var(--clr-10)_0px_0.8px_2.925px_0px,var(--clr-10)_0px_2.025px_7.847px_0px,var(--clr-11)_0px_4px_18px_0px] transform-[matrix(1,0,0,1,0,1)] pointer-events-none max-md:w-[11.8125rem] max-md:h-[15.0625rem] max-md:border-t-[3px] max-lg:border-solid max-lg:border-t-color-003 max-md:border-r-[3px] max-lg:border-r-color-003 max-md:border-l-[3px] max-lg:border-l-color-003 max-md:top-4 max-md:mr-4 max-md:rounded-tl-[11.3px] max-md:rounded-tr-[11.3px] md:max-lg:w-[22.4375rem] md:max-lg:h-116.5 md:max-lg:border-t-[7px] md:max-lg:border-r-[7px] md:max-lg:border-l-[7px] md:max-lg:mr-6 md:max-lg:rounded-tl-[23px] md:max-lg:rounded-tr-[23px] 2xl:w-103.5 2xl:h-88">
            <source className="h-0 block pointer-events-none" data-ditto-id="style-source-4" media="(max-width: 839px)" sizes="(min-width: 1464px) 410px, (min-width: 840px) 28vw, 50vw" srcSet="/assets/capture-rebrand/team.svg 256w, /assets/capture-rebrand/team.svg 384w, /assets/capture-rebrand/team.svg 640w, /assets/capture-rebrand/team.svg 1080w, /assets/capture-rebrand/team.svg 1200w, /assets/capture-rebrand/team.svg 1920w, /assets/capture-rebrand/team.svg 2048w, /assets/capture-rebrand/team.svg 3840w" />
            <SiteImage className="w-auto h-[17.0625rem] block overflow-clip object-cover object-[0%_0%] aspect-[auto_1980/1980] text-clr-0 pointer-events-none max-md:h-59.5 md:max-lg:h-[28.6875rem] 2xl:h-88" data-ditto-id="style-5cesadhalt60bvmkttrfd9" data-component="image" alt="" height="1980" id="5CESaDHalT60BVMktTrFD9" sizes="(min-width: 1464px) 410px, (min-width: 840px) 28vw, 50vw" src="/assets/capture-rebrand/team.svg" srcSet="/assets/capture-rebrand/team.svg 256w, /assets/capture-rebrand/team.svg 384w, /assets/capture-rebrand/team.svg 640w, /assets/capture-rebrand/team.svg 1080w, /assets/capture-rebrand/team.svg 1200w, /assets/capture-rebrand/team.svg 1920w, /assets/capture-rebrand/team.svg 2048w, /assets/capture-rebrand/team.svg 3840w" width="1980" />
          </picture>
          <picture className="w-[20.4375rem] h-[12.5625rem] flex absolute top-24 left-6 z-1 min-w-0 rounded-tl-xl justify-center items-end shrink-0 overflow-hidden shadow-[var(--clr-10)_0px_0.175px_1.041px_0px,var(--clr-10)_0px_0.8px_2.925px_0px,var(--clr-10)_0px_2.025px_7.847px_0px,var(--clr-11)_0px_4px_18px_0px] transform-[matrix(1,0,0,1,0,1)] pointer-events-none max-md:w-[11.8125rem] max-md:h-[12.0625rem] max-md:border-t-[3px] max-lg:border-solid max-lg:border-t-color-003 max-md:border-r-[3px] max-lg:border-r-color-003 max-md:border-l-[3px] max-lg:border-l-color-003 max-md:top-16 max-md:left-4 max-md:rounded-tl-[11.3px] max-md:rounded-tr-[11.3px] md:max-lg:w-[22.4375rem] md:max-lg:h-98.5 md:max-lg:border-t-[7px] md:max-lg:border-r-[7px] md:max-lg:border-l-[7px] md:max-lg:rounded-tl-[23px] md:max-lg:rounded-tr-[23px] 2xl:w-103.5 2xl:h-70" data-ditto-id="style-picture-8">
            <source className="h-0 block pointer-events-none" media="(max-width: 839px)" sizes="(min-width: 1464px) 410px, (min-width: 840px) 28vw, 50vw" srcSet="/assets/capture-rebrand/appointments.svg 256w, /assets/capture-rebrand/appointments.svg 384w, /assets/capture-rebrand/appointments.svg 640w, /assets/capture-rebrand/appointments.svg 1080w, /assets/capture-rebrand/appointments.svg 1200w, /assets/capture-rebrand/appointments.svg 1920w, /assets/capture-rebrand/appointments.svg 2048w, /assets/capture-rebrand/appointments.svg 3840w" />
            <SiteImage className="w-auto h-[12.5625rem] block overflow-clip object-cover object-[0%_0%] aspect-[auto_1980/1980] text-clr-0 pointer-events-none max-md:h-47.5 md:max-lg:h-[24.1875rem] 2xl:h-70" data-ditto-id="style-4u19ko5gm7rysja4xr2ogf" data-component="image" alt="" height="1980" id="4U19kO5gM7RYsJa4Xr2oGF" sizes="(min-width: 1464px) 410px, (min-width: 840px) 28vw, 50vw" src="/assets/capture-rebrand/appointments.svg" srcSet="/assets/capture-rebrand/appointments.svg 256w, /assets/capture-rebrand/appointments.svg 384w, /assets/capture-rebrand/appointments.svg 640w, /assets/capture-rebrand/appointments.svg 1080w, /assets/capture-rebrand/appointments.svg 1200w, /assets/capture-rebrand/appointments.svg 1920w, /assets/capture-rebrand/appointments.svg 2048w, /assets/capture-rebrand/appointments.svg 3840w" width="1980" />
          </picture>
        </div>
      );
    default:
      return null;
  }
}

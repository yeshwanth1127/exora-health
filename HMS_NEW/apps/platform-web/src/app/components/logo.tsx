import type { DittoNodeMetaMap } from "../ditto-meta";
import type { LogoStyles } from "../_styles";
import { cn } from "../../lib/utils";
export type LogoData = {
  ariaLabel: string;
  style: import("react").CSSProperties;
  imgSrc: string;
  ariahidden?: import("react").AriaAttributes["aria-hidden"];
};
/** A logo. */
export default function Logo({ d, meta, styles }: { d: LogoData; meta: DittoNodeMetaMap; styles: LogoStyles }) {
  return (
    <span className={cn("border border-solid border-clr-0 flex relative -right-15.5 left-15.5 max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 font-medium bg-clr-0 pointer-events-none max-lg:[animation-name:logoWallMarquee-module-scss-module\\_\\_4H5qWW\\_\\_marqueePolygon] max-lg:[animation-duration:115s] max-lg:[animation-timing-function:linear] max-lg:[animation-iteration-count:infinite] max-lg:[animation-direction:reverse] max-lg:static max-lg:inset-auto max-lg:[grid-row-start:initial]", styles.className)} aria-hidden={d.ariahidden}>
      <span data-ditto-id={meta[1]?.anchor} className={cn("grid min-w-0 max-w-full items-center shrink-0 justify-items-center text-color-004 leading-0 pointer-events-none grid-cols-[minmax(0,_1fr)]", styles.className2)} aria-label={d.imgSrc.split("/").pop()?.replace(".svg", "").replaceAll("-", " ")} role="img">
        <span data-ditto-id={meta[2]?.anchor} className={cn("grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-[minmax(0,_1fr)]", styles.className3)} aria-hidden="true">
          <img data-ditto-id={meta[3]?.anchor} className={cn("h-6 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_96/24] bg-color-004 pointer-events-none", styles.className4)} style={d.style} data-component="image" alt="" height="24" src={d.imgSrc} width="96" />
        </span>
      </span>
    </span>
  );
}

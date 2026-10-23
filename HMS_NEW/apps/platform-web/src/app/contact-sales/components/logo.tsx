import SiteImage from "../../components/site-image";
import type { DittoNodeMetaMap } from "../ditto-meta";
import type { LogoStyles } from "../_styles";
import { cn } from "../../../lib/utils";
export type LogoData = {
  ariaLabel: string;
  style: import("react").CSSProperties;
  imgSrc: string;
};
/** A logo. */
export default function Logo({ d, meta, styles }: { d: LogoData; meta: DittoNodeMetaMap; styles: LogoStyles }) {
  return (
    <span className="w-full border border-solid border-clr-0 flex max-w-29 py-1.5 px-[0.9375rem] rounded-lg justify-center items-center shrink-0 gap-3 font-medium text-center bg-clr-0 pointer-events-none">
      <span data-ditto-id={meta[1]?.anchor} className={cn("w-20 grid min-w-0 max-w-full items-center shrink-0 justify-items-center text-color-004 leading-0 pointer-events-none", styles.className)} aria-label={d.ariaLabel} role="img">
        <span data-ditto-id={meta[2]?.anchor} className={cn("grid max-w-21 items-center justify-items-center pointer-events-none grid-cols-1", styles.className2)} aria-hidden="true">
          <SiteImage data-ditto-id={meta[3]?.anchor} className={cn("h-5 block max-w-full overflow-clip object-none object-[9999px_9999px] aspect-[auto_80/20] bg-color-004 pointer-events-none", styles.className3)} style={d.style} data-component="image" alt="" height="20" src={d.imgSrc} width="80" />
        </span>
      </span>
    </span>
  );
}

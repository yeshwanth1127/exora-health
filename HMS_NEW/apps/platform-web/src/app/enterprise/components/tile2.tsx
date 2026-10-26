import type { Tile2Styles } from "../_styles";
import { cn } from "../../../lib/utils";
export type Tile2Data = {
  ariadescribedby: string;
  arialabelledby: string;
  id: string;
  id2: string;
  description: string;
  description2: string;
};
/** A content tile. */
export default function Tile2({ d, styles }: { d: Tile2Data; styles: Tile2Styles }) {
  return (
    <div className="contents min-w-0 bg-background">
      <div className={cn("border-2 border-solid flex relative min-w-48 pt-4 pb-3 px-4 rounded-xl flex-col max-lg:rounded-lg", styles.className)} aria-describedby={d.ariadescribedby} aria-labelledby={d.arialabelledby} id={d.id} role="group">
        <div className="flex flex-col items-start content-center gap-2 max-lg:items-center max-lg:gap-1 max-lg:[flex-direction:initial]">
          <div className={cn("block text-lg font-semibold leading-7 tracking-[-0.12px] max-lg:text-sm max-lg:leading-5 max-lg:tracking-[inherit]", styles.className2)} id={d.id2}>
            <p className="block">
              {d.description}
            </p>
          </div>
        </div>
        <div className="w-52 flex pt-1 flex-col justify-between grow shrink-0 text-sm leading-5 text-balance max-lg:w-39">
          <div className="block">
            <p className="block">
              {d.description2}
            </p>
          </div>
        </div>
        <div className={cn("w-60 h-full block absolute top-0 left-0 min-w-0 rounded-xl", styles.className3)} />
      </div>
    </div>
  );
}

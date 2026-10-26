import type { MediaTileStyles } from "../_styles";
import { cn } from "../lib/utils";
export type MediaTileData = {
  ariacontrols: string;
  label: string;
};
/** A media tile. */
export default function MediaTile({ d, styles }: { d: MediaTileData; styles: MediaTileStyles }) {
  return (
    <li className={cn("flow-2", styles.className)}>
      <button className={cn("row-16", styles.className2)} data-component="button" aria-controls={d.ariacontrols} aria-expanded="false" type="button">
        <span className="text-9 flow-2 type-16">
          {d.label}
        </span>
        <span className="text-10 row-17 type-7" aria-hidden="true">
          <svg className="icon-4 flow-4" data-component="icon" aria-hidden="true" height="24" viewBox="0 0 20 20" width="24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M10 13.09 5.289 8.378l.878-.878L10 11.333 13.833 7.5l.878.878z" />
          </svg>
        </span>
      </button>
    </li>
  );
}

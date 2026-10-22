import type { Tile6Styles } from "../_styles";
import { cn } from "../../../lib/utils";
export type Tile6Data = {
  description: string;
};
/** A content tile. */
export default function Tile6({ d, styles }: { d: Tile6Data; styles: Tile6Styles }) {
  return (
    <div className="block">
      <p className={cn("block", styles.className)}>
        {d.description}
      </p>
    </div>
  );
}

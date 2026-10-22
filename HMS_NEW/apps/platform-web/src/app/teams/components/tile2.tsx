import type { ReactNode } from "react";
export type Tile2Data = {
  icon: ReactNode;
};
/** A content tile. */
export default function Tile2({ d }: { d: Tile2Data }) {
  return (
    <svg className="w-auto h-4 block shrink-0 overflow-hidden" data-component="icon" aria-hidden="true" role="graphics-symbol" viewBox="0 0 20 20" fill="currentColor">{d.icon}</svg>
  );
}

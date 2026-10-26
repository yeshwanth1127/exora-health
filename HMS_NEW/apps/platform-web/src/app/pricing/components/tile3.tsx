export type Tile3Data = Record<string, never>;
/** A content tile. */
export default function Tile3({ d }: { d: Tile3Data }) {
  return (
    <div className="block min-w-0 px-4 [overflow-wrap:anywhere]">
      <span className="inline text-[0.9375rem] leading-5 [font-feature-settings:normal]">
        Unlimited
      </span>
    </div>
  );
}

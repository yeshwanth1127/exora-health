export type Tile5Data = Record<string, never>;
/** A content tile. */
export default function Tile5({ d }: { d: Tile5Data }) {
  return (
    <div className="block min-w-0 px-4 [overflow-wrap:anywhere]">
      <span className="inline text-[0.9375rem] leading-5 [font-feature-settings:normal]">
        Pay per domain
      </span>
    </div>
  );
}

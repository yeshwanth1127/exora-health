export type Tile4Data = {
  text: string;
};
/** A content tile. */
export default function Tile4({ d }: { d: Tile4Data }) {
  return (
    <div className="block min-w-0 px-4 [overflow-wrap:anywhere]">
      <span className="inline text-[0.9375rem] leading-5 [font-feature-settings:normal]">
        {d.text}
      </span>
    </div>
  );
}

export type Tile2Data = {
  text: string;
  text2: string;
  href: string;
  label: string;
};
/** A content tile. */
export default function Tile2({ d }: { d: Tile2Data }) {
  return (
    <div className="grid relative min-w-0 pt-2.5 pl-4 grid-rows-subgrid row-span-full [overflow-wrap:anywhere] bg-background grid-cols-1">
      <span className="block text-[0.9375rem] font-semibold leading-5 [font-feature-settings:normal]">
        {d.text}
      </span>
      <span className="block text-color-002 text-xs font-medium leading-4 tracking-[0.13px] [font-feature-settings:normal]">
        <span className="inline">
          {d.text2}
        </span>
        {" "}
        <span className="h-full inline text-muted">
          {" per seat/month"}
        </span>
      </span>
      <a className="h-7.5 min-h-7.5 border border-solid border-clr-0 flex mt-2 py-1 px-[0.6875rem] rounded-lg justify-center items-center text-background text-sm font-medium leading-5 text-center [font-feature-settings:normal] bg-primary cursor-pointer md:max-lg:h-12.5" data-component="button" href={d.href}>
        {d.label}
      </a>
    </div>
  );
}

export type MediaTile3Data = {
  text: string;
};
/** A media tile. */
export default function MediaTile3({ d }: { d: MediaTile3Data }) {
  return (
    <div className="border-t border-solid border-t-color-003 grid py-2.5 [grid-auto-rows:min-content] grid-cols-[2fr_1fr_1fr_1fr_1fr]">
      <div className="grid min-w-0 [overflow-wrap:anywhere] grid-cols-1">
        <div className="block cursor-help md:max-lg:[cursor:inherit]">
          <span className="inline text-[0.9375rem] font-semibold leading-5 underline [text-decoration-style:dotted] [font-feature-settings:normal]">
            {d.text}
          </span>
        </div>
      </div>
      <div className="block min-w-0 px-4 [overflow-wrap:anywhere]" />
      <div className="block min-w-0 px-4 [overflow-wrap:anywhere]" />
      <div className="block min-w-0 px-4 [overflow-wrap:anywhere]" />
      <div className="block min-w-0 px-4 [overflow-wrap:anywhere]">
        <span className="inline text-[0.9375rem] leading-5 [font-feature-settings:normal]">
          <svg className="w-auto h-4.5 inline overflow-hidden align-middle text-foreground" data-component="icon" viewBox="0 0 20 20" width="1em" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="m17.5 5.7-9.375 9.375L2.5 9.45l1.325-1.325 4.3 4.3 8.05-8.05z" fill="currentColor" />
          </svg>
        </span>
      </div>
    </div>
  );
}

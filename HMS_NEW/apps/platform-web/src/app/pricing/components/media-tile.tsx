import type { DittoNodeMetaMap } from "../ditto-meta";
export type MediaTileData = {
  text: string;
};
/** A media tile. */
export default function MediaTile({ d, meta }: { d: MediaTileData; meta: DittoNodeMetaMap }) {
  return (
    <li data-ditto-id={meta[0]?.anchor} className="list-item mb-2 text-sm leading-5">
      <div data-ditto-id={meta[1]?.anchor} className="block cursor-help max-lg:[cursor:inherit]">
        <span data-ditto-id={meta[2]?.anchor} className="flex items-start gap-2">
          <span className="flex mt-[0.0875rem]">
            <svg className="w-auto h-[1.0625rem] block overflow-hidden align-middle" data-component="icon" viewBox="0 0 20 20" width="1em" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="m17.5 5.7-9.375 9.375L2.5 9.45l1.325-1.325 4.3 4.3 8.05-8.05z" fill="currentColor" />
            </svg>
          </span>
          <span className="block">
            <span className="inline mr-1">
              {d.text}
            </span>
          </span>
        </span>
      </div>
    </li>
  );
}

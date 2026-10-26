export type Logo2Data = Record<string, never>;
/** A logo. */
export default function Logo2({ d }: { d: Logo2Data }) {
  return (
    <div className="block min-w-0 px-4 [overflow-wrap:anywhere]">
      <span className="inline text-[0.9375rem] leading-5 [font-feature-settings:normal]">
        <svg className="w-auto h-4.5 inline overflow-hidden align-middle text-foreground" data-component="icon" viewBox="0 0 20 20" width="1em" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path d="m17.5 5.7-9.375 9.375L2.5 9.45l1.325-1.325 4.3 4.3 8.05-8.05z" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}

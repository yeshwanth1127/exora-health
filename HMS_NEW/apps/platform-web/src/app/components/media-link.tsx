import CaptureArtwork from "../CaptureArtwork";
import type { DittoNodeMetaMap } from "../ditto-meta";
import type { MediaLinkStyles } from "../_styles";
export type MediaLinkData = {
  ariaLabel: string;
  href: string;
  alt: string;
  imgSrc: string;
  srcSet: string;
  alt2: string;
  height: string;
  imgSrc2: string;
  width: string;
  text: string;
  label: string;
  label2: string;
};
/** Illustrative workflow card; each scene part is a separate PNG. */
export default function MediaLink({ d, meta }: { d: MediaLinkData; meta: DittoNodeMetaMap; styles: MediaLinkStyles }) {
  const parts = d.label === "Reception" ? ["home-portrait-b", "product-next-step"] : d.label === "Care teams" ? ["home-portrait-a", "product-team", "home-portrait-b"] : ["home-portrait-a", "product-records"];
  const object = d.label === "Reception" ? "product-next-step" : d.label === "Care teams" ? "product-team" : "product-records";
  return <a data-capture-scenario="true" data-ditto-id={meta[0]?.anchor} className="capture-scenario-card" aria-label={d.ariaLabel} href={d.href}>
    <div className="capture-scenario-art"><CaptureArtwork people={parts} objects={[object]} label={`${d.label} workflow illustration`} /></div>
    <div className="capture-scenario-copy"><p>{d.text}</p><span>{d.label} · {d.label2}</span></div>
  </a>;
}

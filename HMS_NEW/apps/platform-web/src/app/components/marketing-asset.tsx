import { brandContent } from "../../lib/brand";
import panels from "./claude-asset-data.json";
import AssetFrame from "./asset-frame";
import "./marketing-asset.css";
export default function MarketingAsset({name}:{name:keyof typeof panels}) {
 const panel=brandContent(panels[name]);
 return <figure className="marketing-asset" data-marketing-asset={name}><div role="img" aria-label={`${panel.label}`}><AssetFrame width={panel.width} height={panel.height}><div dangerouslySetInnerHTML={{__html:panel.html}} /></AssetFrame></div></figure>;
}

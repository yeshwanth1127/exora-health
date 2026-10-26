import MarketingAsset from "./marketing-asset";
import QueueStory from "./queue-story";

export default function HomeFeatureVisual({ kind }: { kind: "records" | "search" | "workflow" }) {
  if(kind === "records") return <MarketingAsset name="2a" />;
  if(kind === "search") return <MarketingAsset name="2b" />;
  return <QueueStory />;
}

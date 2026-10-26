import { useWebsite } from "../ui/Runtime";
import { PathwayHome } from "./layouts/PathwayHome";
import { AtlasHome } from "./layouts/AtlasHome";
import { GroveHome } from "./layouts/GroveHome";
/** Templates compose the shared sections; clinical and booking behavior is never copied. */
export function TemplateHome() {
  const { template } = useWebsite();
  switch (template) {
    case "hospital-pathway":
      return <PathwayHome />;
    case "hospital-atlas":
      return <AtlasHome />;
    case "hospital-grove":
      return <GroveHome />;
    default:
      return null;
  }
}

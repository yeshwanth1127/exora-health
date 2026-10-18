import { Skeleton } from "./arc/skeleton/skeleton";
export function WorkspaceLoading() {
  return <div className="arc-demo-scope" aria-label="Loading workspace"><Skeleton lines={5} label="Loading workspace" /></div>;
}

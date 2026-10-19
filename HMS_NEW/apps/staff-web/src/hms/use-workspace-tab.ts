import { useWorkspace } from "./hooks";
import {
  selectedWorkspaceTab,
  workspaceTabRoute,
  type RoutedWorkspace,
  type WorkspaceTab,
} from "./workspace-navigation";
/** Use the existing router so sidebar, tabs, Back/Forward and dirty-form decisions agree. */
export function useWorkspaceTab<W extends RoutedWorkspace>(workspace: W) {
  const { go } = useWorkspace();
  return [
    selectedWorkspaceTab(workspace, location.search),
    (tab: WorkspaceTab<W>, extra?: Record<string, string>) =>
      go(workspaceTabRoute(workspace, tab, extra)),
  ] as const;
}

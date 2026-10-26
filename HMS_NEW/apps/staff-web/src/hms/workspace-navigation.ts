/** Stable subpage destinations shared by the Arc sidebar, tabs and command search. */
export const workspaceTabs = {
  whatsapp: [
    ["overview", "Overview"],
    ["inbox", "Inbox"],
    ["automations", "Automations"],
    ["promotions", "Promotions"],
    ["log", "Message log"],
    ["settings", "Settings"],
  ],
  google_business: [
    ["overview", "Overview"],
    ["profile", "Profile"],
    ["reviews", "Reviews"],
    ["posts", "Posts"],
    ["photos", "Photos"],
    ["insights", "Insights"],
  ],
  growth_analytics: [
    ["overview", "Overview"],
    ["websites", "Websites"],
    ["settings", "Settings"],
  ],
  loyalty: [
    ["programs", "Programs"],
    ["members", "Members"],
    ["patient", "Patient view"],
  ],
  voice: [
    ["history", "Call history"],
    ["setup", "Call setup"],
  ],
  apple_messages: [
    ["conversations", "Conversations"],
    ["setup", "Setup"],
  ],
} as const;
export type RoutedWorkspace = keyof typeof workspaceTabs;
export type WorkspaceTab<W extends RoutedWorkspace> =
  (typeof workspaceTabs)[W][number][0];
export function isRoutedWorkspace(page: string): page is RoutedWorkspace {
  return Object.hasOwn(workspaceTabs, page);
}
export function selectedWorkspaceTab<W extends RoutedWorkspace>(
  workspace: W,
  search: string,
): WorkspaceTab<W> {
  const selected = new URLSearchParams(search).get("tab");
  return (workspaceTabs[workspace].find(([id]) => id === selected)?.[0] ??
    workspaceTabs[workspace][0][0]) as WorkspaceTab<W>;
}
export function workspaceTabRoute<W extends RoutedWorkspace>(
  workspace: W,
  tab: WorkspaceTab<W>,
  extra: Record<string, string> = {},
): string {
  const query = new URLSearchParams(extra);
  query.set("tab", tab);
  return `${workspace}?${query}`;
}
export function workspaceActiveRoute(page: string, search: string): string {
  return isRoutedWorkspace(page)
    ? workspaceTabRoute(page, selectedWorkspaceTab(page, search))
    : page === "operations"
      ? "activity"
      : page;
}
export function workspaceChildren(
  page: string,
): { id: string; label: string }[] | undefined {
  if (page === "appointments")
    return [
      { id: "appointments", label: "All appointments" },
      { id: "waitlist", label: "Waitlist" },
      { id: "queue", label: "Queue" },
    ];
  return isRoutedWorkspace(page)
    ? workspaceTabs[page].map(([tab, label]) => ({
        id: workspaceTabRoute(page, tab),
        label,
      }))
    : undefined;
}

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Only render after the relevant authorized read succeeds. An absent response is not empty. */
export function WorkspaceEmpty({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}) {
  return <div className="arc-demo-scope">
    <EmptyState title={title} description="" icon={<Search size={20} aria-hidden="true" />} action={action ? <Button variant="outline" onClick={action.onClick}>{action.label}</Button> : undefined} />
    {children}
  </div>;
}

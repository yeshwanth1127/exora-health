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
  return (
    <div className="px-6 py-10 text-center space-y-3">
      <h3 className="font-medium text-foreground">{title}</h3>
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

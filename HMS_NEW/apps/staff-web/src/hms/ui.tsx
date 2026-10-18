import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/arc/badge/badge";
import { Alert } from "@/components/arc/alert/alert";
import { WorkspaceLoading } from "@/components/WorkspaceLoading";
import { label } from "./model";
import { SharedField, type SharedFieldProps } from "../components/shared-field";
import { loadPresentation } from "../components/form-feedback";
export function ErrorMessage({ text }: { text?: string }) {
  return text ? <div className="arc-demo-scope"><Alert tone="danger" title="Something needs attention" role="alert">{text}</Alert></div> : null;
}
export function Hint({ children }: { children: ReactNode }) {
  return <div className="arc-demo-scope"><Alert tone="info" title="Please note">{children}</Alert></div>;
}
export function Status({ value, text }: { value: string; text?: string }) {
  const tone = ["completed", "finished", "active"].includes(value) ? "success"
    : ["confirmed", "in_progress", "checked_in", "called", "in_service"].includes(value) ? "info"
    : ["no_show", "cancelled", "entered_in_error"].includes(value) ? "danger"
    : ["attention", "invited"].includes(value) ? "warning" : "neutral";
  return <span className="arc-demo-scope"><Badge tone={tone} size="sm">{text ?? label(value)}</Badge></span>;
}
export function Field({
  title,
  label,
  ...props
}: Omit<SharedFieldProps, "label"> & { title?: string; label?: string }) {
  return <SharedField label={label ?? title ?? "Field"} {...props} />;
}
export { WorkspaceChoice as Choice } from "@/components/WorkspaceChoice";
export function LoadingState({
  loading,
  error,
  refresh,
  children,
  data,
  failure,
  lastUpdated,
}: {
  loading: boolean;
  error: string;
  refresh: () => void;
  children: ReactNode;
  data?: unknown;
  failure?: { status?: number; code?: string } | null;
  lastUpdated?: string;
}) {
  const state = loadPresentation({ loading, error, data, failure });
  const failed = (
    <div className="space-y-3 mb-4">
      <ErrorMessage text={error} />
      <Button variant="outline" onClick={refresh}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  );
  if (state === "error") return failed;
  if (state === "loading") return <WorkspaceLoading />;
  if (state === "stale")
    return (
      <>
        {failed}
        <p role="status" className="text-xs text-muted-foreground mb-4">
          Showing previously loaded data
          {lastUpdated ? ` from ${lastUpdated}` : ""}. Actions are unavailable
          until this view reloads.
        </p>
        <fieldset
          disabled
          aria-label="Previously loaded data · actions unavailable"
          className="min-w-0"
        >
          {children}
        </fieldset>
      </>
    );
  return children;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty text-sm text-muted-foreground">{children}</div>;
}

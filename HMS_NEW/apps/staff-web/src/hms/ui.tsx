import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { label } from "./model";
import { SharedField, type SharedFieldProps } from "../components/shared-field";
import { loadPresentation } from "../components/form-feedback";
export function ErrorMessage({ text }: { text?: string }) {
  return text ? (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  ) : null;
}
export function Hint({ children }: { children: ReactNode }) {
  return (
    <Alert>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
export function Status({ value, text }: { value: string; text?: string }) {
  return (
    <Badge
      className={
        ["completed", "finished", "active"].includes(value)
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : [
                "confirmed",
                "in_progress",
                "checked_in",
                "called",
                "in_service",
              ].includes(value)
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : ["no_show", "cancelled", "entered_in_error"].includes(value)
              ? "border-red-200 bg-red-50 text-red-800"
              : ["attention", "invited"].includes(value)
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-slate-100 text-slate-700"
      }
      variant={
        ["in_progress", "checked_in", "called", "in_service"].includes(value)
          ? "default"
          : "secondary"
      }
    >
      {text ?? label(value)}
    </Badge>
  );
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
  if (state === "loading")
    return (
      <div aria-label="Loading" className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
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

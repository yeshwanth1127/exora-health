import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { label } from "./model";
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
export function Status({ value }: { value: string }) {
  return (
    <Badge
      variant={
        ["in_progress", "checked_in", "called", "in_service"].includes(value)
          ? "default"
          : "secondary"
      }
    >
      {label(value)}
    </Badge>
  );
}
export function Field({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{title}</Label>
      {children}
    </div>
  );
}
export function Choice({
  label: title,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger aria-label={title} className="w-full">
        <SelectValue>
          {options.find((o) => o.value === value)?.label ?? title}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function LoadingState({
  loading,
  error,
  refresh,
  children,
}: {
  loading: boolean;
  error: string;
  refresh: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {error && (
        <div className="space-y-3 mb-4">
          <ErrorMessage text={error} />
          <Button variant="outline" onClick={refresh}>
            <RefreshCw />
            Try again
          </Button>
        </div>
      )}
      {loading ? (
        <div aria-label="Loading" className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        children
      )}
    </>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty text-sm text-muted-foreground">{children}</div>;
}

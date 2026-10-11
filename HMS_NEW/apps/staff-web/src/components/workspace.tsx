import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { OriginalResourceContext, isDraft } from "./resource-source";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Writes for original components: through the resource source when one is provided. */
export function useApi() {
  const source = useContext(OriginalResourceContext);
  return useCallback(
    <T,>(path: string, options?: { method?: string; body?: unknown }): Promise<T> =>
      source
        ? source.write
          ? source.write<T>(path, options)
          : Promise.reject(new Error(source.unavailableWrite))
        : api<T>(path, options),
    [source],
  );
}

export type Permissions = {
  role: string;
  allowed: Record<string, boolean>;
  staff: { key: string; label: string; allowed: boolean }[];
};
/** What the signed-in person may change. The server enforces the same rules. */
export function usePermissions() {
  const source = useContext(OriginalResourceContext);
  const r = useResource<Permissions>(
    source ? null : "/api/v1/staff/permissions",
  );
  if (source)
    return {
      ...r,
      data: source.permissions,
      loading: false,
      error: "",
      can: (key: string) => !!source.permissions.allowed[key],
      admin: source.permissions.role === "admin",
    };
  return {
    ...r,
    can: (key: string) => !!r.data?.allowed[key],
    admin: r.data?.role === "admin",
  };
}
export function useResource<T>(path: string | null) {
  const source = useContext(OriginalResourceContext);

  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0),
    [loadedKey, setLoadedKey] = useState("");
  const cacheKey = `${source?.scope ?? "original"}:${path}:${version}`;
  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (source ? source.read<T>(path, controller.signal) : api<T>(path))
      .then((value) => {
        if (alive) {
          setData(value);
          setLoadedKey(cacheKey);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setData(null);
          setLoadedKey(cacheKey);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [path, version, source, cacheKey]);
  return {
    data: path && loadedKey === cacheKey ? data : null,
    error: path && loadedKey === cacheKey ? error : "",
    loading: !!path && (loading || loadedKey !== cacheKey),
    fresh: !!path && loadedKey === cacheKey,
    refresh: useCallback(() => setVersion((v) => v + 1), []),
  };
}
export function Resource({
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
  if (error)
    return (
      <Notice
        title="We couldn’t load this page"
        text={error}
        action={
          <Button variant="outline" onClick={refresh}>
            <RefreshCw />
            Try again
          </Button>
        }
      />
    );
  if (loading)
    return (
      <div aria-label="Loading workspace" className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  return children;
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
export function Field({
  label,
  hint,
  error: suppliedError,
  id,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  children: ReactNode;
}) {
  // Honor native constraints in every shared field, including existing forms.
  const control = Children.toArray(children).find(
    (child) => isValidElement<{ id?: string }>(child) && child.props.id === id,
  );
  let error = suppliedError;
  if (
    !error &&
    isValidElement<{
      type?: string;
      value?: string | number;
      required?: boolean;
      disabled?: boolean;
      readOnly?: boolean;
      minLength?: number;
      min?: string | number;
      max?: string | number;
    }>(control) &&
    !control.props.disabled &&
    !control.props.readOnly
  ) {
    const p = control.props,
      value = String(p.value ?? "");
    if (p.required && !value.trim())
      error = `Enter ${label.toLowerCase()} to continue.`;
    else if (p.minLength && value.length < p.minLength)
      error = `Enter at least ${p.minLength} characters for ${label.toLowerCase()}.`;
    else if (
      p.type === "number" &&
      value &&
      (!Number.isFinite(Number(value)) ||
        (p.min !== undefined && Number(value) < Number(p.min)) ||
        (p.max !== undefined && Number(value) > Number(p.max)))
    )
      error = `Enter ${label.toLowerCase()}${p.min !== undefined ? ` from ${p.min}` : ""}${p.max !== undefined ? ` up to ${p.max}` : ""}.`;
    else if (
      ["date", "datetime-local", "time"].includes(p.type ?? "") &&
      value &&
      ((p.min !== undefined && value < String(p.min)) ||
        (p.max !== undefined && value > String(p.max)))
    )
      error = `Choose ${label.toLowerCase()} within the allowed range.`;
    else if (p.type === "url" && value && !/^https?:\/\/[^\s]+$/.test(value))
      error = "Enter a complete link starting with https:// or http://.";
  }
  return (
    <div className="space-y-2" data-field-error={error ? "true" : undefined}>
      <Label htmlFor={id}>{label}</Label>
      {Children.map(children, (child) =>
        error &&
        isValidElement<{
          id?: string;
          "aria-invalid"?: boolean;
          "aria-describedby"?: string;
        }>(child) &&
        child.props.id === id
          ? cloneElement(child, {
              "aria-invalid": true,
              "aria-describedby": `${id}-error`,
            })
          : child,
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-xs text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
  hint,
  error,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  hint?: string;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  return (
    <Field label={label} id={id} hint={hint} error={error}>
      <Select
        items={options.map(([value, label]) => ({ value, label }))}
        value={value}
        onValueChange={(v) => onChange(String(v ?? ""))}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
export function StateBadge({ value }: { value: string }) {
  const positive = [
    "confirmed",
    "completed",
    "delivered",
    "read",
    "active",
    "approved",
    "enabled",
  ].includes(value.toLowerCase());
  const warning = ["uncertain", "failed", "no_show"].includes(value);
  return (
    <Badge
      variant="secondary"
      className={
        positive
          ? "bg-foreground/5 text-foreground border border-border"
          : warning
            ? "bg-background text-foreground border border-foreground/40"
            : "text-muted-foreground"
      }
    >
      {value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}
    </Badge>
  );
}
export function Notice({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <Alert className="notice">
      <TriangleAlert className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {text}
        {action && <div className="mt-3">{action}</div>}
      </AlertDescription>
    </Alert>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="empty">
        <div className="rounded-full bg-muted p-3">
          <Check className="size-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
export function Action({
  children,
  run,
  success,
  disabled = false,
  variant = "default",
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
  success?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost" | "destructive";
}) {
  const [busy, setBusy] = useState(false);
  const source = useContext(OriginalResourceContext);
  return (
    <Button
      variant={variant}
      disabled={disabled || busy || isDraft(source)}
      title={isDraft(source) ? source!.unavailableWrite : undefined}
      onClick={async () => {
        setBusy(true);
        try {
          await run();
          if (success) toast.success(success);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <LoaderCircle className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
export function TaskLink({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" className="task-link" onClick={onClick}>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground mt-1 whitespace-normal">
          {description}
        </span>
      </span>
      <ArrowRight className="ml-auto shrink-0" />
    </Button>
  );
}

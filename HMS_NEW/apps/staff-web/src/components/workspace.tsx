import {
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
import { SharedField, type SharedFieldProps } from "./shared-field";
import { useFieldContext } from "./field-context";
import {
  loadPresentation,
  describedBy,
  revealInvalidFields,
} from "./form-feedback";

/** Writes for original components: through the resource source when one is provided. */
export function useApi() {
  const source = useContext(OriginalResourceContext);
  return useCallback(
    <T,>(
      path: string,
      options?: { method?: string; body?: unknown },
    ): Promise<T> =>
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
  data,
  failure,
}: {
  loading: boolean;
  error: string;
  refresh: () => void;
  children: ReactNode;
  data?: unknown;
  failure?: { status?: number; code?: string } | null;
}) {
  const state = loadPresentation({ loading, error, data, failure });
  if (state === "error")
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
  if (state === "stale")
    return (
      <>
        <Notice
          title="Refresh failed · showing previously loaded data"
          text={error}
          action={
            <Button variant="outline" onClick={refresh}>
              <RefreshCw />
              Try again
            </Button>
          }
        />
        <fieldset
          disabled
          aria-label="Previously loaded data · actions unavailable"
          className="min-w-0"
        >
          {children}
        </fieldset>
      </>
    );
  if (state === "loading")
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
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}
export function Field(props: SharedFieldProps) {
  return <SharedField {...props} />;
}
export function Choice({
  label,
  value,
  onChange,
  options,
  disabled = false,
  id,
  controlId,
  hint,
  error,
  serverError,
  required,
  touched,
  submitted,
  validationMode,
  "aria-describedby": extraDescription,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  disabled?: boolean;
  id?: string;
  controlId?: string;
  hint?: string;
  error?: string;
  serverError?: string;
  required?: boolean;
  touched?: boolean;
  submitted?: boolean;
  validationMode?: "onBlur" | "always";
  "aria-describedby"?: string;
}) {
  const generated = useId(),
    parent = useFieldContext(),
    control = controlId ?? id ?? parent?.controlId ?? generated;
  const content = (
    <Select
      items={options.map(([value, label]) => ({ value, label }))}
      value={value}
      onValueChange={(v) => onChange(String(v ?? ""))}
      disabled={disabled}
    >
      <SelectTrigger
        id={control}
        className="w-full"
        aria-label={label}
        aria-required={required ?? parent?.required}
        aria-invalid={parent?.invalid || undefined}
        aria-describedby={describedBy(
          extraDescription,
          parent?.descriptionId,
          parent?.errorId,
        )}
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
  );
  return parent?.controlId === control ? (
    content
  ) : (
    <Field
      label={label}
      id={control}
      hint={hint}
      error={error}
      serverError={serverError}
      required={required}
      touched={touched}
      submitted={submitted}
      validationMode={validationMode}
    >
      {content}
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
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="empty">
        <div className="rounded-full bg-muted p-3">
          <Check className="size-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">{title}</h3>
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
  validate = false,
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
  validate?: boolean;
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
      onClick={async (event) => {
        if (validate) {
          const surface = event.currentTarget.closest<HTMLElement>(
            'form, [data-slot="dialog-content"], [data-slot="sheet-content"]',
          );
          if (surface && !revealInvalidFields(surface)) return;
        }
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
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" className="task-link" onClick={onClick}>
      <span className="min-w-0 text-left text-sm font-medium">{title}</span>
      <ArrowRight className="ml-auto shrink-0" />
    </Button>
  );
}

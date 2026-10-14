import { useId, useRef, useState, type ReactNode } from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Input } from "@/components/ui/input";
import {
  choiceLabel,
  filterChoices,
  searchableChoice,
  searchKeyBubbles,
  type ChoiceOption,
} from "./choice-search";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SharedField, type SharedFieldProps } from "../components/shared-field";
import { useFieldContext } from "../components/field-context";
import { describedBy, loadPresentation } from "../components/form-feedback";
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
export function Choice({
  label: title,
  value,
  onChange,
  options,
  disabled,
  id,
  controlId,
  hint,
  error,
  serverError,
  required,
  touched,
  submitted,
  validationMode,
  searchable,
  "aria-describedby": extraDescription,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
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
  searchable?: boolean;
  "aria-describedby"?: string;
}) {
  const generated = useId(),
    parent = useFieldContext(),
    control = controlId ?? id ?? parent?.controlId ?? generated;
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const canSearch = searchableChoice(title, options.length, searchable);
  const matches = filterChoices(options, canSearch ? search : "");
  const items = matches.map((o) => (
    <SelectItem key={o.value} value={o.value}>
      <span className="min-w-0">
        <span className="block">{o.label}</span>
        {o.description && (
          <span className="block text-xs text-muted-foreground">
            {o.description}
          </span>
        )}
      </span>
    </SelectItem>
  ));
  const content = (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
      disabled={disabled}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
      onOpenChangeComplete={(open) => {
        if (open && canSearch) searchInput.current?.focus();
      }}
    >
      <SelectTrigger
        id={control}
        aria-label={title}
        aria-required={required ?? parent?.required}
        aria-invalid={parent?.invalid || undefined}
        aria-describedby={describedBy(
          extraDescription,
          parent?.descriptionId,
          parent?.errorId,
        )}
        className="w-full"
      >
        <SelectValue>{choiceLabel(options, value, title)}</SelectValue>
      </SelectTrigger>
      {canSearch ? (
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner
            side="bottom"
            sideOffset={4}
            align="start"
            alignItemWithTrigger={false}
            className="isolate z-50"
          >
            <SelectPrimitive.Popup
              data-slot="select-content"
              className="z-50 w-(--anchor-width) min-w-64 max-h-(--available-height) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
            >
              <div className="border-b p-2 space-y-1.5">
                <label
                  htmlFor={`${control}-search`}
                  className="block text-xs font-medium"
                >
                  Search {title.toLowerCase()}
                </label>
                <Input
                  ref={searchInput}
                  id={`${control}-search`}
                  type="search"
                  value={search}
                  autoComplete="off"
                  aria-describedby={`${control}-search-help`}
                  aria-controls={`${control}-options`}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (!searchKeyBubbles(event.key)) event.stopPropagation();
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
                <p
                  id={`${control}-search-help`}
                  className="sr-only"
                >
                  Arrow down to options; Enter to select.
                </p>
              </div>
              <p
                role="status"
                aria-live="polite"
                className="px-3 pt-2 text-xs text-muted-foreground"
              >
                {matches.length
                  ? `${matches.length} matching ${matches.length === 1 ? "option" : "options"}`
                  : "No matching options. Try another search."}
              </p>
              <SelectPrimitive.List
                id={`${control}-options`}
                className="max-h-64 overflow-y-auto p-1"
                aria-label={title}
              >
                {items}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      ) : (
        <SelectContent>{items}</SelectContent>
      )}
    </Select>
  );
  return parent?.controlId === control ? (
    content
  ) : (
    <Field
      label={title}
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

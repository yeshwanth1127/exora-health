/** Local feedback never decides whether a save is valid; command predicates retain that responsibility. */
export type NativeFieldValue = {
  type?: string;
  value?: string | number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  minLength?: number;
  min?: string | number;
  max?: string | number;
};
export function nativeFieldError(p: NativeFieldValue, label: string) {
  if (p.disabled || p.readOnly) return undefined;
  const value = String(p.value ?? "");
  if (p.required && !value.trim())
    return `Enter ${label.toLowerCase()} to continue.`;
  if (value && p.minLength && value.length < p.minLength)
    return `Enter at least ${p.minLength} characters for ${label.toLowerCase()}.`;
  if (
    p.type === "number" &&
    value &&
    (!Number.isFinite(Number(value)) ||
      (p.min !== undefined && Number(value) < Number(p.min)) ||
      (p.max !== undefined && Number(value) > Number(p.max)))
  )
    return `Enter ${label.toLowerCase()}${p.min !== undefined ? ` from ${p.min}` : ""}${p.max !== undefined ? ` up to ${p.max}` : ""}.`;
  if (
    ["date", "datetime-local", "time"].includes(p.type ?? "") &&
    value &&
    ((p.min !== undefined && value < String(p.min)) ||
      (p.max !== undefined && value > String(p.max)))
  )
    return `Choose ${label.toLowerCase()} within the allowed range.`;
  if (p.type === "url" && value && !/^https?:\/\/[^\s]+$/.test(value))
    return "Enter a complete link starting with https:// or http://.";
  if (p.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "Enter a valid email address.";
  return undefined;
}
export function visibleFieldError({
  error,
  serverError,
  touched = false,
  submitted = false,
  validationMode = "onBlur",
}: {
  error?: string;
  serverError?: string;
  touched?: boolean;
  submitted?: boolean;
  validationMode?: "onBlur" | "always";
}) {
  return (
    serverError ||
    (touched || submitted || validationMode === "always" ? error : undefined)
  );
}
export function describedBy(
  existing: string | undefined,
  descriptionId?: string,
  errorId?: string,
  ownedErrorId?: string,
) {
  return (
    [
      ...new Set(
        [
          ...(existing ?? "")
            .split(/\s+/)
            .filter((id) => id && id !== ownedErrorId),
          descriptionId,
          errorId,
        ].filter(Boolean),
      ),
    ].join(" ") || undefined
  );
}
export function loadPresentation({
  loading,
  error,
  data,
  failure,
}: {
  loading: boolean;
  error?: string;
  data?: unknown;
  failure?: { status?: number; code?: string } | null;
}) {
  if (error) {
    if (
      data !== undefined &&
      data !== null &&
      ![401, 403, 404].includes(failure?.status ?? 0) &&
      failure?.code !== "invalid_response"
    )
      return "stale";
    return "error";
  }
  return loading ? "loading" : "ready";
}

/** Opt-in form validation for existing Action surfaces; server/save guards still run separately. */
export function revealInvalidFields(surface: HTMLElement) {
  const invalid = [
    ...surface.querySelectorAll<HTMLElement>('[data-field-error="true"]'),
  ];
  for (const field of invalid)
    field.dispatchEvent(new Event("workspace-validation-attempt"));
  if (invalid.length) {
    const id = invalid[0].dataset.fieldControl;
    const control = id
      ? invalid[0].querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)
      : null;
    control?.focus();
    return false;
  }
  return true;
}

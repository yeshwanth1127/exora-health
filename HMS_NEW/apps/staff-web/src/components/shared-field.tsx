import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import { TriangleAlert } from "lucide-react";
import { Label } from "./ui/label";
import { FieldContext } from "./field-context";
import {
  describedBy,
  nativeFieldError,
  visibleFieldError,
  type NativeFieldValue,
} from "./form-feedback";
export type SharedFieldProps = {
  label: string;
  id?: string;
  controlId?: string;
  hint?: string;
  error?: string;
  serverError?: string;
  required?: boolean;
  touched?: boolean;
  submitted?: boolean;
  validationMode?: "onBlur" | "always";
  children: ReactNode;
};
type ControlProps = NativeFieldValue & {
  id?: string;
  children?: ReactNode;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | string;
  "aria-required"?: boolean;
  onChange?: unknown;
};
function findControl(
  children: ReactNode,
  id?: string,
): ReactElement<ControlProps> | undefined {
  for (const child of Children.toArray(children))
    if (isValidElement<ControlProps>(child)) {
      if (
        id
          ? child.props.id === id
          : ["input", "textarea", "select"].includes(String(child.type)) ||
            (child.props.onChange && "value" in child.props)
      )
        return child;
      const nested = findControl(child.props.children, id);
      if (nested) return nested;
    }
}
export function SharedField({
  label,
  id,
  controlId,
  hint,
  error: localError,
  serverError,
  required,
  touched,
  submitted,
  validationMode = "onBlur",
  children,
}: SharedFieldProps) {
  const generated = useId();
  const target =
    findControl(children, controlId ?? id) ?? findControl(children);
  const control = controlId ?? id ?? target?.props.id ?? generated;
  const [blurred, setBlurred] = useState(false),
    [attempted, setAttempted] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const p = target?.props;
  const error =
    localError ||
    (p
      ? nativeFieldError({ ...p, required: required ?? p.required }, label)
      : undefined);
  const shown = visibleFieldError({
    error,
    serverError,
    touched: touched ?? blurred,
    submitted: submitted ?? attempted,
    validationMode,
  });
  const descriptionId = hint ? `${control}-description` : undefined,
    errorId = shown ? `${control}-error` : undefined;
  // Native form submission/constraint checks and explicit Action validation reveal local feedback.
  useEffect(() => {
    const node = host.current,
      form = node?.closest("form");
    const attempt = () => setAttempted(true);
    form?.addEventListener("submit", attempt);
    node?.addEventListener("workspace-validation-attempt", attempt);
    return () => {
      form?.removeEventListener("submit", attempt);
      node?.removeEventListener("workspace-validation-attempt", attempt);
    };
  }, []);
  const decorate = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (child) => {
      if (!isValidElement<ControlProps>(child)) return child;
      const matches =
        child.props === target?.props || child.props.id === control;
      const nested =
        child.props.children !== undefined
          ? decorate(child.props.children)
          : undefined;
      return cloneElement(child, {
        ...(matches
          ? {
              id: control,
              "aria-invalid": shown ? true : undefined,
              "aria-describedby": describedBy(
                child.props["aria-describedby"],
                descriptionId,
                errorId,
                `${control}-error`,
              ),
              "aria-required": required ?? p?.required,
            }
          : {}),
        ...(nested !== undefined ? { children: nested } : {}),
      });
    });
  return (
    <FieldContext.Provider
      value={{
        controlId: control,
        label,
        descriptionId,
        errorId,
        invalid: !!shown,
        required: required ?? p?.required,
      }}
    >
      <div
        ref={host}
        className="workspace-field"
        data-field-error={shown ? "true" : undefined}
        data-field-control={control}
        onBlurCapture={() => setBlurred(true)}
        onInvalidCapture={() => setAttempted(true)}
      >
        <Label htmlFor={control}>
          {label}
          {(required ?? p?.required) && (
            <span className="ml-1 text-muted-foreground">(required)</span>
          )}
        </Label>
        {decorate(children)}
        {hint && <p id={descriptionId} className="text-sm text-muted-foreground">{hint}</p>}
        {shown && (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-1.5 text-xs text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            {shown}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

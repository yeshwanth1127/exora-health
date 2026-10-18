import { useId } from "react";
import { Select } from "./arc/select/select";
import { Combobox } from "./arc/combobox/combobox";
import { SharedField, type SharedFieldProps } from "./shared-field";
import { useFieldContext } from "./field-context";
import { describedBy } from "./form-feedback";
import { searchableChoice, type ChoiceOption } from "@/hms/choice-search";

export type WorkspaceChoiceProps = Omit<SharedFieldProps, "children"> & {
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  disabled?: boolean;
  searchable?: boolean;
  "aria-describedby"?: string;
};

function ChoiceControl({ label, value, onChange, options, disabled, searchable, id, "aria-describedby": description }: WorkspaceChoiceProps) {
  const field = useFieldContext();
  const control = id ?? field?.controlId;
  const empty = options.find((option) => !option.value);
  const choices = options.filter((option) => option.value).map((option) => ({ ...option,
    label: `${option.label}${option.description ? ` · ${option.description}` : ""}`,
    keywords: option.description ? [option.description] : undefined,
  }));
  const attributes = { id: control, "aria-label": label, "aria-required": field?.required,
    "aria-invalid": field?.invalid || undefined,
    "aria-describedby": describedBy(description, field?.descriptionId, field?.errorId) };
  return <div className="arc-demo-scope">
    {searchableChoice(label, options.length, searchable)
      ? <Combobox {...attributes} hideLabel label={label} value={value} options={choices} disabled={disabled}
          placeholder={empty?.label ?? `Select ${label.toLowerCase()}…`} onValueChange={onChange} />
      : <Select id={control} hideLabel label={label} value={value} options={choices} disabled={disabled}
          required={field?.required} placeholder={empty?.label ?? `Select ${label.toLowerCase()}…`}
          triggerProps={attributes} onValueChange={onChange} />}
  </div>;
}

export function WorkspaceChoice(props: WorkspaceChoiceProps) {
  const generated = useId();
  const parent = useFieldContext();
  const control = props.controlId ?? props.id ?? parent?.controlId ?? generated;
  if (parent?.controlId === control) return <ChoiceControl {...props} id={control} />;
  const { label, hint, error, serverError, required, touched, submitted, validationMode } = props;
  return <SharedField label={label} id={control} hint={hint} error={error} serverError={serverError}
    required={required} touched={touched} submitted={submitted} validationMode={validationMode}>
    <ChoiceControl {...props} id={control} />
  </SharedField>;
}

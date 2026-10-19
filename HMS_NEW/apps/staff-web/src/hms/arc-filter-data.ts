import type { FilterChip, FilterField, FilterOption } from "@/components/arc/filter-toolbar/filter-toolbar";

/** Arc's two-step menu returns display labels; queries must retain API identities. */
export function filterOptionValue(chip: FilterChip, field: FilterField): string | undefined {
  const matches = field.options.map((option): FilterOption => typeof option === "string" ? { value: option } : option)
    .filter(option => (option.label ?? option.value) === chip.value);
  return matches.length === 1 ? matches[0].value : undefined;
}

export function doctorFilterOptions(doctors: { staffId: string; name: string }[]) {
  return doctors.map(doctor => ({
    value: doctor.staffId,
    label: doctors.filter(other => other.name === doctor.name).length > 1
      ? `${doctor.name} · ${doctor.staffId}` : doctor.name,
  }));
}

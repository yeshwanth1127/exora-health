export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
};
const normal = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
/** Filter the already authorized option source; never fetch or invent additional entities. */
export function filterChoices(options: ChoiceOption[], text: string) {
  const words = normal(text).split(/\s+/).filter(Boolean);
  return words.length
    ? options.filter((option) => {
        const haystack = normal(`${option.label} ${option.description ?? ""}`);
        return words.every((word) => haystack.includes(word));
      })
    : options;
}
export function searchableChoice(
  label: string,
  count: number,
  requested?: boolean,
) {
  return (
    requested ??
    (count >= 8 &&
      /doctor|practitioner|clinician|clinic|department|service|patient|staff|person|role|template|room|location|facility|state|timezone|time zone/i.test(
        label,
      ))
  );
}
export function choiceLabel(
  options: ChoiceOption[],
  value: string,
  fallback: string,
) {
  const option = options.find((option) => option.value === value);
  return option
    ? `${option.label}${option.description ? ` · ${option.description}` : ""}`
    : fallback;
}
/** Text editing must not invoke the Select's typeahead or commit a previously highlighted item. */
export function searchKeyBubbles(key: string) {
  return ["ArrowDown", "ArrowUp", "Escape", "Tab"].includes(key);
}

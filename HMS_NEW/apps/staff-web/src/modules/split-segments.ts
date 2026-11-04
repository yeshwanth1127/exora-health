const humanize = (v: string) => {
  const t = v.replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// Each status keeps its meaning (docs/prd/dashboard-colour.md); anything else uses the chart's series colours.
const STATUS_COLOUR: Record<string, string> = {
  confirmed: "var(--accent)",
  checked_in: "var(--warning)",
  completed: "var(--success)",
  cancelled: "var(--danger)",
  no_show: "var(--text-muted)",
};
export const splitSegments = (rows: { label: string; value: number }[]) =>
  rows.map((d) => ({ id: d.label, label: humanize(d.label), value: d.value, color: STATUS_COLOUR[d.label] }));

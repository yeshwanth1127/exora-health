const humanize = (v: string) => {
  const t = v.replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const splitSegments = (rows: { label: string; value: number }[]) =>
  rows.map((d) => ({ id: d.label, label: humanize(d.label), value: d.value }));

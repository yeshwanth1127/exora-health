import type { HospitalTemplateId } from "@hms/website-templates";
/** Dev previews must survive ordinary clicks, reloads and opening a link in a new tab. */
export function previewHref(
  to: string,
  template: HospitalTemplateId,
  bound: boolean,
) {
  if (
    !import.meta.env.DEV ||
    bound ||
    template === "swastikaa" ||
    to.startsWith("#")
  )
    return to;
  const next = new URL(to, location.origin);
  if (next.origin !== location.origin) return to;
  next.searchParams.set("template", template);
  const name = new URLSearchParams(location.search).get("name");
  if (name) next.searchParams.set("name", name);
  return next.pathname + next.search + next.hash;
}

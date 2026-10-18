export type PermissionDescription = { code: string; module: string; description: string };
const words = (value: string) => value.replaceAll("_", " ").replaceAll(".", " ");
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
/** Preserve every grant; backend descriptions are the source of the admin-facing explanation. */
export function describeRolePermissions(codes: string[], catalogue: PermissionDescription[]) {
  const byCode = new Map(catalogue.map((permission) => [permission.code, permission]));
  const groups = new Map<string, { code: string; description: string }[]>();
  for (const code of codes) {
    const permission = byCode.get(code);
    const group = permission ? title(words(permission.module)) : "Additional access";
    const parts = code.split(".");
    const task = parts.pop() ?? "";
    const fallback = title(words(`${task === "read" ? "View" : task} ${parts.join(" ")}`));
    const items = groups.get(group) ?? [];
    items.push({ code, description: permission?.description.trim() || fallback });
    groups.set(group, items);
  }
  return [...groups].map(([module, permissions]) => ({ module, permissions }));
}

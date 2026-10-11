// Mounts Workspace settings (original layout) on the HMS API (G16, G17 overbooking): staff invited by
// work email, roles granted per clinic, role copies with permission switches, and the booking policy.
// The server enforces every rule; `allowed` only hides controls the user can't use.
import { useMemo } from "react";
import { WorkspaceSettings } from "@/modules/settings";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { request } from "./client";
import { useWorkspace } from "./hooks";
import { can } from "./model";

type StaffAccount = {
  staffId: string;
  displayName: string;
  employeeNo: string;
  staffType: string;
  status: string;
  email: string | null;
  phone: string | null;
  version: number;
  account: { status: string; linked: boolean } | null;
  grants: { grantId: string; roleName: string; facilityName: string | null }[];
};
type Roles = {
  roles: { roleId: string; name: string; builtIn: boolean; permissions: string[] }[];
  permissions: { code: string; module: string; description: string }[];
};

const uuid = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
const paths = {
  grants: new RegExp(`^/api/v1/staff/users/${uuid}/grants$`, "i"),
  status: new RegExp(`^/api/v1/staff/users/${uuid}/status$`, "i"),
  revoke: new RegExp(`^/api/v1/staff/grants/${uuid}/revoke$`, "i"),
  user: new RegExp(`^/api/v1/staff/users/${uuid}$`, "i"),
  retire: new RegExp(`^/api/v1/staff/roles/${uuid}/retire$`, "i"),
  permission: new RegExp(`^/api/v1/staff/roles/${uuid}/permissions/([a-z_]+(?:\\.[a-z_]+)+)$`, "i"),
};
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");

export function SettingsPage() {
  const { me, facility } = useWorkspace();
  const source = useMemo<OriginalResourceSource>(() => {
    const at = facility.facilityId;
    const everywhere = (me.permissions["access.manage"] ?? []).includes("*");
    const scope = (everyClinic: unknown) => (everyClinic === true ? null : at);
    return {
      scope: `${me.tenantId}:${at}:${me.staffId}:settings`,
      permissions: {
        role: me.staffType,
        allowed: {
          "staff.view": can(me, "access.manage", at),
          "staff.create": can(me, "access.manage", at) && can(me, "staff.manage", at),
          "staff.status": can(me, "staff.manage", at),
          "staff.edit": can(me, "staff.manage", at),
          "access.everywhere": everywhere,
          "booking.policy": can(me, "config.manage", at),
        },
        staff: [],
      },
      unavailableWrite: "Not available on this page.",
      async read<T>(path: string, signal: AbortSignal): Promise<T> {
        if (path === "/api/v1/staff/users") {
          const { items } = await request<{ items: StaffAccount[] }>(`/v1/staff-accounts?facilityId=${at}`, { signal });
          return items.map((s) => ({
            id: s.staffId,
            name: s.displayName,
            employee_no: s.employeeNo,
            email: s.email,
            phone: s.phone,
            version: s.version,
            staff_type: s.staffType,
            status: s.status !== "active" ? "disabled" : !s.account ? "no_login" : s.account.linked ? "active" : "invited",
            is_you: s.staffId === me.staffId,
            grants: s.grants.map((g) => ({ id: g.grantId, role: g.roleName, clinic: g.facilityName ?? "Every clinic" })),
          })) as T;
        }
        if (path === "/api/v1/staff/roles") {
          const r = await request<Roles>("/v1/roles", { signal });
          return {
            roles: r.roles.map((x) => ({ id: x.roleId, name: x.name, built_in: x.builtIn, permissions: x.permissions })),
            permissions: r.permissions.map((p) => ({ key: p.code, label: p.description, module: titleCase(p.module) })),
          } as T;
        }
        if (path === "/api/v1/admin/booking-policy") {
          const r = await request<{ enabled: boolean }>(`/v1/facilities/${at}/overbooking`, { signal });
          return { overbooking: r.enabled } as T;
        }
        throw new Error("Not available on this page.");
      },
      async write<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
        const b = (options.body ?? {}) as Record<string, unknown>;
        const key = typeof b.idempotency_key === "string" ? b.idempotency_key : undefined;
        if (options.method === "PUT" && path === "/api/v1/admin/booking-policy")
          return request<T>(`/v1/facilities/${at}/overbooking`, { method: "PUT", body: { enabled: b.overbooking === true } });
        let m: RegExpExecArray | null;
        if (options.method === "PUT" && (m = paths.permission.exec(path)))
          return request<T>(`/v1/roles/${m[1]}/permissions/${m[2]}`, { method: "PUT", body: { allowed: b.allowed === true } });
        if (options.method === "PATCH" && (m = paths.user.exec(path)))
          return request<T>(`/v1/staff/${m[1]}`, {
            method: "PATCH",
            body: { version: b.version, displayName: b.name, phone: b.phone ? b.phone : null },
          });
        if (options.method !== "POST") throw new Error("Not available on this page.");
        if ((m = paths.retire.exec(path)))
          return request<T>(`/v1/roles/${m[1]}/retire`, { method: "POST", body: { reason: b.reason } });
        if (path === "/api/v1/staff/users")
          return request<T>("/v1/staff-accounts", {
            method: "POST",
            idempotencyKey: key,
            body: {
              displayName: b.name,
              employeeNo: b.employee_no,
              staffType: b.staff_type,
              email: b.email,
              ...(b.phone ? { phone: b.phone } : {}),
              roleId: b.role_id,
              facilityId: scope(b.every_clinic),
            },
          });
        if (path === "/api/v1/staff/roles")
          return request<T>("/v1/roles", { method: "POST", idempotencyKey: key, body: { name: b.name, copyOfRoleId: b.copy_of } });
        if ((m = paths.grants.exec(path)))
          return request<T>(`/v1/staff/${m[1]}/grants`, { method: "POST", idempotencyKey: key, body: { roleId: b.role_id, facilityId: scope(b.every_clinic) } });
        if ((m = paths.status.exec(path)))
          return request<T>(`/v1/staff/${m[1]}/status`, { method: "POST", body: { status: b.status, reason: b.reason } });
        if ((m = paths.revoke.exec(path)))
          return request<T>(`/v1/role-grants/${m[1]}/revoke`, { method: "POST", body: { reason: b.reason } });
        throw new Error("Not available on this page.");
      },
    };
  }, [me, facility]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <WorkspaceSettings account={{ name: me.displayName, detail: titleCase(me.staffType) }} />
    </OriginalResourceContext.Provider>
  );
}

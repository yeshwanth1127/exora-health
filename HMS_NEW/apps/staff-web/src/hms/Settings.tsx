import { WebsiteSettingsPanel } from "./WebsiteSettings";
import { SettingsPage as ArcSettingsPage } from "@/components/arc/settings-page/settings-page";
import {
  Users,
  ShieldCheck,
  CalendarCheck,
  SlidersHorizontal,
  Stethoscope,
  FileCheck,
  Palette,
  CircleUser,
} from "lucide-react";
import { ModePicker } from "@/components/ModePicker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
// Mounts Workspace settings (original layout) on the HMS API (G16, G17 overbooking): staff invited by
// work email, roles granted per clinic, role copies with permission switches, and the booking policy.
// The server enforces every rule; `allowed` only hides controls the user can't use.
import { useMemo, type ReactNode } from "react";
import { WorkspaceSettings } from "@/modules/settings";
import {
  OriginalResourceContext,
  type OriginalResourceSource,
} from "@/components/resource-source";
import { ModuleSwitches, Registrations, ConsentDocuments } from "./AdminPanels";
import {
  SETTINGS_SECTIONS,
  settingsSection,
  type SettingsSection,
} from "./settings-sections";
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
  roles: {
    roleId: string;
    name: string;
    builtIn: boolean;
    permissions: string[];
    version: number;
  }[];
  permissions: { code: string; module: string; description: string }[];
};

const uuid = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
const paths = {
  grants: new RegExp(`^/api/v1/staff/users/${uuid}/grants$`, "i"),
  status: new RegExp(`^/api/v1/staff/users/${uuid}/status$`, "i"),
  revoke: new RegExp(`^/api/v1/staff/grants/${uuid}/revoke$`, "i"),
  user: new RegExp(`^/api/v1/staff/users/${uuid}$`, "i"),
  retire: new RegExp(`^/api/v1/staff/roles/${uuid}/retire$`, "i"),
  permission: new RegExp(
    `^/api/v1/staff/roles/${uuid}/permissions/([a-z_]+(?:\\.[a-z_]+)+)$`,
    "i",
  ),
};
const titleCase = (s: string) =>
  s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");

export function SettingsPage({
  clinicPicker,
}: { clinicPicker?: ReactNode } = {}) {
  const { me, facility, go } = useWorkspace();
  const permitted: SettingsSection[] = [
    ...(can(me, "access.manage", facility.facilityId)
      ? (["team", "roles"] as SettingsSection[])
      : []),
    ...(can(me, "config.manage", facility.facilityId)
      ? (["booking", "website"] as SettingsSection[])
      : []),
    ...((me.permissions["tenant.manage"] ?? []).includes("*")
      ? (["modules"] as SettingsSection[])
      : []),
    ...(can(me, "staff.manage", facility.facilityId) &&
    can(me, "access.manage", facility.facilityId)
      ? (["registrations"] as SettingsSection[])
      : []),
    ...((me.permissions["consent_documents.manage"] ?? []).includes("*")
      ? (["consent-documents"] as SettingsSection[])
      : []),
    "appearance",
    "account",
  ];
  const requested = new URLSearchParams(location.search).get("section"),
    section = settingsSection(requested, permitted);
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
          "staff.create":
            can(me, "access.manage", at) && can(me, "staff.manage", at),
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
          const { items } = await request<{ items: StaffAccount[] }>(
            `/v1/staff-accounts?facilityId=${at}`,
            { signal },
          );
          return items.map((s) => ({
            id: s.staffId,
            name: s.displayName,
            employee_no: s.employeeNo,
            email: s.email,
            phone: s.phone,
            version: s.version,
            staff_type: s.staffType,
            status:
              s.status !== "active"
                ? "disabled"
                : !s.account
                  ? "no_login"
                  : s.account.linked
                    ? "active"
                    : "invited",
            is_you: s.staffId === me.staffId,
            grants: s.grants.map((g) => ({
              id: g.grantId,
              role: g.roleName,
              clinic: g.facilityName ?? "Every clinic",
            })),
          })) as T;
        }
        if (path === "/api/v1/staff/roles") {
          const r = await request<Roles>("/v1/roles", { signal });
          return {
            roles: r.roles.map((x) => ({
              id: x.roleId,
              name: x.name,
              built_in: x.builtIn,
              permissions: x.permissions,
              version: x.version,
            })),
            permissions: r.permissions.map((p) => ({
              key: p.code,
              label: p.description,
              module: titleCase(p.module),
            })),
          } as T;
        }
        if (path === "/api/v1/admin/booking-policy") {
          const r = await request<{ enabled: boolean; version: string | null }>(
            `/v1/facilities/${at}/overbooking`,
            { signal },
          );
          return { overbooking: r.enabled, version: r.version } as T;
        }
        throw new Error("Not available on this page.");
      },
      async write<T>(
        path: string,
        options: { method?: string; body?: unknown } = {},
      ): Promise<T> {
        const b = (options.body ?? {}) as Record<string, unknown>;
        const key =
          typeof b.idempotency_key === "string" ? b.idempotency_key : undefined;
        if (options.method === "PUT" && path === "/api/v1/admin/booking-policy")
          return request<T>(`/v1/facilities/${at}/overbooking`, {
            method: "PUT",
            idempotencyKey: key,
            body: { enabled: b.overbooking === true, version: b.version },
          });
        let m: RegExpExecArray | null;
        if (options.method === "PUT" && (m = paths.permission.exec(path)))
          return request<T>(`/v1/roles/${m[1]}/permissions/${m[2]}`, {
            method: "PUT",
            idempotencyKey: key,
            body: { allowed: b.allowed === true, version: b.version },
          });
        if (options.method === "PATCH" && (m = paths.user.exec(path)))
          return request<T>(`/v1/staff/${m[1]}`, {
            method: "PATCH",
            idempotencyKey: key,
            body: {
              version: b.version,
              displayName: b.name,
              phone: b.phone ? b.phone : null,
            },
          });
        if (options.method !== "POST")
          throw new Error("Not available on this page.");
        if ((m = paths.retire.exec(path)))
          return request<T>(`/v1/roles/${m[1]}/retire`, {
            method: "POST",
            idempotencyKey: key,
            body: { reason: b.reason },
          });
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
          return request<T>("/v1/roles", {
            method: "POST",
            idempotencyKey: key,
            body: { name: b.name, copyOfRoleId: b.copy_of },
          });
        if ((m = paths.grants.exec(path)))
          return request<T>(`/v1/staff/${m[1]}/grants`, {
            method: "POST",
            idempotencyKey: key,
            body: { roleId: b.role_id, facilityId: scope(b.every_clinic) },
          });
        if ((m = paths.status.exec(path)))
          return request<T>(`/v1/staff/${m[1]}/status`, {
            method: "POST",
            idempotencyKey: key,
            body: { status: b.status, reason: b.reason },
          });
        if ((m = paths.revoke.exec(path)))
          return request<T>(`/v1/role-grants/${m[1]}/revoke`, {
            method: "POST",
            idempotencyKey: key,
            body: { reason: b.reason },
          });
        throw new Error("Not available on this page.");
      },
    };
  }, [me, facility]);
  return (
    <OriginalResourceContext.Provider value={source}>
      <h1 className="mb-6 text-2xl font-semibold">Workspace settings</h1>
      <ArcSettingsPage
        fullPage
        current={section}
        onChange={(id) => go(`settings?section=${id}`)}
        account={{ name: me.displayName, detail: titleCase(me.staffType) }}
        sections={SETTINGS_SECTIONS.filter(([id]) =>
          permitted.includes(id),
        ).map(([id, name]) => {
          const icons = {
            team: Users,
            roles: ShieldCheck,
            booking: CalendarCheck,
            website: Palette,
            modules: SlidersHorizontal,
            registrations: Stethoscope,
            "consent-documents": FileCheck,
            appearance: Palette,
            account: CircleUser,
          };
          const descriptions = {
            team: `Staff accounts and invitations at ${facility.name}.`,
            roles:
              "Review permissions and clinic access before applying a change.",
            booking: `Appointment booking rules for ${facility.name}.`,
            website: "Hospital website content and general enquiries.",
            modules: "Manage the modules available to this organisation.",
            registrations:
              "Review professional registrations and verification.",
            "consent-documents": "Manage the organisation’s consent documents.",
            appearance: "Choose the colour theme for this browser.",
            account: "Your account and current clinic workspace.",
          };
          const Icon = icons[id];
          return {
            id,
            label: id === "registrations" ? "Registrations" : name,
            description: descriptions[id],
            icon: <Icon size={16} strokeWidth={1.75} aria-hidden="true" />,
          };
        })}
      >
        {requested && requested !== section && (
          <p role="status" className="mb-4 text-sm text-muted-foreground">
            That settings section is not available. Showing{" "}
            {SETTINGS_SECTIONS.find(([id]) => id === section)?.[1]}.
          </p>
        )}
        {section === "account" && clinicPicker && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Current clinic</CardTitle>
              <CardDescription>
                Choose the clinic workspace you want to use.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-sm">{clinicPicker}</div>
            </CardContent>
          </Card>
        )}
        {["team", "roles", "booking", "account"].includes(section) && (
          <WorkspaceSettings
            key={section}
            section={section as "team" | "roles" | "booking" | "account"}
            clinicName={facility.name}
            account={{ name: me.displayName, detail: titleCase(me.staffType) }}
          />
        )}
        {section === "website" && <WebsiteSettingsPanel key={facility.facilityId} />}
        {section === "appearance" && (
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Choose the colour theme for this browser.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ModePicker />
            </CardContent>
          </Card>
        )}
        {section === "modules" && <ModuleSwitches />}
        {section === "registrations" && <Registrations />}
        {section === "consent-documents" && <ConsentDocuments />}
      </ArcSettingsPage>
    </OriginalResourceContext.Provider>
  );
}

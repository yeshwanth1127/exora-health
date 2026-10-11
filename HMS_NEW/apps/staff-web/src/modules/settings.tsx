import { DemoControls } from "./DemoControls";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api, dateTime, type StaffUser } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import {
  Action,
  Choice,
  Field,
  PageTitle,
  Resource,
  useApi,
  SectionTitle,
  usePermissions,
  useResource,
} from "@/components/workspace";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ModuleSettings } from "@/modules/growth/ModuleSettings";

export function SettingsModule({
  user,
  page,
  demo = false,
  onModulesChanged,
}: {
  user: StaffUser;
  page: string;
  demo?: boolean;
  onModulesChanged?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("staff"),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [change, setChange] = useState(false);
  const users = useResource<StaffUser[]>(
    user.role === "admin" ? "/api/v1/staff/users" : null,
  );
  if (page === "modules")
    return (
      <ModuleSettings api={api} onChanged={onModulesChanged ?? (() => {})} />
    );
  if (page === "demo")
    return (
      <>
        <PageTitle
          title="Demo workspace"
          description="Sample records and demo controls are kept here, away from daily clinic work."
        />
        {demo ? (
          <DemoControls canManage={user.role === "admin"} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Demo controls are unavailable in this workspace.
          </p>
        )}
      </>
    );
  if (page === "design") return <DesignBook />;
  if (page === "activity") return <ActivityLog />;

  return (
    <>
      <PageTitle
        title="Workspace settings"
        description="Staff accounts and optional modules are managed in one place."
      />
      <div className="grid md:grid-cols-2 gap-5 mb-7">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your account</CardTitle>
            <CardDescription>
              {user.name} · @{user.username}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setChange(true)}>
              Change password
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optional modules</CardTitle>
            <CardDescription>
              Choose which tools your clinic uses. Saved data is retained when a
              module is disabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                history.pushState({}, "", "/staff/settings/modules");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
            >
              Manage modules
            </Button>
          </CardContent>
        </Card>
      </div>
      {demo && (
        <Card className="mb-7">
          <CardHeader>
            <CardTitle>Demo workspace</CardTitle>
            <CardDescription>
              Sample data, reload controls, and environment information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                history.pushState({}, "", "/staff/settings/demo");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
            >
              Manage demo data
            </Button>
          </CardContent>
        </Card>
      )}
      {user.role === "admin" && <StaffPermissions />}
      {user.role === "admin" && (
        <>
          <SectionTitle
            title="Staff accounts"
            description="Each staff member uses their own username and password."
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus />
                Add staff member
              </Button>
            }
          />
          <Resource {...users}>
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>{u.role.replaceAll("_", " ")}</TableCell>
                      <TableCell>{u.active ? "Active" : "Disabled"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Resource>
        </>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setPassword("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              Share these credentials privately with the new team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field
              label="Full name"
              id="staff-name"
              error={
                name.trim().length < 2
                  ? "Enter a full name with at least 2 characters."
                  : undefined
              }
            >
              <Input
                id="staff-name"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field
              label="Username"
              id="staff-username"
              error={
                !/^[a-zA-Z0-9._-]{3,64}$/.test(username)
                  ? "Enter 3–64 letters, numbers, dots, underscores or hyphens."
                  : undefined
              }
              hint="At least 3 characters. Letters, numbers, dots, underscores or hyphens."
            >
              <Input
                id="staff-username"
                value={username}
                autoComplete="off"
                maxLength={64}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field
              label="Initial password"
              id="staff-password"
              error={
                password.length < 12
                  ? "Enter a password with at least 12 characters."
                  : undefined
              }
              hint="Use at least 12 characters. No shared or default passwords."
            >
              <Input
                id="staff-password"
                type="password"
                value={password}
                autoComplete="new-password"
                maxLength={128}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Choice
              label="Role"
              value={role}
              onChange={setRole}
              options={["staff", "admin", "growth_manager"].map((r) => [
                r,
                r === "staff"
                  ? "Clinic staff"
                  : r === "admin"
                    ? "Clinic administrator"
                    : "Growth manager",
              ])}
            />
            <p className="text-xs text-muted-foreground">
              Clinic staff manage appointments and WhatsApp. Growth managers
              access enabled growth tools only. Administrators also manage staff
              and module settings.
            </p>
            <Action
              disabled={
                name.trim().length < 2 ||
                !/^[a-zA-Z0-9._-]{3,64}$/.test(username) ||
                password.length < 12
              }
              run={async () => {
                await api("/api/v1/staff/users", {
                  method: "POST",
                  body: { name, username, password, role },
                });
                setPassword("");
                setOpen(false);
                users.refresh();
              }}
              success="Staff account created"
            >
              Create staff account
            </Action>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={change}
        onOpenChange={(v) => {
          setChange(v);
          if (!v) {
            setCurrent("");
            setNext("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change your password</DialogTitle>
            <DialogDescription>
              This signs you out on every device. Sign in again with your new
              password.
            </DialogDescription>
          </DialogHeader>
          <Field
            label="Current password"
            id="current-password"
            error={!current ? "Enter your current password." : undefined}
          >
            <Input
              type="password"
              id="current-password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              maxLength={256}
            />
          </Field>
          <Field
            label="New password"
            id="new-password"
            error={
              next.length < 12
                ? "Enter a new password with at least 12 characters."
                : undefined
            }
            hint="12–128 characters."
          >
            <Input
              type="password"
              id="new-password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              maxLength={128}
            />
          </Field>
          <Action
            disabled={!current || next.length < 12}
            run={async () => {
              await api("/api/v1/staff/password", {
                method: "POST",
                body: { current_password: current, new_password: next },
              });
              setNext("");
              setCurrent("");
              window.dispatchEvent(new Event("staff-signout"));
            }}
            success="Password changed. Sign in again."
          >
            Change password & sign out
          </Action>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DesignBook() {
  const book = useResource<{ title: string; markdown: string }>(
    "/api/v1/staff/design-guide",
  );
  return (
    <Resource {...book}>
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-6 sm:p-10">
          <article className="decision-book">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children, ...props }) => (
                  <h2
                    {...props}
                    id={String(children)
                      .toLowerCase()
                      .replace(/[^\w\s-]/g, "")
                      .trim()
                      .replace(/\s+/g, "-")}
                  >
                    {children}
                  </h2>
                ),
              }}
            >
              {book.data?.markdown ?? ""}
            </Markdown>
          </article>
        </CardContent>
      </Card>
    </Resource>
  );
}

function StaffPermissions() {
  const permissions = usePermissions();
  const [error, setError] = useState("");
  const update = async (key: string, allowed: boolean) => {
    setError("");
    try {
      await api(`/api/v1/staff/permissions/${key}`, {
        method: "PUT",
        body: { allowed },
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update the setting.",
      );
    } finally {
      permissions.refresh();
    }
  };
  return (
    <>
      <Card className="mb-7">
        <CardHeader>
          <CardTitle className="text-base">
            Appointment booking policy
          </CardTitle>
          <CardDescription>
            Administrator setting. Staff follow this policy automatically when
            booking or moving appointments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Resource {...permissions}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="perm-appointments.overbook">
                  Allow overlapping appointments
                </Label>
                <p className="mt-2 text-xs text-muted-foreground">
                  Allow up to three simultaneous visits at the same clinic.
                  Reception coordinates arrivals. Blocked time, active holds and
                  other-clinic conflicts remain protected.
                </p>
              </div>
              <Switch
                id="perm-appointments.overbook"
                checked={
                  permissions.data?.staff.find(
                    (p) => p.key === "appointments.overbook",
                  )?.allowed ?? false
                }
                onCheckedChange={(v) => update("appointments.overbook", v)}
              />
            </div>
          </Resource>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="mb-7">
        <CardHeader>
          <CardTitle className="text-base">
            What clinic staff can change
          </CardTitle>
          <CardDescription>
            Only administrators can change these permissions. Consultation fees
            remain administrator-only. Every change is recorded in the activity
            log.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Resource {...permissions}>
            {permissions.data?.staff
              .filter((p) => p.key !== "appointments.overbook")
              .map((p) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between gap-4"
                >
                  <Label
                    htmlFor={"perm-" + p.key}
                    className="text-sm font-normal"
                  >
                    {p.label}
                  </Label>
                  <Switch
                    id={"perm-" + p.key}
                    checked={p.allowed}
                    onCheckedChange={(v) => update(p.key, v)}
                  />
                </div>
              ))}
          </Resource>
        </CardContent>
      </Card>
    </>
  );
}

type AuditItem = {
  id: string;
  created_at: string;
  actor: string;
  actor_type: string;
  action: string;
  targets: Record<string, string>;
  change: Record<string, unknown>;
  request_id: string;
};
const describe = (value: unknown): string =>
  Array.isArray(value) && value.length === 2 // [before, after]
    ? `${describe(value[0])} → ${describe(value[1])}`
    : value && typeof value === "object" && "from" in value && "to" in value
    ? `${String((value as { from: unknown }).from)} → ${String((value as { to: unknown }).to)}`
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

export function ActivityLog() {
  const call = useApi();
  const [filters, setFilters] = useState({
      actor: "",
      target: "",
      action: "",
      start: "",
      end: "",
    }),
    [limit, setLimit] = useState(50);
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString();
  const log = useResource<{ items: AuditItem[]; more: boolean }>(
    `/api/v1/staff/audit?${query}&limit=${limit}`,
  );
  const set = (key: keyof typeof filters) => (v: string) => {
    setFilters({ ...filters, [key]: v });
    setLimit(50);
  };
  return (
    <>
      <PageTitle
        title="Activity log"
        description="Every completed change in the clinic system: who, what, which record, and when."
        action={
          <Action
            variant="outline"
            run={async () => {
              const out = await call<{ items: AuditItem[]; truncated: boolean }>(
                `/api/v1/staff/audit/export?${query}`,
                { method: "POST" },
              );
              const url = URL.createObjectURL(
                new Blob(
                  [
                    toCsv([
                      ["Time", "Person", "Action", "Records", "Change", "Request"],
                      ...out.items.map((e) => [
                        e.created_at,
                        e.actor,
                        e.action,
                        Object.entries(e.targets).map(([k, v]) => `${k}: ${v}`).join(", "),
                        e.change,
                        e.request_id,
                      ]),
                    ]),
                  ],
                  { type: "text/csv" },
                ),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              if (out.truncated) throw new Error("Exported the newest 5,000 rows. Narrow the filters for the rest.");
            }}
            success="CSV downloaded"
          >
            Export CSV
          </Action>
        }
      />
      <Card className="mb-5">
        <CardContent className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6">
          <Field label="Person" id="audit-actor">
            <Input
              id="audit-actor"
              value={filters.actor}
              onChange={(e) => set("actor")(e.target.value)}
            />
          </Field>
          <Field label="Record (code or id)" id="audit-target">
            <Input
              id="audit-target"
              value={filters.target}
              onChange={(e) => set("target")(e.target.value)}
            />
          </Field>
          <Field label="Action contains" id="audit-action">
            <Input
              id="audit-action"
              value={filters.action}
              onChange={(e) => set("action")(e.target.value)}
            />
          </Field>
          <Field label="From" id="audit-start">
            <Input
              id="audit-start"
              type="date"
              value={filters.start}
              onChange={(e) => set("start")(e.target.value)}
            />
          </Field>
          <Field label="To" id="audit-end">
            <Input
              id="audit-end"
              type="date"
              value={filters.end}
              onChange={(e) => set("end")(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>
      <Resource {...log}>
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data?.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    {dateTime(e.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-normal">{e.actor}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.action}
                  </TableCell>
                  <TableCell className="whitespace-normal text-xs">
                    {Object.entries(e.targets)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="whitespace-normal text-xs">
                    {Object.entries(e.change)
                      .map(([k, v]) => `${k}: ${describe(v)}`)
                      .join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!log.data?.items.length && (
            <p className="p-6 text-sm text-muted-foreground">
              No matching activity.
            </p>
          )}
        </Card>
        {log.data?.more && (
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setLimit(Math.min(limit + 50, 200))}
            disabled={limit >= 200}
          >
            {limit >= 200
              ? "Narrow the filters or export CSV for more"
              : "Show more"}
          </Button>
        )}
      </Resource>
    </>
  );
}

type StaffRow = {
  id: string;
  name: string;
  employee_no: string;
  email: string | null;
  staff_type: string;
  status: "active" | "invited" | "disabled" | "no_login";
  is_you: boolean;
  grants: { id: string; role: string; clinic: string }[];
  phone?: string | null;
  version?: number;
};
type RoleRow = {
  id: string;
  name: string;
  built_in: boolean;
  permissions: string[];
};
type PermissionRow = { key: string; label: string; module: string };
const STAFF_TYPES = ["admin", "doctor", "nurse", "technician", "pharmacist", "support", "other"];
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Workspace settings on the HMS API: staff invited by work email, roles granted per clinic, role
 * copies with the original permission switches, and the clinic's booking policy. Sign-in itself is
 * the hospital's identity provider, so there are no passwords here.
 */
export function WorkspaceSettings({ account }: { account: { name: string; detail: string } }) {
  const permissions = usePermissions(),
    call = useApi(),
    canView = permissions.can("staff.view"),
    canCreate = permissions.can("staff.create"),
    canStatus = permissions.can("staff.status"),
    canEdit = permissions.can("staff.edit"),
    everywhere = permissions.can("access.everywhere");
  const users = useResource<StaffRow[]>(canView ? "/api/v1/staff/users" : null),
    roles = useResource<{ roles: RoleRow[]; permissions: PermissionRow[] }>(canView ? "/api/v1/staff/roles" : null);
  const blank = {
    name: "",
    employee: "",
    type: "admin",
    email: "",
    phone: "",
    role: "",
    scope: "here",
  };
  const [adding, setAdding] = useState(false),
    [form, setForm] = useState(blank),
    [person, setPerson] = useState<StaffRow | null>(null),
    [reason, setReason] = useState(""),
    [grantRoleId, setGrantRoleId] = useState(""),
    [grantScope, setGrantScope] = useState("here"),
    [roleId, setRoleId] = useState(""),
    [copying, setCopying] = useState(false),
    [copyName, setCopyName] = useState(""),
    [retiring, setRetiring] = useState(false),
    [retireReason, setRetireReason] = useState(""),
    [details, setDetails] = useState({ name: "", phone: "" }),
    [error, setError] = useState("");
  const set = (k: keyof typeof blank) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const roleOptions = (roles.data?.roles ?? []).map((r): [string, string] => [r.id, r.name]);
  const scopeOptions: [string, string][] = [
    ["here", "This clinic"],
    ...(everywhere ? [["every", "Every clinic"] as [string, string]] : []),
  ];
  const role = roles.data?.roles.find((r) => r.id === (roleId || roles.data?.roles[0]?.id));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const refreshPerson = (id: string) => {
    users.refresh();
    setReason("");
    setPerson((p) => (p?.id === id ? null : p));
  };
  const toggle = async (key: string, allowed: boolean) => {
    setError("");
    try {
      await call(`/api/v1/staff/roles/${role!.id}/permissions/${key}`, {
        method: "PUT",
        body: { allowed },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the role.");
    } finally {
      roles.refresh();
    }
  };
  return (
    <>
      <PageTitle
        title="Workspace settings"
        description="Staff accounts, roles and the clinic's booking policy are managed in one place."
      />
      <div className="grid md:grid-cols-2 gap-5 mb-7">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your account</CardTitle>
            <CardDescription>
              {account.name} · {account.detail}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Sign-in and passwords are managed by your hospital's sign-in provider. This workspace never stores
            passwords.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Optional modules</CardTitle>
            <CardDescription>
              Switch hospital modules (billing, pharmacy, WhatsApp, insurance…) on or off in Modules below.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
      {permissions.can("booking.policy") && <BookingPolicy />}
      {canView && (
        <>
          <SectionTitle
            title="Staff accounts"
            description="Each person signs in with their own work email. Access is given per clinic."
            action={
              canCreate && (
                <Button
                  onClick={() => {
                    setForm({
                      ...blank,
                      role: roles.data?.roles.find((r) => r.name === "Front desk")?.id ?? "",
                    });
                    setAdding(true);
                  }}
                >
                  <Plus />
                  Add staff member
                </Button>
              )
            }
          />
          <Resource {...users}>
            <Card className="p-0 mb-7">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Work email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data?.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="whitespace-normal">
                        {u.name}
                        {u.is_you && " (you)"}
                        <span className="block text-xs text-muted-foreground">
                          {u.employee_no} · {titleCase(u.staff_type)}
                        </span>
                      </TableCell>
                      <TableCell>{u.email ?? "—"}</TableCell>
                      <TableCell className="whitespace-normal text-xs">
                        {u.grants.map((g) => `${g.role} · ${g.clinic}`).join(", ") || "No access"}
                      </TableCell>
                      <TableCell>
                        {
                          {
                            active: "Active",
                            invited: "Invited (not signed in yet)",
                            disabled: "Disabled",
                            no_login: "No sign-in",
                          }[u.status]
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPerson(u);
                            setDetails({ name: u.name, phone: u.phone ?? "" });
                            setReason("");
                            setGrantRoleId("");
                            setGrantScope("here");
                          }}
                        >
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Resource>
          <Card className="mb-7">
            <CardHeader>
              <CardTitle className="text-base">What each role can do</CardTitle>
              <CardDescription>
                Built-in roles are shared and read-only. Make a copy to customise it, then grant the copy. Every change
                is recorded in the activity log and applies on each holder's next action.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Resource {...roles}>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-60 flex-1">
                    <Choice label="Role" value={role?.id ?? ""} onChange={setRoleId} options={roleOptions} />
                  </div>
                  {everywhere && role && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCopyName(`${role.name} (custom)`);
                        setCopying(true);
                      }}
                    >
                      Make a copy
                    </Button>
                  )}
                  {everywhere && role && !role.built_in && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRetireReason("");
                        setRetiring(true);
                      }}
                    >
                      Retire role
                    </Button>
                  )}
                </div>
                {role?.built_in && <p className="text-xs text-muted-foreground">Built-in role: read-only.</p>}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {roles.data?.permissions.map((p) => (
                  <div key={p.key} className="flex items-center justify-between gap-4">
                    <Label htmlFor={"perm-" + p.key} className="text-sm font-normal">
                      {p.label}
                      <span className="ml-2 text-xs text-muted-foreground">{p.module}</span>
                    </Label>
                    <Switch
                      id={"perm-" + p.key}
                      checked={!!role?.permissions.includes(p.key)}
                      disabled={!role || role.built_in || !everywhere}
                      onCheckedChange={(v) => void toggle(p.key, v)}
                    />
                  </div>
                ))}
              </Resource>
            </CardContent>
          </Card>
        </>
      )}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              They sign in with this work email through your hospital's sign-in provider. Check it carefully: whoever
              signs in with it gets this access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field
              label="Full name"
              id="staff-name"
              error={form.name.trim().length < 2 ? "Enter a full name with at least 2 characters." : undefined}
            >
              <Input id="staff-name" value={form.name} maxLength={100} onChange={(e) => set("name")(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Employee number"
                id="staff-employee"
                error={!/^[A-Za-z0-9._/-]{1,30}$/.test(form.employee) ? "Letters, numbers, . _ / -" : undefined}
              >
                <Input
                  id="staff-employee"
                  value={form.employee}
                  maxLength={30}
                  onChange={(e) => set("employee")(e.target.value)}
                />
              </Field>
              <Choice
                label="Staff type"
                value={form.type}
                onChange={set("type")}
                options={STAFF_TYPES.map((t) => [t, titleCase(t)])}
              />
            </div>
            <Field
              label="Work email"
              id="staff-email"
              error={!emailOk ? "Enter the email they will sign in with." : undefined}
            >
              <Input
                id="staff-email"
                type="email"
                autoComplete="off"
                value={form.email}
                maxLength={254}
                onChange={(e) => set("email")(e.target.value)}
              />
            </Field>
            <Field label="Mobile (optional)" id="staff-phone" hint="+country code, e.g. +919876543210">
              <Input
                id="staff-phone"
                type="tel"
                value={form.phone}
                pattern="\+[1-9][0-9]{7,14}"
                onChange={(e) => set("phone")(e.target.value.trim())}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                label="Role"
                value={form.role}
                onChange={set("role")}
                options={roleOptions}
                error={!form.role ? "Choose a role." : undefined}
              />
              <Choice label="Where" value={form.scope} onChange={set("scope")} options={scopeOptions} />
            </div>
            <Action
              disabled={
                form.name.trim().length < 2 || !/^[A-Za-z0-9._/-]{1,30}$/.test(form.employee) || !emailOk || !form.role
              }
              run={async () => {
                await call("/api/v1/staff/users", {
                  method: "POST",
                  body: {
                    name: form.name.trim(),
                    employee_no: form.employee,
                    staff_type: form.type,
                    email: form.email.trim(),
                    phone: form.phone,
                    role_id: form.role,
                    every_clinic: form.scope === "every",
                    idempotency_key: crypto.randomUUID(),
                  },
                });
                setAdding(false);
                users.refresh();
              }}
              success="Invited. They get access when they first sign in with that email."
            >
              Invite staff member
            </Action>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!person} onOpenChange={(v) => !v && setPerson(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{person?.name}</DialogTitle>
            <DialogDescription>
              {person?.is_you
                ? "Another administrator changes your own access."
                : "Changes apply on their next action and are recorded with your reason."}
            </DialogDescription>
          </DialogHeader>
          {canEdit && person && person.version !== undefined && (
            <div className="space-y-3 border-b pb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Full name"
                  id="staff-edit-name"
                  error={details.name.trim().length < 2 ? "Enter a full name with at least 2 characters." : undefined}
                >
                  <Input
                    id="staff-edit-name"
                    value={details.name}
                    maxLength={100}
                    onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
                  />
                </Field>
                <Field
                  label="Work phone"
                  id="staff-edit-phone"
                  error={details.phone && !/^\+[1-9][0-9]{7,14}$/.test(details.phone) ? "Use the international format, e.g. +919876543210." : undefined}
                >
                  <Input
                    id="staff-edit-phone"
                    type="tel"
                    value={details.phone}
                    placeholder="+919876543210"
                    onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value.trim() }))}
                  />
                </Field>
              </div>
              <Action
                variant="outline"
                disabled={
                  details.name.trim().length < 2 ||
                  (!!details.phone && !/^\+[1-9][0-9]{7,14}$/.test(details.phone)) ||
                  (details.name.trim() === person.name && details.phone === (person.phone ?? ""))
                }
                run={async () => {
                  await call(`/api/v1/staff/users/${person.id}`, {
                    method: "PATCH",
                    body: { version: person.version, name: details.name.trim(), phone: details.phone },
                  });
                  refreshPerson(person.id);
                }}
                success="Details saved"
              >
                Save name and phone
              </Action>
            </div>
          )}
          <div className="space-y-3">
            {person?.grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 border-b pb-2 text-sm">
                <span>
                  {g.role} · {g.clinic}
                </span>
                {/* Your own access is changed by another administrator, never by you. */}
                {!person.is_you && (
                  <Action
                    variant="ghost"
                    disabled={reason.trim().length < 3}
                    run={async () => {
                      await call(`/api/v1/staff/grants/${g.id}/revoke`, {
                        method: "POST",
                        body: { reason: reason.trim() },
                      });
                      refreshPerson(person.id);
                    }}
                    success="Access removed"
                  >
                    Remove
                  </Action>
                )}
              </div>
            ))}
            {person && !person.is_you && (
              <Field label="Reason (for removing access or changing status)" id="staff-reason">
                <Input id="staff-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
            {canStatus && person && !person.is_you && (
              <Action
                variant={person.status === "disabled" ? "outline" : "destructive"}
                disabled={reason.trim().length < 3}
                run={async () => {
                  await call(`/api/v1/staff/users/${person.id}/status`, {
                    method: "POST",
                    body: {
                      status: person.status === "disabled" ? "active" : "inactive",
                      reason: reason.trim(),
                    },
                  });
                  refreshPerson(person.id);
                }}
                success={person.status === "disabled" ? "Reactivated" : "Deactivated: their next request is refused"}
              >
                {person.status === "disabled" ? "Reactivate" : "Deactivate"}
              </Action>
            )}
          </div>
          {person && !person.is_you && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Add access</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice label="Role" value={grantRoleId} onChange={setGrantRoleId} options={roleOptions} />
                <Choice label="Where" value={grantScope} onChange={setGrantScope} options={scopeOptions} />
              </div>
              <Action
                disabled={!grantRoleId}
                run={async () => {
                  await call(`/api/v1/staff/users/${person.id}/grants`, {
                    method: "POST",
                    body: {
                      role_id: grantRoleId,
                      every_clinic: grantScope === "every",
                      idempotency_key: crypto.randomUUID(),
                    },
                  });
                  refreshPerson(person.id);
                }}
                success="Access added"
              >
                Add access
              </Action>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={copying} onOpenChange={setCopying}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy {role?.name}</DialogTitle>
            <DialogDescription>
              The copy starts with the same permissions and can then be edited and granted.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name" id="role-name" error={copyName.trim().length < 2 ? "Enter a name." : undefined}>
            <Input id="role-name" value={copyName} maxLength={60} onChange={(e) => setCopyName(e.target.value)} />
          </Field>
          <Action
            disabled={copyName.trim().length < 2}
            run={async () => {
              const made = await call<{ roleId: string }>("/api/v1/staff/roles", {
                method: "POST",
                body: {
                  name: copyName.trim(),
                  copy_of: role!.id,
                  idempotency_key: crypto.randomUUID(),
                },
              });
              setCopying(false);
              setRoleId(made.roleId);
              roles.refresh();
            }}
            success="Role copied"
          >
            Make a copy
          </Action>
        </DialogContent>
      </Dialog>
      <Dialog open={retiring} onOpenChange={setRetiring}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retire {role?.name}</DialogTitle>
            <DialogDescription>
              Nobody can be given this role afterwards. Remove it from everyone who holds it first; the change is
              recorded in the activity log.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason" id="retire-reason" error={retireReason.trim().length < 3 ? "Give a reason." : undefined}>
            <Input id="retire-reason" value={retireReason} maxLength={500} onChange={(e) => setRetireReason(e.target.value)} />
          </Field>
          <Action
            variant="destructive"
            disabled={retireReason.trim().length < 3}
            run={async () => {
              await call(`/api/v1/staff/roles/${role!.id}/retire`, { method: "POST", body: { reason: retireReason.trim() } });
              setRetiring(false);
              setRoleId("");
              roles.refresh();
            }}
            success="Role retired"
          >
            Retire role
          </Action>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BookingPolicy() {
  const call = useApi(),
    policy = useResource<{ overbooking: boolean }>("/api/v1/admin/booking-policy"),
    [error, setError] = useState("");
  return (
    <Card className="mb-7">
      <CardHeader>
        <CardTitle className="text-base">Appointment booking policy</CardTitle>
        <CardDescription>
          Administrator setting for this clinic. Staff follow this policy automatically when booking or moving
          appointments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Resource {...policy}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="policy-overbooking">Allow overlapping appointments</Label>
              <p className="mt-2 text-xs text-muted-foreground">
                Allow up to three simultaneous visits at the same clinic. Reception coordinates arrivals. Blocked time,
                active holds and other-clinic conflicts remain protected.
              </p>
            </div>
            <Switch
              id="policy-overbooking"
              checked={policy.data?.overbooking ?? false}
              onCheckedChange={async (v) => {
                setError("");
                try {
                  await call("/api/v1/admin/booking-policy", {
                    method: "PUT",
                    body: { overbooking: v },
                  });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not update the setting.");
                } finally {
                  policy.refresh();
                }
              }}
            />
          </div>
        </Resource>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

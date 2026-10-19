import type { DirectoryPerson } from "@/components/arc/team-directory/team-directory";

export type StaffRow = {
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
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STAFF_STATUS: Record<StaffRow["status"], string> = {
  active: "Active",
  invited: "Invited (not signed in yet)",
  disabled: "Disabled",
  no_login: "No sign-in",
};
export function directoryPeople(rows: StaffRow[]): DirectoryPerson[] {
  return rows.map((u) => ({
    id: u.id,
    name: u.is_you ? `${u.name} (you)` : u.name,
    role: [...new Set(u.grants.map((g) => g.role))].join(", ") || "No access",
    team: titleCase(u.staff_type),
    available: u.status === "active",
    statusLabel: STAFF_STATUS[u.status],
    facts: [
      { label: "Employee no.", value: u.employee_no },
      { label: "Access", value: u.grants.map((g) => `${g.role} · ${g.clinic}`).join(", ") || "No access" },
    ],
    email: u.email,
    keywords: `${u.employee_no} ${u.email ?? ""} ${u.grants.map((g) => g.clinic).join(" ")}`,
  }));
}

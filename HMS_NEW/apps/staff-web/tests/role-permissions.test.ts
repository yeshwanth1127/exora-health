import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRolePermissions } from "../src/hms/role-permissions.ts";

test("role review describes the exact granted permissions, including unknown future permissions", () => {
  const codes = ["appointments.read", "appointments.book", "future_records.export", "staff.manage"];
  const groups = describeRolePermissions(codes, [
    { code: "appointments.read", module: "appointments", description: "View appointments and queues" },
    { code: "appointments.book", module: "appointments", description: "Book appointments" },
    { code: "patients.merge", module: "patients", description: "Merge patient records" },
    { code: "staff.manage", module: "access", description: "Manage staff accounts" },
  ]);
  assert.deepEqual(groups.flatMap((group) => group.permissions.map((permission) => permission.code)).sort(), [...codes].sort());
  assert.equal(groups[0].permissions[0].description, "View appointments and queues");
  assert.equal(groups.find((group) => group.module === "Additional access")?.permissions[0].description, "Export future records");
  assert.ok(!JSON.stringify(groups).includes("Merge patient records"));
  assert.deepEqual(describeRolePermissions([], []), []);
});

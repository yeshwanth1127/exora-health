import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";
const opts = { parentURL: import.meta.url, tsconfig: fileURLToPath(new URL("../tsconfig.app.json", import.meta.url)) };
const { ReleaseReadiness } = await tsImport("../src/components/arc/release-readiness/release-readiness.tsx", opts);
const { TeamDirectory } = await tsImport("../src/components/arc/team-directory/team-directory.tsx", opts);
const { SplitBar } = await tsImport("../src/components/arc/split-bar/split-bar.tsx", opts);
const { SkeletonMorph, MorphBlock } = await tsImport("../src/components/arc/skeleton-morph/skeleton-morph.tsx", opts);
const { readinessTasks } = await tsImport("../src/hms/setup-readiness.ts", opts);
const { directoryPeople } = await tsImport("../src/modules/staff-directory.ts", opts);
const { splitSegments } = await tsImport("../src/modules/split-segments.ts", opts);

test("release readiness checks are server-derived and read-only", () => {
  const tasks = readinessTasks([
    { id: "clinic", title: "Clinic details", state: "complete", detail: "Saved", destination: "settings", permission: "facility.manage" },
    { id: "hours", title: "Doctor hours", state: "unknown", detail: "Hidden", destination: "schedules", permission: "schedules.manage" },
  ]);
  assert.deepEqual(tasks.map((t: { done: boolean }) => t.done), [true, false]);
  assert.ok(tasks[1].detail.startsWith("Evidence unavailable · "));
  assert.ok(!tasks[1].detail.includes("Hidden"), "unknown evidence never shows the missing-config detail");
  const html = render(h(ReleaseReadiness, { title: "Booking setup", tasks, actionLabel: "Recheck saved setup", onAction: async () => "ok" }));
  assert.ok(html.includes("1 check left"));
  assert.ok(html.includes('aria-valuenow="1"') && html.includes('aria-valuemax="2"'));
  assert.equal(html.match(/aria-readonly="true"/g)?.length, 2);
  assert.ok(html.includes("Recheck saved setup"));
  assert.ok(!/notify|Start release/i.test(html));
});

test("team directory maps staff rows truthfully", () => {
  const people = directoryPeople([
    { id: "1", name: "Priya", employee_no: "E1", email: "p@x.in", staff_type: "admin", status: "active", is_you: true, grants: [{ id: "g", role: "Admin", clinic: "Main" }] },
    { id: "2", name: "Ravi", employee_no: "E2", email: null, staff_type: "nurse", status: "invited", is_you: false, grants: [] },
  ]);
  assert.equal(people[0].name, "Priya (you)");
  assert.equal(people[0].team, "Admin");
  assert.equal(people[1].available, false);
  assert.equal(people[1].statusLabel, "Invited (not signed in yet)");
  assert.equal(people[1].role, "No access");
  const html = render(h(TeamDirectory, { people: [people[1]], title: "Staff" }));
  assert.ok(!html.includes("Copy email"), "no email row without an email");
  assert.ok(html.includes("Invited (not signed in yet)"));
});

test("appointment health split bar humanizes server labels and keeps raw ids", () => {
  const segments = splitSegments([{ label: "no_show", value: 2 }, { label: "confirmed", value: 6 }]);
  assert.deepEqual(segments[0], { id: "no_show", label: "No show", value: 2 });
  const html = render(h(SplitBar, { title: "By status", segments, unit: "appointments" }));
  assert.ok(html.includes("No show") && html.includes("Confirmed"));
});

test("skeleton morph hides content while loading", () => {
  const html = render(h(SkeletonMorph, { loading: true }, h(MorphBlock, { height: 20 }, "Secret value")));
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(!html.includes("Secret value"));
});

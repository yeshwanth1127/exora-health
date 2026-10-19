import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectedWorkspaceTab,
  workspaceTabRoute,
  workspaceActiveRoute,
  workspaceChildren,
  workspaceTabs,
  isRoutedWorkspace,
} from "../src/hms/workspace-navigation.ts";
import { LeaveState } from "../src/hms/leave-state.ts";

test("all workspace sections have unique destinations and share sidebar/tab selection", () => {
  const all: string[] = [];
  for (const workspace of Object.keys(
    workspaceTabs,
  ) as (keyof typeof workspaceTabs)[]) {
    const children = workspaceChildren(workspace)!;
    assert.equal(children.length, workspaceTabs[workspace].length);
    for (const child of children) {
      const query = child.id.slice(child.id.indexOf("?"));
      assert.equal(workspaceActiveRoute(workspace, query), child.id);
      assert.equal(
        workspaceActiveRoute(
          workspace,
          `${query}&conversation=record-id&section=hours`,
        ),
        child.id,
      );
      all.push(child.id);
    }
  }
  assert.equal(new Set(all).size, all.length);
});
test("legacy and malformed links use each workspace’s safe default", () => {
  assert.equal(selectedWorkspaceTab("whatsapp", "?tab=inbox"), "inbox");
  assert.equal(selectedWorkspaceTab("loyalty", "?tab=settings"), "programs");
  assert.equal(selectedWorkspaceTab("voice", ""), "history");
  assert.equal(
    selectedWorkspaceTab("growth_analytics", "?tab=__proto__"),
    "overview",
  );
  assert.equal(isRoutedWorkspace("__proto__"), false);
  assert.equal(workspaceActiveRoute("operations", ""), "activity");
  assert.equal(workspaceActiveRoute("patients", ""), "patients");
  assert.equal(workspaceChildren("patients"), undefined);
});
test("record and editor deep links encode their arguments without changing the selected section", () => {
  const route = workspaceTabRoute("google_business", "profile", {
    section: "hours & holidays",
    tab: "reviews",
  });
  const search = route.slice(route.indexOf("?"));
  assert.equal(new URLSearchParams(search).get("section"), "hours & holidays");
  assert.equal(selectedWorkspaceTab("google_business", search), "profile");
  assert.equal(
    workspaceTabRoute("whatsapp", "automations", { id: "staff_reply" }),
    "whatsapp?id=staff_reply&tab=automations",
  );
});
test("appointments retain their existing children and contextual view switches stay inside their page", () => {
  assert.deepEqual(
    workspaceChildren("appointments")?.map((c) => c.id),
    ["appointments", "waitlist", "queue"],
  );
  assert.deepEqual(
    workspaceChildren("voice")?.map((c) => c.label),
    ["Call history", "Call setup"],
  );
  assert.equal(workspaceChildren("settings"), undefined);
  assert.equal(workspaceChildren("catalogue"), undefined);
});
test("shared navigation waits for dirty/pending decisions and cancellation keeps the original destination", () => {
  const state = new LeaveState();
  let route = "whatsapp?tab=inbox";
  const dirty = state.register();
  state.request(() => {
    route = workspaceTabRoute("whatsapp", "settings");
  });
  assert.equal(route, "whatsapp?tab=inbox");
  state.stay();
  assert.equal(route, "whatsapp?tab=inbox");
  state.request(() => {
    route = workspaceTabRoute("whatsapp", "settings");
  });
  state.discard();
  assert.equal(route, "whatsapp?tab=settings");
  dirty();
  const pending = state.register(true);
  state.request(() => {
    route = workspaceTabRoute("voice", "setup");
  });
  state.discard();
  assert.equal(route, "whatsapp?tab=settings");
  pending();
  state.discard();
  assert.equal(route, "voice?tab=setup");
});

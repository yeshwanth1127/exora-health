import test from "node:test";
import assert from "node:assert/strict";
import { LeaveState } from "../src/hms/leave-state";
test("clean navigation proceeds, dirty navigation waits and cancel preserves task", () => {
  const state = new LeaveState();
  let visits = 0;
  state.request(() => visits++);
  assert.equal(visits, 1);
  const remove = state.register();
  state.request(() => visits++);
  assert.equal(state.isPending(), true);
  assert.equal(visits, 1);
  state.stay();
  assert.equal(visits, 1);
  assert.equal(state.isDirty(), true);
  remove();
  state.request(() => visits++);
  assert.equal(visits, 2);
});
test("one discard executes the original destination once even with competing navigation", () => {
  const state = new LeaveState();
  state.register();
  const visits: string[] = [];
  state.request(() => visits.push("original"));
  state.request(() => visits.push("later"));
  state.discard();
  state.discard();
  assert.deepEqual(visits, ["original"]);
});
test("multiple dirty forms remain protected until each unmounts", () => {
  const state = new LeaveState();
  const a = state.register(),
    b = state.register();
  a();
  assert.equal(state.isDirty(), true);
  b();
  assert.equal(state.isDirty(), false);
});
test("pending or uncertain writes cannot be discarded into a new task", () => {
  const state = new LeaveState();
  const release = state.register(true);
  let left = false;
  state.request(() => {
    left = true;
  });
  state.discard();
  assert.equal(state.isPending(), true);
  assert.equal(left, false);
  release();
  state.discard();
  assert.equal(left, true);
});
test("approved nested dismissal and navigation share one discard decision", () => {
  const state = new LeaveState();
  state.register();
  let left = 0;
  state.request(() => state.request(() => left++));
  state.discard();
  assert.equal(left, 1);
  assert.equal(state.isPending(), false);
  // Approval expires when that synchronous transition ends.
  state.request(() => left++);
  assert.equal(state.isPending(), true);
  assert.equal(left, 1);
});

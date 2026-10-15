import assert from "node:assert/strict";
import test from "node:test";
import { addMonths, DAY, lower, memberNo, mobile, programIssues, renewUntil, seed, standing, status, templates, tierFor, visit, type Enrollment, type Entry, type Program } from "../src/hms/loyalty-program.ts";

const now = Date.UTC(2026, 9, 15, 6);
const program = (kind: keyof typeof templates): Program => ({ id: kind, name: "X", color: "slate", status: "live", createdAt: 0, config: structuredClone(templates[kind].config) });
const en: Enrollment = { programId: "", memberId: "m", since: now - 100 * DAY };
const e = (type: Entry["type"], at: number, extra: Partial<Entry> = {}): Entry => ({ id: Math.random().toString(36), at, memberId: "m", programId: extra.programId ?? "", type, by: "t", ...extra });

test("every template can go live, and broken programs say why", () => {
  for (const t of Object.values(templates)) assert.deepEqual(programIssues(t), []);
  const tiers = program("tiers");
  if (tiers.config.kind === "tiers") tiers.config.tiers[2].visits = 3;
  assert.deepEqual(programIssues(tiers), ["Each tier needs more visits than the one before."]);
  assert.ok(programIssues({ ...program("points"), name: " " }).includes("Give the program a name."));
});

test("membership perks count down within the membership year and status follows the end date", () => {
  const p = program("membership");
  const m: Enrollment = { ...en, programId: p.id, until: addMonths(now - 100 * DAY, 12) };
  const uses = [e("use", now - 200 * DAY, { programId: p.id, ref: "p1" }), ...[1, 2, 3].map((d) => e("use", now - d * DAY, { programId: p.id, ref: "p1" }))];
  const s = standing(p, m, uses, now);
  assert.equal(s.kind === "membership" && s.perks[0].left, 0, "the use from last year doesn't count");
  assert.equal(s.kind === "membership" && s.perks[1].left, null);
  assert.equal(status({ ...m, until: now + 10 * DAY }, now), "expiring");
  assert.equal(status({ ...m, until: now - DAY }, now), "expired");
  assert.equal(status({ ...m, cancelled: now }, now), "cancelled");
  assert.equal(renewUntil(now + 10 * DAY, 12, now), addMonths(now + 10 * DAY, 12), "early renewal extends from the end date");
  assert.equal(renewUntil(now - 10 * DAY, 12, now), addMonths(now, 12), "late renewal starts today");
});

test("points, stamps and tiers come from the ledger", () => {
  const pts = program("points");
  const s = standing(pts, { ...en, programId: "points" }, [e("earn", now, { programId: "points", points: 250 }), e("redeem", now, { programId: "points", points: -200 })], now);
  assert.equal(s.kind === "points" && s.balance, 50);
  assert.equal(s.kind === "points" && s.toNext, 150);

  const st = program("stamps");
  const five = [1, 2, 3, 4, 5].map((d) => e("stamp", now - d * DAY, { programId: "stamps" }));
  const full = standing(st, { ...en, programId: "stamps" }, five, now);
  assert.equal(full.kind === "stamps" && full.ready, true);
  const fresh = standing(st, { ...en, programId: "stamps" }, [...five, e("stamp_reward", now - DAY / 2, { programId: "stamps" })], now);
  assert.equal(fresh.kind === "stamps" && fresh.count, 0, "giving the reward starts a fresh card");

  const tiers = program("tiers").config;
  assert.ok(tiers.kind === "tiers");
  assert.deepEqual([0, 3, 4, 9].map((v) => tierFor(tiers.tiers, v).tier.name), ["Silver", "Silver", "Gold", "Platinum"]);
  assert.equal(tierFor(tiers.tiers, 3).toNext, 1);
  const old = [e("visit", now - 400 * DAY), ...[1, 2, 3, 4].map((d) => e("visit", now - d * DAY))];
  const t = standing(program("tiers"), { ...en, programId: "tiers" }, old, now);
  assert.equal(t.kind === "tiers" && t.tier.name, "Gold", "only the last 12 months count");
});

test("a recorded visit feeds live points and stamp programs, and the seed is consistent", () => {
  const d = seed("Sri Lakshmi Super Speciality", now);
  assert.equal(d.members[0].no, "SL-0001");
  const out = visit(d, "m1", "t", now);
  assert.deepEqual(out.map((x) => x.type).sort(), ["earn", "stamp", "visit"]);
  assert.equal(visit(d, "m10", "t", now).length, 2, "Arjun has no stamp card");
  for (const en of d.enrollments) {
    const s = standing(d.programs.find((p) => p.id === en.programId)!, en, d.entries, now);
    if (s.kind === "points") assert.ok(s.balance >= 0);
  }
  assert.equal(mobile("098450 12345"), "+91 98450 12345");
  assert.equal(mobile("12345"), null);
  assert.equal(memberNo("exora", 7), "EX-0007");
  assert.equal(lower("Free BP check"), "free BP check");
  assert.equal(lower("BP check"), "BP check");
});

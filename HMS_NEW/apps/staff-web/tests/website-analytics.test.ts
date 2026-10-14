import { test } from "node:test";
import assert from "node:assert/strict";
import { posthogIssues, progress, sameSite, seed, siteUrl, summarize, total } from "../src/hms/website-analytics.ts";

const clinic = { facilityId: "3f1c0a5e-1111-4222-8333-944455556666", bookUrl: "https://app.example.test/staff/book.html?branch=x", doctors: ["Dr. Asha Rao", "Dr Kiran Patel"] };

test("website addresses normalise to an origin and reject non-addresses", () => {
  assert.equal(siteUrl("srilakshmi.in"), "https://srilakshmi.in");
  assert.equal(siteUrl(" https://www.x.co.in/about?y=1 "), "https://www.x.co.in");
  for (const bad of ["", "hello", "my clinic.com", "localhost", "ftp://x.com"]) assert.equal(siteUrl(bad), null, bad);
  assert.ok(sameSite("https://www.x.com", "https://x.com"));
});

test("PostHog keys are checked by shape", () => {
  assert.equal(posthogIssues({ projectId: "84213", projectKey: `phc_${"a".repeat(30)}`, readKey: `phx_${"b".repeat(30)}` }).length, 0);
  assert.equal(posthogIssues({ projectId: "abc", projectKey: "phx_nope", readKey: "phc_wrong" }).length, 3);
});

test("a range is compared with the same number of days before it", () => {
  const d = seed(clinic, Date.UTC(2026, 9, 14));
  assert.equal(d.days.length, 120);
  const { series, now, before } = summarize(d.days, 30);
  assert.equal(series.length, 30);
  assert.equal(now.visitors, total(d.days.slice(-30)).visitors);
  assert.equal(before.visitors, total(d.days.slice(-60, -30)).visitors);
  for (const day of d.days) {
    assert.equal(Object.values(day.sources).reduce((a, b) => a + b, 0), day.visitors, "sources add up to visitors");
    assert.ok(day.booked <= day.started && day.started <= day.visitors);
  }
  assert.deepEqual(seed(clinic, Date.UTC(2026, 9, 14)).days, d.days, "same clinic, same sample");
  assert.equal(d.pages.find((p) => p.title === "Dr. Asha Rao")?.path, "/doctors/asha-rao");
});

test("checks go live and PostHog connects; nothing pending returns the same object", () => {
  const d = { ...seed(clinic, 0), sites: [{ id: "a", url: "https://x.com", kind: "own" as const, status: "checking" as const, addedAt: 0, checkAt: 0 }] };
  const linked = { ...d, posthog: { region: "eu" as const, projectId: "1", keyEnd: "abcd", readKeyEnd: "wxyz", status: "testing" as const, since: 0 } };
  const s = progress(linked, 1000);
  assert.equal(s, linked, "too early");
  const later = progress(linked, 5000);
  assert.equal(later.sites[0].status, "live");
  assert.equal(later.posthog?.status, "connected");
  assert.equal(progress(later, 9000), later);
});

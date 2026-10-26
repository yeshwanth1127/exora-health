import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeHours,
  descriptionIssues,
  draftDescription,
  hoursFromSessions,
  privacyIssues,
  progress,
  score,
  seed,
  suggestCategories,
  tasks,
  type Paperwhale,
} from "../src/hms/google-profile.ts";

const weekday = (open: string, close: string) => [0, 1, 2, 3, 4, 5].map((day) => ({ day, open, close }));
const exora: Paperwhale = {
  name: "Sri Lakshmi Hospital",
  phone: "+91 40 4000 1000",
  address: "Road 1, Hyderabad",
  city: "Hyderabad",
  facilityType: "hospital",
  hours: weekday("09:00", "20:00"),
  specialities: ["Cardiology", "Orthopaedics", "General Medicine"],
  services: [{ name: "Consultation", price: 500 }, { name: "ECG", price: 300 }, { name: "Health check", price: 2500 }],
  doctors: 12,
  bookUrl: "https://example.test/book",
  whatsappUrl: "https://wa.me/919800000000?text=Hi",
};

test("clinic hours are the widest window each weekday across doctors", () => {
  // 2026-10-19 is a Monday.
  const h = hoursFromSessions([
    { sessionOn: "2026-10-19", open: "10:00", close: "13:00" },
    { sessionOn: "2026-10-19", open: "09:00", close: "12:00" },
    { sessionOn: "2026-10-19", open: "17:00", close: "20:00" },
    { sessionOn: "2026-10-25", open: "09:00", close: "13:00" },
  ]);
  assert.deepEqual(h, [{ day: 0, open: "09:00", close: "20:00" }, { day: 6, open: "09:00", close: "13:00" }]);
  assert.equal(describeHours(weekday("09:00", "20:00")), "Mon–Sat 9 am–8 pm · Sun Closed");
});

test("specialities map to Google categories without duplicates", () => {
  assert.deepEqual(suggestCategories(["Cardiology", "Heart care", "Orthopaedics", "Unknown"]), ["Cardiologist", "Orthopedic surgeon"]);
});

test("the drafted description passes Google's rules", () => {
  const d = draftDescription(exora);
  assert.ok(d.length >= 250 && d.length <= 750, `length ${d.length}`);
  assert.deepEqual(descriptionIssues(d), []);
  assert.equal(descriptionIssues("Call 9876543210 or visit www.x.com BEST hospital").length, 2);
});

test("replies that reveal a patient or health details are flagged", () => {
  assert.deepEqual(privacyIssues("Thank you for the kind words."), []);
  assert.deepEqual(privacyIssues("Glad your surgery and your visit went well"), ["surgery", "your visit"]);
});

test("the score rises as one-tap fixes are applied", () => {
  const d = seed(exora, Date.now());
  const before = score(tasks(d, exora, Date.now()));
  const fixed = { ...d, listing: { ...d.listing, bookUrl: exora.bookUrl, whatsappUrl: exora.whatsappUrl, hours: exora.hours, phone: exora.phone } };
  const t = tasks(fixed, exora, Date.now());
  assert.equal(score(t), before + 15 + 10 + 10 + 5);
  assert.ok(t.findIndex((x) => x.done) > t.findIndex((x) => !x.done), "open items come first");
});

test("edits Google re-checks clear after review, and scheduled posts go live", () => {
  const d = seed(exora, 0);
  const s = progress({ ...d, checking: { name: 0 }, posts: [{ ...d.posts[0], status: "scheduled", at: 5000 }] }, 9000);
  assert.deepEqual(s.checking, {});
  assert.equal(s.posts[0].status, "live");
  assert.equal(progress(s, 9500), s, "nothing pending returns the same object");
});

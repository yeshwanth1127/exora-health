// Loyalty programs model. Pure: no React, so it runs under node:test.
// Exora never handles money: fees and discounts stay with the clinic's billing, Exora records what was earned and used.

export const DAY = 86_400_000;

export type Kind =
  "membership" | "points" | "stamps" | "referral" | "tiers" | "wellness";
export type Color = "emerald" | "sky" | "violet" | "amber" | "rose" | "slate";

/** `limit` is per membership year; null means use it as often as you like (e.g. "10% off lab tests"). */
export type Perk = { id: string; label: string; limit: number | null };
export type Reward = { id: string; label: string; cost: number };
export type Tier = { name: string; visits: number; perks: string };
export type Goal = { id: string; label: string; reward: string };

export type Config =
  | {
      kind: "membership";
      fee: number;
      months: 6 | 12;
      people: number;
      perks: Perk[];
    }
  | {
      kind: "points";
      visit: number;
      checkup: number;
      referral: number;
      review: number;
      rewards: Reward[];
    }
  | { kind: "stamps"; every: number; counts: string; reward: string }
  | {
      kind: "referral";
      forReferrer: string;
      forFriend: string;
      perYear: number;
    }
  | { kind: "tiers"; tiers: Tier[] }
  | { kind: "wellness"; goals: Goal[] };

export type Program = {
  id: string;
  name: string;
  color: Color;
  status: "draft" | "live" | "paused";
  createdAt: number;
  config: Config;
};
export type Member = {
  id: string;
  no: string;
  name: string;
  phone: string;
  joinedAt: number;
};
export type Enrollment = {
  programId: string;
  memberId: string;
  since: number;
  until?: number;
  family?: string[];
  cancelled?: number;
};
/**
 * One ledger for every program. `ref` is a perk, reward or goal id, or the referral entry a "referral_done" closes.
 * Balances are always computed from it, never stored.
 */
export type Entry = {
  id: string;
  at: number;
  memberId: string;
  programId: string;
  type:
    | "visit"
    | "earn"
    | "redeem"
    | "stamp"
    | "stamp_reward"
    | "use"
    | "referral"
    | "referral_done"
    | "goal"
    | "renew";
  ref?: string;
  points?: number;
  note?: string;
  by: string;
};
export type LoyaltyData = {
  v: 1;
  programs: Program[];
  members: Member[];
  enrollments: Enrollment[];
  entries: Entry[];
  next: number;
};

export const empty = (): LoyaltyData => ({
  v: 1,
  programs: [],
  members: [],
  enrollments: [],
  entries: [],
  next: 1,
});
export const uid = () => Math.random().toString(36).slice(2, 10);
export const kinds: Kind[] = [
  "membership",
  "points",
  "stamps",
  "referral",
  "tiers",
  "wellness",
];

export const templates: Record<
  Kind,
  {
    title: string;
    pitch: string;
    inspired: string;
    name: string;
    color: Color;
    config: Config;
  }
> = {
  membership: {
    title: "Health membership",
    pitch: "Patients join for a yearly fee and get perks for the whole family.",
    inspired:
      "Like Apollo 24|7 Circle, Practo Plus and the family health cards clinics already sell.",
    name: "Care membership",
    color: "emerald",
    config: {
      kind: "membership",
      fee: 999,
      months: 12,
      people: 4,
      perks: [
        { id: "p1", label: "Free follow-up consultation", limit: 3 },
        { id: "p2", label: "10% off lab tests", limit: null },
        { id: "p3", label: "Annual health check-up", limit: 1 },
      ],
    },
  },
  points: {
    title: "Points",
    pitch:
      "Earn points for visits, check-ups, referrals and reviews. Spend them on rewards.",
    inspired: "Like Apollo HealthCredits and Starbucks Rewards.",
    name: "Care rewards",
    color: "violet",
    config: {
      kind: "points",
      visit: 50,
      checkup: 100,
      referral: 150,
      review: 50,
      rewards: [
        { id: "r1", label: "Free BP and sugar check", cost: 200 },
        { id: "r2", label: "Free dietitian session", cost: 400 },
        { id: "r3", label: "Free follow-up consultation", cost: 600 },
      ],
    },
  },
  stamps: {
    title: "Visit stamps",
    pitch: "Every visit is a stamp. A full card earns a reward.",
    inspired:
      "Like a café punch card, and the “5th visit free” cards dental and physio clinics hand out.",
    name: "Visit card",
    color: "amber",
    config: {
      kind: "stamps",
      every: 5,
      counts: "Any visit",
      reward: "Free follow-up consultation",
    },
  },
  referral: {
    title: "Referrals",
    pitch: "When a friend's first visit is done, both of them get a reward.",
    inspired:
      "Like Uber and Airbnb invite credits, and “bring a friend” clinic offers.",
    name: "Bring a friend",
    color: "sky",
    config: {
      kind: "referral",
      forReferrer: "Free BP and sugar check",
      forFriend: "Free first consultation",
      perYear: 5,
    },
  },
  tiers: {
    title: "Status tiers",
    pitch:
      "Regular patients move up from Silver to Gold to Platinum, with better perks at each level.",
    inspired: "Like airline status and Marriott Bonvoy.",
    name: "Patient status",
    color: "slate",
    config: {
      kind: "tiers",
      tiers: [
        {
          name: "Silver",
          visits: 0,
          perks: "Birthday wishes and health tips on WhatsApp",
        },
        { name: "Gold", visits: 4, perks: "Priority appointment slots" },
        {
          name: "Platinum",
          visits: 8,
          perks: "Priority slots and a free yearly check-up",
        },
      ],
    },
  },
  wellness: {
    title: "Wellness goals",
    pitch:
      "Reward patients for looking after their health, not just for visiting.",
    inspired:
      "Like Discovery Vitality and the wellness rewards Indian health insurers now give.",
    name: "Healthy year",
    color: "rose",
    config: {
      kind: "wellness",
      goals: [
        {
          id: "g1",
          label: "Yearly health check-up",
          reward: "Free dietitian session",
        },
        {
          id: "g2",
          label: "Flu vaccine this season",
          reward: "Free BP and sugar check",
        },
        {
          id: "g3",
          label: "Diabetes review every 3 months",
          reward: "10% off the next lab test",
        },
      ],
    },
  },
};

/** "Free BP check" → "free BP check" mid-sentence, without touching acronyms. */
export const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
/** One line under the program name. */
export function summary(c: Config) {
  switch (c.kind) {
    case "membership":
      return `${c.fee ? money(c.fee) : "Free"} for ${c.months} months · ${c.people === 1 ? "1 person" : `up to ${c.people} people`} · ${c.perks.length} perks`;
    case "points":
      return `${c.visit} points a visit · ${c.rewards.length} rewards${c.rewards.length ? ` from ${Math.min(...c.rewards.map((r) => r.cost))} points` : ""}`;
    case "stamps":
      return `${c.every} visits → ${c.reward}`;
    case "referral":
      return `${c.forReferrer} for them, ${lower(c.forFriend)} for the friend`;
    case "tiers":
      return c.tiers.map((t) => t.name).join(" → ");
    case "wellness":
      return `${c.goals.length} goals this year`;
  }
}

/** Plain-language reasons a program can't go live yet. */
export function programIssues(p: Pick<Program, "name" | "config">) {
  const c = p.config;
  const out: string[] = [];
  if (!p.name.trim()) out.push("Give the program a name.");
  if (c.kind === "membership") {
    if (!Number.isInteger(c.fee) || c.fee < 0 || c.fee > 100_000)
      out.push(
        "The fee is a whole number of rupees, up to ₹1,00,000. Use 0 for a free membership.",
      );
    if (c.people < 1 || c.people > 6)
      out.push("A membership covers 1 to 6 people.");
    if (!c.perks.length) out.push("Add at least one perk.");
    if (c.perks.some((x) => !x.label.trim()))
      out.push("Every perk needs a description.");
    if (
      c.perks.some(
        (x) =>
          x.limit !== null &&
          (!Number.isInteger(x.limit) || x.limit < 1 || x.limit > 50),
      )
    )
      out.push("A yearly limit is between 1 and 50.");
  }
  if (c.kind === "points") {
    if (
      [c.visit, c.checkup, c.referral, c.review].some(
        (n) => !Number.isInteger(n) || n < 0 || n > 10_000,
      )
    )
      out.push("Points are whole numbers up to 10,000.");
    if (!c.visit) out.push("Give at least some points for a visit.");
    if (!c.rewards.length) out.push("Add at least one reward.");
    if (
      c.rewards.some(
        (r) => !r.label.trim() || !Number.isInteger(r.cost) || r.cost < 1,
      )
    )
      out.push("Every reward needs a description and a points cost.");
  }
  if (c.kind === "stamps") {
    if (!Number.isInteger(c.every) || c.every < 2 || c.every > 20)
      out.push("A card holds 2 to 20 stamps.");
    if (!c.reward.trim()) out.push("Say what a full card earns.");
  }
  if (c.kind === "referral") {
    if (!c.forReferrer.trim() || !c.forFriend.trim())
      out.push("Say what the patient and their friend each get.");
    if (!Number.isInteger(c.perYear) || c.perYear < 1 || c.perYear > 50)
      out.push("Allow between 1 and 50 rewarded referrals a year.");
  }
  if (c.kind === "tiers") {
    if (c.tiers.length < 2) out.push("Add at least two tiers.");
    if (c.tiers.some((t) => !t.name.trim() || !t.perks.trim()))
      out.push("Every tier needs a name and its perks.");
    if (c.tiers.some((t, i) => i > 0 && t.visits <= c.tiers[i - 1].visits))
      out.push("Each tier needs more visits than the one before.");
  }
  if (c.kind === "wellness") {
    if (!c.goals.length) out.push("Add at least one goal.");
    if (c.goals.some((g) => !g.label.trim() || !g.reward.trim()))
      out.push("Every goal needs a description and a reward.");
  }
  return out;
}

/** Indian mobile → "+91 98765 43210"; null when it isn't one. */
export function mobile(input: string) {
  const d = input.replace(/[\s-]/g, "").replace(/^(\+91|0091|0)/, "");
  return /^[6-9]\d{9}$/.test(d) ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : null;
}
export const memberNo = (clinic: string, n: number) =>
  `${(
    clinic
      .match(/\b[A-Z]/g)
      ?.slice(0, 2)
      .join("") || "EX"
  ).padEnd(2, "X")}-${String(n).padStart(4, "0")}`;

export function addMonths(at: number, months: number) {
  const d = new Date(at);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}
export const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();
/** Renewing early extends from the end date; renewing after expiry starts from today. */
export const renewUntil = (until: number, months: number, now: number) =>
  addMonths(Math.max(until, now), months);

export type Status = "active" | "expiring" | "expired" | "cancelled";
export function status(en: Enrollment, now: number): Status {
  if (en.cancelled) return "cancelled";
  if (en.until === undefined) return "active";
  return en.until < now
    ? "expired"
    : en.until - now <= 30 * DAY
      ? "expiring"
      : "active";
}

export function tierFor(tiers: Tier[], visits: number) {
  const i = Math.max(
    0,
    tiers.findLastIndex((t) => visits >= t.visits),
  );
  const next = tiers[i + 1];
  return { tier: tiers[i], next, toNext: next ? next.visits - visits : 0 };
}

/** Where one member stands in one program. `entries` may hold anyone's; they're filtered here. */
export function standing(
  p: Program,
  en: Enrollment,
  all: Entry[],
  now: number,
) {
  const entries = all.filter(
    (e) => e.programId === p.id && e.memberId === en.memberId,
  );
  const of = (t: Entry["type"]) => entries.filter((e) => e.type === t);
  const c = p.config;
  switch (c.kind) {
    case "membership": {
      const start = en.until ? addMonths(en.until, -c.months) : en.since;
      const perks = c.perks.map((perk) => {
        const used = of("use").filter(
          (e) => e.ref === perk.id && e.at >= start,
        ).length;
        return {
          perk,
          used,
          left: perk.limit === null ? null : Math.max(0, perk.limit - used),
        };
      });
      return { kind: c.kind, perks, until: en.until ?? now };
    }
    case "points": {
      const balance = entries.reduce((s, e) => s + (e.points ?? 0), 0);
      const next =
        [...c.rewards]
          .sort((a, b) => a.cost - b.cost)
          .find((r) => r.cost > balance) ?? null;
      return {
        kind: c.kind,
        balance,
        next,
        toNext: next ? next.cost - balance : 0,
      };
    }
    case "stamps": {
      const last = Math.max(0, ...of("stamp_reward").map((e) => e.at));
      const count = of("stamp").filter((e) => e.at > last).length;
      return {
        kind: c.kind,
        count: Math.min(count, c.every),
        every: c.every,
        ready: count >= c.every,
        earned: of("stamp_reward").length,
      };
    }
    case "referral": {
      const done = new Set(of("referral_done").map((e) => e.ref));
      const referrals = of("referral").map((e) => ({
        entry: e,
        done: done.has(e.id),
      }));
      const thisYear = of("referral_done").filter(
        (e) => e.at > now - 365 * DAY,
      ).length;
      return {
        kind: c.kind,
        referrals,
        left: Math.max(0, c.perYear - thisYear),
      };
    }
    case "tiers": {
      const visits = all.filter(
        (e) =>
          e.memberId === en.memberId &&
          e.type === "visit" &&
          e.at > now - 365 * DAY,
      ).length;
      return { kind: c.kind, visits, ...tierFor(c.tiers, visits) };
    }
    case "wellness": {
      const year = new Date(now).getFullYear();
      const done = new Set(
        of("goal")
          .filter((e) => new Date(e.at).getFullYear() === year)
          .map((e) => e.ref),
      );
      return {
        kind: c.kind,
        goals: c.goals.map((goal) => ({ goal, done: done.has(goal.id) })),
      };
    }
  }
}
export type Standing = ReturnType<typeof standing>;

/** Short text for the members list, e.g. "420 points" or "Gold". */
export function chip(s: Standing, en: Enrollment, now: number) {
  switch (s.kind) {
    case "membership": {
      const st = status(en, now);
      return st === "expired"
        ? "Expired"
        : st === "cancelled"
          ? "Cancelled"
          : `Until ${day(s.until)}`;
    }
    case "points":
      return `${s.balance.toLocaleString("en-IN")} points`;
    case "stamps":
      return s.ready ? "Reward ready" : `${s.count} of ${s.every} stamps`;
    case "referral":
      return `${s.referrals.filter((r) => r.done).length} referred`;
    case "tiers":
      return s.tier.name;
    case "wellness":
      return `${s.goals.filter((g) => g.done).length} of ${s.goals.length} goals`;
  }
}
export const day = (at: number) =>
  new Date(at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * "Record a visit" feeds every live program that counts visits.
 * ponytail: entered by hand in the UI-first phase; the backend writes these from completed appointments.
 */
export function visit(
  d: LoyaltyData,
  memberId: string,
  by: string,
  now: number,
): Entry[] {
  const out: Entry[] = [
    { id: uid(), at: now, memberId, programId: "", type: "visit", by },
  ];
  for (const en of d.enrollments) {
    const p = d.programs.find((x) => x.id === en.programId);
    if (
      en.memberId !== memberId ||
      !p ||
      p.status === "draft" ||
      status(en, now) === "cancelled" ||
      status(en, now) === "expired"
    )
      continue;
    if (p.config.kind === "points")
      out.push({
        id: uid(),
        at: now,
        memberId,
        programId: p.id,
        type: "earn",
        points: p.config.visit,
        note: "Visit",
        by,
      });
    if (p.config.kind === "stamps")
      out.push({
        id: uid(),
        at: now,
        memberId,
        programId: p.id,
        type: "stamp",
        by,
      });
  }
  return out;
}

/** Deterministic sample data for local development only. */
export function seed(clinic: string, now: number): LoyaltyData {
  const names = [
    ["Maya Rao", "9845012345"],
    ["Leena Das", "9900123456"],
    ["Kabir Shah", "9123456780"],
    ["Nikhil Jain", "9811122233"],
    ["Ananya Reddy", "9701234567"],
    ["Ravi Kumar", "9848022338"],
    ["Fatima Begum", "9666012345"],
    ["Suresh Naidu", "9440112233"],
    ["Priya Menon", "9895098950"],
    ["Arjun Varma", "9010203040"],
  ];
  const programs: Program[] = (
    ["membership", "points", "stamps", "referral"] as const
  ).map((k, i) => ({
    id: k,
    name:
      k === "membership"
        ? `${clinic.split(" ").slice(0, 2).join(" ")} Care`
        : templates[k].name,
    color: templates[k].color,
    status: k === "referral" ? "draft" : "live",
    createdAt: now - (200 - i * 30) * DAY,
    config: structuredClone(templates[k].config),
  }));
  const members: Member[] = names.map(([name, phone], i) => ({
    id: `m${i + 1}`,
    no: memberNo(clinic, i + 1),
    name,
    phone: mobile(phone)!,
    joinedAt: now - (190 - i * 17) * DAY,
  }));
  const enrollments: Enrollment[] = [];
  const entries: Entry[] = [];
  const by = "Reception";
  members.forEach((m, i) => {
    // Kabir's membership ends in 3 weeks, Nikhil's ended last month; Arjun cancelled.
    const until =
      i === 2
        ? now + 21 * DAY
        : i === 3
          ? now - 30 * DAY
          : addMonths(m.joinedAt, 12);
    if (i % 2 === 0 || i === 3 || i === 9)
      enrollments.push({
        programId: "membership",
        memberId: m.id,
        since: m.joinedAt,
        until,
        family: i === 0 ? ["Arun Rao", "Diya Rao"] : [],
        cancelled: i === 9 ? now - 5 * DAY : undefined,
      });
    enrollments.push({
      programId: "points",
      memberId: m.id,
      since: m.joinedAt,
    });
    if (i < 7)
      enrollments.push({
        programId: "stamps",
        memberId: m.id,
        since: m.joinedAt,
      });
    const visits = ((i * 7) % 9) + 1;
    for (let v = 0; v < visits; v++) {
      const at =
        m.joinedAt + Math.round(((now - m.joinedAt) * (v + 1)) / (visits + 1));
      entries.push({
        id: `v${i}-${v}`,
        at,
        memberId: m.id,
        programId: "",
        type: "visit",
        by,
      });
      entries.push({
        id: `e${i}-${v}`,
        at,
        memberId: m.id,
        programId: "points",
        type: "earn",
        points: 50,
        note: "Visit",
        by,
      });
      if (i < 7)
        entries.push({
          id: `s${i}-${v}`,
          at,
          memberId: m.id,
          programId: "stamps",
          type: "stamp",
          by,
        });
    }
    if (i === 1)
      entries.push({
        id: "sr1",
        at: now - 20 * DAY,
        memberId: m.id,
        programId: "stamps",
        type: "stamp_reward",
        note: "Free follow-up consultation",
        by,
      });
    if (i % 3 === 0)
      entries.push({
        id: `c${i}`,
        at: now - 40 * DAY,
        memberId: m.id,
        programId: "points",
        type: "earn",
        points: 100,
        note: "Health check-up",
        by,
      });
    if (i === 5)
      entries.push({
        id: "rd1",
        at: now - 9 * DAY,
        memberId: m.id,
        programId: "points",
        type: "redeem",
        ref: "r1",
        points: -200,
        note: "Free BP and sugar check",
        by,
      });
    if (i === 0)
      entries.push(
        {
          id: "u1",
          at: now - 12 * DAY,
          memberId: m.id,
          programId: "membership",
          type: "use",
          ref: "p1",
          note: "Maya Rao",
          by,
        },
        {
          id: "u2",
          at: now - 3 * DAY,
          memberId: m.id,
          programId: "membership",
          type: "use",
          ref: "p2",
          note: "Diya Rao",
          by,
        },
      );
  });
  return {
    v: 1,
    programs,
    members,
    enrollments,
    entries,
    next: members.length + 1,
  };
}

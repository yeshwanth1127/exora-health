/** Google Business Profile in plain words: the listing, its score and to-do list, and how it differs from what the clinic set up in Exora. Pure. */
import type { Attachment } from "./whatsapp-setup";

export const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
/** day: 0 = Monday. Times are 24 h "HH:MM". A day with no period is closed. */
export type Period = { day: number; open: string; close: string };
export type FactId =
  | "wheelchair"
  | "parking"
  | "online_visits"
  | "cards"
  | "upi"
  | "lab"
  | "pharmacy";
export const facts: Record<FactId, string> = {
  wheelchair: "Wheelchair-accessible entrance",
  parking: "Parking available",
  online_visits: "Online consultations",
  cards: "Accepts debit and credit cards",
  upi: "Accepts UPI (Google Pay, PhonePe, Paytm)",
  lab: "Lab tests on site",
  pharmacy: "Pharmacy on site",
};
export type PhotoSlot = "logo" | "cover" | "outside" | "inside" | "team";
export const photoSlots: Record<
  PhotoSlot,
  { title: string; hint: string; max: number }
> = {
  logo: { title: "Logo", hint: "Square, at least 250 × 250", max: 1 },
  cover: {
    title: "Cover photo",
    hint: "Wide photo that sums up the clinic",
    max: 1,
  },
  outside: {
    title: "Outside",
    hint: "Entrance and signboard so patients find you",
    max: 10,
  },
  inside: {
    title: "Inside",
    hint: "Reception, waiting area, consultation rooms",
    max: 10,
  },
  team: {
    title: "Team",
    hint: "Doctors and staff (with their consent)",
    max: 10,
  },
};
export type Photo = {
  id: string;
  name: string;
  status: "live" | "checking" | "rejected";
  reason?: string;
  at: number;
};
export type Social = "facebook" | "instagram" | "youtube" | "x";
export type Service = { name: string; price: number | null };

export type Listing = {
  name: string;
  phone: string;
  website: string;
  address: string;
  primaryCategory: string;
  categories: string[];
  description: string;
  hours: Period[];
  holidays: { date: string; closed: boolean; label: string }[];
  services: Service[];
  bookUrl: string | null;
  whatsappUrl: string | null;
  facts: Partial<Record<FactId, boolean>>;
  social: Partial<Record<Social, string>>;
  photos: Record<PhotoSlot, Photo[]>;
};
/** Fields Google re-checks before showing a change. */
export const checkedFields = ["name", "address", "primaryCategory"] as const;
export type CheckedField = (typeof checkedFields)[number];

export type Review = {
  id: string;
  author: string;
  stars: number;
  text: string;
  at: number;
  reply: { text: string; at: number } | null;
};
export type PostKind = "update" | "offer" | "event";
export type Post = {
  id: string;
  kind: PostKind;
  title: string;
  text: string;
  button: "book" | "call" | "learn" | null;
  image: Attachment | null;
  /** Events and offers only; Google requires a date range for them. YYYY-MM-DD. */
  dates?: { from: string; to: string };
  at: number;
  status: "scheduled" | "checking" | "live" | "rejected";
  views: number;
};
export type Metrics = {
  search: number;
  maps: number;
  calls: number;
  directions: number;
  website: number;
  bookings: number;
  chats: number;
};
export type GoogleChange = {
  field: "phone" | "website" | "hours";
  label: string;
  ours: string;
  theirs: string;
};

export type GbpData = {
  v: 1;
  account: { email: string; listing: string } | null;
  listing: Listing;
  /** Edits Google is still checking, with when they were sent. */
  checking: Partial<Record<CheckedField, number>>;
  reviews: Review[];
  posts: Post[];
  month: Metrics;
  lastMonth: Metrics;
  daily: { day: string; views: number }[];
  keywords: { term: string; count: number }[];
  googleChanges: GoogleChange[];
  askReviews: boolean;
  available?: boolean;
  status?: string;
  version?: number;
  reviewUrl?: string | null;
  capabilities?: {
    profile: boolean;
    reviews: boolean;
    posts: boolean;
    photos: boolean;
    insights: boolean;
    reviewRequests: boolean;
  };
};

/** What the clinic already set up in Exora; Google is kept in step with this. */
export type Exora = {
  name: string;
  phone: string;
  address: string;
  city: string;
  facilityType: string;
  hours: Period[];
  specialities: string[];
  services: Service[];
  doctors: number;
  bookUrl: string;
  whatsappUrl: string | null;
};

const specialityCategory: [RegExp, string][] = [
  [/cardio|heart/i, "Cardiologist"],
  [/ortho|bone|joint/i, "Orthopedic surgeon"],
  [/paed|pediat|child/i, "Pediatrician"],
  [/gyn|obst|matern|women/i, "Obstetrician-gynecologist"],
  [/derma|skin/i, "Dermatologist"],
  [/neuro/i, "Neurologist"],
  [/uro/i, "Urologist"],
  [/gastro/i, "Gastroenterologist"],
  [/nephro|kidney/i, "Nephrologist"],
  [/pulmo|chest|respir/i, "Pulmonologist"],
  [/onco|cancer/i, "Oncologist"],
  [/ophthal|eye/i, "Ophthalmologist"],
  [/psych/i, "Psychiatrist"],
  [/endo|diabet/i, "Endocrinologist"],
  [/ent\b|ear|otolaryn/i, "Ear, nose and throat specialist"],
  [/dent/i, "Dentist"],
  [/physio/i, "Physiotherapist"],
  [/radio|imaging|scan/i, "Diagnostic center"],
  [/lab|patho/i, "Medical laboratory"],
  [/general|family|internal/i, "General practitioner"],
];
/** Google categories to suggest, from the clinic's departments and specialities. */
export function suggestCategories(specialities: string[]) {
  const out = specialities.flatMap(
    (s) => specialityCategory.find(([re]) => re.test(s))?.[1] ?? [],
  );
  return [...new Set(out)].slice(0, 9);
}
export const primaryFor = (
  e: Pick<Exora, "facilityType" | "doctors" | "specialities">,
) =>
  /hospital/i.test(e.facilityType)
    ? "Hospital"
    : e.doctors <= 1 && e.specialities[0]
      ? (suggestCategories(e.specialities)[0] ?? "Doctor")
      : "Medical clinic";

const hm = (t: string) => t.slice(0, 5);
const fmt12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
};
export const sortHours = (p: Period[]) =>
  [...p]
    .map((x) => ({ ...x, open: hm(x.open), close: hm(x.close) }))
    .sort((a, b) => a.day - b.day || a.open.localeCompare(b.open));
export const sameHours = (a: Period[], b: Period[]) =>
  JSON.stringify(sortHours(a)) === JSON.stringify(sortHours(b));
/** "Mon–Sat 9 am–8 pm · Sun closed" style summary. */
export function describeHours(p: Period[]) {
  const line = (d: number) => {
    const ps = sortHours(p).filter((x) => x.day === d);
    return ps.length
      ? ps.map((x) => `${fmt12(x.open)}–${fmt12(x.close)}`).join(", ")
      : "Closed";
  };
  const groups: [number, number, string][] = [];
  days.forEach((_, d) => {
    const l = line(d);
    const last = groups.at(-1);
    if (last && last[2] === l) last[1] = d;
    else groups.push([d, d, l]);
  });
  return groups
    .map(
      ([a, b, l]) =>
        `${days[a].slice(0, 3)}${a === b ? "" : `–${days[b].slice(0, 3)}`} ${l}`,
    )
    .join(" · ");
}

/** Clinic opening hours from dated doctor sessions: per weekday, earliest start to latest end. */
export function hoursFromSessions(
  sessions: { sessionOn: string; open: string; close: string }[],
): Period[] {
  const byDay = new Map<number, Period>();
  for (const s of sessions) {
    const day = (new Date(`${s.sessionOn}T12:00:00Z`).getUTCDay() + 6) % 7;
    const p = byDay.get(day);
    byDay.set(
      day,
      p
        ? {
            day,
            open: s.open < p.open ? s.open : p.open,
            close: s.close > p.close ? s.close : p.close,
          }
        : { day, open: s.open, close: s.close },
    );
  }
  return sortHours([...byDay.values()]);
}

export function draftDescription(e: Exora) {
  const kind = /hospital/i.test(e.facilityType)
    ? "multi-speciality hospital"
    : e.doctors > 1
      ? "clinic"
      : "clinic";
  const depts = e.specialities.slice(0, 6);
  const text = [
    `${e.name} is a ${kind} in ${e.city || "your city"}${e.doctors > 1 ? ` with ${e.doctors} doctors` : ""}${depts.length ? ` covering ${depts.slice(0, -1).join(", ")}${depts.length > 1 ? " and " : ""}${depts.at(-1)}` : ""}.`,
    "Book an appointment online or on WhatsApp in under a minute, see the fee before you confirm, and get a reminder the day before your visit.",
    e.hours.length ? `Open ${describeHours(e.hours)}.` : "",
  ];
  return text.filter(Boolean).join(" ").slice(0, 750);
}

/** Google's description rules, in plain words. */
export function descriptionIssues(text: string) {
  const out: string[] = [];
  if (text.length > 750)
    out.push(`Keep it under 750 characters (now ${text.length}).`);
  if (/https?:\/\/|www\./i.test(text))
    out.push("Remove links. Google doesn't allow them in the description.");
  if (/(\+?\d[\d\s-]{8,}\d)/.test(text))
    out.push(
      "Remove phone numbers. Patients see your number above the description.",
    );
  if (/\b[A-Z]{6,}\b/.test(text)) out.push("Avoid ALL CAPS words.");
  if (/\b(cheapest|best in|no\.? ?1|#1|discount|% off)\b/i.test(text))
    out.push(
      "Avoid offers and claims like “best” or “% off”. Use a post for offers.",
    );
  return out;
}

const healthWords =
  /\b(diagnos\w*|treat(ment|ed)?|surger(y|ies)|operation|prescri\w*|medicine|medication|report|scan|test results?|your (visit|appointment|condition|doctor|case)|you were (seen|admitted)|our patient|as a patient)\b/gi;
/** Words that would confirm the reviewer is a patient or reveal health details. */
export const privacyIssues = (reply: string) => [
  ...new Set((reply.match(healthWords) ?? []).map((w) => w.toLowerCase())),
];

export function suggestReply(r: Review, clinic: string, phone: string) {
  const name = r.author.split(" ")[0];
  if (r.stars >= 4)
    return `Thank you for taking the time to share this, ${name}. We'll pass your kind words on to the team at ${clinic}.`;
  return `Thank you for your feedback, ${name}. We're sorry to hear this and would like to understand what happened. Please call us on ${phone} or message us on WhatsApp so we can help.`;
}

export type Task = {
  id: string;
  title: string;
  why: string;
  weight: number;
  done: boolean;
  tab: "profile" | "reviews" | "posts" | "photos";
  section?: string;
};
/** The profile score's to-do list, highest impact first. */
export function tasks(d: GbpData, e: Exora, now: number): Task[] {
  const l = d.listing;
  const p = l.photos;
  const unreplied = d.reviews.filter((r) => !r.reply).length;
  const lastPost = Math.max(
    0,
    ...d.posts.filter((x) => x.status === "live").map((x) => x.at),
  );
  const daysSincePost = lastPost
    ? Math.floor((now - lastPost) / 86_400_000)
    : null;
  const t: Task[] = [
    {
      id: "book",
      title: "Add a Book button",
      why: "Patients book straight from Google Search and Maps.",
      weight: 15,
      done: !!l.bookUrl,
      tab: "profile",
      section: "buttons",
    },
    {
      id: "whatsapp",
      title: "Add a WhatsApp button",
      why: "Patients who'd rather message than call can reach you in one tap.",
      weight: 10,
      done: !!l.whatsappUrl,
      tab: "profile",
      section: "buttons",
    },
    {
      id: "hours",
      title: "Match opening hours to your schedule",
      why: "Wrong hours are the top reason patients turn up to a closed door.",
      weight: 10,
      done: !!l.hours.length && sameHours(l.hours, e.hours),
      tab: "profile",
      section: "hours",
    },
    {
      id: "photos",
      title: "Add a logo, cover and 3 clinic photos",
      why: "Listings with photos get far more direction requests.",
      weight: 12,
      done:
        p.logo.length > 0 &&
        p.cover.length > 0 &&
        p.outside.length + p.inside.length + p.team.length >= 3,
      tab: "photos",
    },
    {
      id: "categories",
      title: "Add your specialities",
      why: "Helps you show up for searches like “cardiologist near me”.",
      weight: 10,
      done: l.categories.length > 0,
      tab: "profile",
      section: "categories",
    },
    {
      id: "description",
      title: "Write a description",
      why: "Tells patients what you offer before they call.",
      weight: 10,
      done: l.description.trim().length >= 250,
      tab: "profile",
      section: "about",
    },
    {
      id: "services",
      title: "List your services",
      why: "Patients see consultations and packages, with prices if you want.",
      weight: 8,
      done: l.services.length >= 3,
      tab: "profile",
      section: "services",
    },
    {
      id: "reviews",
      title: unreplied
        ? `Reply to ${unreplied} review${unreplied === 1 ? "" : "s"}`
        : "Reply to reviews",
      why: "Replies show patients you listen, especially to unhappy ones.",
      weight: 7,
      done: unreplied === 0,
      tab: "reviews",
    },
    {
      id: "phone",
      title: "Fix your phone number",
      why: "Calls should reach your reception.",
      weight: 5,
      done: !!l.phone && digits(l.phone) === digits(e.phone),
      tab: "profile",
      section: "basics",
    },
    {
      id: "facts",
      title: "Answer quick questions",
      why: "Parking, wheelchair access and payment options show on your listing.",
      weight: 5,
      done: (Object.keys(facts) as FactId[]).every(
        (f) => l.facts[f] !== undefined,
      ),
      tab: "profile",
      section: "facts",
    },
    {
      id: "post",
      title:
        daysSincePost === null
          ? "Post your first update"
          : `Post an update (last one ${daysSincePost} days ago)`,
      why: "Posting every two weeks keeps your listing fresh.",
      weight: 6,
      done: daysSincePost !== null && daysSincePost <= 14,
      tab: "posts",
    },
    {
      id: "social",
      title: "Add social media links",
      why: "Patients can check your Facebook or Instagram.",
      weight: 2,
      done: Object.values(l.social).some(Boolean),
      tab: "profile",
      section: "social",
    },
  ];
  return t.sort(
    (a, b) => Number(a.done) - Number(b.done) || b.weight - a.weight,
  );
}
export const score = (t: Task[]) =>
  Math.round(
    (t.filter((x) => x.done).reduce((s, x) => s + x.weight, 0) /
      t.reduce((s, x) => s + x.weight, 0)) *
      100,
  );
const digits = (p: string) => p.replace(/\D/g, "").slice(-10);

export const uid = () => crypto.randomUUID().slice(0, 8);
const DAY = 86_400_000;

// ponytail: preview-only clock standing in for Google's review of edits, photos and posts; the backend reads real states.
export function progress(d: GbpData, now: number): GbpData {
  let changed = false;
  const checking = { ...d.checking };
  for (const f of checkedFields)
    if (checking[f] !== undefined && now - checking[f]! > 8000) {
      delete checking[f];
      changed = true;
    }
  const photos = Object.fromEntries(
    Object.entries(d.listing.photos).map(([k, list]) => [
      k,
      list.map((p) => {
        if (p.status !== "checking" || now - p.at < 5000) return p;
        changed = true;
        return { ...p, status: "live" as const };
      }),
    ]),
  ) as Listing["photos"];
  const posts = d.posts.map((p) => {
    if (
      (p.status === "checking" && now - p.at > 5000) ||
      (p.status === "scheduled" && p.at <= now)
    ) {
      changed = true;
      return { ...p, status: "live" as const };
    }
    return p;
  });
  return changed
    ? { ...d, checking, posts, listing: { ...d.listing, photos } }
    : d;
}

const reviewers: [string, number, string, number][] = [
  [
    "Ravi Kumar",
    5,
    "Very clean and well organised. Booking on WhatsApp was quick and the reminder helped.",
    2,
  ],
  [
    "Swathi Reddy",
    2,
    "Waited more than an hour beyond my slot. Staff at reception were polite but nobody told us about the delay.",
    4,
  ],
  [
    "Imran Shaik",
    5,
    "Doctor explained everything patiently. Good parking too.",
    9,
  ],
  [
    "Padma Latha",
    4,
    "Good doctors. Pharmacy queue was long in the evening.",
    16,
  ],
  ["Karthik V", 1, "Called three times and nobody picked up the phone.", 21],
  [
    "Meena Iyer",
    5,
    "Excellent care for my father. Thank you to the whole team.",
    34,
  ],
  [
    "Naveen Goud",
    4,
    "Easy to find, signboard is visible from the main road.",
    52,
  ],
  ["Sowmya P", 5, "Got an appointment the same day. Highly recommended.", 70],
];

/** A half-finished listing like most clinics have, built from the clinic's real details. */
export function seed(e: Exora, now: number): GbpData {
  const metrics = (k: number): Metrics => ({
    search: Math.round(2100 * k),
    maps: Math.round(1300 * k),
    calls: Math.round(180 * k),
    directions: Math.round(240 * k),
    website: Math.round(95 * k),
    bookings: 0,
    chats: 0,
  });
  return {
    v: 1,
    account: null,
    listing: {
      name: e.name,
      phone: "+91 40 2345 6789",
      website: "",
      address: e.address,
      primaryCategory: primaryFor(e),
      categories: [],
      description: "",
      // Google still shows old hours: open Sundays, closing early on weekdays.
      hours: days.map((_, day) => ({
        day,
        open: "10:00",
        close: day === 6 ? "13:00" : "18:00",
      })),
      holidays: [],
      services: [],
      bookUrl: null,
      whatsappUrl: null,
      facts: { parking: true },
      social: {},
      photos: {
        logo: [],
        cover: [],
        outside: [
          {
            id: uid(),
            name: "Front entrance.jpg",
            status: "live",
            at: now - 300 * DAY,
          },
        ],
        inside: [],
        team: [],
      },
    },
    checking: {},
    reviews: reviewers.map(([author, stars, text, ago], i) => ({
      id: uid(),
      author,
      stars,
      text,
      at: now - ago * DAY,
      reply:
        i >= 5
          ? {
              text: `Thank you, ${author.split(" ")[0]}. We'll share this with the team.`,
              at: now - (ago - 1) * DAY,
            }
          : null,
    })),
    posts: [
      {
        id: uid(),
        kind: "update",
        title: "",
        text: "We are now open on Saturdays till 8 pm.",
        button: "call",
        image: null,
        at: now - 41 * DAY,
        status: "live",
        views: 312,
      },
    ],
    month: metrics(1),
    lastMonth: metrics(0.86),
    daily: Array.from({ length: 30 }, (_, i) => {
      const day = new Date(now - (29 - i) * DAY);
      return {
        day: day.toISOString().slice(0, 10),
        views: Math.round(
          95 +
            40 * Math.sin(i / 2.3) +
            (day.getDay() === 0 ? -35 : 10) +
            i * 1.2,
        ),
      };
    }),
    keywords: [
      ...e.specialities
        .slice(0, 3)
        .map((s, i) => ({
          term: `${(suggestCategories([s])[0] ?? s).toLowerCase()} near me`,
          count: 620 - i * 140,
        })),
      { term: e.name.toLowerCase(), count: 410 },
      { term: `hospital in ${(e.city || "city").toLowerCase()}`, count: 260 },
      { term: "doctor near me", count: 190 },
    ].sort((a, b) => b.count - a.count),
    googleChanges: [
      {
        field: "phone",
        label: "Phone number",
        ours: e.phone,
        theirs: "+91 40 2345 6789",
      },
    ],
    askReviews: false,
  };
}

/** WhatsApp after go-live: lifecycle templates, inbox, message log and promotions. Pure, so the API can replace the browser store later. */
import type { Attachment } from "./whatsapp-setup";

export const HOUR = 3_600_000;
export const WINDOW = 24 * HOUR;
export type Category = "service" | "utility" | "marketing";
export type Status =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received"
  | "claimed"
  | "unknown"
  | "cancelled";

export const variables = [
  "patient_name",
  "doctor_name",
  "date",
  "time",
  "clinic_name",
  "booking_ref",
] as const;
export type Variable = (typeof variables)[number];
export const variableLabels: Record<Variable, string> = {
  patient_name: "Patient name",
  doctor_name: "Doctor",
  date: "Date",
  time: "Time",
  clinic_name: "Clinic name",
  booking_ref: "Booking ref",
};

export type Template = { body: string; buttons: string[] };
export type TemplateDraft = Template & {
  header: Attachment | null;
  /** The version Meta approved. It keeps sending while an edit is reviewed. */
  approved: Template | null;
  review: "none" | "in_review" | "rejected";
  submittedAt: number | null;
  rejection: string | null;
};
export type TemplateState =
  | "not_submitted"
  | "in_review"
  | "rejected"
  | "approved"
  | "edited";

const same = (a: Template, b: Template) =>
  a.body === b.body && a.buttons.join("\n") === b.buttons.join("\n");

export function templateState(t: TemplateDraft): TemplateState {
  if (t.review === "in_review") return "in_review";
  if (t.review === "rejected") return "rejected";
  if (!t.approved) return "not_submitted";
  return same(t, t.approved) ? "approved" : "edited";
}

/** Meta's template rules, checked before submitting so a rejection never costs a review cycle. */
export function templateIssues({ body, buttons }: Template): string[] {
  const text = body.trim();
  if (!text) return ["Write the message."];
  const out: string[] = [];
  if (body.length > 1024)
    out.push(`Keep the message under 1024 characters (now ${body.length}).`);
  const unknown = [...text.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)]
    .map((m) => m[1])
    .filter((v) => !variables.includes(v as Variable));
  if (unknown.length)
    out.push(
      `Unknown variable ${unknown.map((v) => `{{${v}}}`).join(", ")}. Insert one with the buttons below.`,
    );
  if (text.startsWith("{{") || text.endsWith("}}"))
    out.push(
      "Meta rejects messages that start or end with a variable. Add a word before or after it.",
    );
  if (/\}\}\s*\{\{/.test(text))
    out.push("Put some words between two variables.");
  if (buttons.length > 3) out.push("Use at most 3 buttons.");
  buttons.forEach((b, i) => {
    if (!b.trim()) out.push(`Button ${i + 1} is empty.`);
    else if (b.length > 25) out.push(`Button “${b}” is over 25 characters.`);
  });
  if (new Set(buttons.map((b) => b.trim().toLowerCase())).size < buttons.length)
    out.push("Each button needs different text.");
  return out;
}

export const render = (
  body: string,
  values: Partial<Record<Variable, string>>,
) =>
  body.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (m, k: string) => values[k as Variable] ?? m,
  );

/** Time left to reply freely; after 24 h since the patient's last message only a template may be sent. */
export const windowLeft = (lastInbound: number | null, now: number) =>
  lastInbound === null ? 0 : Math.max(0, lastInbound + WINDOW - now);

export type AutomationId =
  | "confirmation"
  | "reminder_day"
  | "reminder_soon"
  | "rescheduled"
  | "cancelled"
  | "no_show"
  | "feedback"
  | "follow_up"
  | "staff_reply";
export type Automation = TemplateDraft & {
  id: AutomationId;
  on: boolean;
  timing: string;
};
export type Stage = "before" | "change" | "after" | "staff";

export const automationInfo: Record<
  AutomationId,
  {
    title: string;
    name: string;
    stage: Stage;
    description: string;
    timings: [string, string][];
  }
> = {
  confirmation: {
    title: "Booking confirmation",
    name: "appointment_confirmation",
    stage: "before",
    description:
      "For bookings made at the desk, by phone or online. WhatsApp bookings already get the flow's confirmation.",
    timings: [["now", "Right after booking"]],
  },
  reminder_day: {
    title: "Reminder · day before",
    name: "appointment_reminder_day",
    stage: "before",
    description:
      "Patients can confirm, reschedule or cancel from the reminder.",
    timings: [
      ["24h", "24 hours before"],
      ["evening", "6 pm the evening before"],
      ["48h", "2 days before"],
    ],
  },
  reminder_soon: {
    title: "Reminder · same day",
    name: "appointment_reminder_soon",
    stage: "before",
    description: "A short nudge before the visit.",
    timings: [
      ["2h", "2 hours before"],
      ["1h", "1 hour before"],
      ["3h", "3 hours before"],
    ],
  },
  rescheduled: {
    title: "Appointment moved",
    name: "appointment_rescheduled",
    stage: "change",
    description: "When staff or the patient moves an appointment.",
    timings: [["now", "Right after the change"]],
  },
  cancelled: {
    title: "Appointment cancelled",
    name: "appointment_cancelled",
    stage: "change",
    description: "Includes a button to book again.",
    timings: [["now", "Right after cancelling"]],
  },
  no_show: {
    title: "Missed visit",
    name: "missed_appointment",
    stage: "after",
    description: "When an appointment is marked no-show.",
    timings: [
      ["2h", "2 hours after the slot"],
      ["next_day", "Next morning, 10 am"],
    ],
  },
  feedback: {
    title: "Visit feedback",
    name: "visit_feedback",
    stage: "after",
    description: "Three-tap rating. “Not good” goes to the inbox.",
    timings: [
      ["2h", "2 hours after the visit"],
      ["next_day", "Next morning, 10 am"],
    ],
  },
  follow_up: {
    title: "Follow-up due",
    name: "follow_up_due",
    stage: "after",
    description: "When the doctor sets a review date in the consultation.",
    timings: [
      ["3d", "3 days before the review date"],
      ["7d", "7 days before"],
      ["1d", "1 day before"],
    ],
  },
  staff_reply: {
    title: "Message from reception",
    name: "reception_follow_up",
    stage: "staff",
    description:
      "Staff send this from the inbox to reopen a chat after 24 hours.",
    timings: [["manual", "Sent by staff"]],
  },
};

const bodies: Record<AutomationId, Template> = {
  confirmation: {
    body: "Hello {{patient_name}}, your appointment with {{doctor_name}} at {{clinic_name}} is confirmed for {{date}} at {{time}}. Booking ref {{booking_ref}}. Please arrive 10 minutes early.",
    buttons: ["Reschedule", "Cancel"],
  },
  reminder_day: {
    body: "Hello {{patient_name}}, a reminder of your appointment with {{doctor_name}} on {{date}} at {{time}}. Tap below if you need to change it.",
    buttons: ["Confirm", "Reschedule", "Cancel"],
  },
  reminder_soon: {
    body: "Hello {{patient_name}}, see you soon. Your appointment with {{doctor_name}} is today at {{time}}. Please bring any previous reports.",
    buttons: ["Running late"],
  },
  rescheduled: {
    body: "Hello {{patient_name}}, your appointment with {{doctor_name}} has moved to {{date}} at {{time}}. Booking ref {{booking_ref}} stays the same.",
    buttons: ["Change again", "Cancel"],
  },
  cancelled: {
    body: "Hello {{patient_name}}, your appointment with {{doctor_name}} on {{date}} at {{time}} is cancelled. Tap below to book a new time.",
    buttons: ["Book again"],
  },
  no_show: {
    body: "Hello {{patient_name}}, we missed you at {{clinic_name}} today. Would you like to book another time with {{doctor_name}}?",
    buttons: ["Book again", "Not now"],
  },
  feedback: {
    body: "Hello {{patient_name}}, thank you for visiting {{doctor_name}} at {{clinic_name}}. How was your visit?",
    buttons: ["Very good", "Okay", "Not good"],
  },
  follow_up: {
    body: "Hello {{patient_name}}, {{doctor_name}} asked to see you again around {{date}}. Tap below to pick a time.",
    buttons: ["Book follow-up", "Already booked"],
  },
  staff_reply: {
    body: "Hello {{patient_name}}, this is {{clinic_name}} following up on your message. Reply here and our team will help you.",
    buttons: [],
  },
};
/** Submitted at go-live, so the core lifecycle works on day one. */
const submittedAtLaunch: AutomationId[] = [
  "confirmation",
  "reminder_day",
  "rescheduled",
  "cancelled",
  "staff_reply",
];

export type Message = {
  id: string;
  at: number;
  from: "patient" | "bot" | "staff";
  text: string;
  by?: string;
  logId?: string;
  status?: string;
};
export type Conversation = {
  id: string;
  version?: number;
  canReply?: boolean;
  updatedAt?: number;
  patient: string;
  phone: string;
  reason: string;
  status: "open" | "resolved" | "bot";
  assignee: string | null;
  messages: Message[];
  context: { next: string | null; last: string | null; visits: number };
};
export const lastInbound = (c: Conversation) =>
  c.messages.findLast((m) => m.from === "patient")?.at ?? null;
export const needsReply = (c: Conversation) =>
  c.status === "open" && c.messages.at(-1)?.from === "patient";

export type MetaError = { code: number; text: string; retry: boolean };
export const metaErrors: Record<number, Omit<MetaError, "code">> = {
  131026: {
    text: "Not delivered. This number isn't on WhatsApp or can't receive messages.",
    retry: false,
  },
  131047: {
    text: "More than 24 hours since the patient's last message. Send an approved template instead.",
    retry: false,
  },
  131049: {
    text: "Meta held this marketing message to protect the patient's experience. Try again in a day or two.",
    retry: true,
  },
  131050: {
    text: "The patient stopped promotional messages from you.",
    retry: false,
  },
  131000: { text: "Something went wrong at Meta. Try again.", retry: true },
};
const fail = (code: number): MetaError => ({ code, ...metaErrors[code] });

export type LogEntry = {
  id: string;
  at: number;
  patient: string;
  phone: string;
  direction: "out" | "in";
  kind: string;
  template: string | null;
  category: Category;
  body: string;
  status: Status;
  history: { status: Status; at: number }[];
  error: MetaError | null;
  /** Sent from this screen; the preview walks it through Meta's statuses. */
  track?: boolean;
};

export type Audience =
  | { kind: "all" }
  | { kind: "specialty"; value: string }
  | { kind: "lapsed"; months: number };
export type CampaignStatus =
  | "in_review"
  | "scheduled"
  | "sending"
  | "sent"
  | "rejected";
export type Campaign = {
  id: string;
  name: string;
  body: string;
  buttons: string[];
  header: Attachment | null;
  audience: Audience;
  size: number;
  sendAt: number | null;
  status: CampaignStatus;
  changedAt: number;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    optedOut: number;
  } | null;
};

export type WaSettings = {
  quiet: { on: boolean; from: string; to: string };
  hours: { from: string; to: string };
  away: { on: boolean; text: string };
  handoffWords: string;
  savedReplies: string[];
  askConsent: boolean;
};

export type WaData = {
  bookedToday?: number;
  messageStats?: {
    sent: number;
    delivered: number;
    settled: number;
    failed: number;
  };
  bookingActive?: boolean;
  capabilities?: {
    sending: boolean;
    booking: boolean;
    automations: boolean;
    campaigns: boolean;
  };
  loading?: boolean;
  error?: string;
  busy?: boolean;
  v: 1;
  day: string;
  optedIn: number;
  automations: Automation[];
  conversations: Conversation[];
  log: LogEntry[];
  campaigns: Campaign[];
  settings: WaSettings;
};

export const uid = () => crypto.randomUUID().slice(0, 8);

/** Queue an outgoing message; returns the log id so a chat bubble can follow its status. */
export function queue(
  d: WaData,
  m: Pick<
    LogEntry,
    "patient" | "phone" | "kind" | "template" | "category" | "body"
  >,
  now: number,
): [WaData, string] {
  const id = uid();
  const entry: LogEntry = {
    ...m,
    id,
    at: now,
    direction: "out",
    status: "queued",
    history: [{ status: "queued", at: now }],
    error: null,
    track: true,
  };
  return [{ ...d, log: [entry, ...d.log] }, id];
}

const step: Partial<Record<Status, [Status, number]>> = {
  queued: ["sent", 1000],
  sent: ["delivered", 2500],
  delivered: ["read", 6000],
};
// ponytail: preview-only clock that stands in for Meta webhooks; the backend phase replaces it with real statuses.
export function progress(d: WaData, now: number): WaData {
  let changed = false;
  const log = d.log.map((e) => {
    const next = e.track && step[e.status];
    const since = e.history.at(-1)!.at;
    if (
      !next ||
      now - since < next[1] ||
      (next[0] === "read" && e.category === "marketing")
    )
      return e;
    changed = true;
    return {
      ...e,
      status: next[0],
      history: [...e.history, { status: next[0], at: now }],
    };
  });
  const automations = d.automations.map((a) => {
    if (a.review !== "in_review" || now - (a.submittedAt ?? now) < 6000)
      return a;
    changed = true;
    return {
      ...a,
      review: "none" as const,
      approved: { body: a.body, buttons: a.buttons },
    };
  });
  const campaigns = d.campaigns.map((c): Campaign => {
    const age = now - c.changedAt;
    if (c.status === "in_review" && age >= 6000) {
      changed = true;
      return {
        ...c,
        status: c.sendAt && c.sendAt > now ? "scheduled" : "sending",
        changedAt: now,
      };
    }
    if (c.status === "scheduled" && c.sendAt !== null && c.sendAt <= now) {
      changed = true;
      return { ...c, status: "sending", changedAt: now };
    }
    if (c.status === "sending" && age >= 5000) {
      changed = true;
      return {
        ...c,
        status: "sent",
        changedAt: now,
        stats: campaignStats(c.size),
      };
    }
    return c;
  });
  return changed ? { ...d, log, automations, campaigns } : d;
}

export function campaignStats(size: number) {
  const failed = Math.round(size * 0.03);
  const delivered = Math.round((size - failed) * 0.94);
  const read = Math.round(delivered * 0.71);
  return {
    sent: size - failed,
    delivered,
    read,
    replied: Math.round(read * 0.08),
    failed,
    optedOut: Math.round(size * 0.004),
  };
}

export function audienceSize(
  a: Audience,
  optedIn: number,
  specialties: number,
) {
  if (a.kind === "all") return optedIn;
  if (a.kind === "specialty")
    return Math.round(optedIn / Math.max(specialties, 1));
  return Math.round(optedIn * Math.min(0.15 * a.months, 0.8));
}

const patients = [
  "Lakshmi Devi",
  "Mohammed Irfan",
  "Priya Sharma",
  "Venkatesh Goud",
  "Kavya Nair",
  "Ravi Kumar",
  "Fatima Begum",
  "Suresh Babu",
  "Anitha Rao",
  "Arjun Reddy",
];
const phoneOf = (i: number) => `+9198480${String(31207 + i * 7919).slice(-5)}`;

/** Sample traffic from the clinic's real doctors, so every screen has something true-to-life before Meta is connected. */
export function seed(
  clinic: { name: string; doctors: string[] },
  now: number,
  day: string,
): WaData {
  const doc = (i: number) =>
    clinic.doctors[i % Math.max(clinic.doctors.length, 1)] ?? "the doctor";
  const min = 60_000;
  const automations: Automation[] = (
    Object.keys(automationInfo) as AutomationId[]
  ).map((id) => ({
    id,
    ...bodies[id],
    header: null,
    approved: submittedAtLaunch.includes(id) ? bodies[id] : null,
    review: "none",
    submittedAt: null,
    rejection: null,
    on: submittedAtLaunch.includes(id),
    timing: automationInfo[id].timings[0][0],
  }));
  const msg = (
    from: Message["from"],
    text: string,
    ago: number,
    by?: string,
  ): Message => ({ id: uid(), at: now - ago * min, from, text, by });
  const menu = `Hello! Welcome to ${clinic.name}. Tap below to book an appointment.`;
  const conversations: Conversation[] = [
    {
      id: uid(),
      patient: patients[0],
      phone: phoneOf(0),
      reason: "Asked for staff",
      status: "open",
      assignee: null,
      context: {
        next: `${doc(0)} · tomorrow, 10:30 am`,
        last: null,
        visits: 0,
      },
      messages: [
        msg("patient", "Hi", 16),
        msg("bot", menu, 16),
        msg("patient", "Talk to reception", 15),
        msg(
          "bot",
          "Connecting you to our reception team. We reply between 9 am and 8 pm.",
          15,
        ),
        msg(
          "patient",
          "Can I bring my mother's old reports for tomorrow's appointment? Also is there parking?",
          12,
        ),
      ],
    },
    {
      id: uid(),
      patient: patients[1],
      phone: phoneOf(1),
      reason: "Bot couldn't help",
      status: "open",
      assignee: null,
      context: { next: null, last: `${doc(1)} · 3 months ago`, visits: 2 },
      messages: [
        msg("patient", "Hi", 44),
        msg("bot", menu, 44),
        msg(
          "patient",
          "my insurance is star health will cashless work for knee consult",
          43,
        ),
        msg(
          "bot",
          "Sorry, I didn't get that. Tap a button below or type staff to reach our team.",
          43,
        ),
        msg("patient", "staff", 41),
      ],
    },
    {
      id: uid(),
      patient: patients[2],
      phone: phoneOf(2),
      reason: "Feedback: not good",
      status: "open",
      assignee: "Front desk",
      context: { next: null, last: `${doc(2)} · yesterday`, visits: 5 },
      messages: [
        msg(
          "bot",
          `Hello ${patients[2]}, thank you for visiting ${doc(2)} at ${clinic.name}. How was your visit?`,
          180,
        ),
        msg("patient", "Not good", 170),
        msg(
          "patient",
          "Waited one and a half hours past my slot. Nobody told us the doctor was running late.",
          168,
        ),
        msg(
          "staff",
          "We're sorry, Priya. That shouldn't happen. I'm checking with the doctor's team and will call you today.",
          150,
          "Front desk",
        ),
        msg("patient", "Ok please call after 5", 95),
      ],
    },
    {
      id: uid(),
      patient: patients[3],
      phone: phoneOf(3),
      reason: "Asked for staff",
      status: "open",
      assignee: null,
      context: { next: null, last: null, visits: 0 },
      messages: [
        msg("patient", "Hi", 1660),
        msg("bot", menu, 1660),
        msg("patient", "Talk to reception", 1659),
        msg("patient", `Is ${doc(0)} available on Sunday?`, 1655),
      ],
    },
    {
      id: uid(),
      patient: patients[4],
      phone: phoneOf(4),
      reason: "Asked for staff",
      status: "resolved",
      assignee: "Front desk",
      context: { next: `${doc(1)} · Friday, 5:00 pm`, last: null, visits: 1 },
      messages: [
        msg("patient", "Do you do home sample collection?", 300),
        msg(
          "staff",
          "Yes, between 7 and 10 am. Shall I book it for tomorrow?",
          290,
          "Front desk",
        ),
        msg("patient", "Yes please", 285),
        msg(
          "staff",
          "Booked. Our technician will call before coming.",
          280,
          "Front desk",
        ),
      ],
    },
  ];
  const tpl = (id: AutomationId) => automationInfo[id].name;
  const values = (i: number) => ({
    patient_name: patients[i % patients.length],
    doctor_name: doc(i),
    clinic_name: clinic.name,
    date: "tomorrow",
    time: "10:30 am",
    booking_ref: `EX-${4800 + i}`,
  });
  const rows: [
    number,
    number,
    Status,
    string,
    AutomationId | null,
    Category,
    string,
    MetaError | null,
  ][] = [
    [
      2,
      5,
      "read",
      "Booking confirmed",
      null,
      "service",
      `Your appointment is booked with ${doc(5)}. Ref EX-4805.`,
      null,
    ],
    [
      3,
      5,
      "received",
      "Patient reply",
      null,
      "service",
      "Tomorrow, 10:30 am",
      null,
    ],
    [
      9,
      6,
      "delivered",
      "Reminder",
      "reminder_day",
      "utility",
      render(bodies.reminder_day.body, values(6)),
      null,
    ],
    [
      11,
      7,
      "failed",
      "Reminder",
      "reminder_day",
      "utility",
      render(bodies.reminder_day.body, values(7)),
      fail(131026),
    ],
    [
      12,
      0,
      "received",
      "Patient reply",
      null,
      "service",
      "Can I bring my mother's old reports for tomorrow's appointment? Also is there parking?",
      null,
    ],
    [
      18,
      8,
      "read",
      "Booking confirmation",
      "confirmation",
      "utility",
      render(bodies.confirmation.body, values(8)),
      null,
    ],
    [
      26,
      9,
      "read",
      "Appointment moved",
      "rescheduled",
      "utility",
      render(bodies.rescheduled.body, values(9)),
      null,
    ],
    [41, 1, "received", "Patient reply", null, "service", "staff", null],
    [52, 5, "read", "Booking flow", null, "service", menu, null],
    [
      74,
      6,
      "read",
      "Reminder",
      "reminder_day",
      "utility",
      render(bodies.reminder_day.body, values(6)),
      null,
    ],
    [
      95,
      2,
      "received",
      "Patient reply",
      null,
      "service",
      "Ok please call after 5",
      null,
    ],
    [
      128,
      8,
      "delivered",
      "Appointment cancelled",
      "cancelled",
      "utility",
      render(bodies.cancelled.body, values(8)),
      null,
    ],
    [
      150,
      2,
      "read",
      "Staff reply",
      null,
      "service",
      "We're sorry, Priya. That shouldn't happen. I'm checking with the doctor's team and will call you today.",
      null,
    ],
    [
      205,
      9,
      "read",
      "Booking confirmed",
      null,
      "service",
      `Your appointment is booked with ${doc(9)}. Ref EX-4809.`,
      null,
    ],
    [
      1480,
      6,
      "failed",
      "Promotion · Diabetes screening camp",
      null,
      "marketing",
      "Free diabetes screening this Sunday.",
      fail(131049),
    ],
    [
      1482,
      5,
      "delivered",
      "Promotion · Diabetes screening camp",
      null,
      "marketing",
      "Free diabetes screening this Sunday.",
      null,
    ],
  ];
  const log: LogEntry[] = rows.map(
    ([ago, p, status, kind, a, category, body, error]) => {
      const at = now - ago * min;
      const chain: Status[] =
        status === "received"
          ? ["received"]
          : status === "failed"
            ? ["queued", "failed"]
            : (["queued", "sent", "delivered", "read"].slice(
                0,
                ["queued", "sent", "delivered", "read"].indexOf(status) + 1,
              ) as Status[]);
      return {
        id: uid(),
        at,
        patient: patients[p],
        phone: phoneOf(p),
        direction: status === "received" ? "in" : "out",
        kind,
        template: a
          ? tpl(a)
          : category === "marketing"
            ? "diabetes_screening_camp"
            : null,
        category,
        body,
        status,
        error,
        history: chain.map((s, i) => ({ status: s, at: at + i * 4000 })),
      };
    },
  );
  const optedIn = Math.max(clinic.doctors.length, 1) * 140;
  return {
    v: 1,
    day,
    optedIn,
    automations,
    conversations,
    log,
    campaigns: [
      {
        id: uid(),
        name: "Diabetes screening camp",
        header: null,
        audience: { kind: "all" },
        size: optedIn,
        body: "Hello {{patient_name}}, {{clinic_name}} is holding a free diabetes screening camp this Sunday, 8 am to 1 pm. Tap below to reserve a slot.",
        buttons: ["Reserve a slot", "Stop promotions"],
        sendAt: now - 25 * HOUR,
        status: "sent",
        changedAt: now - 25 * HOUR,
        stats: campaignStats(optedIn),
      },
    ],
    settings: {
      quiet: { on: true, from: "21:00", to: "08:00" },
      hours: { from: "09:00", to: "20:00" },
      away: {
        on: true,
        text: "Thanks for your message. Our reception team is back at 9 am and will reply then. You can still book anytime by tapping Book appointment.",
      },
      handoffWords: "staff, reception, agent, help",
      savedReplies: [
        `Our timings are 9 am to 8 pm, Monday to Saturday.`,
        "Please share the patient's full name and registered phone number.",
        "Yes, please bring your previous reports and prescriptions.",
      ],
      askConsent: true,
    },
  };
}

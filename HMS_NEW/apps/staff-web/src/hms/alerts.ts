import { localToday, shiftDay } from "@/components/date-controls-model";
import { clinicDateInstant } from "./notification-time";
// Per-person alerts (docs/prd/staff-alerts.md): derived in the browser from reads the person is already allowed,
// for the selected clinic. Nothing here acts on a record; each alert only names the page where the work is done.
import type { Appointment, EncounterRow } from "./types";
import type { Evidence, SetupItem } from "./setup-readiness";

/** Fixed v1 thresholds (PRD, approved defaults). */
export const HOLD_SOON_MIN = 5,
  LATE_MIN = 15,
  UPCOMING_MIN = 60,
  OPEN_ENCOUNTER_MIN = 60,
  INVITE_DAYS = 3,
  REGISTRATION_DAYS = 30;

export type Alert = {
  /** Stable while the record's state holds; a new state gives a new key, so a dismissed alert can return. */
  key: string;
  bucket: "now" | "upcoming";
  tone: "warning" | "info";
  source: string;
  /** The person or check the alert is about (sender in the inbox). */
  who: string;
  title: string;
  detail: string;
  /** When it happened or is due: an instant, or a yyyy-mm-dd day for registrations. */
  at: string | null;
  destination: string;
};
export type AlertMark = {
  key: string;
  readAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
};
export type Registration = { registrationId: string; council: string; validUntil: string | null };
export type TeamRegistration = { registrationId: string; staffId: string; staffName: string; council: string; validUntil: string };
export type Tele = { sessionId: string; practitionerStaffId: string; patientName: string | null; startsAt: string; status: string; patientWaitingSince: string | null };
export type Referral = { referralId: string; patientName: string; reason: string; urgency: string; referredByName: string; createdAt: string };
export type WaitlistEntry = { waitlistEntryId: string; status: string; bookingPartyName: string; patientName: string | null; practitionerName: string | null; offer: { offerId: string; slotStart: string; expiresAt: string } | null };
export type StaffAccount = { staffId: string; displayName: string; account: { linked: boolean; inviteExpiresAt: string | null } | null };

/** Each source is undefined when it does not apply to this person, otherwise its read evidence. */
export type AlertSources = {
  now: number;
  timezone: string;
  staffId: string;
  appointments?: Evidence<Appointment[]>;
  waitlist?: Evidence<WaitlistEntry[]>;
  teleconsults?: Evidence<Tele[]>;
  encounters?: Evidence<EncounterRow[]>;
  referrals?: Evidence<Referral[]>;
  setup?: SetupItem[];
  accounts?: Evidence<StaffAccount[]>;
  registrations?: Evidence<Registration[]>;
  team?: Evidence<TeamRegistration[] | null>;
};

const MIN = 60_000,
  DAY = 86_400_000;
const ms = (iso: string) => new Date(iso).getTime();
const clock = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const patient = (a: { patientName: string | null; bookingPartyName?: string | null }) =>
  a.patientName ?? a.bookingPartyName ?? "Patient";

export function deriveAlerts(s: AlertSources): { alerts: Alert[]; unavailable: string[] } {
  const alerts: Alert[] = [],
    unavailable: string[] = [];
  const known = <T>(label: string, e: Evidence<T> | undefined): T | null => {
    if (!e) return null;
    if (e.state === "known") return e.value;
    if (e.state === "unknown") unavailable.push(label);
    return null;
  };
  const tz = s.timezone;

  for (const a of known("Appointment", s.appointments) ?? []) {
    const starts = a.startsAt ? ms(a.startsAt) : null;
    const mine = a.practitionerStaffId === s.staffId;
    if (mine && (a.tokenStatus === "waiting" || a.tokenStatus === "called"))
      alerts.push({
        key: `appt_wait:${a.appointmentId}:${a.tokenStatus}`, bucket: "now", tone: "warning", source: "Queue", who: patient(a),
        title: a.tokenStatus === "called" ? "Called to your room" : "Checked in, waiting for you",
        detail: `${a.tokenNo ? `Token ${a.tokenNo} · ` : ""}${a.startsAt ? `booked ${clock(a.startsAt, tz)}` : "walk-in"}`,
        at: a.startsAt, destination: "queue",
      });
    else if (!mine && a.status === "confirmed" && !a.tokenStatus && starts !== null && starts < s.now - LATE_MIN * MIN)
      alerts.push({
        key: `appt_late:${a.appointmentId}`, bucket: "now", tone: "warning", source: "Appointment", who: patient(a),
        title: "Not checked in", detail: `Booked ${clock(a.startsAt!, tz)} with ${a.practitionerName}`, at: a.startsAt, destination: "appointments",
      });
    if (a.status === "confirmed" && !a.tokenStatus && starts !== null && starts >= s.now && starts <= s.now + UPCOMING_MIN * MIN)
      alerts.push({
        key: `appt_soon:${a.appointmentId}`, bucket: "upcoming", tone: "info", source: "Appointment", who: patient(a),
        title: `${a.visitMode === "virtual" ? "Teleconsult" : "Appointment"} at ${clock(a.startsAt!, tz)}`,
        detail: mine ? "With you" : `With ${a.practitionerName}`, at: a.startsAt, destination: "appointments",
      });
  }

  for (const w of known("Waitlist", s.waitlist) ?? []) {
    if (w.status !== "offered" || !w.offer) continue;
    const left = ms(w.offer.expiresAt) - s.now;
    if (left <= 0) continue;
    const soon = left <= HOLD_SOON_MIN * MIN;
    alerts.push({
      key: `${soon ? "hold_expiring" : "hold"}:${w.offer.offerId}`, bucket: soon ? "now" : "upcoming", tone: soon ? "warning" : "info",
      source: "Waitlist", who: w.patientName ?? w.bookingPartyName,
      title: soon ? `Held slot expires in ${Math.max(1, Math.round(left / MIN))} min` : "Slot held, awaiting reply",
      detail: `${clock(w.offer.slotStart, tz)}${w.practitionerName ? ` with ${w.practitionerName}` : ""} · hold ends ${clock(w.offer.expiresAt, tz)}`,
      at: w.offer.expiresAt, destination: "waitlist",
    });
  }

  for (const t of known("Teleconsult", s.teleconsults) ?? []) {
    if (t.practitionerStaffId !== s.staffId) continue;
    const starts = ms(t.startsAt);
    if (t.status === "waiting")
      alerts.push({
        key: `tele_wait:${t.sessionId}`, bucket: "now", tone: "warning", source: "Teleconsult", who: t.patientName ?? "Patient",
        title: "In the waiting room", detail: `Booked ${clock(t.startsAt, tz)}${t.patientWaitingSince ? ` · waiting since ${clock(t.patientWaitingSince, tz)}` : ""}`,
        at: t.patientWaitingSince ?? t.startsAt, destination: "teleconsultations",
      });
    else if (t.status === "scheduled" && starts >= s.now && starts <= s.now + UPCOMING_MIN * MIN)
      alerts.push({
        key: `tele_soon:${t.sessionId}`, bucket: "upcoming", tone: "info", source: "Teleconsult", who: t.patientName ?? "Patient",
        title: `Teleconsult at ${clock(t.startsAt, tz)}`, detail: "Video visit with you", at: t.startsAt, destination: "teleconsultations",
      });
  }

  for (const e of known("Consultation", s.encounters) ?? [])
    if (e.attendingStaffId === s.staffId && e.status === "in_progress" && ms(e.arrivedAt) < s.now - OPEN_ENCOUNTER_MIN * MIN)
      alerts.push({
        key: `enc_open:${e.encounterId}`, bucket: "now", tone: "info", source: "Consultation", who: e.patientName,
        title: "Consultation still open", detail: `${e.encounterNo} · arrived ${clock(e.arrivedAt, tz)}`, at: e.arrivedAt, destination: "consultations",
      });

  for (const r of known("Referral", s.referrals) ?? [])
    alerts.push({
      key: `referral:${r.referralId}`, bucket: "now", tone: r.urgency === "routine" ? "info" : "warning", source: "Referral", who: r.patientName,
      title: `${r.urgency === "routine" ? "Referral" : `${r.urgency[0]!.toUpperCase()}${r.urgency.slice(1)} referral`} to you`,
      detail: `From ${r.referredByName} · ${r.reason}`, at: r.createdAt, destination: "consultations",
    });

  if (s.setup) {
    if (s.setup.some((i) => i.state === "unknown")) unavailable.push("Booking setup");
    for (const i of s.setup)
      if (i.state === "not_started" || i.state === "blocked")
        alerts.push({
          key: `setup:${i.id}:${i.state}`, bucket: "now", tone: i.state === "blocked" ? "warning" : "info", source: "Booking setup", who: "Booking setup",
          title: i.title, detail: i.detail, at: null, destination: i.destination,
        });
  }

  for (const p of known("Staff invite", s.accounts) ?? []) {
    const until = p.account && !p.account.linked ? p.account.inviteExpiresAt : null;
    if (!until || ms(until) > s.now + INVITE_DAYS * DAY) continue;
    const gone = ms(until) <= s.now;
    alerts.push({
      key: `${gone ? "invite_expired" : "invite"}:${p.staffId}:${until}`, bucket: gone ? "now" : "upcoming", tone: gone ? "warning" : "info",
      source: "Staff invite", who: p.displayName, title: gone ? "Invite expired" : "Invite expires soon",
      detail: `${gone ? "Expired" : "Expires"} ${new Date(until).toLocaleDateString("en-IN", { timeZone: tz, day: "numeric", month: "short" })} · not signed in yet`,
      at: until, destination: "settings?section=team",
    });
  }

  const registration = (r: { registrationId: string; council: string; validUntil: string | null }, who: string, mine: boolean) => {
    if (!r.validUntil) return;
    const currentDay = localToday(tz, new Date(s.now));
    if (r.validUntil > shiftDay(currentDay, REGISTRATION_DAYS)) return;
    const gone = r.validUntil < currentDay;
    alerts.push({
      key: `${gone ? "reg_expired" : "reg"}:${r.registrationId}:${r.validUntil}`, bucket: gone ? "now" : "upcoming", tone: gone ? "warning" : "info",
      source: "Registration", who, title: `${mine ? "Your " : ""}${r.council} registration ${gone ? "has expired" : "expires soon"}`,
      detail: `Valid until ${new Date(`${r.validUntil}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      at: r.validUntil, destination: mine ? "settings?section=account" : "settings?section=registrations",
    });
  };
  for (const r of known("Registration", s.registrations) ?? []) registration(r, "You", true);
  for (const r of known("Team registration", s.team) ?? []) registration(r, r.staffName, false);

  const order = (a: Alert) => (a.bucket === "now" ? 0 : 1);
  alerts.sort((a, b) => order(a) - order(b) || (a.at ?? "").localeCompare(b.at ?? ""));
  return { alerts, unavailable: [...new Set(unavailable)] };
}

export type MarkedAlert = Alert & { read: boolean; folder: "open" | "snoozed" | "done" };

/** Applies the person's saved marks. A snooze that has run out counts as open again. */
export function applyMarks(alerts: Alert[], marks: AlertMark[], now: number): MarkedAlert[] {
  const byKey = new Map(marks.map((m) => [m.key, m]));
  return alerts.map((a) => {
    const m = byKey.get(a.key);
    const folder = m?.dismissedAt ? "done" : m?.snoozedUntil && ms(m.snoozedUntil) > now ? "snoozed" : "open";
    return { ...a, read: !!m?.readAt, folder };
  });
}

/** "6 min ago" for what is happening now, the clock time for later today, else the day. */
export function whenLabel(a: Alert, now: number, timezone: string) {
  if (!a.at) return "Now";
  if (a.at.length === 10)
    return new Date(`${a.at}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const t = ms(a.at),
    mins = Math.round((now - t) / MIN);
  if (a.bucket === "now" && mins >= 1 && mins < 60) return `${mins} min ago`;
  if (Math.abs(t - now) < DAY) return clock(a.at, timezone);
  return new Date(a.at).toLocaleDateString("en-IN", { timeZone: timezone, day: "numeric", month: "short" });
}

/** The clinic's next local midnight, as an instant: when "Snooze until tomorrow" ends. */
export function tomorrowStart(now: number, timezone: string) {
  const nextDay = shiftDay(localToday(timezone, new Date(now)), 1);
  return clinicDateInstant(`${nextDay}T00:00`, timezone);
}

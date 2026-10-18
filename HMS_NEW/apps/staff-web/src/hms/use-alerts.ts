// Loads the alert sources the signed-in person may read (docs/prd/staff-alerts.md) and their saved marks.
// One instance sits above the header and pages (AlertsProvider) so the bell and the Alerts page share reads.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { query, request } from "./client";
import { useQuery, useWorkspace } from "./hooks";
import { today } from "./model";
import { useSetupItems } from "./use-setup";
import type { Evidence } from "./setup-readiness";
import type { Appointment, EncounterRow } from "./types";
import {
  applyMarks,
  deriveAlerts,
  type AlertMark,
  type MarkedAlert,
  type Referral,
  type Registration,
  type StaffAccount,
  type TeamRegistration,
  type Tele,
  type WaitlistEntry,
} from "./alerts";

const POLL = 60_000;
type Patch = { read?: boolean; dismissed?: boolean; snoozedUntil?: string | null };

function evidence<T>(r: { loading: boolean; error: string; data: T | null }, pick?: (d: T) => unknown) {
  if (r.error) return { state: "unknown" } as const;
  if (r.loading || r.data === null) return { state: "loading" } as const;
  return { state: "known", value: pick ? pick(r.data) : r.data } as const;
}

export function useAlertsSource() {
  const { me, facility, can } = useWorkspace();
  const day = today(facility.timezone),
    at = facility.facilityId,
    doctor = me.staffType === "doctor";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const mine = doctor ? me.staffId : undefined;
  const on = {
    appointments: can("appointments.read"),
    waitlist: !doctor && can("appointments.read"),
    teleconsults: doctor && can("teleconsult.read"),
    clinical: doctor && can("encounters.read"),
    accounts: can("access.manage"),
  };
  const appointments = useQuery<{ items: Appointment[] }>(
    on.appointments ? `/v1/appointments?${query({ facilityId: at, from: day, to: day, staffId: mine, limit: 500 })}` : null, POLL);
  const waitlist = useQuery<{ items: WaitlistEntry[] }>(
    on.waitlist ? `/v1/waitlist?${query({ facilityId: at, status: "offered" })}` : null, POLL);
  const teleconsults = useQuery<{ items: Tele[] }>(
    on.teleconsults ? `/v1/teleconsults?${query({ facilityId: at, date: day, staffId: me.staffId })}` : null, POLL);
  const encounters = useQuery<{ items: EncounterRow[] }>(
    on.clinical ? `/v1/encounters?${query({ facilityId: at, date: day, staffId: me.staffId, status: "in_progress" })}` : null, POLL);
  const referrals = useQuery<{ items: Referral[] }>(
    on.clinical ? `/v1/referrals?${query({ facilityId: at, staffId: me.staffId, status: "sent" })}` : null, POLL);
  const accounts = useQuery<{ items: StaffAccount[] }>(on.accounts ? `/v1/staff-accounts?facilityId=${at}` : null);
  const marks = useQuery<{ states: AlertMark[]; registrations: Registration[]; teamRegistrations: TeamRegistration[] | null }>("/v1/me/alerts", POLL);
  const setup = useSetupItems("in_person", "");
  const [pending, setPending] = useState<Record<string, AlertMark>>({});
  const [error, setError] = useState("");

  const { alerts, unavailable } = useMemo(() => {
    const items = <T,>(r: { loading: boolean; error: string; data: { items: T[] } | null }, on: boolean): Evidence<T[]> | undefined =>
      on ? (evidence(r, (d) => d.items) as Evidence<T[]>) : undefined;
    const derived = deriveAlerts({
      now,
      timezone: facility.timezone,
      staffId: me.staffId,
      appointments: items(appointments, on.appointments),
      waitlist: items(waitlist, on.waitlist),
      teleconsults: items(teleconsults, on.teleconsults),
      encounters: items(encounters, on.clinical),
      referrals: items(referrals, on.clinical),
      accounts: items(accounts, on.accounts),
      setup: setup.admin ? setup.items : undefined,
      registrations: evidence(marks, (d) => d.registrations) as Evidence<Registration[]>,
      // null means the server did not check team registrations for this person (no staff.manage): leave them out.
      team: marks.data?.teamRegistrations === null ? undefined : (evidence(marks, (d) => d.teamRegistrations) as Evidence<TeamRegistration[]>),
    });
    const saved = new Map((marks.data?.states ?? []).map((m) => [m.key, m]));
    for (const [k, m] of Object.entries(pending)) saved.set(k, m);
    if (marks.error) derived.unavailable.push("Read and dismiss marks");
    return { alerts: applyMarks(derived.alerts, [...saved.values()], now), unavailable: derived.unavailable };
  }, [now, facility.timezone, me.staffId, on.appointments, on.waitlist, on.teleconsults, on.clinical, on.accounts, appointments, waitlist, teleconsults, encounters, referrals, accounts, setup.admin, setup.items, marks, pending]);

  /** Applies the mark at once and saves it; on failure the mark is rolled back and the error shown. */
  const mark = useCallback(
    async (targets: MarkedAlert[], patch: Patch) => {
      if (targets.length === 0) return;
      setError("");
      const stamp = new Date().toISOString();
      setPending((p) => {
        const next = { ...p };
        for (const a of targets) {
          const base = next[a.key] ?? marks.data?.states.find((m) => m.key === a.key) ?? { key: a.key, readAt: null, dismissedAt: null, snoozedUntil: null };
          next[a.key] = {
            ...base,
            ...(patch.read !== undefined ? { readAt: patch.read ? (base.readAt ?? stamp) : null } : {}),
            ...(patch.dismissed !== undefined ? { dismissedAt: patch.dismissed ? stamp : null } : {}),
            ...(patch.snoozedUntil !== undefined ? { snoozedUntil: patch.snoozedUntil } : {}),
          };
        }
        return next;
      });
      try {
        if (targets.length > 1 && Object.keys(patch).length === 1 && patch.read === true)
          await request("/v1/me/alerts/read", { method: "POST", body: { keys: targets.map((a) => a.key) } });
        else
          await Promise.all(targets.map((a) => request(`/v1/me/alerts/${encodeURIComponent(a.key)}`, { method: "PUT", body: patch })));
        await marks.refresh();
      } catch {
        setError("Could not save that change. Try again.");
      }
      setPending((p) => {
        const next = { ...p };
        for (const a of targets) delete next[a.key];
        return next;
      });
    },
    [marks],
  );

  return { alerts, unavailable, error, now, loading: marks.loading, mark };
}

export type AlertsState = ReturnType<typeof useAlertsSource>;
export const AlertsContext = createContext<AlertsState | null>(null);
export function useAlerts() {
  const value = useContext(AlertsContext);
  if (!value) throw new Error("Alerts context is missing");
  return value;
}

// First-run guide (docs/prd/first-run-onboarding.md). Pure derivations from server reads only.
import type { SetupItem } from "./setup-readiness";

/** The four booking setup steps, in order. `target` is the button the coach mark points at. */
export const SETUP_STEPS = [
  { id: "clinic", title: "Clinic details", hint: "Add your clinic's address and time zone.", action: "Add clinic details", target: "Edit details" },
  { id: "doctor", title: "Add a doctor", hint: "Add the doctor patients can book.", action: "Add a doctor", target: "Add doctor" },
  { id: "service", title: "Consultation fee", hint: "Add a consultation and what it costs.", action: "Add a fee", target: "Add service" },
  { id: "hours", title: "Opening hours", hint: "Publish the hours patients can book.", action: "Set hours", target: "Set doctor hours" },
] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number]["id"];

/** Pages that can't do anything useful until booking setup is done. */
export const LOCKED_UNTIL_SETUP = new Set([
  "appointments", "waitlist", "queue", "patients", "consultations", "teleconsultations",
  "whatsapp", "voice", "apple_messages", "google_business", "growth_analytics", "loyalty",
]);

export type SetupProgress = { reached: number; ready: boolean; done: Set<string> } | "loading" | null;

/**
 * Where the clinic is: "loading" while a read is in flight, `null` when a read failed or isn't permitted
 * (never guess), otherwise the first unfinished step, which steps are saved, and whether all four are.
 */
export function setupProgress(items: SetupItem[]): SetupProgress {
  const steps = SETUP_STEPS.map((s) => items.find((i) => i.id === s.id));
  if (steps.some((i) => !i || i.state === "unknown")) return null;
  if (steps.some((i) => i!.state === "loading")) return "loading";
  const done = new Set(steps.filter((i) => i!.state === "complete").map((i) => i!.id));
  const reached = steps.findIndex((i) => i!.state !== "complete");
  return reached === -1 ? { reached: SETUP_STEPS.length, ready: true, done } : { reached, ready: false, done };
}

export type OverviewPhase = "loading" | "setup" | "first_patients" | "running";

/**
 * Unfinished setup shows only the guide. A clinic with no appointment ever shows "first patients"
 * instead of all-zero tiles. Unknown setup never blocks reports.
 */
export function overviewPhase(setup: SetupProgress, appointmentsEver: number | null): OverviewPhase {
  if (setup === "loading") return "loading";
  if (setup && !setup.ready) return "setup";
  if (appointmentsEver === null) return "loading";
  return appointmentsEver === 0 ? "first_patients" : "running";
}

/** Coach-mark step from `?guide=`; anything else is ignored. */
export function guideStep(search: string): (typeof SETUP_STEPS)[number] | null {
  const id = new URLSearchParams(search).get("guide");
  return SETUP_STEPS.find((s) => s.id === id) ?? null;
}

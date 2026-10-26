/** Apple Messages › Setup steps. The first two are local form pages; the rest follow the saved request. */
export const APPLE_STEPS = [
  { id: "details", label: "Clinic details", description: "How patients see you" },
  { id: "hours", label: "Support hours", description: "When reception replies" },
  { id: "submit", label: "Submit", description: "Send your application" },
  { id: "review", label: "Approval", description: "Wait for approval" },
  { id: "live", label: "Live", description: "Patients can message you" },
] as const;

/**
 * Index of the step in progress. A submitted request never counts as live: only a configured,
 * non-demo connection does. `local` is how far the person has got through the unsaved form pages.
 */
export function appleStep(state: "not_started" | "draft" | "requested", live: boolean, local: number): number {
  if (live) return APPLE_STEPS.length;
  if (state === "requested") return 3;
  if (state === "draft") return 2;
  return Math.min(local, 1);
}

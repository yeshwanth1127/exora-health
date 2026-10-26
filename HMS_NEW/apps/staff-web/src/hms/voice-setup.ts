/** Voice › Call setup steps. Derived only from server reads; nothing here infers a provider result. */
export const VOICE_STEPS = [
  { id: "doctors", label: "Doctors", description: "Who patients can book" },
  { id: "line", label: "Phone line", description: "How calls reach the agent" },
  { id: "request", label: "Apply", description: "Submit your application" },
  { id: "build", label: "Approval", description: "Wait for approval" },
] as const;

export type VoiceSetupInput = {
  doctors: number;
  /** Phone-line preferences state; null while unread. */
  line: "not_started" | "draft" | "requested" | null;
  agent: { exists: boolean; request: "pending" | "in_setup" | "completed" | "declined" | null } | null;
  live: boolean;
};

/** Index of the step in progress; VOICE_STEPS.length once patients can call. Later server facts win over earlier steps. An approved agent waits on the last step until it is live. */
export function voiceStep(i: VoiceSetupInput): number {
  if (i.live) return VOICE_STEPS.length;
  if (i.agent?.exists) return 3;
  if (i.agent?.request === "pending" || i.agent?.request === "in_setup") return 3;
  if (!i.doctors) return 0;
  if (i.line !== "requested") return 1;
  return 2;
}

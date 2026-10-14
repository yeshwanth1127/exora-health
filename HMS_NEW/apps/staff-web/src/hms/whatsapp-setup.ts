/** WhatsApp self-serve setup: clinic-shape templates, booking flow steps and setup progress. */
export type ClinicShape = "single_doctor" | "small_clinic" | "multi_specialty";
export type StepId =
  | "welcome"
  | "department"
  | "doctor"
  | "slot"
  | "details"
  | "confirm";
export type Attachment = { kind: "image" | "pdf"; name: string };
export type FlowStep = {
  id: StepId;
  on: boolean;
  message: string;
  header: Attachment | null;
};
export type NumberPath = "coexistence" | "new_number";
export type WhatsAppSetup = {
  path: NumberPath;
  connected: { phone: string; name: string } | null;
  shape: ClinicShape | null;
  steps: FlowStep[];
  flowDone: boolean;
  /** Keys: `photo:<staffId>`, `profile:<staffId>`, `guide:<departmentId>`. */
  content: Record<string, Attachment>;
  contentDone: boolean;
  tested: boolean;
  /** Went live once; pausing later doesn't reopen setup. */
  live: boolean;
  paused: boolean;
};
export const emptySetup: WhatsAppSetup = {
  path: "coexistence",
  connected: null,
  shape: null,
  steps: [],
  flowDone: false,
  content: {},
  contentDone: false,
  tested: false,
  live: false,
  paused: false,
};

export const shapes: Record<
  ClinicShape,
  { label: string; description: string; steps: StepId[] }
> = {
  single_doctor: {
    label: "Single doctor",
    description: "One doctor. Patients go straight to choosing a time.",
    steps: ["welcome", "slot", "details", "confirm"],
  },
  small_clinic: {
    label: "Small clinic",
    description: "A few doctors. Patients pick a doctor, then a time.",
    steps: ["welcome", "doctor", "slot", "details", "confirm"],
  },
  multi_specialty: {
    label: "Multi-speciality",
    description:
      "Several departments. Patients pick a speciality, a doctor, then a time.",
    steps: ["welcome", "department", "doctor", "slot", "details", "confirm"],
  },
};

export const stepInfo: Record<
  StepId,
  { title: string; required: boolean; patient: string }
> = {
  welcome: { title: "Welcome", required: true, patient: "Hi" },
  department: {
    title: "Choose speciality",
    required: false,
    patient: "Cardiology",
  },
  doctor: { title: "Choose doctor", required: false, patient: "" },
  slot: { title: "Choose time", required: true, patient: "Tomorrow, 10:30 am" },
  details: { title: "Patient name", required: true, patient: "Ravi Kumar" },
  confirm: { title: "Confirmation", required: true, patient: "" },
};

const copy = (clinic: string, doctor: string): Record<StepId, string> => ({
  welcome: `Hello! Welcome to ${clinic}. Tap below to book an appointment.`,
  department: "Which speciality would you like to visit?",
  doctor: "Choose a doctor. Fees are shown with each name.",
  slot: `Pick a day and time${doctor ? ` with ${doctor}` : ""}.`,
  details: "Please type the patient's full name.",
  confirm:
    "Your appointment is booked. We've sent the details below. Reply hi any time to view, change or cancel it.",
});

/** Every step exists so switching a step back on keeps its edits; the shape decides which start on. */
export function stepsFor(
  shape: ClinicShape,
  clinic: string,
  doctor = "",
): FlowStep[] {
  const text = copy(clinic, shape === "single_doctor" ? doctor : "");
  return (Object.keys(stepInfo) as StepId[]).map((id) => ({
    id,
    on: shapes[shape].steps.includes(id),
    message: text[id],
    header: null,
  }));
}

/** Suggest a shape from what the clinic registered. */
export function suggestShape(doctors: number, departments: number): ClinicShape {
  if (doctors <= 1) return "single_doctor";
  return departments > 1 ? "multi_specialty" : "small_clinic";
}

export type Stage = "connect" | "flow" | "content" | "test" | "live";
export const stageOrder: Stage[] = ["connect", "flow", "content", "test", "live"];
export function currentStage(s: WhatsAppSetup): Stage {
  if (!s.connected) return "connect";
  if (!s.shape || !s.flowDone) return "flow";
  if (!s.contentDone) return "content";
  if (!s.tested || !s.live) return "test";
  return "live";
}

/** wa.me link a patient taps to start a booking. */
export const chatLink = (phone: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent("Hi")}`;

export const validPhone = (phone: string) => /^\+[1-9]\d{7,14}$/.test(phone);

export function checkUpload(file: File): string | null {
  const pdf = file.type === "application/pdf";
  if (!pdf && !["image/jpeg", "image/png"].includes(file.type))
    return "Use a JPG, PNG or PDF file.";
  if (file.size > (pdf ? 10 : 5) * 1024 * 1024)
    return `Choose a file smaller than ${pdf ? 10 : 5} MB.`;
  return null;
}

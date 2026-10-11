// Shapes returned by the diagnostics API (ERD m06) and the small pure rules the screens share.

export type Priority = "routine" | "urgent" | "stat";

export type Orderable = {
  serviceItemId: string;
  code: string;
  name: string;
  category: string;
  modality: string | null;
  specimenType: string | null;
};

export type OrderSet = {
  orderSetId: string;
  name: string;
  scope: "personal" | "department";
  departmentName: string | null;
  version: number;
  items: { serviceItemId: string; name: string; category: string }[];
};

export type ResultRow = {
  resultItemId: string;
  code: string;
  name: string;
  valueNum: string | null;
  valueText: string | null;
  valueDisplay: string | null;
  unit: string | null;
  refLow: string | null;
  refHigh: string | null;
  refText?: string | null;
  abnormalFlag: string | null;
  isCritical: boolean;
  status: string;
};

export type ReportSummary = {
  reportId: string;
  reportType: string;
  status: string;
  conclusion: string | null;
  releasedAt: string | null;
  releasedByName: string | null;
  versionNo: number;
  version: number;
  body: { findings?: string; impression?: string; comment?: string };
  amendmentReason: string | null;
  acknowledgements: { staffId: string; staffName: string; acknowledgedAt: string; actionTaken: string | null }[];
};

export type OrderItemView = {
  orderItemId: string;
  serviceItemId: string;
  name: string;
  category: string;
  status: string;
  cancelReason: string | null;
  specimens: { specimenId: string; accessionNo: string; status: string; rejectionReason: string | null }[];
  results: ResultRow[];
  report: ReportSummary | null;
  imagingStudy: { imagingStudyId: string; accessionNo: string; status: string; modality: string } | null;
  tests: OrderItemView[];
};

export type OrderView = {
  orderId: string;
  requisitionNo: string;
  priority: Priority;
  status: string;
  clinicalIndication: string | null;
  orderedAt: string;
  orderedByName: string;
  items: OrderItemView[];
};

export type LabWorkRow = {
  orderItemId: string;
  name: string;
  status: string;
  priority: Priority;
  requisitionNo: string;
  orderedAt: string;
  patientId: string;
  patientName: string;
  mrn: string;
  specimenType: string | null;
  section: string | null;
  panelName: string | null;
  accessionNo: string | null;
  needsRecollection: boolean;
  rejectedSpecimenId: string | null;
  reportId?: string | null;
  reportStatus?: string | null;
  reportVersion?: number | null;
  hasCritical?: boolean;
};

export type SpecimenRow = {
  specimenId: string;
  accessionNo: string;
  barcode: string;
  specimenType: string;
  collectedAt: string;
  patientName: string;
  mrn: string;
  tests: string;
};

export type Definition = {
  observationDefinitionId: string;
  code: string;
  name: string;
  valueType: string;
  unit: string | null;
  low: string | null;
  high: string | null;
  criticalLow: string | null;
  criticalHigh: string | null;
  textRange: string | null;
  options: { answerOptionId: string; display: string }[];
};

export type LabResult = ResultRow & {
  observationDefinitionId: string;
  valueOptionId: string | null;
  enteredBy: string;
  enteredByName: string;
  criticalAlerts: { criticalAlertId: string; notifiedTo: string; channel: string; readBackConfirmed: boolean }[];
};

export type LabItem = {
  orderItemId: string;
  name: string;
  category: string;
  status: string;
  patientName: string;
  mrn: string;
  sex: string;
  requisitionNo: string;
  clinicalIndication: string | null;
  orderedBy: string;
  orderedByName: string;
  tests: {
    orderItemId: string;
    name: string;
    status: string;
    section: string | null;
    definitions: Definition[];
    results: LabResult[];
    isolates: { isolateId: string; sequence: number; organism: string; colonyCount: string | null; susceptibilities: { antibiotic: string; method: string; interpretation: string }[] }[];
  }[];
  report: { reportId: string; status: string; version: number; versionNo: number; conclusion: string | null } | null;
};

export type StudyRow = {
  imagingStudyId: string;
  orderItemId: string;
  modality: string;
  accessionNo: string;
  status: string;
  isObstetric: boolean;
  version: number;
  name: string;
  priority: Priority;
  patientName: string;
  mrn: string;
  clinicalIndication: string | null;
  formFId: string | null;
  formFVersion: number | null;
  formFComplete: boolean | null;
  reportId: string | null;
  reportStatus: string | null;
  reportVersion: number | null;
};

export type FormFRow = {
  formFId: string;
  patientName: string;
  mrn: string;
  accessionNo: string;
  patientDeclarationAt: string | null;
  doctorDeclarationAt: string | null;
  doctorName: string | null;
  submittedAt: string | null;
  submissionRef: string | null;
  retainUntil: string;
};

export type UnacknowledgedRow = {
  reportId: string;
  name: string;
  patientName: string;
  mrn: string;
  releasedAt: string;
  isCritical: boolean;
  requisitionNo: string;
};

/** An item can be cancelled until a result exists. */
export const cancellable = (status: string) => ["ordered", "scheduled", "collected", "in_progress"].includes(status);

/** A report the clinician can read and acknowledge. */
export const released = (status: string | null | undefined) => status === "final" || status === "amended";

/** The next step a radiographer can take on a study (reported comes from releasing its report). */
export function nextStudyStatus(status: string): "arrived" | "in_progress" | "completed" | null {
  return status === "scheduled" ? "arrived" : status === "arrived" ? "in_progress" : status === "in_progress" ? "completed" : null;
}

/** H / L / HH / LL markers next to a value, as printed on lab reports. */
export function flagMark(flag: string | null | undefined): string {
  return { high: "H", low: "L", critical_high: "HH", critical_low: "LL", abnormal: "A" }[flag ?? ""] ?? "";
}

export function resultValue(r: Pick<ResultRow, "valueNum" | "valueText" | "valueDisplay" | "unit">): string {
  const v = r.valueDisplay ?? r.valueText ?? (r.valueNum !== null ? String(Number(r.valueNum)) : "");
  return r.unit && r.valueNum !== null ? `${v} ${r.unit}` : v;
}

export function referenceText(r: { refLow: string | null; refHigh: string | null; refText?: string | null }): string {
  if (r.refLow !== null && r.refHigh !== null) return `${Number(r.refLow)}–${Number(r.refHigh)}`;
  if (r.refLow !== null) return `≥ ${Number(r.refLow)}`;
  if (r.refHigh !== null) return `≤ ${Number(r.refHigh)}`;
  return r.refText ?? "";
}

export const PRIORITY_RANK: Record<Priority, number> = { stat: 0, urgent: 1, routine: 2 };

export const REJECTION_REASONS = ["haemolysed", "clotted", "insufficient", "mislabelled", "wrong_container", "delayed", "other"] as const;

/** Readable text for refusals the diagnostics API returns. */
export const DIAGNOSTICS_REASONS: Record<string, string> = {
  module_inactive: "The diagnostics module is switched off for this hospital; results stay readable.",
  encounter_closed: "This encounter is closed; orders go on an open visit.",
  already_resulted: "Results were already entered; ask the lab to amend the report instead.",
  not_orderable: "One of the services can't be ordered.",
  no_items: "Choose at least one service.",
  not_collectable: "Some of these tests aren't waiting for a specimen.",
  specimen_type_required: "These tests need different specimen types; choose the specimen type.",
  duplicate_barcode: "That barcode is already on another specimen.",
  already_recollected: "This specimen was already recollected.",
  not_ready: "The specimen hasn't been received yet (or the report was released).",
  critical_not_notified: "Call out and log every critical value before release.",
  results_incomplete: "Every test needs its results first.",
  already_released: "This report was already released.",
  already_acknowledged: "You already acknowledged this report.",
  form_f_required: "An obstetric ultrasound needs Form F with both declarations before it is completed.",
  stale_version: "Someone else changed this; reload and try again.",
  submitted: "This Form F was already submitted to the Appropriate Authority.",
  nothing_to_submit: "No Form F records are waiting for this month.",
  retired: "This order set was retired.",
};

/** Tabs of the Lab & imaging page and the permission (any of) each needs. */
export const LAB_TABS = [
  { key: "collect", name: "Collect", permission: "lab.collect" },
  { key: "receive", name: "Receive", permission: "lab.process" },
  { key: "result", name: "Enter results", permission: "lab.process" },
  { key: "verify", name: "Verify & release", permission: "lab.verify" },
  { key: "imaging", name: "Imaging", permission: ["imaging.manage", "imaging.report"] },
  { key: "formf", name: "Form F", permission: "pcpndt.manage" },
  { key: "mine", name: "My results", permission: "results.acknowledge" },
] as const;

/** Permissions that open this page (any one of them). */
export const LAB_PAGE_PERMISSIONS = [...new Set(LAB_TABS.flatMap((t) => t.permission))];

export type Me = {
  tenantId: string;
  staffId: string;
  displayName: string;
  staffType: string;
  isSystemAccount: boolean;
  permissions: Record<string, string[]>;
};
export type Facility = {
  facilityId: string;
  code: string;
  name: string;
  city: string | null;
  timezone: string;
  facilityType: string;
};
export type Practitioner = {
  staffId: string;
  name: string;
  facilityId: string;
  specialty: string | null;
  specialtyName: string | null;
  department: string;
  acceptsVirtual: boolean | null;
  calendarId: string | null;
};
export type Patient = {
  patientId: string;
  mrn: string;
  name: string;
  sex: string;
  birthDate: string | null;
  phone: string | null;
  status: string;
};
export type PatientDetail = {
  patientId: string;
  mrn: string;
  givenName: string;
  familyName: string | null;
  sex: string;
  birthDate: string | null;
  status: string;
  contacts: { kind: string; value: string; is_primary: boolean }[];
};
export type Appointment = {
  appointmentId: string;
  confirmationCode: string;
  status: string;
  bookingKind: string;
  facilityId: string;
  practitionerStaffId: string;
  practitionerName: string;
  patientId: string | null;
  patientName: string | null;
  mrn: string | null;
  bookingPartyName: string | null;
  bookingPartyPhone: string | null;
  sessionOn: string;
  startsAt: string | null;
  endsAt: string | null;
  visitType: string;
  visitMode: string;
  originChannel: string;
  priority: string;
  feeMinor: number | null;
  reason: string | null;
  tokenNo: number | null;
  tokenStatus: string | null;
  rescheduledFromId: string | null;
  cancelReason: string | null;
};
export type Slot = {
  slotStart: string;
  slotEnd: string;
  facilityId: string;
  visitMode: string;
  status: "free" | "taken" | "blocked";
};
export type Hold = {
  reservationId: string;
  slotStart: string;
  slotEnd: string;
  facilityId: string;
  holdExpiresAt: string;
};
export type BookingResult = {
  appointmentId: string;
  confirmationCode: string;
  status: string;
  feeMinor: number | null;
};
export type QueueToken = {
  tokenId: string;
  tokenNo: number;
  patientId: string;
  appointmentId: string | null;
  priority: string;
  status: string;
};
export type EncounterRow = {
  encounterId: string;
  encounterNo: string;
  status: string;
  patientId: string;
  patientName: string;
  mrn: string;
  attendingStaffId: string;
  attendingName: string;
  appointmentId: string | null;
  tokenNo: number | null;
  arrivedAt: string;
};
export type ClinicalPatient = {
  patientId: string;
  mrn: string;
  givenName: string;
  familyName: string | null;
  sex: string;
  birthDate: string | null;
};
export type Vital = {
  observationId: string;
  code: string;
  display: string;
  valueNum: string | null;
  valueText: string | null;
  unit: string | null;
  effectiveAt: string;
  status: string;
};
export type Note = {
  noteId: string;
  noteType: string;
  status: string;
  currentVersion: number;
  authorStaffId: string;
  authorName: string;
  templateCode: string | null;
  narrative: string | null;
  data: Record<string, unknown>;
  signedAt: string | null;
};
export type NoteTemplate = {
  templateId: string;
  code: string;
  templateVersion: number;
  name: string;
  noteType: string;
  schema: {
    properties?: Record<string, { type?: string; title?: string }>;
    propertyOrder?: string[];
  };
};
export type Allergy = {
  allergyId: string;
  category: string;
  substance: string;
  reaction: string | null;
  severity: string | null;
  criticality: string | null;
  status: string;
};
export type Problem = {
  conditionId: string;
  display: string;
  clinicalStatus: string;
  verificationStatus: string;
};
export type EncounterDetail = {
  encounter: {
    encounterId: string;
    encounterNo: string;
    status: string;
    attendingStaffId: string;
    appointmentId: string | null;
    chiefComplaint: string | null;
    disposition: string | null;
  };
  patient: ClinicalPatient;
  allergies: Allergy[];
  problems: Problem[];
  vitals: Vital[];
  notes: Note[];
  diagnoses: {
    encounterDiagnosisId: string;
    display: string;
    code: string | null;
    role: string;
    verificationStatus: string;
  }[];
};
export type Chart = {
  patient: ClinicalPatient;
  allergies: Allergy[];
  problems: Problem[];
  encounters: {
    encounterId: string;
    encounterNo: string;
    status: string;
    attendingName: string;
    arrivedAt: string;
  }[];
  latestVitals: Pick<
    Vital,
    "code" | "display" | "valueNum" | "valueText" | "unit" | "effectiveAt"
  >[];
};

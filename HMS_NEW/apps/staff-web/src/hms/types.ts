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
  status?: string;
};
export type FacilityDetail = {
  facilityId: string;
  code: string;
  name: string;
  facilityType: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  pincode: string | null;
  stateCode: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  directionsUrl: string | null;
  arrivalInstructions: string | null;
  status: string;
  version: number;
};
export type Department = {
  departmentId: string;
  code: string;
  name: string;
  kind: string;
  specialty: string | null;
  specialtyName: string | null;
  status: string;
  version: number;
};
export type HealthcareService = {
  healthcareServiceId: string;
  code: string;
  name: string;
  departmentId: string;
  serviceMode: "in_person" | "virtual" | "both";
  defaultDurationMin: number;
  isPublic: boolean;
  status: string;
  version: number;
};
export type ConsultRoom = {
  locationId: string;
  code: string;
  name: string;
  departmentId: string | null;
  status: string;
  version: number;
};
export type ClinicDirectory = {
  facilityId: string;
  departments: Department[];
  services: HealthcareService[];
  consultRooms: ConsultRoom[];
};
export type PriceMode = "in_person" | "virtual" | "any";
export type PriceBookItem = {
  healthcareServiceId: string;
  staffId: string | null;
  mode: PriceMode;
  feeMinor: number;
  validFrom: string;
  validTo: string | null;
};
export type Specialty = { code: string; name: string };
export type PractitionerDetail = {
  staffId: string;
  displayName: string;
  staffType: string;
  status: string;
  phone: string | null;
  email: string | null;
  staffVersion: number;
  calendarId: string | null;
  profile: {
    specialty: string | null;
    specialtyName: string | null;
    qualifications: string[];
    bio: string | null;
    experienceYears: number | null;
    languages: string[];
    acceptsVirtual: boolean;
    publicSlug: string | null;
    published: boolean;
    version: number;
  } | null;
  affiliations: {
    affiliationId: string;
    facilityId: string;
    facilityName: string;
    departmentId: string;
    departmentName: string;
    roleTitle: string | null;
    validFrom: string;
    validTo: string | null;
  }[];
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
  birthDateEstimated?: boolean;
  preferredLanguage?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  status: string;
  version: number;
  contacts: { kind: string; value: string; is_primary: boolean }[];
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    district: string | null;
    stateCode: string | null;
    pincode: string | null;
  } | null;
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
  overbookReason: string | null;
};
export type Slot = {
  slotStart: string;
  slotEnd: string;
  facilityId: string;
  visitMode: string;
  status: "free" | "taken" | "blocked";
};
export type Session = {
  sessionOn: string;
  facilityId: string;
  visitMode: string;
  startsAt: string;
  endsAt: string;
  slotMinutes: number | null;
  maxWalkInTokens: number;
  source: "weekly" | "day_plan" | "extra_hours";
};
export type ScheduleException = {
  scheduleExceptionId: string;
  onDate: string;
  kind: "closed" | "block" | "extra_hours";
  start: string | null;
  end: string | null;
  facilityId: string | null;
  reason: string | null;
  revokedAt: string | null;
};
export type FacilityHoliday = {
  facilityHolidayId: string;
  date: string;
  name: string;
  revokedAt: string | null;
};
export type WeeklyRule = {
  scheduleRuleId: string;
  facilityId: string;
  weekday: number;
  start: string;
  end: string;
  slotMinutes: number | null;
  visitMode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};
export type WeeklyPlanResult = {
  affectedAppointmentIds: string[];
  otherPublishedHours: {
    facilityId: string;
    facilityName: string;
    visitMode: string;
    weekday: number;
    start: string;
    end: string;
  }[];
  canSave: boolean;
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
  records: EncounterRecords;
};
export type CarePlan = {
  carePlanId: string;
  title: string;
  status: string;
  periodStart: string;
  periodEnd: string | null;
  encounterId: string | null;
  activities: { activityId: string; kind: string; description: string; frequency: string | null; status: string }[];
};
export type EncounterRecords = {
  triage: { triageId: string; triageScale: string; category: string; arrivalMode: string | null; chiefComplaint: string | null; assessedAt: string; reassessDueAt: string | null; assessedBy: string }[];
  immunizations: { immunizationId: string; vaccine: string; doseNumber: number | null; lotNumber: string | null; administeredAt: string; route: string | null; site: string | null; status: string; notDoneReason: string | null; administeredBy: string }[];
  carePlans: CarePlan[];
  referrals: { referralId: string; direction: string; reason: string; urgency: string; status: string; toStaffId: string | null; toStaffName: string | null; toDepartmentName: string | null; externalOrg: string | null; externalDoctor: string | null; referredBy: string; responseNote: string | null; createdAt: string }[];
  births: { id: string; birth_order: number; sex: string; birth_weight_g: number | null; delivery_method: string; is_live_birth: boolean; born_at: string; civil_registration_ref: string | null }[];
  death: { id: string; died_at: string; manner: string; cause_chain: unknown; mccd_form: string | null; mccd_issued_at: string | null; body_released_to: string | null; body_released_at: string | null } | null;
  mlc: { id: string; version: number; mlc_no: string; mlc_type: string; brought_by_name: string | null; incident_place: string | null; police_station: string | null; police_intimated_at: string | null; intimation_ref: string | null; officer_name: string | null; is_pocso: boolean } | null;
  hasMlc: boolean;
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

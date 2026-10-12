// This single known record was created for local UX verification. Never infer a
// test identity from a person's name or relabel a real patient's record.
export const UX_TEST_PATIENT_ID = "01a12e7f-b00e-7a48-b6e8-b15044f5d191";
export const isTestPatient = (id: string | null | undefined) =>
  id === UX_TEST_PATIENT_ID;
export const patientDisplayName = (
  id: string | null | undefined,
  name: string | null | undefined,
) => (isTestPatient(id) ? "Demo patient" : name || "Patient not linked");

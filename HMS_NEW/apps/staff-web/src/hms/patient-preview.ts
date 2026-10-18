import type { PatientDetail } from "./types";
import { patientDisplayName } from "./patient-presentation";
import { label } from "./model";

export function patientPreview(detail: PatientDetail) {
  const phones = detail.contacts.filter((contact) => contact.kind === "phone");
  return {
    name: patientDisplayName(detail.patientId, [detail.givenName, detail.familyName].filter(Boolean).join(" ")),
    stats: [{ label: "MRN", value: detail.mrn }, { label: "Phone", value: phones.find((contact) => contact.is_primary)?.value ?? phones[0]?.value ?? "Not recorded" }],
    meta: label(detail.status),
  };
}

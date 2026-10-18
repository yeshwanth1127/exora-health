import type { PatientDetail } from "./types";
import { patientDisplayName } from "./patient-presentation";

/** Only extra recorded context: booking callers, contact identifiers and clinical charts stay out. */
export function patientPreview(
  detail: PatientDetail,
  reason?: string | null,
  on?: string,
) {
  const stats: { label: string; value: string }[] = [];
  if (detail.birthDate)
    stats.push({
      label: "Date of birth",
      value: `${detail.birthDate}${detail.birthDateEstimated ? " (estimated)" : ""}`,
    });
  if (detail.preferredLanguage)
    stats.push({ label: "Language", value: detail.preferredLanguage });
  let age: number | undefined;
  if (
    on &&
    detail.birthDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(detail.birthDate) &&
    detail.birthDate <= on
  ) {
    age =
      Number(on.slice(0, 4)) -
      Number(detail.birthDate.slice(0, 4)) -
      Number(on.slice(5) < detail.birthDate.slice(5));
  }
  return {
    name: patientDisplayName(
      detail.patientId,
      [detail.givenName, detail.familyName].filter(Boolean).join(" "),
    ),
    bio: reason?.trim()
      ? `Visit reason: ${reason.trim()}`
      : stats.length
        ? undefined
        : "No additional context recorded.",
    stats,
    meta:
      age !== undefined
        ? `${detail.birthDateEstimated ? "Approximately " : ""}${age} ${age === 1 ? "year" : "years"} old`
        : undefined,
  };
}

import {
  AppointmentMessagesResponseSchema,
  CommsCapabilitiesSchema,
  ContactPointsResponseSchema,
  CommsSummarySchema,
  FollowupRulesResponseSchema,
  FollowupRuleSchema,
  NotificationJobSchema,
  WhatsAppDeliveryResponseSchema,
  type AppointmentMessagesResponse,
} from "@hms/contracts";
import { HmsError } from "./client";

// Fail closed on malformed responses; do not echo contacts or schema input in errors.
function decoder<T>(schema: {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}) {
  return (value: unknown): T => {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new HmsError(
        "The messaging response could not be verified. Refresh before continuing.",
        502,
        "invalid_response",
      );
    return result.data;
  };
}
export const decodeMessages = decoder(AppointmentMessagesResponseSchema);
export const decodeCapabilities = decoder(CommsCapabilitiesSchema);
export const decodeContacts = decoder(ContactPointsResponseSchema);
export const decodeCommsSummary = decoder(CommsSummarySchema);
export const decodeFollowupRules = decoder(FollowupRulesResponseSchema);
export const decodeFollowupRule = decoder(FollowupRuleSchema);
export const decodeNotificationJob = decoder(NotificationJobSchema);
export const decodeWhatsAppDelivery = decoder(WhatsAppDeliveryResponseSchema);

export function messagingAvailability(moduleStatus: string): string {
  return moduleStatus === "active"
    ? "Automatic delivery is not connected. Notification records here have not been sent."
    : "Messaging is paused or unavailable. Existing history stays readable.";
}
export function notificationReason(reason: string): string {
  const reasons: Record<string, string> = {
    no_contact: "No messaging contact selected for this person at this clinic.",
    no_consent: "The required messaging consent has not been recorded.",
    consent_withdrawn: "Messaging consent was withdrawn.",
    reminder_already_due: "The day-before reminder time had already passed.",
    expired: "The notification is no longer timely.",
    rescheduled: "This visit was moved; its old notification was cancelled.",
    appointment_cancelled:
      "This visit was cancelled; its pending notification was cancelled.",
    appointment_inactive:
      "This notification no longer matches an active visit.",
    module_inactive:
      "Messaging was paused before this notification could proceed.",
    log_transport_no_delivery:
      "Recorded locally; automatic delivery is not connected.",
    provider_transport_not_implemented: "Automatic delivery is not connected.",
  };
  return (
    reasons[reason] ??
    "This notification needs review before the patient is contacted."
  );
}

type Job = AppointmentMessagesResponse["items"][number];
export function notificationState(job: Job): string {
  if (job.status === "skipped_no_consent")
    return "Not queued · messaging consent missing";
  if (job.status === "skipped") return "Skipped";
  if (job.status === "cancelled") return "Cancelled";
  if (job.status === "scheduled") return "Scheduled · not sent";
  // A local log record is never evidence that a patient was contacted.
  if (job.message?.transport === "log") return "Queued locally · not sent";
  return "Queued · not sent";
}

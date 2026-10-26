// Event consumers run by the worker. Each runs in its own transaction with the event's tenant set
// and its module's write role, and is recorded in the inbox so it handles an event at most once.
import { sql } from "@hms/db";
import { writeOutbox } from "@hms/platform";
import type { EventHandler } from "../../worker/src/dispatcher.ts";
import { handleWhatsAppCallback } from "./modules/comms/whatsapp.ts";
import {
  handleAppointmentNotification,
  handleWaitlistNotification,
} from "./modules/comms/notifications.ts";
import { checkInVirtualArrival } from "./modules/booking/appointments.ts";
import { chargeConsultation, chargeDispense, rechargeAfterReturn, reverseConsultation } from "./modules/billing/charges.ts";
import { closeStayAccount, openStayAccount, settleStayOnPaid } from "./modules/billing/stays.ts";
import { clearFinance } from "./modules/inpatient/admissions.ts";
import { closeCalendarForLeave, reopenCalendarAfterLeave } from "./modules/booking/leave-closures.ts";
import { endStaffOnExit } from "./modules/hr/employees.ts";
import {
  cancelEncounterForAppointment,
  closeEncounterForAdmission,
  openEncounterForAdmission,
  openEncounterForAppointment,
} from "./modules/clinical/encounters.ts";
import {
  closeSessionForAppointment,
  ensureSessionForAppointment,
} from "./modules/telehealth/sessions.ts";

/** Check-in (booked or walk-in) opens the doctor's encounter. */
export const openEncounterOnCheckIn: EventHandler = {
  consumer: "clinical.open_encounter_on_check_in",
  eventTypes: ["appointment.checked_in"],
  module: "clinical",
  async handle(tx, event) {
    await openEncounterForAppointment(
      tx,
      event.tenantId,
      String(event.payload["appointmentId"]),
      event.correlationId,
    );
  },
};

/** Cancelling a checked-in appointment cancels its encounter if the consultation hasn't started. */
export const cancelEncounterOnAppointmentCancelled: EventHandler = {
  consumer: "clinical.cancel_encounter_on_appointment_cancelled",
  eventTypes: ["appointment.cancelled"],
  module: "clinical",
  async handle(tx, event) {
    await cancelEncounterForAppointment(
      tx,
      event.tenantId,
      String(event.payload["appointmentId"]),
      String(event.payload["reason"] ?? "cancelled"),
      event.correlationId,
    );
  },
};

/** Finishing the encounter completes its appointment and closes the queue token. */
export const completeAppointmentOnEncounterFinished: EventHandler = {
  consumer: "booking.complete_appointment_on_encounter_finished",
  eventTypes: ["encounter.finished"],
  module: "booking",
  async handle(tx, event) {
    const appointmentId = event.payload["appointmentId"];
    if (typeof appointmentId !== "string") return; // unscheduled encounter
    const appt = await tx
      .updateTable("booking.appointment")
      .set({ status: "completed", completed_at: sql`now()` })
      .where("id", "=", appointmentId)
      .where("status", "=", "checked_in")
      .returning(["id", "version"])
      .executeTakeFirst();
    await tx
      .updateTable("booking.queue_token")
      .set({
        status: "done",
        called_at: sql`coalesce(called_at, now())`,
        service_started_at: sql`coalesce(service_started_at, now())`,
        done_at: sql`now()`,
      })
      .where("appointment_id", "=", appointmentId)
      .where("status", "in", ["waiting", "called", "in_service"])
      .execute();
    if (appt) {
      await writeOutbox(tx, event.tenantId, event.correlationId, [
        {
          eventType: "appointment.completed",
          aggregateType: "booking.appointment",
          aggregateId: appt.id,
          aggregateVersion: appt.version,
          payload: { appointmentId: appt.id },
        },
      ]);
    }
  },
};

/** A virtual appointment gets its teleconsultation (room, lifecycle) as soon as it is booked. */
export const createTeleSessionOnVirtualBooking: EventHandler = {
  consumer: "clinical.create_tele_session_on_virtual_booking",
  eventTypes: ["appointment.confirmed"],
  module: "clinical",
  async handle(tx, event) {
    if (event.payload["visitMode"] !== "virtual") return;
    await ensureSessionForAppointment(
      tx,
      event.tenantId,
      String(event.payload["appointmentId"]),
      event.occurredAt,
    );
  },
};

/** A cancelled or no-show appointment closes its teleconsultation and revokes the patient link. */
export const closeTeleSessionWithAppointment: EventHandler = {
  consumer: "clinical.close_tele_session_with_appointment",
  eventTypes: ["appointment.cancelled", "appointment.no_show"],
  module: "clinical",
  async handle(tx, event) {
    const outcome =
      event.eventType === "appointment.cancelled" ? "cancelled" : "no_show";
    await closeSessionForAppointment(
      tx,
      event.tenantId,
      String(event.payload["appointmentId"]),
      outcome,
      event.occurredAt,
    );
  },
};

/** A virtual patient entering the waiting room has arrived: check the appointment in (opens the encounter). */
export const checkInOnTeleWaiting: EventHandler = {
  consumer: "booking.check_in_on_tele_waiting",
  eventTypes: ["teleconsult.patient_waiting"],
  module: "booking",
  async handle(tx, event) {
    const at =
      typeof event.payload["at"] === "string"
        ? new Date(event.payload["at"])
        : event.occurredAt;
    await checkInVirtualArrival(
      tx,
      event.tenantId,
      String(event.payload["appointmentId"]),
      at,
      event.correlationId,
    );
  },
};

/** Starting the consultation starts the patient's queue token, so the queue and the encounter agree (G15). */
export const startTokenOnEncounterStarted: EventHandler = {
  consumer: "booking.start_token_on_encounter_started",
  eventTypes: ["encounter.started"],
  module: "booking",
  async handle(tx, event) {
    const appointmentId = event.payload["appointmentId"];
    if (typeof appointmentId !== "string") return;
    await tx
      .updateTable("booking.queue_token")
      .set({
        status: "in_service",
        called_at: sql`coalesce(called_at, now())`,
        service_started_at: sql`coalesce(service_started_at, now())`,
      })
      .where("appointment_id", "=", appointmentId)
      .where("status", "in", ["waiting", "called"])
      .execute();
  },
};

export const appointmentNotifications: EventHandler = {
  consumer: "comms.appointment_notifications",
  eventTypes: [
    "appointment.confirmed",
    "appointment.rescheduled",
    "appointment.cancelled",
    "appointment.completed",
    "appointment.no_show",
  ],
  module: "comms",
  handle: handleAppointmentNotification,
};

export const waitlistNotifications: EventHandler = {
  consumer: "comms.waitlist_notifications",
  eventTypes: ["waitlist.offered", "waitlist.offer_closed"],
  module: "comms",
  handle: handleWaitlistNotification,
};

export const whatsAppCallbacks: EventHandler = {
  consumer: "comms.whatsapp_callbacks",
  eventTypes: ["whatsapp.callback_received"],
  module: "comms",
  handle: handleWhatsAppCallback,
};
/** Checked-in consultations are charged at the booked fee (after the encounter opens, so the charge links to it). */
export const chargeConsultationOnCheckIn: EventHandler = {
  consumer: "billing.charge_consultation_on_check_in",
  eventTypes: ["appointment.checked_in"],
  module: "billing",
  async handle(tx, event) {
    await chargeConsultation(tx, event.tenantId, String(event.payload["appointmentId"]), event.correlationId);
  },
};

/** A cancelled appointment's not-yet-billed consultation charge is reversed. */
export const reverseConsultationOnCancel: EventHandler = {
  consumer: "billing.reverse_consultation_on_cancel",
  eventTypes: ["appointment.cancelled"],
  module: "billing",
  async handle(tx, event) {
    await reverseConsultation(tx, event.tenantId, String(event.payload["appointmentId"]), String(event.payload["reason"] ?? "cancelled"), event.correlationId);
  },
};

/** An admission opens its inpatient encounter (the admitting doctor attends). */
export const openEncounterOnAdmission: EventHandler = {
  consumer: "clinical.open_encounter_on_admission",
  eventTypes: ["admission.admitted"],
  module: "clinical",
  async handle(tx, event) {
    await openEncounterForAdmission(tx, event.tenantId, String(event.payload["admissionId"]), event.correlationId);
  },
};

/** Departure finishes the stay's encounter; a cancelled admission cancels it. */
export const closeEncounterOnAdmissionEnd: EventHandler = {
  consumer: "clinical.close_encounter_on_admission_end",
  eventTypes: ["admission.discharged", "admission.cancelled"],
  module: "clinical",
  async handle(tx, event) {
    const admissionId = String(event.payload["admissionId"]);
    await closeEncounterForAdmission(tx, event.tenantId, admissionId, event.eventType === "admission.cancelled"
      ? { cancelled: String(event.payload["reason"] ?? "cancelled") }
      : { departedAt: String(event.payload["departedAt"]), dischargeType: String(event.payload["dischargeType"]) }, event.correlationId);
  },
};

/** An admission gets its stay account; a cancelled one closes it. */
export const stayAccountOnAdmission: EventHandler = {
  consumer: "billing.stay_account_on_admission",
  eventTypes: ["admission.admitted", "admission.cancelled"],
  module: "billing",
  async handle(tx, event) {
    const admissionId = String(event.payload["admissionId"]);
    if (event.eventType === "admission.admitted") await openStayAccount(tx, event.tenantId, admissionId, event.correlationId);
    else await closeStayAccount(tx, admissionId);
  },
};

/** A final bill paid at the counter settles its stay account. */
export const settleStayOnFinalPaid: EventHandler = {
  consumer: "billing.settle_stay_on_final_paid",
  eventTypes: ["invoice.paid"],
  module: "billing",
  async handle(tx, event) {
    if (event.payload["billingAccountId"]) await settleStayOnPaid(tx, event.tenantId, String(event.payload["invoiceId"]), event.correlationId);
  },
};

/** A settled stay account clears the discharge's finance clearance. */
export const clearFinanceOnSettled: EventHandler = {
  consumer: "inpatient.clear_finance_on_settled",
  eventTypes: ["billing.account_settled"],
  module: "inpatient",
  async handle(tx, event) {
    await clearFinance(tx, String(event.payload["admissionId"]));
  },
};

/** Each dispensed line is charged (counter sales, prescriptions; ward indents onto the stay's account). */
export const chargeDispenseLines: EventHandler = {
  consumer: "billing.charge_dispense_lines",
  eventTypes: ["dispense.completed"],
  module: "billing",
  async handle(tx, event) {
    await chargeDispense(tx, event.tenantId, String(event.payload["dispenseId"]), event.correlationId);
  },
};

/** A medicine return takes the returned quantity off its line's unbilled charge. */
export const rechargeOnReturn: EventHandler = {
  consumer: "billing.recharge_on_return",
  eventTypes: ["dispense.returned"],
  module: "billing",
  async handle(tx, event) {
    await rechargeAfterReturn(tx, event.tenantId, String(event.payload["dispenseLineId"]), event.correlationId);
  },
};

/** A doctor's approved full-day leave closes their bookable days; cancelling it reopens them. */
export const calendarOnLeave: EventHandler = {
  consumer: "booking.calendar_on_leave",
  eventTypes: ["leave.approved", "leave.cancelled"],
  module: "booking",
  async handle(tx, event) {
    const p = event.payload;
    if (event.eventType === "leave.approved") {
      await closeCalendarForLeave(tx, event.tenantId, {
        leaveRequestId: String(p["leaveRequestId"]), staffId: String(p["staffId"]), startsOn: String(p["startsOn"]), endsOn: String(p["endsOn"]), halfDay: String(p["halfDay"] ?? "none"),
      }, event.correlationId);
    } else await reopenCalendarAfterLeave(tx, event.tenantId, String(p["leaveRequestId"]), event.correlationId);
  },
};

/** An employee's exit ends their staff record's active period. */
export const endStaffOnEmployeeExit: EventHandler = {
  consumer: "platform.end_staff_on_exit",
  eventTypes: ["employee.exited"],
  module: "platform",
  async handle(tx, event) {
    await endStaffOnExit(tx, String(event.payload["staffId"]), String(event.payload["dateOfExit"]));
  },
};

export const consumers: EventHandler[] = [
  whatsAppCallbacks,
  waitlistNotifications,
  appointmentNotifications,
  startTokenOnEncounterStarted,
  openEncounterOnCheckIn,
  chargeConsultationOnCheckIn,
  cancelEncounterOnAppointmentCancelled,
  reverseConsultationOnCancel,
  openEncounterOnAdmission,
  stayAccountOnAdmission,
  closeEncounterOnAdmissionEnd,
  settleStayOnFinalPaid,
  clearFinanceOnSettled,
  chargeDispenseLines,
  rechargeOnReturn,
  calendarOnLeave,
  endStaffOnEmployeeExit,
  completeAppointmentOnEncounterFinished,
  createTeleSessionOnVirtualBooking,
  closeTeleSessionWithAppointment,
  checkInOnTeleWaiting,
];

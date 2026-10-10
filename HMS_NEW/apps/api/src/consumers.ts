// Event consumers run by the worker. Each runs in its own transaction with the event's tenant set
// and its module's write role, and is recorded in the inbox so it handles an event at most once.
import { sql } from '@hms/db';
import { writeOutbox } from '@hms/platform';
import type { EventHandler } from '../../worker/src/dispatcher.ts';
import { checkInVirtualArrival } from './modules/booking/appointments.ts';
import { cancelEncounterForAppointment, openEncounterForAppointment } from './modules/clinical/encounters.ts';
import { closeSessionForAppointment, ensureSessionForAppointment } from './modules/telehealth/sessions.ts';

/** Check-in (booked or walk-in) opens the doctor's encounter. */
export const openEncounterOnCheckIn: EventHandler = {
  consumer: 'clinical.open_encounter_on_check_in',
  eventTypes: ['appointment.checked_in'],
  module: 'clinical',
  async handle(tx, event) {
    await openEncounterForAppointment(tx, event.tenantId, String(event.payload['appointmentId']), event.correlationId);
  },
};

/** Cancelling a checked-in appointment cancels its encounter if the consultation hasn't started. */
export const cancelEncounterOnAppointmentCancelled: EventHandler = {
  consumer: 'clinical.cancel_encounter_on_appointment_cancelled',
  eventTypes: ['appointment.cancelled'],
  module: 'clinical',
  async handle(tx, event) {
    await cancelEncounterForAppointment(tx, event.tenantId, String(event.payload['appointmentId']), String(event.payload['reason'] ?? 'cancelled'), event.correlationId);
  },
};

/** Finishing the encounter completes its appointment and closes the queue token. */
export const completeAppointmentOnEncounterFinished: EventHandler = {
  consumer: 'booking.complete_appointment_on_encounter_finished',
  eventTypes: ['encounter.finished'],
  module: 'booking',
  async handle(tx, event) {
    const appointmentId = event.payload['appointmentId'];
    if (typeof appointmentId !== 'string') return; // unscheduled encounter
    const appt = await tx
      .updateTable('booking.appointment')
      .set({ status: 'completed', completed_at: sql`now()` })
      .where('id', '=', appointmentId)
      .where('status', '=', 'checked_in')
      .returning(['id', 'version'])
      .executeTakeFirst();
    await tx
      .updateTable('booking.queue_token')
      .set({
        status: 'done',
        called_at: sql`coalesce(called_at, now())`,
        service_started_at: sql`coalesce(service_started_at, now())`,
        done_at: sql`now()`,
      })
      .where('appointment_id', '=', appointmentId)
      .where('status', 'in', ['waiting', 'called', 'in_service'])
      .execute();
    if (appt) {
      await writeOutbox(tx, event.tenantId, event.correlationId, [
        { eventType: 'appointment.completed', aggregateType: 'booking.appointment', aggregateId: appt.id, aggregateVersion: appt.version, payload: { appointmentId: appt.id } },
      ]);
    }
  },
};

/** A virtual appointment gets its teleconsultation (room, lifecycle) as soon as it is booked. */
export const createTeleSessionOnVirtualBooking: EventHandler = {
  consumer: 'clinical.create_tele_session_on_virtual_booking',
  eventTypes: ['appointment.confirmed'],
  module: 'clinical',
  async handle(tx, event) {
    if (event.payload['visitMode'] !== 'virtual') return;
    await ensureSessionForAppointment(tx, event.tenantId, String(event.payload['appointmentId']), event.occurredAt);
  },
};

/** A cancelled or no-show appointment closes its teleconsultation and revokes the patient link. */
export const closeTeleSessionWithAppointment: EventHandler = {
  consumer: 'clinical.close_tele_session_with_appointment',
  eventTypes: ['appointment.cancelled', 'appointment.no_show'],
  module: 'clinical',
  async handle(tx, event) {
    const outcome = event.eventType === 'appointment.cancelled' ? 'cancelled' : 'no_show';
    await closeSessionForAppointment(tx, event.tenantId, String(event.payload['appointmentId']), outcome, event.occurredAt);
  },
};

/** A virtual patient entering the waiting room has arrived: check the appointment in (opens the encounter). */
export const checkInOnTeleWaiting: EventHandler = {
  consumer: 'booking.check_in_on_tele_waiting',
  eventTypes: ['teleconsult.patient_waiting'],
  module: 'booking',
  async handle(tx, event) {
    const at = typeof event.payload['at'] === 'string' ? new Date(event.payload['at']) : event.occurredAt;
    await checkInVirtualArrival(tx, event.tenantId, String(event.payload['appointmentId']), at, event.correlationId);
  },
};

export const consumers: EventHandler[] = [
  openEncounterOnCheckIn,
  cancelEncounterOnAppointmentCancelled,
  completeAppointmentOnEncounterFinished,
  createTeleSessionOnVirtualBooking,
  closeTeleSessionWithAppointment,
  checkInOnTeleWaiting,
];

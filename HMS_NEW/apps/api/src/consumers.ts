// Event consumers run by the worker. Each runs in its own transaction with the event's tenant set
// and its module's write role, and is recorded in the inbox so it handles an event at most once.
import { sql } from '@hms/db';
import { writeOutbox } from '@hms/platform';
import type { EventHandler } from '../../worker/src/dispatcher.ts';
import { cancelEncounterForAppointment, openEncounterForAppointment } from './modules/clinical/encounters.ts';

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

export const consumers: EventHandler[] = [openEncounterOnCheckIn, cancelEncounterOnAppointmentCancelled, completeAppointmentOnEncounterFinished];

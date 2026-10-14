import { z } from 'zod';

export const BookingVisitModeSchema = z.enum(['in_person', 'virtual']);
/** Explicit selection: a quote cannot silently substitute another service, doctor, clinic or mode. */
export const BookingReadinessQuerySchema = z.strictObject({
  facilityId: z.uuid(),
  staffId: z.uuid(),
  slotStart: z.iso.datetime({ offset: true }),
  visitMode: BookingVisitModeSchema,
  healthcareServiceId: z.uuid().nullable(),
});
export type BookingReadinessQuery = z.infer<typeof BookingReadinessQuerySchema>;
export const BookingReadinessSchema = z.object({
  facilityId: z.uuid(),
  staffId: z.uuid(),
  visitMode: BookingVisitModeSchema,
  healthcareServiceId: z.uuid().nullable(),
  checkedAt: z.iso.datetime({ offset: true }),
  sessionOn: z.iso.date(),
  slotStart: z.iso.datetime({ offset: true }),
  slotEnd: z.iso.datetime({ offset: true }).nullable(),
  session: z.object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    source: z.enum(['weekly', 'day_plan', 'extra_hours']),
  }).nullable(),
  configuration: z.object({
    complete: z.boolean(),
    issues: z.array(z.enum([
      'clinic_inactive', 'doctor_inactive', 'doctor_not_affiliated', 'virtual_not_enabled',
      'session_not_found', 'service_not_selected', 'service_not_in_session',
      'service_inactive_or_incompatible', 'fee_not_recorded',
    ])),
  }),
  fee: z.object({
    priceListItemId: z.uuid(),
    feeMinor: z.number().int().nonnegative(),
    pricedOn: z.iso.date(),
  }).nullable(),
  occupancy: z.enum(['free', 'taken', 'blocked', 'past', 'not_a_slot']),
  /** Only the hold command's capacity check; configuration requirements are stated separately. */
  slotCanBeHeld: z.boolean(),
  guarantee: z.literal('revalidated_on_write'),
  separateChecks: z.object({
    videoProvider: z.literal('not_checked'),
    videoConsent: z.literal('not_checked'),
    signingEligibility: z.literal('not_checked'),
    walkInCapacity: z.literal('not_applicable'),
  }),
});
export type BookingReadiness = z.infer<typeof BookingReadinessSchema>;

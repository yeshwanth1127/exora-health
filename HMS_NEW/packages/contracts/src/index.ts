import { z } from 'zod';
export const MessagingPurposeSchema = z.enum(['care', 'reminders', 'marketing']);
export const ContactPointCreateSchema = z
  .strictObject({
    facilityId: z.uuid(),
    channel: z.literal('whatsapp'),
    address: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/),
    patientId: z.uuid().optional(),
    bookingPartyId: z.uuid().optional(),
  })
  .refine((v) => !!v.patientId !== !!v.bookingPartyId, 'exactly one patient or booking party is required');
export type ContactPointCreate = z.infer<typeof ContactPointCreateSchema>;
export const MessagingConsentCreateSchema = z
  .strictObject({
    purpose: MessagingPurposeSchema,
    action: z.enum(['opt_in', 'opt_out', 'stop']),
    source: z.literal('staff'),
    evidence: z.string().trim().min(3).max(500),
    explicitOptIn: z.boolean().optional(),
  })
  .refine((v) => v.action !== 'opt_in' || v.explicitOptIn === true, 'affirmative opt-in evidence is required');
export type MessagingConsentCreate = z.infer<typeof MessagingConsentCreateSchema>;
export const ContactPointSchema = z.object({
  version: z.number().int(),
  interests: z.array(z.string()).optional(),
  id: z.uuid(),
  facilityId: z.uuid(),
  patientId: z.uuid().nullable(),
  bookingPartyId: z.uuid().nullable(),
  channel: z.literal('whatsapp'),
  address: z.string(),
  status: z.enum(['active', 'retired']),
  consents: z.object({ care: z.boolean(), reminders: z.boolean(), marketing: z.boolean() }),
});
export type ContactPoint = z.infer<typeof ContactPointSchema>;
export const ContactPointsResponseSchema = z.object({ items: z.array(ContactPointSchema) });
export type ContactPointsResponse = z.infer<typeof ContactPointsResponseSchema>;
export const NotificationKindSchema = z.enum([
  'confirmation',
  'reschedule',
  'cancellation',
  'day_before',
  'same_day',
  'follow_up',
  'feedback',
  'no_show',
  'waitlist_offer',
]);
export const NotificationJobSchema = z.object({
  id: z.uuid(),
  appointmentId: z.uuid().nullable(),
  offerId: z.uuid().nullable().optional(),
  waitlistEntryId: z.uuid().nullable().optional(),
  version: z.number().int().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  kind: NotificationKindSchema,
  status: z.enum(['scheduled', 'queued', 'cancelled', 'skipped_no_consent', 'skipped']),
  dueAt: z.iso.datetime({ offset: true }),
  reason: z.string().nullable(),
  message: z
    .object({
      id: z.uuid(),
      status: z.enum(['queued', 'claimed', 'sent', 'delivered', 'read', 'failed', 'unknown', 'cancelled']),
      transport: z.literal('log'),
      attempts: z.number().int(),
    })
    .nullable(),
});
export const AppointmentMessagesResponseSchema = z.object({
  items: z.array(NotificationJobSchema),
  nextCursor: z.string().nullable().optional(),
});
export type AppointmentMessagesResponse = z.infer<typeof AppointmentMessagesResponseSchema>;
export const CommsCapabilitiesSchema = z.object({
  facilityId: z.uuid(),
  moduleStatus: z.enum(['active', 'suspended', 'not_provisioned', 'configured', 'validated', 'retired']),
  transport: z.literal('log'),
  liveSending: z.literal(false),
  reason: z.string(),
});
export type CommsCapabilities = z.infer<typeof CommsCapabilitiesSchema>;
export const AppointmentNotificationEventSchema = z.object({ appointmentId: z.uuid() });
export const AppointmentRescheduledEventSchema = z.object({ fromAppointmentId: z.uuid(), toAppointmentId: z.uuid() });
export * from './summary.ts';
export const FollowupRuleKindSchema = z.enum(['day_before', 'same_day', 'follow_up', 'feedback', 'no_show', 'reschedule', 'cancellation']);
export const FollowupRuleSchema = z.object({
  id: z.uuid().nullable(),
  facilityId: z.uuid(),
  kind: FollowupRuleKindSchema,
  enabled: z.boolean(),
  delayHours: z.number().int().min(0).max(720),
  version: z.number().int().min(0),
  transport: z.literal('log'),
  templateReady: z.literal(false),
});
export type FollowupRule = z.infer<typeof FollowupRuleSchema>;
export const FollowupRulesResponseSchema = z.object({ items: z.array(FollowupRuleSchema) });
export type FollowupRulesResponse = z.infer<typeof FollowupRulesResponseSchema>;
export const FollowupRuleUpsertSchema = z.strictObject({
  facilityId: z.uuid(),
  enabled: z.boolean(),
  delayHours: z.number().int().min(0).max(720),
  version: z.number().int().min(0),
});
export type FollowupRuleUpsert = z.infer<typeof FollowupRuleUpsertSchema>;
export const AppointmentFollowupCreateSchema = z.strictObject({
  dueAt: z.iso.datetime({ offset: true }),
  version: z.number().int().min(1),
});
export type AppointmentFollowupCreate = z.infer<typeof AppointmentFollowupCreateSchema>;
export const NotificationHistoryQuerySchema = z
  .object({
    facilityId: z.uuid(),
    kind: NotificationKindSchema.optional(),
    status: z.enum(['scheduled', 'queued', 'cancelled', 'skipped_no_consent', 'skipped']).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(500).optional(),
  })
  .refine((v) => !v.from || !v.to || new Date(v.from) <= new Date(v.to), 'from must not follow to');
export type NotificationHistoryQuery = z.infer<typeof NotificationHistoryQuerySchema>;

export type NotificationJob = z.infer<typeof NotificationJobSchema>;

export * from './whatsapp.ts';

export * from './voice-growth.ts';

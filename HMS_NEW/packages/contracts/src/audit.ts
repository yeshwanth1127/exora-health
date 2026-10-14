import { z } from 'zod';

/** The tenant timezone actually used to turn audit filter dates into instants. */
export const AuditDateBoundarySchema = z.object({
  scope: z.literal('tenant'),
  timezone: z.string().min(1).refine((zone) => {
    try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; }
    catch { return false; }
  }, 'invalid audit timezone'),
  fromInclusive: z.iso.datetime({ offset: true }).nullable(),
  toExclusive: z.iso.datetime({ offset: true }).nullable(),
});
export type AuditDateBoundary = z.infer<typeof AuditDateBoundarySchema>;

export const AuditEventSchema = z.object({
  auditEventId: z.uuid(),
  occurredAt: z.iso.datetime({ offset: true }),
  actorStaffId: z.uuid().nullable(),
  actorName: z.string().nullable(),
  actorIsSystem: z.boolean(),
  action: z.string(),
  subjectType: z.string(),
  subjectId: z.uuid().nullable(),
  patientId: z.uuid().nullable(),
  reason: z.string().nullable(),
  diff: z.unknown(),
  correlationId: z.uuid().nullable(),
});
export const AuditEventsResponseSchema = z.object({
  items: z.array(AuditEventSchema),
  more: z.boolean(),
  dateBoundary: AuditDateBoundarySchema,
});
export const AuditExportResponseSchema = z.object({
  items: z.array(AuditEventSchema),
  truncated: z.boolean(),
  dateBoundary: AuditDateBoundarySchema,
});

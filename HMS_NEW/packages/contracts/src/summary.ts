import { z } from 'zod';

export const CommsSummarySchema = z.object({
  facilityId: z.uuid(),
  moduleStatus: z.enum(['active', 'suspended', 'not_provisioned', 'configured', 'validated', 'retired']),
  transport: z.literal('log'),
  liveSending: z.literal(false),
  asOf: z.iso.datetime({ offset: true }),
  counts: z.object({
    scheduled: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
  pending: z.number().int().nonnegative().nullable(),
});
export type CommsSummary = z.infer<typeof CommsSummarySchema>;

import { z } from 'zod';
const status = z.enum(['automation', 'handoff', 'closed']);
export const AppleInboxSchema = z.object({
  configured: z.boolean(),
  localDemo: z.boolean(),
  items: z.array(
    z.object({
      id: z.uuid(),
      status,
      source: z.enum(['amazon_connect', 'local_demo']),
      version: z.number().int().positive(),
      updatedAt: z.iso.datetime({ offset: true }),
    }),
  ),
});
export const AppleThreadSchema = z.object({
  conversation: z.object({
    id: z.uuid(),
    status,
    version: z.number().int().positive(),
  }),
  messages: z.array(
    z.object({
      id: z.uuid(),
      direction: z.enum(['inbound', 'outbound']),
      text: z.string(),
      status: z.enum(['received', 'queued', 'accepted', 'failed', 'cancelled']),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  ),
});
export type AppleInbox = z.infer<typeof AppleInboxSchema>;
export type AppleThread = z.infer<typeof AppleThreadSchema>;

import { z } from 'zod';
const Id = z.uuid(),
  Time = z.iso.datetime({ offset: true });
export const WhatsAppSettingsSchema = z.object({
  facilityId: Id,
  accountId: Id.nullable(),
  phoneNumberId: z.string().nullable(),
  providerConfigured: z.boolean(),
  templateStatusAvailable: z.boolean().default(false),
  templateSubmissionAvailable: z.boolean().default(false),
  webhookReady: z.boolean(),
  operationalCounts: z.object({
    openConversations: z.number().int(),
    campaignDrafts: z.number().int(),
    marketingContacts: z.number().int(),
  }),
  liveSending: z.literal(false),
  transport: z.literal('log'),
  templatesReady: z.boolean(),
  storageReady: z.boolean(),
  version: z.number().int(),
  testRecipientIds: z.array(z.string()),
  rateMinor: z.number().int(),
});
export const WhatsAppSettingsUpsertSchema = z.strictObject({
  facilityId: Id,
  phoneNumberId: z.string().regex(/^\d{5,40}$/),
  version: z.number().int().min(0),
});
export const ConversationSchema = z.object({
  kinds: z.array(z.enum(['reception', 'issue', 'feedback'])).optional(),
  id: Id,
  facilityId: Id,
  contactPointId: Id,
  status: z.enum(['open', 'closed']),
  automationState: z.enum(['automation', 'handoff_requested', 'human']),
  automationAllowed: z.boolean(),
  automationBlockedReasons: z.array(z.enum(['closed', 'human_handoff', 'module_inactive', 'consent_missing_or_withdrawn', 'reply_window_expired', 'contact_inactive'])),
  assignedStaffId: Id.nullable(),
  assignedStaffName: z.string().nullable(),
  version: z.number().int(),
  updatedAt: Time,
  replyUntil: Time.nullable(),
  canReply: z.boolean(),
  contactAddress: z.string(),
  name: z.string().nullable(),
});
export type Conversation = z.infer<typeof ConversationSchema>;
export const ConversationsResponseSchema = z.object({
  items: z.array(ConversationSchema),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
});
export const ConversationCreateSchema = z.strictObject({ facilityId: Id, contactPointId: Id });
export const VersionCommandSchema = z.strictObject({ version: z.number().int().min(1) });
export const ConversationReplySchema = VersionCommandSchema.extend({ text: z.string().trim().min(1).max(3000) });
export const SupportCaseSchema = z.object({
  id: Id,
  conversationId: Id,
  kind: z.enum(['issue', 'feedback']),
  description: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  status: z.enum(['open', 'in_progress', 'resolved']),
  version: z.number().int(),
});
export const SupportCaseCreateSchema = z.strictObject({
  conversationId: Id,
  kind: z.enum(['issue', 'feedback']),
  description: z.string().trim().min(3).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
});
export const SupportCaseStatusSchema = VersionCommandSchema.extend({
  status: z.enum(['open', 'in_progress', 'resolved']),
});
export const ConversationThreadSchema = z.object({
  hasOlderMessages: z.boolean().optional(),
  conversation: ConversationSchema,
  messages: z.array(
    z.object({
      id: Id,
      direction: z.enum(['inbound', 'outbound']),
      text: z.string(),
      createdAt: Time,
      actorStaffId: Id.nullable(),
      status: z.string().nullable(),
      transport: z.literal('log').nullable(),
    }),
  ),
  cases: z.array(SupportCaseSchema),
});
export type ConversationThread = z.infer<typeof ConversationThreadSchema>;
export const WhatsAppAssetSchema = z.object({
  id: Id,
  facilityId: Id,
  ownerType: z.enum(['practitioner', 'department', 'campaign']),
  ownerId: Id.nullable(),
  filename: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  sizeBytes: z.number().int(),
  sha256: z.string(),
  status: z.enum(['local_validated', 'quarantined', 'retired']),
  createdAt: Time,
});
export const WhatsAppAssetsResponseSchema = z.object({ items: z.array(WhatsAppAssetSchema) });
export const WhatsAppUploadSchema = z.strictObject({
  facilityId: Id,
  filename: z.string().trim().min(1).max(200),
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  dataBase64: z.string().min(4).max(14_000_000),
});
export const TemplateProviderStatusCheckSchema = z.object({
  status: z.string().nullable(), match: z.enum(['exact','different','missing','unsupported']),
  checkedAt: Time, providerTemplateId: z.string().nullable(), localVersion: z.number().int().positive(),
});
export const TemplateProviderStatusInputSchema = z.strictObject({ facilityId: Id, version: z.number().int().positive() });
export const TemplateSubmissionInputSchema = z.strictObject({
  facilityId: Id, version: z.number().int().positive(),
  samples: z.array(z.string().trim().min(1).max(200)).max(10),
  fictionalExamples: z.literal(true),
});
export const TemplateSubmissionSchema = z.object({
  id: Id, templateId: Id, facilityId: Id, templateVersion: z.number().int().positive(),
  providerName: z.string(), body: z.string(), language: z.string(), category: z.enum(['utility','marketing']),
  parameterCount: z.number().int().min(0).max(10), samples: z.array(z.string()),
  state: z.enum(['queued','dispatching','submitted','uncertain','failed','conflict','cancelled']),
  providerTemplateId: z.string().nullable(), providerStatus: z.string().nullable(),
  reason: z.string().nullable(), createdAt: Time, updatedAt: Time,
  currentDraftMatches: z.boolean(), version: z.number().int().positive(),
});
export const TemplateSubmissionResultSchema = z.object({
  templateId: Id, version: z.number().int().positive(), submission: TemplateSubmissionSchema,
});
export const TemplateProviderStatusResultSchema = z.object({
  templateId: Id, version: z.number().int().positive(), providerStatus: z.string().nullable(),
  match: z.enum(['exact','different','missing','unsupported']), checkedAt: Time, providerTemplateId: z.string().nullable(),
});
export const MessageTemplateSchema = z.object({
  id: Id,
  facilityId: Id,
  name: z.string(),
  body: z.string(),
  language: z.string(),
  category: z.enum(['utility', 'marketing']),
  parameterCount: z.number().int(),
  header: z.enum(['text', 'image', 'none']),
  providerApproval: z.enum(['not_synced', 'approved', 'rejected', 'pending']),
  providerStatusCheck: TemplateProviderStatusCheckSchema.nullable().optional(),
  submission: TemplateSubmissionSchema.nullable().optional(),
  simulationOnly: z.literal(true),
  editable: z.boolean(),
  editBlockedReason: z.string().nullable(),
  version: z.number().int(),
});
export const MessageTemplatesResponseSchema = z.object({ items: z.array(MessageTemplateSchema) });
export const MessageTemplateCreateSchema = z.strictObject({
  facilityId: Id,
  name: z.string().trim().min(2).max(80),
  body: z.string().trim().min(3).max(3000),
  language: z.string().min(2).max(12),
  category: z.enum(['utility', 'marketing']),
  parameterCount: z.number().int().min(0).max(10),
  header: z.enum(['text', 'image', 'none']).default('none'),
});
export const MessageTemplateEditSchema = MessageTemplateCreateSchema.extend({ version: z.number().int().min(1) });
export const CampaignCreateSchema = z.strictObject({
  facilityId: Id,
  title: z.string().trim().min(3).max(120),
  templateId: Id,
  parameters: z.array(z.string().trim().max(400)).max(10),
  assetId: Id.nullable().optional(),
  scheduledAt: Time,
  interest: z.string().trim().min(2).max(100).nullable().optional(),
  budgetMinor: z.number().int().min(0).max(100_000_000),
});
export const CampaignSchema = z.object({
  id: Id,
  facilityId: Id,
  title: z.string(),
  templateId: Id,
  parameters: z.array(z.string()),
  assetId: Id.nullable(),
  scheduledAt: Time,
  interest: z.string().nullable(),
  rateMinor: z.number().int(),
  budgetMinor: z.number().int(),
  reservedMinor: z.number().int(),
  status: z.enum(['draft', 'scheduled', 'paused', 'completed']),
  version: z.number().int(),
  approvedCount: z.number().int(),
  simulationOnly: z.literal(true),
  providerDelivery: z.literal('unavailable'),
});
export type Campaign = z.infer<typeof CampaignSchema>;
export const CampaignsResponseSchema = z.object({ items: z.array(CampaignSchema) });
export const CampaignPreviewSchema = z.object({
  campaignId: Id,
  body: z.string(),
  recipients: z.number().int(),
  estimatedCostMinor: z.number().int(),
  withinBudget: z.boolean(),
  audienceHash: z.string(),
  version: z.number().int(),
  simulationOnly: z.literal(true),
});
export const CampaignApproveSchema = VersionCommandSchema.extend({
  audienceHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedCount: z.number().int().min(0),
  testReceived: z.boolean(),
});
export const CampaignTestSchema = VersionCommandSchema.extend({ recipientId: z.string().min(1).max(100) });
export const CampaignTestResponseSchema = z.object({
  status: z.literal('queued'),
  transport: z.literal('log'),
  delivered: z.literal(false),
  testId: Id,
});
export const ContactInterestSchema = z.strictObject({
  interest: z.string().trim().min(2).max(100),
  evidence: z.string().trim().min(3).max(500),
  version: z.number().int().min(1),
});
export type WhatsAppUpload = z.infer<typeof WhatsAppUploadSchema>;
export type CampaignCreate = z.infer<typeof CampaignCreateSchema>;
export const WhatsAppDeliveryResponseSchema = z.object({
  nextCursor: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum([
        'confirmation',
        'reschedule',
        'cancellation',
        'day_before',
        'same_day',
        'follow_up',
        'feedback',
        'no_show',
        'waitlist_offer',
        'reply',
        'campaign',
      ]),
      relatedId: z.uuid(),
      status: z.string(),
      transport: z.literal('log'),
      createdAt: z.iso.datetime({ offset: true }),
      reason: z.string().nullable(),
    }),
  ),
});

export const ConversationCreatedSchema = z.object({ id: z.uuid(), version: z.number().int() });

export const WhatsAppDeliveryQuerySchema = z
  .object({
    facilityId: z.uuid(),
    kind: z
      .enum([
        'confirmation',
        'reschedule',
        'cancellation',
        'day_before',
        'same_day',
        'follow_up',
        'feedback',
        'no_show',
        'waitlist_offer',
        'reply',
        'campaign',
      ])
      .optional(),
    status: z
      .enum(['queued', 'cancelled', 'excluded', 'scheduled', 'skipped_no_consent', 'skipped', 'failed', 'unknown'])
      .optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(500).optional(),
  })
  .refine((v) => !v.from || !v.to || new Date(v.from) <= new Date(v.to), 'invalid date range');

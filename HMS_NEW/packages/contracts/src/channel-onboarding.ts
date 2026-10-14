import { z } from 'zod';
const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use +country code and number');
const shared = { languages: z.array(z.enum(['en','hi','kn','ta','te','ml','mr','bn','gu','pa','od'])).min(1).max(11), greeting: z.string().trim().min(3).max(1000) };
export const VoiceOnboardingDraftSchema = z.strictObject({
  ...shared, channel: z.literal('voice'), numberStrategy: z.enum(['existing_forwarded','company_number','existing_provider']),
  existingNumber: Phone.nullable(), receptionistNumber: Phone,
  overflow: z.strictObject({ busy: z.boolean(), noAnswer: z.boolean(), unavailable: z.boolean(), ringSeconds: z.number().int().min(10).max(90) }),
  humanTransferNumber: Phone.nullable(), failureAction: z.literal('take_callback'),
}).refine(v => v.numberStrategy === 'company_number' || !!v.existingNumber, 'Enter the existing clinic number')
  .refine(v => v.overflow.busy || v.overflow.noAnswer || v.overflow.unavailable, 'Choose at least one overflow condition');
export const WhatsAppOnboardingDraftSchema = z.strictObject({
  ...shared, channel: z.literal('whatsapp'), numberStrategy: z.enum(['company_number','business_app_coexistence','existing_api','migrate_number']),
  existingNumber: Phone.nullable(), humanHandoff: z.literal('on_request'),
}).refine(v => v.numberStrategy === 'company_number' || !!v.existingNumber, 'Enter the existing WhatsApp number');
export const ChannelOnboardingDraftSchema = z.union([VoiceOnboardingDraftSchema, WhatsAppOnboardingDraftSchema]);
export type ChannelOnboardingDraft = z.infer<typeof ChannelOnboardingDraftSchema>;
export const ChannelOnboardingSaveSchema = z.strictObject({ facilityId: z.uuid(), version: z.number().int().nonnegative(), draft: ChannelOnboardingDraftSchema });
export const ChannelOnboardingSubmitSchema = z.strictObject({ facilityId: z.uuid(), version: z.number().int().positive() });
export const ChannelOnboardingSchema = z.object({
  facilityId: z.uuid(), channel: z.enum(['voice','whatsapp']), management: z.literal('company_managed'),
  state: z.enum(['not_started','draft','requested']), version: z.number().int().nonnegative(),
  draft: ChannelOnboardingDraftSchema.nullable(), requestedAt: z.iso.datetime({offset:true}).nullable(),
  updatedAt: z.iso.datetime({offset:true}).nullable(), updatedByStaffId: z.uuid().nullable(),
  live: z.literal(false), activation: z.literal('provider_verification_required'),
});

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
const SupportDaySchema = z.strictObject({
  day: z.number().int().min(1).max(7), // ISO weekday: Monday=1, Sunday=7.
  from: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  to: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
}).refine(v => v.from < v.to, 'Support hours must end after they start on the same day');
export const AppleMessagesOnboardingDraftSchema = z.strictObject({
  channel: z.literal('apple_messages'),
  brandName: z.string().trim().min(2).max(150),
  website: z.url().max(500).refine(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
    } catch { return false; }
  }, 'Use an HTTPS clinic website without credentials, query parameters or a fragment'),
  businessPhone: Phone,
  supportEmail: z.email().max(254),
  languages: z.array(z.enum(['en', 'es'])).min(1).max(2)
    .refine(v => new Set(v).size === v.length, 'Choose each language once'),
  greeting: shared.greeting,
  humanHandoff: z.literal('on_request'),
  supportTimezone: z.string().min(1).max(100).refine(value => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
    catch { return false; }
  }, 'Choose a valid time zone'),
  supportHours: z.array(SupportDaySchema).min(1).max(7)
    .refine(v => new Set(v.map(day => day.day)).size === v.length, 'Choose each support day once'),
  afterHoursMessage: z.string().trim().min(3).max(1000),
  authorizedToRepresentClinic: z.literal(true),
});
export const ChannelOnboardingDraftSchema = z.union([VoiceOnboardingDraftSchema, WhatsAppOnboardingDraftSchema, AppleMessagesOnboardingDraftSchema]);
export type ChannelOnboardingDraft = z.infer<typeof ChannelOnboardingDraftSchema>;
export type OnboardingChannel = ChannelOnboardingDraft['channel'];
export const ChannelOnboardingSaveSchema = z.strictObject({ facilityId: z.uuid(), version: z.number().int().nonnegative(), draft: ChannelOnboardingDraftSchema });
export const ChannelOnboardingSubmitSchema = z.strictObject({ facilityId: z.uuid(), version: z.number().int().positive() });
export const ChannelOnboardingSchema = z.object({
  facilityId: z.uuid(), channel: z.enum(['voice','whatsapp','apple_messages']), management: z.literal('company_managed'),
  state: z.enum(['not_started','draft','requested']), version: z.number().int().nonnegative(),
  draft: ChannelOnboardingDraftSchema.nullable(), requestedAt: z.iso.datetime({offset:true}).nullable(),
  updatedAt: z.iso.datetime({offset:true}).nullable(), updatedByStaffId: z.uuid().nullable(),
  live: z.literal(false), activation: z.literal('provider_verification_required'),
});

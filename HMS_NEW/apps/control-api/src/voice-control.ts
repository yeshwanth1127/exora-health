import { createHash } from 'node:crypto';
import { z } from 'zod';

export const VoiceLanguage = z.enum(['en', 'hi', 'kn', 'ta', 'te', 'ml', 'mr', 'bn', 'gu', 'pa', 'od']);
export const VoiceSettingsSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(80),
  greeting: z.string().trim().min(3).max(1000),
  languages: z.array(VoiceLanguage).min(1).max(11),
  defaultLanguage: VoiceLanguage,
  voiceId: z.string().trim().min(1).max(120).nullable().default(null),
  tone: z.enum(['professional', 'warm', 'concise']).default('warm'),
  speakingRate: z.number().min(0.8).max(1.2).default(1),
  maxCallSeconds: z.number().int().min(60).max(3600).default(900),
  actions: z.strictObject({
    book: z.boolean(), lookup: z.boolean(), cancel: z.boolean(), reschedule: z.boolean(),
  }),
  consultationTypes: z.array(z.enum(['in_person', 'virtual'])).min(1).max(2),
  humanTransferNumber: z.string().regex(/^\+[1-9]\d{7,14}$/).nullable().default(null),
  failureAction: z.enum(['take_callback', 'transfer', 'end_call']).default('take_callback'),
  recordingEnabled: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (!value.languages.includes(value.defaultLanguage)) {
    ctx.addIssue({ code: 'custom', path: ['defaultLanguage'], message: 'Default language must be enabled' });
  }
  if (value.failureAction === 'transfer' && !value.humanTransferNumber) {
    ctx.addIssue({ code: 'custom', path: ['humanTransferNumber'], message: 'Transfer needs a destination number' });
  }
});

export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

export type VoiceTenant = {
  customerId: string;
  tenantId: string;
  slug: string;
  hospitalName: string;
  facilityName: string;
  timezone: string;
  publicUrl: string;
};

export type VoiceTool = {
  name: string;
  method: 'GET' | 'POST' | 'DELETE';
  url: string;
  query?: string[];
  body?: string[];
  idempotency?: boolean;
};

export type CompiledVoiceManifest = {
  customerId: string;
  tenantId: string;
  tenantSlug: string;
  agentName: string;
  templateAgentId: string | null;
  backendOrigin: string;
  apiBaseUrl: string;
  prompt: string;
  settings: VoiceSettings;
  tools: VoiceTool[];
  auth: { type: 'api_key'; header: 'X-Service-Key'; secretRefRequired: true };
  configurationHash: string;
};

export function defaultVoiceSettings(hospitalName: string): VoiceSettings {
  return VoiceSettingsSchema.parse({
    displayName: `${hospitalName} Front Desk`,
    greeting: `Hello, this is ${hospitalName}'s booking assistant. How can I help you today?`,
    languages: ['en'],
    defaultLanguage: 'en',
    voiceId: null,
    tone: 'warm',
    speakingRate: 1,
    maxCallSeconds: 900,
    actions: { book: true, lookup: true, cancel: true, reschedule: true },
    consultationTypes: ['in_person', 'virtual'],
    humanTransferNumber: null,
    failureAction: 'take_callback',
    recordingEnabled: false,
  });
}

export function tenantBackendOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Tenant Voice backend must be a public HTTPS URL without credentials, query or fragment');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function compileVoiceManifest(tenant: VoiceTenant, input: VoiceSettings, templateAgentId?: string): CompiledVoiceManifest {
  const settings = VoiceSettingsSchema.parse(input);
  const backendOrigin = tenantBackendOrigin(tenant.publicUrl);
  const apiBaseUrl = `${backendOrigin}/api/v1/integrations/voice`;
  const allowedActions = Object.entries(settings.actions).filter(([, enabled]) => enabled).map(([action]) => action).join(', ');
  const prompt = [
    `You are ${settings.displayName}, the voice front desk for ${tenant.hospitalName}.`,
    `Begin with this greeting: ${settings.greeting}`,
    `Your enabled languages are ${settings.languages.join(', ')} and the default is ${settings.defaultLanguage}.`,
    `You may help callers with these appointment actions only: ${allowedActions || 'none'}.`,
    `Supported consultation types are ${settings.consultationTypes.join(' and ')}.`,
    'Use only tool responses as factual hospital data. Never invent a doctor, branch, schedule, slot, appointment or confirmation code.',
    'Ask for confirmation immediately before creating, cancelling or rescheduling an appointment.',
    'For lookup, cancellation and rescheduling, verify the phone number and confirmation code using the tool.',
    `All dates and times use ${tenant.timezone}.`,
    'For emergencies, direct the caller to local emergency services. Do not diagnose or provide treatment advice.',
    settings.humanTransferNumber ? 'Use the configured call-transfer capability only under the configured handoff rules.' : 'Do not claim that a human transfer is available.',
  ].join('\n');
  const tools: VoiceTool[] = [
    { name: 'list_branches', method: 'GET', url: `${apiBaseUrl}/branches` },
    { name: 'search_doctors', method: 'GET', url: `${apiBaseUrl}/doctors`, query: ['department?', 'branch?'] },
    { name: 'check_availability', method: 'GET', url: `${apiBaseUrl}/availability`, query: ['doctor_id', 'branch_id', 'start_date', 'end_date', 'consultation_type'] },
    { name: 'get_doctor_schedule', method: 'GET', url: `${apiBaseUrl}/schedules`, query: ['doctor_id', 'start_date', 'end_date'] },
    ...(settings.actions.book || settings.actions.reschedule ? [
      { name: 'create_slot_hold', method: 'POST' as const, url: `${apiBaseUrl}/slot-holds`, body: ['doctor_id', 'branch_id', 'consultation_type', 'starts_at'], idempotency: true },
      { name: 'release_slot_hold', method: 'DELETE' as const, url: `${apiBaseUrl}/slot-holds/{hold_id}`, query: ['hold_token'] },
    ] : []),
    ...(settings.actions.book ? [{ name: 'confirm_appointment', method: 'POST' as const, url: `${apiBaseUrl}/appointments`, body: ['hold_id', 'hold_token', 'patient_name', 'patient_phone', 'patient_email?', 'reason?'], idempotency: true }] : []),
    ...(settings.actions.lookup || settings.actions.cancel || settings.actions.reschedule ? [{ name: 'lookup_appointment', method: 'GET' as const, url: `${apiBaseUrl}/appointments`, query: ['patient_phone', 'confirmation_code'] }] : []),
    ...(settings.actions.cancel ? [{ name: 'cancel_appointment', method: 'POST' as const, url: `${apiBaseUrl}/appointments/{appointment_id}/cancel`, body: ['patient_phone', 'confirmation_code', 'reason'] }] : []),
    ...(settings.actions.reschedule ? [{ name: 'reschedule_appointment', method: 'POST' as const, url: `${apiBaseUrl}/appointments/{appointment_id}/reschedule`, body: ['patient_phone', 'confirmation_code', 'hold_id', 'hold_token', 'reason?'], idempotency: true }] : []),
  ];
  const unsigned = { customerId: tenant.customerId, tenantId: tenant.tenantId, tenantSlug: tenant.slug, agentName: settings.displayName, templateAgentId: templateAgentId ?? null, backendOrigin, apiBaseUrl, prompt, settings, tools, auth: { type: 'api_key' as const, header: 'X-Service-Key' as const, secretRefRequired: true as const } };
  return { ...unsigned, configurationHash: createHash('sha256').update(stable(unsigned)).digest('hex') };
}

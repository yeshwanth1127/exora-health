import { DomainError, conflict, invalid, preconditionFailed } from '@hms/platform';
import { resolveWhatsAppAccessToken, type ProviderEnvironment, type WhatsAppBinding } from './whatsapp-provider-config.ts';
export type MetaTemplateCreateInput = {
  name: string;
  body: string;
  language: string;
  category: 'utility' | 'marketing';
  parameterCount: number;
  samples: string[];
};
export type MetaTemplateCreateResult = { id: string; status: string; category: string };
/** The POST may have committed. Callers must reconcile by read-only lookup instead of automatically repeating it. */
export class TemplateCreationUncertain extends Error {
  readonly code = 'template_creation_uncertain';
  constructor() {
    super('WhatsApp template creation could not be confirmed. Check its provider status before submitting again.');
    this.name = 'TemplateCreationUncertain';
  }
}
const MAX_BYTES = 1_000_000;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const boundedString = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
const localInvalid = () => invalid('WhatsApp template submission requires valid positional content and matching examples.', { reason: 'invalid_template_submission' });
export function validateMetaTemplateCreateInput(input: MetaTemplateCreateInput): void {
  if (!isRecord(input) || Object.keys(input).length !== 6 || Object.keys(input).some(key => !['name', 'body', 'language', 'category', 'parameterCount', 'samples'].includes(key)) ||
      typeof input.name !== 'string' || !/^[a-z0-9_]{1,512}$/.test(input.name) || typeof input.body !== 'string' || input.body.trim().length === 0 || input.body.length > 1024 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.body) || typeof input.language !== 'string' || !/^[a-z]{2,3}(?:_[A-Za-z]{2,4})?$/.test(input.language) ||
      !['utility', 'marketing'].includes(input.category) || !Number.isInteger(input.parameterCount) || input.parameterCount < 0 || input.parameterCount > 10 ||
      !Array.isArray(input.samples) || input.samples.length !== input.parameterCount || input.samples.some(value => !boundedString(value, 1024))) throw localInvalid();
  const found: number[] = [];
  const remaining = input.body.replace(/\{\{([1-9][0-9]*)\}\}/g, (_, number: string) => {
    const index = Number(number);
    if (!found.includes(index)) found.push(index);
    return '';
  });
  if (/[{}]/.test(remaining) || found.length !== input.parameterCount || found.some((number, index) => number !== index + 1)) throw localInvalid();
}
function boundedJson(value: unknown): boolean {
  let nodes = 0;
  const check = (v: unknown, depth: number): boolean => {
    if (++nodes > 2000 || depth > 6) return false;
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'string') return v.length <= 8192;
    if (typeof v === 'number') return Number.isFinite(v);
    if (Array.isArray(v)) return v.length <= 100 && v.every(item => check(item, depth + 1));
    return isRecord(v) && Object.keys(v).length <= 100 && Object.entries(v).every(([key, item]) => key.length <= 100 && check(item, depth + 1));
  };
  return check(value, 0);
}
/** Only documented code 100 validation and its exact duplicate subcode are definitive refusals. */
function definitiveRefusal(status: number, body: unknown): DomainError | null {
  if (status !== 400 || !isRecord(body) || Object.keys(body).length !== 1 || !isRecord(body.error)) return null;
  const error = body.error;
  if (error.code !== 100 || error.type !== 'OAuthException' || !boundedString(error.message, 8192) || !boundedJson(error) ||
      Object.keys(error).some(key => !['message', 'type', 'code', 'error_subcode', 'is_transient', 'error_user_title', 'error_user_msg', 'error_data', 'fbtrace_id'].includes(key)) ||
      (error.is_transient !== undefined && error.is_transient !== false) ||
      ['error_user_title', 'error_user_msg', 'fbtrace_id'].some(key => error[key] !== undefined && !boundedString(error[key], 8192)) ||
      (error.error_data !== undefined && !isRecord(error.error_data))) return null;
  if (error.error_subcode === 2388024) return conflict('A WhatsApp template with this name and language already exists.', { reason: 'provider_template_exists' });
  if (error.error_subcode === undefined) return invalid('WhatsApp rejected the template parameters.', { reason: 'provider_validation_rejected' });
  return null;
}
async function responseJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > MAX_BYTES)) throw new TemplateCreationUncertain();
  if (!response.body) throw new TemplateCreationUncertain();
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '', completed = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_BYTES) throw new TemplateCreationUncertain();
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    const parsed: unknown = JSON.parse(text);
    completed = true;
    return parsed;
  } finally {
    if (!completed) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
/** One bounded provider POST; never retry an uncertain external write. No message delivery is performed. */
export async function createMetaTemplate(binding: WhatsAppBinding, input: MetaTemplateCreateInput,
  options: { env?: ProviderEnvironment; fetcher?: typeof fetch } = {}): Promise<MetaTemplateCreateResult> {
  validateMetaTemplateCreateInput(input);
  const env = options.env ?? process.env;
  let token: string | null;
  try { token = resolveWhatsAppAccessToken(binding, env); } catch {
    throw preconditionFailed('WhatsApp template credentials are not configured.', { reason: 'provider_not_configured' });
  }
  if (!token || !binding.businessAccountId) throw preconditionFailed('WhatsApp template credentials are not configured.', { reason: 'provider_not_configured' });
  const url = new URL(`https://graph.facebook.com/${env.WA_GRAPH_VERSION}/${binding.businessAccountId}/message_templates`);
  const payload = JSON.stringify({ name: input.name, language: input.language, category: input.category.toUpperCase(), parameter_format: 'POSITIONAL',
    components: [{ type: 'BODY', text: input.body, ...(input.parameterCount > 0 ? { example: { body_text: [input.samples] } } : {}) }] });
  const signal = AbortSignal.timeout(10_000), fetcher = options.fetcher ?? fetch;
  const send = async (): Promise<MetaTemplateCreateResult | DomainError> => {
    signal.throwIfAborted();
    const response = await fetcher(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: payload, redirect: 'error', signal });
    const body = await responseJson(response, signal);
    if (!response.ok) { const refusal = definitiveRefusal(response.status, body); if (refusal) return refusal; throw new TemplateCreationUncertain(); }
    if (!isRecord(body) || Object.keys(body).length !== 3 || Object.keys(body).some(key => !['id', 'status', 'category'].includes(key)) ||
        typeof body.id !== 'string' || !/^[0-9]{1,40}$/.test(body.id) || !boundedString(body.status, 100) || !boundedString(body.category, 100)) throw new TemplateCreationUncertain();
    return { id: body.id, status: body.status, category: body.category };
  };
  let onAbort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => { onAbort = () => reject(new TemplateCreationUncertain()); signal.addEventListener('abort', onAbort, { once: true }); });
  let result: MetaTemplateCreateResult | DomainError;
  try { result = await Promise.race([send(), deadline]); } catch { throw new TemplateCreationUncertain(); }
  finally { if (onAbort) signal.removeEventListener('abort', onAbort); }
  if (result instanceof DomainError) throw result;
  return result;
}

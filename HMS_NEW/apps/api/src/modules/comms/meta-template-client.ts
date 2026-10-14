import { DomainError, preconditionFailed } from '@hms/platform';
import { resolveWhatsAppAccessToken, type ProviderEnvironment, type WhatsAppBinding } from './whatsapp-provider-config.ts';
export type MetaJson = string | number | boolean | null | MetaJson[] | { [key: string]: MetaJson };
export type MetaTemplateComponent = { type: string; text?: string; format?: string; [key: string]: MetaJson | undefined };
export type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  parameterFormat: string | null;
  components: MetaTemplateComponent[];
};
const MAX_BYTES = 1_000_000, MAX_PAGES = 10;
const unavailable = () => preconditionFailed('WhatsApp template provider is unavailable.', { reason: 'provider_unavailable' });
const malformed = () => preconditionFailed('WhatsApp template provider returned an invalid response.', { reason: 'invalid_provider_response' });
const ambiguous = () => preconditionFailed('WhatsApp template lookup is ambiguous.', { reason: 'ambiguous_provider_template' });
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shortString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
function component(value: unknown): MetaTemplateComponent {
  if (!record(value) || !shortString(value.type, 40) ||
      (value.text !== undefined && (typeof value.text !== 'string' || value.text.length > 65_536)) ||
      (value.format !== undefined && !shortString(value.format, 40))) throw malformed();
  let nodes = 0;
  function check(v: unknown, depth: number): void {
    if (++nodes > 5000 || depth > 8) throw malformed();
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'string' && v.length <= 65_536) return;
    if (typeof v === 'number' && Number.isFinite(v)) return;
    if (Array.isArray(v) && v.length <= 100) { for (const item of v) check(item, depth + 1); return; }
    if (record(v) && Object.keys(v).length <= 100) {
      for (const [key, item] of Object.entries(v)) { if (key.length > 100) throw malformed(); check(item, depth + 1); }
      return;
    }
    throw malformed();
  }
  check(value, 0);
  return value as MetaTemplateComponent;
}
function template(value: unknown): MetaTemplate {
  if (!record(value) || typeof value.id !== 'string' || !/^[0-9]{1,40}$/.test(value.id) ||
      !shortString(value.name, 512) || !shortString(value.language, 30) || !shortString(value.category, 100) ||
      !shortString(value.status, 100) || (value.parameter_format !== undefined && value.parameter_format !== null && !shortString(value.parameter_format, 40)) ||
      !Array.isArray(value.components) || value.components.length > 100) throw malformed();
  return { id: value.id, name: value.name, language: value.language, category: value.category, status: value.status,
    parameterFormat: value.parameter_format as string | null | undefined ?? null, components: value.components.map(component) };
}
async function responseJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > MAX_BYTES)) throw malformed();
  if (!response.body) throw malformed();
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '', completed = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_BYTES) throw malformed();
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    completed = true;
    try { return JSON.parse(text); } catch { throw malformed(); }
  } finally {
    if (!completed) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
/** Read-only lookup against one canonical server-side WABA. Pagination URLs from the provider are never fetched. */
export async function getMetaTemplate(binding: WhatsAppBinding, name: string, language: string,
  options: { env?: ProviderEnvironment; fetcher?: typeof fetch } = {}): Promise<MetaTemplate | null> {
  const env = options.env ?? process.env;
  if (!/^[a-z0-9_]{1,512}$/.test(name) || !/^[a-z]{2,3}(?:_[A-Za-z]{2,4})?$/.test(language))
    throw preconditionFailed('WhatsApp template lookup requires a valid name and language.', { reason: 'invalid_template_lookup' });
  let token: string | null;
  try { token = resolveWhatsAppAccessToken(binding, env); } catch {
    throw preconditionFailed('WhatsApp template credentials are not configured.', { reason: 'provider_not_configured' });
  }
  if (!token || !binding.businessAccountId)
    throw preconditionFailed('WhatsApp template credentials are not configured.', { reason: 'provider_not_configured' });
  const graphVersion = env.WA_GRAPH_VERSION!, businessAccountId = binding.businessAccountId;
  const signal = AbortSignal.timeout(10_000), fetcher = options.fetcher ?? fetch;
  let rejectTimeout: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => { rejectTimeout = () => reject(unavailable()); signal.addEventListener('abort', rejectTimeout, { once: true }); });
  const lookup = async (): Promise<MetaTemplate | null> => {
    let after: string | undefined, match: MetaTemplate | null = null;
    const cursors = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page++) {
      signal.throwIfAborted();
      const url = new URL(`https://graph.facebook.com/${graphVersion}/${businessAccountId}/message_templates`);
      url.searchParams.set('name', name);
      url.searchParams.set('fields', 'id,name,language,category,status,parameter_format,components');
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after', after);
      let response: Response;
      try { response = await fetcher(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal }); }
      catch { throw unavailable(); }
      if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw unavailable(); }
      const body = await responseJson(response, signal);
      if (!record(body) || !Array.isArray(body.data) || body.data.length > 100) throw malformed();
      for (const value of body.data) {
        const row = template(value);
        if (row.name !== name || row.language !== language) continue;
        if (match && (match.id !== row.id || JSON.stringify(match) !== JSON.stringify(row))) throw ambiguous();
        match = row;
      }
      if (body.paging === undefined) return match;
      if (!record(body.paging)) throw malformed();
      if (body.paging.next === undefined) return match;
      if (!shortString(body.paging.next, 16_384) || !record(body.paging.cursors) ||
          typeof body.paging.cursors.after !== 'string' || !/^[A-Za-z0-9_+/=-]{1,2048}$/.test(body.paging.cursors.after)) throw malformed();
      after = body.paging.cursors.after;
      if (cursors.has(after)) throw malformed();
      cursors.add(after);
    }
    throw preconditionFailed('WhatsApp template lookup exceeded its pagination limit.', { reason: 'provider_pagination_limit' });
  };
  try { return await Promise.race([lookup(), timeout]); } catch (error) {
    if (error instanceof DomainError) throw error;
    throw unavailable();
  } finally { if (rejectTimeout) signal.removeEventListener('abort', rejectTimeout); }
}

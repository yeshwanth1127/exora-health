import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMetaTemplate } from './meta-template-client.ts';
import { resolveWhatsAppBinding, type ProviderEnvironment } from './whatsapp-provider-config.ts';
const a = { tenantId: '11111111-1111-4111-8111-111111111111', facilityId: '22222222-2222-4222-8222-222222222222', phoneNumberId: '123456789', businessAccountId: '987654321', accessTokenEnv: 'HMS_WA_TOKEN_CLINIC_A' };
const b = { ...a, facilityId: '33333333-3333-4333-8333-333333333333', phoneNumberId: '444444444', businessAccountId: '555555555', accessTokenEnv: 'HMS_WA_TOKEN_CLINIC_B' };
const env: ProviderEnvironment = { WA_CLINIC_BINDINGS_JSON: JSON.stringify([a, b]), WA_APP_SECRET: 'test-app-secret'.padEnd(32, 'x'), WA_VERIFY_TOKEN: 'verify', WA_GRAPH_VERSION: 'v24.0', HMS_WA_TOKEN_CLINIC_A: 'private-a-token', HMS_WA_TOKEN_CLINIC_B: 'private-b-token' };
const binding = resolveWhatsAppBinding(a.phoneNumberId, env)!;
const row = { id: '123456', name: 'visit_reminder', language: 'en_US', category: 'UTILITY', status: 'APPROVED', parameter_format: 'POSITIONAL', components: [{ type: 'BODY', text: 'Hello {{1}}', example: { body_text: [['Patient']] } }] };
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);
const mocked = (responses: Response[]) => vi.fn(async () => { const response = responses.shift(); if (!response) throw Error('unexpected request'); return response; });
afterEach(() => vi.restoreAllMocks());
describe('bounded read-only Meta template lookup', () => {
  it('pins host, WABA, graph version, exact query fields and header-only clinic credentials', async () => {
    const fetcher = mocked([json({ data: [row] }), json({ data: [row] })]);
    const result = await getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch });
    expect(result).toEqual({ id: row.id, name: row.name, language: row.language, category: row.category, status: row.status, parameterFormat: 'POSITIONAL', components: row.components });
    await getMetaTemplate(resolveWhatsAppBinding(b.phoneNumberId, env)!, row.name, row.language, { env, fetcher: fetcher as typeof fetch });
    const calls = fetcher.mock.calls as unknown as [URL, RequestInit][];
    for (const [index, [url, options]] of calls.entries()) {
      expect(url.origin).toBe('https://graph.facebook.com');
      expect(url.pathname).toBe(`/v24.0/${index ? b.businessAccountId : a.businessAccountId}/message_templates`);
      expect(url.searchParams.get('name')).toBe(row.name); expect(url.searchParams.get('limit')).toBe('100');
      expect(url.searchParams.get('fields')).toBe('id,name,language,category,status,parameter_format,components');
      expect(url.href).not.toContain('private-'); expect(options).toMatchObject({ method: 'GET', redirect: 'error', headers: { Authorization: `Bearer private-${index ? 'b' : 'a'}-token` } });
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it('never fetches without canonical credentials or when caller forges the WABA pin', async () => {
    const fetcher = vi.fn();
    for (const [candidate, configured] of [[binding, { ...env, HMS_WA_TOKEN_CLINIC_A: undefined }], [{ ...binding, businessAccountId: b.businessAccountId }, env], [{ ...binding, accessTokenEnv: b.accessTokenEnv }, env], [binding, { ...env, WA_VERIFY_TOKEN: undefined }]] as const) {
      await expect(getMetaTemplate(candidate, row.name, row.language, { env: configured, fetcher })).rejects.toMatchObject({ code: 'precondition_failed', details: { reason: 'provider_not_configured' } });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reconstructs pagination on the original endpoint and does not trust malicious next URLs', async () => {
    const fetcher = mocked([json({ data: [{ ...row, language: 'hi' }], paging: { next: 'https://attacker.invalid/steal?access_token=private-a-token', cursors: { after: 'opaque+/==' } } }), json({ data: [row] })]);
    expect((await getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch }))?.id).toBe(row.id);
    const calls = fetcher.mock.calls as unknown as [URL, RequestInit][];
    expect(calls[1]![0].origin).toBe('https://graph.facebook.com'); expect(calls[1]![0].pathname).toBe(calls[0]![0].pathname);
    expect(calls[1]![0].searchParams.get('after')).toBe('opaque+/=='); expect(calls[1]![0].href).not.toContain('attacker');
  });
  it('returns null only after complete pagination and preserves unknown statuses without approval claims', async () => {
    const fetcher = mocked([json({ data: [row], paging: { next: 'ignored', cursors: { after: 'next' } } }), json({ data: [] })]);
    expect(await getMetaTemplate(binding, 'different', 'hi', { env, fetcher: fetcher as typeof fetch })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const unknown = mocked([json({ data: [{ ...row, status: 'FUTURE_REVIEW_STATUS', parameter_format: undefined }] })]);
    expect(await getMetaTemplate(binding, row.name, row.language, { env, fetcher: unknown as typeof fetch })).toMatchObject({ status: 'FUTURE_REVIEW_STATUS', parameterFormat: null });
  });
  it('refuses multiple exact template IDs rather than choosing the first match', async () => {
    const fetcher = mocked([json({ data: [row], paging: { next: 'ignored', cursors: { after: 'next' } } }), json({ data: [{ ...row, id: '654321' }] })]);
    await expect(getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch })).rejects.toMatchObject({ details: { reason: 'ambiguous_provider_template' } });
  });
  it('rejects malformed rows even when unmatched and rejects malformed pagination or provider error envelopes', async () => {
    for (const body of [{ data: [{ ...row, name: 'unmatched', id: null }] }, { data: [{ ...row, components: [{ type: 'BODY', text: 17 }] }] }, { data: [{ ...row, components: [{ type: 'BODY', text: 'x'.repeat(65_537) }] }] }, { data: 'invalid' }, { error: { message: 'private-a-token' } }, { data: [], paging: { next: 'https://elsewhere.invalid' } }, { data: [], paging: { next: 'ignored', cursors: { after: 'invalid cursor\n' } } }]) {
      const fetcher = mocked([json(body)]);
      await expect(getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch })).rejects.toMatchObject({ code: 'precondition_failed', details: { reason: 'invalid_provider_response' } });
    }
  });
  it('bounds streamed bytes before parsing, without relying on Content-Length', async () => {
    const fetcher = mocked([new Response(' '.repeat(1_000_001))]);
    await expect(getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch })).rejects.toMatchObject({ details: { reason: 'invalid_provider_response' } });
    const declared = mocked([json({ data: [] }, { headers: { 'content-length': '1000001' } })]);
    await expect(getMetaTemplate(binding, row.name, row.language, { env, fetcher: declared as typeof fetch })).rejects.toMatchObject({ details: { reason: 'invalid_provider_response' } });
  });
  it('sanitizes non-success and thrown provider errors without retries or raw body/credential echoes', async () => {
    for (const fetcher of [mocked([new Response('provider says private-a-token is invalid', { status: 401 })]), vi.fn(async () => { throw Error('private-a-token raw provider failure'); })]) {
      try { await getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch }); throw Error('unexpected success'); } catch (error) {
        expect(error).toMatchObject({ code: 'precondition_failed', details: { reason: 'provider_unavailable' } });
        expect(JSON.stringify(error)).not.toContain('private-a-token'); expect((error as Error).message).not.toContain('provider says');
      }
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('uses one total ten-second timeout even when a mock ignores fetch abort', async () => {
    const controller = new AbortController(); const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetcher = vi.fn(async () => new Promise<Response>(() => undefined));
    const result = getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000); controller.abort();
    await expect(result).rejects.toMatchObject({ details: { reason: 'provider_unavailable' } }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('limits pagination to ten pages and refuses repeated cursors', async () => {
    const fetcher = mocked(Array.from({ length: 10 }, (_, index) => json({ data: [], paging: { next: 'ignored', cursors: { after: `cursor${index}` } } })));
    await expect(getMetaTemplate(binding, row.name, row.language, { env, fetcher: fetcher as typeof fetch })).rejects.toMatchObject({ details: { reason: 'provider_pagination_limit' } }); expect(fetcher).toHaveBeenCalledTimes(10);
    const repeated = mocked([json({ data: [], paging: { next: 'ignored', cursors: { after: 'repeat' } } }), json({ data: [], paging: { next: 'ignored', cursors: { after: 'repeat' } } })]);
    await expect(getMetaTemplate(binding, row.name, row.language, { env, fetcher: repeated as typeof fetch })).rejects.toMatchObject({ details: { reason: 'invalid_provider_response' } }); expect(repeated).toHaveBeenCalledTimes(2);
  });
});

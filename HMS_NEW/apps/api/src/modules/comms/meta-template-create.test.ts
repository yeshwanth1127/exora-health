import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@hms/platform';
import { createMetaTemplate, TemplateCreationUncertain, type MetaTemplateCreateInput } from './meta-template-create.ts';
import { resolveWhatsAppBinding, type ProviderEnvironment } from './whatsapp-provider-config.ts';
const a = { tenantId: '11111111-1111-4111-8111-111111111111', facilityId: '22222222-2222-4222-8222-222222222222', phoneNumberId: '123456789', businessAccountId: '987654321', accessTokenEnv: 'HMS_WA_TOKEN_CLINIC_A' };
const b = { ...a, facilityId: '33333333-3333-4333-8333-333333333333', phoneNumberId: '444444444', businessAccountId: '555555555', accessTokenEnv: 'HMS_WA_TOKEN_CLINIC_B' };
const env: ProviderEnvironment = { WA_CLINIC_BINDINGS_JSON: JSON.stringify([a, b]), WA_APP_SECRET: 'test-app-secret'.padEnd(32, 'x'), WA_VERIFY_TOKEN: 'verify', WA_GRAPH_VERSION: 'v24.0', HMS_WA_TOKEN_CLINIC_A: 'private-a-token', HMS_WA_TOKEN_CLINIC_B: 'private-b-token' };
const binding = resolveWhatsAppBinding(a.phoneNumberId, env)!;
const input: MetaTemplateCreateInput = { name: 'visit_reminder', body: 'Hello {{1}}, your visit is {{2}}.', language: 'en_US', category: 'utility', parameterCount: 2, samples: ['Patient', 'tomorrow'] };
const success = { id: '123456789', status: 'PENDING', category: 'UTILITY' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchResult = (response: Response) => vi.fn(async () => response);
const graphError = (extra: Record<string, unknown> = {}) => ({ error: { code: 100, type: 'OAuthException', message: 'private-a-token raw provider message', fbtrace_id: 'trace-id', ...extra } });
afterEach(() => vi.restoreAllMocks());
describe('bounded Meta BODY template creation', () => {
  it('posts only positional BODY content to the canonical WABA with header-only credentials', async () => {
    const fetcher = fetchResult(json(success));
    expect(await createMetaTemplate(binding, input, { env, fetcher: fetcher as typeof fetch })).toEqual(success);
    const [url, options] = (fetcher.mock.calls as unknown as [URL, RequestInit][])[0]!;
    expect(url.href).toBe(`https://graph.facebook.com/v24.0/${a.businessAccountId}/message_templates`);
    expect(url.href).not.toContain('private-'); expect(options).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer private-a-token', 'Content-Type': 'application/json' } });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body as string)).toEqual({ name: input.name, language: input.language, category: 'UTILITY', parameter_format: 'POSITIONAL', components: [{ type: 'BODY', text: input.body, example: { body_text: [input.samples] } }] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('omits examples for parameter-free templates and preserves provider status without claiming approval', async () => {
    const fetcher = fetchResult(json({ ...success, status: 'FUTURE_PROVIDER_STATUS', category: 'MARKETING' }));
    expect(await createMetaTemplate(binding, { ...input, body: 'Clinic hours have changed.', parameterCount: 0, samples: [], category: 'marketing' }, { env, fetcher: fetcher as typeof fetch })).toMatchObject({ status: 'FUTURE_PROVIDER_STATUS', category: 'MARKETING' });
    const [, options] = (fetcher.mock.calls as unknown as [URL, RequestInit][])[0]!;
    expect(JSON.parse(options.body as string).components).toEqual([{ type: 'BODY', text: 'Clinic hours have changed.' }]);
  });
  it('uses each clinic token independently and refuses forged or missing canonical credentials before sending', async () => {
    const fetcher = fetchResult(json(success));
    await createMetaTemplate(resolveWhatsAppBinding(b.phoneNumberId, env)!, input, { env, fetcher: fetcher as typeof fetch });
    const [url, options] = (fetcher.mock.calls as unknown as [URL, RequestInit][])[0]!;
    expect(url.pathname).toContain(b.businessAccountId); expect(options.headers).toMatchObject({ Authorization: 'Bearer private-b-token' });
    const refused = vi.fn();
    for (const [candidate, configured] of [[binding, { ...env, HMS_WA_TOKEN_CLINIC_A: undefined }], [{ ...binding, businessAccountId: b.businessAccountId }, env], [{ ...binding, accessTokenEnv: b.accessTokenEnv }, env], [binding, { ...env, WA_CLINIC_BINDINGS_JSON: 'malformed' }]] as const) {
      await expect(createMetaTemplate(candidate, input, { env: configured, fetcher: refused })).rejects.toMatchObject({ code: 'precondition_failed', details: { reason: 'provider_not_configured' } });
    }
    expect(refused).not.toHaveBeenCalled();
  });
  it('validates name, language, provider body limit, exact positional count and samples before sending', async () => {
    const fetcher = vi.fn();
    for (const changes of [{ name: 'Bad name' }, { name: 'x'.repeat(513) }, { language: '../invalid' }, { body: ' ' }, { body: 'x'.repeat(1025) }, { body: 'Hello {{name}} {{2}}' }, { body: 'Hello {{01}} {{2}}' }, { body: 'Hello {1} {{2}}' }, { body: 'Hello {{2}} {{1}}' }, { body: 'Hello {{1}} {{3}}' }, { parameterCount: 1 }, { parameterCount: 1.5 }, { parameterCount: 11 }, { samples: ['Patient'] }, { samples: ['Patient', ''] }, { samples: ['Patient', ' '.repeat(4)] }, { samples: ['Patient', 'x'.repeat(1025)] }, { category: 'authentication' }, { arbitrary: 'unknown field' }]) {
      await expect(createMetaTemplate(binding, { ...input, ...changes } as MetaTemplateCreateInput, { env, fetcher })).rejects.toMatchObject({ code: 'validation', details: { reason: 'invalid_template_submission' } });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts repeated valid placeholders while retaining one sample per positional parameter', async () => {
    const fetcher = fetchResult(json(success));
    await expect(createMetaTemplate(binding, { ...input, body: 'Hello {{1}}, visit {{2}}. Thanks {{1}}.' }, { env, fetcher: fetcher as typeof fetch })).resolves.toEqual(success);
  });
  it('classifies only wellformed HTTP400 documented validation and exact duplicate errors as definitive refusals', async () => {
    for (const [body, code, reason] of [[graphError(), 'validation', 'provider_validation_rejected'], [graphError({ error_subcode: 2388024 }), 'conflict', 'provider_template_exists']] as const) {
      const fetcher = fetchResult(json(body, 400));
      try { await createMetaTemplate(binding, input, { env, fetcher: fetcher as typeof fetch }); throw Error('unexpected success'); } catch (error) {
        expect(error).toBeInstanceOf(DomainError); expect(error).toMatchObject({ code, details: { reason } });
        expect((error as Error).message).not.toContain('private-a-token'); expect(JSON.stringify(error)).not.toContain('raw provider');
      }
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('treats other 4xx, 5xx, malformed Graph errors and mixed envelopes as uncertain without retries', async () => {
    for (const [status, body] of [[401, graphError({ code: 190 })], [429, graphError()], [500, graphError()], [400, graphError({ code: '100' })], [400, graphError({ is_transient: true })], [400, graphError({ error_subcode: 999 })], [400, graphError({ error_subcode: '2388024' })], [400, graphError({ type: 'unknown' })], [400, graphError({ message: null })], [400, graphError({ unexpected: 'field' })], [400, { ...graphError(), id: success.id }]] as const) {
      const fetcher = fetchResult(json(body, status));
      await expect(createMetaTemplate(binding, input, { env, fetcher: fetcher as typeof fetch })).rejects.toBeInstanceOf(TemplateCreationUncertain); expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('treats malformed and ambiguous success responses as uncertain, never as a safe retry', async () => {
    for (const body of [{ ...success, id: 'not-numeric' }, { ...success, id: 123456789 }, { ...success, status: '' }, { ...success, category: '' }, { ...success, error: graphError().error }, { data: [success, success] }, { success: true }, { ...success, id: '1'.repeat(41) }]) {
      const fetcher = fetchResult(json(body));
      await expect(createMetaTemplate(binding, input, { env, fetcher: fetcher as typeof fetch })).rejects.toMatchObject({ code: 'template_creation_uncertain' }); expect(fetcher).toHaveBeenCalledTimes(1);
    }
    const fetcher = fetchResult(new Response('not-json private-a-token'));
    await expect(createMetaTemplate(binding, input, { env, fetcher: fetcher as typeof fetch })).rejects.toBeInstanceOf(TemplateCreationUncertain);
  });
  it('bounds streamed responses and sanitizes network/domain errors after dispatch as uncertain', async () => {
    for (const fetcher of [fetchResult(new Response('x'.repeat(1_000_001))), fetchResult(new Response('{}', { headers: { 'content-length': '1000001' } })), vi.fn(async () => { throw Error('private-a-token network failure'); }), vi.fn(async () => { throw new DomainError('validation', 'private-a-token provider error'); })]) {
      try { await createMetaTemplate(binding, input, { env, fetcher: fetcher as typeof fetch }); throw Error('unexpected success'); } catch (error) {
        expect(error).toBeInstanceOf(TemplateCreationUncertain); expect((error as Error).message).not.toContain('private-a-token'); expect(JSON.stringify(error)).not.toContain('private-a-token');
      }
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('uses one overall ten-second deadline including a stalled response body and never retries', async () => {
    const controller = new AbortController(), timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{')); } });
    const fetcher = fetchResult(new Response(stream));
    const result = createMetaTemplate(binding, input, { env, fetcher: fetcher as typeof fetch });
    expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000); controller.abort();
    await expect(result).rejects.toBeInstanceOf(TemplateCreationUncertain); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

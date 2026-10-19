import { describe, expect, it } from 'vitest';
import { parseVoiceProviderConfig, resolveVoiceRuntimeBinding, resolveVoiceRuntimeSecret, VoiceProviderConfigError, type VoiceProviderEnvironment } from './voice-provider-config.ts';
const a = { tenantId: 'abcdefab-abcd-4abc-8abc-abcdefabcdef', facilityId: '22222222-2222-4222-8222-222222222222', accountId: 'clinic-a:agent.1', agentVersion: 2, secretEnv: 'HMS_VOICE_SECRET_CLINIC_A' };
const b = { ...a, facilityId: '33333333-3333-4333-8333-333333333333', accountId: 'clinic-b', secretEnv: 'HMS_VOICE_SECRET_CLINIC_B' };
const secretA = 'private-callback-secret-a'.padEnd(32, 'a'), secretB = 'private-callback-secret-b'.padEnd(32, 'b');
const environment = (rows: unknown[] = [a, b], extra: VoiceProviderEnvironment = {}): VoiceProviderEnvironment => ({ VOICE_CLINIC_BINDINGS_JSON: JSON.stringify(rows), HMS_VOICE_SECRET_CLINIC_A: secretA, HMS_VOICE_SECRET_CLINIC_B: secretB, ...extra });
const legacy: VoiceProviderEnvironment = { VOICE_CALLBACK_TENANT_ID: a.tenantId, VOICE_CALLBACK_FACILITY_ID: a.facilityId, VOICE_CALLBACK_ACCOUNT_ID: a.accountId, VOICE_CALLBACK_SECRET: secretA, SARVAM_APP_VERSION: '2' };
describe('server-only voice clinic callback bindings', () => {
  it('returns exact normalized clinic pins and metadata without secrets', () => {
    const env = environment([{ ...a, tenantId: a.tenantId.toUpperCase() }, b]);
    expect(resolveVoiceRuntimeBinding(a.accountId, env)).toEqual({ ...a, mode: 'multi_clinic', secretPresent: true });
    expect(JSON.stringify(parseVoiceProviderConfig(env))).not.toContain(secretA);
    expect(JSON.stringify(parseVoiceProviderConfig(env))).not.toContain(secretB);
    expect(resolveVoiceRuntimeBinding('unknown', env)).toBeNull();
    expect(resolveVoiceRuntimeBinding('../bad', env)).toBeNull();
  });
  it('resolves only the current canonical clinic secret and refuses forged or stale metadata', () => {
    const env = environment(); const resolved = resolveVoiceRuntimeBinding(a.accountId, env)!;
    expect(resolveVoiceRuntimeSecret(resolved, env)).toBe(secretA);
    for (const forged of [{ ...resolved, secretEnv: b.secretEnv }, { ...resolved, facilityId: b.facilityId }, { ...resolved, tenantId: b.facilityId }, { ...resolved, agentVersion: 3 }, { ...resolved, mode: 'legacy' as const }]) expect(resolveVoiceRuntimeSecret(forged, env)).toBeNull();
    expect(resolveVoiceRuntimeSecret(resolved, environment([b]))).toBeNull();
    expect(resolveVoiceRuntimeSecret(resolved, environment([{ ...a, agentVersion: 3 }]))).toBeNull();
  });
  it('permits unprovisioned descriptor metadata but never resolves a weak or absent secret', () => {
    for (const secret of [undefined, '', '   ', 'short', ' '.repeat(40), 'x'.repeat(31)]) {
      const env = environment([a], { HMS_VOICE_SECRET_CLINIC_A: secret, VOICE_CALLBACK_SECRET: secretB });
      const resolved = resolveVoiceRuntimeBinding(a.accountId, env)!;
      expect(resolved.secretPresent).toBe(false);
      expect(resolveVoiceRuntimeSecret({ ...resolved, secretPresent: true }, env)).toBeNull();
    }
    const env = environment([a], { HMS_VOICE_SECRET_CLINIC_A: ` ${secretA} ` });
    expect(resolveVoiceRuntimeSecret(resolveVoiceRuntimeBinding(a.accountId, env)!, env)).toBe(secretA);
  });
  it('rejects duplicate account, clinic pins, environment name, or actual credential values', () => {
    for (const rows of [[a, { ...b, accountId: a.accountId }], [a, { ...b, facilityId: a.facilityId }], [a, { ...b, tenantId: a.tenantId.toUpperCase(), facilityId: a.facilityId }], [a, { ...b, secretEnv: a.secretEnv }]]) expect(() => parseVoiceProviderConfig(environment(rows))).toThrow(VoiceProviderConfigError);
    for (const value of [secretA, ` ${secretA} `, 'short']) {
      const env = environment([a, b], { HMS_VOICE_SECRET_CLINIC_A: value.trim(), HMS_VOICE_SECRET_CLINIC_B: value });
      expect(() => parseVoiceProviderConfig(env)).toThrow(VoiceProviderConfigError);
    }
    expect(parseVoiceProviderConfig(environment([a, b], { HMS_VOICE_SECRET_CLINIC_A: undefined, HMS_VOICE_SECRET_CLINIC_B: undefined })).bindings).toHaveLength(2);
  });
  it('rejects unknown fields, invalid descriptors, unsafe secret names, and invalid versions without echoing inputs', () => {
    for (const row of [null, [], { ...a, injected: secretA }, { ...a, tenantId: 'bad' }, { ...a, facilityId: 'bad' }, { ...a, accountId: '' }, { ...a, accountId: 'x'.repeat(101) }, { ...a, accountId: 'account /bad' }, { ...a, agentVersion: 0 }, { ...a, agentVersion: 1.5 }, { ...a, agentVersion: '2' }, { ...a, agentVersion: Number.MAX_SAFE_INTEGER + 1 }, { ...a, secretEnv: 'VOICE_CALLBACK_SECRET' }, { ...a, secretEnv: 'HMS_VOICE_SECRET_lowercase' }, { ...a, secretEnv: 'HMS_VOICE_SECRET_' + 'A'.repeat(81) }]) {
      try { parseVoiceProviderConfig(environment([row])); throw Error('accepted invalid configuration'); } catch (error) {
        expect(error).toBeInstanceOf(VoiceProviderConfigError); expect((error as VoiceProviderConfigError).code).toBe('invalid_voice_provider_config');
        expect((error as Error).message).not.toContain(secretA); expect((error as Error).message).not.toContain('account /bad');
      }
    }
  });
  it('never falls back from an explicitly invalid or empty registry', () => {
    for (const raw of ['', '{sensitive-invalid-json', '{}', 'null', 'true']) expect(() => parseVoiceProviderConfig({ ...legacy, VOICE_CLINIC_BINDINGS_JSON: raw })).toThrow(VoiceProviderConfigError);
    const env = { ...legacy, VOICE_CLINIC_BINDINGS_JSON: '[]' };
    expect(parseVoiceProviderConfig(env)).toEqual({ mode: 'multi_clinic', bindings: [] });
    expect(resolveVoiceRuntimeBinding(a.accountId, env)).toBeNull();
  });
  it('bounds the registry and validates every descriptor before matching', () => {
    expect(() => parseVoiceProviderConfig(environment(Array(1001).fill(a)))).toThrow(VoiceProviderConfigError);
    expect(() => resolveVoiceRuntimeBinding('unknown', environment([a, { ...b, accountId: '../invalid' }]))).toThrow(VoiceProviderConfigError);
  });
  it('permits fully pinned strong legacy callbacks including production, with no unpinned fallback', () => {
    const env = { ...legacy, NODE_ENV: 'production' };
    const resolved = resolveVoiceRuntimeBinding(a.accountId, env)!;
    expect(resolved).toEqual({ ...a, mode: 'legacy', secretEnv: 'VOICE_CALLBACK_SECRET', secretPresent: true });
    expect(resolveVoiceRuntimeSecret(resolved, env)).toBe(secretA);
    expect(JSON.stringify(parseVoiceProviderConfig(env))).not.toContain(secretA);
    expect(parseVoiceProviderConfig({})).toEqual({ mode: 'legacy', bindings: [] });
    for (const extra of [{ VOICE_CALLBACK_SECRET: undefined }, { VOICE_CALLBACK_SECRET: 'weak' }, { VOICE_CALLBACK_TENANT_ID: undefined }, { VOICE_CALLBACK_FACILITY_ID: 'bad' }, { VOICE_CALLBACK_ACCOUNT_ID: undefined }, { SARVAM_APP_VERSION: undefined }, { SARVAM_APP_VERSION: '0' }, { SARVAM_APP_VERSION: '1.5' }, { SARVAM_APP_VERSION: '1e2' }]) expect(() => parseVoiceProviderConfig({ ...legacy, ...extra })).toThrow(VoiceProviderConfigError);
    expect(() => parseVoiceProviderConfig({ VOICE_CALLBACK_ACCOUNT_ID: 'partial' })).toThrow(VoiceProviderConfigError);
  });
  it('does not enable legacy callbacks for a web-agent version alone', () => {
    expect(parseVoiceProviderConfig({ SARVAM_APP_VERSION: '1' })).toEqual({ mode: 'legacy', bindings: [] });
  });
});

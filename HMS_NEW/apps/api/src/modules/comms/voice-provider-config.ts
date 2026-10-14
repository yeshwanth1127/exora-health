/** Server-only voice callback credential registry. Never expose the internal secret resolver to clients. */
export type VoiceProviderEnvironment = Readonly<Record<string, string | undefined>>;
export type VoiceRuntimeBinding = {
  mode: 'multi_clinic' | 'legacy';
  tenantId: string;
  facilityId: string;
  accountId: string;
  agentVersion: number;
  secretEnv: string;
  /** Configuration presence only, without a provider authentication or activation claim. */
  secretPresent: boolean;
};
export type VoiceProviderConfig = {
  mode: 'multi_clinic' | 'legacy';
  bindings: VoiceRuntimeBinding[];
};
type Descriptor = Omit<VoiceRuntimeBinding, 'mode' | 'secretPresent'>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT = /^[A-Za-z0-9_.:-]{1,100}$/;
const SECRET_ENV = /^HMS_VOICE_SECRET_[A-Z0-9_]{1,80}$/;
const KEYS = ['tenantId', 'facilityId', 'accountId', 'agentVersion', 'secretEnv'];
const LEGACY_FIELDS = ['VOICE_CALLBACK_TENANT_ID', 'VOICE_CALLBACK_FACILITY_ID', 'VOICE_CALLBACK_ACCOUNT_ID', 'VOICE_CALLBACK_SECRET', 'SARVAM_APP_VERSION'];
export class VoiceProviderConfigError extends Error {
  readonly code = 'invalid_voice_provider_config';
  constructor() {
    super('Voice server configuration is invalid. Check the clinic bindings configuration.');
    this.name = 'VoiceProviderConfigError';
  }
}
const fail = (): never => { throw new VoiceProviderConfigError(); };
const trimmed = (value: string | undefined): string => typeof value === 'string' ? value.trim() : '';
function descriptor(value: unknown): Descriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== KEYS.length || Object.keys(row).some(key => !KEYS.includes(key))) return fail();
  if (typeof row.tenantId !== 'string' || !UUID.test(row.tenantId) ||
      typeof row.facilityId !== 'string' || !UUID.test(row.facilityId) ||
      typeof row.accountId !== 'string' || !ACCOUNT.test(row.accountId) ||
      typeof row.agentVersion !== 'number' || !Number.isSafeInteger(row.agentVersion) || row.agentVersion < 1 ||
      typeof row.secretEnv !== 'string' || !SECRET_ENV.test(row.secretEnv)) return fail();
  return { tenantId: row.tenantId.toLowerCase(), facilityId: row.facilityId.toLowerCase(),
    accountId: row.accountId, agentVersion: row.agentVersion, secretEnv: row.secretEnv };
}
function binding(mode: VoiceRuntimeBinding['mode'], row: Descriptor, env: VoiceProviderEnvironment): VoiceRuntimeBinding {
  return { ...row, mode, secretPresent: trimmed(env[row.secretEnv]).length >= 32 };
}
/** Explicit registry presence is exclusive; malformed or empty explicit configuration never falls back. */
export function parseVoiceProviderConfig(env: VoiceProviderEnvironment = process.env): VoiceProviderConfig {
  if (env.VOICE_CLINIC_BINDINGS_JSON !== undefined) {
    const raw = env.VOICE_CLINIC_BINDINGS_JSON;
    if (typeof raw !== 'string' || raw.length > 1_000_000) return fail();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return fail(); }
    if (!Array.isArray(parsed) || parsed.length > 1000) return fail();
    const accounts = new Set<string>(), clinics = new Set<string>(), secretNames = new Set<string>(), secrets = new Set<string>();
    const bindings = parsed.map(value => {
      const row = descriptor(value), clinic = `${row.tenantId}:${row.facilityId}`;
      const secret = trimmed(env[row.secretEnv]);
      if (accounts.has(row.accountId) || clinics.has(clinic) || secretNames.has(row.secretEnv) || (secret !== '' && secrets.has(secret))) return fail();
      accounts.add(row.accountId); clinics.add(clinic); secretNames.add(row.secretEnv);
      if (secret !== '') secrets.add(secret);
      return binding('multi_clinic', row, env);
    });
    return { mode: 'multi_clinic', bindings };
  }
  if (!LEGACY_FIELDS.some(key => trimmed(env[key]) !== '')) return { mode: 'legacy', bindings: [] };
  const tenantId = env.VOICE_CALLBACK_TENANT_ID, facilityId = env.VOICE_CALLBACK_FACILITY_ID;
  const accountId = env.VOICE_CALLBACK_ACCOUNT_ID, rawVersion = env.SARVAM_APP_VERSION;
  if (typeof tenantId !== 'string' || !UUID.test(tenantId) || typeof facilityId !== 'string' || !UUID.test(facilityId) ||
      typeof accountId !== 'string' || !ACCOUNT.test(accountId) || typeof rawVersion !== 'string' || !/^[1-9][0-9]*$/.test(rawVersion) ||
      !Number.isSafeInteger(Number(rawVersion)) || trimmed(env.VOICE_CALLBACK_SECRET).length < 32) return fail();
  return { mode: 'legacy', bindings: [binding('legacy', {
    tenantId: tenantId.toLowerCase(), facilityId: facilityId.toLowerCase(), accountId,
    agentVersion: Number(rawVersion), secretEnv: 'VOICE_CALLBACK_SECRET',
  }, env)] };
}
/** Parse the complete registry before lookup so unknown accounts cannot conceal malformed configuration. */
export function resolveVoiceRuntimeBinding(accountId: string, env: VoiceProviderEnvironment = process.env): VoiceRuntimeBinding | null {
  const config = parseVoiceProviderConfig(env);
  if (!ACCOUNT.test(accountId)) return null;
  return config.bindings.find(item => item.accountId === accountId) ?? null;
}
/** Internal callback boundary. Re-resolve current pins and refuse forged or stale metadata. */
export function resolveVoiceRuntimeSecret(candidate: VoiceRuntimeBinding, env: VoiceProviderEnvironment = process.env): string | null {
  const current = resolveVoiceRuntimeBinding(candidate.accountId, env);
  if (!current || !current.secretPresent || current.mode !== candidate.mode || current.tenantId !== candidate.tenantId ||
      current.facilityId !== candidate.facilityId || current.agentVersion !== candidate.agentVersion || current.secretEnv !== candidate.secretEnv) return null;
  return trimmed(env[current.secretEnv]);
}

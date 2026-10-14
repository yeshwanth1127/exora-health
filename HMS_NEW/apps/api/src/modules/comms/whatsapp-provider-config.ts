/** Server-only credentials/configuration boundary. Never return this module's token resolver to a client. */
export type ProviderEnvironment = Readonly<Record<string, string | undefined>>;
export type WhatsAppBinding = {
  mode: 'multi_clinic' | 'legacy';
  tenantId: string | null;
  facilityId: string | null;
  phoneNumberId: string;
  businessAccountId: string | null;
  accessTokenEnv: string;
  accessTokenPresent: boolean;
  /** Shared app secret can authenticate signed callbacks independently of the GET handshake token. */
  signatureConfigured: boolean;
  /** Both shared inbound secrets are present. This is configuration readiness, not provider verification. */
  inboundConfigured: boolean;
  /** Configured credentials only: no token validity, account ownership or delivery claim. */
  outboundCredentialsReady: boolean;
};
export type WhatsAppProviderConfig = {
  mode: 'multi_clinic' | 'legacy';
  bindings: WhatsAppBinding[];
};
type Descriptor = Pick<WhatsAppBinding, 'phoneNumberId' | 'accessTokenEnv'> & {
  tenantId: string;
  facilityId: string;
  businessAccountId: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const META_ID = /^[0-9]{5,40}$/;
const GRAPH_VERSION = /^v[0-9]{1,3}\.[0-9]{1,2}$/;
const TOKEN_ENV = /^HMS_WA_TOKEN_[A-Z0-9_]{1,80}$/;
const KEYS = ['tenantId', 'facilityId', 'phoneNumberId', 'businessAccountId', 'accessTokenEnv'];
/** Deliberately never includes supplied values, JSON parser output or nested causes. */
export class WhatsAppProviderConfigError extends Error {
  readonly code = 'invalid_whatsapp_provider_config';
  constructor() {
    super('WhatsApp server configuration is invalid. Check the clinic bindings configuration.');
    this.name = 'WhatsAppProviderConfigError';
  }
}
const present = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;
const fail = (): never => { throw new WhatsAppProviderConfigError(); };
function descriptor(value: unknown): Descriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== KEYS.length || Object.keys(row).some(key => !KEYS.includes(key))) return fail();
  if (typeof row.tenantId !== 'string' || !UUID.test(row.tenantId) ||
      typeof row.facilityId !== 'string' || !UUID.test(row.facilityId) ||
      typeof row.phoneNumberId !== 'string' || !META_ID.test(row.phoneNumberId) ||
      typeof row.businessAccountId !== 'string' || !META_ID.test(row.businessAccountId) ||
      typeof row.accessTokenEnv !== 'string' || !TOKEN_ENV.test(row.accessTokenEnv)) return fail();
  return { tenantId: row.tenantId.toLowerCase(), facilityId: row.facilityId.toLowerCase(),
    phoneNumberId: row.phoneNumberId, businessAccountId: row.businessAccountId, accessTokenEnv: row.accessTokenEnv };
}
function binding(mode: WhatsAppBinding['mode'], row: Omit<WhatsAppBinding,
  'mode' | 'accessTokenPresent' | 'signatureConfigured' | 'inboundConfigured' | 'outboundCredentialsReady'>, env: ProviderEnvironment): WhatsAppBinding {
  const accessTokenPresent = present(env[row.accessTokenEnv]);
  const appSecretReady = present(env.WA_APP_SECRET) && (mode === 'legacy' || env.WA_APP_SECRET!.trim().length >= 32);
  const inboundConfigured = appSecretReady && present(env.WA_VERIFY_TOKEN);
  const graphVersionConfigured = typeof env.WA_GRAPH_VERSION === 'string' && GRAPH_VERSION.test(env.WA_GRAPH_VERSION);
  return { ...row, mode, accessTokenPresent, signatureConfigured: appSecretReady, inboundConfigured,
    outboundCredentialsReady: inboundConfigured && accessTokenPresent && row.businessAccountId !== null && graphVersionConfigured };
}
/** An explicit configuration always takes precedence, including an empty list. Invalid explicit config fails closed. */
export function parseWhatsAppProviderConfig(env: ProviderEnvironment = process.env): WhatsAppProviderConfig {
  if (env.WA_CLINIC_BINDINGS_JSON !== undefined) {
    const raw = env.WA_CLINIC_BINDINGS_JSON;
    if (typeof raw !== 'string' || raw.length > 1_000_000) return fail();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return fail(); }
    if (!Array.isArray(parsed) || parsed.length > 1000) return fail();
    const phones = new Set<string>(), clinics = new Set<string>();
    const bindings = parsed.map(value => {
      const row = descriptor(value), clinic = `${row.tenantId}:${row.facilityId}`;
      if (phones.has(row.phoneNumberId) || clinics.has(clinic)) return fail();
      phones.add(row.phoneNumberId); clinics.add(clinic);
      return binding('multi_clinic', row, env);
    });
    return { mode: 'multi_clinic', bindings };
  }
  if (env.WA_PHONE_NUMBER_ID === undefined || env.WA_PHONE_NUMBER_ID === '') return { mode: 'legacy', bindings: [] };
  // Production ingress requires an explicit tenant/clinic pin; a global phone must never
  // become claimable by whichever clinic creates an account first.
  if (env.NODE_ENV === 'production') return fail();
  if (!META_ID.test(env.WA_PHONE_NUMBER_ID)) return fail();
  const businessAccountId = present(env.WA_BUSINESS_ACCOUNT_ID) ? env.WA_BUSINESS_ACCOUNT_ID! : null;
  if (businessAccountId !== null && !META_ID.test(businessAccountId)) return fail();
  return { mode: 'legacy', bindings: [binding('legacy', {
    tenantId: null, facilityId: null, phoneNumberId: env.WA_PHONE_NUMBER_ID,
    businessAccountId, accessTokenEnv: 'WA_ACCESS_TOKEN',
  }, env)] };
}
/** Config is parsed before matching so unknown phones cannot hide malformed explicit bindings. */
export function resolveWhatsAppBinding(phoneNumberId: string, env: ProviderEnvironment = process.env): WhatsAppBinding | null {
  const config = parseWhatsAppProviderConfig(env);
  if (!META_ID.test(phoneNumberId)) return null;
  return config.bindings.find(item => item.phoneNumberId === phoneNumberId) ?? null;
}
/** Internal sending boundary only. Resolve current canonical metadata; never trust a caller-supplied token-env name. */
export function resolveWhatsAppAccessToken(candidate: WhatsAppBinding, env: ProviderEnvironment = process.env): string | null {
  const current = resolveWhatsAppBinding(candidate.phoneNumberId, env);
  if (!current || !current.outboundCredentialsReady || current.mode !== candidate.mode || current.tenantId !== candidate.tenantId ||
      current.facilityId !== candidate.facilityId || current.businessAccountId !== candidate.businessAccountId ||
      current.accessTokenEnv !== candidate.accessTokenEnv) return null;
  const token = env[current.accessTokenEnv];
  return present(token) ? token!.trim() : null;
}

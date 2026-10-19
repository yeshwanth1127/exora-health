import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Public build metadata only; does not inspect or print credentials. */
export function validateRuntimeAuth(env, metadata) {
  if (env.NODE_ENV !== 'production') return;
  if (env.AUTH_MODE !== 'oidc' || !env.OIDC_ISSUER || !env.OIDC_JWKS_URL || !env.OIDC_AUDIENCE || !env.OIDC_CLIENT_ID)
    throw new Error('Production runtime requires company OIDC configuration.');
  if (metadata?.mode !== 'oidc' || metadata.authority !== env.OIDC_ISSUER || metadata.clientId !== env.OIDC_CLIENT_ID || metadata.audience !== env.OIDC_AUDIENCE)
    throw new Error('Rebuild the staff image with matching OIDC settings and development login disabled.');
  if (!['openid', 'email'].every(scope => metadata.scope?.split(' ').includes(scope)))
    throw new Error('Staff sign-in requires openid and email scopes for verified staff invitations.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const metadata = process.env.NODE_ENV === 'production' ? JSON.parse(readFileSync('apps/staff-web/dist/runtime-auth.json', 'utf8')) : undefined;
    validateRuntimeAuth(process.env, metadata);
  } catch (error) {
    const known = error instanceof Error && /^(Production runtime|Rebuild|Staff sign-in)/.test(error.message);
    console.error(known ? error.message : 'Staff runtime authentication metadata is missing or invalid. Rebuild the image.');
    process.exitCode = 1;
  }
}

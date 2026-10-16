import { describe, expect, it } from 'vitest';
import { validateRuntimeAuth } from '../../../../scripts/check-runtime-auth.mjs';
const env = { NODE_ENV:'production',AUTH_MODE:'oidc',OIDC_ISSUER:'https://login.example.com/',OIDC_JWKS_URL:'https://login.example.com/keys',OIDC_CLIENT_ID:'public-client',OIDC_AUDIENCE:'hms-api' };
const build = { mode:'oidc',authority:env.OIDC_ISSUER,clientId:env.OIDC_CLIENT_ID,audience:env.OIDC_AUDIENCE,scope:'openid profile email' };
describe('production image authentication', () => {
  it('accepts only a matching OIDC browser build and issuer configuration', () => {
    expect(() => validateRuntimeAuth(env,build)).not.toThrow();
    for (const metadata of [{...build,mode:'dev'},{...build,authority:'https://wrong.example.com/'},{...build,clientId:'wrong-client'},{...build,audience:'wrong-api'},undefined])
      expect(() => validateRuntimeAuth(env,metadata)).toThrow('Rebuild');
  });
  it('rejects development authentication, missing settings and missing invitation scope', () => {
    expect(() => validateRuntimeAuth({...env,AUTH_MODE:'dev'},build)).toThrow('Production runtime');
    expect(() => validateRuntimeAuth({...env,OIDC_JWKS_URL:''},build)).toThrow('Production runtime');
    expect(() => validateRuntimeAuth(env,{...build,scope:'openid profile'})).toThrow('email scopes');
    expect(() => validateRuntimeAuth({NODE_ENV:'development'},undefined)).not.toThrow();
  });
});

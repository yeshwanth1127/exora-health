// Verifies the bearer token and returns the identity (issuer + subject) it proves.
//   dev  : HS256 tokens signed with a shared secret (`pnpm dev:token`), local development only
//   oidc : tokens from the identity provider, verified against its published keys (JWKS)
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { AuthConfig } from '../config.ts';

export interface Identity {
  issuer: string;
  subject: string;
}

export type TokenVerifier = (token: string) => Promise<Identity>;

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function createVerifier(auth: AuthConfig): TokenVerifier {
  let jwks: JWTVerifyGetKey | undefined;
  const devKey = auth.mode === 'dev' ? new TextEncoder().encode(auth.secret) : undefined;
  return async (token) => {
    try {
      const { payload } =
        auth.mode === 'dev'
          ? await jwtVerify(token, devKey!, { issuer: auth.issuer, algorithms: ['HS256'] })
          : await jwtVerify(token, (jwks ??= createRemoteJWKSet(new URL(auth.jwksUrl))), {
              issuer: auth.issuer,
              audience: auth.audience,
            });
      if (!payload.sub || !payload.iss) throw new AuthenticationError('token has no subject');
      return { issuer: payload.iss, subject: payload.sub };
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      throw new AuthenticationError('invalid or expired token');
    }
  };
}

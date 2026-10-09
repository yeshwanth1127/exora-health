// Local development only: prints a bearer token for a seeded identity.
//   pnpm dev:token asha           → Dr Asha Rao (demo tenant)
//   pnpm dev:token ravi           → front desk
//   pnpm dev:token whatsapp-bot   → WhatsApp booking bot service account
import { SignJWT } from 'jose';
import { DEV_ISSUER, DEV_SECRET_DEFAULT } from '../config.ts';

export async function signDevToken(subject: string, { secret = process.env.DEV_JWT_SECRET ?? DEV_SECRET_DEFAULT, ttl = '12h' } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(DEV_ISSUER)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(new TextEncoder().encode(secret));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const subject = process.argv[2];
  if (!subject) {
    console.error('usage: pnpm dev:token <subject>   (e.g. asha, ravi, meena, priya, whatsapp-bot)');
    process.exit(1);
  }
  console.log(await signDevToken(subject));
}

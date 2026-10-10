// Jitsi carries the media only. Every check (who, when, consent, status) happens before this is
// called; the token it mints lets one person into one room for a few minutes. Reconnecting needs a
// fresh token, which repeats the checks.
import { SignJWT } from 'jose';
import type { TelehealthSettings } from '../../config.ts';

export interface JoinGrant {
  provider: 'jitsi';
  domain: string;
  roomName: string;
  jwt: string;
  expiresAt: string;
  role: 'moderator' | 'participant';
  displayName: string;
}

export async function mintJitsiGrant(
  settings: TelehealthSettings,
  input: { roomName: string; userId: string; displayName: string; moderator: boolean; now: Date },
): Promise<JoinGrant> {
  const iat = Math.floor(input.now.getTime() / 1000);
  const exp = iat + settings.tokenMinutes * 60;
  const jwt = await new SignJWT({
    room: input.roomName,
    context: { user: { id: input.userId, name: input.displayName, moderator: input.moderator } },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(settings.jitsiAppId)
    .setAudience(settings.jitsiAudience)
    .setSubject(settings.jitsiDomain)
    .setIssuedAt(iat)
    .setNotBefore(iat - 5)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(settings.jitsiSecret));
  return {
    provider: 'jitsi',
    domain: settings.jitsiDomain,
    roomName: input.roomName,
    jwt,
    expiresAt: new Date(exp * 1000).toISOString(),
    role: input.moderator ? 'moderator' : 'participant',
    displayName: input.displayName,
  };
}

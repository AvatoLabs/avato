import type { JSONWebKeySet } from 'jose';
import { createLocalJWKSet, jwtVerify } from 'jose';

import type { Env } from './types';

let cachedJwksVerifier: ReturnType<typeof createLocalJWKSet> | null = null;
let cachedJwks = '';
const DESKTOP_CLIENT_ID = 'lobehub-desktop';

function getJwksVerifier(env: Env): ReturnType<typeof createLocalJWKSet> {
  if (cachedJwksVerifier && cachedJwks === env.JWKS_PUBLIC_KEY) return cachedJwksVerifier;

  const jwks = JSON.parse(env.JWKS_PUBLIC_KEY) as Partial<JSONWebKeySet>;

  if (!Array.isArray(jwks.keys) || !jwks.keys.some((key) => key.alg === 'RS256')) {
    throw new Error('No RS256 key found in JWKS_PUBLIC_KEY');
  }

  cachedJwksVerifier = createLocalJWKSet({ keys: jwks.keys });
  cachedJwks = env.JWKS_PUBLIC_KEY;
  return cachedJwksVerifier;
}

export async function verifyDesktopToken(
  env: Env,
  token: string,
): Promise<{ clientId: string; expiresAt: number; userId: string }> {
  const jwksVerifier = getJwksVerifier(env);
  const { payload } = await jwtVerify(token, jwksVerifier, {
    algorithms: ['RS256'],
  });

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Missing sub claim');
  }
  if (typeof payload.exp !== 'number') throw new Error('Missing exp claim');
  if (payload.client_id !== DESKTOP_CLIENT_ID) throw new Error('Invalid client_id claim');

  return {
    clientId: payload.client_id,
    expiresAt: payload.exp * 1000,
    userId: payload.sub,
  };
}

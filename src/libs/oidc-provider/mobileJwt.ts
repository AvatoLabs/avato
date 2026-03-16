import { TRPCError } from '@trpc/server';
import { importJWK, jwtVerify, SignJWT } from 'jose';

import { authEnv } from '@/envs/auth';

const ACCESS_TOKEN_EXPIRES_IN = 60 * 60;
const MOBILE_ACCESS_AUDIENCE = 'urn:lobehub:chat';
const MOBILE_CLIENT_ID = 'lobehub-mobile';
const MOBILE_REFRESH_PURPOSE = 'mobile_refresh';
const MOBILE_ACCESS_PURPOSE = 'mobile_access';
const MOBILE_SCOPE = 'openid profile email offline_access';
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 30;

const getRsaJwk = () => {
  if (!authEnv.JWKS_KEY) {
    throw new Error('JWKS_KEY environment variable is not set');
  }

  const jwks = JSON.parse(authEnv.JWKS_KEY);
  const rsaKey = jwks.keys.find((key: any) => key.alg === 'RS256' && key.kty === 'RSA');

  if (!rsaKey) {
    throw new Error('No RS256 RSA key found in JWKS');
  }

  return rsaKey;
};

const getSigningKey = async () => {
  const rsaKey = getRsaJwk();

  return {
    key: await importJWK(rsaKey, 'RS256'),
    kid: rsaKey.kid as string,
  };
};

const getVerificationKey = async () => {
  const rsaKey = getRsaJwk();
  const publicKeyJwk = {
    alg: rsaKey.alg,
    e: rsaKey.e,
    kid: rsaKey.kid,
    kty: rsaKey.kty,
    n: rsaKey.n,
    use: rsaKey.use,
  };

  Object.keys(publicKeyJwk).forEach(
    (key) => (publicKeyJwk as any)[key] === undefined && delete (publicKeyJwk as any)[key],
  );

  return importJWK(publicKeyJwk, 'RS256');
};

export const createMobileTokenPair = async (userId: string) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const { key, kid } = await getSigningKey();

  const accessToken = await new SignJWT({
    client_id: MOBILE_CLIENT_ID,
    purpose: MOBILE_ACCESS_PURPOSE,
    scope: MOBILE_SCOPE,
  })
    .setAudience(MOBILE_ACCESS_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_EXPIRES_IN)
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(userId)
    .sign(key);

  const refreshToken = await new SignJWT({
    client_id: MOBILE_CLIENT_ID,
    purpose: MOBILE_REFRESH_PURPOSE,
    scope: 'offline_access',
  })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + REFRESH_TOKEN_EXPIRES_IN)
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(userId)
    .sign(key);

  return {
    accessToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuedAt,
    refreshToken,
    scope: MOBILE_SCOPE,
    tokenType: 'bearer',
  };
};

export const verifyMobileRefreshToken = async (token: string) => {
  try {
    const publicKey = await getVerificationKey();
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
    });

    if (payload.purpose !== MOBILE_REFRESH_PURPOSE) {
      throw new Error('Invalid mobile refresh token purpose');
    }

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('Invalid mobile refresh token subject');
    }

    return payload.sub;
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: `Mobile refresh token validation failed: ${(error as Error).message}`,
    });
  }
};

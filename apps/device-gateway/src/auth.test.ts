import type { JWK } from 'jose';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { verifyDesktopToken } from './auth';
import type { Env } from './types';

interface KeyFixture {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: JWK;
  publicJwks: string;
}

const createEnv = (publicJwks: string): Env => ({
  DEVICE_GATEWAY: {} as DurableObjectNamespace,
  JWKS_PUBLIC_KEY: publicJwks,
  SERVICE_TOKEN: 'service-token',
});

const createFixture = async (kid: string): Promise<KeyFixture> => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = { ...(await exportJWK(publicKey)), alg: 'RS256', kid, use: 'sig' };

  return {
    kid,
    privateKey,
    publicJwk,
    publicJwks: JSON.stringify({
      keys: [publicJwk],
    }),
  };
};

const signToken = async (
  privateKey: CryptoKey,
  payload: { clientId: string; exp?: number; kid?: string; sub?: string },
) => {
  let jwt = new SignJWT({ client_id: payload.clientId })
    .setProtectedHeader({ alg: 'RS256', ...(payload.kid ? { kid: payload.kid } : {}) })
    .setSubject(payload.sub ?? 'user-1');

  if (payload.exp) jwt = jwt.setExpirationTime(payload.exp);

  return jwt.sign(privateKey);
};

describe('verifyDesktopToken', () => {
  let firstKey: KeyFixture;
  let secondKey: KeyFixture;

  beforeAll(async () => {
    firstKey = await createFixture('first-key');
    secondKey = await createFixture('second-key');
  });

  it('verifies RS256 desktop tokens and returns the expiry timestamp', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signToken(firstKey.privateKey, {
      clientId: 'lobehub-desktop',
      exp,
      sub: 'user-1',
    });

    const result = await verifyDesktopToken(createEnv(firstKey.publicJwks), token);

    expect(result).toEqual({
      clientId: 'lobehub-desktop',
      expiresAt: exp * 1000,
      userId: 'user-1',
    });
  });

  it('selects the matching key from JWKS by kid', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const jwks = JSON.stringify({ keys: [firstKey.publicJwk, secondKey.publicJwk] });
    const token = await signToken(secondKey.privateKey, {
      clientId: 'lobehub-desktop',
      exp,
      kid: secondKey.kid,
      sub: 'user-2',
    });

    await expect(verifyDesktopToken(createEnv(jwks), token)).resolves.toEqual({
      clientId: 'lobehub-desktop',
      expiresAt: exp * 1000,
      userId: 'user-2',
    });
  });

  it('refreshes the cached public key when JWKS_PUBLIC_KEY changes', async () => {
    const firstToken = await signToken(firstKey.privateKey, {
      clientId: 'lobehub-desktop',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-1',
    });
    const secondToken = await signToken(secondKey.privateKey, {
      clientId: 'lobehub-desktop',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-2',
    });

    await verifyDesktopToken(createEnv(firstKey.publicJwks), firstToken);

    await expect(verifyDesktopToken(createEnv(secondKey.publicJwks), secondToken)).resolves.toEqual(
      expect.objectContaining({ userId: 'user-2' }),
    );
  });

  it('rejects signed tokens that were not issued for the desktop client', async () => {
    const token = await signToken(firstKey.privateKey, {
      clientId: 'lobehub-mobile',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-1',
    });

    await expect(verifyDesktopToken(createEnv(firstKey.publicJwks), token)).rejects.toThrow(
      'Invalid client_id claim',
    );
  });

  it('rejects tokens without an expiry', async () => {
    const token = await signToken(firstKey.privateKey, {
      clientId: 'lobehub-desktop',
      sub: 'user-1',
    });

    await expect(verifyDesktopToken(createEnv(firstKey.publicJwks), token)).rejects.toThrow(
      'Missing exp claim',
    );
  });
});

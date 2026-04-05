import { createHmac, timingSafeEqual } from 'node:crypto';

const SKILL_ZIP_PROXY_TOKEN_TTL_MS = 5 * 60 * 1000;

interface SkillZipProxyTokenPayload {
  exp: number;
  skillId: string;
  v: 1;
}

const getSkillZipProxySecret = () => process.env.KEY_VAULTS_SECRET;

const encodePayload = (payload: SkillZipProxyTokenPayload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const decodePayload = (payload: string): SkillZipProxyTokenPayload | null => {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const signPayload = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export const createSkillZipProxyToken = (
  skillId: string,
  options?: { now?: number; ttlMs?: number },
) => {
  const secret = getSkillZipProxySecret();
  if (!secret) return;

  const payload = encodePayload({
    exp: (options?.now ?? Date.now()) + (options?.ttlMs ?? SKILL_ZIP_PROXY_TOKEN_TTL_MS),
    skillId,
    v: 1,
  });

  return `${payload}.${signPayload(payload, secret)}`;
};

export const verifySkillZipProxyToken = (
  skillId: string,
  token?: string | null,
  options?: { now?: number },
) => {
  const secret = getSkillZipProxySecret();
  if (!secret || !token) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = signPayload(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return false;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  const decoded = decodePayload(payload);
  if (!decoded) return false;

  return (
    decoded.v === 1 &&
    decoded.skillId === skillId &&
    Number.isFinite(decoded.exp) &&
    decoded.exp >= (options?.now ?? Date.now())
  );
};

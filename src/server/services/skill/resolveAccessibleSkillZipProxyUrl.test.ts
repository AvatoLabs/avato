import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppEnv = vi.hoisted(() => ({
  APP_URL: 'https://app.example.com',
  INTERNAL_APP_URL: 'http://internal.example.com',
}));
const originalKeyVaultsSecret = process.env.KEY_VAULTS_SECRET;

vi.mock('@/envs/app', () => ({
  get appEnv() {
    return mockAppEnv;
  },
}));

const { resolveAccessibleSkillZipProxyUrl } = await import('./resolveAccessibleSkillZipProxyUrl');

describe('resolveAccessibleSkillZipProxyUrl', () => {
  const canAccessGlobalFileByHash = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppEnv.APP_URL = 'https://app.example.com';
    mockAppEnv.INTERNAL_APP_URL = 'http://internal.example.com';
    process.env.KEY_VAULTS_SECRET = 'test-secret';
  });

  afterAll(() => {
    if (originalKeyVaultsSecret === undefined) {
      delete process.env.KEY_VAULTS_SECRET;
    } else {
      process.env.KEY_VAULTS_SECRET = originalKeyVaultsSecret;
    }
  });

  it('returns the stable public proxy URL when the caller can access the zip hash', async () => {
    canAccessGlobalFileByHash.mockResolvedValue(true);

    await expect(
      resolveAccessibleSkillZipProxyUrl({
        fileModel: { canAccessGlobalFileByHash } as any,
        skillId: 'skill-1',
        zipFileHash: 'hash-1',
      }),
    ).resolves.toBe('https://app.example.com/skills/skill-1/zip');
  });

  it('returns the stable internal proxy URL for server-to-server callers', async () => {
    canAccessGlobalFileByHash.mockResolvedValue(true);

    const result = await resolveAccessibleSkillZipProxyUrl({
      fileModel: { canAccessGlobalFileByHash } as any,
      internal: true,
      skillId: 'skill-2',
      zipFileHash: 'hash-2',
    });

    expect(result).toBeTruthy();

    const url = new URL(result!);
    expect(url.origin).toBe('http://internal.example.com');
    expect(url.pathname).toBe('/skills/skill-2/zip');
    expect(url.searchParams.get('token')).toBeTruthy();
  });

  it('returns undefined when the caller cannot access the zip hash', async () => {
    canAccessGlobalFileByHash.mockResolvedValue(false);

    await expect(
      resolveAccessibleSkillZipProxyUrl({
        fileModel: { canAccessGlobalFileByHash } as any,
        skillId: 'skill-3',
        zipFileHash: 'hash-3',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns undefined when the skill has no zip hash', async () => {
    await expect(
      resolveAccessibleSkillZipProxyUrl({
        fileModel: { canAccessGlobalFileByHash } as any,
        skillId: 'skill-4',
      }),
    ).resolves.toBeUndefined();

    expect(canAccessGlobalFileByHash).not.toHaveBeenCalled();
  });
});

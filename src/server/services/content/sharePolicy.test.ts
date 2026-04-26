import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildContentShareUrls,
  CONTENT_SHARE_EXPIRY_OPTIONS,
  normalizeContentSharePassword,
  resolveContentShareAccess,
  resolveContentShareExpiresAt,
} from './sharePolicy';

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
  },
}));

describe('sharePolicy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T08:00:00.000Z'));
  });

  it('should expose the supported share expiry presets', () => {
    expect(CONTENT_SHARE_EXPIRY_OPTIONS).toEqual([1, 7, 30]);
  });

  it('should resolve share expiries from whole-day presets', () => {
    expect(resolveContentShareExpiresAt(7).toISOString()).toBe('2026-04-11T08:00:00.000Z');
  });

  it('should normalize optional share passwords', () => {
    expect(normalizeContentSharePassword()).toBeUndefined();
    expect(normalizeContentSharePassword('   ')).toBeUndefined();
    expect(normalizeContentSharePassword('  secret  ')).toBe('secret');
  });

  it('should build both reader and file download URLs for file shares', () => {
    expect(buildContentShareUrls({ kind: 'file', token: 'tok_1' })).toEqual({
      fileShareDownloadUrl: 'https://app.example.com/share/f/tok_1',
      shareUrl: 'https://app.example.com/share/r/tok_1',
    });
  });

  it('should only build reader URLs for non-file shares', () => {
    expect(buildContentShareUrls({ kind: 'document', token: 'tok_2' })).toEqual({
      fileShareDownloadUrl: undefined,
      shareUrl: 'https://app.example.com/share/r/tok_2',
    });
    expect(buildContentShareUrls({ kind: 'source_set', token: 'tok_3' })).toEqual({
      fileShareDownloadUrl: undefined,
      shareUrl: 'https://app.example.com/share/r/tok_3',
    });
  });

  it('should resolve protected share access with password checks', async () => {
    const { default: bcrypt } = await import('bcryptjs');
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const result = await resolveContentShareAccess({
      contentModel: {
        resolveShareLinkByToken: vi.fn().mockResolvedValue({
          id: 'lnk_1',
          passwordHash: 'hashed',
        }),
      },
      password: '  secret  ',
      token: ' tok_1 ',
    });

    expect(result).toEqual({
      link: { id: 'lnk_1', passwordHash: 'hashed' },
      status: 'ok',
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed');
  });

  it('should surface missing-password and not-found states explicitly', async () => {
    const missingPassword = await resolveContentShareAccess({
      contentModel: {
        resolveShareLinkByToken: vi.fn().mockResolvedValue({
          id: 'lnk_2',
          passwordHash: 'hashed',
        }),
      },
      token: 'tok_2',
    });
    const notFound = await resolveContentShareAccess({
      contentModel: {
        resolveShareLinkByToken: vi.fn().mockResolvedValue(null),
      },
      token: 'tok_3',
    });

    expect(missingPassword).toEqual({ status: 'missing_password' });
    expect(notFound).toEqual({ status: 'not_found' });
  });
});

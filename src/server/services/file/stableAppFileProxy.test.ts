import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppEnv = vi.hoisted(() => ({
  APP_URL: 'https://app.example.com',
  INTERNAL_APP_URL: 'https://internal.example.com',
}));

vi.mock('@/envs/app', () => ({
  get appEnv() {
    return mockAppEnv;
  },
}));

const {
  isSameOriginAppUrl,
  isStableAppFileProxyUrl,
  resolveStableAppFileProxyUrl,
  toAbsoluteStableAppFileProxyUrl,
} = await import('./stableAppFileProxy');

describe('stableAppFileProxy', () => {
  beforeEach(() => {
    mockAppEnv.APP_URL = 'https://app.example.com';
    mockAppEnv.INTERNAL_APP_URL = 'https://internal.example.com';
  });

  it('should detect trusted same-origin app urls', () => {
    expect(isSameOriginAppUrl('https://app.example.com/f/file-1')).toBe(true);
    expect(isSameOriginAppUrl('https://internal.example.com/share/f/tok')).toBe(true);
    expect(isSameOriginAppUrl('https://cdn.example.com/f/file-1')).toBe(false);
  });

  it('should detect stable app proxy urls for relative and absolute paths', () => {
    expect(isStableAppFileProxyUrl('/share/f/tok?password=secret')).toBe(true);
    expect(isStableAppFileProxyUrl('https://app.example.com/skills/skill-1/zip')).toBe(true);
    expect(isStableAppFileProxyUrl('https://cdn.example.com/skills/skill-1/zip')).toBe(false);
    expect(isStableAppFileProxyUrl('/not-a-file-proxy/path')).toBe(false);
  });

  it('should convert relative stable proxy urls to absolute urls', () => {
    expect(toAbsoluteStableAppFileProxyUrl('/eval/records/eval-1')).toBe(
      'https://app.example.com/eval/records/eval-1',
    );
  });

  it('should normalize stable proxy urls to relative app paths', () => {
    expect(resolveStableAppFileProxyUrl('/share/t/share-1/f/file-1?password=secret')).toBe(
      '/share/t/share-1/f/file-1?password=secret',
    );
    expect(
      resolveStableAppFileProxyUrl('https://internal.example.com/share/f/tok?password=secret'),
    ).toBe('/share/f/tok?password=secret');
    expect(resolveStableAppFileProxyUrl('https://cdn.example.com/share/f/tok')).toBeNull();
  });
});

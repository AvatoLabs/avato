import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppEnv = vi.hoisted(() => ({
  APP_URL: 'https://app.example.com',
  INTERNAL_APP_URL: 'http://internal.example.com',
}));

vi.mock('@/envs/app', () => ({
  get appEnv() {
    return mockAppEnv;
  },
}));

const { getSkillZipProxyUrl } = await import('./getSkillZipProxyUrl');

describe('getSkillZipProxyUrl', () => {
  beforeEach(() => {
    mockAppEnv.APP_URL = 'https://app.example.com';
    mockAppEnv.INTERNAL_APP_URL = 'http://internal.example.com';
  });

  it('builds public proxy urls from APP_URL by default', () => {
    expect(getSkillZipProxyUrl('skill 1')).toBe('https://app.example.com/skills/skill%201/zip');
  });

  it('builds internal proxy urls for server-to-server callers', () => {
    expect(getSkillZipProxyUrl('skill-1', { internal: true })).toBe(
      'http://internal.example.com/skills/skill-1/zip',
    );
  });

  it('falls back to APP_URL when INTERNAL_APP_URL is missing', () => {
    mockAppEnv.INTERNAL_APP_URL = undefined as any;

    expect(getSkillZipProxyUrl('skill-1', { internal: true })).toBe(
      'https://app.example.com/skills/skill-1/zip',
    );
  });
});

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSkillZipProxyToken, verifySkillZipProxyToken } from './skillZipProxyToken';

const originalSecret = process.env.KEY_VAULTS_SECRET;

describe('skillZipProxyToken', () => {
  beforeEach(() => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.KEY_VAULTS_SECRET;
    } else {
      process.env.KEY_VAULTS_SECRET = originalSecret;
    }
  });

  it('creates and verifies a scoped token for the matching skill', () => {
    const token = createSkillZipProxyToken('skill-1', { now: 1000, ttlMs: 5000 });

    expect(token).toBeTruthy();
    expect(verifySkillZipProxyToken('skill-1', token, { now: 2000 })).toBe(true);
  });

  it('rejects tokens for a different skill', () => {
    const token = createSkillZipProxyToken('skill-1', { now: 1000, ttlMs: 5000 });

    expect(verifySkillZipProxyToken('skill-2', token, { now: 2000 })).toBe(false);
  });

  it('rejects expired tokens', () => {
    const token = createSkillZipProxyToken('skill-1', { now: 1000, ttlMs: 1000 });

    expect(verifySkillZipProxyToken('skill-1', token, { now: 3001 })).toBe(false);
  });

  it('returns undefined / false when the signing secret is missing', () => {
    delete process.env.KEY_VAULTS_SECRET;

    expect(createSkillZipProxyToken('skill-1')).toBeUndefined();
    expect(verifySkillZipProxyToken('skill-1', 'token')).toBe(false);
  });
});

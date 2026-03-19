import { afterEach, describe, expect, it } from 'vitest';

import {
  buildInternalServiceAuthHeaders,
  isValidInternalServiceAuth,
} from '../internalServiceAuth';

const originalSecret = process.env.KEY_VAULTS_SECRET;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.KEY_VAULTS_SECRET;
  } else {
    process.env.KEY_VAULTS_SECRET = originalSecret;
  }
});

describe('internalServiceAuth', () => {
  it('builds bearer auth headers from KEY_VAULTS_SECRET', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';

    expect(buildInternalServiceAuthHeaders()).toEqual({
      Authorization: 'Bearer test-secret',
    });
  });

  it('throws when KEY_VAULTS_SECRET is missing', () => {
    delete process.env.KEY_VAULTS_SECRET;

    expect(() => buildInternalServiceAuthHeaders()).toThrow(
      'KEY_VAULTS_SECRET is required for internal service authentication.',
    );
  });

  it('validates bearer auth using KEY_VAULTS_SECRET', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';

    expect(isValidInternalServiceAuth('Bearer test-secret')).toBe(true);
    expect(isValidInternalServiceAuth('Bearer wrong-secret')).toBe(false);
    expect(isValidInternalServiceAuth(null)).toBe(false);
  });
});

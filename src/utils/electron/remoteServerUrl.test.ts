import { describe, expect, it } from 'vitest';

import {
  formatRemoteServerUrlForInput,
  normalizeRemoteServerUrl,
  validateRemoteServerUrl,
} from './remoteServerUrl';

describe('remoteServerUrl', () => {
  it('normalizes public bare domains to https urls', () => {
    expect(normalizeRemoteServerUrl('avato.turingmesh.com')).toBe('https://avato.turingmesh.com');
  });

  it('keeps local and private hosts on http by default', () => {
    expect(normalizeRemoteServerUrl('localhost:3010')).toBe('http://localhost:3010');
    expect(normalizeRemoteServerUrl('192.168.1.8:3010')).toBe('http://192.168.1.8:3010');
  });

  it('upgrades public http urls to https', () => {
    expect(normalizeRemoteServerUrl('http://avato.turingmesh.com/')).toBe(
      'https://avato.turingmesh.com',
    );
  });

  it('formats stored urls for editing', () => {
    expect(formatRemoteServerUrlForInput('https://avato.turingmesh.com')).toBe(
      'avato.turingmesh.com',
    );
  });

  it('validates empty optional urls', () => {
    expect(validateRemoteServerUrl('', { invalidMessage: 'invalid' })).toBeUndefined();
  });

  it('rejects empty required urls', () => {
    expect(
      validateRemoteServerUrl('', {
        invalidMessage: 'invalid',
        required: true,
        requiredMessage: 'required',
      }),
    ).toBe('required');
  });
});

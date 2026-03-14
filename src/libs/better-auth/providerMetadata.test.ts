import { describe, expect, it } from 'vitest';

import { getBetterAuthProviderMetadata } from './providerMetadata';

describe('getBetterAuthProviderMetadata', () => {
  it('normalizes aliases and deduplicates providers', () => {
    expect(getBetterAuthProviderMetadata(['microsoft-entra-id', 'microsoft'])).toEqual([
      {
        id: 'microsoft',
        label: 'Microsoft',
        mode: 'redirect',
        type: 'builtin',
      },
    ]);
  });

  it('marks WeChat as QR code sign-in', () => {
    expect(getBetterAuthProviderMetadata(['wechat'])).toEqual([
      {
        id: 'wechat',
        label: 'WeChat',
        mode: 'qrcode',
        type: 'generic',
      },
    ]);
  });

  it('uses a readable fallback label for unknown providers', () => {
    expect(getBetterAuthProviderMetadata(['enterprise-wechat'])).toEqual([
      {
        id: 'enterprise-wechat',
        label: 'Enterprise Wechat',
        mode: 'redirect',
        type: 'generic',
      },
    ]);
  });
});

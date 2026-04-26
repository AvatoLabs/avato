import { describe, expect, it } from 'vitest';

import { shouldShowTRPCNetworkErrorNotification } from './errorNotification';

describe('shouldShowTRPCNetworkErrorNotification', () => {
  it('suppresses desktop background query notifications by default', () => {
    expect(
      shouldShowTRPCNetworkErrorNotification({
        isDesktopRuntime: true,
        operationType: 'query',
      }),
    ).toBe(false);
  });

  it('keeps desktop mutation notifications enabled by default', () => {
    expect(
      shouldShowTRPCNetworkErrorNotification({
        isDesktopRuntime: true,
        operationType: 'mutation',
      }),
    ).toBe(true);
  });

  it('keeps web query notifications enabled by default', () => {
    expect(
      shouldShowTRPCNetworkErrorNotification({
        isDesktopRuntime: false,
        operationType: 'query',
      }),
    ).toBe(true);
  });

  it('respects explicit notification context', () => {
    expect(
      shouldShowTRPCNetworkErrorNotification({
        explicitShowNotification: true,
        isDesktopRuntime: true,
        operationType: 'query',
      }),
    ).toBe(true);

    expect(
      shouldShowTRPCNetworkErrorNotification({
        explicitShowNotification: false,
        isDesktopRuntime: false,
        operationType: 'mutation',
      }),
    ).toBe(false);
  });
});

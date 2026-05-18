import { describe, expect, it } from 'vitest';

import { getRouteMetadata } from './routeMetadata';

describe('routeMetadata', () => {
  it('does not expose disabled studio metadata by default', () => {
    expect(getRouteMetadata('/studio')).toMatchObject({
      titleKey: 'navigation.lobehub',
    });
  });

  it('does not expose disabled assistant marketplace metadata by default', () => {
    expect(getRouteMetadata('/community/agent')).toMatchObject({
      titleKey: 'navigation.discover',
    });
  });
});

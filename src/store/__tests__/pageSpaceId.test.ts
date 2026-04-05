import { describe, expect, it } from 'vitest';

import { resolvePageStoreSpaceId } from '../docs/spaceId';

describe('resolvePageStoreSpaceId', () => {
  it('should prefer explicit spaceId', () => {
    expect(
      resolvePageStoreSpaceId({
        pathname: '/spaces/spc_route/docs',
        queryFilterSpaceId: 'spc_query',
        spaceId: 'spc_explicit',
      }),
    ).toBe('spc_explicit');
  });

  it('should fall back to the current page route spaceId', () => {
    expect(
      resolvePageStoreSpaceId({
        pathname: '/spaces/spc_route/docs/docs_1',
        queryFilterSpaceId: 'spc_query',
      }),
    ).toBe('spc_route');
  });

  it('should fall back to queryFilter spaceId when route is unavailable', () => {
    expect(
      resolvePageStoreSpaceId({
        pathname: '/community',
        queryFilterSpaceId: 'spc_query',
      }),
    ).toBe('spc_query');
  });
});

import { describe, expect, it } from 'vitest';

import { resolveFileStoreSpaceId } from '../file/spaceId';

describe('resolveFileStoreSpaceId', () => {
  it('should prefer explicit spaceId', () => {
    expect(
      resolveFileStoreSpaceId({
        pathname: '/spaces/spc_route/files',
        queryFilterSpaceId: 'spc_query',
        spaceId: 'spc_explicit',
      }),
    ).toBe('spc_explicit');
  });

  it('should fall back to the current files route spaceId', () => {
    expect(
      resolveFileStoreSpaceId({
        pathname: '/spaces/spc_route/files/item/file_1',
        queryFilterSpaceId: 'spc_query',
      }),
    ).toBe('spc_route');
  });

  it('should fall back to queryFilter spaceId when route is unavailable', () => {
    expect(
      resolveFileStoreSpaceId({
        pathname: '/community',
        queryFilterSpaceId: 'spc_query',
      }),
    ).toBe('spc_query');
  });
});

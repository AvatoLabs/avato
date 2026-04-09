import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserService } from './index';

const { mockGetObjectByteArray, mockFindPersonalSpaceByOwnerId } = vi.hoisted(() => ({
  mockGetObjectByteArray: vi.fn(),
  mockFindPersonalSpaceByOwnerId: vi.fn(),
}));

vi.mock('@/server/modules/BlobProvider', () => ({
  getBlobProvider: () => ({
    getObjectByteArray: mockGetObjectByteArray,
  }),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: {
    findPersonalSpaceByOwnerId: mockFindPersonalSpaceByOwnerId,
  },
}));

vi.mock('@/database/models/user', () => ({
  UserModel: vi.fn(),
}));

vi.mock('@/libs/analytics', () => ({
  initializeServerAnalytics: vi.fn(),
}));

describe('UserService.getUserAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read avatars from the new space-scoped key first', async () => {
    mockFindPersonalSpaceByOwnerId.mockResolvedValue({ id: 'spc_personal' });
    mockGetObjectByteArray.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const service = new UserService({} as any);
    const result = await service.getUserAvatar('user-1', 'avatar.webp');

    expect(mockGetObjectByteArray).toHaveBeenCalledWith(
      'v2/spaces/spc_personal/blobs/user-avatar/avatar.webp',
    );
    expect(result).toEqual(Buffer.from([1, 2, 3]));
  });

  it('should fall back to the legacy avatar key', async () => {
    mockFindPersonalSpaceByOwnerId.mockResolvedValue({ id: 'spc_personal' });
    mockGetObjectByteArray
      .mockRejectedValueOnce(new Error('missing new key'))
      .mockResolvedValueOnce(new Uint8Array([4, 5, 6]));

    const service = new UserService({} as any);
    const result = await service.getUserAvatar('user-1', 'avatar.webp');

    expect(mockGetObjectByteArray).toHaveBeenNthCalledWith(
      1,
      'v2/spaces/spc_personal/blobs/user-avatar/avatar.webp',
    );
    expect(mockGetObjectByteArray).toHaveBeenNthCalledWith(2, 'user/avatar/user-1/avatar.webp');
    expect(result).toEqual(Buffer.from([4, 5, 6]));
  });
});

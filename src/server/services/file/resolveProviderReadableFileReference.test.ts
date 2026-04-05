import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAppEnv,
  mockAssertCapability,
  mockCreateAccessEvent,
  mockGetFullFileUrl,
  mockGetFileById,
} = vi.hoisted(() => ({
  mockAppEnv: {
    APP_URL: 'https://app.example.com',
    INTERNAL_APP_URL: 'http://internal.example.com',
  },
  mockAssertCapability: vi.fn(),
  mockCreateAccessEvent: vi.fn(),
  mockGetFileById: vi.fn(),
  mockGetFullFileUrl: vi.fn(),
}));

vi.mock('@/envs/app', () => ({
  get appEnv() {
    return mockAppEnv;
  },
}));

vi.mock('@/server/services/content', () => ({
  ContentAuthorizer: vi.fn(() => ({
    assertCapability: mockAssertCapability,
  })),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    createAccessEvent: mockCreateAccessEvent,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: {
    getFileById: mockGetFileById,
  },
}));

const { resolveProviderReadableFileReference } =
  await import('./resolveProviderReadableFileReference');

describe('resolveProviderReadableFileReference', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAssertCapability.mockResolvedValue({
      contentUid: 'content-1',
      matchedBy: 'space_member',
      spaceId: 'space-1',
    });
    mockGetFileById.mockResolvedValue({
      id: 'file-1',
      url: 'v2/spaces/space-1/blobs/blob-1',
    });
    mockGetFullFileUrl.mockResolvedValue('https://blob.example.com/download/blob-1');
  });

  it('resolves relative proxy urls through preview capability and audit', async () => {
    const result = await resolveProviderReadableFileReference({
      db: {} as any,
      fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
      sourceIp: '127.0.0.1',
      url: '/f/file-1',
      userAgent: 'vitest',
      userId: 'user-1',
      via: 'image_generation_input',
    });

    expect(mockAssertCapability).toHaveBeenCalledWith({
      capability: 'preview_content',
      id: 'file-1',
      kind: 'file',
    });
    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'file_url_issued',
        contentUid: 'content-1',
        metadata: {
          fileId: 'file-1',
          matchedBy: 'space_member',
          via: 'image_generation_input',
        },
        spaceId: 'space-1',
      }),
    );
    expect(result).toEqual({
      fileId: 'file-1',
      key: 'v2/spaces/space-1/blobs/blob-1',
      url: 'https://blob.example.com/download/blob-1',
    });
  });

  it('resolves same-origin absolute proxy urls', async () => {
    const result = await resolveProviderReadableFileReference({
      db: {} as any,
      fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
      url: 'https://app.example.com/f/file-2',
      userId: 'user-1',
      via: 'video_generation_input',
    });

    expect(mockAssertCapability).toHaveBeenCalledWith({
      capability: 'preview_content',
      id: 'file-2',
      kind: 'file',
    });
    expect(result?.fileId).toBe('file-2');
  });

  it('ignores cross-origin urls', async () => {
    const result = await resolveProviderReadableFileReference({
      db: {} as any,
      fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
      url: 'https://cdn.example.com/f/file-3',
      userId: 'user-1',
      via: 'image_generation_input',
    });

    expect(result).toBeNull();
    expect(mockAssertCapability).not.toHaveBeenCalled();
    expect(mockCreateAccessEvent).not.toHaveBeenCalled();
  });
});

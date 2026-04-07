import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAppEnv,
  mockAssertCapability,
  mockCreateAccessEvent,
  mockFindAccessibleSpaceBlobByStorageKey,
  mockGetFullFileUrl,
  mockGetFileById,
  mockGetFileByUrl,
  mockFindContentRegistryByUid,
  mockFindByShareIdWithAccessCheck,
  mockResolveShareLinkByToken,
} = vi.hoisted(() => ({
  mockAppEnv: {
    APP_URL: 'https://app.example.com',
    INTERNAL_APP_URL: 'http://internal.example.com',
  },
  mockAssertCapability: vi.fn(),
  mockCreateAccessEvent: vi.fn(),
  mockFindAccessibleSpaceBlobByStorageKey: vi.fn(),
  mockFindContentRegistryByUid: vi.fn(),
  mockFindByShareIdWithAccessCheck: vi.fn(),
  mockGetFileById: vi.fn(),
  mockGetFileByUrl: vi.fn(),
  mockGetFullFileUrl: vi.fn(),
  mockResolveShareLinkByToken: vi.fn(),
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
    findAccessibleSpaceBlobByStorageKey: mockFindAccessibleSpaceBlobByStorageKey,
    findContentRegistryByUid: mockFindContentRegistryByUid,
    resolveShareLinkByToken: mockResolveShareLinkByToken,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: {
    getFileById: mockGetFileById,
    getFileByUrl: mockGetFileByUrl,
  },
}));

vi.mock('@/database/models/topicShare', () => ({
  TopicShareModel: {
    findByShareIdWithAccessCheck: mockFindByShareIdWithAccessCheck,
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
    mockGetFileByUrl.mockResolvedValue(undefined);
    mockGetFileById.mockResolvedValue({
      id: 'file-1',
      url: 'v2/spaces/space-1/blobs/blob-1',
    });
    mockGetFullFileUrl.mockResolvedValue('https://blob.example.com/download/blob-1');
    mockFindAccessibleSpaceBlobByStorageKey.mockResolvedValue(undefined);
    mockFindContentRegistryByUid.mockResolvedValue({
      contentUid: 'content-file-share-1',
      kind: 'file',
      localId: 'file-share-2',
      spaceId: 'space-share-2',
    });
    mockFindByShareIdWithAccessCheck.mockResolvedValue({
      topicId: 'topic-1',
    });
    mockResolveShareLinkByToken.mockResolvedValue({
      contentUid: 'content-file-share-1',
      id: 'lnk-share-1',
      passwordHash: null,
      spaceId: 'space-share-2',
    });
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

  it('rejects document-shaped file proxy urls before file authorization', async () => {
    await expect(
      resolveProviderReadableFileReference({
        db: {} as any,
        fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
        url: '/f/docs_1',
        userId: 'user-1',
        via: 'image_generation_input',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DOCUMENT_REFERENCE_NOT_FETCHABLE',
    });

    expect(mockAssertCapability).not.toHaveBeenCalled();
    expect(mockGetFileById).not.toHaveBeenCalled();
    expect(mockCreateAccessEvent).not.toHaveBeenCalled();
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

  it('resolves canonical blob keys through mapped file capability and audit', async () => {
    const db = {} as any;

    mockGetFileByUrl.mockResolvedValue({
      id: 'file-blob-1',
      url: 'v2/spaces/space-blob/blobs/blob-1',
    });
    mockAssertCapability.mockResolvedValue({
      contentUid: 'content-blob-1',
      matchedBy: 'space_member',
      spaceId: 'space-blob',
    });

    const result = await resolveProviderReadableFileReference({
      db,
      fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
      sourceIp: '127.0.0.1',
      url: 'v2/spaces/space-blob/blobs/blob-1',
      userAgent: 'vitest',
      userId: 'user-1',
      via: 'image_generation_input',
    });

    expect(mockGetFileByUrl).toHaveBeenCalledWith(db, 'v2/spaces/space-blob/blobs/blob-1');
    expect(mockAssertCapability).toHaveBeenCalledWith({
      capability: 'preview_content',
      id: 'file-blob-1',
      kind: 'file',
    });
    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'file_url_issued',
        contentUid: 'content-blob-1',
        metadata: {
          fileId: 'file-blob-1',
          matchedBy: 'space_member',
          via: 'image_generation_input',
        },
        spaceId: 'space-blob',
      }),
    );
    expect(result).toEqual({
      fileId: 'file-blob-1',
      key: 'v2/spaces/space-blob/blobs/blob-1',
      url: 'https://blob.example.com/download/blob-1',
    });
  });

  it('resolves canonical blob keys through accessible space blob membership when no file exists', async () => {
    const db = {} as any;

    mockFindAccessibleSpaceBlobByStorageKey.mockResolvedValue({
      id: 'blb-1',
      spaceId: 'space-blob-2',
      status: 'ready',
      storageKey: 'v2/spaces/space-blob-2/blobs/blob-2',
    });

    const result = await resolveProviderReadableFileReference({
      db,
      fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
      sourceIp: '127.0.0.1',
      url: 'v2/spaces/space-blob-2/blobs/blob-2',
      userAgent: 'vitest',
      userId: 'user-1',
      via: 'video_generation_input',
    });

    expect(mockAssertCapability).not.toHaveBeenCalled();
    expect(mockFindAccessibleSpaceBlobByStorageKey).toHaveBeenCalledWith(
      'v2/spaces/space-blob-2/blobs/blob-2',
    );
    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'file_url_issued',
        contentUid: null,
        metadata: {
          fileId: null,
          matchedBy: 'space_member',
          via: 'video_generation_input',
        },
        spaceId: 'space-blob-2',
      }),
    );
    expect(result).toEqual({
      fileId: null,
      key: 'v2/spaces/space-blob-2/blobs/blob-2',
      url: 'https://blob.example.com/download/blob-1',
    });
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

  it('fails closed for inaccessible canonical blob keys', async () => {
    await expect(
      resolveProviderReadableFileReference({
        db: {} as any,
        fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
        url: 'v2/spaces/space-missing/blobs/blob-missing',
        userId: 'user-1',
        via: 'image_generation_input',
      }),
    ).rejects.toMatchObject({ message: 'RESOURCE_ACCESS_DENIED' });
  });

  it('resolves topic share attachment proxy urls through share access and audit', async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(function () {
            return this;
          }),
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                contentUid: 'content-share-1',
                fileId: 'file-share-1',
                spaceId: 'space-share-1',
                url: 'v2/spaces/space-share-1/blobs/blob-share-1',
              },
            ]),
          })),
        })),
      })),
    } as any;

    const result = await resolveProviderReadableFileReference({
      db,
      fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
      sourceIp: '127.0.0.1',
      url: '/share/t/share-1/f/file-share-1',
      userAgent: 'vitest',
      userId: 'user-1',
      via: 'image_generation_input',
    });

    expect(mockFindByShareIdWithAccessCheck).toHaveBeenCalledWith(db, 'share-1', 'user-1');
    expect(mockAssertCapability).not.toHaveBeenCalled();
    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'file_url_issued',
        contentUid: 'content-share-1',
        metadata: {
          fileId: 'file-share-1',
          matchedBy: 'share_link',
          via: 'image_generation_input',
        },
        spaceId: 'space-share-1',
      }),
    );
    expect(result).toEqual({
      fileId: 'file-share-1',
      key: 'v2/spaces/space-share-1/blobs/blob-share-1',
      url: 'https://blob.example.com/download/blob-1',
    });
  });

  it('rejects document-shaped topic share attachment refs', async () => {
    await expect(
      resolveProviderReadableFileReference({
        db: {} as any,
        fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
        url: '/share/t/share-1/f/docs_2',
        userId: 'user-1',
        via: 'image_generation_input',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DOCUMENT_REFERENCE_NOT_FETCHABLE',
    });

    expect(mockFindByShareIdWithAccessCheck).not.toHaveBeenCalled();
    expect(mockCreateAccessEvent).not.toHaveBeenCalled();
  });

  it('resolves shared file proxy urls through share access and audit', async () => {
    mockGetFileById.mockResolvedValue({
      id: 'file-share-2',
      url: 'v2/spaces/space-share-2/blobs/blob-share-2',
    });

    const result = await resolveProviderReadableFileReference({
      db: {} as any,
      fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
      sourceIp: '127.0.0.1',
      url: '/share/f/share-token-1',
      userAgent: 'vitest',
      userId: 'user-1',
      via: 'image_generation_input',
    });

    expect(mockResolveShareLinkByToken).toHaveBeenCalledWith('share-token-1');
    expect(mockFindContentRegistryByUid).toHaveBeenCalledWith('content-file-share-1');
    expect(mockCreateAccessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: 'file_url_issued',
        contentUid: 'content-file-share-1',
        metadata: {
          fileId: 'file-share-2',
          matchedBy: 'share_link',
          via: 'image_generation_input',
        },
        shareLinkId: 'lnk-share-1',
        spaceId: 'space-share-2',
      }),
    );
    expect(result).toEqual({
      fileId: 'file-share-2',
      key: 'v2/spaces/space-share-2/blobs/blob-share-2',
      url: 'https://blob.example.com/download/blob-1',
    });
  });

  it('rejects shared file tokens that resolve to canonical documents', async () => {
    mockFindContentRegistryByUid.mockResolvedValue({
      contentUid: 'content-doc-share-1',
      kind: 'document',
      localId: 'docs_3',
      spaceId: 'space-share-3',
    });

    await expect(
      resolveProviderReadableFileReference({
        db: {} as any,
        fileService: { getFullFileUrl: mockGetFullFileUrl } as any,
        url: '/share/f/share-token-1',
        userId: 'user-1',
        via: 'image_generation_input',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'DOCUMENT_REFERENCE_NOT_FETCHABLE',
    });

    expect(mockGetFileById).not.toHaveBeenCalled();
    expect(mockCreateAccessEvent).not.toHaveBeenCalled();
  });
});

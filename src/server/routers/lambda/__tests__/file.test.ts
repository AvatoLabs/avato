import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fileRouter } from '@/server/routers/lambda/file';
import { AsyncTaskStatus } from '@/types/asyncTask';

const mockResolverRequireDocument = vi.fn();
const mockResolverRequireFile = vi.fn();
const mockResolverRequireKnowledgeBase = vi.fn();
const mockResourceAuthorizerAssertCapability = vi.fn();
const mockFilterVisibleDocumentIdsForList = vi.fn(async (ids: string[]) => ids);
const mockFilterVisibleFileIdsForList = vi.fn(async (ids: string[]) => ids);
const mockTreeGuardAssertParentAssignment = vi.fn();

const mockResourceModelEnsureOwnerPermission = vi.fn();
const mockResourceModelEnsureResourceRegistry = vi
  .fn()
  .mockResolvedValue({ resourceUid: 'res_test' });
const mockResourceModelFindSpaceBlobByHash = vi.fn();
const mockResourceModelUpsertSpaceBlob = vi.fn().mockResolvedValue({ id: 'blob_test' });
const mockResourceModelGetSpaceMemberRole = vi.fn().mockResolvedValue('owner');
const mockResourceModelInvalidateAuthzEpochsAfterRemoval = vi.fn().mockResolvedValue(undefined);

const mockSpaceModelFindAccessibleSpaceById = vi.fn();
const mockSpaceModelGetOrCreatePersonalSpace = vi.fn().mockResolvedValue({ id: 'spc_test' });

const mockFileModelCheckHash = vi.fn();
const mockFileModelCreate = vi.fn();
const mockFileModelDelete = vi.fn();
const mockFileModelDeleteMany = vi.fn();
const mockFileModelFindExistingByBlobAndContext = vi.fn();
const mockFileModelFindById = vi.fn();
const mockFileModelQuery = vi.fn();
const mockFileModelClear = vi.fn();
const mockFileModelUpdate = vi.fn();

// Patch: Use actual router context middleware to inject the correct models/services
function createCallerWithCtx(partialCtx: any = {}) {
  const fileModel = {
    checkHash: mockFileModelCheckHash,
    create: mockFileModelCreate,
    delete: mockFileModelDelete,
    deleteAny: mockFileModelDelete,
    deleteMany: mockFileModelDeleteMany,
    deleteManyAny: mockFileModelDeleteMany,
    findExistingByBlobAndContext: mockFileModelFindExistingByBlobAndContext,
    findById: mockFileModelFindById,
    findByIdAny: mockFileModelFindById,
    query: mockFileModelQuery,
    clear: mockFileModelClear,
    update: mockFileModelUpdate,
    updateAny: mockFileModelUpdate,
  };

  const fileService = {
    getFullFileUrl: vi.fn().mockResolvedValue('full-url'),
    getFileMetadata: vi.fn().mockResolvedValue({ contentLength: 2048, contentType: 'text/plain' }),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    deleteFiles: vi.fn().mockResolvedValue(undefined),
  };

  const chunkModel = {
    countByFileIds: vi.fn().mockResolvedValue([{ id: 'test-id', count: 5 }]),
    countByFileId: vi.fn().mockResolvedValue(5),
  };

  const asyncTaskModel = {
    findByIds: vi.fn().mockResolvedValue([
      {
        id: 'test-task-id',
        status: AsyncTaskStatus.Success,
      },
    ]),
    findById: vi.fn(),
    delete: vi.fn(),
  };

  const knowledgeRepo = {
    query: mockKnowledgeRepoQuery,
    queryRecent: mockKnowledgeRepoQueryRecent,
  };

  const documentModel = {};

  const ctx = {
    serverDB: {} as any,
    userId: 'test-user',
    asyncTaskModel,
    chunkModel,
    documentModel,
    fileModel,
    fileService,
    knowledgeRepo,
    resourceAuthorizer: {
      assertCapability: mockResourceAuthorizerAssertCapability,
      filterVisibleDocumentIdsForList: mockFilterVisibleDocumentIdsForList,
      filterVisibleFileIdsForList: mockFilterVisibleFileIdsForList,
    },
    resourceModel: {
      ensureOwnerPermission: mockResourceModelEnsureOwnerPermission,
      ensureResourceRegistry: mockResourceModelEnsureResourceRegistry,
      findSpaceBlobByHash: mockResourceModelFindSpaceBlobByHash,
      getSpaceMemberRole: mockResourceModelGetSpaceMemberRole,
      invalidateAuthzEpochsAfterRemoval: mockResourceModelInvalidateAuthzEpochsAfterRemoval,
      upsertSpaceBlob: mockResourceModelUpsertSpaceBlob,
    },
    resolver: {
      requireDocument: mockResolverRequireDocument,
      requireFile: mockResolverRequireFile,
      requireKnowledgeBase: mockResolverRequireKnowledgeBase,
    },
    spaceModel: {
      findAccessibleSpaceById: mockSpaceModelFindAccessibleSpaceById,
      getOrCreatePersonalSpace: mockSpaceModelGetOrCreatePersonalSpace,
    },
    treeGuard: {
      assertParentAssignment: mockTreeGuardAssertParentAssignment,
    },
    ...partialCtx,
  };

  return { ctx, caller: fileRouter.createCaller(ctx) };
}

vi.mock('@/config/db', () => ({
  serverDBEnv: {
    REMOVE_GLOBAL_FILE: false,
  },
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://lobehub.com',
  },
}));

const mockAsyncTaskFindByIds = vi.fn();
const mockAsyncTaskFindById = vi.fn();
const mockAsyncTaskDelete = vi.fn();
const mockChunkCountByFileIds = vi.fn();
const mockChunkCountByFileId = vi.fn();

vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn(() => ({
    delete: mockAsyncTaskDelete,
    findById: mockAsyncTaskFindById,
    findByIds: mockAsyncTaskFindByIds,
  })),
}));

vi.mock('@/database/models/chunk', () => ({
  ChunkModel: vi.fn(() => ({
    countByFileId: mockChunkCountByFileId,
    countByFileIds: mockChunkCountByFileIds,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(() => ({
    checkHash: mockFileModelCheckHash,
    create: mockFileModelCreate,
    delete: mockFileModelDelete,
    deleteAny: mockFileModelDelete,
    deleteMany: mockFileModelDeleteMany,
    deleteManyAny: mockFileModelDeleteMany,
    findExistingByBlobAndContext: mockFileModelFindExistingByBlobAndContext,
    findById: mockFileModelFindById,
    findByIdAny: mockFileModelFindById,
    query: mockFileModelQuery,
    clear: mockFileModelClear,
    update: mockFileModelUpdate,
    updateAny: mockFileModelUpdate,
  })),
}));

vi.mock('@/database/models/resource', () => ({
  ResourceModel: vi.fn(() => ({
    ensureOwnerPermission: mockResourceModelEnsureOwnerPermission,
    ensureResourceRegistry: mockResourceModelEnsureResourceRegistry,
    findSpaceBlobByHash: mockResourceModelFindSpaceBlobByHash,
    getSpaceMemberRole: mockResourceModelGetSpaceMemberRole,
    invalidateAuthzEpochsAfterRemoval: mockResourceModelInvalidateAuthzEpochsAfterRemoval,
    upsertSpaceBlob: mockResourceModelUpsertSpaceBlob,
  })),
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: mockSpaceModelFindAccessibleSpaceById,
    getOrCreatePersonalSpace: mockSpaceModelGetOrCreatePersonalSpace,
  })),
}));

const mockFileServiceGetFullFileUrl = vi.fn();
const mockFileServiceGetFileMetadata = vi.fn();

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => ({
    deleteFile: vi.fn(),
    deleteFiles: vi.fn(),
    getFullFileUrl: mockFileServiceGetFullFileUrl,
    getFileMetadata: mockFileServiceGetFileMetadata,
  })),
}));

const mockKnowledgeRepoQuery = vi.fn().mockResolvedValue([]);
const mockKnowledgeRepoQueryRecent = vi.fn().mockResolvedValue([]);
const mockDocumentModelFindBySlug = vi.fn();

vi.mock('@/database/repositories/knowledge', () => ({
  KnowledgeRepo: vi.fn(() => ({
    query: mockKnowledgeRepoQuery,
    queryRecent: mockKnowledgeRepoQueryRecent,
  })),
}));

vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn(() => ({
    findBySlug: mockDocumentModelFindBySlug,
  })),
}));

vi.mock('@/server/services/resource', () => ({
  AuthorizedResourceResolver: vi.fn(() => ({
    requireDocument: mockResolverRequireDocument,
    requireFile: mockResolverRequireFile,
    requireKnowledgeBase: mockResolverRequireKnowledgeBase,
  })),
  ResourceAuthorizer: vi.fn(() => ({
    assertCapability: mockResourceAuthorizerAssertCapability,
    filterVisibleDocumentIdsForList: mockFilterVisibleDocumentIdsForList,
    filterVisibleFileIdsForList: mockFilterVisibleFileIdsForList,
  })),
  TreeGuard: vi.fn(() => ({
    assertParentAssignment: mockTreeGuardAssertParentAssignment,
  })),
}));

describe('fileRouter', () => {
  let ctx: any;
  let caller: any;
  let mockFile: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFileModelCheckHash.mockResolvedValue({ isExist: true });
    mockFileModelCreate.mockResolvedValue({ id: 'test-id' });
    mockFileModelFindById.mockResolvedValue(undefined);
    mockFileModelQuery.mockResolvedValue([]);
    mockFileModelDelete.mockResolvedValue(undefined);
    mockFileModelDeleteMany.mockResolvedValue([]);
    mockFileModelClear.mockResolvedValue({} as any);
    mockFileModelUpdate.mockResolvedValue(undefined);

    mockResourceAuthorizerAssertCapability.mockResolvedValue({ canAccess: true });
    mockFilterVisibleDocumentIdsForList.mockImplementation(async (ids: string[]) => ids);
    mockFilterVisibleFileIdsForList.mockImplementation(async (ids: string[]) => ids);
    mockKnowledgeRepoQueryRecent.mockResolvedValue([]);
    mockTreeGuardAssertParentAssignment.mockResolvedValue(undefined);

    mockFile = {
      id: 'test-id',
      name: 'test.txt',
      url: 'test-url',
      createdAt: new Date(),
      updatedAt: new Date(),
      accessedAt: new Date(),
      userId: 'test-user',
      size: 100,
      fileType: 'text',
      metadata: {},
      fileHash: null,
      clientId: null,
      chunkTaskId: null,
      embeddingTaskId: null,
    };

    // Set default mock for getFileMetadata (security fix for GHSA-wrrr-8jcv-wjf5)
    mockFileServiceGetFileMetadata.mockResolvedValue({
      contentLength: 100,
      contentType: 'text/plain',
    });
    mockResourceModelEnsureResourceRegistry.mockResolvedValue({ resourceUid: 'res_test' });
    mockResourceModelFindSpaceBlobByHash.mockResolvedValue(undefined);
    mockResourceModelGetSpaceMemberRole.mockResolvedValue('owner');
    mockResourceModelUpsertSpaceBlob.mockResolvedValue({ id: 'blob_test' });
    mockFileModelFindExistingByBlobAndContext.mockResolvedValue(undefined);
    mockDocumentModelFindBySlug.mockResolvedValue(undefined);
    mockResolverRequireFile.mockResolvedValue(mockFile);
    mockResolverRequireKnowledgeBase.mockResolvedValue({ id: 'kb_test', spaceId: 'spc_test' });
    mockSpaceModelFindAccessibleSpaceById.mockResolvedValue(undefined);

    // Use actual context with default mocks
    ({ ctx, caller } = createCallerWithCtx());
  });

  describe('checkFileHash', () => {
    it('should return not found when no space blob exists', async () => {
      mockResourceModelFindSpaceBlobByHash.mockResolvedValue(undefined);
      await expect(caller.checkFileHash({ hash: 'test-hash' })).resolves.toEqual({
        isExist: false,
      });
    });

    it('should return not found when blob exists in db but storage object is missing', async () => {
      mockResourceModelFindSpaceBlobByHash.mockResolvedValue({
        fileType: 'text/plain',
        metadata: { filename: 'test.txt' },
        size: 100,
        storageKey: 'files/test.txt',
      });
      mockFileServiceGetFileMetadata.mockRejectedValue({ name: 'NoSuchKey' });

      await expect(caller.checkFileHash({ hash: 'test-hash' })).resolves.toEqual({
        isExist: false,
      });

      expect(mockFileServiceGetFileMetadata).toHaveBeenCalledWith('files/test.txt');
    });
  });

  describe('createFile', () => {
    it('should return same-origin proxy path /f/:id', async () => {
      mockFileModelCheckHash.mockResolvedValue({ isExist: false });
      mockFileModelCreate.mockResolvedValue({ id: 'new-file-id' });

      const result = await caller.createFile({
        hash: 'test-hash',
        fileType: 'text',
        name: 'test.txt',
        size: 100,
        url: 'files/test.txt',
        metadata: {},
      });

      expect(result).toEqual({
        id: 'new-file-id',
        url: '/f/new-file-id',
      });
    });

    it('should reuse existing file in the same knowledge context', async () => {
      mockFileModelFindExistingByBlobAndContext.mockResolvedValue({ id: 'existing-file-id' });

      const result = await caller.createFile({
        hash: 'test-hash',
        fileType: 'text/plain',
        knowledgeBaseId: 'kb_test',
        metadata: {},
        name: 'test.txt',
        size: 100,
        url: 'files/test.txt',
      });

      expect(result).toEqual({
        id: 'existing-file-id',
        url: '/f/existing-file-id',
      });
      expect(mockFileModelCreate).not.toHaveBeenCalled();
    });

    it('should use actual file size from S3 instead of client-provided size (security fix)', async () => {
      // Setup: S3 returns actual size of 5000 bytes
      mockFileServiceGetFileMetadata.mockResolvedValue({
        contentLength: 5000,
        contentType: 'text/plain',
      });
      mockFileModelCheckHash.mockResolvedValue({ isExist: false });
      mockFileModelCreate.mockResolvedValue({ id: 'new-file-id' });

      // Client claims file is only 100 bytes (attempting quota bypass)
      await caller.createFile({
        hash: 'test-hash',
        fileType: 'text',
        name: 'test.txt',
        size: 100, // Client-provided fake size
        url: 'files/test.txt',
        metadata: {},
      });

      // Verify getFileMetadata was called to get actual size
      expect(mockFileServiceGetFileMetadata).toHaveBeenCalledWith('files/test.txt');

      // Verify create was called with actual size from S3, not client-provided size
      expect(mockFileModelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_test',
          fileHash: null,
          size: 5000, // Actual size from S3, not 100
          spaceId: 'spc_test',
        }),
        false,
      );
    });

    it('should fallback to input size when getFileMetadata fails', async () => {
      mockFileModelCheckHash.mockResolvedValue({ isExist: false });
      mockFileModelCreate.mockResolvedValue({ id: 'new-file-id' });
      mockFileServiceGetFileMetadata.mockRejectedValue(new Error('File not found in S3'));

      const result = await caller.createFile({
        hash: 'test-hash',
        fileType: 'text',
        name: 'test.txt',
        size: 100,
        url: 'files/non-existent.txt',
        metadata: {},
      });

      expect(result).toEqual({
        id: 'new-file-id',
        url: '/f/new-file-id',
      });

      // Verify create was called with input size as fallback
      expect(mockFileModelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_test',
          fileHash: null,
          size: 100,
          spaceId: 'spc_test',
        }),
        false,
      );
    });

    it('should throw error when getFileMetadata fails and input size is negative', async () => {
      mockFileModelCheckHash.mockResolvedValue({ isExist: false });
      mockFileServiceGetFileMetadata.mockRejectedValue(new Error('File not found in S3'));

      await expect(
        caller.createFile({
          hash: 'test-hash',
          fileType: 'text',
          name: 'test.txt',
          size: -1,
          url: 'files/non-existent.txt',
          metadata: {},
        }),
      ).rejects.toThrow('File size cannot be negative');
    });

    it('should use input size when getFileMetadata returns contentLength less than 1', async () => {
      mockFileModelCheckHash.mockResolvedValue({ isExist: false });
      mockFileModelCreate.mockResolvedValue({ id: 'new-file-id' });
      mockFileServiceGetFileMetadata.mockResolvedValue({
        contentLength: 0,
        contentType: 'text/plain',
      });

      await caller.createFile({
        hash: 'test-hash',
        fileType: 'text',
        name: 'test.txt',
        size: 100,
        url: 'files/test.txt',
        metadata: {},
      });

      // Verify create was called with input size since contentLength < 1
      expect(mockFileModelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_test',
          fileHash: null,
          size: 100,
          spaceId: 'spc_test',
        }),
        false,
      );
    });

    it('should throw error when both getFileMetadata contentLength and input size are negative', async () => {
      mockFileModelCheckHash.mockResolvedValue({ isExist: false });
      mockFileServiceGetFileMetadata.mockResolvedValue({
        contentLength: -1,
        contentType: 'text/plain',
      });

      await expect(
        caller.createFile({
          hash: 'test-hash',
          fileType: 'text',
          name: 'test.txt',
          size: -1,
          url: 'files/test.txt',
          metadata: {},
        }),
      ).rejects.toThrow('File size cannot be negative');
    });
  });

  describe('findById', () => {
    it('should throw error when file not found', async () => {
      mockResolverRequireFile.mockResolvedValueOnce(null);

      await expect(caller.findById({ id: 'invalid-id' })).rejects.toThrow(TRPCError);
    });

    it('should return same-origin proxy path /f/:id', async () => {
      mockFileModelFindById.mockResolvedValue(mockFile);

      const result = await caller.findById({ id: 'test-id' });

      expect(result.url).toBe('/f/test-id');
    });
  });

  describe('getFileItemById', () => {
    it('should throw error when file not found', async () => {
      mockResolverRequireFile.mockResolvedValueOnce(null);

      await expect(caller.getFileItemById({ id: 'invalid-id' })).rejects.toThrow(TRPCError);
    });

    it('should return same-origin proxy path /f/:id', async () => {
      mockFileModelFindById.mockResolvedValue(mockFile);

      const result = await caller.getFileItemById({ id: 'test-id' });

      expect(result?.url).toBe('/f/test-id');
    });
  });

  describe('getFiles', () => {
    it('should handle fileModel.query returning undefined', async () => {
      mockFileModelQuery.mockResolvedValue(undefined);

      await expect(caller.getFiles({})).rejects.toThrow();
    });

    it('should return same-origin proxy path /f/:id for each file', async () => {
      const files = [
        { ...mockFile, id: 'file-1' },
        { ...mockFile, id: 'file-2' },
      ];
      mockFileModelQuery.mockResolvedValue(files);
      mockChunkCountByFileIds.mockResolvedValue([
        { id: 'file-1', count: 5 },
        { id: 'file-2', count: 3 },
      ]);

      const result = await caller.getFiles({});

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('/f/file-1');
      expect(result[1].url).toBe('/f/file-2');
    });

    it('should omit files without read_metadata visibility', async () => {
      const files = [
        { ...mockFile, id: 'file-1' },
        { ...mockFile, id: 'file-2' },
      ];
      mockFileModelQuery.mockResolvedValue(files);
      mockFilterVisibleFileIdsForList.mockResolvedValueOnce(['file-2']);
      mockChunkCountByFileIds.mockResolvedValue([{ id: 'file-2', count: 3 }]);

      const result = await caller.getFiles({});

      expect(mockFilterVisibleFileIdsForList).toHaveBeenCalledWith(['file-1', 'file-2']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('file-2');
    });
  });

  describe('getKnowledgeItems', () => {
    it('should reject inaccessible unscoped space queries', async () => {
      await expect(
        caller.getKnowledgeItems({
          spaceId: 'spc_shared',
        }),
      ).rejects.toThrow('SPACE_ACCESS_DENIED');
    });

    it('should allow shared knowledge base queries when the knowledge base itself is accessible', async () => {
      mockResolverRequireKnowledgeBase.mockResolvedValue({
        id: 'kb_shared',
        spaceId: 'spc_shared',
      });

      await expect(
        caller.getKnowledgeItems({
          knowledgeBaseId: 'kb_shared',
          spaceId: 'spc_shared',
        }),
      ).resolves.toEqual({
        hasMore: false,
        items: [],
      });

      expect(mockResolverRequireKnowledgeBase).toHaveBeenCalledWith('kb_shared', 'read_content');
      expect(mockKnowledgeRepoQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgeBaseId: 'kb_shared',
          limit: 51,
          spaceId: 'spc_shared',
        }),
      );
    });

    it('should return knowledge items with files and documents', async () => {
      const knowledgeItems = [
        {
          ...mockFile,
          chunkTaskId: 'chunk-1',
          embeddingTaskId: 'emb-1',
          id: 'file-1',
          sourceType: 'file' as const,
        },
        {
          editorData: { content: 'test' },
          id: 'doc-1',
          name: 'Document 1',
          sourceType: 'document' as const,
        },
      ];

      mockKnowledgeRepoQuery.mockResolvedValue(knowledgeItems);
      mockChunkCountByFileIds.mockResolvedValue([{ count: 10, id: 'file-1' }]);
      mockAsyncTaskFindByIds
        .mockResolvedValueOnce([{ error: null, id: 'chunk-1', status: AsyncTaskStatus.Success }])
        .mockResolvedValueOnce([{ error: null, id: 'emb-1', status: AsyncTaskStatus.Success }]);
      mockFileServiceGetFullFileUrl.mockResolvedValue('https://example.com/test-url');

      const result = await caller.getKnowledgeItems({});

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.items[0]).toMatchObject({
        chunkCount: 10,
        chunkingStatus: AsyncTaskStatus.Success,
        embeddingStatus: AsyncTaskStatus.Success,
        finishEmbedding: true,
        id: 'file-1',
        sourceType: 'file',
        url: '/f/file-1',
      });
      expect(result.items[1]).toMatchObject({
        chunkCount: null,
        chunkingError: null,
        chunkingStatus: null,
        editorData: { content: 'test' },
        embeddingError: null,
        embeddingStatus: null,
        finishEmbedding: false,
        id: 'doc-1',
        name: 'Document 1',
      });
    });
  });

  describe('removeAllFiles', () => {
    it('should clear files when personal space role allows write', async () => {
      await caller.removeAllFiles();

      expect(mockSpaceModelGetOrCreatePersonalSpace).toHaveBeenCalled();
      expect(mockResourceModelGetSpaceMemberRole).toHaveBeenCalledWith('spc_test');
      expect(mockFileModelClear).toHaveBeenCalled();
    });

    it('should reject when personal space membership is viewer-only', async () => {
      mockResourceModelGetSpaceMemberRole.mockResolvedValueOnce('viewer');

      await expect(caller.removeAllFiles()).rejects.toThrow(TRPCError);
      expect(mockFileModelClear).not.toHaveBeenCalled();
    });

    it('should reject when personal space membership is missing', async () => {
      mockResourceModelGetSpaceMemberRole.mockResolvedValueOnce(undefined);

      await expect(caller.removeAllFiles()).rejects.toThrow(TRPCError);
      expect(mockFileModelClear).not.toHaveBeenCalled();
    });
  });

  describe('removeFile', () => {
    it('should do nothing when file not found', async () => {
      ctx.fileModel.deleteAny.mockResolvedValue(null);

      await caller.removeFile({ id: 'invalid-id' });

      expect(ctx.fileService.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('removeFiles', () => {
    it('should do nothing when no files found', async () => {
      ctx.fileModel.deleteManyAny.mockResolvedValue([]);

      await caller.removeFiles({ ids: ['invalid-1', 'invalid-2'] });

      expect(ctx.fileService.deleteFiles).not.toHaveBeenCalled();
    });
  });

  describe('removeFileAsyncTask', () => {
    it('should do nothing when file not found', async () => {
      ctx.fileModel.findByIdAny.mockResolvedValue(null);

      await caller.removeFileAsyncTask({ id: 'test-id', type: 'chunk' });

      expect(ctx.asyncTaskModel.delete).not.toHaveBeenCalled();
    });

    it('should do nothing when task id is missing', async () => {
      ctx.fileModel.findByIdAny.mockResolvedValue(mockFile);

      await caller.removeFileAsyncTask({ id: 'test-id', type: 'embedding' });

      expect(ctx.asyncTaskModel.delete).not.toHaveBeenCalled();

      await caller.removeFileAsyncTask({ id: 'test-id', type: 'chunk' });

      expect(ctx.asyncTaskModel.delete).not.toHaveBeenCalled();
    });
  });
});

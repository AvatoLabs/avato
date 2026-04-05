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
  .mockResolvedValue({ contentUid: 'res_test' });
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
const mockFileModelQueryGovernanceRows = vi.fn();
const mockFileModelClear = vi.fn();
const mockFileModelSoftDeleteAny = vi.fn();
const mockFileModelSoftDeleteManyAny = vi.fn();
const mockFileModelUpdate = vi.fn();
const mockFileAssetModelFindByFileId = vi.fn();
const mockFileAssetModelFindByFileIds = vi.fn();
const mockFileAssetModelUpsert = vi.fn();
const mockFileServiceDeleteFile = vi.fn();
const mockFileServiceDeleteFiles = vi.fn();

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
    queryGovernanceRows: mockFileModelQueryGovernanceRows,
    clear: mockFileModelClear,
    softDeleteAny: mockFileModelSoftDeleteAny,
    softDeleteManyAny: mockFileModelSoftDeleteManyAny,
    update: mockFileModelUpdate,
    updateAny: mockFileModelUpdate,
  };

  const fileService = {
    getFullFileUrl: vi.fn().mockResolvedValue('full-url'),
    getFileMetadata: vi.fn().mockResolvedValue({ contentLength: 2048, contentType: 'text/plain' }),
    deleteFile: mockFileServiceDeleteFile,
    deleteFiles: mockFileServiceDeleteFiles,
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
  const fileAssetModel = {
    findByFileId: mockFileAssetModelFindByFileId,
    findByFileIds: mockFileAssetModelFindByFileIds,
    upsert: mockFileAssetModelUpsert,
  };

  const ctx = {
    serverDB: {} as any,
    userId: 'test-user',
    asyncTaskModel,
    chunkModel,
    documentModel,
    fileModel,
    fileAssetModel,
    fileService,
    knowledgeRepo,
    resourceAuthorizer: {
      assertCapability: mockResourceAuthorizerAssertCapability,
      filterVisibleDocumentIdsForList: mockFilterVisibleDocumentIdsForList,
      filterVisibleFileIdsForList: mockFilterVisibleFileIdsForList,
    },
    resourceModel: {
      ensureOwnerPermission: mockResourceModelEnsureOwnerPermission,
      ensureContentRegistry: mockResourceModelEnsureResourceRegistry,
      findSpaceBlobByHash: mockResourceModelFindSpaceBlobByHash,
      getSpaceMemberRole: mockResourceModelGetSpaceMemberRole,
      invalidateAuthzEpochsAfterRemoval: mockResourceModelInvalidateAuthzEpochsAfterRemoval,
      upsertSpaceBlob: mockResourceModelUpsertSpaceBlob,
    },
    resolver: {
      requireDocument: mockResolverRequireDocument,
      requireFile: mockResolverRequireFile,
      requireSourceSet: mockResolverRequireKnowledgeBase,
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
    queryGovernanceRows: mockFileModelQueryGovernanceRows,
    clear: mockFileModelClear,
    softDeleteAny: mockFileModelSoftDeleteAny,
    softDeleteManyAny: mockFileModelSoftDeleteManyAny,
    update: mockFileModelUpdate,
    updateAny: mockFileModelUpdate,
  })),
}));

vi.mock('@/database/models/fileAsset', () => ({
  FileAssetModel: vi.fn(() => ({
    findByFileId: mockFileAssetModelFindByFileId,
    findByFileIds: mockFileAssetModelFindByFileIds,
    upsert: mockFileAssetModelUpsert,
  })),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    ensureOwnerPermission: mockResourceModelEnsureOwnerPermission,
    ensureContentRegistry: mockResourceModelEnsureResourceRegistry,
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
    deleteFile: mockFileServiceDeleteFile,
    deleteFiles: mockFileServiceDeleteFiles,
    getFullFileUrl: mockFileServiceGetFullFileUrl,
    getFileMetadata: mockFileServiceGetFileMetadata,
  })),
}));

const mockKnowledgeRepoQuery = vi.fn().mockResolvedValue([]);
const mockKnowledgeRepoQueryRecent = vi.fn().mockResolvedValue([]);
const mockDocumentModelFindBySlug = vi.fn();
const mockDocumentModelFindBySlugInSpace = vi.fn();

vi.mock('@/database/repositories/knowledge', () => ({
  KnowledgeRepo: vi.fn(() => ({
    query: mockKnowledgeRepoQuery,
    queryRecent: mockKnowledgeRepoQueryRecent,
  })),
}));

vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn(() => ({
    findBySlug: mockDocumentModelFindBySlug,
    findBySlugInSpace: mockDocumentModelFindBySlugInSpace,
  })),
}));

vi.mock('@/server/services/content', () => ({
  AuthorizedResourceResolver: vi.fn(() => ({
    requireDocument: mockResolverRequireDocument,
    requireFile: mockResolverRequireFile,
    requireSourceSet: mockResolverRequireKnowledgeBase,
  })),
  ContentAuthorizer: vi.fn(() => ({
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
    mockFileModelQueryGovernanceRows.mockResolvedValue([]);
    mockFileModelDelete.mockResolvedValue(undefined);
    mockFileModelDeleteMany.mockResolvedValue([]);
    mockFileModelClear.mockResolvedValue([]);
    mockFileModelSoftDeleteAny.mockResolvedValue(undefined);
    mockFileModelSoftDeleteManyAny.mockResolvedValue([]);
    mockFileModelUpdate.mockResolvedValue(undefined);
    mockFileAssetModelFindByFileId.mockResolvedValue(null);
    mockFileAssetModelFindByFileIds.mockResolvedValue([]);
    mockFileAssetModelUpsert.mockResolvedValue({
      classification: 'general',
      createdBy: 'test-user',
      fileId: 'test-id',
      reviewStatus: 'draft',
      spaceId: 'spc_test',
      usagePolicy: 'internal',
    });

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
      spaceId: 'spc_test',
    };

    // Set default mock for getFileMetadata (security fix for GHSA-wrrr-8jcv-wjf5)
    mockFileServiceGetFileMetadata.mockResolvedValue({
      contentLength: 100,
      contentType: 'text/plain',
    });
    mockFileServiceDeleteFile.mockReset();
    mockFileServiceDeleteFiles.mockReset();
    mockResourceModelEnsureResourceRegistry.mockResolvedValue({ contentUid: 'res_test' });
    mockResourceModelFindSpaceBlobByHash.mockResolvedValue(undefined);
    mockResourceModelGetSpaceMemberRole.mockResolvedValue('owner');
    mockResourceModelUpsertSpaceBlob.mockResolvedValue({ id: 'blob_test' });
    mockFileModelFindExistingByBlobAndContext.mockResolvedValue(undefined);
    mockDocumentModelFindBySlug.mockResolvedValue(undefined);
    mockDocumentModelFindBySlugInSpace.mockResolvedValue(undefined);
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
        sourceSetId: 'kb_test',
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

    it('should resolve parent slugs within the provided space when creating a file', async () => {
      mockDocumentModelFindBySlugInSpace.mockResolvedValue({ id: 'folder-in-space' });
      mockResolverRequireDocument.mockResolvedValue({
        id: 'folder-in-space',
        spaceId: 'spc_shared',
      });
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_shared',
        membershipRole: 'editor',
      });

      await caller.createFile({
        hash: 'test-hash',
        fileType: 'text/plain',
        metadata: {},
        name: 'test.txt',
        parentId: 'shared-folder',
        size: 100,
        spaceId: 'spc_shared',
        url: 'files/test.txt',
      });

      expect(mockDocumentModelFindBySlugInSpace).toHaveBeenCalledWith(
        'shared-folder',
        'spc_shared',
      );
      expect(mockTreeGuardAssertParentAssignment).toHaveBeenCalledWith({
        currentSpaceId: 'spc_shared',
        parentId: 'folder-in-space',
      });
      expect(mockFileModelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'folder-in-space',
          spaceId: 'spc_shared',
        }),
        false,
      );
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

    it('should include lightweight asset status in file list rows', async () => {
      mockFileModelQuery.mockResolvedValue([{ ...mockFile, id: 'file-1' }]);
      mockChunkCountByFileIds.mockResolvedValue([{ id: 'file-1', count: 3 }]);
      mockFileAssetModelFindByFileIds.mockResolvedValue([
        {
          classification: 'brand',
          fileId: 'file-1',
          metadata: { version: { label: 'v2' } },
          reviewStatus: 'archived',
          usagePolicy: 'public',
        },
      ]);

      const result = await caller.getFiles({});

      expect(result[0]).toMatchObject({
        assetClassification: 'brand',
        assetPrimaryRenditionKind: null,
        assetPrimaryRenditionLabel: null,
        assetReviewStatus: 'archived',
        assetRenditionCount: null,
        assetUsagePolicy: 'public',
        assetVersionLabel: 'v2',
        id: 'file-1',
      });
      expect(mockFileAssetModelFindByFileIds).toHaveBeenCalledWith(['file-1']);
    });
  });

  describe('getFileAssetById', () => {
    it('should return the file asset sidecar for readable files', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'editor',
      });
      mockFileAssetModelFindByFileId.mockResolvedValue({
        classification: 'legal',
        fileId: 'test-id',
        reviewStatus: 'approved',
        spaceId: 'spc_test',
        usagePolicy: 'restricted',
      });

      await expect(caller.getFileAssetById({ id: 'test-id' })).resolves.toEqual({
        capabilities: { canApprove: false, canArchive: false, canEditGovernance: true },
        item: {
          classification: 'legal',
          fileId: 'test-id',
          reviewStatus: 'approved',
          spaceId: 'spc_test',
          usagePolicy: 'restricted',
        },
      });
      expect(mockFileAssetModelFindByFileId).toHaveBeenCalledWith('test-id');
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
          sourceSetId: 'kb_shared',
          spaceId: 'spc_shared',
        }),
      ).resolves.toEqual({
        hasMore: false,
        items: [],
      });

      expect(mockResolverRequireKnowledgeBase).toHaveBeenCalledWith('kb_shared', 'read_content');
      expect(mockKnowledgeRepoQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceSetId: 'kb_shared',
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
      mockFileAssetModelFindByFileIds.mockResolvedValue([
        {
          classification: 'product',
          fileId: 'file-1',
          metadata: {
            renditions: [{ kind: 'preview', label: 'Homepage' }, { kind: 'thumbnail' }],
            version: { label: '2026-Q2' },
          },
          reviewStatus: 'approved',
          usagePolicy: 'restricted',
        },
      ]);
      mockChunkCountByFileIds.mockResolvedValue([{ count: 10, id: 'file-1' }]);
      mockAsyncTaskFindByIds
        .mockResolvedValueOnce([{ error: null, id: 'chunk-1', status: AsyncTaskStatus.Success }])
        .mockResolvedValueOnce([{ error: null, id: 'emb-1', status: AsyncTaskStatus.Success }]);
      mockFileServiceGetFullFileUrl.mockResolvedValue('https://example.com/test-url');

      const result = await caller.getKnowledgeItems({});

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.items[0]).toMatchObject({
        assetClassification: 'product',
        assetPrimaryRenditionKind: 'preview',
        assetPrimaryRenditionLabel: 'Homepage',
        assetReviewStatus: 'approved',
        assetRenditionCount: 2,
        assetUsagePolicy: 'restricted',
        assetVersionLabel: '2026-Q2',
        chunkCount: 10,
        chunkingStatus: AsyncTaskStatus.Success,
        embeddingStatus: AsyncTaskStatus.Success,
        finishEmbedding: true,
        id: 'file-1',
        sourceType: 'file',
        url: '/f/file-1',
      });
      expect(mockFileAssetModelFindByFileIds).toHaveBeenCalledWith(['file-1']);
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

    it('should pass governance filters to knowledge repo and only process returned file items', async () => {
      mockKnowledgeRepoQuery.mockResolvedValue([
        {
          ...mockFile,
          fileId: 'file-1',
          id: 'file-1',
          sourceType: 'file' as const,
        },
      ]);
      mockFileAssetModelFindByFileIds.mockResolvedValue([
        {
          classification: 'brand',
          fileId: 'file-1',
          metadata: {},
          reviewStatus: 'approved',
          usagePolicy: 'restricted',
        },
      ]);
      mockChunkCountByFileIds.mockResolvedValue([{ count: 2, id: 'file-1' }]);
      mockAsyncTaskFindByIds.mockResolvedValue([]);

      const result = await caller.getKnowledgeItems({
        assetClassification: 'brand',
      });

      expect(mockKnowledgeRepoQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          assetClassification: 'brand',
          limit: 51,
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        assetClassification: 'brand',
        id: 'file-1',
        sourceType: 'file',
      });
      expect(mockFileAssetModelFindByFileIds).toHaveBeenCalledWith(['file-1']);
    });
  });

  describe('getKnowledgeGovernanceSummary', () => {
    it('should return dimension-specific visible governance counts', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({ id: 'spc_shared' });
      mockFileModelQueryGovernanceRows
        .mockResolvedValueOnce([
          { assetClassification: 'brand', id: 'file-1' },
          { assetClassification: null, id: 'file-2' },
        ])
        .mockResolvedValueOnce([
          { assetReviewStatus: 'approved', id: 'file-1' },
          { assetReviewStatus: null, id: 'file-2' },
        ])
        .mockResolvedValueOnce([
          { assetUsagePolicy: 'restricted', id: 'file-1' },
          { assetUsagePolicy: null, id: 'file-2' },
        ]);
      mockFilterVisibleFileIdsForList
        .mockResolvedValueOnce(['file-1', 'file-2'])
        .mockResolvedValueOnce(['file-1'])
        .mockResolvedValueOnce(['file-1', 'file-2']);

      const result = await caller.getKnowledgeGovernanceSummary({
        assetClassification: 'brand',
        assetReviewStatus: 'approved',
        spaceId: 'spc_shared',
      });

      expect(mockFileModelQueryGovernanceRows).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          assetClassification: undefined,
          assetReviewStatus: 'approved',
          spaceId: 'spc_shared',
        }),
      );
      expect(mockFileModelQueryGovernanceRows).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          assetClassification: 'brand',
          assetReviewStatus: undefined,
          spaceId: 'spc_shared',
        }),
      );
      expect(result).toEqual({
        classification: {
          counts: {
            brand: 1,
            finance: 0,
            general: 1,
            hr: 0,
            legal: 0,
            product: 0,
          },
          total: 2,
        },
        reviewStatus: {
          counts: {
            approved: 1,
            archived: 0,
            draft: 0,
          },
          total: 1,
        },
        usagePolicy: {
          counts: {
            internal: 1,
            public: 0,
            restricted: 1,
          },
          total: 2,
        },
      });
    });
  });

  describe('removeAllFiles', () => {
    it('should clear files when personal space role allows write', async () => {
      mockFileModelClear.mockResolvedValueOnce([
        {
          contentUid: 'res_clear_1',
          fileHash: null,
          id: 'file-clear-1',
          spaceId: 'spc_test',
          url: 'internal://clear-1',
        },
        {
          contentUid: 'res_clear_2',
          fileHash: 'hash-clear-2',
          id: 'file-clear-2',
          spaceId: 'spc_test',
          url: 'internal://clear-2',
        },
      ] as any);
      mockFileModelCheckHash.mockResolvedValueOnce({ isExist: false });

      await caller.removeAllFiles();

      expect(mockSpaceModelGetOrCreatePersonalSpace).toHaveBeenCalled();
      expect(mockResourceModelGetSpaceMemberRole).toHaveBeenCalledWith('spc_test');
      expect(mockFileModelClear).toHaveBeenCalledWith(false, {
        includeUnscoped: true,
        spaceId: 'spc_test',
      });
      expect(mockResourceModelInvalidateAuthzEpochsAfterRemoval).toHaveBeenCalledWith([
        { contentUid: 'res_clear_1', spaceId: 'spc_test' },
        { contentUid: 'res_clear_2', spaceId: 'spc_test' },
      ]);
      expect(mockFileServiceDeleteFile).toHaveBeenCalledWith('internal://clear-1');
      expect(mockFileServiceDeleteFiles).not.toHaveBeenCalled();
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

    it('should preserve hashed storage blobs when clear keeps global files', async () => {
      mockFileModelClear.mockResolvedValueOnce([
        {
          contentUid: 'res_clear_3',
          fileHash: 'hash-clear-3',
          id: 'file-clear-3',
          spaceId: 'spc_test',
          url: 'internal://hashed-clear-3',
        },
      ] as any);

      await caller.removeAllFiles();

      expect(mockFileServiceDeleteFile).not.toHaveBeenCalled();
      expect(mockFileServiceDeleteFiles).not.toHaveBeenCalled();
      expect(mockFileModelCheckHash).not.toHaveBeenCalled();
    });
  });

  describe('updateFile', () => {
    it('should resolve parent slugs within the current file space when moving a file', async () => {
      mockDocumentModelFindBySlugInSpace.mockResolvedValue({ id: 'folder-in-space' });

      await caller.updateFile({
        id: 'test-id',
        parentId: 'shared-folder',
      });

      expect(mockResolverRequireFile).toHaveBeenCalledWith('test-id', 'move');
      expect(mockDocumentModelFindBySlugInSpace).toHaveBeenCalledWith('shared-folder', 'spc_test');
      expect(mockTreeGuardAssertParentAssignment).toHaveBeenCalledWith({
        currentSpaceId: 'spc_test',
        parentId: 'folder-in-space',
      });
      expect(mockFileModelUpdate).toHaveBeenCalledWith('test-id', {
        parentId: 'folder-in-space',
      });
    });
  });

  describe('removeFile', () => {
    it('should do nothing when file not found', async () => {
      ctx.fileModel.softDeleteAny.mockResolvedValue(null);

      await caller.removeFile({ id: 'invalid-id' });

      expect(mockFileServiceDeleteFile).not.toHaveBeenCalled();
    });

    it('should preserve hashed storage blobs when REMOVE_GLOBAL_FILE is disabled', async () => {
      mockFileModelFindById.mockResolvedValue({
        ...mockFile,
        contentUid: 'res_test',
        fileHash: 'hash-1',
        id: 'test-id',
        spaceId: 'spc_test',
        url: 'storage/shared.txt',
      });
      mockFileModelDelete.mockResolvedValue(undefined);

      await caller.removeFile({ id: 'test-id', trash: false });

      expect(mockResourceAuthorizerAssertCapability).toHaveBeenCalledWith({
        capability: 'delete',
        id: 'test-id',
        kind: 'file',
      });
      expect(mockResourceModelInvalidateAuthzEpochsAfterRemoval).toHaveBeenCalledWith([
        { contentUid: 'res_test', spaceId: 'spc_test' },
      ]);
      expect(mockFileModelCheckHash).not.toHaveBeenCalled();
      expect(mockFileServiceDeleteFile).not.toHaveBeenCalled();
    });

    it('should still delete storage for hard-deleted files without a global hash', async () => {
      mockFileModelFindById.mockResolvedValue({
        ...mockFile,
        contentUid: 'res_test',
        fileHash: null,
        id: 'test-id',
        spaceId: 'spc_test',
        url: 'internal://document/doc-1',
      });
      mockFileModelDelete.mockResolvedValue(undefined);

      await caller.removeFile({ id: 'test-id', trash: false });

      expect(mockFileServiceDeleteFile).toHaveBeenCalledWith('internal://document/doc-1');
    });
  });

  describe('removeFiles', () => {
    it('should do nothing when no files found', async () => {
      ctx.fileModel.softDeleteManyAny.mockResolvedValue([]);

      await caller.removeFiles({ ids: ['invalid-1', 'invalid-2'] });

      expect(mockFileServiceDeleteFiles).not.toHaveBeenCalled();
    });

    it('should only delete storage keys that are truly orphaned', async () => {
      mockFileModelFindById
        .mockResolvedValueOnce({
          ...mockFile,
          contentUid: 'res_hashed',
          fileHash: 'hash-1',
          id: 'hashed',
          spaceId: 'spc_test',
          url: 'storage/shared.txt',
        })
        .mockResolvedValueOnce({
          ...mockFile,
          contentUid: 'res_internal',
          fileHash: null,
          id: 'internal',
          spaceId: 'spc_test',
          url: 'internal://document/doc-2',
        });
      mockFileModelDeleteMany.mockResolvedValue([]);

      await caller.removeFiles({ ids: ['hashed', 'internal'], trash: false });

      expect(mockResourceModelInvalidateAuthzEpochsAfterRemoval).toHaveBeenCalledWith([
        { contentUid: 'res_hashed', spaceId: 'spc_test' },
        { contentUid: 'res_internal', spaceId: 'spc_test' },
      ]);
      expect(mockFileServiceDeleteFiles).toHaveBeenCalledWith(['internal://document/doc-2']);
    });
  });

  describe('restoreFile', () => {
    it('should restore a soft-deleted file', async () => {
      const deletedFile = {
        ...mockFile,
        deletedAt: new Date(),
        contentUid: 'res_test',
        spaceId: 'spc_test',
      };
      ctx.fileModel.findByIdAny
        .mockResolvedValueOnce(deletedFile)
        .mockResolvedValueOnce({ ...deletedFile, deletedAt: null });

      const result = await caller.restoreFile({ id: 'test-id' });

      expect(ctx.fileModel.updateAny).toHaveBeenCalledWith('test-id', { deletedAt: null });
      expect(ctx.resourceModel.invalidateAuthzEpochsAfterRemoval).toHaveBeenCalledWith([
        { contentUid: 'res_test', spaceId: 'spc_test' },
      ]);
      expect(result).toMatchObject({ id: 'test-id' });
    });

    it('should throw when file is not in trash', async () => {
      ctx.fileModel.findByIdAny.mockResolvedValueOnce({ ...mockFile, deletedAt: null });

      await expect(caller.restoreFile({ id: 'test-id' })).rejects.toThrow(TRPCError);
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

  describe('updateFileAssetGovernance', () => {
    it('should update asset governance fields for writable spaces', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'admin',
      });

      await expect(
        caller.updateFileAssetGovernance({
          classification: 'brand',
          id: 'test-id',
          rightsOwner: 'Brand Team',
          usagePolicy: 'restricted',
        }),
      ).resolves.toMatchObject({
        capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
        item: {
          fileId: 'test-id',
          reviewStatus: 'draft',
          spaceId: 'spc_test',
        },
      });

      expect(mockFileAssetModelUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          classification: 'brand',
          createdBy: 'test-user',
          fileId: 'test-id',
          rightsOwner: 'Brand Team',
          spaceId: 'spc_test',
          usagePolicy: 'restricted',
        }),
      );
    });

    it('should allow editors to update metadata', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'editor',
      });

      await expect(
        caller.updateFileAssetGovernance({
          id: 'test-id',
          rightsOwner: 'Brand Team',
          usagePolicy: 'restricted',
        }),
      ).resolves.toMatchObject({
        capabilities: { canApprove: false, canArchive: false, canEditGovernance: true },
        item: {
          fileId: 'test-id',
          reviewStatus: 'draft',
          spaceId: 'spc_test',
        },
      });
    });

    it('should pass version and rendition metadata through the typed governance contract', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'admin',
      });

      await caller.updateFileAssetGovernance({
        id: 'test-id',
        metadata: {
          legacySource: 'brand-portal',
          renditions: ['preview', { kind: 'web', label: 'Web Ready' }],
          version: { label: 'v2', variantOf: 'Brand System 2026' },
        } as any,
      });

      expect(mockFileAssetModelUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'test-id',
          metadata: {
            legacySource: 'brand-portal',
            renditions: ['preview', { kind: 'web', label: 'Web Ready' }],
            version: { label: 'v2', variantOf: 'Brand System 2026' },
          },
        }),
      );
    });

    it('should preserve legacy top-level metadata fields through the governance contract', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'admin',
      });

      await caller.updateFileAssetGovernance({
        id: 'test-id',
        metadata: {
          legacyAuditTrail: { importedBy: 'legacy-script' },
          version: { label: 'v2' },
        } as any,
      });

      expect(mockFileAssetModelUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'test-id',
          metadata: {
            legacyAuditTrail: { importedBy: 'legacy-script' },
            version: { label: 'v2' },
          },
        }),
      );
    });

    it('should reject viewers from mutating file asset metadata', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'viewer',
      });

      await expect(
        caller.updateFileAssetGovernance({
          id: 'test-id',
          rightsOwner: 'Brand Team',
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'FILE_ASSET_WRITE_DENIED',
      });
      expect(mockFileAssetModelUpsert).not.toHaveBeenCalled();
    });
  });

  describe('approveFileAsset', () => {
    it('should allow admins to approve assets', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'admin',
      });

      await expect(caller.approveFileAsset({ id: 'test-id' })).resolves.toMatchObject({
        capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
        item: {
          fileId: 'test-id',
          reviewStatus: 'draft',
          spaceId: 'spc_test',
        },
      });

      expect(mockFileAssetModelUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'test-user',
          fileId: 'test-id',
          reviewStatus: 'approved',
          reviewedBy: 'test-user',
          spaceId: 'spc_test',
        }),
      );
    });

    it('should reject editors from approving assets', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'editor',
      });

      await expect(caller.approveFileAsset({ id: 'test-id' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'FILE_ASSET_APPROVE_DENIED',
      });
    });
  });

  describe('archiveFileAsset', () => {
    it('should allow admins to archive assets', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'admin',
      });

      await expect(caller.archiveFileAsset({ id: 'test-id' })).resolves.toMatchObject({
        capabilities: { canApprove: true, canArchive: true, canEditGovernance: true },
        item: {
          fileId: 'test-id',
          reviewStatus: 'draft',
          spaceId: 'spc_test',
        },
      });

      expect(mockFileAssetModelUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'test-user',
          fileId: 'test-id',
          reviewStatus: 'archived',
          reviewedBy: 'test-user',
          spaceId: 'spc_test',
        }),
      );
    });

    it('should reject editors from archiving assets', async () => {
      mockSpaceModelFindAccessibleSpaceById.mockResolvedValue({
        id: 'spc_test',
        membershipRole: 'editor',
      });

      await expect(caller.archiveFileAsset({ id: 'test-id' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'FILE_ASSET_ARCHIVE_DENIED',
      });
    });
  });
});

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fileRouter } from '@/server/routers/lambda/file';
import { AsyncTaskStatus } from '@/types/asyncTask';

// Patch: Use actual router context middleware to inject the correct models/services
function createCallerWithCtx(partialCtx: any = {}) {
  // All mocks are spies
  const fileModel = {
    checkHash: vi.fn().mockResolvedValue({ isExist: true }),
    create: vi.fn().mockResolvedValue({ id: 'test-id' }),
    findById: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue([]),
    clear: vi.fn().mockResolvedValue({} as any),
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
    query: vi.fn().mockResolvedValue([]),
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

const mockFileModelCheckHash = vi.fn();
const mockFileModelCreate = vi.fn();
const mockFileModelDelete = vi.fn();
const mockFileModelDeleteMany = vi.fn();
const mockFileModelFindById = vi.fn();
const mockFileModelQuery = vi.fn();
const mockFileModelClear = vi.fn();
const mockFileModelUpdate = vi.fn();

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(() => ({
    checkHash: mockFileModelCheckHash,
    create: mockFileModelCreate,
    delete: mockFileModelDelete,
    deleteMany: mockFileModelDeleteMany,
    findById: mockFileModelFindById,
    query: mockFileModelQuery,
    clear: mockFileModelClear,
    update: mockFileModelUpdate,
  })),
}));

const mockResourceModelEnsureOwnerPermission = vi.fn();
const mockResourceModelEnsureResourceRegistry = vi
  .fn()
  .mockResolvedValue({ resourceUid: 'res_test' });
const mockResourceModelFindSpaceBlobByHash = vi.fn();
const mockResourceModelUpsertSpaceBlob = vi.fn().mockResolvedValue({ id: 'blob_test' });

vi.mock('@/database/models/resource', () => ({
  ResourceModel: vi.fn(() => ({
    ensureOwnerPermission: mockResourceModelEnsureOwnerPermission,
    ensureResourceRegistry: mockResourceModelEnsureResourceRegistry,
    findSpaceBlobByHash: mockResourceModelFindSpaceBlobByHash,
    upsertSpaceBlob: mockResourceModelUpsertSpaceBlob,
  })),
}));

const mockSpaceModelFindAccessibleSpaceById = vi.fn();
const mockSpaceModelGetOrCreatePersonalSpace = vi.fn().mockResolvedValue({ id: 'spc_test' });

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
const mockDocumentModelFindBySlug = vi.fn();

vi.mock('@/database/repositories/knowledge', () => ({
  KnowledgeRepo: vi.fn(() => ({
    query: mockKnowledgeRepoQuery,
  })),
}));

vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn(() => ({
    findBySlug: mockDocumentModelFindBySlug,
  })),
}));

const mockResolverRequireDocument = vi.fn();
const mockResolverRequireFile = vi.fn();
const mockResolverRequireKnowledgeBase = vi.fn();
const mockResourceAuthorizerAssertCapability = vi.fn();
const mockTreeGuardAssertParentAssignment = vi.fn();

vi.mock('@/server/services/resource', () => ({
  AuthorizedResourceResolver: vi.fn(() => ({
    requireDocument: mockResolverRequireDocument,
    requireFile: mockResolverRequireFile,
    requireKnowledgeBase: mockResolverRequireKnowledgeBase,
  })),
  ResourceAuthorizer: vi.fn(() => ({
    assertCapability: mockResourceAuthorizerAssertCapability,
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
    mockResourceModelUpsertSpaceBlob.mockResolvedValue({ id: 'blob_test' });
    mockDocumentModelFindBySlug.mockResolvedValue(undefined);
    mockResolverRequireFile.mockResolvedValue(mockFile);
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
  });

  describe('createFile', () => {
    it('should throw if fileModel.checkHash returns undefined', async () => {
      ctx.fileModel.checkHash.mockResolvedValue(undefined);
      await expect(
        caller.createFile({
          hash: 'test-hash',
          fileType: 'text',
          name: 'test.txt',
          size: 100,
          url: 'test-url',
          metadata: {},
        }),
      ).rejects.toThrow();
    });

    it('should return proxy URL format ${APP_URL}/f/:id', async () => {
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
        url: 'https://lobehub.com/f/new-file-id',
      });
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
          size: 5000, // Actual size from S3, not 100
          spaceId: 'spc_test',
        }),
        true,
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
        url: 'https://lobehub.com/f/new-file-id',
      });

      // Verify create was called with input size as fallback
      expect(mockFileModelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_test',
          size: 100,
          spaceId: 'spc_test',
        }),
        true,
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
          size: 100,
          spaceId: 'spc_test',
        }),
        true,
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

    it('should return proxy URL format ${APP_URL}/f/:id', async () => {
      mockFileModelFindById.mockResolvedValue(mockFile);

      const result = await caller.findById({ id: 'test-id' });

      expect(result.url).toBe('https://lobehub.com/f/test-id');
    });
  });

  describe('getFileItemById', () => {
    it('should throw error when file not found', async () => {
      mockResolverRequireFile.mockResolvedValueOnce(null);

      await expect(caller.getFileItemById({ id: 'invalid-id' })).rejects.toThrow(TRPCError);
    });

    it('should return proxy URL format ${APP_URL}/f/:id', async () => {
      mockFileModelFindById.mockResolvedValue(mockFile);

      const result = await caller.getFileItemById({ id: 'test-id' });

      expect(result?.url).toBe('https://lobehub.com/f/test-id');
    });
  });

  describe('getFiles', () => {
    it('should handle fileModel.query returning undefined', async () => {
      mockFileModelQuery.mockResolvedValue(undefined);

      await expect(caller.getFiles({})).rejects.toThrow();
    });

    it('should return proxy URL format ${APP_URL}/f/:id for each file', async () => {
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
      expect(result[0].url).toBe('https://lobehub.com/f/file-1');
      expect(result[1].url).toBe('https://lobehub.com/f/file-2');
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
        url: 'https://lobehub.com/f/file-1',
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

  describe('removeFile', () => {
    it('should do nothing when file not found', async () => {
      ctx.fileModel.delete.mockResolvedValue(null);

      await caller.removeFile({ id: 'invalid-id' });

      expect(ctx.fileService.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('removeFiles', () => {
    it('should do nothing when no files found', async () => {
      ctx.fileModel.deleteMany.mockResolvedValue([]);

      await caller.removeFiles({ ids: ['invalid-1', 'invalid-2'] });

      expect(ctx.fileService.deleteFiles).not.toHaveBeenCalled();
    });
  });

  describe('removeFileAsyncTask', () => {
    it('should do nothing when file not found', async () => {
      ctx.fileModel.findById.mockResolvedValue(null);

      await caller.removeFileAsyncTask({ id: 'test-id', type: 'chunk' });

      expect(ctx.asyncTaskModel.delete).not.toHaveBeenCalled();
    });

    it('should do nothing when task id is missing', async () => {
      ctx.fileModel.findById.mockResolvedValue(mockFile);

      await caller.removeFileAsyncTask({ id: 'test-id', type: 'embedding' });

      expect(ctx.asyncTaskModel.delete).not.toHaveBeenCalled();

      await caller.removeFileAsyncTask({ id: 'test-id', type: 'chunk' });

      expect(ctx.asyncTaskModel.delete).not.toHaveBeenCalled();
    });
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@/types/asyncTask';

import { fileRouter } from '../file';

const {
  mockAsyncTaskModelFindById,
  mockAsyncTaskModelUpdate,
  mockEmbeddingModelBulkCreate,
  mockGetChunksTextByFileId,
  mockChunkModelBulkCreate,
  mockChunkModelBulkCreateUnstructuredChunks,
  mockChunkServiceAsyncEmbeddingFileChunks,
  mockChunkServiceChunkContent,
  mockFileModelDeleteAny,
  mockFileModelFindByIdAny,
  mockFileServiceGetFileByteArray,
  mockGetServerDefaultFilesConfig,
  mockGetServerDB,
  mockInitModelRuntimeFromDB,
  mockResourceAuthorizerAssertCapability,
  mockUserFindById,
  mockValidateInternalJWT,
} = vi.hoisted(() => ({
  mockAsyncTaskModelFindById: vi.fn(),
  mockAsyncTaskModelUpdate: vi.fn(),
  mockEmbeddingModelBulkCreate: vi.fn(),
  mockGetChunksTextByFileId: vi.fn(),
  mockChunkModelBulkCreate: vi.fn(),
  mockChunkModelBulkCreateUnstructuredChunks: vi.fn(),
  mockChunkServiceAsyncEmbeddingFileChunks: vi.fn(),
  mockChunkServiceChunkContent: vi.fn(),
  mockFileModelDeleteAny: vi.fn(),
  mockFileModelFindByIdAny: vi.fn(),
  mockFileServiceGetFileByteArray: vi.fn(),
  mockGetServerDefaultFilesConfig: vi.fn(),
  mockGetServerDB: vi.fn(),
  mockInitModelRuntimeFromDB: vi.fn(),
  mockResourceAuthorizerAssertCapability: vi.fn(),
  mockUserFindById: vi.fn(),
  mockValidateInternalJWT: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: mockGetServerDB,
}));

vi.mock('@/libs/trpc/utils/internalJwt', () => ({
  validateInternalJWT: mockValidateInternalJWT,
}));

vi.mock('@/database/models/user', () => ({
  UserModel: {
    findById: mockUserFindById,
  },
}));

vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn(() => ({
    findById: mockAsyncTaskModelFindById,
    update: mockAsyncTaskModelUpdate,
  })),
}));

vi.mock('@/database/models/chunk', () => ({
  ChunkModel: vi.fn(() => ({
    bulkCreate: mockChunkModelBulkCreate,
    bulkCreateUnstructuredChunks: mockChunkModelBulkCreateUnstructuredChunks,
    getChunksTextByFileId: mockGetChunksTextByFileId,
  })),
}));

vi.mock('@/database/models/embedding', () => ({
  EmbeddingModel: vi.fn(() => ({
    bulkCreate: mockEmbeddingModelBulkCreate,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn(() => ({
    deleteAny: mockFileModelDeleteAny,
    findByIdAny: mockFileModelFindByIdAny,
  })),
}));

vi.mock('@/database/models/resource', () => ({
  ResourceModel: vi.fn(() => ({
    invalidateAuthzEpochsAfterRemoval: vi.fn(),
  })),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => ({
    getFileByteArray: mockFileServiceGetFileByteArray,
  })),
}));

vi.mock('@/server/services/resource', () => ({
  ResourceAuthorizer: vi.fn(() => ({
    assertCapability: mockResourceAuthorizerAssertCapability,
  })),
}));

vi.mock('@/server/services/chunk', () => ({
  ChunkService: vi.fn(() => ({
    asyncEmbeddingFileChunks: mockChunkServiceAsyncEmbeddingFileChunks,
    chunkContent: mockChunkServiceChunkContent,
  })),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerDefaultFilesConfig: mockGetServerDefaultFilesConfig,
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: mockInitModelRuntimeFromDB,
}));

describe('async fileRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetServerDB.mockResolvedValue({});
    mockValidateInternalJWT.mockResolvedValue(true);
    mockUserFindById.mockResolvedValue({ id: 'test-user' });

    mockGetServerDefaultFilesConfig.mockReturnValue({
      embeddingModel: { model: 'text-embedding-3-small', provider: 'openai' },
    });
    mockInitModelRuntimeFromDB.mockResolvedValue({
      embeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    });
    mockResourceAuthorizerAssertCapability.mockResolvedValue(undefined);
    mockFileModelFindByIdAny.mockResolvedValue({
      fileType: 'text/plain',
      id: 'file-1',
      name: 'test.txt',
      url: 'files/test.txt',
    });
    mockFileServiceGetFileByteArray.mockRejectedValue({ Code: 'NoSuchKey', name: 'NoSuchKey' });
    mockAsyncTaskModelFindById.mockResolvedValue({ id: 'task-1', status: AsyncTaskStatus.Pending });
    mockAsyncTaskModelUpdate.mockResolvedValue(undefined);
    mockGetChunksTextByFileId.mockResolvedValue([{ id: 'chunk-1', text: 'hello world' }]);
    mockEmbeddingModelBulkCreate.mockResolvedValue(undefined);
  });

  it('should mark scanned pdfs with no extractable text as a specific chunking error', async () => {
    mockFileModelFindByIdAny.mockResolvedValue({
      fileType: 'application/pdf',
      id: 'file-1',
      name: 'scan.pdf',
      url: 'files/scan.pdf',
    });
    mockFileServiceGetFileByteArray.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockChunkServiceChunkContent.mockResolvedValue({ chunks: [] });

    const caller = fileRouter.createCaller({
      authorizationToken: 'test-token',
      userId: 'test-user',
    } as any);

    await expect(caller.parseFileToChunks({ fileId: 'file-1', taskId: 'task-1' })).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('failed to chunking'),
        success: false,
      }),
    );

    expect(mockAsyncTaskModelUpdate).toHaveBeenLastCalledWith('task-1', {
      error: new AsyncTaskError(
        AsyncTaskErrorType.NoExtractableText,
        'No extractable text was found in this PDF. It is likely a scanned or image-only PDF. Please run OCR first and try again.',
      ),
      status: AsyncTaskStatus.Error,
    });
    expect(mockChunkModelBulkCreate).not.toHaveBeenCalled();
  });

  it('should keep generic no chunk error for non-pdf files with empty chunk result', async () => {
    mockFileServiceGetFileByteArray.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockChunkServiceChunkContent.mockResolvedValue({ chunks: [] });

    const caller = fileRouter.createCaller({
      authorizationToken: 'test-token',
      userId: 'test-user',
    } as any);

    await expect(caller.parseFileToChunks({ fileId: 'file-1', taskId: 'task-1' })).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('failed to chunking'),
        success: false,
      }),
    );

    expect(mockAsyncTaskModelUpdate).toHaveBeenLastCalledWith('task-1', {
      error: new AsyncTaskError(
        AsyncTaskErrorType.NoChunkError,
        'No chunk found in this file. it may due to current chunking method can not parse file accurately',
      ),
      status: AsyncTaskStatus.Error,
    });
    expect(mockChunkModelBulkCreate).not.toHaveBeenCalled();
  });

  it('should mark the task as error and keep the file when storage object is missing', async () => {
    const caller = fileRouter.createCaller({
      authorizationToken: 'test-token',
      userId: 'test-user',
    } as any);

    await expect(caller.parseFileToChunks({ fileId: 'file-1', taskId: 'task-1' })).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('failed to chunking'),
        success: false,
      }),
    );

    expect(mockChunkServiceChunkContent).not.toHaveBeenCalled();
    expect(mockFileModelDeleteAny).not.toHaveBeenCalled();
    expect(mockAsyncTaskModelUpdate).toHaveBeenCalledWith('task-1', {
      error: new AsyncTaskError(
        AsyncTaskErrorType.ServerError,
        'File object is missing in storage. Please upload it again.',
      ),
      status: AsyncTaskStatus.Error,
    });
  });

  it('should preserve provider/model detail when embedding provider returns biz error', async () => {
    mockGetServerDefaultFilesConfig.mockReturnValue({
      embeddingModel: { model: 'kimi-k2.5', provider: 'moonshot' },
    });
    mockInitModelRuntimeFromDB.mockResolvedValue({
      embeddings: vi.fn().mockRejectedValue({
        body: {
          message: 'The API you are accessing is not open',
          type: 'permission_denied_error',
        },
        errorType: 'ProviderBizError',
        provider: 'moonshot',
      }),
    });

    const caller = fileRouter.createCaller({
      authorizationToken: 'test-token',
      userId: 'test-user',
    } as any);

    await expect(caller.embeddingChunks({ fileId: 'file-1', taskId: 'task-1' })).resolves.toEqual(
      expect.objectContaining({
        message: expect.stringContaining('failed to embedding'),
        success: false,
      }),
    );

    expect(mockAsyncTaskModelUpdate).toHaveBeenLastCalledWith('task-1', {
      error: new AsyncTaskError(
        AsyncTaskErrorType.ServerError,
        'moonshot/kimi-k2.5: The API you are accessing is not open',
      ),
      status: AsyncTaskStatus.Error,
    });
  });
});

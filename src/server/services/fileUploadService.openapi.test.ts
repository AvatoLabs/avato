import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileUploadService } from '../../../packages/openapi/src/services/file.service';

const mockChunkServiceAsyncEmbeddingFileChunks = vi.fn();
const mockChunkServiceAsyncParseFileToChunks = vi.fn();

vi.mock('@/config/db', () => ({
  serverDBEnv: {
    REMOVE_GLOBAL_FILE: false,
  },
}));

vi.mock('@/server/services/chunk', () => ({
  ChunkService: vi.fn(() => ({
    asyncEmbeddingFileChunks: mockChunkServiceAsyncEmbeddingFileChunks,
    asyncParseFileToChunks: mockChunkServiceAsyncParseFileToChunks,
  })),
}));

describe('FileUploadService', () => {
  let service: FileUploadService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new FileUploadService({} as any, 'user-1');

    vi.spyOn(service as any, 'resolveOperationPermission').mockResolvedValue({
      isPermitted: true,
      message: '',
    });

    vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValue({
      contentUid: 'res_test',
      fileHash: 'hash-1',
      fileType: 'text/plain',
      id: 'file-1',
      name: 'example.txt',
      spaceId: 'spc_test',
      url: 'internal://hashed-file',
    });

    (service as any).fileModel.deleteAny = vi.fn().mockResolvedValue(undefined);
    (service as any).fileModel.checkHash = vi.fn();
    (service as any).contentModel.invalidateAuthzEpochsAfterRemoval = vi
      .fn()
      .mockResolvedValue(undefined);
    (service as any).contentAuthorizer.assertCapability = vi
      .fn()
      .mockResolvedValue({ authzEpoch: 9 });
    (service as any).coreFileService.deleteFile = vi.fn().mockResolvedValue(undefined);

    mockChunkServiceAsyncParseFileToChunks.mockResolvedValue('task-chunk');
    mockChunkServiceAsyncEmbeddingFileChunks.mockResolvedValue('task-embed');
  });

  describe('deleteFile', () => {
    it('should preserve hashed storage blobs when global files are retained', async () => {
      await service.deleteFile('file-1');

      expect((service as any).fileModel.deleteAny).toHaveBeenCalledWith('file-1', false);
      expect((service as any).contentModel.invalidateAuthzEpochsAfterRemoval).toHaveBeenCalledWith([
        { contentUid: 'res_test', spaceId: 'spc_test' },
      ]);
      expect((service as any).fileModel.checkHash).not.toHaveBeenCalled();
      expect((service as any).coreFileService.deleteFile).not.toHaveBeenCalled();
    });

    it('should delete storage for files without a shared hash', async () => {
      vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValueOnce({
        contentUid: 'res_test_2',
        fileHash: null,
        id: 'file-2',
        spaceId: 'spc_test_2',
        url: 'internal://raw-file',
      });

      await service.deleteFile('file-2');

      expect((service as any).fileModel.deleteAny).toHaveBeenCalledWith('file-2', false);
      expect((service as any).coreFileService.deleteFile).toHaveBeenCalledWith(
        'internal://raw-file',
      );
    });
  });

  describe('createChunkTask', () => {
    it('should pass preview authz epoch into chunk and embedding tasks', async () => {
      const result = await service.createChunkTask('file-1', {
        autoEmbedding: true,
        skipExist: true,
      });

      expect((service as any).contentAuthorizer.assertCapability).toHaveBeenCalledWith({
        capability: 'preview_content',
        id: 'file-1',
        kind: 'file',
      });
      expect(mockChunkServiceAsyncParseFileToChunks).toHaveBeenCalledWith('file-1', true, {
        contentGuardAuthzEpoch: 9,
      });
      expect(mockChunkServiceAsyncEmbeddingFileChunks).toHaveBeenCalledWith('file-1', {
        contentGuardAuthzEpoch: 9,
      });
      expect(result).toEqual({
        chunkTaskId: 'task-chunk',
        embeddingTaskId: 'task-embed',
        fileId: 'file-1',
        message: 'Task created',
        success: true,
      });
    });
  });
});

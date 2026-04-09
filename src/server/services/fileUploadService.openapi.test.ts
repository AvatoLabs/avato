import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileUploadService } from '../../../packages/openapi/src/services/file.service';

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
    INTERNAL_APP_URL: 'http://internal.example.com',
  },
}));

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
    (service as any).contentModel.createAccessEvent = vi.fn().mockResolvedValue(undefined);
    (service as any).contentModel.invalidateAuthzEpochsAfterRemoval = vi
      .fn()
      .mockResolvedValue(undefined);
    (service as any).contentAuthorizer.assertCapability = vi.fn().mockResolvedValue({
      authzEpoch: 9,
      contentUid: 'res_test',
      matchedBy: 'space_member',
      spaceId: 'spc_test',
    });
    (service as any).contentAuthorizer.getDownloadableFileAccessByIdForList = vi
      .fn()
      .mockResolvedValue({
        'file-1': {
          contentUid: 'res_test',
          matchedBy: 'space_member',
          spaceId: 'spc_test',
        },
      });
    (service as any).coreFileService.deleteFile = vi.fn().mockResolvedValue(undefined);
    (service as any).coreFileService.getFullFileUrl = vi
      .fn()
      .mockResolvedValue('https://example.com/full-url');
    (service as any).blobProvider.createDownloadUrl = vi
      .fn()
      .mockResolvedValue('https://example.com/signed-url');

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

  describe('getFileUrl', () => {
    it('should record a file_url_issued access event for generated file urls', async () => {
      const result = await service.getFileUrl('file-1', { expiresIn: 120 });

      expect((service as any).contentAuthorizer.assertCapability).toHaveBeenCalledWith({
        capability: 'download_blob',
        id: 'file-1',
        kind: 'file',
      });
      expect((service as any).coreFileService.getFullFileUrl).toHaveBeenCalledWith(
        'internal://hashed-file',
        120,
      );
      expect((service as any).contentModel.createAccessEvent).toHaveBeenCalledWith({
        accessType: 'file_url_issued',
        contentUid: 'res_test',
        metadata: {
          expiresIn: 120,
          fileId: 'file-1',
          matchedBy: 'space_member',
          via: 'openapi_signed_url',
        },
        shareLinkId: null,
        sourceIp: null,
        spaceId: 'spc_test',
        userAgent: null,
      });
      expect(result).toMatchObject({
        expiresIn: 120,
        fileId: 'file-1',
        name: 'example.txt',
        url: 'https://example.com/full-url',
      });
    });

    it('should preserve stable proxy urls instead of re-signing them', async () => {
      vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValueOnce({
        contentUid: 'res_test',
        fileHash: 'hash-1',
        fileType: 'text/plain',
        id: 'file-1',
        name: 'example.txt',
        spaceId: 'spc_test',
        url: '/skills/skill-1/zip',
      });

      const result = await service.getFileUrl('file-1', { expiresIn: 120 });

      expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
      expect((service as any).blobProvider.createDownloadUrl).not.toHaveBeenCalled();
      expect(result.url).toBe('https://app.example.com/skills/skill-1/zip');
    });

    it('should preserve same-origin absolute stable proxy urls instead of re-signing them', async () => {
      vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValueOnce({
        contentUid: 'res_test',
        fileHash: 'hash-1',
        fileType: 'text/plain',
        id: 'file-1',
        name: 'example.txt',
        spaceId: 'spc_test',
        url: 'https://app.example.com/share/f/share-token-1',
      });

      const result = await service.getFileUrl('file-1', { expiresIn: 120 });

      expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
      expect((service as any).blobProvider.createDownloadUrl).not.toHaveBeenCalled();
      expect(result.url).toBe('https://app.example.com/share/f/share-token-1');
    });

    it('should not fail file url generation when access event logging fails', async () => {
      vi.mocked((service as any).contentModel.createAccessEvent).mockRejectedValueOnce(
        new Error('redis offline'),
      );

      await expect(service.getFileUrl('file-1', { expiresIn: 60 })).resolves.toMatchObject({
        expiresIn: 60,
        fileId: 'file-1',
        url: 'https://example.com/full-url',
      });
    });
  });

  describe('response url gating', () => {
    it('should record a file_url_issued access event for downloadable file detail responses', async () => {
      vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValueOnce({
        contentUid: 'res_image',
        fileHash: 'hash-image',
        fileType: 'image/png',
        id: 'file-image',
        name: 'image.png',
        spaceId: 'spc_test',
        url: 'internal://image-file',
      });
      vi.mocked((service as any).contentAuthorizer.assertCapability).mockResolvedValueOnce({
        contentUid: 'res_image',
        matchedBy: 'space_member',
        spaceId: 'spc_test',
      });

      const result = await service.getFileDetail('file-image');

      expect((service as any).coreFileService.getFullFileUrl).toHaveBeenCalledWith(
        'internal://image-file',
        undefined,
      );
      expect((service as any).contentModel.createAccessEvent).toHaveBeenCalledWith({
        accessType: 'file_url_issued',
        contentUid: 'res_image',
        metadata: {
          fileId: 'file-image',
          matchedBy: 'space_member',
          via: 'openapi_file_detail',
        },
        shareLinkId: null,
        sourceIp: null,
        spaceId: 'spc_test',
        userAgent: null,
      });
      expect(result.file.url).toBe('https://example.com/full-url');
      expect(result.file).not.toHaveProperty('fileHash');
    });

    it('should omit signed urls from file detail when blob download capability is denied', async () => {
      vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValueOnce({
        contentUid: 'res_image',
        fileHash: 'hash-image',
        fileType: 'image/png',
        id: 'file-image',
        name: 'image.png',
        spaceId: 'spc_test',
        url: 'internal://image-file',
      });
      vi.mocked((service as any).contentAuthorizer.assertCapability).mockRejectedValueOnce(
        new Error('forbidden'),
      );

      const result = await service.getFileDetail('file-image');

      expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
      expect((service as any).contentModel.createAccessEvent).not.toHaveBeenCalled();
      expect(result.file.url).toBe('');
    });

    it('should record file_url_issued access events for downloadable file list items', async () => {
      (service as any).chunkModel.countByFileIds = vi.fn().mockResolvedValue([]);
      (service as any).asyncTaskModel.findByIds = vi.fn().mockResolvedValue([]);
      (service as any).contentAuthorizer.getDownloadableFileAccessByIdForList = vi
        .fn()
        .mockResolvedValue({
          'file-1': {
            contentUid: 'res_file_1',
            matchedBy: 'space_member',
            spaceId: 'spc_test',
          },
        });

      const result = await (service as any).buildFileListResponse([
        {
          createdAt: new Date(),
          fileHash: 'hash-list',
          fileType: 'image/png',
          id: 'file-1',
          name: 'image.png',
          size: 1,
          source: 'upload',
          updatedAt: new Date(),
          url: 'internal://image-file',
          userId: 'user-1',
        },
      ]);

      expect(
        (service as any).contentAuthorizer.getDownloadableFileAccessByIdForList,
      ).toHaveBeenCalledWith(['file-1']);
      expect((service as any).contentModel.createAccessEvent).toHaveBeenCalledWith({
        accessType: 'file_url_issued',
        contentUid: 'res_file_1',
        metadata: {
          fileId: 'file-1',
          matchedBy: 'space_member',
          via: 'openapi_file_list',
        },
        shareLinkId: null,
        sourceIp: null,
        spaceId: 'spc_test',
        userAgent: null,
      });
      expect(result[0].url).toBe('https://example.com/full-url');
      expect(result[0]).not.toHaveProperty('fileHash');
    });

    it('should omit signed urls from file list items without download capability', async () => {
      (service as any).chunkModel.countByFileIds = vi.fn().mockResolvedValue([]);
      (service as any).asyncTaskModel.findByIds = vi.fn().mockResolvedValue([]);
      (service as any).contentAuthorizer.getDownloadableFileAccessByIdForList = vi
        .fn()
        .mockResolvedValue({});

      const result = await (service as any).buildFileListResponse([
        {
          createdAt: new Date(),
          fileHash: 'hash-list',
          fileType: 'image/png',
          id: 'file-1',
          name: 'image.png',
          size: 1,
          source: 'upload',
          updatedAt: new Date(),
          url: 'internal://image-file',
          userId: 'user-1',
        },
      ]);

      expect(
        (service as any).contentAuthorizer.getDownloadableFileAccessByIdForList,
      ).toHaveBeenCalledWith(['file-1']);
      expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
      expect((service as any).contentModel.createAccessEvent).not.toHaveBeenCalled();
      expect(result[0].url).toBe('');
    });

    it('should dedupe and aggregate users by blobId before fileHash', async () => {
      (service as any).chunkModel.countByFileIds = vi.fn().mockResolvedValue([]);
      (service as any).asyncTaskModel.findByIds = vi.fn().mockResolvedValue([]);
      (service as any).contentAuthorizer.getDownloadableFileAccessByIdForList = vi
        .fn()
        .mockResolvedValue({
          'file-1': {
            contentUid: 'res_file_1',
            matchedBy: 'space_member',
            spaceId: 'spc_test',
          },
        });
      (service as any).db = {
        query: {
          files: {
            findMany: vi.fn().mockResolvedValue([
              { blobId: 'blob-1', fileHash: null, id: 'file-1', userId: 'user-1' },
              { blobId: 'blob-1', fileHash: null, id: 'file-2', userId: 'user-2' },
            ]),
          },
          users: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'user-1', username: 'u1' },
              { id: 'user-2', username: 'u2' },
            ]),
          },
        },
      };

      const result = await (service as any).buildFileListResponse(
        [
          {
            blobId: 'blob-1',
            createdAt: new Date(),
            fileHash: null,
            fileType: 'image/png',
            id: 'file-1',
            name: 'image.png',
            size: 1,
            source: 'upload',
            updatedAt: new Date(),
            url: 'internal://image-file',
            userId: 'user-1',
          },
          {
            blobId: 'blob-1',
            createdAt: new Date(),
            fileHash: null,
            fileType: 'image/png',
            id: 'file-2',
            name: 'image copy.png',
            size: 1,
            source: 'upload',
            updatedAt: new Date(),
            url: 'internal://image-file-copy',
            userId: 'user-2',
          },
        ],
        false,
        true,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.users).toEqual([{ id: 'user-1', username: 'u1' }, { id: 'user-2', username: 'u2' }]);
    });

    it('should preserve same-origin stable proxy urls instead of re-signing them', async () => {
      vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValueOnce({
        contentUid: 'res_image',
        fileHash: 'hash-image',
        fileType: 'image/png',
        id: 'file-image',
        name: 'image.png',
        spaceId: 'spc_test',
        url: 'https://app.example.com/f/file-image',
      });
      vi.mocked((service as any).contentAuthorizer.assertCapability).mockResolvedValueOnce({
        contentUid: 'res_image',
        matchedBy: 'space_member',
        spaceId: 'spc_test',
      });

      const result = await service.getFileDetail('file-image');

      expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
      expect(result.file.url).toBe('https://app.example.com/f/file-image');
    });

    it('should upgrade relative stable proxy urls to absolute app urls without re-signing them', async () => {
      vi.spyOn(service as any, 'findFileByIdWithPermission').mockResolvedValueOnce({
        contentUid: 'res_image',
        fileHash: 'hash-image',
        fileType: 'image/png',
        id: 'file-image',
        name: 'image.png',
        spaceId: 'spc_test',
        url: '/eval/records/eval_1',
      });
      vi.mocked((service as any).contentAuthorizer.assertCapability).mockResolvedValueOnce({
        contentUid: 'res_image',
        matchedBy: 'space_member',
        spaceId: 'spc_test',
      });

      const result = await service.getFileDetail('file-image');

      expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
      expect(result.file.url).toBe('https://app.example.com/eval/records/eval_1');
    });
  });
});

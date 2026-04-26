import { TRPCError } from '@trpc/server';
import { sha256 } from 'js-sha256';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { TempFileManager } from '@/server/utils/tempFileManager';

import { FileService } from '../index';
import { STORAGE_OBJECT_MISSING_MESSAGE } from '../storageErrors';

const {
  mockEnsureContentRegistry,
  mockEnsureOwnerPermission,
  mockGetOrCreatePersonalSpace,
  mockRequireFile,
  mockUpsertSpaceBlob,
} = vi.hoisted(() => ({
  mockEnsureContentRegistry: vi.fn().mockResolvedValue({ contentUid: 'res_file_1' }),
  mockEnsureOwnerPermission: vi.fn().mockResolvedValue(undefined),
  mockGetOrCreatePersonalSpace: vi.fn().mockResolvedValue({ id: 'spc_personal_default' }),
  mockRequireFile: vi.fn(),
  mockUpsertSpaceBlob: vi.fn().mockResolvedValue({ id: 'blob_1' }),
}));

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

vi.mock('../impls', () => ({
  createFileServiceModule: () => ({
    deleteFile: vi.fn(),
    deleteFiles: vi.fn(),
    getFileContent: vi.fn(),
    getFileByteArray: vi.fn(),
    createPreSignedUrl: vi.fn(),
    createPreSignedUrlForPreview: vi.fn(),
    uploadContent: vi.fn(),
    getFullFileUrl: vi.fn(),
    getKeyFromFullUrl: vi.fn(),
    uploadMedia: vi.fn(),
  }),
}));

vi.mock('@/database/models/file');
vi.mock('@/database/models/document');

vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    getOrCreatePersonalSpace: mockGetOrCreatePersonalSpace,
  })),
}));

vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    ensureContentRegistry: mockEnsureContentRegistry,
    ensureOwnerPermission: mockEnsureOwnerPermission,
    invalidateAuthzEpochsAfterRemoval: vi.fn().mockResolvedValue(undefined),
    upsertSpaceBlob: mockUpsertSpaceBlob,
  })),
}));

vi.mock('@/server/services/content', () => ({
  AuthorizedResourceResolver: vi.fn().mockImplementation(() => ({
    requireFile: mockRequireFile,
  })),
}));

vi.mock('@/server/utils/tempFileManager');

vi.mock('@/utils/uuid', () => ({
  nanoid: () => 'test-id',
  uuid: () => 'uuid-test-id',
}));

describe('FileService', () => {
  let service: FileService;
  const mockDb = {} as any;
  const mockUserId = 'test-user';
  let mockFileModel: any;
  let mockDocumentModel: any;
  let mockTempManager: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mockFileModel = {
      deleteAny: vi.fn(),
      findById: vi.fn(),
    };
    mockDocumentModel = {
      findByIdAny: vi.fn(),
    };
    mockTempManager = {
      writeTempFile: vi.fn(),
      cleanup: vi.fn(),
    };
    vi.mocked(FileModel).mockImplementation(() => mockFileModel);
    vi.mocked(DocumentModel).mockImplementation(() => mockDocumentModel);
    vi.mocked(TempFileManager).mockImplementation(() => mockTempManager);

    // Mock console.error to test error logging
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockRequireFile.mockReset();
    mockGetOrCreatePersonalSpace.mockClear();
    mockEnsureContentRegistry.mockClear();
    mockEnsureOwnerPermission.mockClear();
    mockUpsertSpaceBlob.mockClear();
    service = new FileService(mockDb, mockUserId);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy?.mockRestore();
  });

  describe('downloadFileToLocal', () => {
    const mockFile = {
      id: 'test-file-id',
      name: 'test.txt',
      url: 'test-url',
    };

    it('should throw error if file not found', async () => {
      mockRequireFile.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'FILE_NOT_FOUND' }),
      );

      await expect(service.downloadFileToLocal('test-file-id')).rejects.toThrow(TRPCError);
    });

    it('should throw error if file content is empty', async () => {
      mockRequireFile.mockResolvedValue(mockFile);
      vi.mocked(service['impl'].getFileByteArray).mockResolvedValue(undefined as any);

      await expect(service.downloadFileToLocal('test-file-id')).rejects.toThrow(
        new TRPCError({ code: 'BAD_REQUEST', message: 'File content is empty' }),
      );
    });

    it('should keep file record and throw error if file is missing in storage', async () => {
      mockRequireFile.mockResolvedValue(mockFile);
      vi.mocked(service['impl'].getFileByteArray).mockRejectedValue({ Code: 'NoSuchKey' });

      await expect(service.downloadFileToLocal('test-file-id')).rejects.toThrow(
        new TRPCError({ code: 'BAD_REQUEST', message: STORAGE_OBJECT_MISSING_MESSAGE }),
      );

      expect(mockFileModel.deleteAny).not.toHaveBeenCalled();
    });

    it('should log error and rethrow for non-NoSuchKey errors', async () => {
      const originalError = new Error('Network error');
      mockRequireFile.mockResolvedValue(mockFile);
      vi.mocked(service['impl'].getFileByteArray).mockRejectedValue(originalError);

      await expect(service.downloadFileToLocal('test-file-id')).rejects.toThrow(
        new TRPCError({ code: 'BAD_REQUEST', message: 'File content is empty' }),
      );

      // 验证错误被记录到控制台
      expect(consoleErrorSpy).toHaveBeenCalledWith(originalError);
      // 验证没有调用删除操作（因为不是NoSuchKey错误）
      expect(mockFileModel.deleteAny).not.toHaveBeenCalled();
    });

    it('should handle getFileByteArray returning null content', async () => {
      mockRequireFile.mockResolvedValue(mockFile);
      vi.mocked(service['impl'].getFileByteArray).mockResolvedValue(null as any);

      await expect(service.downloadFileToLocal('test-file-id')).rejects.toThrow(
        new TRPCError({ code: 'BAD_REQUEST', message: 'File content is empty' }),
      );
    });

    it('should successfully download file to local', async () => {
      const mockContent = new Uint8Array([1, 2, 3]);
      const mockFilePath = '/tmp/test.txt';

      mockRequireFile.mockResolvedValue(mockFile);
      vi.mocked(service['impl'].getFileByteArray).mockResolvedValue(mockContent);
      mockTempManager.writeTempFile.mockResolvedValue(mockFilePath);

      const result = await service.downloadFileToLocal('test-file-id');

      expect(result).toEqual({
        cleanup: expect.any(Function),
        file: mockFile,
        filePath: mockFilePath,
      });

      expect(mockTempManager.writeTempFile).toHaveBeenCalledWith(mockContent, mockFile.name);
    });
  });

  it('should delegate deleteFile to implementation', async () => {
    const testKey = 'test-key';
    await service.deleteFile(testKey);

    expect(service['impl'].deleteFile).toHaveBeenCalledWith(testKey);
  });

  it('should delegate deleteFiles to implementation', async () => {
    const testKeys = ['key1', 'key2'];
    await service.deleteFiles(testKeys);

    expect(service['impl'].deleteFiles).toHaveBeenCalledWith(testKeys);
  });

  it('should delegate getFileContent to implementation', async () => {
    const testKey = 'test-key';
    const expectedContent = 'file content';
    vi.mocked(service['impl'].getFileContent).mockResolvedValue(expectedContent);

    const result = await service.getFileContent(testKey);

    expect(service['impl'].getFileContent).toHaveBeenCalledWith(testKey);
    expect(result).toBe(expectedContent);
  });

  it('should read internal document content directly from document model', async () => {
    mockDocumentModel.findByIdAny.mockResolvedValue({ content: '# Internal Markdown' });

    const result = await service.getFileContent('internal://document/doc-1');

    expect(result).toBe('# Internal Markdown');
    expect(service['impl'].getFileContent).not.toHaveBeenCalled();
  });

  it('should delegate getFileByteArray to implementation', async () => {
    const testKey = 'test-key';
    const expectedBytes = new Uint8Array([1, 2, 3]);
    vi.mocked(service['impl'].getFileByteArray).mockResolvedValue(expectedBytes);

    const result = await service.getFileByteArray(testKey);

    expect(service['impl'].getFileByteArray).toHaveBeenCalledWith(testKey);
    expect(result).toBe(expectedBytes);
  });

  it('should convert internal document content to bytes', async () => {
    mockDocumentModel.findByIdAny.mockResolvedValue({ content: '# Internal Markdown' });

    const result = await service.getFileByteArray('internal://document/doc-1');

    expect(new TextDecoder().decode(result)).toBe('# Internal Markdown');
    expect(service['impl'].getFileByteArray).not.toHaveBeenCalled();
  });

  it('should delegate createPreSignedUrl to implementation', async () => {
    const testKey = 'test-key';
    const expectedUrl = 'https://example.com/signed-url';
    vi.mocked(service['impl'].createPreSignedUrl).mockResolvedValue(expectedUrl);

    const result = await service.createPreSignedUrl(testKey);

    expect(service['impl'].createPreSignedUrl).toHaveBeenCalledWith(testKey);
    expect(result).toBe(expectedUrl);
  });

  it('should delegate createPreSignedUrlForPreview to implementation', async () => {
    const testKey = 'test-key';
    const expiresIn = 3600;
    const expectedUrl = 'https://example.com/preview-url';
    vi.mocked(service['impl'].createPreSignedUrlForPreview).mockResolvedValue(expectedUrl);

    const result = await service.createPreSignedUrlForPreview(testKey, expiresIn);

    expect(service['impl'].createPreSignedUrlForPreview).toHaveBeenCalledWith(testKey, expiresIn);
    expect(result).toBe(expectedUrl);
  });

  it('should delegate uploadContent to implementation', async () => {
    const testPath = 'test-path';
    const testContent = 'test content';

    await service.uploadContent(testPath, testContent);

    expect(service['impl'].uploadContent).toHaveBeenCalledWith(testPath, testContent);
  });

  it('should delegate getFullFileUrl to implementation', async () => {
    const testUrl = 'test-url';
    const expiresIn = 3600;
    const expectedUrl = 'https://example.com/full-url';
    vi.mocked(service['impl'].getFullFileUrl).mockResolvedValue(expectedUrl);

    const result = await service.getFullFileUrl(testUrl, expiresIn);

    expect(service['impl'].getFullFileUrl).toHaveBeenCalledWith(testUrl, expiresIn);
    expect(result).toBe(expectedUrl);
  });

  it('should reject internal document urls when requesting a fetchable file url', async () => {
    await expect(service.getFullFileUrl('internal://document/doc-1')).rejects.toThrow(
      new TRPCError({ code: 'BAD_REQUEST', message: 'INTERNAL_DOCUMENT_URL_NOT_FETCHABLE' }),
    );

    expect(service['impl'].getFullFileUrl).not.toHaveBeenCalled();
  });

  it('should delegate getKeyFromFullUrl to implementation', async () => {
    const testUrl = 'https://example.com/path/to/file.jpg';
    const expectedKey = 'path/to/file.jpg';
    vi.mocked(service['impl'].getKeyFromFullUrl).mockResolvedValue(expectedKey);

    const result = await service.getKeyFromFullUrl(testUrl);

    expect(service['impl'].getKeyFromFullUrl).toHaveBeenCalledWith(testUrl);
    expect(result).toBe(expectedKey);
  });

  it('should delegate uploadMedia to implementation', async () => {
    const testKey = 'test-key';
    const testBuffer = Buffer.from('test content');
    const expectedResult = { key: testKey };
    vi.mocked(service['impl'].uploadMedia).mockResolvedValue(expectedResult);

    const result = await service.uploadMedia(testKey, testBuffer);

    expect(service['impl'].uploadMedia).toHaveBeenCalledWith(testKey, testBuffer);
    expect(result).toBe(expectedResult);
  });

  it('should create opaque user blob paths under the personal space', async () => {
    const result = await service.createOpaqueUserBlobPath('mcp-content/images', 'png');

    expect(mockGetOrCreatePersonalSpace).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      key: 'v2/spaces/spc_personal_default/blobs/mcp-content/images/test-id.png',
      spaceId: 'spc_personal_default',
    });
  });

  it('should create opaque user blob paths under an explicit space', async () => {
    const result = await service.createOpaqueUserBlobPath(
      'rag-eval-records',
      'jsonl',
      'spc_team_ops',
    );

    expect(mockGetOrCreatePersonalSpace).not.toHaveBeenCalled();
    expect(result).toEqual({
      key: 'v2/spaces/spc_team_ops/blobs/rag-eval-records/test-id.jsonl',
      spaceId: 'spc_team_ops',
    });
  });

  describe('createFileRecord', () => {
    beforeEach(() => {
      mockFileModel.create = vi.fn();
      mockFileModel.update = vi.fn().mockResolvedValue(undefined);
    });

    it('should return same-origin proxy path /f/:id', async () => {
      mockFileModel.create.mockResolvedValue({ id: 'new-file-id' });

      const result = await service.createFileRecord({
        fileType: 'image/png',
        name: 'test.png',
        sha256: 'test-hash',
        size: 1024,
        storageKey: 'files/test.png',
      });

      expect(mockGetOrCreatePersonalSpace).toHaveBeenCalled();
      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_1',
          fileHash: null,
          spaceId: 'spc_personal_default',
        }),
        false,
      );
      expect(mockUpsertSpaceBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          sha256: 'test-hash',
          spaceId: 'spc_personal_default',
          status: 'ready',
          storageKey: 'files/test.png',
        }),
      );
      expect(mockEnsureContentRegistry).toHaveBeenCalledWith({
        createdBy: mockUserId,
        kind: 'file',
        localId: 'new-file-id',
        spaceId: 'spc_personal_default',
      });
      expect(mockFileModel.update).toHaveBeenCalledWith(
        'new-file-id',
        expect.objectContaining({
          blobId: 'blob_1',
          contentUid: 'res_file_1',
          spaceId: 'spc_personal_default',
        }),
      );
      expect(mockEnsureOwnerPermission).toHaveBeenCalledWith({
        contentUid: 'res_file_1',
        spaceId: 'spc_personal_default',
      });
      expect(result).toEqual({
        fileId: 'new-file-id',
        url: '/f/new-file-id',
      });
    });

    it('should use custom id when provided', async () => {
      mockFileModel.create.mockResolvedValue({ id: 'custom-id' });

      const result = await service.createFileRecord({
        fileType: 'image/png',
        id: 'custom-id',
        name: 'test.png',
        sha256: 'test-hash',
        size: 1024,
        storageKey: 'files/test.png',
      });

      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_1',
          fileHash: null,
          id: 'custom-id',
          spaceId: 'spc_personal_default',
        }),
        false,
      );
      expect(result).toEqual({
        fileId: 'custom-id',
        url: '/f/custom-id',
      });
    });

    it('should create space-scoped file rows without global_files when a space is resolved', async () => {
      mockFileModel.create.mockResolvedValue({ id: 'file-id' });

      await service.createFileRecord({
        fileType: 'text/plain',
        name: 'test.txt',
        sha256: 'any-hash',
        size: 100,
        storageKey: 'files/test.txt',
      });

      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_1',
          fileHash: null,
          spaceId: 'spc_personal_default',
        }),
        false,
      );
      expect(mockUpsertSpaceBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          sha256: 'any-hash',
          spaceId: 'spc_personal_default',
        }),
      );
    });

    it('should upsert space_blobs when spaceId is set', async () => {
      mockFileModel.create.mockResolvedValue({ id: 'file-id' });

      await service.createFileRecord({
        fileType: 'text/plain',
        name: 'test.txt',
        sha256: 'h1',
        size: 100,
        spaceId: 'spc_1',
        storageKey: 'files/test.txt',
      });

      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_1',
          fileHash: null,
          spaceId: 'spc_1',
        }),
        false,
      );
      expect(mockUpsertSpaceBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          sha256: 'h1',
          spaceId: 'spc_1',
          status: 'ready',
          storageKey: 'files/test.txt',
        }),
      );
    });

    it('should preserve file context fields when creating a space-scoped file row', async () => {
      mockFileModel.create.mockResolvedValue({ id: 'file-id' });

      await service.createFileRecord({
        blobId: 'blob_existing',
        blobMetadata: { source: 'lambda_upload' },
        fileType: 'text/plain',
        metadata: { path: 'files/test.txt' } as any,
        name: 'test.txt',
        parentId: 'folder-1',
        sha256: 'ctx-hash',
        source: 'user_file_upload',
        sourceSetId: 'kb_1',
        size: 100,
        spaceId: 'spc_1',
        storageKey: 'files/test.txt',
      });

      expect(mockUpsertSpaceBlob).not.toHaveBeenCalled();
      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          blobId: 'blob_existing',
          metadata: { path: 'files/test.txt' },
          parentId: 'folder-1',
          source: 'user_file_upload',
          sourceSetId: 'kb_1',
          spaceId: 'spc_1',
        }),
        false,
      );
      expect(mockEnsureContentRegistry).toHaveBeenCalledWith({
        createdBy: mockUserId,
        kind: 'file',
        localId: 'file-id',
        spaceId: 'spc_1',
      });
      expect(mockEnsureOwnerPermission).toHaveBeenCalledWith({
        contentUid: 'res_file_1',
        spaceId: 'spc_1',
      });
    });

    it('should reject null spaceId and require a space-scoped destination', async () => {
      await expect(
        service.createFileRecord({
          fileType: 'text/plain',
          name: 'test.txt',
          sha256: 'h2',
          size: 10,
          spaceId: null,
          storageKey: 'files/x.txt',
        }),
      ).rejects.toThrow(
        'createFileRecord requires a space-scoped destination; use createGlobalFile instead',
      );

      expect(mockGetOrCreatePersonalSpace).not.toHaveBeenCalled();
      expect(mockFileModel.create).not.toHaveBeenCalled();
      expect(mockUpsertSpaceBlob).not.toHaveBeenCalled();
      expect(mockEnsureContentRegistry).not.toHaveBeenCalled();
      expect(mockEnsureOwnerPermission).not.toHaveBeenCalled();
    });
  });

  describe('createFileRecordFromStorageObject', () => {
    it('should compute the real sha256 from stored bytes before creating the record', async () => {
      const storedBytes = new Uint8Array([1, 2, 3, 4]);
      const createFileRecordSpy = vi.spyOn(service, 'createFileRecord').mockResolvedValue({
        fileId: 'file-1',
        url: '/f/file-1',
      });
      vi.mocked(service['impl'].getFileByteArray).mockResolvedValue(storedBytes);

      const result = await service.createFileRecordFromStorageObject({
        fileType: 'application/pdf',
        name: 'report.pdf',
        spaceId: 'spc_team',
        storageKey: 'v2/spaces/spc_team/blobs/exports/report.pdf',
      });

      expect(createFileRecordSpy).toHaveBeenCalledWith({
        fileType: 'application/pdf',
        name: 'report.pdf',
        sha256: sha256(storedBytes),
        size: storedBytes.byteLength,
        spaceId: 'spc_team',
        storageKey: 'v2/spaces/spc_team/blobs/exports/report.pdf',
      });
      expect(result).toEqual({
        fileId: 'file-1',
        sha256: sha256(storedBytes),
        size: storedBytes.byteLength,
        url: '/f/file-1',
      });

      createFileRecordSpy.mockRestore();
    });
  });

  describe('createGlobalFile', () => {
    beforeEach(() => {
      mockFileModel.checkHash = vi.fn();
      mockFileModel.createGlobalFile = vi.fn();
    });

    it('should create global file with metadata without preflight hash checks', async () => {
      mockFileModel.createGlobalFile.mockResolvedValue([{ hashId: 'test-hash' }]);

      const result = await service.createGlobalFile({
        fileType: 'text/markdown',
        metadata: {
          dirname: 'skills/source_files/abc123',
          filename: 'README.md',
          path: 'skills/source_files/abc123/README.md',
        },
        sha256: 'test-hash',
        size: 1024,
        storageKey: 'skills/source_files/abc123/README.md',
      });

      expect(result).toEqual({ sha256: 'test-hash' });
      expect(mockFileModel.checkHash).not.toHaveBeenCalled();
      expect(mockFileModel.createGlobalFile).toHaveBeenCalledWith({
        creator: mockUserId,
        fileType: 'text/markdown',
        hashId: 'test-hash',
        metadata: {
          dirname: 'skills/source_files/abc123',
          filename: 'README.md',
          path: 'skills/source_files/abc123/README.md',
        },
        size: 1024,
        url: 'skills/source_files/abc123/README.md',
      });
    });

    it('should still attempt createGlobalFile when hash may already exist', async () => {
      mockFileModel.createGlobalFile.mockResolvedValue([]);

      const result = await service.createGlobalFile({
        fileType: 'text/plain',
        sha256: 'existing-hash',
        size: 100,
        storageKey: 'some/path.txt',
      });

      expect(result).toEqual({ sha256: 'existing-hash' });
      expect(mockFileModel.checkHash).not.toHaveBeenCalled();
      expect(mockFileModel.createGlobalFile).toHaveBeenCalledWith({
        creator: mockUserId,
        fileType: 'text/plain',
        hashId: 'existing-hash',
        metadata: undefined,
        size: 100,
        url: 'some/path.txt',
      });
    });

    it('should work without metadata', async () => {
      mockFileModel.createGlobalFile.mockResolvedValue([{ hashId: 'test-hash' }]);

      await service.createGlobalFile({
        fileType: 'text/plain',
        sha256: 'test-hash',
        size: 100,
        storageKey: 'some/path.txt',
      });

      expect(mockFileModel.checkHash).not.toHaveBeenCalled();
      expect(mockFileModel.createGlobalFile).toHaveBeenCalledWith({
        creator: mockUserId,
        fileType: 'text/plain',
        hashId: 'test-hash',
        metadata: undefined,
        size: 100,
        url: 'some/path.txt',
      });
    });
  });

  describe('uploadFromUrl', () => {
    it('should preserve explicit name and spaceId when creating a file record', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('hello world', {
          headers: { 'content-type': 'image/png' },
          status: 200,
        }),
      );
      vi.mocked(service['impl'].uploadMedia).mockResolvedValue({
        key: 'v2/spaces/spc_team/blobs/ai-agent-inputs/opq_1.png',
      });
      const createFileRecordSpy = vi.spyOn(service, 'createFileRecord').mockResolvedValue({
        fileId: 'file-1',
        url: '/f/file-1',
      });

      const result = await service.uploadFromUrl(
        'https://cdn.example.com/photo.png',
        'v2/spaces/spc_team/blobs/ai-agent-inputs/opq_1.png',
        {
          name: 'photo.png',
          spaceId: 'spc_team',
        },
      );

      expect(createFileRecordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'image/png',
          name: 'photo.png',
          spaceId: 'spc_team',
          storageKey: 'v2/spaces/spc_team/blobs/ai-agent-inputs/opq_1.png',
        }),
      );
      expect(result).toEqual({
        fileId: 'file-1',
        key: 'v2/spaces/spc_team/blobs/ai-agent-inputs/opq_1.png',
        url: '/f/file-1',
      });

      createFileRecordSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it('should reject non-canonical storage keys', async () => {
      await expect(
        service.uploadFromUrl('https://cdn.example.com/photo.png', 'files/test-user/legacy.png'),
      ).rejects.toThrow('uploadFromUrl only accepts canonical v2/spaces/{spaceId}/blobs keys');
    });
  });

  describe('uploadBase64', () => {
    it('should reject non-canonical storage keys', async () => {
      await expect(service.uploadBase64('aGVsbG8=', 'files/test-user/legacy.png')).rejects.toThrow(
        'uploadBase64 only accepts canonical v2/spaces/{spaceId}/blobs keys',
      );
    });
  });
});

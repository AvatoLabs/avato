import { type LobeChatDatabase } from '@lobechat/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';

import { ChunkService } from '../../chunk';
import { FileService } from '../../file';
import { DocumentService } from '../index';

const {
  mockAssertCapability,
  mockAsyncParseFileToChunks,
  mockEnsureOwnerPermission,
  mockEnsureContentRegistry,
  mockFilterVisibleDocumentIdsForList,
  mockGetOrCreatePersonalSpace,
  mockRequireDocument,
  mockRequireFile,
} = vi.hoisted(() => ({
  mockAssertCapability: vi.fn(),
  mockAsyncParseFileToChunks: vi.fn(),
  mockEnsureOwnerPermission: vi.fn(),
  mockEnsureContentRegistry: vi.fn().mockResolvedValue({ contentUid: 'res_test' }),
  mockFilterVisibleDocumentIdsForList: vi.fn(),
  mockGetOrCreatePersonalSpace: vi.fn().mockResolvedValue({ id: 'spc_test' }),
  mockRequireDocument: vi.fn().mockResolvedValue({ id: 'docs_test', spaceId: 'spc_test' }),
  mockRequireFile: vi.fn().mockResolvedValue({ id: 'file-1' }),
}));

vi.mock('@/database/models/document');
vi.mock('@/database/models/file');
vi.mock('../../chunk', () => ({
  ChunkService: vi.fn(() => ({
    asyncParseFileToChunks: mockAsyncParseFileToChunks,
  })),
}));
vi.mock('@/config/db', () => ({
  serverDBEnv: {
    REMOVE_GLOBAL_FILE: false,
  },
}));
vi.mock('@/database/models/content', () => ({
  ContentModel: vi.fn(() => ({
    ensureOwnerPermission: mockEnsureOwnerPermission,
    ensureContentRegistry: mockEnsureContentRegistry,
    invalidateAuthzEpochsAfterRemoval: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: vi.fn().mockResolvedValue(undefined),
    getOrCreatePersonalSpace: mockGetOrCreatePersonalSpace,
  })),
}));
vi.mock('../../file');

vi.mock('../../content', () => ({
  AuthorizedResourceResolver: vi.fn(() => ({
    requireDocument: mockRequireDocument,
    requireFile: mockRequireFile,
    requireSourceSet: vi.fn().mockResolvedValue({ id: 'kb_test', spaceId: 'spc_test' }),
  })),
  ContentAuthorizer: vi.fn(() => ({
    assertCapability: mockAssertCapability,
    filterVisibleDocumentIdsForList: mockFilterVisibleDocumentIdsForList,
    getAccessMatch: vi.fn().mockResolvedValue({
      authzEpoch: 1,
      canAccess: true,
      contentUid: 'res_test',
      spaceId: 'spc_test',
    }),
  })),
  TreeGuard: vi.fn(() => ({
    assertParentAssignment: vi.fn(),
  })),
}));
vi.mock('@lobechat/file-loaders', () => ({
  loadFile: vi.fn(),
}));
vi.mock('debug', () => ({
  default: () => vi.fn(),
}));

const { loadFile } = await import('@lobechat/file-loaders');

describe('DocumentService', () => {
  let service: DocumentService;
  let mockDb: LobeChatDatabase;
  let mockDocumentModel: any;
  let mockFileModel: any;
  let mockFileService: any;
  const userId = 'test-user-id';

  beforeEach(() => {
    mockDb = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      query: {
        documents: {
          findFirst: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
        files: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    } as any;

    mockDocumentModel = {
      create: vi.fn(),
      delete: vi.fn(),
      deleteManyAny: vi.fn(),
      findByFileId: vi.fn(),
      findById: vi.fn(),
      findByIdAny: vi.fn(),
      hardDeleteManyAny: vi.fn(),
      query: vi.fn(),
      queryIds: vi.fn(),
      restoreManyAny: vi.fn(),
      update: vi.fn(),
      updateAny: vi.fn(),
    };

    mockFileModel = {
      checkHash: vi.fn(),
      clearFileChunks: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteManyAny: vi.fn(),
      findById: vi.fn(),
      hasFilesForBlob: vi.fn(),
      softDeleteManyAny: vi.fn(),
      update: vi.fn(),
      updateAny: vi.fn(),
    };

    mockFileService = {
      deleteFiles: vi.fn(),
      downloadFileToLocal: vi.fn(),
    };

    vi.mocked(DocumentModel).mockImplementation(() => mockDocumentModel);
    vi.mocked(FileModel).mockImplementation(() => mockFileModel);
    vi.mocked(ChunkService).mockImplementation(
      () =>
        ({
          asyncParseFileToChunks: mockAsyncParseFileToChunks,
        }) as any,
    );
    vi.mocked(FileService).mockImplementation(() => mockFileService);

    service = new DocumentService(mockDb, userId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createDocument', () => {
    it('should create a document without sourceSet', async () => {
      const mockDoc = { id: 'doc-1', title: 'Test Doc' };
      mockDocumentModel.create.mockResolvedValue(mockDoc);

      const result = await service.createDocument({
        title: 'Test Doc',
        editorData: { blocks: [] },
        content: 'Hello world',
      });

      expect(result).toEqual(mockDoc);
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Doc',
          filename: 'Test Doc',
          content: 'Hello world',
          totalCharCount: 'Hello world'.length,
          totalLineCount: 1,
          fileId: null,
          source: 'document',
          sourceType: 'api',
        }),
      );
      // Should not create a file record when no sourceSetId
      expect(mockFileModel.create).not.toHaveBeenCalled();
    });

    it('should calculate character and line counts correctly', async () => {
      const content = 'line1\nline2\nline3';
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });

      await service.createDocument({
        title: 'Test',
        editorData: {},
        content,
      });

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCharCount: content.length,
          totalLineCount: 3,
        }),
      );
    });

    it('should handle empty content with 0 counts', async () => {
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });

      await service.createDocument({
        title: 'Test',
        editorData: {},
      });

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCharCount: 0,
          totalLineCount: 0,
        }),
      );
    });

    it('should create a file record when sourceSetId is provided and fileType is not folder', async () => {
      const mockFile = { id: 'file-1' };
      const mockDoc = { id: 'doc-1', title: 'Test' };
      mockFileModel.create.mockResolvedValue(mockFile);
      mockDocumentModel.create.mockResolvedValue(mockDoc);

      const result = await service.createDocument({
        title: 'Test',
        editorData: {},
        content: 'Content',
        sourceSetId: 'kb-1',
      });

      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
          sourceSetId: 'kb-1',
          fileType: 'custom/document',
          url: 'internal://document/placeholder',
          size: 'Content'.length,
        }),
        false,
      );
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'file-1',
          sourceSetId: 'kb-1',
        }),
      );
      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file-1', {
        url: 'internal://document/doc-1',
      });
      expect(result).toEqual(mockDoc);
    });

    it('should NOT create a file record when fileType is custom/folder', async () => {
      const mockDoc = { id: 'doc-1', title: 'My Folder' };
      mockDocumentModel.create.mockResolvedValue(mockDoc);

      await service.createDocument({
        title: 'My Folder',
        editorData: {},
        sourceSetId: 'kb-1',
        fileType: 'custom/folder',
      });

      expect(mockFileModel.create).not.toHaveBeenCalled();
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: null,
          fileType: 'custom/folder',
          // folders store sourceSetId in metadata
          metadata: { sourceSetId: 'kb-1' },
        }),
      );
    });

    it('should store sourceSetId in metadata for folders', async () => {
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });

      await service.createDocument({
        title: 'Folder',
        editorData: {},
        sourceSetId: 'kb-1',
        fileType: 'custom/folder',
        metadata: { existingKey: 'value' },
      });

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { existingKey: 'value', sourceSetId: 'kb-1' },
        }),
      );
    });

    it('should use custom fileType when provided', async () => {
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });
      mockFileModel.create.mockResolvedValue({ id: 'file-1' });

      await service.createDocument({
        title: 'PDF Doc',
        editorData: {},
        sourceSetId: 'kb-1',
        fileType: 'application/pdf',
      });

      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ fileType: 'application/pdf' }),
        false,
      );
    });

    it('should pass slug and parentId to document model', async () => {
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });

      await service.createDocument({
        title: 'Test',
        editorData: {},
        slug: 'my-slug',
        parentId: 'parent-doc-id',
      });

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'my-slug',
          parentId: 'parent-doc-id',
        }),
      );
    });
  });

  describe('createDocuments', () => {
    it('should create multiple documents in parallel', async () => {
      const docs = [
        { title: 'Doc 1', editorData: {} },
        { title: 'Doc 2', editorData: {}, content: 'Content' },
      ];
      const mockResults = [{ id: 'doc-1' }, { id: 'doc-2' }];
      mockDocumentModel.create
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      const results = await service.createDocuments(docs);

      expect(results).toEqual(mockResults);
      expect(mockDocumentModel.create).toHaveBeenCalledTimes(2);
    });

    it('should return empty array for empty input', async () => {
      const results = await service.createDocuments([]);
      expect(results).toEqual([]);
      expect(mockDocumentModel.create).not.toHaveBeenCalled();
    });
  });

  describe('queryDocuments', () => {
    it('should delegate to documentModel.query with no params', async () => {
      const mockResult = { items: [], total: 0 };
      mockDocumentModel.query.mockResolvedValue(mockResult);

      const result = await service.queryDocuments();

      expect(result).toEqual(mockResult);
      expect(mockDocumentModel.query).toHaveBeenCalledWith(undefined);
    });

    it('should delegate to documentModel.query with params', async () => {
      const params = { current: 0, fileTypes: ['pdf'], pageSize: 10, spaceId: 'spc_test' };
      const mockResult = { items: [{ id: 'doc-1' }], total: 1 };
      mockDocumentModel.queryIds.mockResolvedValue(['doc-1', 'doc-2']);
      mockFilterVisibleDocumentIdsForList.mockResolvedValue(['doc-2']);
      mockDocumentModel.query.mockResolvedValue(mockResult);

      const result = await service.queryDocuments(params);

      expect(result).toEqual(mockResult);
      expect(mockDocumentModel.queryIds).toHaveBeenCalledWith({
        fileTypes: ['pdf'],
        sourceSetId: undefined,
        sourceTypes: undefined,
        spaceId: 'spc_test',
        trash: undefined,
      });
      expect(mockFilterVisibleDocumentIdsForList).toHaveBeenCalledWith(['doc-1', 'doc-2'], {
        documentIncludeDeleted: undefined,
      });
      expect(mockDocumentModel.query).toHaveBeenCalledWith({
        current: 0,
        fileTypes: ['pdf'],
        ids: ['doc-2'],
        pageSize: 10,
        spaceId: 'spc_test',
      });
    });

    it('should return the filtered total even when a later page becomes empty after ACL filtering', async () => {
      mockDocumentModel.queryIds.mockResolvedValue(['doc-1', 'doc-2', 'doc-3']);
      mockFilterVisibleDocumentIdsForList.mockResolvedValue(['doc-2']);

      const result = await service.queryDocuments({
        current: 1,
        pageSize: 1,
        spaceId: 'spc_shared',
      });

      expect(result).toEqual({ items: [], total: 1 });
      expect(mockDocumentModel.query).not.toHaveBeenCalled();
    });
  });

  describe('getDocumentById', () => {
    it('should load document after requireDocument using findByIdAny', async () => {
      const mockDoc = { id: 'doc-1', title: 'Test' };
      mockDocumentModel.findByIdAny.mockResolvedValue(mockDoc);

      const result = await service.getDocumentById('doc-1');

      expect(result).toEqual(mockDoc);
      expect(mockRequireDocument).toHaveBeenCalledWith('doc-1', 'read_metadata');
      expect(mockDocumentModel.findByIdAny).toHaveBeenCalledWith('doc-1');
    });

    it('should return undefined when document not found', async () => {
      mockDocumentModel.findByIdAny.mockResolvedValue(undefined);

      const result = await service.getDocumentById('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('deleteDocument', () => {
    it('should return early if document not found', async () => {
      (mockDb.query as any).documents.findMany.mockResolvedValue([]);

      await service.deleteDocument('non-existent');

      expect(mockDocumentModel.deleteManyAny).not.toHaveBeenCalled();
      expect(mockFileModel.deleteManyAny).not.toHaveBeenCalled();
    });

    it('should delete a simple document without fileId', async () => {
      (mockDb.query as any).documents.findMany.mockResolvedValue([
        { fileId: null, fileType: 'custom/document', id: 'doc-1' },
      ]);

      await service.deleteDocument('doc-1');

      expect(mockRequireDocument).toHaveBeenCalledWith('doc-1', 'delete');
      expect(mockFileModel.softDeleteManyAny).not.toHaveBeenCalled();
      expect(mockDocumentModel.deleteManyAny).toHaveBeenCalledWith(['doc-1']);
    });

    it('should delete a simple document and its associated file', async () => {
      (mockDb.query as any).documents.findMany.mockResolvedValue([
        { fileId: 'file-1', fileType: 'custom/document', id: 'doc-1' },
      ]);

      await service.deleteDocument('doc-1');

      expect(mockFileModel.softDeleteManyAny).toHaveBeenCalledWith(['file-1']);
      expect(mockDocumentModel.deleteManyAny).toHaveBeenCalledWith(['doc-1']);
    });

    it('should recursively delete children when deleting a folder', async () => {
      mockDocumentModel.findByIdAny
        .mockResolvedValueOnce({
          fileId: 'file-child-1',
          fileType: 'custom/document',
          id: 'child-doc-1',
        })
        .mockResolvedValueOnce({ fileId: null, fileType: 'custom/folder', id: 'child-folder-2' });

      (mockDb.query as any).documents.findMany
        .mockResolvedValueOnce([{ fileId: null, fileType: 'custom/folder', id: 'folder-1' }])
        .mockResolvedValueOnce([{ id: 'child-doc-1' }, { id: 'child-folder-2' }])
        .mockResolvedValueOnce([]);

      (mockDb.query as any).files.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.deleteDocument('folder-1');

      expect(mockFileModel.softDeleteManyAny).toHaveBeenCalledWith(['file-child-1']);
      expect(mockDocumentModel.deleteManyAny).toHaveBeenCalledWith([
        'folder-1',
        'child-doc-1',
        'child-folder-2',
      ]);
    });

    it('should delete files in folder when folder has associated files', async () => {
      (mockDb.query as any).documents.findMany
        .mockResolvedValueOnce([{ fileId: null, fileType: 'custom/folder', id: 'folder-1' }])
        .mockResolvedValueOnce([]);

      (mockDb.query as any).files.findMany.mockResolvedValue([
        { id: 'file-in-folder-1' },
        { id: 'file-in-folder-2' },
      ]);

      await service.deleteDocument('folder-1');

      expect(mockFileModel.softDeleteManyAny).toHaveBeenCalledWith([
        'file-in-folder-1',
        'file-in-folder-2',
      ]);
      expect(mockDocumentModel.deleteManyAny).toHaveBeenCalledWith(['folder-1']);
    });
  });

  describe('deleteDocuments', () => {
    it('should delete multiple documents in parallel', async () => {
      (mockDb.query as any).documents.findMany.mockResolvedValue([
        { fileId: null, fileType: 'custom/document', id: 'doc-1' },
        { fileId: 'file-2', fileType: 'custom/document', id: 'doc-2' },
      ]);

      await service.deleteDocuments(['doc-1', 'doc-2']);

      expect(mockRequireDocument).toHaveBeenCalledWith('doc-1', 'delete');
      expect(mockRequireDocument).toHaveBeenCalledWith('doc-2', 'delete');
      expect(mockDocumentModel.deleteManyAny).toHaveBeenCalledWith(['doc-1', 'doc-2']);
      expect(mockFileModel.softDeleteManyAny).toHaveBeenCalledWith(['file-2']);
    });

    it('should handle empty ids array', async () => {
      await service.deleteDocuments([]);
      expect(mockRequireDocument).not.toHaveBeenCalled();
    });

    it('should hard delete soft-deleted documents and remove backing files', async () => {
      (mockDb.query as any).documents.findMany
        .mockResolvedValueOnce([{ fileId: 'file-1', fileType: 'custom/document', id: 'doc-1' }])
        .mockResolvedValueOnce([{ contentUid: 'res_doc_1', spaceId: 'spc_test' }]);

      (mockDb.query as any).files.findMany.mockResolvedValueOnce([
        {
          blobId: null,
          contentUid: 'res_file_1',
          fileHash: null,
          spaceId: 'spc_test',
          url: 'internal://document/doc-1',
        },
      ]);

      mockFileModel.deleteManyAny.mockResolvedValue([]);

      await service.deleteDocuments(['doc-1'], false);

      expect(mockAssertCapability).toHaveBeenCalledWith({
        capability: 'delete',
        documentIncludeDeleted: true,
        id: 'doc-1',
        kind: 'document',
      });
      expect(mockFileModel.deleteManyAny).toHaveBeenCalledWith(['file-1'], expect.any(Boolean));
      expect(mockDocumentModel.hardDeleteManyAny).toHaveBeenCalledWith(['doc-1']);
      expect(mockFileService.deleteFiles).toHaveBeenCalledWith(['internal://document/doc-1']);
    });

    it('should preserve hashed storage blobs when hard delete keeps global files', async () => {
      (mockDb.query as any).documents.findMany
        .mockResolvedValueOnce([{ fileId: 'file-1', fileType: 'custom/document', id: 'doc-1' }])
        .mockResolvedValueOnce([{ contentUid: 'res_doc_1', spaceId: 'spc_test' }]);

      (mockDb.query as any).files.findMany.mockResolvedValueOnce([
        {
          blobId: null,
          contentUid: 'res_file_1',
          fileHash: 'hash-1',
          spaceId: 'spc_test',
          url: 'storage/shared.txt',
        },
      ]);

      mockFileModel.deleteManyAny.mockResolvedValue([]);

      await service.deleteDocuments(['doc-1'], false);

      expect(mockFileService.deleteFiles).not.toHaveBeenCalled();
      expect(mockFileModel.checkHash).not.toHaveBeenCalled();
    });

    it('should preserve shared space blobs while another file still references them', async () => {
      (mockDb.query as any).documents.findMany
        .mockResolvedValueOnce([{ fileId: 'file-1', fileType: 'custom/document', id: 'doc-1' }])
        .mockResolvedValueOnce([{ contentUid: 'res_doc_1', spaceId: 'spc_test' }]);

      (mockDb.query as any).files.findMany.mockResolvedValueOnce([
        {
          blobId: 'blob-1',
          contentUid: 'res_file_1',
          fileHash: null,
          spaceId: 'spc_test',
          url: 'v2/spaces/spc_test/blobs/blob-1',
        },
      ]);

      mockFileModel.hasFilesForBlob.mockResolvedValue(true);
      mockFileModel.deleteManyAny.mockResolvedValue([]);

      await service.deleteDocuments(['doc-1'], false);

      expect(mockFileService.deleteFiles).not.toHaveBeenCalled();
      expect(mockFileModel.hasFilesForBlob).toHaveBeenCalledWith('blob-1');
      expect(mockFileModel.checkHash).not.toHaveBeenCalled();
    });
  });

  describe('restoreDocuments', () => {
    it('should restore folder descendants and nested files when restoring a folder root', async () => {
      (mockDb.query as any).documents.findMany
        .mockResolvedValueOnce([{ fileId: null, fileType: 'custom/folder', id: 'docs_root' }])
        .mockResolvedValueOnce([
          { fileId: 'file_mirror', fileType: 'custom/document', id: 'docs_child' },
        ])
        .mockResolvedValueOnce([
          { contentUid: 'res_root', fileId: null, id: 'docs_root', spaceId: 'spc_test' },
          {
            contentUid: 'res_child',
            fileId: 'file_mirror',
            id: 'docs_child',
            spaceId: 'spc_test',
          },
        ]);

      (mockDb.query as any).files.findMany
        .mockResolvedValueOnce([{ id: 'file_nested' }])
        .mockResolvedValueOnce([
          { contentUid: 'res_file_mirror', id: 'file_mirror', spaceId: 'spc_test' },
          { contentUid: 'res_file_nested', id: 'file_nested', spaceId: 'spc_test' },
        ]);

      mockDocumentModel.findByIdAny.mockImplementation(async (id: string) => ({ id }));

      const result = await service.restoreDocuments(['docs_root']);

      expect(mockDocumentModel.restoreManyAny).toHaveBeenCalledWith(['docs_root', 'docs_child']);
      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file_mirror', { deletedAt: null });
      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file_nested', { deletedAt: null });
      expect(result).toEqual([{ id: 'docs_root' }, { id: 'docs_child' }]);
    });
  });

  describe('updateDocument', () => {
    it('should update content and recalculate char/line counts', async () => {
      const newContent = 'Updated\nContent';
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: null, id: 'doc-1' });

      await service.updateDocument('doc-1', { content: newContent });

      expect(mockDocumentModel.updateAny).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({
          content: newContent,
          totalCharCount: newContent.length,
          totalLineCount: 2,
        }),
      );
    });

    it('should update editorData', async () => {
      const editorData = { blocks: [{ type: 'paragraph', text: 'Hello' }] };
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: null, id: 'doc-1' });

      await service.updateDocument('doc-1', { editorData });

      expect(mockDocumentModel.updateAny).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({ editorData }),
      );
    });

    it('should update title and filename together', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: null, id: 'doc-1' });

      await service.updateDocument('doc-1', { title: 'New Title' });

      expect(mockDocumentModel.updateAny).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({
          title: 'New Title',
          filename: 'New Title',
        }),
      );
    });

    it('should sync title update to associated file', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: 'file-1', id: 'doc-1' });
      mockFileModel.updateAny.mockResolvedValue(undefined);

      await service.updateDocument('doc-1', { title: 'New Title' });

      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file-1', { name: 'New Title' });
    });

    it('should re-index associated file after content updates', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: 'file-1', id: 'doc-1' });
      mockFileModel.updateAny.mockResolvedValue(undefined);
      mockFileModel.clearFileChunks.mockResolvedValue([]);
      mockAsyncParseFileToChunks.mockResolvedValue('task-1');
      mockAssertCapability.mockResolvedValue({ authzEpoch: 11 });

      await service.updateDocument('doc-1', { content: 'Updated\nContent' });

      expect(mockAssertCapability).toHaveBeenCalledWith({
        capability: 'preview_content',
        id: 'file-1',
        kind: 'file',
      });
      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file-1', {
        size: 'Updated\nContent'.length,
      });
      expect(mockFileModel.clearFileChunks).toHaveBeenCalledWith(['file-1']);
      expect(mockAsyncParseFileToChunks).toHaveBeenCalledWith('file-1', false, {
        contentGuardAuthzEpoch: 11,
      });
    });

    it('should re-index associated file after editorData updates', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: 'file-1', id: 'doc-1' });
      mockFileModel.clearFileChunks.mockResolvedValue([]);
      mockAsyncParseFileToChunks.mockResolvedValue('task-1');
      mockAssertCapability.mockResolvedValue({ authzEpoch: 13 });

      await service.updateDocument('doc-1', { editorData: { blocks: [] } });

      expect(mockAssertCapability).toHaveBeenCalledWith({
        capability: 'preview_content',
        id: 'file-1',
        kind: 'file',
      });
      expect(mockFileModel.clearFileChunks).toHaveBeenCalledWith(['file-1']);
      expect(mockAsyncParseFileToChunks).toHaveBeenCalledWith('file-1', false, {
        contentGuardAuthzEpoch: 13,
      });
    });

    it('should sync parentId update to associated file', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: 'file-1', id: 'doc-1' });
      mockFileModel.updateAny.mockResolvedValue(undefined);

      await service.updateDocument('doc-1', { parentId: 'new-parent' });

      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file-1', { parentId: 'new-parent' });
    });

    it('should sync both title and parentId to file when both are updated', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: 'file-1', id: 'doc-1' });
      mockFileModel.updateAny.mockResolvedValue(undefined);

      await service.updateDocument('doc-1', { title: 'New Title', parentId: 'new-parent' });

      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file-1', {
        name: 'New Title',
        parentId: 'new-parent',
      });
    });

    it('should NOT update file when document has no associated file', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: null, id: 'doc-1' });

      await service.updateDocument('doc-1', { title: 'New Title' });

      expect(mockFileModel.updateAny).not.toHaveBeenCalled();
    });

    it('should update metadata', async () => {
      const metadata = { key: 'value' };
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: null, id: 'doc-1' });

      await service.updateDocument('doc-1', { metadata });

      expect(mockDocumentModel.updateAny).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({ metadata }),
      );
    });

    it('should update fileType', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: null, id: 'doc-1' });

      await service.updateDocument('doc-1', { fileType: 'text/markdown' });

      expect(mockDocumentModel.updateAny).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({ fileType: 'text/markdown' }),
      );
    });

    it('should handle parentId null (moving to root)', async () => {
      mockDocumentModel.updateAny.mockResolvedValue({ id: 'doc-1' });
      mockDocumentModel.findByIdAny.mockResolvedValue({ fileId: 'file-1', id: 'doc-1' });
      mockFileModel.updateAny.mockResolvedValue(undefined);

      await service.updateDocument('doc-1', { parentId: null });

      expect(mockFileModel.updateAny).toHaveBeenCalledWith('file-1', { parentId: null });
    });
  });

  describe('parseDocument', () => {
    const mockCleanup = vi.fn();

    beforeEach(() => {
      mockFileService.downloadFileToLocal.mockResolvedValue({
        filePath: '/tmp/test.txt',
        file: { name: 'test.pdf', url: 's3://bucket/test.pdf', parentId: 'parent-id' },
        cleanup: mockCleanup,
      });
    });

    it('should parse a document file and create document record', async () => {
      vi.mocked(loadFile).mockResolvedValue({
        content: 'Parsed content',
        fileType: 'pdf',
        metadata: { title: 'My Doc' },
        pages: undefined,
        totalCharCount: 14,
        totalLineCount: 1,
      } as any);
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1', title: 'My Doc' });

      const result = await service.parseDocument('file-1');

      expect(loadFile).toHaveBeenCalledWith('/tmp/test.txt');
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Parsed content',
          fileId: 'file-1',
          fileType: 'custom/document',
          filename: 'My Doc',
          title: 'My Doc',
          totalCharCount: 'Parsed content'.length,
          totalLineCount: 1,
          parentId: 'parent-id',
          source: 's3://bucket/test.pdf',
          sourceType: 'file',
        }),
      );
      expect(mockCleanup).toHaveBeenCalled();
      expect(result).toEqual({ id: 'doc-1', title: 'My Doc' });
    });

    it('should use filename as title when metadata has no title', async () => {
      vi.mocked(loadFile).mockResolvedValue({
        content: 'Content',
        fileType: 'pdf',
        metadata: {},
        pages: undefined,
        totalCharCount: 7,
        totalLineCount: 1,
      } as any);
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });
      mockFileService.downloadFileToLocal.mockResolvedValue({
        filePath: '/tmp/document.pdf',
        file: { name: 'document.pdf', url: 's3://bucket/doc.pdf', parentId: null },
        cleanup: mockCleanup,
      });

      await service.parseDocument('file-1');

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'document' }),
      );
    });

    it('should strip <page> tags from content', async () => {
      vi.mocked(loadFile).mockResolvedValue({
        content: '<page number="1">Page one content</docs><page number="2">Page two content</docs>',
        fileType: 'pdf',
        metadata: {},
        pages: undefined,
        totalCharCount: 32,
        totalLineCount: 1,
      } as any);
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });
      mockFileService.downloadFileToLocal.mockResolvedValue({
        filePath: '/tmp/doc.pdf',
        file: { name: 'doc.pdf', url: 's3://bucket/doc.pdf', parentId: null },
        cleanup: mockCleanup,
      });

      await service.parseDocument('file-1');

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Page one contentPage two content',
        }),
      );
    });

    it('should call cleanup even when parsing fails', async () => {
      vi.mocked(loadFile).mockRejectedValue(new Error('Parse error'));

      await expect(service.parseDocument('file-1')).rejects.toThrow('Parse error');

      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('ensureFileDocument', () => {
    it('should accept canonical document ids without resolving the backing file', async () => {
      const existingDocument = {
        content: '# Hello',
        createdAt: new Date('2026-04-07T00:00:00.000Z'),
        editorData: null,
        fileType: 'custom/document',
        filename: 'Readme',
        id: 'docs_1',
        metadata: {},
        parentId: null,
        source: '/f/file-1',
        sourceType: 'file',
        title: 'Readme',
        totalCharCount: 7,
        totalLineCount: 1,
        updatedAt: new Date('2026-04-07T00:00:00.000Z'),
      };
      mockRequireDocument.mockResolvedValue(existingDocument);

      const result = await service.ensureFileDocument('docs_1');

      expect(mockRequireDocument).toHaveBeenCalledWith('docs_1', 'preview_content');
      expect(mockRequireFile).not.toHaveBeenCalled();
      expect(mockDocumentModel.findByFileId).not.toHaveBeenCalled();
      expect(result).toBe(existingDocument);
    });

    it('should reuse an existing parsed document for the file', async () => {
      const existingDocument = { fileId: 'file-1', id: 'docs_1', sourceType: 'file' };
      mockDocumentModel.findByFileId.mockResolvedValue(existingDocument);

      const result = await service.ensureFileDocument('file-1');

      expect(mockRequireFile).toHaveBeenCalledWith('file-1', 'preview_content');
      expect(mockDocumentModel.findByFileId).toHaveBeenCalledWith('file-1');
      expect(mockFileService.downloadFileToLocal).not.toHaveBeenCalled();
      expect(result).toBe(existingDocument);
    });

    it('should parse the file when no derived document exists yet', async () => {
      mockDocumentModel.findByFileId.mockResolvedValue(undefined);
      mockFileService.downloadFileToLocal.mockResolvedValue({
        cleanup: vi.fn(),
        file: { name: 'readme.md', parentId: null, url: 's3://bucket/readme.md' },
        filePath: '/tmp/readme.md',
      });
      vi.mocked(loadFile).mockResolvedValue({
        content: '# Hello',
        fileType: 'markdown',
        metadata: { title: 'Readme' },
        pages: undefined,
        totalCharCount: 7,
        totalLineCount: 1,
      } as any);
      mockDocumentModel.create.mockResolvedValue({ id: 'docs_2', title: 'Readme' });

      const result = await service.ensureFileDocument('file-1');

      expect(mockDocumentModel.findByFileId).toHaveBeenCalledWith('file-1');
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'file-1',
          sourceType: 'file',
          title: 'Readme',
        }),
      );
      expect(result).toEqual({ id: 'docs_2', title: 'Readme' });
    });
  });

  describe('previewFileContent', () => {
    it('should return canonical document content directly for docs_* ids', async () => {
      const document = {
        content: '# Hello',
        createdAt: new Date('2026-04-07T00:00:00.000Z'),
        editorData: { blocks: [] },
        fileType: 'custom/document',
        filename: 'Readme',
        id: 'docs_1',
        metadata: { title: 'Readme' },
        pages: [{ metadata: { page: 1 }, pageContent: 'Hello', charCount: 5, lineCount: 1 }],
        parentId: null,
        source: '/f/file-1',
        sourceSetId: 'ss_1',
        sourceType: 'file',
        spaceId: 'spc_1',
        title: 'Readme',
        totalCharCount: 7,
        totalLineCount: 1,
        updatedAt: new Date('2026-04-07T00:00:00.000Z'),
      };
      mockRequireDocument.mockResolvedValue(document);

      const result = await service.previewFileContent('docs_1');

      expect(mockRequireDocument).toHaveBeenCalledWith('docs_1', 'preview_content');
      expect(mockRequireFile).not.toHaveBeenCalled();
      expect(mockFileService.downloadFileToLocal).not.toHaveBeenCalled();
      expect(result).toEqual(document);
    });
  });

  describe('parseFile', () => {
    const mockCleanup = vi.fn();

    beforeEach(() => {
      mockFileService.downloadFileToLocal.mockResolvedValue({
        filePath: '/tmp/test.md',
        file: { name: 'readme.md', url: 's3://bucket/readme.md', parentId: null },
        cleanup: mockCleanup,
      });
    });

    it('should parse a file and create document record with pages', async () => {
      vi.mocked(loadFile).mockResolvedValue({
        content: 'Full file content',
        fileType: 'markdown',
        metadata: { title: 'Readme' },
        pages: [{ content: 'Page 1' }],
        totalCharCount: 17,
        totalLineCount: 1,
      } as any);
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1', title: 'Readme' });

      const result = await service.parseFile('file-1');

      expect(loadFile).toHaveBeenCalledWith('/tmp/test.md');
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Full file content',
          fileId: 'file-1',
          fileType: 'custom/document',
          filename: 'Readme',
          title: 'Readme',
          pages: [{ content: 'Page 1' }],
          totalCharCount: 17,
          totalLineCount: 1,
          source: 's3://bucket/readme.md',
          sourceType: 'file',
        }),
      );
      expect(mockCleanup).toHaveBeenCalled();
      expect(result).toEqual({ id: 'doc-1', title: 'Readme' });
    });

    it('should use file name as title (stripping extension) when metadata has no title', async () => {
      vi.mocked(loadFile).mockResolvedValue({
        content: 'Content',
        fileType: 'markdown',
        metadata: {},
        pages: undefined,
        totalCharCount: 7,
        totalLineCount: 1,
      } as any);
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });

      await service.parseFile('file-1');

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'readme' }),
      );
    });

    it('should call cleanup even when file parsing fails', async () => {
      vi.mocked(loadFile).mockRejectedValue(new Error('File not parseable'));

      await expect(service.parseFile('file-1')).rejects.toThrow('File not parseable');

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should NOT strip page tags in parseFile (unlike parseDocument)', async () => {
      const contentWithPageTags =
        '<page number="1">First page</docs><page number="2">Second page</docs>';
      vi.mocked(loadFile).mockResolvedValue({
        content: contentWithPageTags,
        fileType: 'pdf',
        metadata: {},
        pages: undefined,
        totalCharCount: contentWithPageTags.length,
        totalLineCount: 1,
      } as any);
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });
      mockFileService.downloadFileToLocal.mockResolvedValue({
        filePath: '/tmp/doc.pdf',
        file: { name: 'doc.pdf', url: 's3://bucket/doc.pdf', parentId: null },
        cleanup: mockCleanup,
      });

      await service.parseFile('file-1');

      // parseFile does NOT strip page tags, unlike parseDocument
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: contentWithPageTags,
        }),
      );
    });
  });
});

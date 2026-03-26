import { type LobeChatDatabase } from '@lobechat/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';

import { FileService } from '../../file';
import { DocumentService } from '../index';

const { mockRequireDocument, mockRequireFile } = vi.hoisted(() => ({
  mockRequireDocument: vi.fn().mockResolvedValue({ id: 'docs_test', spaceId: 'spc_test' }),
  mockRequireFile: vi.fn().mockResolvedValue({ id: 'file-1' }),
}));

vi.mock('@/database/models/document');
vi.mock('@/database/models/file');
vi.mock('@/database/models/resource', () => ({
  ResourceModel: vi.fn(() => ({
    ensureOwnerPermission: vi.fn(),
    ensureResourceRegistry: vi.fn().mockResolvedValue({ resourceUid: 'res_test' }),
    invalidateAuthzEpochsAfterRemoval: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock('@/database/models/space', () => ({
  SpaceModel: vi.fn(() => ({
    findAccessibleSpaceById: vi.fn().mockResolvedValue(undefined),
    getOrCreatePersonalSpace: vi.fn().mockResolvedValue({ id: 'spc_test' }),
  })),
}));
vi.mock('../../file');

vi.mock('../../resource', () => ({
  AuthorizedResourceResolver: vi.fn(() => ({
    requireDocument: mockRequireDocument,
    requireFile: mockRequireFile,
    requireKnowledgeBase: vi.fn().mockResolvedValue({ id: 'kb_test', spaceId: 'spc_test' }),
  })),
  ResourceAuthorizer: vi.fn(() => ({
    assertCapability: vi.fn(),
    getAccessMatch: vi.fn().mockResolvedValue({
      authzEpoch: 1,
      canAccess: true,
      resourceUid: 'res_test',
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
      query: vi.fn(),
      update: vi.fn(),
      updateAny: vi.fn(),
    };

    mockFileModel = {
      create: vi.fn(),
      delete: vi.fn(),
      deleteManyAny: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      updateAny: vi.fn(),
    };

    mockFileService = {
      downloadFileToLocal: vi.fn(),
    };

    vi.mocked(DocumentModel).mockImplementation(() => mockDocumentModel);
    vi.mocked(FileModel).mockImplementation(() => mockFileModel);
    vi.mocked(FileService).mockImplementation(() => mockFileService);

    service = new DocumentService(mockDb, userId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createDocument', () => {
    it('should create a document without knowledgeBase', async () => {
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
      // Should not create a file record when no knowledgeBaseId
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

    it('should create a file record when knowledgeBaseId is provided and fileType is not folder', async () => {
      const mockFile = { id: 'file-1' };
      const mockDoc = { id: 'doc-1', title: 'Test' };
      mockFileModel.create.mockResolvedValue(mockFile);
      mockDocumentModel.create.mockResolvedValue(mockDoc);

      const result = await service.createDocument({
        title: 'Test',
        editorData: {},
        content: 'Content',
        knowledgeBaseId: 'kb-1',
      });

      expect(mockFileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
          knowledgeBaseId: 'kb-1',
          fileType: 'custom/document',
          url: 'internal://document/placeholder',
          size: 'Content'.length,
        }),
        false,
      );
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'file-1',
          knowledgeBaseId: 'kb-1',
        }),
      );
      expect(result).toEqual(mockDoc);
    });

    it('should NOT create a file record when fileType is custom/folder', async () => {
      const mockDoc = { id: 'doc-1', title: 'My Folder' };
      mockDocumentModel.create.mockResolvedValue(mockDoc);

      await service.createDocument({
        title: 'My Folder',
        editorData: {},
        knowledgeBaseId: 'kb-1',
        fileType: 'custom/folder',
      });

      expect(mockFileModel.create).not.toHaveBeenCalled();
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: null,
          fileType: 'custom/folder',
          // folders store knowledgeBaseId in metadata
          metadata: { knowledgeBaseId: 'kb-1' },
        }),
      );
    });

    it('should store knowledgeBaseId in metadata for folders', async () => {
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });

      await service.createDocument({
        title: 'Folder',
        editorData: {},
        knowledgeBaseId: 'kb-1',
        fileType: 'custom/folder',
        metadata: { existingKey: 'value' },
      });

      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { existingKey: 'value', knowledgeBaseId: 'kb-1' },
        }),
      );
    });

    it('should use custom fileType when provided', async () => {
      mockDocumentModel.create.mockResolvedValue({ id: 'doc-1' });
      mockFileModel.create.mockResolvedValue({ id: 'file-1' });

      await service.createDocument({
        title: 'PDF Doc',
        editorData: {},
        knowledgeBaseId: 'kb-1',
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
      const params = { current: 1, pageSize: 10, fileTypes: ['pdf'] };
      const mockResult = { items: [{ id: 'doc-1' }], total: 1 };
      mockDocumentModel.query.mockResolvedValue(mockResult);

      const result = await service.queryDocuments(params);

      expect(result).toEqual(mockResult);
      expect(mockDocumentModel.query).toHaveBeenCalledWith(params);
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
      expect(mockFileModel.deleteManyAny).not.toHaveBeenCalled();
      expect(mockDocumentModel.deleteManyAny).toHaveBeenCalledWith(['doc-1']);
    });

    it('should delete a simple document and its associated file', async () => {
      (mockDb.query as any).documents.findMany.mockResolvedValue([
        { fileId: 'file-1', fileType: 'custom/document', id: 'doc-1' },
      ]);

      await service.deleteDocument('doc-1');

      expect(mockFileModel.deleteManyAny).toHaveBeenCalledWith(['file-1']);
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

      expect(mockFileModel.deleteManyAny).toHaveBeenCalledWith(['file-child-1']);
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

      expect(mockFileModel.deleteManyAny).toHaveBeenCalledWith([
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
      expect(mockFileModel.deleteManyAny).toHaveBeenCalledWith(['file-2']);
    });

    it('should handle empty ids array', async () => {
      await service.deleteDocuments([]);
      expect(mockRequireDocument).not.toHaveBeenCalled();
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
        content: '<page number="1">Page one content</page><page number="2">Page two content</page>',
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
        '<page number="1">First page</page><page number="2">Second page</page>';
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

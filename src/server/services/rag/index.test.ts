import { DEFAULT_FILE_EMBEDDING_MODEL_ITEM } from '@lobechat/const';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEmbeddings,
  mockFilterReadableFileIds,
  mockFilterReadableSourceSetIds,
  mockFindByFileId,
  mockParseFile,
  mockRequireFile,
  mockSemanticSearch,
  mockSemanticSearchForChat,
} = vi.hoisted(() => ({
  mockEmbeddings: vi.fn(),
  mockFilterReadableFileIds: vi.fn(),
  mockFilterReadableSourceSetIds: vi.fn(),
  mockFindByFileId: vi.fn(),
  mockParseFile: vi.fn(),
  mockRequireFile: vi.fn(),
  mockSemanticSearch: vi.fn(),
  mockSemanticSearchForChat: vi.fn(),
}));

vi.mock('@/database/models/chunk', () => ({
  ChunkModel: vi.fn().mockImplementation(() => ({
    semanticSearch: mockSemanticSearch,
    semanticSearchForChat: mockSemanticSearchForChat,
  })),
}));

vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn().mockImplementation(() => ({
    findByFileId: mockFindByFileId,
  })),
}));

vi.mock('@/server/services/document', () => ({
  DocumentService: vi.fn().mockImplementation(() => ({
    parseFile: mockParseFile,
  })),
}));

vi.mock('@/server/services/content', () => ({
  AuthorizedResourceResolver: vi.fn().mockImplementation(() => ({
    requireFile: mockRequireFile,
  })),
  ContentAuthorizer: vi.fn().mockImplementation(() => ({
    filterReadableFileIds: mockFilterReadableFileIds,
    filterReadableSourceSetIds: mockFilterReadableSourceSetIds,
  })),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerDefaultFilesConfig: vi.fn().mockReturnValue({}),
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  initModelRuntimeFromDB: vi.fn().mockResolvedValue({
    embeddings: mockEmbeddings,
  }),
}));

const { ServerRagService } = await import('./index');

describe('ServerRagService', () => {
  const userId = 'user-1';
  const embeddingVector = Array.from({ length: 1024 }, (_, index) => index / 1024);

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbeddings.mockResolvedValue([embeddingVector]);
    mockFilterReadableFileIds.mockResolvedValue([]);
    mockFilterReadableSourceSetIds.mockResolvedValue([]);
    mockFindByFileId.mockResolvedValue(undefined);
    mockParseFile.mockResolvedValue(undefined);
    mockRequireFile.mockResolvedValue({ name: 'doc.md' });
    mockSemanticSearch.mockResolvedValue([]);
    mockSemanticSearchForChat.mockResolvedValue([]);
  });

  describe('getFileContents', () => {
    it('should ignore docs_* canonical document ids', async () => {
      const serverDB = {
        query: {
          sourceSetFiles: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      } as any;
      mockFilterReadableFileIds.mockResolvedValue(['file-1']);
      mockFindByFileId.mockResolvedValue({ content: 'alpha', metadata: { pageKind: 'doc' } });
      const service = new ServerRagService(serverDB, userId);

      const result = await service.getFileContents(['docs_derived_1', 'file-1']);

      expect(mockFilterReadableFileIds).toHaveBeenCalledWith(['file-1']);
      expect(mockRequireFile).toHaveBeenCalledWith('file-1', 'preview_content');
      expect(mockRequireFile).not.toHaveBeenCalledWith('docs_derived_1', 'preview_content');
      expect(result).toEqual([
        expect.objectContaining({
          content: 'alpha',
          fileId: 'file-1',
          filename: 'doc.md',
        }),
      ]);
    });
  });

  describe('semanticSearchForChat', () => {
    it('should strip docs_* ids before readable-file filtering', async () => {
      const serverDB = {
        query: {
          sourceSetFiles: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      } as any;
      mockFilterReadableFileIds.mockResolvedValue(['file-1']);
      mockSemanticSearchForChat.mockResolvedValue([
        { fileId: 'file-1', fileName: 'A', id: 'chunk-1', similarity: 0.95, text: 'alpha' },
      ]);

      const service = new ServerRagService(serverDB, userId);

      await service.semanticSearchForChat({
        fileIds: ['docs_derived_1', 'file-1'],
        query: 'rag audit',
      });

      expect(mockFilterReadableFileIds).toHaveBeenCalledWith(['file-1']);
    });

    it('should short-circuit before embedding when no readable files remain', async () => {
      const serverDB = {
        query: {
          sourceSetFiles: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      } as any;
      const service = new ServerRagService(serverDB, userId);

      const result = await service.semanticSearchForChat({
        fileIds: ['file-1'],
        query: 'rag audit',
        sourceSetIds: ['kb-1'],
      });

      expect(result).toEqual({ chunks: [], fileResults: [] });
      expect(mockEmbeddings).not.toHaveBeenCalled();
      expect(mockSemanticSearchForChat).not.toHaveBeenCalled();
    });

    it('should dedupe file ids and split chunk/file limits', async () => {
      const findMany = vi.fn().mockResolvedValue([{ fileId: 'file-2' }, { fileId: 'file-3' }]);
      const serverDB = {
        query: {
          sourceSetFiles: {
            findMany,
          },
        },
      } as any;

      mockFilterReadableFileIds.mockResolvedValue(['file-1', 'file-2']);
      mockFilterReadableSourceSetIds.mockResolvedValue(['kb-1']);
      mockSemanticSearchForChat.mockResolvedValue([
        { fileId: 'file-2', fileName: 'A', id: 'chunk-1', similarity: 0.95, text: 'alpha' },
        { fileId: 'file-2', fileName: 'A', id: 'chunk-2', similarity: 0.9, text: 'beta' },
        { fileId: 'file-3', fileName: 'B', id: 'chunk-3', similarity: 0.8, text: 'gamma' },
      ]);

      const service = new ServerRagService(serverDB, userId);

      const result = await service.semanticSearchForChat({
        chunkTopK: 4,
        fileIds: ['file-1', 'file-2'],
        fileTopK: 1,
        query: 'rag audit',
        sourceSetIds: ['kb-1'],
      });

      expect(findMany).toHaveBeenCalled();
      expect(mockEmbeddings).toHaveBeenCalledTimes(1);
      expect(mockSemanticSearchForChat).toHaveBeenCalledWith({
        chunkTopK: 12,
        embedding: embeddingVector,
        embeddingModel: DEFAULT_FILE_EMBEDDING_MODEL_ITEM.model,
        fileIds: ['file-2', 'file-3', 'file-1'],
      });
      expect(result.chunks).toHaveLength(3);
      expect(result.fileResults).toHaveLength(1);
      expect(result.fileResults[0].fileId).toBe('file-2');
    });

    it('should diversify chunks across files before trimming', async () => {
      const serverDB = {
        query: {
          sourceSetFiles: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      } as any;

      mockFilterReadableFileIds.mockResolvedValue(['file-1', 'file-2']);
      mockSemanticSearchForChat.mockResolvedValue([
        { fileId: 'file-1', fileName: 'A', id: 'chunk-1', similarity: 0.99, text: 'alpha-1' },
        { fileId: 'file-1', fileName: 'A', id: 'chunk-2', similarity: 0.98, text: 'alpha-2' },
        { fileId: 'file-2', fileName: 'B', id: 'chunk-3', similarity: 0.97, text: 'beta-1' },
      ]);

      const service = new ServerRagService(serverDB, userId);

      const result = await service.semanticSearchForChat({
        chunkTopK: 2,
        fileIds: ['file-1', 'file-2'],
        fileTopK: 2,
        query: 'diverse recall',
      });

      expect(result.chunks.map((chunk) => chunk.id)).toEqual(['chunk-1', 'chunk-3']);
      expect(result.fileResults.map((file) => file.fileId)).toEqual(['file-1', 'file-2']);
    });
  });
});

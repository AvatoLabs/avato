import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentModel } from '@/database/models/content';
import { DocumentModel } from '@/database/models/document';
import { SpaceModel } from '@/database/models/space';
import { TopicModel } from '@/database/models/topic';
import { TopicDocumentModel } from '@/database/models/topicDocument';

import { NotebookRuntimeService } from '../index';

vi.mock('@/database/models/document');
vi.mock('@/database/models/content');
vi.mock('@/database/models/space');
vi.mock('@/database/models/topic');
vi.mock('@/database/models/topicDocument');

describe('NotebookRuntimeService', () => {
  let service: NotebookRuntimeService;
  const mockDb = {} as any;
  const mockUserId = 'test-user';
  let mockDocumentModel: any;
  let mockResourceModel: any;
  let mockSpaceModel: any;
  let mockTopicModel: any;
  let mockTopicDocumentModel: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDocumentModel = {
      create: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockTopicDocumentModel = {
      associate: vi.fn(),
      deleteByDocumentId: vi.fn(),
      findByTopicId: vi.fn(),
    };

    mockResourceModel = {
      ensureOwnerPermission: vi.fn(),
      ensureContentRegistry: vi.fn().mockResolvedValue({ contentUid: 'res_doc_1' }),
    };

    mockSpaceModel = {
      findAccessibleSpaceById: vi.fn().mockResolvedValue({
        id: 'spc_topic',
        membershipRole: 'editor',
      }),
      getOrCreatePersonalSpace: vi.fn().mockResolvedValue({ id: 'spc_test' }),
    };

    mockTopicModel = {
      findById: vi.fn(),
    };

    vi.mocked(DocumentModel).mockImplementation(() => mockDocumentModel);
    vi.mocked(ContentModel).mockImplementation(() => mockResourceModel);
    vi.mocked(SpaceModel).mockImplementation(() => mockSpaceModel);
    vi.mocked(TopicModel).mockImplementation(() => mockTopicModel);
    vi.mocked(TopicDocumentModel).mockImplementation(() => mockTopicDocumentModel);

    service = new NotebookRuntimeService({ serverDB: mockDb, userId: mockUserId });
  });

  const mockDocument = {
    content: '# Hello',
    createdAt: new Date('2025-01-01'),
    description: 'A test doc',
    fileType: 'markdown',
    id: 'doc-1',
    source: 'notebook:topic-1',
    sourceType: 'api' as const,
    title: 'Test Doc',
    totalCharCount: 7,
    totalLineCount: 1,
    updatedAt: new Date('2025-01-01'),
  };

  describe('createDocument', () => {
    it('should create a document and return service result', async () => {
      mockDocumentModel.create.mockResolvedValue(mockDocument);
      mockDocumentModel.findById.mockResolvedValue({
        ...mockDocument,
        contentUid: 'res_doc_1',
        spaceId: 'spc_test',
      });

      const params = {
        content: '# Hello',
        fileType: 'markdown',
        source: 'notebook:topic-1',
        sourceType: 'api' as const,
        title: 'Test Doc',
        totalCharCount: 7,
        totalLineCount: 1,
      };

      const result = await service.createDocument(params);

      expect(mockTopicModel.findById).not.toHaveBeenCalled();
      expect(mockDocumentModel.create).toHaveBeenCalledWith({
        ...params,
        spaceId: 'spc_test',
      });
      expect(mockResourceModel.ensureContentRegistry).toHaveBeenCalledWith({
        createdBy: mockUserId,
        kind: 'document',
        localId: 'doc-1',
        spaceId: 'spc_test',
      });
      expect(mockDocumentModel.update).toHaveBeenCalledWith('doc-1', {
        contentUid: 'res_doc_1',
        spaceId: 'spc_test',
      });
      expect(mockResourceModel.ensureOwnerPermission).toHaveBeenCalledWith({
        contentUid: 'res_doc_1',
        spaceId: 'spc_test',
      });
      expect(result).toEqual({
        content: '# Hello',
        createdAt: mockDocument.createdAt,
        description: 'A test doc',
        fileType: 'markdown',
        id: 'doc-1',
        source: 'notebook:topic-1',
        sourceType: 'api',
        title: 'Test Doc',
        totalCharCount: 7,
        updatedAt: mockDocument.updatedAt,
      });
    });

    it('should create a document in the topic space when topicId is provided', async () => {
      mockTopicModel.findById.mockResolvedValue({ id: 'topic-1', spaceId: 'spc_topic' });
      mockDocumentModel.create.mockResolvedValue(mockDocument);
      mockDocumentModel.findById.mockResolvedValue({
        ...mockDocument,
        contentUid: 'res_doc_1',
        spaceId: 'spc_topic',
      });

      await service.createDocument({
        content: '# Hello',
        fileType: 'markdown',
        source: 'notebook:topic-1',
        sourceType: 'api',
        title: 'Test Doc',
        topicId: 'topic-1',
        totalCharCount: 7,
        totalLineCount: 1,
      });

      expect(mockTopicModel.findById).toHaveBeenCalledWith('topic-1');
      expect(mockDocumentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'spc_topic',
        }),
      );
      expect(mockResourceModel.ensureContentRegistry).toHaveBeenCalledWith({
        createdBy: mockUserId,
        kind: 'document',
        localId: 'doc-1',
        spaceId: 'spc_topic',
      });
      expect(mockSpaceModel.findAccessibleSpaceById).toHaveBeenCalledWith('spc_topic');
      expect(mockSpaceModel.getOrCreatePersonalSpace).not.toHaveBeenCalled();
    });

    it('should throw when topicId is provided but topic does not exist', async () => {
      mockTopicModel.findById.mockResolvedValue(undefined);

      await expect(
        service.createDocument({
          content: '# Hello',
          fileType: 'markdown',
          source: 'notebook:missing-topic',
          sourceType: 'api',
          title: 'Test Doc',
          topicId: 'missing-topic',
          totalCharCount: 7,
          totalLineCount: 1,
        }),
      ).rejects.toThrow('Topic not found: missing-topic');
    });

    it('should reject inaccessible topic spaces before writing the document', async () => {
      mockTopicModel.findById.mockResolvedValue({ id: 'topic-1', spaceId: 'spc_blocked' });
      mockSpaceModel.findAccessibleSpaceById.mockResolvedValue(undefined);

      await expect(
        service.createDocument({
          content: '# Hello',
          fileType: 'markdown',
          source: 'notebook:topic-1',
          sourceType: 'api',
          title: 'Test Doc',
          topicId: 'topic-1',
          totalCharCount: 7,
          totalLineCount: 1,
        }),
      ).rejects.toThrow('SPACE_ACCESS_DENIED');

      expect(mockDocumentModel.create).not.toHaveBeenCalled();
    });

    it('should reject viewer-only topic spaces before writing the document', async () => {
      mockTopicModel.findById.mockResolvedValue({ id: 'topic-1', spaceId: 'spc_viewer' });
      mockSpaceModel.findAccessibleSpaceById.mockResolvedValue({
        id: 'spc_viewer',
        membershipRole: 'viewer',
      });

      await expect(
        service.createDocument({
          content: '# Hello',
          fileType: 'markdown',
          source: 'notebook:topic-1',
          sourceType: 'api',
          title: 'Test Doc',
          topicId: 'topic-1',
          totalCharCount: 7,
          totalLineCount: 1,
        }),
      ).rejects.toThrow('SPACE_WRITE_DENIED');

      expect(mockDocumentModel.create).not.toHaveBeenCalled();
    });

    it('should convert topic sourceType to api', async () => {
      mockDocumentModel.create.mockResolvedValue({
        ...mockDocument,
        sourceType: 'topic',
      });
      mockDocumentModel.findById.mockResolvedValue({
        ...mockDocument,
        sourceType: 'topic',
      });

      const result = await service.createDocument({
        content: 'test',
        fileType: 'markdown',
        source: 'test',
        sourceType: 'api',
        title: 'test',
        totalCharCount: 4,
        totalLineCount: 1,
      });

      expect(result.sourceType).toBe('api');
    });
  });

  describe('getDocument', () => {
    it('should return document when found', async () => {
      mockDocumentModel.findById.mockResolvedValue(mockDocument);

      const result = await service.getDocument('doc-1');

      expect(mockDocumentModel.findById).toHaveBeenCalledWith('doc-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('doc-1');
    });

    it('should return undefined when not found', async () => {
      mockDocumentModel.findById.mockResolvedValue(undefined);

      const result = await service.getDocument('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('updateDocument', () => {
    it('should update content and recalculate stats', async () => {
      const newContent = 'line1\nline2\nline3';
      mockDocumentModel.update.mockResolvedValue(undefined);
      mockDocumentModel.findById.mockResolvedValue({
        ...mockDocument,
        content: newContent,
        totalCharCount: newContent.length,
        totalLineCount: 3,
      });

      const result = await service.updateDocument('doc-1', { content: newContent });

      expect(mockDocumentModel.update).toHaveBeenCalledWith('doc-1', {
        content: newContent,
        totalCharCount: newContent.length,
        totalLineCount: 3,
      });
      expect(result.content).toBe(newContent);
    });

    it('should update title only', async () => {
      mockDocumentModel.update.mockResolvedValue(undefined);
      mockDocumentModel.findById.mockResolvedValue({
        ...mockDocument,
        title: 'New Title',
      });

      const result = await service.updateDocument('doc-1', { title: 'New Title' });

      expect(mockDocumentModel.update).toHaveBeenCalledWith('doc-1', { title: 'New Title' });
      expect(result.title).toBe('New Title');
    });

    it('should throw if document not found after update', async () => {
      mockDocumentModel.update.mockResolvedValue(undefined);
      mockDocumentModel.findById.mockResolvedValue(undefined);

      await expect(service.updateDocument('doc-1', { title: 'x' })).rejects.toThrow(
        'Document not found after update: doc-1',
      );
    });
  });

  describe('deleteDocument', () => {
    it('should delete associations first then the document', async () => {
      mockTopicDocumentModel.deleteByDocumentId.mockResolvedValue(undefined);
      mockDocumentModel.delete.mockResolvedValue(undefined);

      await service.deleteDocument('doc-1');

      expect(mockTopicDocumentModel.deleteByDocumentId).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentModel.delete).toHaveBeenCalledWith('doc-1');
    });
  });

  describe('associateDocumentWithTopic', () => {
    it('should associate document with topic', async () => {
      mockTopicDocumentModel.associate.mockResolvedValue({
        documentId: 'doc-1',
        topicId: 'topic-1',
      });

      await service.associateDocumentWithTopic('doc-1', 'topic-1');

      expect(mockTopicDocumentModel.associate).toHaveBeenCalledWith({
        documentId: 'doc-1',
        topicId: 'topic-1',
      });
    });
  });

  describe('getDocumentsByTopicId', () => {
    it('should return documents for a topic', async () => {
      mockTopicDocumentModel.findByTopicId.mockResolvedValue([mockDocument]);

      const result = await service.getDocumentsByTopicId('topic-1');

      expect(mockTopicDocumentModel.findByTopicId).toHaveBeenCalledWith('topic-1', undefined);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc-1');
    });

    it('should pass filter to findByTopicId', async () => {
      mockTopicDocumentModel.findByTopicId.mockResolvedValue([]);

      await service.getDocumentsByTopicId('topic-1', { type: 'markdown' });

      expect(mockTopicDocumentModel.findByTopicId).toHaveBeenCalledWith('topic-1', {
        type: 'markdown',
      });
    });
  });
});

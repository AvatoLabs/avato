import { type LobeChatDatabase } from '@lobechat/database';

import { ContentModel } from '@/database/models/content';
import { DocumentModel } from '@/database/models/document';
import { SpaceModel } from '@/database/models/space';
import { TopicModel } from '@/database/models/topic';
import { TopicDocumentModel } from '@/database/models/topicDocument';

interface DocumentServiceResult {
  content: string | null;
  createdAt: Date;
  description: string | null;
  fileType: string;
  id: string;
  source: string;
  sourceType: 'api' | 'file' | 'web';
  title: string | null;
  totalCharCount: number;
  updatedAt: Date;
}

export interface NotebookRuntimeServiceOptions {
  serverDB: LobeChatDatabase;
  userId: string;
}

const toServiceResult = (doc: {
  content: string | null;
  createdAt: Date;
  description: string | null;
  fileType: string;
  id: string;
  source: string;
  sourceType: 'api' | 'file' | 'web' | 'topic';
  title: string | null;
  totalCharCount: number;
  updatedAt: Date;
}): DocumentServiceResult => ({
  content: doc.content,
  createdAt: doc.createdAt,
  description: doc.description,
  fileType: doc.fileType,
  id: doc.id,
  source: doc.source,
  sourceType: doc.sourceType === 'topic' ? 'api' : doc.sourceType,
  title: doc.title,
  totalCharCount: doc.totalCharCount,
  updatedAt: doc.updatedAt,
});

export class NotebookRuntimeService {
  private documentModel: DocumentModel;
  private contentModel: ContentModel;
  private spaceModel: SpaceModel;
  private topicModel: TopicModel;
  private topicDocumentModel: TopicDocumentModel;
  private userId: string;

  constructor(options: NotebookRuntimeServiceOptions) {
    this.userId = options.userId;
    this.documentModel = new DocumentModel(options.serverDB, options.userId);
    this.contentModel = new ContentModel(options.serverDB, options.userId);
    this.spaceModel = new SpaceModel(options.serverDB, options.userId);
    this.topicModel = new TopicModel(options.serverDB, options.userId);
    this.topicDocumentModel = new TopicDocumentModel(options.serverDB, options.userId);
  }

  associateDocumentWithTopic = async (documentId: string, topicId: string): Promise<void> => {
    await this.topicDocumentModel.associate({ documentId, topicId });
  };

  createDocument = async (params: {
    content: string;
    fileType: string;
    source: string;
    sourceType: 'api' | 'file' | 'web';
    title: string;
    topicId?: string;
    totalCharCount: number;
    totalLineCount: number;
  }): Promise<DocumentServiceResult> => {
    const { topicId, ...documentParams } = params;
    const topic = topicId ? await this.topicModel.findById(topicId) : undefined;

    if (topicId && !topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    let spaceId = topic?.spaceId;
    if (spaceId) {
      const space = await this.spaceModel.findAccessibleSpaceById(spaceId);
      if (!space?.id) {
        throw new Error('SPACE_ACCESS_DENIED');
      }

      if (space.membershipRole === 'viewer') {
        throw new Error('SPACE_WRITE_DENIED');
      }

      spaceId = space.id;
    } else {
      spaceId = (await this.spaceModel.getOrCreatePersonalSpace()).id;
    }

    const doc = await this.documentModel.create({ ...documentParams, spaceId });
    const registry = await this.contentModel.ensureContentRegistry({
      createdBy: this.userId,
      kind: 'document',
      localId: doc.id,
      spaceId,
    });

    await this.documentModel.update(doc.id, {
      contentUid: registry.contentUid,
      spaceId,
    } as any);

    await this.contentModel.ensureOwnerPermission({
      contentUid: registry.contentUid,
      spaceId,
    });

    const updatedDoc = await this.documentModel.findById(doc.id);

    return toServiceResult(updatedDoc || { ...doc, contentUid: registry.contentUid, spaceId });
  };

  deleteDocument = async (id: string): Promise<void> => {
    await this.topicDocumentModel.deleteByDocumentId(id);
    await this.documentModel.delete(id);
  };

  getDocument = async (id: string): Promise<DocumentServiceResult | undefined> => {
    const doc = await this.documentModel.findById(id);
    if (!doc) return undefined;
    return toServiceResult(doc);
  };

  getDocumentsByTopicId = async (
    topicId: string,
    filter?: { type?: string },
  ): Promise<DocumentServiceResult[]> => {
    const docs = await this.topicDocumentModel.findByTopicId(topicId, filter);
    return docs.map(toServiceResult);
  };

  updateDocument = async (
    id: string,
    params: { content?: string; title?: string },
  ): Promise<DocumentServiceResult> => {
    await this.documentModel.update(id, {
      ...(params.content !== undefined && {
        content: params.content,
        totalCharCount: params.content.length,
        totalLineCount: params.content.split('\n').length,
      }),
      ...(params.title !== undefined && { title: params.title }),
    });

    const doc = await this.documentModel.findById(id);
    if (!doc) throw new Error(`Document not found after update: ${id}`);
    return toServiceResult(doc);
  };
}

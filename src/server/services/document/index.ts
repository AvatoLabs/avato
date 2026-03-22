import { type LobeChatDatabase } from '@lobechat/database';
import { type DocumentItem } from '@lobechat/database/schemas';
import { documents, files } from '@lobechat/database/schemas';
import { loadFile } from '@lobechat/file-loaders';
import { TRPCError } from '@trpc/server';
import debug from 'debug';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { ResourceModel } from '@/database/models/resource';
import { SpaceModel } from '@/database/models/space';
import { type LobeDocument } from '@/types/document';

import { FileService } from '../file';
import { AuthorizedResourceResolver, ResourceAuthorizer, TreeGuard } from '../resource';

const log = debug('lobe-chat:service:document');

export class DocumentService {
  userId: string;
  private fileModel: FileModel;
  private documentModel: DocumentModel;
  private fileService: FileService;
  private db: LobeChatDatabase;
  private resourceModel: ResourceModel;
  private resolver: AuthorizedResourceResolver;
  private resourceAuthorizer: ResourceAuthorizer;
  private spaceModel: SpaceModel;
  private treeGuard: TreeGuard;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
    this.fileModel = new FileModel(db, userId);
    this.fileService = new FileService(db, userId);
    this.documentModel = new DocumentModel(db, userId);
    this.resourceModel = new ResourceModel(db, userId);
    this.resolver = new AuthorizedResourceResolver(db, userId);
    this.resourceAuthorizer = new ResourceAuthorizer(db, userId);
    this.spaceModel = new SpaceModel(db, userId);
    this.treeGuard = new TreeGuard(db, userId);
  }

  private resolveWriteSpaceId = async (params: {
    knowledgeBaseId?: string;
    parentId?: string;
    spaceId?: string;
  }) => {
    if (params.knowledgeBaseId) {
      const knowledgeBase = await this.resolver.requireKnowledgeBase(
        params.knowledgeBaseId,
        'create_child',
      );
      return knowledgeBase.spaceId || (await this.spaceModel.getOrCreatePersonalSpace()).id;
    }

    if (params.parentId) {
      const parent = await this.resolver.requireDocument(params.parentId, 'create_child');
      return parent.spaceId || (await this.spaceModel.getOrCreatePersonalSpace()).id;
    }

    if (params.spaceId) {
      const space = await this.spaceModel.findAccessibleSpaceById(params.spaceId);
      if (!space?.id) {
        throw new Error('SPACE_ACCESS_DENIED');
      }

      if (space.membershipRole === 'viewer') {
        throw new Error('SPACE_WRITE_DENIED');
      }

      return space.id;
    }

    return (await this.spaceModel.getOrCreatePersonalSpace()).id;
  };

  /**
   * Create a document
   */
  async createDocument(params: {
    content?: string;
    editorData: Record<string, any>;
    fileType?: string;
    knowledgeBaseId?: string;
    metadata?: Record<string, any>;
    parentId?: string;
    rawData?: string;
    slug?: string;
    spaceId?: string;
    title: string;
  }): Promise<DocumentItem> {
    const {
      content,
      editorData,
      title,
      fileType = 'custom/document',
      metadata,
      knowledgeBaseId,
      parentId,
      spaceId: inputSpaceId,
      slug,
    } = params;

    const spaceId = await this.resolveWriteSpaceId({
      knowledgeBaseId,
      parentId,
      spaceId: inputSpaceId,
    });

    await this.treeGuard.assertParentAssignment({
      currentSpaceId: spaceId,
      parentId,
    });

    // Calculate character and line counts
    const totalCharCount = content?.length || 0;
    const totalLineCount = content?.split('\n').length || 0;

    let fileId: string | null = null;

    // If creating in a knowledge base, create a corresponding file record
    // BUT skip for folders - folders should only exist in the documents table
    if (knowledgeBaseId && fileType !== 'custom/folder') {
      const file = await this.fileModel.create(
        {
          fileType,
          metadata,
          knowledgeBaseId,
          name: title,
          parentId,
          size: totalCharCount,
          spaceId,
          url: `internal://document/placeholder`, // Placeholder URL
        },
        false, // Do not insert to global files
      );
      fileId = file.id;

      const fileRegistry = await this.resourceModel.ensureResourceRegistry({
        createdBy: this.userId,
        kind: 'file',
        localId: file.id,
        spaceId,
      });

      await this.fileModel.update(file.id, {
        resourceUid: fileRegistry.resourceUid,
        spaceId,
      } as any);

      await this.resourceModel.ensureOwnerPermission({
        resourceUid: fileRegistry.resourceUid,
        spaceId,
      });
    }

    // Store knowledgeBaseId in metadata for folders (which don't have fileId)
    const finalMetadata =
      knowledgeBaseId && fileType === 'custom/folder' ? { ...metadata, knowledgeBaseId } : metadata;

    const document = await this.documentModel.create({
      content,
      editorData,
      fileId,
      fileType,
      filename: title,
      knowledgeBaseId, // Set knowledge_base_id column for all document types
      metadata: finalMetadata,
      pages: undefined,
      parentId,
      spaceId,
      slug,
      source: 'document',
      sourceType: 'api',
      title,
      totalCharCount,
      totalLineCount,
    });

    const registry = await this.resourceModel.ensureResourceRegistry({
      createdBy: this.userId,
      kind: 'document',
      localId: document.id,
      spaceId,
    });

    await this.documentModel.update(document.id, {
      resourceUid: registry.resourceUid,
      spaceId,
    } as any);

    await this.resourceModel.ensureOwnerPermission({
      resourceUid: registry.resourceUid,
      spaceId,
    });

    return document;
  }

  /**
   * Create multiple documents in batch (optimized for folder creation)
   * Returns array of created documents with same order as input
   */
  async createDocuments(
    documents: Array<{
      content?: string;
      editorData: Record<string, any>;
      fileType?: string;
      knowledgeBaseId?: string;
      metadata?: Record<string, any>;
      parentId?: string;
      spaceId?: string;
      slug?: string;
      title: string;
    }>,
  ): Promise<DocumentItem[]> {
    // Create all documents in parallel for better performance
    const results = await Promise.all(documents.map((params) => this.createDocument(params)));

    return results;
  }

  /**
   * Query documents with pagination
   */
  async queryDocuments(params?: {
    current?: number;
    fileTypes?: string[];
    knowledgeBaseId?: string;
    pageSize?: number;
    sourceTypes?: string[];
    trash?: boolean;
  }) {
    return this.documentModel.query(params);
  }

  /**
   * Get document by ID
   */
  async getDocumentById(id: string) {
    await this.resolver.requireDocument(id, 'read_metadata');
    return this.documentModel.findByIdAny(id);
  }

  private chunk<T>(items: T[], size = 200): T[][] {
    if (items.length <= size) return [items];

    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  }

  private async collectDocumentsForDeletion(rootIds: string[]): Promise<{
    documentIds: string[];
    fileIds: string[];
    folderIds: string[];
  }> {
    const dedupRootIds = [...new Set(rootIds)].filter(Boolean);
    if (dedupRootIds.length === 0) return { documentIds: [], fileIds: [], folderIds: [] };

    const rootDocuments = await this.db.query.documents.findMany({
      columns: {
        fileId: true,
        fileType: true,
        id: true,
      },
      where: and(inArray(documents.id, dedupRootIds), isNull(documents.deletedAt)),
    });

    const rootMap = new Map(rootDocuments.map((doc) => [doc.id, doc] as const));
    const resolvedRootDocuments = [...rootMap.values()];
    if (resolvedRootDocuments.length === 0) return { documentIds: [], fileIds: [], folderIds: [] };

    const allDocuments = new Map(resolvedRootDocuments.map((doc) => [doc.id, doc] as const));
    let folderQueue = resolvedRootDocuments
      .filter((doc) => doc.fileType === 'custom/folder')
      .map((doc) => doc.id);

    while (folderQueue.length > 0) {
      const nextFolderQueue: string[] = [];

      for (const folderChunk of this.chunk(folderQueue)) {
        const children = await this.db.query.documents.findMany({
          columns: {
            fileId: true,
            fileType: true,
            id: true,
          },
          where: and(inArray(documents.parentId, folderChunk), isNull(documents.deletedAt)),
        });

        for (const child of children) {
          let resolvedChild = child;
          if (!resolvedChild.fileType) {
            const fallbackChild = await this.documentModel.findByIdAny(child.id);
            if (!fallbackChild) continue;
            resolvedChild = {
              fileId: fallbackChild.fileId,
              fileType: fallbackChild.fileType,
              id: fallbackChild.id,
            };
          }

          if (allDocuments.has(resolvedChild.id)) continue;
          allDocuments.set(resolvedChild.id, resolvedChild);
          if (resolvedChild.fileType === 'custom/folder') {
            nextFolderQueue.push(resolvedChild.id);
          }
        }
      }

      folderQueue = nextFolderQueue;
    }

    const allDocs = [...allDocuments.values()];
    const folderIds = allDocs
      .filter((doc) => doc.fileType === 'custom/folder')
      .map((doc) => doc.id);

    const fileIds = new Set(allDocs.map((doc) => doc.fileId).filter(Boolean) as string[]);

    if (folderIds.length > 0) {
      for (const folderChunk of this.chunk(folderIds)) {
        const childFiles = await this.db.query.files.findMany({
          columns: { id: true },
          where: inArray(files.parentId, folderChunk),
        });
        for (const file of childFiles) {
          fileIds.add(file.id);
        }
      }
    }

    return {
      documentIds: allDocs.map((doc) => doc.id),
      fileIds: [...fileIds],
      folderIds,
    };
  }

  /**
   * Delete document (recursively deletes children if it's a folder)
   */
  async deleteDocument(id: string) {
    return this.deleteDocuments([id]);
  }

  /**
   * Delete multiple documents in batch
   */
  async deleteDocuments(ids: string[]) {
    const dedupIds = [...new Set(ids)].filter(Boolean);
    if (dedupIds.length === 0) return;

    for (const id of dedupIds) {
      await this.resolver.requireDocument(id, 'delete');
    }

    const { documentIds, fileIds } = await this.collectDocumentsForDeletion(dedupIds);
    if (documentIds.length === 0) return;

    const bumpEntries: Array<{ resourceUid?: string | null; spaceId?: string | null }> = [];

    if (fileIds.length > 0) {
      const fileRows = await this.db.query.files.findMany({
        columns: { resourceUid: true, spaceId: true },
        where: inArray(files.id, fileIds),
      });
      bumpEntries.push(
        ...fileRows.map((r) => ({ resourceUid: r.resourceUid, spaceId: r.spaceId })),
      );
    }

    const docRows = await this.db.query.documents.findMany({
      columns: { resourceUid: true, spaceId: true },
      where: inArray(documents.id, documentIds),
    });
    bumpEntries.push(...docRows.map((r) => ({ resourceUid: r.resourceUid, spaceId: r.spaceId })));

    if (fileIds.length > 0) {
      await this.fileModel.deleteManyAny(fileIds);
    }

    if (typeof (this.db as any).delete === 'function') {
      const now = new Date();
      for (const idChunk of this.chunk(documentIds)) {
        await this.db
          .update(documents)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(inArray(documents.id, idChunk), isNull(documents.deletedAt)));
      }
      await this.resourceModel.invalidateAuthzEpochsAfterRemoval(bumpEntries);
      return;
    }

    await this.documentModel.deleteManyAny(documentIds);
    await this.resourceModel.invalidateAuthzEpochsAfterRemoval(bumpEntries);
  }

  /**
   * Clear soft-delete (restore). Requires same capability as delete; ACL rows are unchanged.
   */
  async restoreDocument(id: string) {
    await this.resourceAuthorizer.assertCapability({
      capability: 'delete',
      documentIncludeDeleted: true,
      id,
      kind: 'document',
    });

    const [tomb] = await this.db
      .select({
        id: documents.id,
        resourceUid: documents.resourceUid,
        spaceId: documents.spaceId,
      })
      .from(documents)
      .where(and(eq(documents.id, id), isNotNull(documents.deletedAt)))
      .limit(1);

    if (!tomb) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'DOCUMENT_NOT_FOUND' });
    }

    const now = new Date();
    await this.db
      .update(documents)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(documents.id, id));

    await this.resourceModel.invalidateAuthzEpochsAfterRemoval([
      { resourceUid: tomb.resourceUid, spaceId: tomb.spaceId },
    ]);

    return this.documentModel.findByIdAny(id);
  }

  /**
   * Update document
   */
  async updateDocument(
    id: string,
    params: {
      content?: string;
      editorData?: Record<string, any>;
      fileType?: string;
      metadata?: Record<string, any>;
      parentId?: string | null;
      title?: string;
    },
  ) {
    const currentDocument = await this.resolver.requireDocument(id, 'move');

    if (params.parentId !== undefined) {
      await this.treeGuard.assertParentAssignment({
        currentSpaceId: currentDocument.spaceId,
        parentId: params.parentId || null,
      });
    }

    const updates: any = {};

    if (params.content !== undefined) {
      updates.content = params.content;
      updates.totalCharCount = params.content.length;
      updates.totalLineCount = params.content.split('\n').length;
    }

    if (params.editorData !== undefined) {
      updates.editorData = params.editorData;
    }

    if (params.fileType !== undefined) {
      updates.fileType = params.fileType;
    }

    if (params.title !== undefined) {
      updates.title = params.title;
      updates.filename = params.title;
    }

    if (params.metadata !== undefined) {
      updates.metadata = params.metadata;
    }

    if (params.parentId !== undefined) {
      updates.parentId = params.parentId;
    }

    const result = await this.documentModel.updateAny(id, updates);

    if (params.parentId !== undefined) {
      const row = await this.documentModel.findByIdAny(id);
      await this.resourceModel.invalidateAuthzEpochsAfterRemoval([
        { resourceUid: row?.resourceUid, spaceId: row?.spaceId },
      ]);
    }

    // If title was updated and this document has an associated file, update the file name too
    if (params.title !== undefined || params.parentId !== undefined) {
      const document = await this.documentModel.findByIdAny(id);
      if (document?.fileId) {
        const fileUpdates: any = {};
        if (params.title !== undefined) fileUpdates.name = params.title;
        if (params.parentId !== undefined) fileUpdates.parentId = params.parentId;
        await this.fileModel.updateAny(document.fileId, fileUpdates);
      }
    }

    return result;
  }

  /**
   * Parse file and create a document for page editor (without page tags)
   */
  async parseDocument(fileId: string): Promise<LobeDocument> {
    const { filePath, file, cleanup } = await this.fileService.downloadFileToLocal(
      fileId,
      'preview_content',
    );

    const logPrefix = `[${file.name}]`;
    log(`${logPrefix} Starting to parse file as document, path: ${filePath}`);

    try {
      // Use loadFile to load file content
      const fileDocument = await loadFile(filePath);

      log(`${logPrefix} File parsed successfully %O`, {
        fileType: fileDocument.fileType,
        size: fileDocument.content.length,
      });

      // Extract title from metadata or use file name (remove extension)
      const title =
        fileDocument.metadata?.title ||
        file.name.replace(/\.(pdf|docx?|md|markdown)$/i, '') ||
        'Untitled';

      // Clean up content - remove <page> tags if present
      let cleanContent = fileDocument.content;
      if (cleanContent.includes('<page')) {
        cleanContent = cleanContent.replaceAll(/<page[^>]*>([\S\s]*?)<\/page>/g, '$1').trim();
      }

      const document = await this.documentModel.create({
        content: cleanContent,
        fileId,
        fileType: 'custom/document',
        filename: title,
        metadata: fileDocument.metadata,
        parentId: file.parentId,
        spaceId: file.spaceId,
        source: file.url,
        sourceType: 'file',
        title,
        totalCharCount: cleanContent.length,
        totalLineCount: cleanContent.split('\n').length,
      });

      if (file.spaceId) {
        const registry = await this.resourceModel.ensureResourceRegistry({
          createdBy: this.userId,
          kind: 'document',
          localId: document.id,
          spaceId: file.spaceId,
        });

        await this.documentModel.update(document.id, {
          resourceUid: registry.resourceUid,
          spaceId: file.spaceId,
        } as any);

        await this.resourceModel.ensureOwnerPermission({
          resourceUid: registry.resourceUid,
          spaceId: file.spaceId,
        });
      }

      return document as LobeDocument;
    } catch (error) {
      console.error(`${logPrefix} File parsing failed:`, error);
      throw error;
    } finally {
      cleanup();
    }
  }

  /**
   * Parse file content
   *
   */
  async parseFile(fileId: string): Promise<LobeDocument> {
    const { filePath, file, cleanup } = await this.fileService.downloadFileToLocal(
      fileId,
      'preview_content',
    );

    const logPrefix = `[${file.name}]`;
    log(`${logPrefix} Starting to parse file, path: ${filePath}`);

    try {
      // Use loadFile to load file content
      const fileDocument = await loadFile(filePath);

      log(`${logPrefix} File parsed successfully %O`, {
        fileType: fileDocument.fileType,
        size: fileDocument.content.length,
      });

      // Extract title from metadata or use file name (remove extension)
      const title =
        fileDocument.metadata?.title ||
        file.name.replace(/\.(pdf|docx?|md|markdown)$/i, '') ||
        'Untitled';

      const document = await this.documentModel.create({
        content: fileDocument.content,
        fileId,
        fileType: 'custom/document', // Use custom/document for all parsed files
        filename: title,
        metadata: fileDocument.metadata,
        pages: fileDocument.pages,
        parentId: file.parentId,
        spaceId: file.spaceId,
        source: file.url,
        sourceType: 'file',
        title,
        totalCharCount: fileDocument.totalCharCount,
        totalLineCount: fileDocument.totalLineCount,
      });

      if (file.spaceId) {
        const registry = await this.resourceModel.ensureResourceRegistry({
          createdBy: this.userId,
          kind: 'document',
          localId: document.id,
          spaceId: file.spaceId,
        });

        await this.documentModel.update(document.id, {
          resourceUid: registry.resourceUid,
          spaceId: file.spaceId,
        } as any);

        await this.resourceModel.ensureOwnerPermission({
          resourceUid: registry.resourceUid,
          spaceId: file.spaceId,
        });
      }

      return document as LobeDocument;
    } catch (error) {
      console.error(`${logPrefix} File parsing failed:`, error);
      throw error;
    } finally {
      cleanup();
    }
  }
}

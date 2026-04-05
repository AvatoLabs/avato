import { type LobeChatDatabase } from '@lobechat/database';
import { type DocumentItem } from '@lobechat/database/schemas';
import { loadFile } from '@lobechat/file-loaders';
import { TRPCError } from '@trpc/server';
import debug from 'debug';

import { serverDBEnv } from '@/config/db';
import { ContentModel } from '@/database/models/content';
import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { SpaceModel } from '@/database/models/space';
import { DocumentSourceType, type LobeDocument } from '@/types/document';

import { ChunkService } from '../chunk';
import { AuthorizedResourceResolver, ContentAuthorizer, TreeGuard } from '../content';
import { FileService } from '../file';
import { resolveRemovableStorageUrls } from '../file/removableStorageUrls';

const log = debug('lobe-chat:service:document');

const getDocumentTitle = (filename: string, metadataTitle?: string | null) => {
  if (metadataTitle?.trim()) return metadataTitle;

  const stripped = filename.replace(/\.[^.]+$/, '').trim();
  return stripped || 'Untitled';
};

export class DocumentService {
  userId: string;
  private fileModel: FileModel;
  private documentModel: DocumentModel;
  private chunkService: ChunkService;
  private fileService: FileService;
  private db: LobeChatDatabase;
  private contentModel: ContentModel;
  private resolver: AuthorizedResourceResolver;
  private contentAuthorizer: ContentAuthorizer;
  private spaceModel: SpaceModel;
  private treeGuard: TreeGuard;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
    this.fileModel = new FileModel(db, userId);
    this.chunkService = new ChunkService(db, userId);
    this.fileService = new FileService(db, userId);
    this.documentModel = new DocumentModel(db, userId);
    this.contentModel = new ContentModel(db, userId);
    this.resolver = new AuthorizedResourceResolver(db, userId);
    this.contentAuthorizer = new ContentAuthorizer(db, userId);
    this.spaceModel = new SpaceModel(db, userId);
    this.treeGuard = new TreeGuard(db, userId);
  }

  private resolveWriteSpaceId = async (params: {
    sourceSetId?: string;
    parentId?: string;
    spaceId?: string;
  }) => {
    if (params.sourceSetId) {
      const sourceSet = await this.resolver.requireSourceSet(params.sourceSetId, 'create_child');
      return sourceSet.spaceId || (await this.spaceModel.getOrCreatePersonalSpace()).id;
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
    sourceSetId?: string;
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
      sourceSetId,
      parentId,
      spaceId: inputSpaceId,
      slug,
    } = params;

    const spaceId = await this.resolveWriteSpaceId({
      sourceSetId,
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

    // If creating inside a source set, create the corresponding mirror file.
    // Folders stay document-only.
    if (sourceSetId && fileType !== 'custom/folder') {
      const file = await this.fileModel.create(
        {
          fileType,
          metadata,
          sourceSetId,
          name: title,
          parentId,
          size: totalCharCount,
          spaceId,
          url: `internal://document/placeholder`, // Placeholder URL
        },
        false, // Do not insert to global files
      );
      fileId = file.id;

      const fileRegistry = await this.contentModel.ensureContentRegistry({
        createdBy: this.userId,
        kind: 'file',
        localId: file.id,
        spaceId,
      });

      await this.fileModel.update(file.id, {
        contentUid: fileRegistry.contentUid,
        spaceId,
      } as any);

      await this.contentModel.ensureOwnerPermission({
        contentUid: fileRegistry.contentUid,
        spaceId,
      });
    }

    // Preserve sourceSetId in folder metadata because folders do not have mirror files.
    const finalMetadata =
      sourceSetId && fileType === 'custom/folder' ? { ...metadata, sourceSetId } : metadata;

    const document = await this.documentModel.create({
      content,
      editorData,
      fileId,
      fileType,
      filename: title,
      sourceSetId, // Set source_set_id column for all document types
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

    if (fileId) {
      await this.fileModel.updateAny(fileId, {
        url: `internal://document/${document.id}`,
      });
    }

    const registry = await this.contentModel.ensureContentRegistry({
      createdBy: this.userId,
      kind: 'document',
      localId: document.id,
      spaceId,
    });

    await this.documentModel.update(document.id, {
      contentUid: registry.contentUid,
      spaceId,
    } as any);

    await this.contentModel.ensureOwnerPermission({
      contentUid: registry.contentUid,
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
      sourceSetId?: string;
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
    sourceSetId?: string;
    pageSize?: number;
    spaceId?: string;
    sourceTypes?: string[];
    trash?: boolean;
  }) {
    if (!params?.spaceId) {
      return this.documentModel.query(params);
    }

    const candidateIds = await this.documentModel.queryIds({
      fileTypes: params.fileTypes,
      sourceSetId: params.sourceSetId,
      sourceTypes: params.sourceTypes,
      spaceId: params.spaceId,
      trash: params.trash,
    });
    const visibleIds = await this.contentAuthorizer.filterVisibleDocumentIdsForList(candidateIds, {
      documentIncludeDeleted: params.trash,
    });
    const current = params.current ?? 0;
    const pageSize = params.pageSize ?? 9999;
    const pagedIds = visibleIds.slice(current * pageSize, (current + 1) * pageSize);

    if (pagedIds.length === 0) {
      return { items: [], total: visibleIds.length };
    }

    const result = await this.documentModel.query({
      ...params,
      current: 0,
      ids: pagedIds,
      pageSize,
    });

    return { items: result.items, total: visibleIds.length };
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

  private async collectDocumentsForDeletion(
    rootIds: string[],
    options?: { includeDeleted?: boolean },
  ): Promise<{
    documentIds: string[];
    fileIds: string[];
    folderIds: string[];
  }> {
    interface DeletionDocumentNode {
      fileId: string | null;
      fileType: string | null;
      id: string;
    }

    const dedupRootIds = [...new Set(rootIds)].filter(Boolean);
    if (dedupRootIds.length === 0) return { documentIds: [], fileIds: [], folderIds: [] };

    const rootDocuments: DeletionDocumentNode[] = await this.db.query.documents.findMany({
      columns: {
        fileId: true,
        fileType: true,
        id: true,
      },
      where: (fields, { and, inArray, isNull }) =>
        options?.includeDeleted
          ? inArray(fields.id, dedupRootIds)
          : and(inArray(fields.id, dedupRootIds), isNull(fields.deletedAt)),
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
        const children: DeletionDocumentNode[] = await this.db.query.documents.findMany({
          columns: {
            fileId: true,
            fileType: true,
            id: true,
          },
          where: (fields, { and, inArray, isNull }) =>
            options?.includeDeleted
              ? inArray(fields.parentId, folderChunk)
              : and(inArray(fields.parentId, folderChunk), isNull(fields.deletedAt)),
        });

        for (const child of children) {
          let resolvedChild: DeletionDocumentNode = child;
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
          where: (fields, { inArray }) => inArray(fields.parentId, folderChunk),
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
   * @param id Document ID
   * @param trash If true, soft delete (move to trash). If false, hard delete. Default: true
   */
  async deleteDocument(id: string, trash: boolean = true) {
    return this.deleteDocuments([id], trash);
  }

  /**
   * Delete multiple documents in batch
   * @param ids Document IDs
   * @param trash If true, soft delete (move to trash). If false, hard delete. Default: true
   */
  async deleteDocuments(ids: string[], trash: boolean = true) {
    const dedupIds = [...new Set(ids)].filter(Boolean);
    if (dedupIds.length === 0) return;
    const includeDeleted = !trash;

    for (const id of dedupIds) {
      if (includeDeleted) {
        await this.contentAuthorizer.assertCapability({
          capability: 'delete',
          documentIncludeDeleted: true,
          id,
          kind: 'document',
        });
      } else {
        await this.resolver.requireDocument(id, 'delete');
      }
    }

    const { documentIds, fileIds } = await this.collectDocumentsForDeletion(dedupIds, {
      includeDeleted,
    });
    if (documentIds.length === 0) return;

    const bumpEntries: Array<{ contentUid?: string | null; spaceId?: string | null }> = [];
    const fileRowsForCleanup: Array<{
      contentUid?: string | null;
      fileHash?: string | null;
      spaceId?: string | null;
      url?: string | null;
    }> = [];

    if (fileIds.length > 0) {
      const fileRows = await this.db.query.files.findMany({
        columns: { contentUid: true, fileHash: true, spaceId: true, url: true },
        where: (fields, { inArray }) => inArray(fields.id, fileIds),
      });
      fileRowsForCleanup.push(...fileRows);
      bumpEntries.push(...fileRows.map((r) => ({ contentUid: r.contentUid, spaceId: r.spaceId })));
    }

    const docRows = await this.db.query.documents.findMany({
      columns: { contentUid: true, spaceId: true },
      where: (fields, { inArray }) => inArray(fields.id, documentIds),
    });
    bumpEntries.push(...docRows.map((r) => ({ contentUid: r.contentUid, spaceId: r.spaceId })));

    // Soft delete or hard delete based on trash parameter
    if (trash) {
      if (fileIds.length > 0) {
        await this.fileModel.softDeleteManyAny(fileIds);
      }

      await this.documentModel.deleteManyAny(documentIds);
      await this.contentModel.invalidateAuthzEpochsAfterRemoval(bumpEntries);
    } else {
      if (fileIds.length > 0) {
        await this.fileModel.deleteManyAny(fileIds, serverDBEnv.REMOVE_GLOBAL_FILE);
      }

      // Hard delete: permanently remove from database
      await this.documentModel.hardDeleteManyAny(documentIds);
      await this.contentModel.invalidateAuthzEpochsAfterRemoval(bumpEntries);

      const removableUrls = await resolveRemovableStorageUrls(
        this.fileModel,
        fileRowsForCleanup,
        serverDBEnv.REMOVE_GLOBAL_FILE,
      );

      if (removableUrls.length > 0) {
        await this.fileService.deleteFiles(removableUrls);
      }
    }
  }

  /**
   * Clear soft-delete (restore). Requires same capability as delete; ACL rows are unchanged.
   */
  async restoreDocument(id: string) {
    const [restored] = await this.restoreDocuments([id]);
    if (!restored) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'DOCUMENT_NOT_FOUND' });
    }

    return restored;
  }

  async restoreDocuments(ids: string[]) {
    const dedupIds = [...new Set(ids)].filter(Boolean);
    if (dedupIds.length === 0) return [];

    for (const id of dedupIds) {
      await this.contentAuthorizer.assertCapability({
        capability: 'delete',
        documentIncludeDeleted: true,
        id,
        kind: 'document',
      });
    }

    const { documentIds, fileIds } = await this.collectDocumentsForDeletion(dedupIds, {
      includeDeleted: true,
    });

    if (documentIds.length === 0) return [];

    const tombs = await this.db.query.documents.findMany({
      columns: {
        fileId: true,
        id: true,
        contentUid: true,
        spaceId: true,
      },
      where: (fields, { and, inArray, isNotNull }) =>
        and(inArray(fields.id, documentIds), isNotNull(fields.deletedAt)),
    });

    if (tombs.length === 0) return [];

    await this.documentModel.restoreManyAny(tombs.map((item) => item.id));

    const restoredFileRows =
      fileIds.length === 0
        ? []
        : await this.db.query.files.findMany({
            columns: {
              id: true,
              contentUid: true,
              spaceId: true,
            },
            where: (fields, { and, inArray, isNotNull }) =>
              and(inArray(fields.id, fileIds), isNotNull(fields.deletedAt)),
          });

    if (restoredFileRows.length > 0) {
      await Promise.all(
        restoredFileRows.map((item) =>
          this.fileModel.updateAny(item.id, {
            deletedAt: null,
          }),
        ),
      );
    }

    await this.contentModel.invalidateAuthzEpochsAfterRemoval([
      ...tombs.map((item) => ({ contentUid: item.contentUid, spaceId: item.spaceId })),
      ...restoredFileRows.map((item) => ({ contentUid: item.contentUid, spaceId: item.spaceId })),
    ]);

    const restored = await Promise.all(
      tombs.map((item) => this.documentModel.findByIdAny(item.id)),
    );

    return restored.filter(Boolean);
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
        itemId: currentDocument.id,
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
    const needsRefreshedDocument =
      params.title !== undefined ||
      params.parentId !== undefined ||
      params.content !== undefined ||
      params.editorData !== undefined;
    const refreshedDocument = needsRefreshedDocument
      ? await this.documentModel.findByIdAny(id)
      : null;
    const shouldReindexResource =
      (params.content !== undefined || params.editorData !== undefined) &&
      Boolean(refreshedDocument?.fileId);

    if (params.parentId !== undefined) {
      const row = await this.documentModel.findByIdAny(id);
      await this.contentModel.invalidateAuthzEpochsAfterRemoval([
        { contentUid: row?.contentUid, spaceId: row?.spaceId },
      ]);
    }

    // If title was updated and this document has an associated file, update the file name too
    if (refreshedDocument?.fileId) {
      if (
        params.title !== undefined ||
        params.parentId !== undefined ||
        params.content !== undefined
      ) {
        const fileUpdates: any = {};
        if (params.title !== undefined) fileUpdates.name = params.title;
        if (params.parentId !== undefined) fileUpdates.parentId = params.parentId;
        if (params.content !== undefined) fileUpdates.size = params.content.length;
        await this.fileModel.updateAny(refreshedDocument.fileId, fileUpdates);
      }

      if (shouldReindexResource) {
        const access = await this.contentAuthorizer.assertCapability({
          capability: 'preview_content',
          id: refreshedDocument.fileId,
          kind: 'file',
        });
        await this.fileModel.clearFileChunks([refreshedDocument.fileId]);
        await this.chunkService.asyncParseFileToChunks(refreshedDocument.fileId, false, {
          contentGuardAuthzEpoch: access.authzEpoch,
        });
      }
    }

    return result;
  }

  async ensureFileDocument(fileId: string): Promise<DocumentItem> {
    await this.resolver.requireFile(fileId, 'preview_content');

    const existingDocument = await this.documentModel.findByFileId(fileId);
    if (existingDocument) return existingDocument;

    return this.parseDocument(fileId) as Promise<DocumentItem>;
  }

  /**
   * Parse file and create a document for the doc editor (without doc tags)
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
      const title = getDocumentTitle(file.name, fileDocument.metadata?.title);

      // Clean up content - remove <page> tags if present
      let cleanContent = fileDocument.content;
      if (cleanContent.includes('<page')) {
        cleanContent = cleanContent.replaceAll(/<page[^>]*>([\S\s]*?)<\/docs>/g, '$1').trim();
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
        const registry = await this.contentModel.ensureContentRegistry({
          createdBy: this.userId,
          kind: 'document',
          localId: document.id,
          spaceId: file.spaceId,
        });

        await this.documentModel.update(document.id, {
          contentUid: registry.contentUid,
          spaceId: file.spaceId,
        } as any);

        await this.contentModel.ensureOwnerPermission({
          contentUid: registry.contentUid,
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
      const title = getDocumentTitle(file.name, fileDocument.metadata?.title);

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
        const registry = await this.contentModel.ensureContentRegistry({
          createdBy: this.userId,
          kind: 'document',
          localId: document.id,
          spaceId: file.spaceId,
        });

        await this.documentModel.update(document.id, {
          contentUid: registry.contentUid,
          spaceId: file.spaceId,
        } as any);

        await this.contentModel.ensureOwnerPermission({
          contentUid: registry.contentUid,
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

  async previewFile(fileId: string): Promise<LobeDocument> {
    const { filePath, file, cleanup } = await this.fileService.downloadFileToLocal(
      fileId,
      'preview_content',
    );

    const logPrefix = `[${file.name}]`;
    log(`${logPrefix} Starting to preview file, path: ${filePath}`);

    try {
      const fileDocument = await loadFile(filePath);
      const title = getDocumentTitle(file.name, fileDocument.metadata?.title);

      return {
        content: fileDocument.content,
        createdAt: file.createdAt,
        editorData: null,
        fileType: file.fileType,
        filename: file.name,
        id: file.id,
        metadata: fileDocument.metadata,
        pages: fileDocument.pages,
        parentId: file.parentId,
        source: file.url,
        sourceType: DocumentSourceType.FILE,
        title,
        totalCharCount: fileDocument.totalCharCount,
        totalLineCount: fileDocument.totalLineCount,
        updatedAt: file.updatedAt,
      };
    } catch (error) {
      console.error(`${logPrefix} File preview failed:`, error);
      throw error;
    } finally {
      cleanup();
    }
  }
}

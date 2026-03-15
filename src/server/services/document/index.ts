import { type LobeChatDatabase } from '@lobechat/database';
import { type DocumentItem } from '@lobechat/database/schemas';
import { documents, files } from '@lobechat/database/schemas';
import { loadFile } from '@lobechat/file-loaders';
import debug from 'debug';
import { and, eq, inArray } from 'drizzle-orm';

import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { type LobeDocument } from '@/types/document';

import { FileService } from '../file';

const log = debug('lobe-chat:service:document');

export class DocumentService {
  userId: string;
  private fileModel: FileModel;
  private documentModel: DocumentModel;
  private fileService: FileService;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
    this.fileModel = new FileModel(db, userId);
    this.fileService = new FileService(db, userId);
    this.documentModel = new DocumentModel(db, userId);
  }

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
      slug,
    } = params;

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
          knowledgeBaseId,
          metadata,
          name: title,
          parentId,
          size: totalCharCount,
          url: `internal://document/placeholder`, // Placeholder URL
        },
        false, // Do not insert to global files
      );
      fileId = file.id;
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
      slug,
      source: 'document',
      sourceType: 'api',
      title,
      totalCharCount,
      totalLineCount,
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
    pageSize?: number;
    sourceTypes?: string[];
  }) {
    return this.documentModel.query(params);
  }

  /**
   * Get document by ID
   */
  async getDocumentById(id: string) {
    return this.documentModel.findById(id);
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
      where: and(eq(documents.userId, this.userId), inArray(documents.id, dedupRootIds)),
    });

    const rootMap = new Map(rootDocuments.map((doc) => [doc.id, doc] as const));
    if (rootMap.size < dedupRootIds.length) {
      const missingRootIds = dedupRootIds.filter((id) => !rootMap.has(id));
      const fallbackRoots = await Promise.all(
        missingRootIds.map((id) => this.documentModel.findById(id)),
      );

      for (const fallbackRoot of fallbackRoots) {
        if (!fallbackRoot) continue;
        rootMap.set(fallbackRoot.id, {
          fileId: fallbackRoot.fileId,
          fileType: fallbackRoot.fileType,
          id: fallbackRoot.id,
        });
      }
    }

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
          where: and(eq(documents.userId, this.userId), inArray(documents.parentId, folderChunk)),
        });

        for (const child of children) {
          let resolvedChild = child;
          if (!resolvedChild.fileType) {
            const fallbackChild = await this.documentModel.findById(child.id);
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
          where: and(eq(files.userId, this.userId), inArray(files.parentId, folderChunk)),
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
    const { documentIds, fileIds } = await this.collectDocumentsForDeletion(ids);
    if (documentIds.length === 0) return;

    if (fileIds.length > 0) {
      if (typeof this.fileModel.deleteMany === 'function') {
        await this.fileModel.deleteMany(fileIds);
      } else {
        await Promise.all(fileIds.map((fileId) => this.fileModel.delete(fileId)));
      }
    }

    if (typeof (this.db as any).delete === 'function') {
      for (const idChunk of this.chunk(documentIds)) {
        await this.db
          .delete(documents)
          .where(and(eq(documents.userId, this.userId), inArray(documents.id, idChunk)));
      }
      return;
    }

    await Promise.all(documentIds.map((id) => this.documentModel.delete(id)));
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

    const result = await this.documentModel.update(id, updates);

    // If title was updated and this document has an associated file, update the file name too
    if (params.title !== undefined || params.parentId !== undefined) {
      const document = await this.documentModel.findById(id);
      if (document?.fileId) {
        const fileUpdates: any = {};
        if (params.title !== undefined) fileUpdates.name = params.title;
        if (params.parentId !== undefined) fileUpdates.parentId = params.parentId;
        await this.fileModel.update(document.fileId, fileUpdates);
      }
    }

    return result;
  }

  /**
   * Parse file and create a document for page editor (without page tags)
   */
  async parseDocument(fileId: string): Promise<LobeDocument> {
    const { filePath, file, cleanup } = await this.fileService.downloadFileToLocal(fileId);

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
        source: file.url,
        sourceType: 'file',
        title,
        totalCharCount: cleanContent.length,
        totalLineCount: cleanContent.split('\n').length,
      });

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
    const { filePath, file, cleanup } = await this.fileService.downloadFileToLocal(fileId);

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
        source: file.url,
        sourceType: 'file',
        title,
        totalCharCount: fileDocument.totalCharCount,
        totalLineCount: fileDocument.totalLineCount,
      });

      return document as LobeDocument;
    } catch (error) {
      console.error(`${logPrefix} File parsing failed:`, error);
      throw error;
    } finally {
      cleanup();
    }
  }
}

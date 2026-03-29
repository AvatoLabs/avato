import {
  type ContentItem,
  type ContentQueryParams,
  type CreateContentParams,
  type UpdateContentParams,
} from '@/types/content';
import { type FileListItem } from '@/types/files';

import { type CreateDocumentParams } from '../document';
import { documentService } from '../document';
import { fileService } from '../file';

/**
 * Map FileListItem to ContentItem
 */
const mapToContentItem = (item: FileListItem & { sourceSetId?: string | null }): ContentItem => {
  return {
    chunkCount: item.chunkCount,
    chunkTaskId: item.chunkingStatus ? 'placeholder' : null,
    chunkingError: item.chunkingError,
    chunkingStatus: item.chunkingStatus,
    content: item.content,
    createdAt: item.createdAt,
    editorData: item.editorData,
    embeddingError: item.embeddingError,
    embeddingStatus: item.embeddingStatus,
    embeddingTaskId: item.embeddingStatus ? 'placeholder' : null,
    fileType: item.fileType,
    finishEmbedding: item.finishEmbedding,
    id: item.id,
    sourceSetId: item.sourceSetId ?? undefined,
    metadata: item.metadata || undefined,
    name: item.name,
    parentId: item.parentId,
    size: item.size,
    slug: item.slug,
    sourceType: item.sourceType as 'file' | 'document',
    updatedAt: item.updatedAt,
    url: item.url,
  };
};

/**
 * ContentService - unified service for content items.
 */
export class ContentService {
  /**
   * Query content items (unified files + documents).
   */
  async queryContentItems(params: ContentQueryParams): Promise<{
    hasMore: boolean;
    items: ContentItem[];
    total?: number;
  }> {
    const response = await fileService.getKnowledgeItems(params);

    return {
      hasMore: response.hasMore,
      items: response.items.map(mapToContentItem),
      total: 'total' in response ? (response.total as number) : undefined,
    };
  }

  /** Get a single content item by ID. */
  async getContentItem(id: string): Promise<ContentItem | undefined> {
    const item = await fileService.getKnowledgeItem(id);
    return item ? mapToContentItem(item) : undefined;
  }

  /** Create a new content item (file or document). */
  async createContentItem(params: CreateContentParams): Promise<ContentItem> {
    if (params.sourceType === 'file') {
      // Create file
      const result = await fileService.createFile(
        {
          fileType: params.fileType,
          name: params.name,
          parentId: params.parentId,
          size: params.size,
          spaceId: params.spaceId,
          url: params.url,
        },
        params.sourceSetId,
      );

      // Fetch the created file to get full details
      const created = await fileService.getKnowledgeItem(result.id);
      if (!created) throw new Error('Failed to fetch created file');

      return mapToContentItem(created);
    } else {
      // Create document
      const documentParams: CreateDocumentParams = {
        content: params.content || '',
        editorData: JSON.stringify(params.editorData || {}),
        fileType: params.fileType,
        sourceSetId: params.sourceSetId,
        metadata: params.metadata,
        parentId: params.parentId,
        spaceId: params.spaceId,
        slug: params.slug,
        title: params.title,
      };

      const created = await documentService.createDocument(documentParams);

      // Map to ContentItem
      return {
        content: created.content,
        createdAt: created.createdAt ? new Date(created.createdAt) : new Date(),
        editorData:
          typeof created.editorData === 'string'
            ? JSON.parse(created.editorData)
            : created.editorData,
        fileType: created.fileType || 'custom/document',
        id: created.id,
        metadata: created.metadata || undefined,
        name: created.title || 'Untitled',
        parentId: created.parentId,
        size: created.totalCharCount || 0,
        slug: created.slug || undefined,
        sourceType: 'document',
        title: created.title || undefined,
        updatedAt: created.updatedAt ? new Date(created.updatedAt) : new Date(),
        url: created.source || '',
      };
    }
  }

  /** Update a content item. */
  async updateContentItem(id: string, updates: UpdateContentParams): Promise<ContentItem> {
    // Check if this is a file or document by fetching it first
    const existing = await this.getContentItem(id);
    if (!existing) throw new Error('Resource not found');

    if (existing.sourceType === 'file') {
      // Update file (currently only supports parentId)
      if (updates.parentId !== undefined) {
        await fileService.updateFile(id, { parentId: updates.parentId });
      }

      // Fetch updated file
      const updated = await fileService.getKnowledgeItem(id);
      if (!updated) throw new Error('Failed to fetch updated file');

      return mapToContentItem(updated);
    } else {
      // Update document
      await documentService.updateDocument({
        content: updates.content,
        editorData: updates.editorData ? JSON.stringify(updates.editorData) : undefined,
        id,
        metadata: updates.metadata,
        // Keep null as null (for moving to root), don't convert to undefined
        parentId: updates.parentId !== undefined ? updates.parentId : undefined,
        title: updates.title || updates.name,
      });

      // Fetch updated document
      const updated = await fileService.getKnowledgeItem(id);
      if (!updated) throw new Error('Failed to fetch updated document');

      return mapToContentItem(updated);
    }
  }

  /** Delete a content item. */
  async deleteContentItem(id: string, trash: boolean = true): Promise<void> {
    if (!trash) {
      if (id.startsWith('docs_')) {
        await documentService.deleteDocument(id, false);
      } else {
        await fileService.removeFile(id, false);
      }

      return;
    }

    // Check if this is a file or document
    const existing = await this.getContentItem(id);
    if (!existing) return; // Already deleted

    if (existing.sourceType === 'file') {
      await fileService.removeFile(id, trash);
    } else {
      await documentService.deleteDocument(id, trash);
    }
  }

  /** Batch delete content items. */
  async deleteContentItems(ids: string[], trash: boolean = true): Promise<void> {
    // Use ID prefix to separate files (file_*) and documents (docs_*) without N API calls
    const fileIds: string[] = [];
    const documentIds: string[] = [];

    for (const id of ids) {
      if (id.startsWith('docs_')) {
        documentIds.push(id);
      } else {
        fileIds.push(id);
      }
    }

    await Promise.all([
      fileIds.length > 0 ? fileService.removeFiles(fileIds, trash) : Promise.resolve(),
      documentIds.length > 0
        ? documentService.deleteDocuments(documentIds, trash)
        : Promise.resolve(),
    ]);
  }

  /**
   * Move a resource to a different parent folder
   */
  async moveContentItem(id: string, parentId: string | null): Promise<ContentItem> {
    return this.updateContentItem(id, { parentId });
  }

  /** Restore a soft-deleted document (same authorization as server `document.restoreDocument`). */
  async restoreDocument(id: string) {
    return documentService.restoreDocument(id);
  }

  async restoreContentItem(item: Pick<ContentItem, 'id' | 'sourceType'>) {
    if (item.sourceType === 'file') {
      await fileService.restoreFile(item.id);
      return;
    }

    await documentService.restoreDocument(item.id);
  }

  async restoreContentItems(items: Array<Pick<ContentItem, 'id' | 'sourceType'>>) {
    const fileIds = items.filter((item) => item.sourceType === 'file').map((item) => item.id);
    const documentIds = items
      .filter((item) => item.sourceType === 'document')
      .map((item) => item.id);

    await Promise.all([
      fileIds.length > 0 ? fileService.restoreFiles(fileIds) : Promise.resolve(),
      documentIds.length > 0 ? documentService.restoreDocuments(documentIds) : Promise.resolve(),
    ]);
  }
}

export const contentService = new ContentService();

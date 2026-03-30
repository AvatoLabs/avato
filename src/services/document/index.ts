import { type DocumentItem } from '@lobechat/database/schemas';

import { lambdaClient } from '@/libs/trpc/client';
import { type LobeDocument } from '@/types/document';

import { abortableRequest } from '../utils/abortableRequest';

export interface CreateDocumentParams {
  content?: string;
  editorData: string;
  fileType?: string;
  metadata?: Record<string, any>;
  parentId?: string;
  slug?: string;
  sourceSetId?: string;
  spaceId?: string;
  title: string;
}

export interface UpdateDocumentParams {
  content?: string;
  editorData?: string;
  fileType?: string;
  id: string;
  metadata?: Record<string, any>;
  parentId?: string | null;
  title?: string;
}

export class DocumentService {
  async createDocument(params: CreateDocumentParams): Promise<DocumentItem> {
    return lambdaClient.document.createDocument.mutate(params);
  }

  async createDocuments(documents: CreateDocumentParams[]): Promise<DocumentItem[]> {
    return lambdaClient.document.createDocuments.mutate({ documents });
  }

  async queryDocuments(params?: {
    current?: number;
    fileTypes?: string[];
    sourceSetId?: string;
    pageSize?: number;
    spaceId?: string;
    sourceTypes?: string[];
    trash?: boolean;
  }): Promise<{ items: DocumentItem[]; total: number }> {
    return lambdaClient.document.queryDocuments.query(params);
  }

  async getDocumentById(id: string, uniqueKey?: string): Promise<DocumentItem | undefined> {
    if (uniqueKey) {
      // Use fixed key so switching documents cancels the previous request
      // This prevents race conditions where old document's data overwrites new document's editor
      return abortableRequest.execute(uniqueKey, async (signal) =>
        lambdaClient.document.getDocumentById.query({ id }, { signal }),
      );
    }

    return lambdaClient.document.getDocumentById.query({ id });
  }

  async deleteDocument(id: string, trash?: boolean): Promise<void> {
    await lambdaClient.document.deleteDocument.mutate({ id, trash });
  }

  async deleteDocuments(ids: string[], trash?: boolean): Promise<void> {
    await lambdaClient.document.deleteDocuments.mutate({ ids, trash });
  }

  async ensureFileDocument(id: string): Promise<DocumentItem> {
    return lambdaClient.document.ensureFileDocument.mutate({ id });
  }

  async restoreDocument(id: string): Promise<DocumentItem | undefined> {
    return lambdaClient.document.restoreDocument.mutate({ id });
  }

  async restoreDocuments(ids: string[]): Promise<DocumentItem[]> {
    const restored = await lambdaClient.document.restoreDocuments.mutate({ ids });
    return restored.filter(Boolean) as DocumentItem[];
  }

  async updateDocument(params: UpdateDocumentParams): Promise<void> {
    await lambdaClient.document.updateDocument.mutate(params);
  }

  async previewFileContent(id: string): Promise<LobeDocument> {
    return lambdaClient.document.previewFileContent.query({ id });
  }
}

export const documentService = new DocumentService();

import { z } from 'zod';

import type { AsyncTaskStatus } from '../asyncTask';
import type { InheritMode, ResourceRole } from '../resource';

export interface FileListItem {
  attachable?: boolean;
  chunkCount: number | null;
  chunkingError: any | null;
  chunkingStatus?: AsyncTaskStatus | null;
  /**
   * Text content of the document (for notes/documents)
   */
  content?: string | null;
  createdAt: Date;
  editorData?: Record<string, any> | null;
  embeddingError: any | null;
  embeddingStatus?: AsyncTaskStatus | null;
  fileId?: string | null;
  fileType: string;
  finishEmbedding: boolean;
  id: string;
  inheritMode?: InheritMode | null;
  /**
   * Metadata (for notes/documents)
   */
  metadata?: Record<string, any> | null;
  name: string;
  /**
   * Parent folder ID (for folder hierarchy)
   */
  parentId?: string | null;
  resourceRole?: ResourceRole | null;
  resourceUid?: string | null;
  size: number;
  slug?: string | null;
  sourceType: string;
  spaceId?: string | null;
  updatedAt: Date;
  url: string;
}

export enum SortType {
  Asc = 'asc',
  Desc = 'desc',
}

export const QueryFileListSchema = z.object({
  attachableOnly: z.boolean().default(false),
  category: z.string().optional(),
  knowledgeBaseId: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().min(0).default(0),
  parentId: z.string().nullable().optional(),
  q: z.string().nullable().optional(),
  showFilesInKnowledgeBase: z.boolean().default(false),
  spaceId: z.string().optional(),
  sortType: z.enum(['desc', 'asc']).optional(),
  sorter: z.enum(['createdAt', 'name', 'size']).optional(),
  trash: z.boolean().optional(),
});

export type QueryFileListSchemaType = z.infer<typeof QueryFileListSchema>;

export interface QueryFileListParams {
  attachableOnly?: boolean;
  category?: string;
  knowledgeBaseId?: string;
  limit?: number;
  offset?: number;
  parentId?: string | null;
  q?: string | null;
  showFilesInKnowledgeBase?: boolean;
  sorter?: string;
  sortType?: string;
  spaceId?: string;
  trash?: boolean;
}

export interface PaginatedFileList {
  hasMore: boolean;
  items: FileListItem[];
  total?: number;
}

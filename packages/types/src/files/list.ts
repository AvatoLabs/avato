import { z } from 'zod';

import type { AsyncTaskStatus } from '../asyncTask';
import type { ContentRole, InheritMode } from '../content';
import type {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from './asset';

const fileAssetClassificationValues = [
  'brand',
  'finance',
  'general',
  'hr',
  'legal',
  'product',
] as const;

const fileAssetReviewStatusValues = ['approved', 'archived', 'draft'] as const;

const fileAssetUsagePolicyValues = ['internal', 'public', 'restricted'] as const;

export interface FileListItem {
  assetClassification?: FileAssetClassification | null;
  assetPrimaryRenditionKind?: FileAssetRenditionKind | null;
  assetPrimaryRenditionLabel?: string | null;
  assetRenditionCount?: number | null;
  assetReviewStatus?: FileAssetReviewStatus | null;
  assetUsagePolicy?: FileAssetUsagePolicy | null;
  assetVersionLabel?: string | null;
  attachable?: boolean;
  chunkCount: number | null;
  chunkingError: any | null;
  chunkingStatus?: AsyncTaskStatus | null;
  /**
   * Text content of the document (for notes/documents)
   */
  content?: string | null;
  contentRole?: ContentRole | null;
  contentUid?: string | null;
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
  size: number;
  slug?: string | null;
  sourceType: string;
  spaceId?: string | null;
  updatedAt: Date;
  url: string;
}

export interface FileGovernanceSummaryGroup<T extends string> {
  counts: Partial<Record<T, number>>;
  total: number;
}

export interface FileGovernanceSummary {
  classification: FileGovernanceSummaryGroup<FileAssetClassification>;
  reviewStatus: FileGovernanceSummaryGroup<FileAssetReviewStatus>;
  usagePolicy: FileGovernanceSummaryGroup<FileAssetUsagePolicy>;
}

export enum SortType {
  Asc = 'asc',
  Desc = 'desc',
}

export const QueryFileListSchema = z.object({
  attachableOnly: z.boolean().default(false),
  assetClassification: z.enum(fileAssetClassificationValues).optional(),
  assetReviewStatus: z.enum(fileAssetReviewStatusValues).optional(),
  assetUsagePolicy: z.enum(fileAssetUsagePolicyValues).optional(),
  category: z.string().optional(),
  sourceSetId: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().min(0).default(0),
  parentId: z.string().nullable().optional(),
  q: z.string().nullable().optional(),
  showFilesInSourceSet: z.boolean().default(false),
  spaceId: z.string().optional(),
  sortType: z.enum(['desc', 'asc']).optional(),
  sorter: z.enum(['createdAt', 'name', 'size']).optional(),
  trash: z.boolean().optional(),
});

export type QueryFileListSchemaType = z.infer<typeof QueryFileListSchema>;

export interface QueryFileListParams {
  assetClassification?: FileAssetClassification;
  assetReviewStatus?: FileAssetReviewStatus;
  assetUsagePolicy?: FileAssetUsagePolicy;
  attachableOnly?: boolean;
  category?: string;
  limit?: number;
  offset?: number;
  parentId?: string | null;
  q?: string | null;
  showFilesInSourceSet?: boolean;
  sorter?: string;
  sortType?: string;
  sourceSetId?: string;
  spaceId?: string;
  trash?: boolean;
}

export interface PaginatedFileList {
  hasMore: boolean;
  items: FileListItem[];
  total?: number;
}

import type {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
  FilesTabs,
  SortType,
} from '../files';

export type BlobStatus = 'staging' | 'ready' | 'quarantined' | 'deleted';

export type InheritMode = 'explicit_only' | 'inherit';

export type ContentKind = 'document' | 'file' | 'source_set';

export type ContentRole = 'editor' | 'owner' | 'viewer';

export type SpaceKind = 'personal' | 'team';

export type SpaceRole = 'admin' | 'editor' | 'owner' | 'viewer';

export interface SpaceItem {
  authzEpoch: number;
  createdAt: Date;
  createdBy: string;
  deletedAt?: Date | null;
  description?: string | null;
  id: string;
  kind: SpaceKind;
  membershipRole?: SpaceRole;
  metadata?: Record<string, any> | null;
  name: string;
  personalOwnerId?: string | null;
  updatedAt: Date;
}

export interface CanonicalContentResource {
  id: string;
  kind?: 'document' | 'file' | null;
  sourceType?: 'document' | 'file' | null;
}

export interface CanonicalSharedContentResource {
  kind: ContentKind;
  localId: string;
}

export const isCanonicalDocumentResource = (item?: CanonicalContentResource | null): boolean => {
  if (!item) return false;

  return item.kind === 'document' || item.sourceType === 'document' || item.id.startsWith('docs_');
};

export const getCanonicalContentKind = (
  item?: CanonicalContentResource | null,
): 'document' | 'file' => {
  return isCanonicalDocumentResource(item) ? 'document' : 'file';
};

export const isRawFileContentResource = (item?: CanonicalContentResource | null): boolean => {
  return getCanonicalContentKind(item) === 'file';
};

export const isRawFileContentId = (id: string): boolean => {
  return isRawFileContentResource({ id, sourceType: 'file' });
};

export const getCanonicalSharedContentKind = (
  item: CanonicalSharedContentResource,
): ContentKind => {
  if (item.kind === 'source_set') return item.kind;

  return getCanonicalContentKind({ id: item.localId, kind: item.kind });
};

export interface SpaceMemberItem {
  avatar?: string | null;
  createdBy: string;
  fullName?: string | null;
  joinedAt: Date;
  role: SpaceRole;
  spaceId: string;
  updatedAt: Date;
  userId: string;
  username?: string | null;
}

export interface ContentPermissionItem {
  canReshare: boolean;
  contentUid: string;
  createdAt: Date;
  createdBy: string;
  expiresAt?: Date | null;
  id: string;
  inheritsToChildren: boolean;
  role: ContentRole;
  spaceId: string;
  subjectAvatar?: string | null;
  subjectId: string;
  subjectName?: string | null;
  subjectType: 'space_member' | 'user';
  subjectUsername?: string | null;
  updatedAt: Date;
}

export interface ContentShareLinkItem {
  contentUid: string;
  createdAt: Date;
  createdBy: string;
  disabledAt?: Date | null;
  expiresAt: Date;
  id: string;
  role: 'viewer';
  spaceId: string;
  updatedAt: Date;
}

export interface ExplainAccessResult {
  authzEpoch: number;
  canAccess: boolean;
  contentUid: string;
  matchedBy?: 'direct' | 'inherited' | 'share_link' | 'space_member';
  reason?: string;
  spaceId: string;
}

/**
 * Unified resource item that represents both files and documents.
 * Used by the ContentManager optimistic layer.
 */
export interface ContentItem {
  _optimistic?: {
    error?: Error;
    isPending: boolean;
    lastSyncAttempt?: Date;
    retryCount: number;
  };
  assetClassification?: FileAssetClassification | null;
  assetLatestGovernanceAuditAction?: string | null;
  assetLatestGovernanceAuditActorDisplayName?: string | null;
  assetLatestGovernanceAuditAt?: Date | null;
  assetPrimaryRenditionKind?: FileAssetRenditionKind | null;
  assetPrimaryRenditionLabel?: string | null;
  assetRenditionCount?: number | null;
  assetReviewStatus?: FileAssetReviewStatus | null;
  assetUsagePolicy?: FileAssetUsagePolicy | null;
  assetVersionLabel?: string | null;
  chunkCount?: number | null;
  chunkingError?: any | null;
  chunkingStatus?: string | null;
  chunkTaskId?: string | null;
  content?: string | null;
  createdAt: Date;
  editorData?: Record<string, any> | null;
  embeddingError?: any | null;
  embeddingStatus?: string | null;
  embeddingTaskId?: string | null;
  fileId?: string | null;
  fileType: string;
  finishEmbedding?: boolean;
  id: string;
  metadata?: Record<string, any>;
  name: string;
  parentId?: string | null;
  size: number;
  slug?: string | null;
  sourceSetId?: string;
  /** All collection IDs this item belongs to */
  sourceSetIds?: string[];
  sourceType: 'document' | 'file';
  spaceId?: string;
  title?: string;
  updatedAt: Date;
  url?: string;
}

export interface SyncOperation {
  id: string;
  payload: any;
  reject?: (reason?: any) => void;
  resolve?: (value?: any) => void;
  resourceId: string;
  retryCount: number;
  timestamp: Date;
  type: 'create' | 'delete' | 'move' | 'update';
}

export interface ContentQueryParams {
  assetClassification?: FileAssetClassification;
  assetReviewStatus?: FileAssetReviewStatus;
  assetRightsOwner?: string;
  assetUsagePolicy?: FileAssetUsagePolicy;
  category?: FilesTabs;
  limit?: number;
  offset?: number;
  parentId?: string | null;
  q?: string;
  showFilesInSourceSet?: boolean;
  sorter?: 'createdAt' | 'name' | 'size';
  sortType?: SortType;
  sourceSetId?: string;
  spaceId?: string;
  trash?: boolean;
}

export interface CreateFileResourceParams {
  fileType: string;
  metadata?: Record<string, any>;
  name: string;
  parentId?: string;
  sha256: string;
  size: number;
  sourceSetId?: string;
  sourceType: 'file';
  spaceId?: string;
  storageKey: string;
}

export interface CreateDocumentResourceParams {
  content: string;
  editorData?: Record<string, any>;
  fileType: 'custom/document' | 'custom/folder';
  metadata?: Record<string, any>;
  parentId?: string;
  slug?: string;
  sourceSetId?: string;
  sourceType: 'document';
  spaceId?: string;
  title: string;
}

export type CreateContentParams = CreateDocumentResourceParams | CreateFileResourceParams;

export interface DeleteContentOptions {
  trash?: boolean;
}

export interface UpdateContentParams {
  content?: string;
  editorData?: Record<string, any>;
  metadata?: Record<string, any>;
  name?: string;
  parentId?: string | null;
  title?: string;
}

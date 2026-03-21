import type { FilesTabs, SortType } from '../files';

export type BlobStatus = 'staging' | 'ready' | 'quarantined' | 'deleted';

export type InheritMode = 'explicit_only' | 'inherit';

export type ResourceKind = 'document' | 'file' | 'knowledge_base';

export type ResourceRole = 'editor' | 'owner' | 'viewer';

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

export interface ResourcePermissionItem {
  canReshare: boolean;
  createdAt: Date;
  createdBy: string;
  expiresAt?: Date | null;
  id: string;
  inheritsToChildren: boolean;
  resourceUid: string;
  role: ResourceRole;
  spaceId: string;
  subjectAvatar?: string | null;
  subjectId: string;
  subjectName?: string | null;
  subjectType: 'space_member' | 'user';
  subjectUsername?: string | null;
  updatedAt: Date;
}

export interface ResourceShareLinkItem {
  createdAt: Date;
  createdBy: string;
  disabledAt?: Date | null;
  expiresAt: Date;
  id: string;
  resourceUid: string;
  role: 'viewer';
  spaceId: string;
  updatedAt: Date;
}

export interface ExplainAccessResult {
  authzEpoch: number;
  canAccess: boolean;
  matchedBy?: 'direct' | 'inherited' | 'share_link' | 'space_member';
  reason?: string;
  resourceUid: string;
  spaceId: string;
}

/**
 * Unified resource item that represents both files and documents.
 * Used by the ResourceManager optimistic layer.
 */
export interface ResourceItem {
  _optimistic?: {
    error?: Error;
    isPending: boolean;
    lastSyncAttempt?: Date;
    retryCount: number;
  };
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
  fileType: string;
  finishEmbedding?: boolean;
  id: string;
  knowledgeBaseId?: string;
  metadata?: Record<string, any>;
  name: string;
  parentId?: string | null;
  size: number;
  slug?: string | null;
  sourceType: 'document' | 'file';
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

export interface ResourceQueryParams {
  category?: FilesTabs;
  libraryId?: string;
  limit?: number;
  offset?: number;
  parentId?: string | null;
  q?: string;
  showFilesInKnowledgeBase?: boolean;
  sorter?: 'createdAt' | 'name' | 'size';
  sortType?: SortType;
  spaceId?: string;
}

export interface CreateFileResourceParams {
  fileType: string;
  knowledgeBaseId?: string;
  metadata?: Record<string, any>;
  name: string;
  parentId?: string;
  size: number;
  sourceType: 'file';
  spaceId?: string;
  url: string;
}

export interface CreateDocumentResourceParams {
  content: string;
  editorData?: Record<string, any>;
  fileType: 'custom/document' | 'custom/folder';
  knowledgeBaseId?: string;
  metadata?: Record<string, any>;
  parentId?: string;
  slug?: string;
  sourceType: 'document';
  spaceId?: string;
  title: string;
}

export type CreateResourceParams = CreateDocumentResourceParams | CreateFileResourceParams;

export interface UpdateResourceParams {
  content?: string;
  editorData?: Record<string, any>;
  metadata?: Record<string, any>;
  name?: string;
  parentId?: string | null;
  title?: string;
}

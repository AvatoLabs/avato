import type { FilesConfigItem } from '../user/settings/filesConfig';

export enum KnowledgeBaseTabs {
  Files = 'files',
  Settings = 'Settings',
  Testing = 'testing',
}

export interface KnowledgeBaseItem {
  authzEpoch?: number;

  avatar: string | null;
  createdAt: Date;
  description?: string | null;
  enabled?: boolean;

  id: string;

  isPublic: boolean | null;

  name: string;
  resourceUid?: string | null;

  settings: any;
  spaceId?: string | null;
  // different types of knowledge bases need to be distinguished
  type: string | null;
  updatedAt: Date;
}

export interface CreateKnowledgeBaseParams {
  avatar?: string;
  description?: string;
  name: string;
  spaceId?: string;
}

export enum KnowledgeType {
  File = 'file',
  KnowledgeBase = 'knowledgeBase',
}

export interface KnowledgeItem {
  avatar?: string | null;
  content?: string;
  description?: string | null;
  enabled?: boolean;
  fileType?: string;
  id: string;
  name: string;
  type: KnowledgeType;
}

export interface SystemEmbeddingConfig {
  embeddingModel: FilesConfigItem;
  queryMode: string;
  rerankerModel: FilesConfigItem;
}

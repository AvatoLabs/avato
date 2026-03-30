import type { FilesConfigItem } from '../user/settings/filesConfig';

export enum SourceSetTabs {
  Files = 'files',
  Settings = 'Settings',
  Testing = 'testing',
}

export interface SourceSetItem {
  authzEpoch?: number;

  avatar: string | null;
  contentUid?: string | null;
  createdAt: Date;
  description?: string | null;

  enabled?: boolean;

  id: string;
  name: string;

  settings: any;
  spaceId?: string | null;
  // different source set variants may use different retrieval strategies
  type: string | null;
  updatedAt: Date;
}

export interface CreateSourceSetParams {
  avatar?: string;
  description?: string;
  name: string;
  spaceId?: string;
}

export enum AgentSourceKind {
  File = 'file',
  SourceSet = 'sourceSet',
}

export interface AgentSourceItem {
  avatar?: string | null;
  content?: string;
  description?: string | null;
  enabled?: boolean;
  fileType?: string;
  id: string;
  name: string;
  spaceId?: string | null;
  type: AgentSourceKind;
}

export interface SystemEmbeddingConfig {
  embeddingModel: FilesConfigItem;
  queryMode: string;
  rerankerModel: FilesConfigItem;
}

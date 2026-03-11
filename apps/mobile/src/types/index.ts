/**
 * Shared type definitions for the MinkHub mobile app.
 * These mirror the server-side models (session, message, agent, etc.)
 * without importing any server code.
 */

// ---- Session / Chat ----

export interface ChatSession {
  /** Agent identifier this session is talking to */
  agentId?: string;
  avatar?: string;
  createdAt: string;
  description?: string;
  /** Group identifier for folder grouping */
  groupId?: string;
  id: string;
  /** If pinned, the session is always at the top */
  pinned?: boolean;
  title: string;
  /** ISO timestamp */
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  content: string;
  /** ISO timestamp */
  createdAt: string;
  /** Error info if the message failed */
  error?: { type: string; message: string } | null;
  id: string;
  /** Model that generated the response */
  model?: string;
  /** Parent message id (for branching) */
  parentId?: string;
  role: MessageRole;
  sessionId: string;
  updatedAt: string;
}

// ---- Agent ----

export interface Agent {
  avatar?: string;
  description?: string;
  id: string;
  model?: string;
  /** Provider identifier */
  provider?: string;
  systemRole?: string;
  tags?: string[];
  title: string;
}

// ---- Community / Market ----

export interface MarketAgent {
  author: string;
  createAt: string;
  identifier: string;
  meta: {
    title: string;
    description: string;
    avatar?: string;
    tags?: string[];
    category?: string;
  };
  schemaVersion: number;
}

export interface MarketModel {
  description?: string;
  displayName: string;
  enabled: boolean;
  id: string;
  providerId: string;
  type: string;
}

export interface MarketProvider {
  description?: string;
  id: string;
  logo?: string;
  models: MarketModel[];
  name: string;
}

// ---- Session Group ----

export interface SessionGroup {
  createdAt: string;
  id: string;
  name: string;
  sort?: number;
  updatedAt: string;
}

// ---- Topic ----

export interface Topic {
  createdAt: string;
  favorite?: boolean;
  id: string;
  sessionId: string;
  title: string;
  updatedAt: string;
}

// ---- File / Attachment ----

export interface FileAttachment {
  id: string;
  name: string;
  /** Upload progress 0-100 */
  progress: number;
  /** File size in bytes */
  size: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'done' | 'error';
  /** MIME type */
  type: string;
  /** Local URI for preview */
  uri: string;
  /** Remote URL after upload */
  url?: string;
}

// ---- Discover / Market (extended) ----

export interface DiscoverAgent {
  author: string;
  config?: {
    systemRole?: string;
    model?: string;
    provider?: string;
  };
  createAt: string;
  identifier: string;
  meta: {
    title: string;
    description: string;
    avatar?: string;
    tags?: string[];
    category?: string;
  };
  schemaVersion: number;
}

export interface DiscoverModel {
  description?: string;
  displayName: string;
  enabled: boolean;
  functionCall?: boolean;
  id: string;
  providerId: string;
  providerName?: string;
  tokens?: number;
  type: string;
  vision?: boolean;
}

export interface DiscoverProvider {
  description?: string;
  enabled: boolean;
  id: string;
  logo?: string;
  models: DiscoverModel[];
  name: string;
}

// ---- User ----

export interface UserProfile {
  avatar?: string;
  bio?: string;
  email?: string;
  fullName?: string;
  id: string;
  interests?: string[];
  username?: string;
}

// ---- AI Provider Runtime State (mirrors server AiProviderRuntimeState) ----

export interface RuntimeModelAbilities {
  files?: boolean;
  functionCall?: boolean;
  reasoning?: boolean;
  search?: boolean;
  vision?: boolean;
}

export interface RuntimeEnabledModel {
  abilities: RuntimeModelAbilities;
  contextWindowTokens?: number;
  displayName?: string;
  enabled?: boolean;
  id: string;
  providerId: string;
  releasedAt?: string;
  type: string;
}

export interface RuntimeEnabledProvider {
  id: string;
  logo?: string;
  name?: string;
  source: string;
}

export interface AiProviderRuntimeState {
  enabledAiModels: RuntimeEnabledModel[];
  enabledAiProviders: RuntimeEnabledProvider[];
  enabledChatAiProviders: RuntimeEnabledProvider[];
}

/** Provider + its chat models, built client-side from runtime state */
export interface ProviderWithModels {
  children: RuntimeEnabledModel[];
  id: string;
  logo?: string;
  name: string;
}

// ---- AI Provider List / Detail (mirrors server types) ----

export interface AiProviderListItem {
  description?: string;
  enabled: boolean;
  id: string;
  logo?: string;
  name?: string;
  sort?: number;
  source: string;
}

export interface AiProviderDetailItem {
  checkModel?: string;
  description?: string;
  enabled: boolean;
  fetchOnClient?: boolean;
  homeUrl?: string;
  id: string;
  keyVaults?: Record<string, any>;
  logo?: string;
  modelsUrl?: string;
  name: string;
  settings: AiProviderSettings;
  source: string;
}

export interface AiProviderSettings {
  /** 'apiKey' | 'oauthDeviceFlow' */
  authType?: string;
  defaultShowBrowserRequest?: boolean;
  disableBrowserRequest?: boolean;
  modelEditable?: boolean;
  proxyUrl?: { desc?: string; placeholder: string; title?: string } | false;
  showAddNewModel?: boolean;
  showApiKey?: boolean;
  showChecker?: boolean;
  showDeployName?: boolean;
  showModelFetcher?: boolean;
  supportResponsesApi?: boolean;
}

export interface AiProviderModelItem {
  abilities?: { functionCall?: boolean; reasoning?: boolean; search?: boolean; vision?: boolean };
  displayName?: string;
  enabled: boolean;
  id: string;
  source?: string;
  type?: string;
}

// ---- Skill / Plugin ----

export type LobeToolType = 'builtin' | 'customPlugin' | 'plugin';

export interface PluginManifestMeta {
  avatar?: string;
  description?: string;
  title?: string;
}

export interface PluginManifest {
  author?: string;
  homepage?: string;
  identifier: string;
  meta?: PluginManifestMeta;
  type?: string;
}

/** Installed plugin / tool (mirrors LobeTool from server) */
export interface InstalledPlugin {
  createdAt?: string;
  customParams?: Record<string, any>;
  identifier: string;
  manifest?: PluginManifest;
  runtimeType?: string;
  settings?: Record<string, any>;
  source?: string;
  type: LobeToolType;
  updatedAt?: string;
}

/** Agent skill item from agentSkills.list */
export interface AgentSkillItem {
  content?: string;
  createdAt?: string;
  description?: string;
  id: string;
  identifier?: string;
  manifest?: Record<string, any>;
  name: string;
  source?: 'builtin' | 'market' | 'user';
  updatedAt?: string;
  zipFileHash?: string;
}

/** MCP custom plugin params */
export interface CustomPluginParams {
  apiMode?: string;
  avatar?: string;
  description?: string;
  manifestUrl?: string;
  mcp?: {
    args?: string[];
    command?: string;
    env?: Record<string, string>;
    type?: 'http' | 'stdio' | 'cloud';
    url?: string;
  };
  name?: string;
  settings?: Record<string, any>;
}

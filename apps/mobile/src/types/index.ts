/**
 * Shared type definitions for the Avato mobile app.
 * These mirror the server-side models (session, message, agent, etc.)
 * without importing any server code.
 */

// ---- Session / Chat ----

export interface CreateSessionConfig {
  avatar?: string;
  description?: string;
  groupId?: string;
  model?: string;
  plugins?: string[];
  provider?: string;
  systemPrompt?: string;
  title?: string;
}

export interface ChatSession {
  /** Agent identifier this session is talking to */
  agentId?: string;
  avatar?: string;
  /** Session-level chat config persisted on server */
  chatConfig?: MobileChatConfig;
  createdAt: string;
  description?: string;
  /** Group identifier for folder grouping */
  groupId?: string;
  id: string;
  /** Language model assigned to this session (e.g. 'gpt-4o') */
  model?: string;
  /** If pinned, the session is always at the top */
  pinned?: boolean;
  /** Provider identifier (e.g. 'openai', 'anthropic') */
  provider?: string;
  title: string;
  /** 'agent' for regular sessions, 'group' for multi-agent chat groups */
  type?: 'agent' | 'group';
  /** ISO timestamp */
  updatedAt: string;
}

export type MobileMemoryEffort = 'low' | 'medium' | 'high';

export interface MobileChatConfig {
  memory?: {
    effort?: MobileMemoryEffort;
    enabled?: boolean;
    toolPermission?: 'read-only' | 'read-write';
  };
  searchMode?: 'auto' | 'off' | 'on';
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageContentPart {
  image?: string;
  text?: string;
  thoughtSignature?: string;
  type: 'image' | 'text';
}

export interface ModelReasoning {
  content?: string;
  duration?: number;
  isMultimodal?: boolean;
  signature?: string;
  tempDisplayContent?: MessageContentPart[];
}

export interface ModelTokenUsage {
  inputCachedTokens?: number;
  inputCacheMissTokens?: number;
  outputReasoningTokens?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalTokens?: number;
}

export interface ModelPerformance {
  latency?: number;
  tps?: number;
  ttft?: number;
}

export interface CitationItem {
  favicon?: string;
  id?: string;
  title?: string;
  url: string;
}

export interface ImageCitationItem {
  domain?: string;
  imageUri?: string;
  sourceUri?: string;
  title?: string;
}

export interface GroundingSearch {
  citations?: CitationItem[];
  imageResults?: ImageCitationItem[];
  imageSearchQueries?: string[];
  searchQueries?: string[];
}

export interface ToolIntervention {
  rejectedReason?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'aborted' | 'none';
}

export interface ChatPluginPayload {
  apiName: string;
  arguments: string;
  identifier: string;
  intervention?: ToolIntervention;
  type: string;
}

export interface ChatToolPayload {
  apiName: string;
  arguments: string;
  id: string;
  identifier: string;
  intervention?: ToolIntervention;
  result_msg_id?: string;
  source?: 'builtin' | 'plugin' | 'mcp' | 'klavis' | 'lobehubSkill';
  thoughtSignature?: string;
  type: string;
}

export interface ChatMessageMetadata {
  [key: string]: unknown;
  finishType?: string;
  isMultimodal?: boolean;
  performance?: ModelPerformance | null;
  tempDisplayContent?: string;
  usage?: ModelTokenUsage | null;
}

export interface ChatImageItem {
  alt: string;
  id: string;
  url: string;
}

export interface ChatFileItem {
  content?: string;
  fileType: string;
  id: string;
  name: string;
  size: number;
  url: string;
}

export interface ChatMessage {
  content: string;
  /** ISO timestamp */
  createdAt: string;
  /** Error info if the message failed */
  error?: { type: string; message: string } | null;
  fileList?: ChatFileItem[];
  id: string;
  imageList?: ChatImageItem[];
  metadata?: ChatMessageMetadata | null;
  /** Model that generated the response */
  model?: string;
  observationId?: string | null;
  /** Parent message id (for branching) */
  parentId?: string;
  /** Performance metrics (TPS, TTFT) */
  performance?: ModelPerformance | null;
  plugin?: ChatPluginPayload | null;
  pluginError?: unknown;
  pluginIntervention?: ToolIntervention | null;
  pluginState?: unknown;
  /** Provider that generated the response */
  provider?: string;
  /** Reasoning / thinking content from the model */
  reasoning?: ModelReasoning | null;
  role: MessageRole;
  search?: GroundingSearch | null;
  sessionId: string;
  toolCallId?: string | null;
  tools?: ChatToolPayload[] | null;
  traceId?: string | null;
  updatedAt: string;
  /** Token usage stats */
  usage?: ModelTokenUsage | null;
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
  config?: {
    model?: string;
    plugins?: string[];
    provider?: string;
    systemRole?: string;
    [key: string]: any;
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
  /** Backend file record ID after upload */
  fileId?: string;
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

export interface ImageParamSchemaItem {
  default?: unknown;
  description?: string;
  enum?: Array<number | string>;
  max?: number;
  maxCount?: number;
  maxFileSize?: number;
  min?: number;
  step?: number;
  type?: string | string[];
}

export interface ImageModelParamsSchema {
  [key: string]: ImageParamSchemaItem | undefined;
  aspectRatio?: ImageParamSchemaItem;
  cfg?: ImageParamSchemaItem;
  height?: ImageParamSchemaItem;
  imageUrl?: ImageParamSchemaItem;
  imageUrls?: ImageParamSchemaItem;
  prompt?: ImageParamSchemaItem;
  quality?: ImageParamSchemaItem;
  resolution?: ImageParamSchemaItem;
  seed?: ImageParamSchemaItem;
  size?: ImageParamSchemaItem;
  steps?: ImageParamSchemaItem;
  width?: ImageParamSchemaItem;
}

export interface ImageGenerationParams {
  [key: string]: unknown;
  aspectRatio?: string;
  cfg?: number;
  height?: number;
  imageUrl?: string | null;
  imageUrls?: string[];
  prompt?: string;
  quality?: string;
  resolution?: string;
  seed?: number | null;
  size?: string;
  steps?: number;
  width?: number;
}

export interface RuntimeEnabledModel {
  abilities: RuntimeModelAbilities;
  contextWindowTokens?: number;
  displayName?: string;
  enabled?: boolean;
  id: string;
  parameters?: ImageModelParamsSchema;
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
  enabledImageAiProviders: RuntimeEnabledProvider[];
  enabledVideoAiProviders: RuntimeEnabledProvider[];
  runtimeConfig: Record<string, unknown>;
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

// ---- Stats / Rankings ----

export interface ModelRankItem {
  count: number;
  id: string;
}

export interface SessionRankItem {
  avatar?: string;
  backgroundColor?: string;
  count: number;
  id: string;
  title?: string;
}

export interface TopicRankItem {
  count: number;
  id: string;
  sessionId?: string;
  title?: string;
}

export interface HeatmapDay {
  count: number;
  date: string;
  level: number;
}

export interface UserRegistrationDuration {
  createdAt?: string;
  duration?: number;
  updatedAt?: string;
}

// ---- Memory ----

export type MemoryLayer = 'identity' | 'context' | 'activity' | 'experience' | 'preference';

/** Base fields shared across all memory layer items */
export interface MemoryItemBase {
  accessedCount?: number;
  capturedAt?: string;
  createdAt?: string;
  id: string;
  lastAccessedAt?: string;
  memoryCategory?: string;
  memoryLayer?: string;
  memoryType?: string;
  metadata?: Record<string, any>;
  status?: string;
  summary?: string;
  tags?: string[];
  title?: string;
  updatedAt?: string;
  userId?: string;
}

/** Identity layer item */
export interface MemoryIdentityItem extends MemoryItemBase {
  /** E.g. 'person', 'organization', 'role' */
  type?: string;
}

/** Context layer item */
export interface MemoryContextItem {
  associatedObjects?: string[];
  associatedSubjects?: string[];
  createdAt?: string;
  currentStatus?: string;
  description?: string;
  id: string;
  scoreImpact?: number;
  scoreUrgency?: number;
  tags?: string[];
  title?: string;
  type?: string;
  updatedAt?: string;
  userMemoryIds?: string[];
}

/** Activity layer item */
export interface MemoryActivityItem {
  associatedLocations?: string[];
  associatedObjects?: string[];
  associatedSubjects?: string[];
  capturedAt?: string;
  createdAt?: string;
  endsAt?: string;
  feedback?: string;
  id: string;
  metadata?: Record<string, any>;
  narrative?: string;
  notes?: string;
  startsAt?: string;
  status?: string;
  tags?: string[];
  timezone?: string;
  type?: string;
  updatedAt?: string;
  userMemoryId?: string;
}

/** Experience layer item */
export interface MemoryExperienceItem {
  action?: string;
  capturedAt?: string;
  createdAt?: string;
  id: string;
  keyLearning?: string;
  metadata?: Record<string, any>;
  possibleOutcome?: string;
  reasoning?: string;
  scoreConfidence?: number;
  situation?: string;
  tags?: string[];
  type?: string;
  updatedAt?: string;
  userMemoryId?: string;
}

/** Preference layer item */
export interface MemoryPreferenceItem {
  conclusionDirectives?: string;
  createdAt?: string;
  id: string;
  metadata?: Record<string, any>;
  scorePriority?: number;
  suggestions?: string;
  tags?: string[];
  type?: string;
  updatedAt?: string;
  userMemoryId?: string;
}

/** Persona document (from userMemory.getPersona) */
export interface MemoryPersona {
  content?: string;
  summary?: string;
}

/** Paged query response */
export interface MemoryPagedResult<T> {
  items: T[];
  total: number;
}

// ---- Image Generation / Artwork ----

export interface GenerationAsset {
  height?: number;
  originalUrl?: string;
  thumbnailUrl?: string;
  type?: string;
  url?: string;
  width?: number;
}

export interface GenerationItem {
  asset?: GenerationAsset;
  asyncTaskId?: string;
  createdAt?: string;
  fileId?: string;
  generationBatchId?: string;
  id: string;
  seed?: number;
  task: {
    error?: { name: string; message?: string } | null;
    status: string;
  };
  updatedAt?: string;
}

export interface GenerationBatchConfig {
  [key: string]: any;
  cfg?: number;
  height?: number;
  imageUrl?: string;
  imageUrls?: string[];
  prompt?: string;
  seed?: number;
  steps?: number;
  width?: number;
}

export interface GenerationBatch {
  config?: GenerationBatchConfig;
  createdAt?: string;
  generations: GenerationItem[];
  generationTopicId?: string;
  height?: number;
  id: string;
  model: string;
  prompt: string;
  provider: string;
  ratio?: string;
  updatedAt?: string;
  width?: number;
}

export interface GenerationTopic {
  coverUrl?: string;
  createdAt?: string;
  id: string;
  title?: string;
  type?: string;
  updatedAt?: string;
}

/** Image model from enabled provider list */
export interface ImageModelItem {
  displayName?: string;
  id: string;
  parameters?: ImageModelParamsSchema;
  pricing?: Record<string, any>;
  resolutions?: string[];
  type: string;
}

/** Provider with image models */
export interface ImageProviderWithModels {
  children: ImageModelItem[];
  id: string;
  logo?: string;
  name: string;
}

// ---- Resource / File ----

export interface FileListItem {
  chunkCount: number | null;
  chunkingError: any | null;
  chunkingStatus?: string | null;
  content?: string | null;
  createdAt: string;
  editorData?: Record<string, any> | null;
  embeddingError: any | null;
  embeddingStatus?: string | null;
  fileType: string;
  finishEmbedding: boolean;
  id: string;
  metadata?: Record<string, any> | null;
  name: string;
  parentId?: string | null;
  size: number;
  sourceType: 'file' | 'document';
  url: string;
  userId?: string;
}

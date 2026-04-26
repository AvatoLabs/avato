/**
 * Shared type definitions for the Avato mobile app.
 * These mirror the server-side models (session, message, agent, etc.)
 * without importing any server code.
 */

// ---- Session / Chat ----

export interface CreateSessionConfig {
  agentId?: string;
  avatar?: string;
  description?: string;
  model?: string;
  plugins?: string[];
  provider?: string;
  slug?: string;
  systemPrompt?: string;
  title?: string;
}

export interface ChatSession {
  /** Agent identifier this session is talking to */
  agentId?: string;
  avatar?: string;
  /** Session-level chat config persisted on server */
  chatConfig?: MobileChatConfig;
  /** Agent config id (from API, may differ from agentId) */
  config?: { id?: string };
  createdAt: string;
  description?: string;
  id: string;
  /** Language model assigned to this session (e.g. 'gpt-4o') */
  model?: string;
  /** If pinned, the session is always at the top */
  pinned?: boolean;
  /** Provider identifier (e.g. 'openai', 'anthropic') */
  provider?: string;
  /** Session slug when returned by the API (e.g. personal notebook) */
  slug?: string | null;
  title: string;
  /** 'agent' for regular sessions, 'group' for multi-agent chat groups */
  type?: 'agent' | 'group';
  /** ISO timestamp */
  updatedAt: string;
}

export interface AgentTemplate {
  avatar?: string;
  createdAt: string;
  id: string;
  model?: string;
  params?: Record<string, unknown>;
  plugins?: string[];
  provider?: string;
  sessionIds: string[];
  systemRole?: string;
  title: string;
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

export type MessageRole =
  | 'assistant'
  | 'compareGroup'
  | 'compressedGroup'
  | 'groupTasks'
  | 'system'
  | 'task'
  | 'tool'
  | 'user';

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
  pluginError?: unknown;
  pluginState?: Record<string, unknown>;
  result_content?: string;
  result_msg_id?: string;
  source?: 'builtin' | 'plugin' | 'mcp' | 'klavis' | 'lobehubSkill';
  thoughtSignature?: string;
  type: string;
}

export interface ChatMessageMetadata {
  [key: string]: unknown;
  docSelections?: DocSelection[];
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

export interface ConversationFileItem {
  enabled?: boolean;
  fileType: string;
  id: string;
  name: string;
  type?: string;
}

export interface ChatMessage {
  agentId?: string | null;
  children?: ChatMessage[];
  /** For compressedGroup: messages when expanded */
  compressedMessages?: ChatMessage[];
  content: string;
  /** ISO timestamp */
  createdAt: string;
  /** Error info if the message failed */
  error?: { body?: unknown; message: string; type: string } | null;
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
  /** For task messages: execution detail (status, threadId, etc.) */
  taskDetail?: {
    duration?: number;
    status?: string;
    threadId?: string;
    title?: string;
    totalSteps?: number;
    totalToolCalls?: number;
    [key: string]: unknown;
  };
  /** For groupTasks: aggregated task messages from multiple agents */
  tasks?: ChatMessage[];
  threadId?: string | null;
  toolCallId?: string | null;
  tools?: ChatToolPayload[] | null;
  traceId?: string | null;
  updatedAt: string;
  /** Token usage stats */
  usage?: ModelTokenUsage | null;
}

export interface MobileThreadItem {
  agentId?: string | null;
  createdAt?: string;
  groupId?: string | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  parentThreadId?: string | null;
  sourceMessageId?: string | null;
  status?: string | null;
  title?: string | null;
  topicId: string;
  type?: string | null;
  updatedAt?: string;
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

// ---- Tags (topic-level) ----

export interface Tag {
  color?: string | null;
  createdAt: string;
  id: string;
  name: string;
  sort?: number;
  updatedAt: string;
}

// ---- Topic ----

/** Recent topic from topic.recentTopics (cross-session). sessionId for ChatDetail navigation. */
export interface RecentTopic {
  agent: {
    avatar?: string | null;
    backgroundColor?: string | null;
    id: string;
    title?: string | null;
  } | null;
  group: {
    id: string;
    members: Array<{ avatar?: string | null; backgroundColor?: string | null }>;
    title?: string | null;
  } | null;
  id: string;
  sessionId?: string | null;
  tagId?: string | null;
  title: string | null;
  type: 'agent' | 'group';
  updatedAt: string;
}

export interface Topic {
  createdAt: string;
  favorite?: boolean;
  id: string;
  sessionId: string;
  tagId?: string | null;
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

export interface DocSelection {
  content: string;
  docId: string;
  id: string;
  xml?: string;
}

export interface ChatContextSelection {
  content: string;
  docId: string;
  format?: 'markdown' | 'text' | 'xml';
  id: string;
  preview?: string;
  title?: string;
  type: 'text';
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
  email?: string;
  fullName?: string;
  id: string;
  interests?: string[];
  username?: string;
}

/** Mirrors server `SSOProvider` from linked OAuth / SSO accounts (read-only). */
export interface MobileSSOProvider {
  email?: string;
  expiresAt?: Date | number | null;
  provider: string;
  providerAccountId: string;
}

export interface MobileUserState extends UserProfile {
  settings?: {
    defaultAgent?: {
      config?: {
        [key: string]: unknown;
        model?: string;
        plugins?: string[];
        provider?: string;
        systemRole?: string;
      };
    };
    memory?: {
      effort?: MobileMemoryEffort;
      enabled?: boolean;
    };
    tool?: {
      uninstalledBuiltinTools?: string[];
    };
  };
  userId?: string;
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
  description?: string;
  episodicDate?: string;
  relationship?: string;
  role?: string;
  /** E.g. 'person', 'organization', 'role' */
  type?: string;
  userMemoryId?: string;
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

export interface MemorySource {
  agentId?: string | null;
  id: string;
  sessionId?: string | null;
  title?: string | null;
}

export type MemorySourceType = 'benchmark_locomo' | 'chat_topic';

export interface MemoryBaseDetail extends MemoryItemBase {
  accessedAt?: string;
  accessedCount?: number;
  details?: string;
  lastAccessedAt?: string;
}

export interface MemoryActivityDetail {
  activity: MemoryActivityItem;
  layer: 'activity';
  memory: MemoryBaseDetail;
  source?: MemorySource | null;
  sourceType?: MemorySourceType;
}

export interface MemoryContextDetail {
  context: MemoryContextItem;
  layer: 'context';
  memory: MemoryBaseDetail;
  source?: MemorySource | null;
  sourceType?: MemorySourceType;
}

export interface MemoryExperienceDetail {
  experience: MemoryExperienceItem;
  layer: 'experience';
  memory: MemoryBaseDetail;
  source?: MemorySource | null;
  sourceType?: MemorySourceType;
}

export interface MemoryIdentityDetail {
  identity: MemoryIdentityItem;
  layer: 'identity';
  memory: MemoryBaseDetail;
  source?: MemorySource | null;
  sourceType?: MemorySourceType;
}

export interface MemoryPreferenceDetail {
  layer: 'preference';
  memory: MemoryBaseDetail;
  preference: MemoryPreferenceItem;
  source?: MemorySource | null;
  sourceType?: MemorySourceType;
}

export type MemoryDetail =
  | MemoryActivityDetail
  | MemoryContextDetail
  | MemoryExperienceDetail
  | MemoryIdentityDetail
  | MemoryPreferenceDetail;

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
    error?: {
      body?: { detail?: string } | string;
      message?: string;
      name: string;
    } | null;
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

export type MobileFileAssetReviewStatus = 'approved' | 'archived' | 'draft';
export type MobileFileAssetUsagePolicy = 'internal' | 'public' | 'restricted';
export type MobileFileAssetClassification =
  | 'brand'
  | 'finance'
  | 'general'
  | 'hr'
  | 'legal'
  | 'product';
export type MobileFileAssetRenditionKind =
  | 'caption'
  | 'embedding'
  | 'preview'
  | 'print'
  | 'thumbnail'
  | 'transcript'
  | 'web';

export interface FileAssetCapabilities {
  canApprove: boolean;
  canArchive: boolean;
  canEditGovernance: boolean;
}

export interface FileListItem {
  assetClassification?: MobileFileAssetClassification | null;
  assetLatestGovernanceAuditAction?: string | null;
  assetLatestGovernanceAuditActorDisplayName?: string | null;
  assetLatestGovernanceAuditAt?: string | null;
  assetLatestGovernanceAuditChangedFields?: string[] | null;
  assetPrimaryRenditionKind?: MobileFileAssetRenditionKind | null;
  assetPrimaryRenditionLabel?: string | null;
  assetRenditionCount?: number | null;
  assetReviewStatus?: MobileFileAssetReviewStatus | null;
  assetRightsOwner?: string | null;
  assetUsagePolicy?: MobileFileAssetUsagePolicy | null;
  assetVersionLabel?: string | null;
  attachable?: boolean;
  chunkCount: number | null;
  chunkingError: any | null;
  chunkingStatus?: string | null;
  content?: string | null;
  contentRole?: 'owner' | 'editor' | 'viewer' | null;
  contentUid?: string | null;
  createdAt: string;
  editorData?: Record<string, any> | null;
  embeddingError: any | null;
  embeddingStatus?: string | null;
  fileType: string;
  finishEmbedding: boolean;
  id: string;
  inheritMode?: 'explicit_only' | 'inherit' | null;
  metadata?: Record<string, any> | null;
  name: string;
  parentId?: string | null;
  size: number;
  slug?: string | null;
  sourceType: 'file' | 'document';
  spaceId?: string | null;
  updatedAt?: string;
  url: string;
  userId?: string;
}

export interface SourceSetItem {
  avatar?: string | null;
  contentUid?: string | null;
  description?: string | null;
  id: string;
  name: string;
  spaceId?: string | null;
  type?: string | null;
}

export type MobileSpaceKind = 'personal' | 'team';
export type MobileSpaceRole = 'admin' | 'editor' | 'owner' | 'viewer';

export interface MobileSpaceItem {
  authzEpoch?: number;
  createdAt?: string;
  description?: string | null;
  id: string;
  kind: MobileSpaceKind;
  membershipRole?: MobileSpaceRole;
  name: string;
  updatedAt?: string;
}

export type MobileSpaceMemorySection = 'inbox' | 'published' | 'playbooks' | 'policies';
export type MobileSpaceMemorySurface = 'personal' | 'reviewer' | 'viewer';
export type MobileSpaceMemoryCategory = 'general' | 'playbook' | 'policy';
export type MobileSpaceMemoryRecallFilter = 'active' | 'all' | 'disabled' | 'expired' | 'stale';
export type MobileSpaceMemorySourceKind = 'document' | 'file' | 'message' | 'source_set' | 'topic';

export interface MobileSpaceMemorySurfaceContract {
  canAccessAudit: boolean;
  canCreate: boolean;
  canManageRecall: boolean;
  canViewInbox: boolean;
  detailViews: Array<'audit' | 'overview'>;
  recallFilters: MobileSpaceMemoryRecallFilter[];
  sections: MobileSpaceMemorySection[];
}

export interface MobileSpaceMemorySectionSummary {
  count: number;
  recall: {
    active: number;
    disabled: number;
    expired: number;
    stale: number;
  };
}

export interface MobileSpaceMemorySummary {
  canCreate: boolean;
  canPublish: boolean;
  canReview: boolean;
  contract: MobileSpaceMemorySurfaceContract;
  id: string;
  kind?: MobileSpaceKind | string | null;
  membershipRole?: MobileSpaceRole | string | null;
  name?: string | null;
  sections: Record<MobileSpaceMemorySection, MobileSpaceMemorySectionSummary>;
  surface: MobileSpaceMemorySurface;
}

export interface MobileSpaceMemorySourceRefPreview {
  id: string;
  kind: MobileSpaceMemorySourceKind;
  title?: string;
}

export interface MobileSpaceMemoryIntakePreview {
  origin?: 'automation' | 'harness' | 'manual';
  producer?: string | null;
  traceId?: string | null;
}

export interface MobileSpaceMemoryRecallPolicyPreview {
  expiresAt?: string | null;
  lastVerifiedAt?: string | null;
  recallBlockedReason?: 'disabled' | 'expired' | 'stale';
  recallEnabled: boolean;
  staleAt?: string | null;
}

export interface MobileSpaceMemoryGovernanceHistoryPreview {
  action: 'merged' | 'policy_updated' | 'published';
  actor?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  };
  at: string;
  changes?: {
    content?: { after?: string | null; before?: string | null };
    expiresAt?: { after?: string | null; before?: string | null };
    lastVerifiedAt?: { after?: string | null; before?: string | null };
    recallEnabled?: { after?: boolean | null; before?: boolean | null };
    staleAt?: { after?: string | null; before?: string | null };
    summary?: { after?: string | null; before?: string | null };
    title?: { after?: string | null; before?: string | null };
  };
  resolution?: {
    appendSources?: boolean;
    applyContent?: boolean;
    applySummary?: boolean;
    applyTitle?: boolean;
  };
  sourceTitle?: string | null;
}

export interface MobileSpaceMemoryReviewHintPreview {
  kind: 'duplicate_published';
  match: {
    content?: string | null;
    id: string;
    publishedAt?: string | null;
    summary?: string | null;
    title: string;
  };
  mergePreview: {
    addedSourceCount: number;
    updatesContent: boolean;
    updatesSummary: boolean;
    updatesTitle: boolean;
  };
}

export interface MobileSpaceMemoryEntryPreview {
  actor?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  };
  category: MobileSpaceMemoryCategory;
  content?: string | null;
  history?: MobileSpaceMemoryGovernanceHistoryPreview[];
  id: string;
  intake?: MobileSpaceMemoryIntakePreview;
  kind: 'candidate' | 'memory';
  publishedAt?: string | null;
  recall?: MobileSpaceMemoryRecallPolicyPreview;
  reviewHint?: MobileSpaceMemoryReviewHintPreview;
  sourceCount: number;
  sourceRefs: MobileSpaceMemorySourceRefPreview[];
  summary?: string | null;
  title: string;
  updatedAt: string;
}

export interface MobileSpaceMemorySectionResult {
  contract: MobileSpaceMemorySurfaceContract;
  items: MobileSpaceMemoryEntryPreview[];
  section: MobileSpaceMemorySection;
  surface: MobileSpaceMemorySurface;
}

export interface MobileSpaceMemoryEntryResult {
  contract: MobileSpaceMemorySurfaceContract;
  entry: MobileSpaceMemoryEntryPreview;
  surface: MobileSpaceMemorySurface;
}

export interface MobileSpaceMemoryAuditBundle {
  auditPath: string;
  detailView: 'audit';
  entry: MobileSpaceMemoryEntryPreview;
  exportedAt: string;
  recallFilter: MobileSpaceMemoryRecallFilter;
  section: MobileSpaceMemorySection;
  space: {
    id: string;
    kind?: MobileSpaceKind | string | null;
    membershipRole?: MobileSpaceRole | string | null;
    name?: string | null;
  };
}

export interface MobileSpaceMemoryAuditBatchBundle {
  count: number;
  exportedAt: string;
  items: MobileSpaceMemoryAuditBundle[];
  recallFilter: MobileSpaceMemoryRecallFilter;
  space: {
    id: string;
    kind?: MobileSpaceKind | string | null;
    membershipRole?: MobileSpaceRole | string | null;
    name?: string | null;
  };
}

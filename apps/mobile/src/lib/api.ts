/**
 * API service layer for Avato mobile.
 *
 * Wraps raw HTTP calls to the backend. We use plain fetch (not tRPC client)
 * because the server-side tRPC types are not directly importable in RN
 * without pulling in Next.js / Node dependencies.
 *
 * All endpoints follow the tRPC HTTP convention:
 *   GET  /trpc/mobile/<procedure>?input=<json>
 *   POST /trpc/mobile/<procedure>  body: { json: input }
 */

import * as FileSystem from 'expo-file-system/legacy';

import type {
  AgentSkillItem,
  AiProviderDetailItem,
  AiProviderListItem,
  AiProviderModelItem,
  AiProviderRuntimeState,
  ChatFileItem,
  ChatImageItem,
  ChatMessage,
  ChatMessageMetadata,
  ChatPluginPayload,
  ChatSession,
  ChatToolPayload,
  CreateSessionConfig,
  DiscoverModel,
  FileListItem,
  GenerationBatch,
  GenerationTopic,
  GroundingSearch,
  HeatmapDay,
  ImageGenerationParams,
  InstalledPlugin,
  MarketAgent,
  MemoryActivityItem,
  MemoryContextItem,
  MemoryDetail,
  MemoryExperienceItem,
  MemoryIdentityItem,
  MemoryPagedResult,
  MemoryPersona,
  MemoryPreferenceItem,
  MessageContentPart,
  MobileMemoryEffort,
  MobileUserState,
  ModelRankItem,
  SessionRankItem,
  SessionTag,
  Topic,
  TopicRankItem,
  UserProfile,
  UserRegistrationDuration,
} from '../types';
import { clearStoredAuthSession, getAuthHeaders } from './auth';
import { useI18n } from './i18n';
import {
  getApiUrl,
  hasConfiguredUrl,
  setApiUrl,
  testConnection,
} from './server';

export { clearStoredAuthSession as clearAuth, getApiUrl, hasConfiguredUrl, setApiUrl, testConnection };

const DEFAULT_UPLOAD_DIRECTORY = 'files';
const MOBILE_UPLOAD_CACHE_DIR = `${FileSystem.cacheDirectory || ''}upload-cache/`;
const MOBILE_DOWNLOAD_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}downloads/`;
const COMMUNITY_MARKET_DEFAULT_PAGE_SIZE = 21;

const getCommunityMarketLocale = () => useI18n.getState().locale || 'en-US';

const normalizeCommunityMarketPageSize = (pageSize?: number) => {
  if (!pageSize || Number.isNaN(pageSize) || pageSize <= 0) {
    return COMMUNITY_MARKET_DEFAULT_PAGE_SIZE;
  }

  return pageSize;
};

const computeStringHash = (value: string) => {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `mobile-${value.length.toString(16)}-${(hash >>> 0).toString(16)}`;
};

const toIsoString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
};

const buildUploadMetadata = (name: string, directory?: string, pathname?: string) => {
  const extension = name.includes('.') ? name.split('.').pop() : undefined;
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const filename = extension ? `${uniqueId}.${extension}` : uniqueId;
  const date = Math.floor(Date.now() / 1000 / 60 / 60).toString();
  const dirname = `${directory || DEFAULT_UPLOAD_DIRECTORY}/${date}`;
  const path = pathname || `${dirname}/${filename}`;

  return {
    date,
    dirname,
    filename,
    path,
  };
};

const sanitizeFilename = (name: string) => name.replaceAll(/[^\w.-]+/g, '_');

const ensureDirectoryAsync = async (uri: string) => {
  if (!uri) throw new Error('filesystem directory unavailable');
  await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
};

const ensureUploadableUri = async (uri: string, name: string) => {
  if (uri.startsWith('file://')) return uri;

  await ensureDirectoryAsync(MOBILE_UPLOAD_CACHE_DIR);

  const filename = `${Date.now()}-${sanitizeFilename(name || 'upload.bin')}`;
  const targetUri = `${MOBILE_UPLOAD_CACHE_DIR}${filename}`;

  await FileSystem.copyAsync({
    from: uri,
    to: targetUri,
  });

  return targetUri;
};

const resolveRemoteFileUrl = (baseUrl: string, id: string, url?: string) => {
  if (url?.startsWith('http://') || url?.startsWith('https://') || url?.startsWith('file://')) {
    return url;
  }

  if (url?.startsWith('/')) {
    return `${baseUrl}${url}`;
  }

  return `${baseUrl}/f/${id}`;
};

const uploadFileToSameOrigin = async (
  baseUrl: string,
  uri: string,
  name: string,
  pathname: string,
  type: string,
  onProgress?: (progress: number) => void,
) => {
  const uploadTask = FileSystem.createUploadTask(
    new URL('/api/file/upload', `${baseUrl}/`).toString(),
    uri,
    {
      fieldName: 'file',
      headers: await getAuthHeaders(baseUrl),
      httpMethod: 'POST',
      mimeType: type,
      parameters: { pathname },
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    },
    (progressData) => {
      const { totalBytesExpectedToSend, totalBytesSent } = progressData;
      if (!onProgress || totalBytesExpectedToSend <= 0) return;
      onProgress(Math.min(99, Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)));
    },
  );
  const response = await uploadTask.uploadAsync();

  if (!response) {
    throw new Error('upload failed: empty response');
  }

  if (response.status < 200 || response.status >= 300) {
    let payload: { error?: string } | null;

    try {
      payload = response.body ? JSON.parse(response.body) : null;
    } catch {
      payload = null;
    }

    throw new Error(payload?.error || `upload failed: ${response.status}`);
  }
};

const getLocalFileDescriptor = async (uri: string) => {
  const info = await FileSystem.getInfoAsync(uri, { md5: true });

  if (!info.exists) {
    throw new Error('local file not found');
  }

  if (info.md5) {
    return {
      hash: info.md5,
      size: info.size || 0,
    };
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const approxSize = info.size || Math.floor((base64.length * 3) / 4);

  return {
    hash: computeStringHash(base64),
    size: approxSize,
  };
};

interface MobileServerMessageTextPart {
  text?: string;
  type: 'text';
}

interface MobileServerMessageImagePart {
  image?: string;
  image_url?: {
    url?: string;
  };
  type: 'image' | 'image_url';
}

type MobileServerMessagePart = MobileServerMessageImagePart | MobileServerMessageTextPart;

const normalizeMessageContent = (content: unknown) => {
  if (typeof content === 'string') {
    return { content, imageList: undefined as ChatImageItem[] | undefined, metadata: undefined };
  }

  if (!Array.isArray(content)) {
    return { content: '', imageList: undefined as ChatImageItem[] | undefined, metadata: undefined };
  }

  const parts = content as MobileServerMessagePart[];
  const textParts: string[] = [];
  const normalizedParts: MessageContentPart[] = [];
  const inlineImages: ChatImageItem[] = [];

  for (const part of parts) {
    if (part?.type === 'text' && typeof part.text === 'string') {
      textParts.push(part.text);
      normalizedParts.push({ text: part.text, type: 'text' });
      continue;
    }

    if (part?.type === 'image' || part?.type === 'image_url') {
      const url =
        typeof part.image === 'string'
          ? part.image
          : typeof part.image_url?.url === 'string'
            ? part.image_url.url
            : undefined;

      if (!url) continue;

      inlineImages.push({
        alt: `image-${inlineImages.length + 1}`,
        id: `inline-image-${inlineImages.length + 1}`,
        url,
      });
      normalizedParts.push({ image: url, type: 'image' });
    }
  }

  const hasImages = inlineImages.length > 0;

  return {
    content: textParts.join('\n\n'),
    imageList: hasImages ? inlineImages : undefined,
    metadata:
      hasImages && normalizedParts.length > 0
        ? ({
            isMultimodal: true,
            tempDisplayContent: JSON.stringify(normalizedParts),
          } satisfies Partial<ChatMessageMetadata>)
        : undefined,
  };
};

const normalizeMessage = (message: any): ChatMessage => {
  const normalizedContent = normalizeMessageContent(message?.content);
  const baseMetadata = message?.metadata as ChatMessageMetadata | undefined;
  const derivedMetadata = normalizedContent.metadata as ChatMessageMetadata | undefined;
  const metadata =
    baseMetadata || derivedMetadata
      ? ({
          ...baseMetadata,
          ...derivedMetadata,
        } as ChatMessageMetadata)
      : null;

  return {
    agentId: message?.agentId ?? message?.agent_id ?? undefined,
    content: normalizedContent.content,
    createdAt: toIsoString(message?.createdAt),
    error: message?.error ?? null,
    fileList: Array.isArray(message?.fileList) ? (message.fileList as ChatFileItem[]) : undefined,
    id: String(message?.id ?? ''),
    imageList: Array.isArray(message?.imageList)
      ? (message.imageList as ChatImageItem[])
      : normalizedContent.imageList,
    metadata,
    model: message?.model ?? message?.extra?.model ?? undefined,
    observationId: message?.observationId ?? message?.observation_id ?? undefined,
    parentId: message?.parentId ?? undefined,
    performance: message?.performance ?? message?.metadata?.performance ?? null,
    plugin: (message?.plugin as ChatPluginPayload | null | undefined) ?? null,
    pluginError: message?.pluginError ?? message?.plugin_error ?? undefined,
    pluginIntervention: message?.pluginIntervention ?? message?.plugin?.intervention ?? null,
    pluginState: message?.pluginState ?? message?.plugin_state ?? undefined,
    provider: message?.provider ?? message?.extra?.provider ?? undefined,
    reasoning: message?.reasoning ?? null,
    role: message?.role,
    search: (message?.search as GroundingSearch | null | undefined) ?? null,
    sessionId: String(message?.sessionId ?? ''),
    toolCallId: message?.tool_call_id ?? undefined,
    tools: (message?.tools as ChatToolPayload[] | null | undefined) ?? null,
    traceId: message?.traceId ?? message?.trace_id ?? undefined,
    updatedAt: toIsoString(message?.updatedAt),
    usage: message?.usage ?? message?.metadata?.usage ?? null,
  };
};

interface MobileToolFunction {
  arguments?: string;
  name?: string;
}

export interface MobileMessageToolCall {
  function: {
    arguments: string;
    name: string;
  };
  id: string;
  thoughtSignature?: string;
  type: string;
}

interface MobileToolCallChunk {
  function?: MobileToolFunction;
  id?: string;
  index?: number;
  thoughtSignature?: string;
  type?: string;
}

interface ParsedSSEChunk {
  data: any;
  event: string;
  id?: string;
}

const mergeToolCallChunks = (origin: MobileToolCallChunk[], value: MobileToolCallChunk[]) => {
  const next = [...origin];

  if (next.length === 0) {
    return value.map((item) => ({
      ...item,
      function: {
        arguments: item.function?.arguments || '',
        name: item.function?.name || '',
      },
      id: item.id || `${item.index || 0}`,
      type: item.type || 'function',
    }));
  }

  for (const incoming of value) {
    const index = incoming.index ?? 0;
    const incomingId = incoming.id;
    const existingByIdIndex = incomingId ? next.findIndex((item) => item.id === incomingId) : -1;

    if (existingByIdIndex !== -1) {
      const existing = next[existingByIdIndex];
      next[existingByIdIndex] = {
        ...existing,
        ...incoming,
        function: {
          arguments:
            (existing.function?.arguments || '') + (incoming.function?.arguments || ''),
          name: incoming.function?.name || existing.function?.name || '',
        },
      };
      continue;
    }

    if (!next[index]) {
      next.splice(index, 0, {
        ...incoming,
        function: {
          arguments: incoming.function?.arguments || '',
          name: incoming.function?.name || '',
        },
        id: incomingId || `${index}`,
        type: incoming.type || 'function',
      });
      continue;
    }

    const existingAtIndex = next[index];
    if (incomingId && existingAtIndex?.id !== incomingId) {
      next.push({
        ...incoming,
        function: {
          arguments: incoming.function?.arguments || '',
          name: incoming.function?.name || '',
        },
        id: incomingId,
        type: incoming.type || 'function',
      });
      continue;
    }

    next[index] = {
      ...existingAtIndex,
      ...incoming,
      function: {
        arguments:
          (existingAtIndex.function?.arguments || '') + (incoming.function?.arguments || ''),
        name: incoming.function?.name || existingAtIndex.function?.name || '',
      },
    };
  }

  return next;
};

const transformToolCalls = (toolCalls: MobileToolCallChunk[]): ChatToolPayload[] =>
  toolCalls.map((toolCall, index) => {
    const fullName = toolCall.function?.name || `tool_${index + 1}`;
    const slashSegments = fullName.split('/');
    const slashApiName = slashSegments.pop() || fullName;
    const slashIdentifier = slashSegments.join('/');
    const [underscoreIdentifier, underscoreApiName] = fullName.split('____');
    const identifier = underscoreApiName
      ? underscoreIdentifier
      : slashIdentifier || fullName;
    const apiName = underscoreApiName || slashApiName;

    return {
      apiName,
      arguments: toolCall.function?.arguments || '{}',
      id: toolCall.id || `${index}`,
      identifier,
      source: identifier.startsWith('lobe-') ? 'builtin' : undefined,
      thoughtSignature: toolCall.thoughtSignature,
      type: 'default',
    };
  });

async function getBaseUrl(): Promise<string> {
  return getApiUrl();
}

async function getHeaders(): Promise<Record<string, string>> {
  const baseUrl = await getBaseUrl();

  return {
    'Content-Type': 'application/json',
    ...(await getAuthHeaders(baseUrl)),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────
// The server tRPC router uses `superjson` as the data transformer.
// For raw fetch calls we must:
//   • Wrap inputs  → { json: actualInput }            (superjson envelope)
//   • Unwrap output ← response.result.data.json        (superjson envelope)

const extractTrpcErrorMessage = (payload: any) => {
  return (
    payload?.error?.json?.message ||
    payload?.error?.message ||
    payload?.message ||
    undefined
  );
};

const createTrpcHttpError = (
  action: 'mutation' | 'query',
  procedure: string,
  status: number,
  payload: any,
  rawText: string,
) => {
  const detail = extractTrpcErrorMessage(payload) || rawText.slice(0, 240).trim();
  const error = new Error(
    `tRPC ${action} ${procedure} failed: ${status}${detail ? ` - ${detail}` : ''}`,
  ) as Error & {
    body?: string;
    procedure?: string;
    status?: number;
  };

  error.body = rawText;
  error.procedure = procedure;
  error.status = status;

  return error;
};

const unwrapTrpcPayload = <T>(payload: any) => {
  const data = payload?.result?.data;
  return (data && typeof data === 'object' && 'json' in data ? data.json : data) as T;
};

async function requestTrpc<T = any>(params: {
  action: 'mutation' | 'query';
  input?: unknown;
  procedure: string;
}): Promise<T> {
  const base = await getBaseUrl();
  const envelope = params.input !== undefined ? { json: params.input } : undefined;
  const url =
    params.action === 'query'
      ? envelope
        ? `${base}/trpc/mobile/${params.procedure}?input=${encodeURIComponent(JSON.stringify(envelope))}`
        : `${base}/trpc/mobile/${params.procedure}`
      : `${base}/trpc/mobile/${params.procedure}`;

  const res = await fetch(url, {
    body: params.action === 'mutation' ? JSON.stringify(envelope ?? { json: undefined }) : undefined,
    headers: await getHeaders(),
    method: params.action === 'mutation' ? 'POST' : 'GET',
  });
  const rawText = await res.text();

  let payload: any = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    throw createTrpcHttpError(params.action, params.procedure, res.status, payload, rawText);
  }

  return unwrapTrpcPayload<T>(payload);
}

async function trpcQuery<T = any>(procedure: string, input?: unknown): Promise<T> {
  return requestTrpc<T>({ action: 'query', input, procedure });
}

async function trpcMutate<T = any>(procedure: string, input?: unknown): Promise<T> {
  return requestTrpc<T>({ action: 'mutation', input, procedure });
}

// ── Agent API ───────────────────────────────────────────────────────
export interface AgentQueryItem {
  avatar?: string | null;
  backgroundColor?: string | null;
  description?: string | null;
  id: string;
  title?: string | null;
}

export const agentApi = {
  /** Create a new agent (with session). Returns { agentId, sessionId }. */
  create: (config?: Record<string, unknown>, tagId?: string) =>
    trpcMutate<{ agentId: string; sessionId: string }>('agent.createAgent', {
      config,
      tagId,
    }),

  queryAgents: (params?: { keyword?: string; limit?: number; offset?: number }) =>
    trpcQuery<AgentQueryItem[]>('agent.queryAgents', params),

  /** Get agent config by session ID. Returns the agent config including plugins. */
  getConfigBySession: (sessionId: string) =>
    trpcQuery<{ id: string; plugins?: string[]; [key: string]: any } | null>(
      'agent.getAgentConfig',
      { sessionId },
    ),

  /** Update agent config (e.g. plugins). */
  updateConfig: (agentId: string, value: Record<string, any>) =>
    trpcMutate('agent.updateAgentConfig', { agentId, value }),
};

// ── Session API ─────────────────────────────────────────────────────
export const sessionApi = {
  /** Fetch grouped sessions. Server returns {sessionGroups, sessions}. */
  list: async (): Promise<ChatSession[]> => {
    const result = await trpcQuery<{ sessionGroups: any[]; sessions: any[] }>(
      'session.getGroupedSessions',
    );
    return (result?.sessions ?? []).map((s) => ({
      ...s,
      agentId: s.config?.id ?? undefined,
      title: s.meta?.title ?? s.title ?? '',
      description: s.meta?.description ?? s.description,
      avatar: s.meta?.avatar ?? s.avatar,
      chatConfig: s.config?.chatConfig ?? s.chatConfig,
      model: s.model || s.config?.model || undefined,
      provider: s.config?.provider || undefined,
      tagId: s.tagId ?? undefined,
      type: s.type ?? 'agent',
    }));
  },
  /** Create a new session (same semantic path as web). Returns the new session ID string. */
  create: (config?: CreateSessionConfig) =>
    trpcMutate<string>('session.createSession', {
      config: {
        avatar: config?.avatar,
        description: config?.description,
        model: config?.model,
        plugins: config?.plugins,
        provider: config?.provider,
        systemRole: config?.systemPrompt,
        title: config?.title || 'New Conversation',
      },
      session: { tagId: config?.tagId },
      type: 'agent' as const,
    }),
  remove: (id: string) => trpcMutate('session.removeSession', { id }),
  removeChatGroup: (id: string) => trpcMutate('agentGroup.deleteGroup', { id }),
  pin: (id: string) =>
    trpcMutate('session.updateSession', { id, value: { pinned: true } }),
  unpin: (id: string) =>
    trpcMutate('session.updateSession', { id, value: { pinned: false } }),
  updateTag: (id: string, tagId?: string | null) =>
    trpcMutate('session.updateSession', { id, value: { tagId: tagId || null } }),
  duplicate: (id: string, title = 'Duplicated') =>
    trpcMutate<string | undefined>('session.cloneSession', { id, newTitle: title }),
  rename: (id: string, title: string) =>
    trpcMutate('session.updateSession', { id, value: { title } }),
  search: async (keywords: string): Promise<ChatSession[]> => {
    const result = await trpcQuery<any[]>('session.searchSessions', { keywords });

    return (result ?? []).map((s) => ({
      ...s,
      agentId: s.config?.id ?? undefined,
      title: s.meta?.title ?? s.title ?? '',
      description: s.meta?.description ?? s.description,
      avatar: s.meta?.avatar ?? s.avatar,
      chatConfig: s.config?.chatConfig ?? s.chatConfig,
      model: s.model || s.config?.model || undefined,
      provider: s.config?.provider || undefined,
      tagId: s.tagId ?? undefined,
      type: s.type ?? 'agent',
    }));
  },
  updateChatConfig: (id: string, config: Record<string, unknown>) =>
    trpcMutate('session.updateSessionChatConfig', { id, value: config }),
  generateTitle: (sessionId: string) =>
    trpcMutate<string | null>('session.generateSessionTitle', { sessionId }),
};

// ── Agent Group API (multi-agent chat) ───────────────────────────────
export interface AgentGroupDetail {
  [key: string]: any;
  agents?: Array<{ id: string; title?: string; [key: string]: any }>;
  config?: Record<string, any>;
  id: string;
  meta?: { avatar?: string; description?: string; title?: string };
  supervisorAgentId?: string;
}

export const agentGroupApi = {
  createGroup: (config?: { config?: Record<string, any>; title?: string }) =>
    trpcMutate<{ group: { id: string }; supervisorAgentId: string }>('agentGroup.createGroup', {
      config: config?.config,
      title: config?.title || 'New Group Chat',
    }),

  createGroupWithMembers: (params: {
    groupConfig?: { config?: Record<string, any>; title?: string };
    members: Array<{ model?: string; provider?: string; systemRole?: string; title?: string }>;
  }) =>
    trpcMutate<{ agentIds: string[]; groupId: string; supervisorAgentId: string }>(
      'agentGroup.createGroupWithMembers',
      {
        groupConfig: {
          config: params.groupConfig?.config,
          title: params.groupConfig?.title || 'New Group Chat',
        },
        members: params.members,
      },
    ),

  getGroupDetail: (groupId: string) =>
    trpcQuery<AgentGroupDetail | null>('agentGroup.getGroupDetail', { id: groupId }),

  getGroups: () => trpcQuery<AgentGroupDetail[]>('agentGroup.getGroups'),

  addAgentsToGroup: (groupId: string, agentIds: string[]) =>
    trpcMutate('agentGroup.addAgentsToGroup', { agentIds, groupId }),

  removeAgentsFromGroup: (
    groupId: string,
    agentIds: string[],
    options?: { deleteVirtualAgents?: boolean },
  ) =>
    trpcMutate('agentGroup.removeAgentsFromGroup', {
      agentIds,
      deleteVirtualAgents: options?.deleteVirtualAgents,
      groupId,
    }),

  updateGroup: (groupId: string, value: Record<string, any>) =>
    trpcMutate('agentGroup.updateGroup', { id: groupId, value }),
};

// ── AI Agent API (group chat execution) ───────────────────────────────
export const aiAgentApi = {
  execGroupAgent: (params: {
    agentId: string;
    files?: string[];
    groupId: string;
    message: string;
    topicId?: string;
  }) =>
    trpcMutate<{
      assistantMessageId?: string;
      isCreateNewTopic?: boolean;
      operationId?: string;
      success?: boolean;
      topicId?: string;
      topics?: { items: any[]; total: number };
    }>('aiAgent.execGroupAgent', params),
  interruptTask: (params: { operationId?: string; threadId?: string }) =>
    trpcMutate('aiAgent.interruptTask', params),
  getOperationStatus: (params: {
    historyLimit?: number;
    includeHistory?: boolean;
    operationId: string;
  }) =>
    trpcQuery<{
      currentState?: {
        error?: { message?: string } | string | null;
        status?: string;
      } | null;
      hasError?: boolean;
      isActive?: boolean;
      isCompleted?: boolean;
      operationId: string;
    } | null>('aiAgent.getOperationStatus', params),
};

// ── Message API ─────────────────────────────────────────────────────
export interface CreateMessageParams {
  content: string;
  files?: string[];
  imageList?: ChatImageItem[];
  metadata?: ChatMessageMetadata | null;
  model?: string;
  observationId?: string;
  parentId?: string;
  provider?: string;
  reasoning?: {
    content?: string;
    duration?: number;
    isMultimodal?: boolean;
    signature?: string;
  } | null;
  role: 'user' | 'assistant';
  search?: GroundingSearch | null;
  sessionId: string;
  tools?: ChatToolPayload[] | null;
  topicId?: string;
  traceId?: string;
}

export interface MessageSearchResult {
  content: string;
  createdAt?: string;
  id: string;
  sessionId: string;
  topicId?: string;
}

export const messageApi = {
  list: (
    sessionId: string,
    topicId?: string,
    options?: { sessionType?: 'agent' | 'group' },
  ) => {
    const params =
      options?.sessionType === 'group'
        ? { groupId: sessionId, topicId }
        : { sessionId, topicId };
    return trpcQuery<any[]>('message.getMessages', params).then((messages) =>
      (messages ?? []).map(normalizeMessage),
    );
  },

  create: (params: CreateMessageParams) =>
    trpcMutate<{ id: string; messages: any[] }>('message.createMessage', params).then((result) => ({
      id: result.id,
      messages: (result.messages ?? []).map(normalizeMessage),
    })),

  remove: (id: string) => trpcMutate('message.removeMessage', { id }),
  /** Server procedure is `message.update`, NOT `message.updateMessage` */
  update: (id: string, content: string) =>
    trpcMutate('message.update', { id, value: { content } }),
  /** Server expects `{ ids: string[] }`, NOT `{ sessionId, topicId }` */
  removeAll: (ids: string[]) =>
    trpcMutate('message.removeMessages', { ids }),
  search: (keywords: string) =>
    trpcQuery<MessageSearchResult[]>('message.searchMessages', { keywords }),
};

// ── AI Chat API ─────────────────────────────────────────────────────
export interface ChatRequestOptions {
  enabledSearch?: boolean;
  enableSearch?: boolean;
  frequency_penalty?: number;
  max_tokens?: number;
  memory?: {
    effort?: MobileMemoryEffort;
    enabled?: boolean;
  };
  model?: string;
  plugins?: string[];
  presence_penalty?: number;
  provider?: string;
  sessionId?: string;
  systemPrompt?: string;
  temperature?: number;
  top_p?: number;
  topicId?: string;
}

export interface ToolExecutionItem {
  apiName: string;
  arguments: string;
  id: string;
  identifier: string;
  result: string;
}

export interface StreamCallbacks {
  onContent?: (state: StreamContentState) => void;
  onImages?: (images: ChatImageItem[]) => void;
  onPerformance?: (perf: Record<string, any>) => void;
  onReasoning?: (state: StreamReasoningState) => void;
  onSearch?: (search: GroundingSearch) => void;
  onToolExecutions?: (executions: ToolExecutionItem[]) => void;
  onTools?: (tools: ChatToolPayload[]) => void;
  onUsage?: (usage: Record<string, any>) => void;
}

export interface StreamContentState {
  content: string;
  isMultimodal?: boolean;
  tempDisplayContent?: string;
}

export interface StreamReasoningState {
  content?: string;
  isMultimodal?: boolean;
  tempDisplayContent?: MessageContentPart[];
}

export interface StreamResult {
  contentMetadata?: Pick<ChatMessageMetadata, 'isMultimodal' | 'tempDisplayContent'>;
  images?: ChatImageItem[];
  performance?: Record<string, any>;
  reasoning?: StreamReasoningState;
  search?: GroundingSearch;
  text: string;
  toolExecutions?: ToolExecutionItem[];
  tools?: ChatToolPayload[];
  usage?: Record<string, any>;
}

export interface MobileUserMessageContentPartText {
  text: string;
  type: 'text';
}

export interface MobileUserMessageContentPartImage {
  image_url: {
    detail?: 'auto' | 'high' | 'low';
    url: string;
  };
  type: 'image_url';
}

export type MobileUserMessageContentPart =
  | MobileUserMessageContentPartImage
  | MobileUserMessageContentPartText;

export interface MobileChatMessage {
  content: string | MobileUserMessageContentPart[];
  name?: string;
  reasoning?: {
    content?: string;
    duration?: number;
  };
  role: string;
  tool_call_id?: string;
  tool_calls?: MobileMessageToolCall[];
}

const isInlineImageUrl = (url?: string): url is string =>
  typeof url === 'string' && url.startsWith('data:image/');

const shouldForceInlineImages = (_provider: string) => true;

const collectLastUserMessageDebugStats = (content: MobileChatMessage['content']) => {
  if (typeof content === 'string') {
    return {
      imagePartCount: 0,
      kind: 'string' as const,
      textPartCount: content.trim() ? 1 : 0,
      textPreview: content.slice(0, 160),
    };
  }

  let imagePartCount = 0;
  const textParts: string[] = [];

  for (const part of content) {
    if (part.type === 'text') {
      if (part.text.trim()) textParts.push(part.text);
      continue;
    }

    if (part.type === 'image_url') imagePartCount += 1;
  }

  return {
    imagePartCount,
    kind: 'array' as const,
    textPartCount: textParts.length,
    textPreview: textParts.join('\n\n').slice(0, 160),
  };
};

const logFinalLastUserMessage = (provider: string, messages: MobileChatMessage[]) => {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');

  if (!lastUserMessage) {
    console.info(`[aiChatApi] final last user message provider=${provider} role=missing`);
    return;
  }

  const { imagePartCount, kind, textPartCount, textPreview } = collectLastUserMessageDebugStats(
    lastUserMessage.content,
  );

  console.info(
    `[aiChatApi] final last user message provider=${provider} role=${lastUserMessage.role} contentType=${kind} textParts=${textPartCount} imageParts=${imagePartCount} textPreview=${JSON.stringify(textPreview)}`,
  );
};

const sanitizeMessagesForProvider = (messages: MobileChatMessage[]): MobileChatMessage[] =>
  messages.map((message) => {
    if (message.role !== 'user' || !Array.isArray(message.content)) return message;

    const textParts: MobileUserMessageContentPartText[] = [];
    const inlineImageParts: MobileUserMessageContentPartImage[] = [];

    for (const part of message.content) {
      if (part.type === 'text') {
        textParts.push(part);
        continue;
      }

      const url = part.image_url?.url;

      if (isInlineImageUrl(url)) {
        inlineImageParts.push(part);
      }
    }

    const collapsedText = textParts
      .map((part) => part.text)
      .filter(Boolean)
      .join('\n\n');
    const hasText = collapsedText.trim().length > 0;
    const hasImages = inlineImageParts.length > 0;

    if (!hasText && !hasImages) {
      return {
        ...message,
        content: '',
      };
    }

    if (hasText && !hasImages) {
      return {
        ...message,
        content: collapsedText,
      };
    }

    if (!hasText && hasImages) {
      return {
        ...message,
        content: inlineImageParts,
      };
    }

    return {
      ...message,
      content: [...textParts, ...inlineImageParts],
    };
  });

/**
 * Create a stateful SSE parser. The parser must be stateful because SSE fields
 * (id, event, data) often arrive in SEPARATE XHR onprogress chunks in React
 * Native, so `currentEvent` must persist across calls.
 */
function createSSEParser() {
  let lineBuffer = '';
  let currentEvent = '';
  let currentId = '';

  return function parse(raw: string): ParsedSSEChunk[] {
    const combined = lineBuffer + raw;
    const lines = combined.split('\n');
    lineBuffer = lines.pop() ?? '';

    const chunks: ParsedSSEChunk[] = [];

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '');
      if (trimmed.startsWith('id:')) {
        currentId = trimmed.slice(3).trim();
      } else if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          parsed = dataStr.replaceAll('\\n', '\n');
        }

        chunks.push({
          data: parsed,
          event: currentEvent || 'text',
          id: currentId || undefined,
        });
      } else if (trimmed === '') {
        currentEvent = '';
        currentId = '';
      }
    }

    return chunks;
  };
}

const appendTextPart = (parts: MessageContentPart[], text: string): MessageContentPart[] => {
  if (!text) return parts;

  const lastPart = parts.at(-1);
  if (lastPart?.type === 'text') {
    return [...parts.slice(0, -1), { text: lastPart.text + text, type: 'text' }];
  }

  return [...parts, { text, type: 'text' }];
};

const appendImagePart = (parts: MessageContentPart[], image: string): MessageContentPart[] => [
  ...parts,
  { image, type: 'image' },
];

const serializeContentParts = (parts: MessageContentPart[]) => JSON.stringify(parts);

export const aiChatApi = {
  /**
   * Stream AI response via XMLHttpRequest (React Native's fetch lacks
   * ReadableStream support). Calls onText/onReasoning with accumulated
   * content as SSE events arrive.
   *
   * Handles both native `event: reasoning` SSE events AND `<think>` tags
   * embedded in text content (fallback for providers whose stream transformers
   * don't split `<think>` tags into reasoning events, e.g. Qwen).
   */
  createAssistantMessageStream: (
    provider: string,
    messages: MobileChatMessage[],
    options: ChatRequestOptions | undefined,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<StreamResult> => {
    const attempt = async (): Promise<StreamResult> => {
      const [base, headers] = await Promise.all([getBaseUrl(), getHeaders()]);

      if (!headers['X-lobe-chat-auth'] && !headers['Oidc-Auth']) {
        throw new Error('Auth session expired — please sign in again');
      }

      return new Promise<StreamResult>((resolve, reject) => {
        let allMessages = [...messages];

        if (shouldForceInlineImages(provider)) {
          allMessages = sanitizeMessagesForProvider(allMessages);
          console.info(`[aiChatApi] sanitized provider=${provider} msgCount=${allMessages.length}`);
        }

        logFinalLastUserMessage(provider, allMessages);

        if (options?.systemPrompt) {
          allMessages.unshift({ role: 'system', content: options.systemPrompt });
        }

        const payload: Record<string, unknown> = {
          apiMode: 'chatCompletion',
          messages: allMessages,
          model: options?.model || 'gpt-4o-mini',
          stream: true,
        };
        if (options?.temperature !== undefined) payload.temperature = options.temperature;
        if (options?.top_p !== undefined) payload.top_p = options.top_p;
        if (options?.frequency_penalty !== undefined)
          payload.frequency_penalty = options.frequency_penalty;
        if (options?.presence_penalty !== undefined)
          payload.presence_penalty = options.presence_penalty;
        if (options?.max_tokens !== undefined) payload.max_tokens = options.max_tokens;
        if (options?.enabledSearch ?? options?.enableSearch) payload.enabledSearch = true;
        if (options?.memory) payload.memory = options.memory;
        if (options?.sessionId) payload.sessionId = options.sessionId;
        if (options?.topicId) payload.topicId = options.topicId;
        if (options?.plugins?.length) payload.plugins = options.plugins;

        const url = `${base}/webapi/chat/${provider}`;
        const imageUrls: string[] = [];
        for (const m of allMessages) {
          if (Array.isArray(m.content)) {
            for (const p of m.content as any[]) {
              if (p?.type === 'image_url') imageUrls.push(p.image_url?.url ?? '(missing)');
            }
          }
        }
        const hasAuth = !!headers['X-lobe-chat-auth'] || !!headers['Oidc-Auth'];
        console.info(
          `[aiChatApi] POST ${url} model=${payload.model} msgs=${allMessages.length} images=${imageUrls.length} auth=${hasAuth}`,
        );
        if (imageUrls.length > 0) {
          console.info('[aiChatApi] image URLs:', imageUrls.map((u) => u.slice(0, 120)));
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.responseType = 'text';
        xhr.timeout = 180_000;

        for (const [key, value] of Object.entries(headers)) {
          xhr.setRequestHeader(key, value);
        }
        xhr.setRequestHeader('X-Avato-Mobile-Client', '1');

        let accText = '';
        let accReasoning = '';
        let accImages: ChatImageItem[] = [];
        let accSearch: GroundingSearch | undefined;
        let accTools: ChatToolPayload[] | undefined;
        let accToolExecutions: ToolExecutionItem[] | undefined;
        let contentMetadata: StreamResult['contentMetadata'];
        let lastUsage: Record<string, any> | undefined;
        let lastPerformance: Record<string, any> | undefined;
        let processedLength = 0;
        let thinkingInContent = false;
        let contentParts: MessageContentPart[] = [];
        let reasoningParts: MessageContentPart[] = [];
        let rawToolCalls: MobileToolCallChunk[] = [];
        let rawTextBuffer = '';
        const parseSSE = createSSEParser();

        const emitReasoningUpdate = () => {
          const hasReasoningImages = reasoningParts.some((part) => part.type === 'image');

          callbacks.onReasoning?.(
            hasReasoningImages
              ? {
                  content: accReasoning,
                  isMultimodal: true,
                  tempDisplayContent: reasoningParts,
                }
              : { content: accReasoning },
          );
        };

        const emitContentUpdate = () => {
          const hasContentImages = contentParts.some((part) => part.type === 'image');

          contentMetadata = hasContentImages
            ? {
                isMultimodal: true,
                tempDisplayContent: serializeContentParts(contentParts),
              }
            : undefined;

          callbacks.onContent?.({
            content: accText,
            ...contentMetadata,
          });
        };

        const processNewData = (newData: string) => {
          const parsedChunks = parseSSE(newData);

          for (const chunk of parsedChunks) {
            switch (chunk.event) {
              case 'usage': {
                if (chunk.data && typeof chunk.data === 'object') {
                  lastUsage = chunk.data;
                  callbacks.onUsage?.(chunk.data);
                }
                break;
              }
              case 'speed':
              case 'performance': {
                if (chunk.data && typeof chunk.data === 'object') {
                  lastPerformance = chunk.data;
                  callbacks.onPerformance?.(chunk.data);
                }
                break;
              }
              case 'grounding': {
                if (chunk.data && typeof chunk.data === 'object') {
                  accSearch = chunk.data as GroundingSearch;
                  callbacks.onSearch?.(accSearch);
                }
                break;
              }
              case 'reasoning_signature': {
                break;
              }
              case 'tool_calls': {
                const payload = Array.isArray(chunk.data) ? chunk.data : [];
                rawToolCalls = mergeToolCallChunks(rawToolCalls, payload as MobileToolCallChunk[]);
                accTools = transformToolCalls(rawToolCalls);
                callbacks.onTools?.(accTools);
                break;
              }
              case 'tool_executions': {
                const payload = Array.isArray(chunk.data) ? (chunk.data as ToolExecutionItem[]) : [];
                if (payload.length > 0) {
                  accToolExecutions = payload;
                  callbacks.onToolExecutions?.(accToolExecutions);
                }
                break;
              }
              case 'reasoning': {
                if (typeof chunk.data === 'string') {
                  accReasoning += chunk.data;
                  emitReasoningUpdate();
                }
                break;
              }
              case 'reasoning_part': {
                if (chunk.data?.partType === 'text' && typeof chunk.data?.content === 'string') {
                  reasoningParts = appendTextPart(reasoningParts, chunk.data.content);
                  accReasoning += chunk.data.content;
                  emitReasoningUpdate();
                } else if (
                  chunk.data?.partType === 'image' &&
                  typeof chunk.data?.content === 'string'
                ) {
                  const mimeType =
                    typeof chunk.data?.mimeType === 'string'
                      ? chunk.data.mimeType
                      : 'image/png';
                  reasoningParts = appendImagePart(
                    reasoningParts,
                    `data:${mimeType};base64,${chunk.data.content}`,
                  );
                  emitReasoningUpdate();
                }
                break;
              }
              case 'content_part': {
                if (chunk.data?.partType === 'text' && typeof chunk.data?.content === 'string') {
                  contentParts = appendTextPart(contentParts, chunk.data.content);
                  rawTextBuffer += chunk.data.content;
                } else if (
                  chunk.data?.partType === 'image' &&
                  typeof chunk.data?.content === 'string'
                ) {
                  const mimeType =
                    typeof chunk.data?.mimeType === 'string'
                      ? chunk.data.mimeType
                      : 'image/png';
                  contentParts = appendImagePart(
                    contentParts,
                    `data:${mimeType};base64,${chunk.data.content}`,
                  );
                  emitContentUpdate();
                }
                break;
              }
              case 'base64_image': {
                if (typeof chunk.data === 'string') {
                  const imageId = chunk.id || `tmp_img_${Date.now()}_${accImages.length}`;
                  accImages = [
                    ...accImages,
                    {
                      alt: 'Generated image',
                      id: imageId,
                      url: `data:image/png;base64,${chunk.data}`,
                    },
                  ];
                  callbacks.onImages?.(accImages);
                }
                break;
              }
              default: {
                if (typeof chunk.data === 'string') {
                  rawTextBuffer += chunk.data;
                } else if (typeof chunk.data === 'number') {
                  rawTextBuffer += String(chunk.data);
                } else if (chunk.data && typeof chunk.data === 'object' && 'text' in chunk.data) {
                  rawTextBuffer += String(chunk.data.text ?? '');
                }
                break;
              }
            }
          }

          if (rawTextBuffer) {
            if (rawTextBuffer.includes('<think>') || thinkingInContent) {
              if (!thinkingInContent && rawTextBuffer.includes('<think>')) {
                thinkingInContent = true;
              }

              if (rawTextBuffer.includes('</think>')) {
                thinkingInContent = false;
                const thinkStart = rawTextBuffer.indexOf('<think>');
                const thinkEnd = rawTextBuffer.indexOf('</think>');
                const before = rawTextBuffer.slice(0, thinkStart < 0 ? 0 : thinkStart);
                const thinkContent = rawTextBuffer.slice(
                  (thinkStart < 0 ? 0 : thinkStart) + 7,
                  thinkEnd,
                );
                const after = rawTextBuffer.slice(thinkEnd + 8);

                if (thinkContent) {
                  accReasoning = thinkContent;
                  emitReasoningUpdate();
                }
                const combined = before + after;
                if (combined) {
                  accText = combined;
                  emitContentUpdate();
                }
              } else {
                const thinkStart = rawTextBuffer.indexOf('<think>');
                const beforeThink = rawTextBuffer.slice(0, thinkStart < 0 ? 0 : thinkStart);
                const thinkContent = rawTextBuffer
                  .slice((thinkStart < 0 ? 0 : thinkStart) + 7)
                  .replaceAll('<think>', '');

                if (thinkContent) {
                  accReasoning = thinkContent;
                  emitReasoningUpdate();
                }
                if (beforeThink) {
                  accText = beforeThink;
                  emitContentUpdate();
                }
              }
            } else {
              accText = rawTextBuffer;
              emitContentUpdate();
            }
          }
        };

        xhr.onprogress = () => {
          try {
            const newData = xhr.responseText.slice(processedLength);
            processedLength = xhr.responseText.length;
            processNewData(newData);
          } catch (e) {
            console.error('[aiChatApi] SSE parse error in onprogress:', e);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 400) {
            let detail = '';
            try {
              const raw = xhr.responseText;
              if (raw) {
                const parsed = JSON.parse(raw);
                const providerHint = parsed?.body?.provider ? `[${parsed.body.provider}] ` : '';
                const innerMsg =
                  parsed?.body?.error?.message ||
                  parsed?.body?.message ||
                  parsed?.body?.error?.errorMessage ||
                  '';
                const errorType = parsed?.errorType || '';
                detail = innerMsg
                  ? `${providerHint}${innerMsg}`
                  : `${providerHint}${errorType}`;
              }
            } catch {
              detail = (xhr.responseText || '').slice(0, 200);
            }
            const msg = detail
              ? `AI chat failed: ${xhr.status} — ${detail}`
              : `AI chat failed: ${xhr.status}`;
            console.error('[aiChatApi]', msg);
            console.error('[aiChatApi] Full response body:', (xhr.responseText || '').slice(0, 1500));
            reject(new Error(msg));
            return;
          }
          const remaining = xhr.responseText.slice(processedLength);
          if (remaining) processNewData(remaining);
          processNewData('\n');
          resolve({
            contentMetadata,
            images: accImages.length > 0 ? accImages : undefined,
            performance: lastPerformance,
            reasoning:
              reasoningParts.length > 0
                ? {
                    content: accReasoning,
                    isMultimodal: reasoningParts.some((part) => part.type === 'image'),
                    ...(reasoningParts.some((part) => part.type === 'image')
                      ? { tempDisplayContent: reasoningParts }
                      : {}),
                  }
                : accReasoning
                  ? { content: accReasoning }
                  : undefined,
            search: accSearch,
            text: accText,
            toolExecutions: accToolExecutions,
            tools: accTools,
            usage: lastUsage,
          });
        };

        xhr.onerror = () => {
          const info = `status=${xhr.status} readyState=${xhr.readyState}`;
          console.error(`[aiChatApi] XHR onerror: ${info}`);
          reject(new Error(`Network error (${info})`));
        };
        xhr.ontimeout = () => reject(new Error(`AI chat timed out (${xhr.timeout}ms)`));

        if (signal) {
          signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.send(JSON.stringify(payload));
      });
    };

    const run = async (): Promise<StreamResult> => {
      try {
        return await attempt();
      } catch (firstError) {
        if (signal?.aborted) throw firstError;
        const isHttpError =
          firstError instanceof Error && /AI chat failed: \d+/.test(firstError.message);
        if (isHttpError) throw firstError;
        console.warn('[aiChatApi] first attempt failed (network), retrying once:', firstError);
        await new Promise((r) => setTimeout(r, 800));
        return attempt();
      }
    };

    return run();
  },
};

// ── Topic API ───────────────────────────────────────────────────────
export const topicApi = {
  list: (containerId: string, options?: { sessionType?: 'agent' | 'group' }) => {
    const params =
      options?.sessionType === 'group'
        ? { groupId: containerId }
        : { sessionId: containerId };
    return trpcQuery<{ items: Topic[]; total: number } | Topic[]>(
      'topic.getTopics',
      params,
    ).then((res) => (Array.isArray(res) ? res : res?.items ?? []));
  },
  /** Returns topic ID string, not full Topic object. */
  create: (
    containerId: string,
    title: string,
    options?: { messageIds?: string[]; sessionType?: 'agent' | 'group' },
  ) => {
    const params =
      options?.sessionType === 'group'
        ? { groupId: containerId, messages: options?.messageIds, title }
        : { messages: options?.messageIds, sessionId: containerId, title };
    return trpcMutate<string>('topic.createTopic', params);
  },
  remove: (id: string) => trpcMutate('topic.removeTopic', { id }),
  /** Server has no `favoriteTopic` — use `updateTopic` with favorite flag */
  favorite: (id: string, favorite = true) =>
    trpcMutate('topic.updateTopic', { id, value: { favorite } }),
  generateTitle: (id: string) =>
    trpcMutate<string | null>('topic.generateTopicTitle', { id }),
  update: (id: string, title: string) =>
    trpcMutate('topic.updateTopic', { id, value: { title } }),
  search: (keywords: string) => trpcQuery<Topic[]>('topic.searchTopics', { keywords }),
};

// ── Session Tag API ────────────────────────────────────────────────
export const sessionTagApi = {
  list: () => trpcQuery<SessionTag[]>('sessionTag.getSessionTags'),
  create: (name: string, color?: string | null) =>
    trpcMutate<string | undefined>('sessionTag.createSessionTag', { color, name }),
  remove: (id: string) => trpcMutate('sessionTag.removeSessionTag', { id }),
  removeAll: () => trpcMutate('sessionTag.removeAllSessionTags'),
  update: (id: string, value: { color?: string | null; name?: string }) =>
    trpcMutate('sessionTag.updateSessionTag', { id, value }),
  updateOrder: (sortMap: { id: string; sort: number }[]) =>
    trpcMutate('sessionTag.updateSessionTagOrder', { sortMap }),
};

// ── Market / Community API ──────────────────────────────────────────
export const marketApi = {
  /** Server uses "Assistant" naming, not "Agent" */
  getAgentList: (locale = 'en-US') =>
    trpcQuery<{ agents: MarketAgent[] }>('market.getAssistantList', { locale }),
  getAgentDetail: (identifier: string) =>
    trpcQuery<MarketAgent>('market.getAssistantDetail', { identifier }),
};

// ── AI Model API ───────────────────────────────────────────────────
export const aiModelApi = {
  listByProvider: (providerId: string) =>
    trpcQuery<DiscoverModel[]>('aiModel.getAiProviderModelList', { id: providerId }),
  /** Get all models (enabled + disabled) for a provider */
  getProviderModels: (providerId: string) =>
    trpcQuery<AiProviderModelItem[]>('aiModel.getAiProviderModelList', { id: providerId }),
  /** Toggle a single model enabled/disabled */
  toggleEnabled: (params: { id: string; providerId: string; enabled: boolean }) =>
    trpcMutate('aiModel.toggleModelEnabled', params),
};

// ── AI Provider API ────────────────────────────────────────────────
export const aiProviderApi = {
  list: () => trpcQuery<AiProviderListItem[]>('aiProvider.getAiProviderList'),
  getRuntimeState: () =>
    trpcQuery<AiProviderRuntimeState>('aiProvider.getAiProviderRuntimeState', { isLogin: true }),
  /** Get provider detail (includes keyVaults, settings) */
  getById: (id: string) =>
    trpcQuery<AiProviderDetailItem>('aiProvider.getAiProviderById', { id }),
  /** Enable or disable a provider */
  toggleEnabled: (id: string, enabled: boolean) =>
    trpcMutate('aiProvider.toggleProviderEnabled', { id, enabled }),
  /** Update provider config (API key, endpoint, fetchOnClient, etc.) */
  updateConfig: (id: string, value: {
    checkModel?: string;
    config?: { enableResponseApi?: boolean };
    fetchOnClient?: boolean | null;
    keyVaults?: Record<string, string | undefined>;
  }) =>
    trpcMutate('aiProvider.updateAiProviderConfig', { id, value }),
};

// ── File / Upload API ──────────────────────────────────────────────

export const fileApi = {
  list: (params?: {
    category?: string;
    limit?: number;
    offset?: number;
    q?: string;
  }) =>
    trpcQuery<FileListItem[]>('file.getFiles', {
      limit: 50,
      offset: 0,
      showFilesInKnowledgeBase: false,
      ...params,
    }),

  /**
   * Upload a file through the same signed-upload flow used by web.
   */
  upload: async (
    uri: string,
    name: string,
    type: string,
    options?: {
      agentId?: string;
      directory?: string;
      knowledgeBaseId?: string;
      onProgress?: (progress: number) => void;
      sessionId?: string;
      skipCheckFileType?: boolean;
      skipDeduplication?: boolean;
    },
  ): Promise<{ id: string; url: string }> => {
    const baseUrl = await getBaseUrl();
    const uploadUri = await ensureUploadableUri(uri, name);
    const fileInfo = await getLocalFileDescriptor(uploadUri);
    const fileType = type || 'application/octet-stream';
    const hash = fileInfo.hash;
    const metadata = buildUploadMetadata(name, options?.directory);
    const hashCheck = await trpcMutate<{
      isExist: boolean;
      metadata?: { path?: string };
      url?: string;
    }>('file.checkFileHash', { hash });

    let storagePath = hashCheck.metadata?.path || hashCheck.url;

    if (!hashCheck.isExist || !storagePath) {
      options?.onProgress?.(5);
      await uploadFileToSameOrigin(baseUrl, uploadUri, name, metadata.path, fileType, options?.onProgress);
      storagePath = metadata.path;
    }

    if (!storagePath) {
      throw new Error('upload path missing');
    }

    const created = await trpcMutate<{ id: string; url: string }>('file.createFile', {
      fileType,
      hash,
      knowledgeBaseId: options?.knowledgeBaseId,
      metadata,
      name,
      size: fileInfo.size,
      url: storagePath,
    });

    const resolvedUrl =
      created.url && !created.url.startsWith('http')
        ? `${baseUrl}/f/${created.id}`
        : created.url;

    options?.onProgress?.(100);

    return { id: created.id, url: resolvedUrl };
  },

  download: async (
    file: {
      id: string;
      name: string;
      url?: string;
    },
    options?: {
      onProgress?: (progress: number) => void;
    },
  ): Promise<{ localUri: string; remoteUrl: string }> => {
    const baseUrl = await getBaseUrl();
    await ensureDirectoryAsync(MOBILE_DOWNLOAD_DIR);

    const remoteUrl = resolveRemoteFileUrl(baseUrl, file.id, file.url);
    const localUri = `${MOBILE_DOWNLOAD_DIR}${Date.now()}-${sanitizeFilename(file.name || file.id)}`;
    const headers = await getAuthHeaders(baseUrl);

    const downloadTask = FileSystem.createDownloadResumable(
      remoteUrl,
      localUri,
      { headers },
      (progressData) => {
        const { totalBytesExpectedToWrite, totalBytesWritten } = progressData;
        if (!options?.onProgress || totalBytesExpectedToWrite <= 0) return;
        options.onProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
      },
    );

    const result = await downloadTask.downloadAsync();

    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error(`download failed: ${result?.status ?? 'unknown'}`);
    }

    options?.onProgress?.(100);

    return {
      localUri: result.uri,
      remoteUrl,
    };
  },

  remove: (id: string) => trpcMutate('file.removeFile', { id }),

  getFileContents: (fileIds: string[]) =>
    trpcMutate<Array<{ content: string; fileId: string; filename: string }>>(
      'chunk.getFileContents',
      { fileIds },
    ),
};

// ── Config / User API ───────────────────────────────────────────────
export const configApi = {
  getGlobalConfig: () => trpcQuery('config.getGlobalConfig'),
};

export const userApi = {
  getState: () => trpcQuery<MobileUserState>('user.getUserState'),
  getUser: () => trpcQuery<MobileUserState>('user.getUserState'),
  /**
   * Server has NO single `updateUser` procedure.
   * Must call separate procedures per field:
   *   - updateAvatar(string)
   *   - updateFullName(string)
   *   - updateUsername(string)
   *   - updateInterests(string[])
   */
  updateAvatar: (avatar: string) => trpcMutate('user.updateAvatar', avatar),
  /**
   * Upload avatar using base64 data URI (same as web version).
   * Server-side updateAvatar detects `data:image` prefix and handles S3 upload.
   */
  uploadAvatar: async (uri: string, mimeType = 'image/jpeg'): Promise<string> => {
    const avatarName = `avatar.${mimeType.split('/')[1] || 'jpg'}`;
    const uploaded = await fileApi.upload(uri, avatarName, mimeType);
    const dataUri = uploaded.url;
    await trpcMutate('user.updateAvatar', dataUri);
    return dataUri;
  },
  updateFullName: (fullName: string) => trpcMutate('user.updateFullName', fullName),
  updateUsername: (username: string) => trpcMutate('user.updateUsername', username),
  updateInterests: (interests: string[]) => trpcMutate('user.updateInterests', interests),
  updateSettings: (settings: Record<string, any>) => trpcMutate('user.updateSettings', settings),
  /** Convenience: update multiple profile fields in sequence */
  updateProfile: async (data: Partial<Pick<UserProfile, 'username' | 'avatar' | 'fullName'>>) => {
    const promises: Promise<unknown>[] = [];
    if (data.avatar !== undefined) promises.push(trpcMutate('user.updateAvatar', data.avatar));
    if (data.fullName !== undefined) promises.push(trpcMutate('user.updateFullName', data.fullName));
    if (data.username !== undefined) promises.push(trpcMutate('user.updateUsername', data.username));
    await Promise.all(promises);
  },
  requestPasswordReset: async (email: string) => {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/auth/forget-password`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ email, redirectTo: '/reset-password' }),
    });
    if (!res.ok) throw new Error(`Password reset request failed: ${res.status}`);
    return res.json();
  },
  changeEmail: async (newEmail: string) => {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/auth/change-email`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ newEmail, callbackURL: '/' }),
    });
    if (!res.ok) throw new Error(`Email change request failed: ${res.status}`);
    return res.json();
  },
};

// ── Plugin (Installed Plugins) API ──────────────────────────────────
export const pluginApi = {
  /** List all installed plugins */
  list: () => trpcQuery<InstalledPlugin[]>('plugin.getPlugins'),

  /** Install or update a plugin (create if not exists, else update manifest) */
  createOrInstall: (params: {
    customParams?: Record<string, any>;
    identifier: string;
    manifest?: Record<string, any>;
    settings?: Record<string, any>;
    type: 'plugin' | 'customPlugin';
  }) => trpcMutate<string | undefined>('plugin.createOrInstallPlugin', params),

  /** Create a new custom plugin */
  create: (params: {
    customParams?: Record<string, any>;
    identifier: string;
    manifest?: Record<string, any>;
    type: 'plugin' | 'customPlugin';
  }) => trpcMutate<string>('plugin.createPlugin', params),

  /** Remove a plugin */
  remove: (id: string) => trpcMutate('plugin.removePlugin', { id }),

  /** Remove all plugins */
  removeAll: () => trpcMutate('plugin.removeAllPlugins'),

  /** Update a plugin's customParams, manifest, or settings */
  update: (params: {
    customParams?: Record<string, any>;
    id: string;
    manifest?: Record<string, any>;
    settings?: Record<string, any>;
  }) => trpcMutate('plugin.updatePlugin', params),
};

// ── Agent Skills API ────────────────────────────────────────────────
export const agentSkillApi = {
  /** List all agent skills, optionally filtered by source */
  list: async (source?: 'builtin' | 'market' | 'user'): Promise<AgentSkillItem[]> => {
    const result = await trpcQuery<{ data: AgentSkillItem[]; total: number } | AgentSkillItem[]>(
      'agentSkills.list',
      source ? { source } : undefined,
    );
    if (Array.isArray(result)) return result;
    return result?.data ?? [];
  },

  /** Get agent skill by ID */
  getById: (id: string) => trpcQuery<AgentSkillItem>('agentSkills.getById', { id }),

  /** Create a new agent skill */
  create: (params: { content: string; description: string; identifier?: string; name: string }) =>
    trpcMutate<AgentSkillItem>('agentSkills.create', params),

  /** Delete an agent skill */
  delete: (id: string) => trpcMutate('agentSkills.delete', { id }),

  /** Update an agent skill */
  update: (params: { content?: string; id: string; manifest?: Record<string, any> }) =>
    trpcMutate('agentSkills.update', params),

  /** Import agent skill from GitHub URL */
  importFromGitHub: (gitUrl: string, branch?: string) =>
    trpcMutate<AgentSkillItem>('agentSkills.importFromGitHub', { branch, gitUrl }),

  /** Import agent skill from URL */
  importFromUrl: (url: string) =>
    trpcMutate<AgentSkillItem>('agentSkills.importFromUrl', { url }),

  /** Import agent skill from zip file (file must be uploaded first) */
  importFromZip: (zipFileId: string) =>
    trpcMutate<AgentSkillItem>('agentSkills.importFromZip', { zipFileId }),

  /** Import agent skill from marketplace */
  importFromMarket: (identifier: string) =>
    trpcMutate<AgentSkillItem>('agentSkills.importFromMarket', { identifier }),

  /** Search agent skills */
  search: (query: string) =>
    trpcQuery<AgentSkillItem[]>('agentSkills.search', { query }),
};

// ── MCP API ─────────────────────────────────────────────────────────
export const mcpApi = {
  getStreamableMcpServerManifest: (params: {
    auth?: { token?: string; type: 'none' | 'bearer' };
    headers?: Record<string, string>;
    identifier: string;
    metadata?: { avatar?: string; description?: string };
    url: string;
  }) => trpcQuery<any>('mcp.getStreamableMcpServerManifest', params),
};

// ── Market Skills API ───────────────────────────────────────────────
export interface MarketListItem {
  _source: 'builtin' | 'skill' | 'mcp' | 'legacy';
  author?: string;
  avatar?: string;
  category?: string;
  description?: string;
  identifier: string;
  manifest?: Record<string, any>;
  manifestUrl?: string;
  name?: string;
}

export interface MarketCategoryItem {
  category: string;
  count?: number;
  description?: string;
  name?: string;
}

export const marketSkillApi = {
  getMcpList: async (params?: {
    category?: string;
    page?: number;
    pageSize?: number;
    q?: string;
  }): Promise<{ items: MarketListItem[]; totalCount: number }> => {
    const input = {
      category: params?.category,
      locale: getCommunityMarketLocale(),
      page: params?.page ?? 1,
      pageSize: normalizeCommunityMarketPageSize(params?.pageSize),
      q: params?.q,
      sort: 'recommended' as const,
    };

    try {
      const mcpResult = await trpcQuery<any>('market.getMcpList', input);
      if (mcpResult?.items?.length > 0) {
        return {
          items: mcpResult.items.map((m: any) => ({
            ...m,
            _source: 'mcp' as const,
            avatar: m.meta?.avatar || m.avatar,
            description: m.meta?.description || m.description || '',
            identifier: m.identifier,
            manifestUrl: m.manifestUrl,
            name: m.meta?.title || m.name || m.title || m.identifier,
          })),
          totalCount: mcpResult.totalCount || mcpResult.items.length,
        };
      }
    } catch (error) {
      console.error('[marketSkillApi.getMcpList] failed:', error);
      throw error;
    }

    return { items: [], totalCount: 0 };
  },

  getSkillList: async (params?: {
    category?: string;
    page?: number;
    pageSize?: number;
    q?: string;
  }): Promise<{ items: MarketListItem[]; totalCount: number }> => {
    const input = {
      category: params?.category,
      locale: getCommunityMarketLocale(),
      page: params?.page ?? 1,
      pageSize: normalizeCommunityMarketPageSize(params?.pageSize),
      q: params?.q,
      sort: 'installCount',
    };

    try {
      const result = await trpcQuery<any>('market.skill.getSkillList', input);
      if (result?.items?.length > 0) {
        return {
          items: result.items.map((s: any) => ({
            ...s,
            _source: 'skill' as const,
            avatar: s.icon || s.logo || s.avatar,
          })),
          totalCount: result.totalCount || result.items.length,
        };
      }
    } catch (error) {
      console.error('[marketSkillApi.getSkillList] failed:', error);
      throw error;
    }

    return { items: [], totalCount: 0 };
  },

  getList: async (params?: {
    category?: string;
    page?: number;
    pageSize?: number;
    q?: string;
    source?: 'all' | 'mcp' | 'skill';
  }): Promise<{ items: MarketListItem[]; totalCount: number }> => {
    const source = params?.source ?? 'all';
    const baseParams = {
      category: params?.category,
      page: params?.page,
      pageSize: params?.pageSize,
      q: params?.q,
    };

    if (source === 'mcp') {
      return marketSkillApi.getMcpList(baseParams);
    }

    if (source === 'skill') {
      const skillResult = await marketSkillApi.getSkillList(baseParams);
      if (skillResult.items.length > 0) return skillResult;

      try {
        const legacyResult = await trpcQuery<any[]>('market.getLegacyPluginList', {});
        if (Array.isArray(legacyResult) && legacyResult.length > 0) {
          let items: MarketListItem[] = legacyResult.map((p: any) => ({
            _source: 'legacy' as const,
            author: p.author,
            avatar: p.meta?.avatar,
            description: p.meta?.description || '',
            identifier: p.identifier,
            manifest: typeof p.manifest === 'object' ? p.manifest : undefined,
            manifestUrl: typeof p.manifest === 'string' ? p.manifest : undefined,
            name: p.meta?.title || p.identifier,
          }));
          if (params?.q) {
            const q = params.q.toLowerCase();
            items = items.filter(
              (i) =>
                i.name?.toLowerCase().includes(q) ||
                i.identifier.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q),
            );
          }
          return { items, totalCount: items.length };
        }
      } catch { /* legacy unavailable */ }

      return { items: [], totalCount: 0 };
    }

    const [mcpResult, skillResult] = await Promise.all([
      marketSkillApi.getMcpList(baseParams),
      marketSkillApi.getSkillList(baseParams),
    ]);

    const items = [...mcpResult.items, ...skillResult.items];
    return { items, totalCount: items.length };
  },

  install: async (item: MarketListItem): Promise<void> => {
    if (item._source === 'skill') {
      await trpcMutate('agentSkills.importFromMarket', { identifier: item.identifier });
      return;
    }

    let manifest = item.manifest;
    // Fetch manifest if missing or empty (no api/tools entries)
    const hasTools = manifest && (
      (Array.isArray(manifest.api) && manifest.api.length > 0) ||
      (Array.isArray(manifest.tools) && manifest.tools.length > 0)
    );
    if (!hasTools && item.manifestUrl) {
      try {
        const res = await fetch(item.manifestUrl);
        if (res.ok) {
          manifest = await res.json();
        }
      } catch {
        /* use whatever manifest we have */
      }
    }

    const customParams: Record<string, any> = {};
    if (item.manifestUrl) customParams.manifestUrl = item.manifestUrl;

    await trpcMutate('plugin.createOrInstallPlugin', {
      customParams,
      identifier: item.identifier,
      manifest: manifest || {},
      type: 'plugin' as const,
      settings: {},
    });
  },

  getMcpDetail: (identifier: string) =>
    trpcQuery<any>('market.getMcpDetail', { identifier, locale: getCommunityMarketLocale() }),

  getDetail: (identifier: string) =>
    trpcQuery<any>('market.skill.getSkillDetail', {
      identifier,
      locale: getCommunityMarketLocale(),
    }),

  getCategories: () =>
    trpcQuery<MarketCategoryItem[]>('market.skill.getSkillCategories', {
      locale: getCommunityMarketLocale(),
    }),

  getMcpCategories: () =>
    trpcQuery<MarketCategoryItem[]>('market.getMcpCategories', {
      locale: getCommunityMarketLocale(),
    }),
};

export const lobehubSkillApi = {
  getAuthorizeUrl: async (provider: string, options?: { redirectUri?: string; scopes?: string[] }) =>
    trpcQuery<any>('tools.market.connectGetAuthorizeUrl', {
      provider,
      redirectUri: options?.redirectUri,
      scopes: options?.scopes,
    }),

  getConnections: async (): Promise<
    Array<{
      providerId: string;
      providerUsername?: string;
      scopes?: string[];
      tokenExpiresAt?: string;
    }>
  > => {
    const response = await trpcQuery<any>('tools.market.connectListConnections', {});
    return response?.connections || [];
  },

  getStatus: async (provider: string) =>
    trpcQuery<any>('tools.market.connectGetStatus', {
      provider,
    }),

  revoke: async (provider: string): Promise<void> => {
    await trpcMutate('tools.market.connectRevoke', { provider });
  },
};

// ── Stats API ─────────────────────────────────────────────────────
export const statsApi = {
  /** Count all messages (server-side, accurate) */
  countMessages: (params?: { endDate?: string; startDate?: string }) =>
    trpcQuery<number>('message.count', params),

  /** Count total words across all messages */
  countWords: (params?: { endDate?: string; startDate?: string }) =>
    trpcQuery<number>('message.countWords', params),

  /** Count all sessions */
  countSessions: (params?: { endDate?: string; startDate?: string }) =>
    trpcQuery<number>('session.countSessions', params),

  /** Count all topics */
  countTopics: (params?: { endDate?: string; startDate?: string }) =>
    trpcQuery<number>('topic.countTopics', params),

  /** Rank models by usage count */
  rankModels: () => trpcQuery<ModelRankItem[]>('message.rankModels'),

  /** Rank sessions (assistants) by message count */
  rankSessions: () => trpcQuery<SessionRankItem[]>('session.rankSessions'),

  /** Rank topics by message count */
  rankTopics: () => trpcQuery<TopicRankItem[]>('topic.rankTopics'),

  /** Get heatmap data for the past year */
  getHeatmaps: () => trpcQuery<HeatmapDay[]>('message.getHeatmaps'),

  /** Get user registration duration info */
  getRegistrationDuration: () =>
    trpcQuery<UserRegistrationDuration>('user.getUserRegistrationDuration'),
};

// ── Memory API ──────────────────────────────────────────────────────
export interface MemoryExtractionTaskMetadata {
  progress?: {
    completedTopics?: number;
    totalTopics?: number;
  };
  range?: {
    from?: string;
    to?: string;
  };
  source?: string;
}

export interface MemoryExtractionTask {
  error?: {
    body?: {
      detail?: string;
      message?: string;
    };
    message?: string;
    name?: string;
  } | null;
  id: string;
  metadata?: MemoryExtractionTaskMetadata;
  status: string;
}

export interface RequestMemoryExtractionParams {
  fromDate?: Date | string;
  toDate?: Date | string;
}

export interface MemoryCreateIdentityResult {
  identityId: string;
  userMemoryId: string;
}

export const memoryApi = {
  // ── Persona & Tags ──
  /** Get user persona (summary + content) */
  getPersona: () => trpcQuery<MemoryPersona>('userMemory.getPersona'),

  /** Get identity roles / tags for the tag cloud */
  queryIdentityRoles: (params?: { page?: number; size?: number }) =>
    trpcQuery<{ roles: Array<{ count: number; role: string }>; tags: Array<{ count: number; tag: string }> }>(
      'userMemories.queryIdentityRoles',
      params,
    ),

  /** Get memory tags */
  queryTags: (params?: { layer?: string; page?: number; pageSize?: number }) =>
    trpcQuery<{ items: Array<{ count: number; tag: string }>; total: number }>(
      'userMemories.queryTags',
      params,
    ),

  // ── Identity CRUD ──
  getIdentities: () => trpcQuery<MemoryIdentityItem[]>('userMemory.getIdentities'),
  queryIdentities: (params?: { page?: number; pageSize?: number; q?: string; types?: string[] }) =>
    trpcQuery<MemoryPagedResult<MemoryIdentityItem>>('userMemories.queryIdentities', params),
  deleteIdentity: (id: string) => trpcMutate('userMemory.deleteIdentity', { id }),
  updateIdentity: (id: string, data: Partial<MemoryIdentityItem>) =>
    trpcMutate('userMemory.updateIdentity', { data, id }),

  // ── Activity CRUD ──
  getActivities: () => trpcQuery<MemoryActivityItem[]>('userMemory.getActivities'),
  queryActivities: (params?: { page?: number; pageSize?: number; q?: string; sort?: string }) =>
    trpcQuery<MemoryPagedResult<MemoryActivityItem>>('userMemories.queryActivities', params),
  deleteActivity: (id: string) => trpcMutate('userMemory.deleteActivity', { id }),
  updateActivity: (id: string, data: { narrative?: string; notes?: string; status?: string }) =>
    trpcMutate('userMemory.updateActivity', { data, id }),

  // ── Context CRUD ──
  getContexts: () => trpcQuery<MemoryContextItem[]>('userMemory.getContexts'),
  deleteContext: (id: string) => trpcMutate('userMemory.deleteContext', { id }),
  updateContext: (id: string, data: { currentStatus?: string; description?: string; title?: string }) =>
    trpcMutate('userMemory.updateContext', { data, id }),

  // ── Experience CRUD ──
  getExperiences: () => trpcQuery<MemoryExperienceItem[]>('userMemory.getExperiences'),
  queryExperiences: (params?: { page?: number; pageSize?: number; q?: string; sort?: string }) =>
    trpcQuery<MemoryPagedResult<MemoryExperienceItem>>('userMemories.queryExperiences', params),
  deleteExperience: (id: string) => trpcMutate('userMemory.deleteExperience', { id }),
  updateExperience: (
    id: string,
    data: { action?: string; keyLearning?: string; reasoning?: string; situation?: string },
  ) => trpcMutate('userMemory.updateExperience', { data, id }),

  // ── Preference CRUD ──
  getPreferences: () => trpcQuery<MemoryPreferenceItem[]>('userMemory.getPreferences'),
  deletePreference: (id: string) => trpcMutate('userMemory.deletePreference', { id }),
  updatePreference: (
    id: string,
    data: { conclusionDirectives?: string; suggestions?: string },
  ) => trpcMutate('userMemory.updatePreference', { data, id }),

  // ── Memory Detail ──
  getMemoryDetail: (id: string, layer: string) =>
    trpcQuery<MemoryDetail | null>('userMemories.getMemoryDetail', { id, layer }),

  // ── Create Identity ──
  createIdentity: (data: { summary?: string; title: string }) =>
    trpcMutate<MemoryCreateIdentityResult>('userMemory.createIdentity', data),

  // ── Memory Extraction ──
  requestMemoryFromChatTopic: (params: RequestMemoryExtractionParams = {}) =>
    trpcMutate<
      MemoryExtractionTask & {
        deduped: boolean;
      }
    >('userMemory.requestMemoryFromChatTopic', params),

  getMemoryExtractionTask: (params?: { taskId?: string }) =>
    trpcQuery<MemoryExtractionTask | null>('userMemory.getMemoryExtractionTask', params),

  // ── Chat Memory Injection ──
  queryIdentitiesForInjection: () =>
    trpcQuery<Array<{ content: string; id: string; role: string; title: string }>>('userMemories.queryIdentitiesForInjection'),
};

// ── Artwork / Image Generation API ─────────────────────────────────
export const artworkApi = {
  // ── Topics ──
  createTopic: (type = 'image') =>
    trpcMutate<string>('generationTopic.createTopic', { type }),
  getTopics: (type = 'image') =>
    trpcQuery<GenerationTopic[]>('generationTopic.getAllGenerationTopics', { type }),
  deleteTopic: (id: string) =>
    trpcMutate('generationTopic.deleteTopic', { id }),
  updateTopic: (id: string, value: { title?: string | null; coverUrl?: string | null }) =>
    trpcMutate('generationTopic.updateTopic', { id, value }),

  // ── Batches ──
  getBatches: (topicId: string, type = 'image') =>
    trpcQuery<GenerationBatch[]>('generationBatch.getGenerationBatches', { topicId, type }),
  deleteBatch: (batchId: string) =>
    trpcMutate('generationBatch.deleteGenerationBatch', { batchId }),

  // ── Image Creation ──
  createImage: (params: {
    generationTopicId: string;
    imageNum: number;
    model: string;
    params: ImageGenerationParams;
    provider: string;
  }) => trpcMutate<{ data: { batch: GenerationBatch; generations: any[] }; success: boolean }>(
    'image.createImage', params,
  ),

  // ── Generation Status ──
  getGenerationStatus: (generationId: string, asyncTaskId: string) =>
    trpcQuery<{ error: any; generation: any; status: string }>(
      'generation.getGenerationStatus', { asyncTaskId, generationId },
    ),
  deleteGeneration: (generationId: string) =>
    trpcMutate('generation.deleteGeneration', { generationId }),
};

// ── Notebook API ────────────────────────────────────────────────────
export interface NotebookDocument {
  associatedAt?: string;
  content?: string | null;
  createdAt?: string;
  description?: string | null;
  fileType?: string | null;
  id: string;
  metadata?: Record<string, any> | null;
  title?: string | null;
  totalCharCount?: number | null;
  totalLineCount?: number | null;
  updatedAt?: string;
}

export const notebookApi = {
  list: (topicId: string) =>
    trpcQuery<{ data: NotebookDocument[]; total: number }>('notebook.listDocuments', { topicId }),

  get: (id: string) => trpcQuery<NotebookDocument>('notebook.getDocument', { id }),

  create: (params: {
    content: string;
    description: string;
    title: string;
    topicId: string;
    type?: string;
  }) => trpcMutate<NotebookDocument>('notebook.createDocument', {
    ...params,
    type: params.type || 'markdown',
  }),

  update: (params: {
    append?: boolean;
    content?: string;
    description?: string;
    id: string;
    title?: string;
  }) => trpcMutate<NotebookDocument>('notebook.updateDocument', params),

  remove: (id: string) => trpcMutate('notebook.deleteDocument', { id }),
};

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

import { createSSEChunkParser } from '@lobechat/fetch-sse/sseParser';
import * as FileSystem from 'expo-file-system/legacy';
import { sha256 } from 'js-sha256';

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
  KnowledgeBaseItem,
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
  MobileSSOProvider,
  MobileUserState,
  ModelRankItem,
  RecentTopic,
  SessionRankItem,
  Tag,
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
import {
  isChatToolPayloadArray,
  mergeToolCallChunks,
  type MobileToolCallChunk,
  transformToolCalls,
} from './toolCallUtils';

export { clearStoredAuthSession as clearAuth, getApiUrl, hasConfiguredUrl, setApiUrl, testConnection };

const MOBILE_UPLOAD_CACHE_DIR = `${FileSystem.cacheDirectory || ''}upload-cache/`;
const MOBILE_DOWNLOAD_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}downloads/`;
const COMMUNITY_MARKET_DEFAULT_PAGE_SIZE = 21;
const COMMUNITY_MARKET_CACHE_TTL_MS = 5 * 60 * 1000;
const COMMUNITY_MARKET_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const COMMUNITY_MARKET_MAX_RETRIES = 2;
const COMMUNITY_MARKET_RETRY_DELAY_MS = 600;
const COMMUNITY_MARKET_FALLBACK_LOCALE = 'en-US';

const getCommunityMarketLocale = () => useI18n.getState().locale || COMMUNITY_MARKET_FALLBACK_LOCALE;

const normalizeCommunityMarketPageSize = (pageSize?: number) => {
  if (!pageSize || Number.isNaN(pageSize) || pageSize <= 0) {
    return COMMUNITY_MARKET_DEFAULT_PAGE_SIZE;
  }

  return pageSize;
};

interface CommunityMarketCacheEntry<T> {
  data: T;
  fetchedAt: number;
}

interface CommunityMarketRequestOptions {
  forceRefresh?: boolean;
}

interface CommunityMarketListResult {
  currentPage: number;
  items: MarketListItem[];
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

const communityMarketCache = new Map<string, CommunityMarketCacheEntry<unknown>>();
const communityMarketInflight = new Map<string, Promise<unknown>>();

const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildCommunityMarketCacheKey = (
  baseUrl: string,
  scope: string,
  params?: Record<string, unknown>,
) => {
  const normalizedParams = params
    ? JSON.stringify(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, value]) => value !== undefined && value !== null && value !== '')
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    )
    : '';

  return `${baseUrl}::${scope}::${normalizedParams}`;
};

const readCommunityMarketCache = <T>(key: string): CommunityMarketCacheEntry<T> | null => {
  const entry = communityMarketCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt > COMMUNITY_MARKET_STALE_TTL_MS) {
    communityMarketCache.delete(key);
    return null;
  }

  return entry as CommunityMarketCacheEntry<T>;
};

const writeCommunityMarketCache = <T>(key: string, data: T) => {
  communityMarketCache.set(key, {
    data,
    fetchedAt: Date.now(),
  });
};

const isRetryableCommunityMarketError = (error: unknown) => {
  const status =
    typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: number }).status)
      : undefined;

  if (!status || Number.isNaN(status)) return true;

  return status === 408 || status === 425 || status === 429 || status >= 500;
};

const fetchCommunityMarketWithRetry = async <T>(fetcher: () => Promise<T>): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= COMMUNITY_MARKET_MAX_RETRIES; attempt += 1) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;

      if (
        attempt === COMMUNITY_MARKET_MAX_RETRIES ||
        !isRetryableCommunityMarketError(error)
      ) {
        throw error;
      }

      await waitFor(COMMUNITY_MARKET_RETRY_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Community market request failed');
};

const shouldFallbackCommunityMarketLocale = (locale: string, error: unknown) => {
  if (!locale || locale === COMMUNITY_MARKET_FALLBACK_LOCALE) return false;

  const status =
    typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: number }).status)
      : undefined;

  return Boolean(status && !Number.isNaN(status) && status >= 500);
};

const requestCommunityMarket = async <T>(params: {
  fetcher: () => Promise<T>;
  options?: CommunityMarketRequestOptions;
  scope: string;
  values?: Record<string, unknown>;
}): Promise<T> => {
  const baseUrl = await getBaseUrl();
  const key = buildCommunityMarketCacheKey(baseUrl, params.scope, params.values);
  const cached = readCommunityMarketCache<T>(key);
  const age = cached ? Date.now() - cached.fetchedAt : Number.POSITIVE_INFINITY;

  if (!params.options?.forceRefresh && cached && age < COMMUNITY_MARKET_CACHE_TTL_MS) {
    return cached.data;
  }

  const inflight = communityMarketInflight.get(key) as Promise<T> | undefined;
  if (inflight) return inflight;

  const next = (async () => {
    try {
      const data = await fetchCommunityMarketWithRetry(params.fetcher);
      writeCommunityMarketCache(key, data);
      return data;
    } catch (error) {
      if (cached) return cached.data;
      throw error;
    } finally {
      communityMarketInflight.delete(key);
    }
  })();

  communityMarketInflight.set(key, next);

  return next;
};

const toIsoString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
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

const SHA256_CHUNK_BYTES = 4 * 1024 * 1024;

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = globalThis.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const getLocalFileSize = async (uri: string): Promise<number> => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('local file not found');
  }
  return info.size ?? 0;
};

/** SHA-256 (hex), chunked reads to limit peak memory. */
const computeSha256HexFromFileUri = async (uri: string, size: number): Promise<string> => {
  const hash = sha256.create();
  if (size === 0) {
    hash.update(new Uint8Array(0));
    return hash.hex();
  }
  for (let offset = 0; offset < size; offset += SHA256_CHUNK_BYTES) {
    const length = Math.min(SHA256_CHUNK_BYTES, size - offset);
    const segment = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length,
      position: offset,
    });
    hash.update(base64ToUint8Array(segment));
  }
  return hash.hex();
};

const fileMetadataFromStorageKey = (storageKey: string, displayFileName: string) => {
  const parts = storageKey.split('/');
  const filenameFromKey = parts.at(-1) ?? '';
  const dirname = parts.length > 1 ? parts.slice(0, -1).join('/') : '';

  return {
    date: (Date.now() / 1000 / 60 / 60).toFixed(0),
    dirname,
    filename: displayFileName || filenameFromKey,
    path: storageKey,
  };
};

const putLocalFileToPresignedUrl = async (
  presignedUrl: string,
  fileUri: string,
  fileType: string,
  onProgress?: (progress: number) => void,
): Promise<void> => {
  const uploadTask = FileSystem.createUploadTask(
    presignedUrl,
    fileUri,
    {
      headers: {
        'Content-Type': fileType,
      },
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
    (progressData) => {
      const { totalBytesExpectedToSend, totalBytesSent } = progressData;
      if (!onProgress || totalBytesExpectedToSend <= 0) return;
      onProgress(Math.min(99, Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)));
    },
  );
  const response = await uploadTask.uploadAsync();
  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(`presigned upload failed: ${response?.status ?? 'unknown'}`);
  }
};

/** Same-origin multipart fallback when PUT to the presigned URL is not viable. */
const uploadLocalFileViaUploadSession = async (
  baseUrl: string,
  fileUri: string,
  name: string,
  fileType: string,
  uploadSessionId: string,
  onProgress?: (progress: number) => void,
): Promise<void> => {
  const uploadTask = FileSystem.createUploadTask(
    new URL('/api/file/upload-session', `${baseUrl}/`).toString(),
    fileUri,
    {
      fieldName: 'file',
      headers: await getAuthHeaders(baseUrl),
      httpMethod: 'POST',
      mimeType: fileType,
      parameters: { uploadSessionId },
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
    throw new Error('upload-session failed: empty response');
  }
  if (response.status < 200 || response.status >= 300) {
    let payload: { error?: string } | null;
    try {
      payload = response.body ? JSON.parse(response.body) : null;
    } catch {
      payload = null;
    }
    throw new Error(payload?.error || `upload-session failed: ${response.status}`);
  }
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

const normalizeMessage = (message: any, parentSessionId?: string): ChatMessage => {
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

  const sessionId = String(message?.sessionId ?? parentSessionId ?? '');
  const tasks = Array.isArray(message?.tasks)
    ? (message.tasks as any[]).map((t) => normalizeMessage(t, sessionId))
    : undefined;
  const children = Array.isArray(message?.children)
    ? (message.children as any[]).map((child) => normalizeMessage(child, sessionId))
    : undefined;
  const compressedMessages = Array.isArray(message?.compressedMessages)
    ? (message.compressedMessages as any[]).map((child) => normalizeMessage(child, sessionId))
    : Array.isArray(message?.compressed_messages)
      ? (message.compressed_messages as any[]).map((child) => normalizeMessage(child, sessionId))
      : undefined;

  return {
    agentId: message?.agentId ?? message?.agent_id ?? undefined,
    ...(children?.length ? { children } : {}),
    ...(compressedMessages?.length ? { compressedMessages } : {}),
    ...(tasks?.length ? { tasks } : {}),
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
    sessionId,
    toolCallId: message?.tool_call_id ?? undefined,
    tools: (message?.tools as ChatToolPayload[] | null | undefined) ?? null,
    taskDetail: message?.taskDetail ?? message?.task_detail ?? undefined,
    traceId: message?.traceId ?? message?.trace_id ?? undefined,
    updatedAt: toIsoString(message?.updatedAt),
    usage: message?.usage ?? message?.metadata?.usage ?? null,
  };
};

const normalizeMessages = (
  messages: any[] | undefined | null,
  parentSessionId?: string,
): ChatMessage[] =>
  Array.isArray(messages)
    ? messages.map((message) => normalizeMessage(message, parentSessionId))
    : [];

export interface MobileMessageToolCall {
  function: {
    arguments: string;
    name: string;
  };
  id: string;
  thoughtSignature?: string;
  type: string;
}

const readNextXHRResponseChunk = (responseText: string, processedLength: number) => ({
  chunk: responseText.slice(processedLength),
  processedLength: responseText.length,
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

/** Parse tRPC `message` from a failed mobile fetch (see `createTrpcHttpError`). */
export function getTrpcErrorMessageFromClientError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const body = (error as { body?: string }).body;
  if (typeof body !== 'string') return undefined;
  try {
    const payload = JSON.parse(body);
    const first = Array.isArray(payload) ? payload[0] : payload;
    return (
      first?.error?.json?.message ??
      first?.error?.message ??
      extractTrpcErrorMessage(payload) ??
      undefined
    );
  } catch {
    return undefined;
  }
}

export function isSharePasswordRequiredError(error: unknown): boolean {
  return getTrpcErrorMessageFromClientError(error) === 'SHARE_PASSWORD_REQUIRED';
}

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

const pickFirstNonEmptyString = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return '';
};

/** 占位会话标题（用于 resolveDisplaySessionTitle 判断）。 */
const DEFAULT_SESSION_TITLES = new Set([
  '',
  'New Chat',
  'New Conversation',
  'New conversation',
  'New Session',
  '新对话',
  '新對話',
  '新会话',
  'Untitled',
]);

const isDefaultSessionTitle = (value?: string | null) =>
  DEFAULT_SESSION_TITLES.has((value ?? '').trim());

const resolveDisplaySessionTitle = (
  metaTitle?: string | null,
  configTitle?: string | null,
  sessionTitle?: string | null,
) => {
  const normalizedMetaTitle = pickFirstNonEmptyString(metaTitle);
  const normalizedConfigTitle = pickFirstNonEmptyString(configTitle);
  const normalizedSessionTitle = pickFirstNonEmptyString(sessionTitle);

  if (normalizedConfigTitle && isDefaultSessionTitle(normalizedMetaTitle)) {
    return normalizedConfigTitle;
  }

  if (
    normalizedSessionTitle &&
    isDefaultSessionTitle(normalizedMetaTitle) &&
    isDefaultSessionTitle(normalizedConfigTitle)
  ) {
    return normalizedSessionTitle;
  }

  return pickFirstNonEmptyString(
    normalizedMetaTitle,
    normalizedConfigTitle,
    normalizedSessionTitle,
  );
};

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
  create: (config?: Record<string, unknown>) =>
    trpcMutate<{ agentId: string; sessionId: string }>('agent.createAgent', {
      config,
    }),

  queryAgents: (params?: { keyword?: string; limit?: number; offset?: number }) =>
    trpcQuery<AgentQueryItem[]>('agent.queryAgents', params),

  /** Get agent config by session ID. Returns the agent config including plugins. */
  getConfigBySession: (sessionId: string) =>
    trpcQuery<{ id: string; plugins?: string[];[key: string]: any } | null>(
      'agent.getAgentConfig',
      { sessionId },
    ),

  /** Get agent config by agent ID (for editing without session). */
  getConfigByAgentId: (agentId: string) =>
    trpcQuery<{ id: string; plugins?: string[];[key: string]: any } | null>(
      'agent.getAgentConfigById',
      { agentId },
    ),

  /** Remove an agent and its associated session. */
  removeAgent: (agentId: string) => trpcMutate('agent.removeAgent', { agentId }),

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
      title: resolveDisplaySessionTitle(s.meta?.title, s.config?.title, s.title),
      description:
        pickFirstNonEmptyString(
          pickFirstNonEmptyString(s.meta?.description, s.config?.description),
          s.description,
        ) || undefined,
      avatar: pickFirstNonEmptyString(s.meta?.avatar, s.config?.avatar, s.avatar) || undefined,
      chatConfig: s.config?.chatConfig ?? s.chatConfig,
      model: s.model || s.config?.model || undefined,
      provider: s.config?.provider || undefined,
      type: s.type ?? 'agent',
    }));
  },
  /**
   * Create a new session (simple chat).
   * Always creates an Agent-bound session (no session-only virtual session).
   * Pass a stable `slug` (e.g. personal notebook) to dedupe and hide from the session list client-side.
   */
  create: (config?: CreateSessionConfig) =>
    trpcMutate<string>('session.createSession', {
      config: {
        avatar: config?.avatar,
        description: config?.description,
        model: config?.model,
        plugins: config?.plugins,
        provider: config?.provider,
        systemRole: config?.systemPrompt,
        title: config?.title || 'New Session',
      },
      session: {},
      slug: config?.slug,
      type: 'agent' as const,
    }),
  remove: (id: string) => trpcMutate('session.removeSession', { id }),
  removeChatGroup: (id: string) => trpcMutate('agentGroup.deleteGroup', { id }),
  pin: (id: string) =>
    trpcMutate('session.updateSession', { id, value: { pinned: true } }),
  unpin: (id: string) =>
    trpcMutate('session.updateSession', { id, value: { pinned: false } }),
  duplicate: (id: string, title = 'Duplicated') =>
    trpcMutate<string | undefined>('session.cloneSession', { id, newTitle: title }),
  rename: (id: string, title: string) =>
    trpcMutate('session.updateSession', { id, value: { title } }),
  search: async (keywords: string): Promise<ChatSession[]> => {
    const result = await trpcQuery<any[]>('session.searchSessions', { keywords });

    return (result ?? []).map((s) => ({
      ...s,
      agentId: s.config?.id ?? undefined,
      slug: s.slug ?? undefined,
      title: resolveDisplaySessionTitle(s.meta?.title, s.config?.title, s.title),
      description:
        pickFirstNonEmptyString(
          pickFirstNonEmptyString(s.meta?.description, s.config?.description),
          s.description,
        ) || undefined,
      avatar: pickFirstNonEmptyString(s.meta?.avatar, s.config?.avatar, s.avatar) || undefined,
      chatConfig: s.config?.chatConfig ?? s.chatConfig,
      model: s.model || s.config?.model || undefined,
      provider: s.config?.provider || undefined,
      type: s.type ?? 'agent',
    }));
  },
  updateChatConfig: (id: string, config: Record<string, unknown>) =>
    trpcMutate('session.updateSessionChatConfig', { id, value: config }),

  /** Update session-level agent config (for session-only chats with no linked agent). */
  updateSessionConfig: (id: string, config: Record<string, unknown>) =>
    trpcMutate('session.updateSessionConfig', { id, value: config }),
  generateTitle: (sessionId: string) =>
    trpcMutate<string | null>('session.generateSessionTitle', { sessionId }),
};

// ── Agent Group API (multi-agent chat) ───────────────────────────────
export interface AgentGroupDetail {
  [key: string]: any;
  agents?: Array<{ id: string; title?: string;[key: string]: any }>;
  config?: Record<string, any>;
  id: string;
  meta?: { avatar?: string; description?: string; title?: string };
  supervisorAgentId?: string;
}

export const agentGroupApi = {
  createGroup: (config?: {
    config?: Record<string, any>;
    supervisorConfig?: { model?: string; provider?: string };
    title?: string;
  }) =>
    trpcMutate<{ group: { id: string }; supervisorAgentId: string }>('agentGroup.createGroup', {
      config: config?.config,
      supervisorConfig: config?.supervisorConfig,
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
const isValidChatFileId = (fileId?: string | null): fileId is string =>
  typeof fileId === 'string' && fileId.trim().length > 0 && !fileId.startsWith('docs_');

const hasInvalidChatFileIds = (fileIds?: string[]) =>
  !!fileIds?.some((fileId) => !isValidChatFileId(fileId));

export const aiAgentApi = {
  execGroupAgent: (params: {
    agentId: string;
    files?: string[];
    groupId: string;
    message: string;
    targetId?: string;
    topicId?: string;
  }) =>
    trpcMutate<{
      assistantMessageId?: string;
      error?: string;
      isCreateNewTopic?: boolean;
      messages?: any[];
      operationId?: string;
      success?: boolean;
      topicId?: string;
      topics?: { items: any[]; total: number };
      userMessageId?: string;
    }>('aiAgent.execGroupAgent', (() => {
      if (hasInvalidChatFileIds(params.files)) {
        throw new Error('Invalid file IDs for group chat. document IDs (docs_*) are not allowed.');
      }

      return params;
    })()).then((result) => ({
      ...result,
      messages: normalizeMessages(result.messages),
    })),
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
      latestAssistant?: {
        content?: string;
        reasoning?: string;
        toolCalls?: Array<{
          function?: {
            arguments?: string;
            name?: string;
          };
          id?: string;
          type?: string;
        }>;
      };
      isCompleted?: boolean;
      operationId: string;
    } | null>('aiAgent.getOperationStatus', params),
  /** Fetch group messages via aiChat.getMessagesAndTopics (same as execGroupAgent) */
  getGroupMessages: (params: {
    agentId?: string;
    groupId: string;
    topicId?: string;
  }) =>
    trpcQuery<{ messages: any[] }>('aiChat.getMessagesAndTopics', params).then((r) =>
      (r?.messages ?? []).map((message) => normalizeMessage(message)),
    ),
  /** Create Thread for client-side task execution in Group mode (task delegation) */
  createClientGroupAgentTaskThread: (params: {
    groupId: string;
    instruction: string;
    parentMessageId: string;
    subAgentId: string;
    title?: string;
    topicId: string;
  }) =>
    trpcMutate<{
      messages?: any[];
      success: boolean;
      threadId?: string;
      threadMessages?: any[];
      userMessageId?: string;
    }>('aiAgent.createClientGroupAgentTaskThread', params).then((result) => ({
      ...result,
      messages: result.messages ? normalizeMessages(result.messages) : undefined,
      threadMessages: result.threadMessages
        ? normalizeMessages(result.threadMessages)
        : undefined,
    })),
  /** Update Thread status after client-side task execution completes */
  updateClientTaskThreadStatus: (params: {
    completionReason: 'done' | 'error' | 'interrupted';
    error?: string;
    metadata?: {
      totalCost?: number;
      totalMessages?: number;
      totalSteps?: number;
      totalTokens?: number;
      totalToolCalls?: number;
    };
    resultContent?: string;
    threadId: string;
  }) => trpcMutate('aiAgent.updateClientTaskThreadStatus', params),
};

// ── Chat Tool (approve/reject) API ───────────────────────────────────
export const chatToolApi = {
  approveToolCall: (params: {
    assistantGroupId?: string;
    sessionId: string;
    topicId?: string;
    toolMessageId: string;
  }) => trpcMutate('aiChat.approveToolCall', params),
  rejectToolCall: (params: {
    reason?: string;
    sessionId: string;
    topicId?: string;
    toolMessageId: string;
  }) => trpcMutate('aiChat.rejectToolCall', params),
};

// ── Message API ─────────────────────────────────────────────────────
export interface CreateMessageParams {
  content: string;
  files?: string[];
  groupId?: string;
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
  sessionId?: string | null;
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

const normalizeCreateMessageParams = (params: CreateMessageParams): CreateMessageParams => {
  if (hasInvalidChatFileIds(params.files)) {
    throw new Error('Invalid file IDs in message.createMessage. document IDs (docs_*) are not allowed.');
  }

  if (!params.groupId && typeof params.sessionId === 'string' && params.sessionId.startsWith('cg_')) {
    throw new Error('Group message must use groupId. sessionId=cg_* is not supported.');
  }

  return params;
};

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
      (messages ?? []).map((message) => normalizeMessage(message)),
    );
  },

  create: (params: CreateMessageParams) =>
    trpcMutate<{ id: string; messages: any[] }>(
      'message.createMessage',
      normalizeCreateMessageParams(params),
    ).then((result) => ({
      id: result.id,
      messages: (result.messages ?? []).map((message) => normalizeMessage(message)),
    })),

  remove: (id: string) => trpcMutate('message.removeMessage', { id }),
  /** Remove all messages in a topic (agent session). Aligns with Web clearMessage. */
  removeMessagesByAssistant: (sessionId: string, topicId?: string | null) =>
    trpcMutate('message.removeMessagesByAssistant', { agentId: sessionId, topicId: topicId ?? undefined }),
  /** Remove all messages in a topic (group session). Aligns with Web clearMessage. */
  removeMessagesByGroup: (groupId: string, topicId?: string | null) =>
    trpcMutate('message.removeMessagesByGroup', { groupId, topicId: topicId ?? undefined }),
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

export interface ToolInterventionPayload {
  rejectedReason?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'aborted' | 'none';
}

export interface ToolExecutionItem {
  apiName: string;
  arguments: string;
  id: string;
  identifier: string;
  intervention?: ToolInterventionPayload;
  pluginError?: { message: string };
  result: string;
  state?: Record<string, unknown>;
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

const stripTrailingTransportStopToken = (value: string) => {
  const trimmedEnd = value.trimEnd();

  if (trimmedEnd.toLowerCase() === 'stop') {
    return '';
  }

  const normalized = trimmedEnd.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  const lastLine = lines.at(-1)?.trim().toLowerCase();

  if (lastLine !== 'stop') return value;

  lines.pop();
  return lines.join('\n');
};

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

const getStreamErrorMessage = (payload: unknown) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== 'object') {
    return 'Unknown streaming error';
  }

  const errorPayload = payload as Record<string, any>;
  const providerHint =
    typeof errorPayload?.body?.provider === 'string' ? `[${errorPayload.body.provider}] ` : '';

  const message =
    errorPayload?.body?.error?.message ||
    errorPayload?.body?.message ||
    errorPayload?.body?.error?.errorMessage ||
    errorPayload?.message ||
    errorPayload?.error?.message ||
    errorPayload?.errorType;

  return typeof message === 'string' && message.trim()
    ? `${providerHint}${message}`.trim()
    : `${providerHint}Unknown streaming error`.trim();
};

const normalizeHeaderRecord = (value: unknown) => {
  if (!value || typeof value !== 'object') return undefined;

  const entries = Object.entries(value).filter(([key, headerValue]) => {
    return typeof key === 'string' && key.length > 0 && headerValue != null;
  });

  if (entries.length === 0) return undefined;

  return entries.reduce<Record<string, string>>((acc, [key, headerValue]) => {
    acc[key] = typeof headerValue === 'string' ? headerValue : String(headerValue);
    return acc;
  }, {});
};

const buildMarketCloudMcpManifest = (item: Record<string, any>) => {
  const tools = Array.isArray(item.tools) ? item.tools : undefined;
  const api =
    Array.isArray(item.api) && item.api.length > 0
      ? item.api
      : tools?.map((tool) => ({
        description: tool?.description || '',
        name: tool?.name,
        parameters: tool?.inputSchema || {},
      }));

  return {
    api: Array.isArray(api) ? api : [],
    author: item.author?.name || item.author || '',
    createAt: item.createdAt || new Date().toISOString(),
    homepage: item.homepage || '',
    identifier: item.identifier,
    manifest: item.manifestUrl || '',
    meta: {
      avatar: item.icon || item.avatar,
      description: item.description,
      tags: Array.isArray(item.tags) ? item.tags : [],
      title: item.name || item.identifier,
    },
    name: item.name || item.identifier,
    type: 'mcp',
    version: item.version,
  };
};

const resolveMarketMcpConnection = (item: Record<string, any>) => {
  const deploymentOptions = Array.isArray(item.deploymentOptions) ? item.deploymentOptions : [];

  const httpOption =
    deploymentOptions.find(
      (option) => option?.connection?.url && option?.connection?.type === 'http',
    ) ||
    deploymentOptions.find((option) => option?.connection?.url && !option?.connection?.type);

  if (httpOption?.connection?.url) {
    const headers = normalizeHeaderRecord(httpOption.connection?.headers);

    return {
      ...(httpOption.connection?.auth ? { auth: httpOption.connection.auth } : {}),
      ...(headers ? { headers } : {}),
      type: 'http' as const,
      url: httpOption.connection.url,
    };
  }

  const stdioOption = deploymentOptions.find(
    (option) =>
      option?.connection?.type === 'stdio' ||
      (!option?.connection?.type && !option?.connection?.url),
  );

  if (!stdioOption || !item.haveCloudEndpoint) return undefined;

  const headers = normalizeHeaderRecord(stdioOption.connection?.headers);

  return {
    ...(stdioOption.connection?.auth ? { auth: stdioOption.connection.auth } : {}),
    ...(headers ? { headers } : {}),
    cloudEndPoint: item.haveCloudEndpoint,
    type: 'cloud' as const,
  };
};

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
        let didSettle = false;
        let allMessages = [...messages];

        if (shouldForceInlineImages(provider)) {
          allMessages = sanitizeMessagesForProvider(allMessages);
          console.info(`[aiChatApi] sanitized provider=${provider} msgCount=${allMessages.length}`);
        }

        logFinalLastUserMessage(provider, allMessages);

        if (options?.systemPrompt && !options?.sessionId) {
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
        const parseSSE = createSSEChunkParser();

        const rejectOnce = (error: Error) => {
          if (didSettle) return;
          didSettle = true;
          reject(error);
        };

        const resolveOnce = (result: StreamResult) => {
          if (didSettle) return;
          didSettle = true;
          resolve(result);
        };

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
          const normalizedText = stripTrailingTransportStopToken(accText);

          contentMetadata = hasContentImages
            ? {
              isMultimodal: true,
              tempDisplayContent: serializeContentParts(contentParts),
            }
            : undefined;

          callbacks.onContent?.({
            content: normalizedText,
            ...contentMetadata,
          });
        };

        const processNewData = (newData: string, options?: { flush?: boolean }) => {
          const parsedChunks = parseSSE(newData, options);

          for (const chunk of parsedChunks) {
            switch (chunk.event) {
              case 'error': {
                rejectOnce(new Error(`AI chat failed: ${getStreamErrorMessage(chunk.data)}`));
                return;
              }
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
                if (isChatToolPayloadArray(payload)) {
                  accTools = payload;
                  rawToolCalls = [];
                } else {
                  rawToolCalls = mergeToolCallChunks(rawToolCalls, payload as MobileToolCallChunk[]);
                  accTools = transformToolCalls(rawToolCalls);
                }
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
              case 'intervention_required': {
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
              case 'stop': {
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
            rejectOnce(new Error(msg));
            return;
          }
          if (didSettle) return;

          const remaining = xhr.responseText.slice(processedLength);
          processNewData(remaining, { flush: true });
          if (didSettle) return;

          const finalText = stripTrailingTransportStopToken(accText);
          resolveOnce({
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
            text: finalText,
            toolExecutions: accToolExecutions,
            tools: accTools,
            usage: lastUsage,
          });
        };

        xhr.onerror = () => {
          if (didSettle) return;
          const info = `status=${xhr.status} readyState=${xhr.readyState}`;
          console.error(`[aiChatApi] XHR onerror: ${info}`);
          rejectOnce(new Error(`Network error (${info})`));
        };
        xhr.onabort = () => {
          if (didSettle) return;
          rejectOnce(new Error(signal?.aborted ? 'Request aborted' : 'Network request aborted'));
        };
        xhr.ontimeout = () => rejectOnce(new Error(`AI chat timed out (${xhr.timeout}ms)`));

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

  /**
   * Continue after approve (execute tool) or reject-and-continue (inject user rejection, resume loop).
   * POSTs to /webapi/chat/:provider/continue.
   */
  continueToolIntervention: (
    provider: string,
    params:
      | { approvedToolCall: ChatToolPayload; sessionId: string; topicId?: string }
      | { rejectedToolCall: { id: string; reason?: string }; sessionId: string; topicId?: string },
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<StreamResult> => {
    return (async () => {
      const [base, headers] = await Promise.all([getBaseUrl(), getHeaders()]);
      if (!headers['X-lobe-chat-auth'] && !headers['Oidc-Auth']) {
        throw new Error('Auth session expired — please sign in again');
      }

      const url = `${base}/webapi/chat/${provider}/continue`;

      return new Promise<StreamResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.responseType = 'text';
        xhr.timeout = 120_000;

        for (const [key, value] of Object.entries(headers)) {
          xhr.setRequestHeader(key, value);
        }
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('X-Avato-Mobile-Client', '1');

        let accText = '';
        let accTools: ChatToolPayload[] | undefined;
        let accToolExecutions: ToolExecutionItem[] | undefined;
        let processedLength = 0;
        const parseSSE = createSSEChunkParser();

        const handleParsedChunk = (parsed: ReturnType<typeof parseSSE>) => {
          for (const p of parsed) {
            if (p.event === 'tool_calls' && Array.isArray(p.data)) {
              accTools = p.data as ChatToolPayload[];
              callbacks.onTools?.(accTools);
            } else if (p.event === 'tool_executions' && Array.isArray(p.data)) {
              accToolExecutions = p.data as ToolExecutionItem[];
              callbacks.onToolExecutions?.(accToolExecutions);
            } else if (p.event === 'text' && typeof p.data === 'string') {
              accText += p.data;
              callbacks.onContent?.({ content: accText });
            } else if (p.event === 'error' && p.data) {
              reject(new Error(`Continue failed: ${JSON.stringify(p.data)}`));
            }
          }
        };

        xhr.onprogress = () => {
          const next = readNextXHRResponseChunk(xhr.responseText, processedLength);
          processedLength = next.processedLength;
          const chunk = next.chunk;
          if (!chunk) return;
          handleParsedChunk(parseSSE(chunk));
        };

        xhr.onload = () => {
          if (xhr.status >= 400) {
            reject(new Error(`Continue failed: ${xhr.status}`));
            return;
          }
          const next = readNextXHRResponseChunk(xhr.responseText, processedLength);
          processedLength = next.processedLength;
          const chunk = next.chunk;
          if (chunk) {
            handleParsedChunk(parseSSE(chunk, { flush: true }));
          }
          resolve({
            text: accText,
            tools: accTools,
            toolExecutions: accToolExecutions,
          });
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Continue timed out'));
        if (signal) signal.addEventListener('abort', () => xhr.abort());

        const body =
          'approvedToolCall' in params
            ? {
              approvedToolCall: params.approvedToolCall,
              sessionId: params.sessionId,
              topicId: params.topicId,
            }
            : {
              rejectedToolCall: params.rejectedToolCall,
              sessionId: params.sessionId,
              topicId: params.topicId,
            };

        xhr.send(JSON.stringify(body));
      });
    })();
  },
};

// ── Topic API ───────────────────────────────────────────────────────
export const topicApi = {
  list: (containerId: string, options?: { sessionType?: 'agent' | 'group'; tagId?: string }) => {
    const params =
      options?.sessionType === 'group'
        ? { groupId: containerId, tagId: options?.tagId }
        : { sessionId: containerId, tagId: options?.tagId };
    return trpcQuery<{ items: Topic[]; total: number } | Topic[]>(
      'topic.getTopics',
      params,
    ).then((res) => (Array.isArray(res) ? res : res?.items ?? []));
  },
  /** Returns topic ID string, not full Topic object. */
  create: (
    containerId: string,
    title: string,
    options?: { messageIds?: string[]; sessionType?: 'agent' | 'group'; tagId?: string | null },
  ) => {
    const params =
      options?.sessionType === 'group'
        ? { groupId: containerId, messages: options?.messageIds, tagId: options?.tagId, title }
        : {
          messages: options?.messageIds,
          sessionId: containerId,
          tagId: options?.tagId,
          title,
        };
    return trpcMutate<string>('topic.createTopic', params);
  },
  remove: (id: string) => trpcMutate('topic.removeTopic', { id }),
  /** Server has no `favoriteTopic` — use `updateTopic` with favorite flag */
  favorite: (id: string, favorite = true) =>
    trpcMutate('topic.updateTopic', { id, value: { favorite } }),
  generateTitle: (id: string, options?: { force?: boolean }) =>
    trpcMutate<string | null>('topic.generateTopicTitle', { force: options?.force, id }),
  update: (id: string, value: { favorite?: boolean; tagId?: string | null; title?: string }) =>
    trpcMutate('topic.updateTopic', { id, value }),
  search: (keywords: string) => trpcQuery<Topic[]>('topic.searchTopics', { keywords }),
  /** Cross-session recent topics for "继续工作" / topic view. Returns sessionId for ChatDetail navigation. */
  recentTopics: (limit?: number) =>
    trpcQuery<RecentTopic[]>('topic.recentTopics', limit != null ? { limit } : undefined),
};

// ── Tag API (topic-level) ─────────────────────────────────────────
export const tagApi = {
  list: () => trpcQuery<Tag[]>('tag.getTags'),
  create: (name: string, color?: string | null) =>
    trpcMutate<string | undefined>('tag.createTag', { color, name }),
  remove: (id: string) => trpcMutate('tag.removeTag', { id }),
  removeAll: () => trpcMutate('tag.removeAllTags'),
  update: (id: string, value: { color?: string | null; name?: string }) =>
    trpcMutate('tag.updateTag', { id, value }),
  updateOrder: (sortMap: { id: string; sort: number }[]) =>
    trpcMutate('tag.updateTagOrder', { sortMap }),
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

// ── Knowledge Base API ──────────────────────────────────────────────

export const knowledgeBaseApi = {
  list: (params?: { spaceId?: string }) =>
    trpcQuery<KnowledgeBaseItem[]>('knowledgeBase.getKnowledgeBases', params),

  getById: (id: string) => trpcQuery<KnowledgeBaseItem | undefined>('knowledgeBase.getKnowledgeBaseById', { id }),

  create: (params: { avatar?: string; description?: string; name: string; spaceId?: string }) =>
    trpcMutate<string | undefined>('knowledgeBase.createKnowledgeBase', params),

  update: (id: string, value: Record<string, unknown>) =>
    trpcMutate('knowledgeBase.updateKnowledgeBase', { id, value }),

  addFiles: (knowledgeBaseId: string, ids: string[]) =>
    trpcMutate('knowledgeBase.addFilesToKnowledgeBase', { ids, knowledgeBaseId }),

  removeFiles: (knowledgeBaseId: string, ids: string[]) =>
    trpcMutate('knowledgeBase.removeFilesFromKnowledgeBase', { ids, knowledgeBaseId }),

  remove: (id: string, removeFiles?: boolean) =>
    trpcMutate('knowledgeBase.removeKnowledgeBase', { id, removeFiles }),
};

// ── Resource API (unified files + documents with folder support) ─────

export interface ResourceQueryParams {
  category?: string;
  knowledgeBaseId?: string;
  limit?: number;
  offset?: number;
  parentId?: string | null;
  q?: string | null;
  showFilesInKnowledgeBase?: boolean;
  sorter?: 'createdAt' | 'size' | 'name';
  sortType?: 'asc' | 'desc';
  /** When set with a library context, matches server `getKnowledgeItems` space scoping. */
  spaceId?: string;
}

export interface ResourceListResponse {
  hasMore: boolean;
  items: FileListItem[];
  total?: number;
}

export interface FolderCrumb {
  id: string;
  name: string;
  slug: string;
}

/** Soft-deleted documents from `document.queryDocuments` with `trash: true` (metadata only). */
export interface TrashedDocumentItem {
  filename: string | null;
  fileType: string | null;
  id: string;
  title: string | null;
}

export const resourceApi = {
  getKnowledgeItems: (params: ResourceQueryParams) =>
    trpcQuery<ResourceListResponse>('file.getKnowledgeItems', {
      limit: 50,
      offset: 0,
      showFilesInKnowledgeBase: false,
      ...params,
    }),

  getFolderBreadcrumb: (slug: string) =>
    trpcQuery<FolderCrumb[]>('document.getFolderBreadcrumb', { slug }),

  getDocument: (id: string) =>
    trpcQuery<{
      content?: string | null;
      editorData?: Record<string, any> | null;
      fileType?: string | null;
      id: string;
      knowledgeBaseId?: string | null;
      parentId?: string | null;
      slug?: string | null;
      title?: string | null;
    }>('document.getDocumentById', { id }),

  createFolder: (params: {
    knowledgeBaseId: string;
    parentId?: string;
    title: string;
  }) =>
    trpcMutate<{ id: string }>('document.createDocument', {
      editorData: '{}',
      fileType: 'custom/folder',
      knowledgeBaseId: params.knowledgeBaseId,
      parentId: params.parentId,
      title: params.title,
    }),

  moveResource: async (
    id: string,
    parentId: string | null,
    sourceType: 'file' | 'document',
  ) => {
    if (sourceType === 'file') {
      return trpcMutate('file.updateFile', { id, parentId });
    }
    return trpcMutate('document.updateDocument', { id, parentId });
  },

  updateDocument: (
    id: string,
    updates: {
      content?: string;
      fileType?: string;
      parentId?: string | null;
      title?: string;
    },
  ) =>
    trpcMutate('document.updateDocument', { id, ...updates }),

  deleteDocument: (id: string, trash: boolean = true) =>
    trpcMutate('document.deleteDocument', { id, trash }),

  deleteDocuments: (ids: string[], trash: boolean = true) =>
    trpcMutate('document.deleteDocuments', { ids, trash }),

  queryTrashedDocuments: (params?: {
    current?: number;
    knowledgeBaseId?: string;
    pageSize?: number;
  }) =>
    trpcQuery<{ items: TrashedDocumentItem[]; total: number }>('document.queryDocuments', {
      current: params?.current ?? 0,
      pageSize: params?.pageSize ?? 100,
      trash: true,
      ...(params?.knowledgeBaseId ? { knowledgeBaseId: params.knowledgeBaseId } : {}),
    }),

  restoreDocument: (id: string) => trpcMutate('document.restoreDocument', { id }),
};

export type ResourceShareKind = 'document' | 'file' | 'knowledge_base';

export interface ExplainAccessResult {
  authzEpoch: number;
  canAccess: boolean;
  matchedBy?: string;
  reason?: string;
  resourceUid: string;
  spaceId: string;
}

export interface ResourcePermissionListItem {
  canReshare?: boolean;
  createdAt?: string | Date | null;
  expiresAt?: string | Date | null;
  id: string;
  inheritsToChildren?: boolean;
  resourceUid?: string;
  role: 'owner' | 'editor' | 'viewer';
  spaceId?: string;
  subjectId?: string;
  subjectName?: string | null;
  subjectType?: string;
  subjectUsername?: string | null;
}

export interface ResourceShareLinkListItem {
  createdAt?: string | Date | null;
  disabledAt?: string | Date | null;
  expiresAt?: string | Date | null;
  id: string;
  resourceUid?: string;
  spaceId?: string;
}

export interface SharedWithMeListItem {
  kind: 'document' | 'file' | 'knowledge_base';
  localId: string;
  name: string;
  parentId?: string | null;
  resourceUid: string;
  sharedExpiresAt?: string | Date | null;
  sharedInheritsToChildren?: boolean;
  sharedRole?: 'owner' | 'editor' | 'viewer';
  spaceId: string | null;
}

/** Payload from `getSharedResourceByToken` (shape varies by `kind`). */
export interface PublicSharedResourcePayload {
  avatar?: string | null;
  content?: string;
  /** Knowledge base summary text when `kind === 'knowledge_base'`. */
  description?: string | null;
  expiresAt: string | Date;
  fileType?: string;
  kind: 'document' | 'file' | 'knowledge_base';
  localId: string;
  metadata?: unknown;
  name: string;
  resourceUid: string;
  role: 'viewer';
  spaceId: string | null;
  /** Present for shared documents. */
  title?: string;
}

export const resourceShareApi = {
  createResourceShareLink: (params: {
    expiresInDays?: 1 | 7 | 30;
    id?: string;
    kind?: ResourceShareKind;
    password?: string;
    resourceUid?: string;
  }) =>
    trpcMutate<{
      expiresAt: string;
      fileShareDownloadUrl?: string;
      id: string;
      shareUrl: string;
    }>('resourceShare.createResourceShareLink', params),

  disableResourceShareLink: (shareLinkId: string) =>
    trpcMutate<{ success: boolean }>('resourceShare.disableResourceShareLink', { shareLinkId }),

  explainAccess: (params: { id?: string; kind?: ResourceShareKind; resourceUid?: string }) =>
    trpcQuery<ExplainAccessResult>('resourceShare.explainAccess', params),

  getSharedResourceByToken: (params: { password?: string; token: string }) =>
    trpcQuery<PublicSharedResourcePayload>('resourceShare.getSharedResourceByToken', params),

  grantResourcePermission: (params: {
    canReshare?: boolean;
    expiresAt?: Date | string;
    id?: string;
    inheritsToChildren?: boolean;
    kind?: ResourceShareKind;
    resourceUid?: string;
    role: 'owner' | 'editor' | 'viewer';
    username: string;
  }) => trpcMutate<ResourcePermissionListItem>('resourceShare.grantResourcePermission', params),

  listResourcePermissions: (params: { id?: string; kind?: ResourceShareKind; resourceUid?: string }) =>
    trpcQuery<ResourcePermissionListItem[]>('resourceShare.listResourcePermissions', params),

  listResourceShareLinks: (params: { id?: string; kind?: ResourceShareKind; resourceUid?: string }) =>
    trpcQuery<ResourceShareLinkListItem[]>('resourceShare.listResourceShareLinks', params),

  listSharedWithMe: () => trpcQuery<SharedWithMeListItem[]>('resourceShare.listSharedWithMe'),

  revokeResourcePermission: (permissionId: string) =>
    trpcMutate<{ success: boolean }>('resourceShare.revokeResourcePermission', { permissionId }),
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
   * Upload a file through the same session + presigned URL flow used by web
   * (`prepareResourceUpload` → PUT → `completeResourceUpload` → `createFile`).
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
      parentId?: string;
      sessionId?: string;
      skipCheckFileType?: boolean;
      skipDeduplication?: boolean;
      spaceId?: string;
    },
  ): Promise<{ id: string; url: string }> => {
    const baseUrl = await getBaseUrl();
    const uploadUri = await ensureUploadableUri(uri, name);
    const size = await getLocalFileSize(uploadUri);
    const fileType = type || 'application/octet-stream';
    const sha256Hex = await computeSha256HexFromFileUri(uploadUri, size);

    let storagePath: string | undefined;
    let metadata: ReturnType<typeof fileMetadataFromStorageKey> | undefined;

    if (!options?.skipDeduplication) {
      const hashCheck = await trpcMutate<{
        isExist: boolean;
        metadata?: { path?: string };
        url?: string;
      }>('file.checkFileHash', { hash: sha256Hex, spaceId: options?.spaceId });

      if (hashCheck.isExist) {
        storagePath = hashCheck.metadata?.path || hashCheck.url;
        if (storagePath) {
          metadata = fileMetadataFromStorageKey(storagePath, name);
        }
      }
    }

    if (!storagePath) {
      options?.onProgress?.(5);
      const prep = await trpcMutate<{
        presignedUrl: string;
        sessionId: string;
        storageKey: string;
      }>('upload.prepareResourceUpload', {
        filename: name,
        fileType,
        knowledgeBaseId: options?.knowledgeBaseId,
        parentId: options?.parentId,
        sha256: sha256Hex,
        size,
        spaceId: options?.spaceId,
      });

      metadata = fileMetadataFromStorageKey(prep.storageKey, name);

      try {
        await putLocalFileToPresignedUrl(
          prep.presignedUrl,
          uploadUri,
          fileType,
          options?.onProgress,
        );
      } catch {
        await uploadLocalFileViaUploadSession(
          baseUrl,
          uploadUri,
          name,
          fileType,
          prep.sessionId,
          options?.onProgress,
        );
      }

      await trpcMutate('upload.completeResourceUpload', { uploadSessionId: prep.sessionId });
      storagePath = prep.storageKey;
    }

    if (!storagePath) {
      throw new Error('upload path missing');
    }

    const fileMetadata =
      metadata ?? fileMetadataFromStorageKey(storagePath, name);

    const created = await trpcMutate<{ id: string; url: string }>('file.createFile', {
      fileType,
      hash: sha256Hex,
      knowledgeBaseId: options?.knowledgeBaseId,
      metadata: fileMetadata,
      name,
      parentId: options?.parentId,
      size,
      spaceId: options?.spaceId,
      url: storagePath,
    });

    const resolvedUrl = resolveRemoteFileUrl(baseUrl, created.id, created.url);

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

  remove: (id: string, trash: boolean = true) => trpcMutate('file.removeFile', { id, trash }),

  removeFiles: (ids: string[], trash: boolean = true) =>
    trpcMutate('file.removeFiles', { ids, trash }),

  update: (id: string, updates: { name?: string; parentId?: string | null }) =>
    trpcMutate('file.updateFile', { id, ...updates }),

  getFileContents: (fileIds: string[]) =>
    trpcMutate<Array<{ content: string; fileId: string; filename: string }>>(
      'chunk.getFileContents',
      { fileIds },
    ),
};

// ── Config / User API ───────────────────────────────────────────────
export const configApi = {
  getDefaultAgentConfig: () =>
    trpcQuery<{ model?: string; provider?: string }>('config.getDefaultAgentConfig'),
  getGlobalConfig: () => trpcQuery('config.getGlobalConfig'),
};

async function postBetterAuthJson(
  path: string,
  jsonBody: Record<string, unknown>,
  errorLabel: string,
): Promise<unknown> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    body: JSON.stringify(jsonBody),
    headers: await getHeaders(),
    method: 'POST',
  });
  const rawText = await res.text();
  let parsed: Record<string, unknown> = {};
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      /* HTML or plain-text error body */
    }
  }
  if (!res.ok) {
    const detail =
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      rawText.trim().slice(0, 240);
    throw new Error(detail.trim() || `${errorLabel} (${res.status})`);
  }
  return parsed;
}

export const userApi = {
  getState: () => trpcQuery<MobileUserState>('user.getUserState'),
  getUser: () => trpcQuery<MobileUserState>('user.getUserState'),
  /** Linked OAuth / SSO accounts (same as web profile). */
  getSSOProviders: () => trpcQuery<MobileSSOProvider[]>('user.getUserSSOProviders'),
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
  requestPasswordReset: (email: string) =>
    postBetterAuthJson(
      '/api/auth/forget-password',
      { email, redirectTo: '/reset-password' },
      'Password reset request failed',
    ),
  changeEmail: (newEmail: string) =>
    postBetterAuthJson('/api/auth/change-email', { callbackURL: '/', newEmail }, 'Email change request failed'),
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
  _source: 'builtin' | 'skill' | 'mcp';
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

const normalizeMarketCategoryItem = (item: any): MarketCategoryItem | null => {
  if (!item || typeof item !== 'object') return null;

  const category =
    (typeof item.category === 'string' && item.category.trim()) ||
    (typeof item.key === 'string' && item.key.trim()) ||
    (typeof item.slug === 'string' && item.slug.trim()) ||
    (typeof item.identifier === 'string' && item.identifier.trim()) ||
    '';

  if (!category) return null;

  const count =
    typeof item.count === 'number'
      ? item.count
      : typeof item.totalCount === 'number'
        ? item.totalCount
        : typeof item.itemCount === 'number'
          ? item.itemCount
          : typeof item.total === 'number'
            ? item.total
            : undefined;

  return {
    category,
    ...(count !== undefined ? { count } : {}),
    ...(typeof item.description === 'string' ? { description: item.description } : {}),
    ...(typeof item.name === 'string' ? { name: item.name } : {}),
  };
};

const resolveMarketTotalCount = (result: {
  currentPage?: number;
  items?: unknown[];
  pageSize?: number;
  total?: number;
  totalCount?: number;
  totalPages?: number;
}) => {
  if (typeof result.totalCount === 'number') return result.totalCount;
  if (typeof result.total === 'number') return result.total;

  if (typeof result.totalPages === 'number' && result.totalPages > 0) {
    const resolvedPageSize =
      typeof result.pageSize === 'number' && result.pageSize > 0
        ? result.pageSize
        : result.items?.length ?? 0;

    const resolvedCurrentPage =
      typeof result.currentPage === 'number' && result.currentPage > 0 ? result.currentPage : 1;

    return Math.max(
      Math.max(result.totalPages - 1, 0) * resolvedPageSize + (result.items?.length ?? 0),
      resolvedCurrentPage * resolvedPageSize,
    );
  }

  return result.items?.length ?? 0;
};

export const marketSkillApi = {
  getMcpList: async (params?: {
    category?: string;
    page?: number;
    pageSize?: number;
    q?: string;
  }, options?: CommunityMarketRequestOptions): Promise<CommunityMarketListResult> => {
    const input = {
      category: params?.category,
      locale: getCommunityMarketLocale(),
      page: params?.page ?? 1,
      pageSize: normalizeCommunityMarketPageSize(params?.pageSize),
      q: params?.q,
      sort: 'recommended' as const,
    };

    try {
      const mcpResult = await requestCommunityMarket({
        fetcher: async () => {
          try {
            return await trpcQuery<any>('market.getMcpList', input);
          } catch (error) {
            if (!shouldFallbackCommunityMarketLocale(input.locale, error)) throw error;

            return trpcQuery<any>('market.getMcpList', {
              ...input,
              locale: COMMUNITY_MARKET_FALLBACK_LOCALE,
            });
          }
        },
        options,
        scope: 'market.getMcpList',
        values: input,
      });
      const pageSize =
        typeof mcpResult?.pageSize === 'number' && mcpResult.pageSize > 0
          ? mcpResult.pageSize
          : input.pageSize;

      return {
        currentPage:
          typeof mcpResult?.currentPage === 'number' && mcpResult.currentPage > 0
            ? mcpResult.currentPage
            : input.page,
        items: Array.isArray(mcpResult?.items)
          ? mcpResult.items.map((m: any) => ({
            ...m,
            _source: 'mcp' as const,
            avatar: m.meta?.avatar || m.avatar,
            category: m.category ?? m.meta?.category,
            description: m.meta?.description || m.description || '',
            identifier: m.identifier,
            manifestUrl: m.manifestUrl,
            name: m.meta?.title || m.name || m.title || m.identifier,
          }))
          : [],
        pageSize,
        totalCount: resolveMarketTotalCount(mcpResult ?? {}),
        totalPages:
          typeof mcpResult?.totalPages === 'number' && mcpResult.totalPages > 0
            ? mcpResult.totalPages
            : Math.max(Math.ceil(resolveMarketTotalCount(mcpResult ?? {}) / pageSize), 1),
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to fetch MCP list');
    }
  },

  getSkillList: async (params?: {
    category?: string;
    page?: number;
    pageSize?: number;
    q?: string;
  }, options?: CommunityMarketRequestOptions): Promise<CommunityMarketListResult> => {
    const input = {
      category: params?.category,
      locale: getCommunityMarketLocale(),
      page: params?.page ?? 1,
      pageSize: normalizeCommunityMarketPageSize(params?.pageSize),
      q: params?.q,
      sort: 'installCount',
    };

    try {
      const result = await requestCommunityMarket({
        fetcher: () => trpcQuery<any>('market.skill.getSkillList', input),
        options,
        scope: 'market.skill.getSkillList',
        values: input,
      });
      const pageSize =
        typeof result?.pageSize === 'number' && result.pageSize > 0
          ? result.pageSize
          : input.pageSize;

      return {
        currentPage:
          typeof result?.currentPage === 'number' && result.currentPage > 0
            ? result.currentPage
            : input.page,
        items: Array.isArray(result?.items)
          ? result.items.map((s: any) => ({
            ...s,
            _source: 'skill' as const,
            avatar: s.icon || s.logo || s.avatar,
            category: s.category ?? s.meta?.category,
            description: s.description || s.meta?.description || '',
            identifier: s.identifier,
            name: s.name || s.meta?.title || s.identifier,
          }))
          : [],
        pageSize,
        totalCount: resolveMarketTotalCount(result ?? {}),
        totalPages:
          typeof result?.totalPages === 'number' && result.totalPages > 0
            ? result.totalPages
            : Math.max(Math.ceil(resolveMarketTotalCount(result ?? {}) / pageSize), 1),
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to fetch skill list');
    }
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
      return marketSkillApi.getSkillList(baseParams);
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

    const marketMcpDetail =
      item._source === 'mcp'
        ? await marketSkillApi.getMcpDetail(item.identifier).catch(() => undefined)
        : undefined;
    const marketMcpData =
      item._source === 'mcp' ? ({ ...item, ...marketMcpDetail } as Record<string, any>) : undefined;
    const connection = marketMcpData ? resolveMarketMcpConnection(marketMcpData) : undefined;

    let manifest = item.manifest;
    // Fetch manifest if missing or empty (no api/tools entries)
    const hasTools = manifest && (
      (Array.isArray(manifest.api) && manifest.api.length > 0) ||
      (Array.isArray(manifest.tools) && manifest.tools.length > 0)
    );
    if (!hasTools && connection?.type === 'cloud' && marketMcpData) {
      manifest = buildMarketCloudMcpManifest(marketMcpData);
    } else if (!hasTools && connection?.type === 'http') {
      try {
        manifest = await mcpApi.getStreamableMcpServerManifest({
          ...(connection.auth ? { auth: connection.auth } : {}),
          ...(connection.headers ? { headers: connection.headers } : {}),
          identifier: item.identifier,
          metadata: {
            avatar: marketMcpData?.icon || marketMcpData?.avatar,
            description: marketMcpData?.description,
          },
          url: connection.url,
        });
      } catch {
        /* fall through to manifestUrl fetch */
      }
    }

    if (
      (!manifest ||
        (!Array.isArray(manifest.api) && !Array.isArray(manifest.tools)) ||
        (Array.isArray(manifest.api) && manifest.api.length === 0 && Array.isArray(manifest.tools) && manifest.tools.length === 0)) &&
      item.manifestUrl
    ) {
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
    if (connection) customParams.mcp = connection;

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

  getCategories: (
    params?: {
      q?: string;
    },
    options?: CommunityMarketRequestOptions,
  ) =>
    requestCommunityMarket({
      fetcher: () =>
        trpcQuery<MarketCategoryItem[]>('market.skill.getSkillCategories', {
          locale: getCommunityMarketLocale(),
          q: params?.q,
        }),
      options,
      scope: 'market.skill.getSkillCategories',
      values: { locale: getCommunityMarketLocale(), q: params?.q },
    }).then((items) =>
      (items ?? [])
        .map((item) => normalizeMarketCategoryItem(item))
        .filter((item): item is MarketCategoryItem => Boolean(item)),
    ),

  getMcpCategories: (
    params?: {
      q?: string;
    },
    options?: CommunityMarketRequestOptions,
  ) =>
    requestCommunityMarket({
      fetcher: () =>
        trpcQuery<MarketCategoryItem[]>('market.getMcpCategories', {
          locale: getCommunityMarketLocale(),
          q: params?.q,
        }),
      options,
      scope: 'market.getMcpCategories',
      values: { locale: getCommunityMarketLocale(), q: params?.q },
    }).then((items) =>
      (items ?? [])
        .map((item) => normalizeMarketCategoryItem(item))
        .filter((item): item is MarketCategoryItem => Boolean(item)),
    ),
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

  /** Get memory tags (params match tRPC: `layers`, `size`) */
  queryTags: (params?: { layers?: string[]; page?: number; size?: number }) =>
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

export const videoApi = {
  createTopic: () => trpcMutate<string>('generationTopic.createTopic', { type: 'video' }),
  getTopics: () => trpcQuery<GenerationTopic[]>('generationTopic.getAllGenerationTopics', { type: 'video' }),
  deleteTopic: (id: string) => trpcMutate('generationTopic.deleteTopic', { id }),
  updateTopic: (id: string, value: { title?: string | null; coverUrl?: string | null }) =>
    trpcMutate('generationTopic.updateTopic', { id, value }),
  getBatches: (topicId: string) =>
    trpcQuery<GenerationBatch[]>('generationBatch.getGenerationBatches', {
      topicId,
      type: 'video',
    }),
  deleteBatch: (batchId: string) =>
    trpcMutate('generationBatch.deleteGenerationBatch', { batchId }),
  createVideo: (params: {
    generationTopicId: string;
    model: string;
    params: {
      aspectRatio?: string;
      duration?: number;
      endImageUrl?: string | null;
      generateAudio?: boolean;
      imageUrl?: string | null;
      prompt: string;
      resolution?: string;
      seed?: number | null;
    };
    provider: string;
  }) =>
    trpcMutate<{ data: { batch: GenerationBatch; generations: any[] }; success: boolean }>(
      'video.createVideo',
      params,
    ),
  getGenerationStatus: (generationId: string, asyncTaskId: string) =>
    trpcQuery<{ error: any; generation: any; status: string }>(
      'generation.getGenerationStatus',
      { asyncTaskId, generationId },
    ),
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

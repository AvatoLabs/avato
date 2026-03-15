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
import type {
  AgentSkillItem,
  AiProviderDetailItem,
  AiProviderListItem,
  AiProviderModelItem,
  AiProviderRuntimeState,
  ChatMessage,
  ChatSession,
  CreateSessionConfig,
    DiscoverModel,
    FileListItem,
    GenerationBatch,
    GenerationTopic,
    HeatmapDay,
    ImageGenerationParams,
  InstalledPlugin,
  MarketAgent,
  MemoryActivityItem,
  MemoryContextItem,
  MemoryExperienceItem,
  MemoryIdentityItem,
  MemoryPagedResult,
  MemoryPersona,
  MemoryPreferenceItem,
  MobileMemoryEffort,
  ModelRankItem,
  SessionGroup,
  SessionRankItem,
  Topic,
  TopicRankItem,
  UserProfile,
  UserRegistrationDuration,
} from '../types';
import { clearStoredAuthSession, getAuthHeaders } from './auth';
import {
  getApiUrl,
  hasConfiguredUrl,
  setApiUrl,
  testConnection,
} from './server';

export { clearStoredAuthSession as clearAuth, getApiUrl, hasConfiguredUrl, setApiUrl, testConnection };

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

async function trpcQuery<T = any>(procedure: string, input?: unknown): Promise<T> {
  const base = await getBaseUrl();
  // Wrap input in superjson envelope when present
  const sjInput = input !== undefined ? { json: input } : undefined;
  const url = sjInput
    ? `${base}/trpc/mobile/${procedure}?input=${encodeURIComponent(JSON.stringify(sjInput))}`
    : `${base}/trpc/mobile/${procedure}`;
  const res = await fetch(url, { headers: await getHeaders() });
  if (!res.ok) throw new Error(`tRPC query ${procedure} failed: ${res.status}`);
  const json = await res.json();
  // Unwrap superjson envelope
  const data = json.result?.data;
  return (data && typeof data === 'object' && 'json' in data ? data.json : data) as T;
}

async function trpcMutate<T = any>(procedure: string, input?: unknown): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/trpc/mobile/${procedure}`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify({ json: input }),
  });
  if (!res.ok) throw new Error(`tRPC mutation ${procedure} failed: ${res.status}`);
  const json = await res.json();
  // Unwrap superjson envelope
  const data = json.result?.data;
  return (data && typeof data === 'object' && 'json' in data ? data.json : data) as T;
}

// ── Agent API ───────────────────────────────────────────────────────
export const agentApi = {
  /** Create a new agent (with session). Returns { agentId, sessionId }. */
  create: (config?: Record<string, unknown>, groupId?: string) =>
    trpcMutate<{ agentId: string; sessionId: string }>('agent.createAgent', {
      config,
      groupId,
    }),

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
    const result = await trpcQuery<{ sessionGroups: SessionGroup[]; sessions: any[] }>(
      'session.getGroupedSessions',
    );
    // Server maps DB groupId → "group" field; normalize to our ChatSession.groupId
    return (result?.sessions ?? []).map((s) => ({
      ...s,
      agentId: s.config?.id ?? undefined,
      groupId: s.groupId ?? s.group ?? undefined,
      title: s.meta?.title ?? s.title ?? '',
      description: s.meta?.description ?? s.description,
      avatar: s.meta?.avatar ?? s.avatar,
      chatConfig: s.config?.chatConfig ?? s.chatConfig,
      model: s.model || s.config?.model || undefined,
      provider: s.config?.provider || undefined,
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
      session: { groupId: config?.groupId },
      type: 'agent' as const,
    }),
  remove: (id: string) => trpcMutate('session.removeSession', { id }),
  removeChatGroup: (id: string) => trpcMutate('agentGroup.deleteGroup', { id }),
  pin: (id: string) =>
    trpcMutate('session.updateSession', { id, value: { pinned: true } }),
  unpin: (id: string) =>
    trpcMutate('session.updateSession', { id, value: { pinned: false } }),
  updateGroup: (id: string, groupId: string) =>
    trpcMutate('session.updateSession', { id, value: { groupId: groupId || null } }),
  duplicate: (id: string, title = 'Duplicated') =>
    trpcMutate<string | undefined>('session.cloneSession', { id, newTitle: title }),
  rename: (id: string, title: string) =>
    trpcMutate('session.updateSession', { id, value: { title } }),
  /** Update agent chat config (e.g. searchMode) for a session */
  updateChatConfig: (id: string, config: Record<string, unknown>) =>
    trpcMutate('session.updateSessionChatConfig', { id, value: config }),
};

// ── Message API ─────────────────────────────────────────────────────
export interface CreateMessageParams {
  content: string;
  files?: string[];
  model?: string;
  parentId?: string;
  provider?: string;
  reasoning?: { content?: string; duration?: number } | null;
  role: 'user' | 'assistant';
  sessionId: string;
  topicId?: string;
}

export const messageApi = {
  list: (sessionId: string, topicId?: string) =>
    trpcQuery<ChatMessage[]>('message.getMessages', { sessionId, topicId }),

  create: (params: CreateMessageParams) =>
    trpcMutate<{ id: string; messages: ChatMessage[] }>('message.createMessage', params),

  remove: (id: string) => trpcMutate('message.removeMessage', { id }),
  /** Server procedure is `message.update`, NOT `message.updateMessage` */
  update: (id: string, content: string) =>
    trpcMutate('message.update', { id, value: { content } }),
  /** Server expects `{ ids: string[] }`, NOT `{ sessionId, topicId }` */
  removeAll: (ids: string[]) =>
    trpcMutate('message.removeMessages', { ids }),
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

export interface StreamCallbacks {
  onPerformance?: (perf: Record<string, any>) => void;
  onReasoning?: (accumulated: string) => void;
  onText?: (accumulated: string) => void;
  onUsage?: (usage: Record<string, any>) => void;
}

export interface StreamResult {
  performance?: Record<string, any>;
  reasoning: string;
  text: string;
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
  role: string;
}

/**
 * Create a stateful SSE parser. The parser must be stateful because SSE fields
 * (id, event, data) often arrive in SEPARATE XHR onprogress chunks in React
 * Native, so `currentEvent` must persist across calls.
 */
interface SSEParseResult {
  performance?: Record<string, any>;
  reasoning: string;
  text: string;
  usage?: Record<string, any>;
}

function createSSEParser() {
  let lineBuffer = '';
  let currentEvent = '';

  return function parse(raw: string): SSEParseResult {
    const combined = lineBuffer + raw;
    const lines = combined.split('\n');
    lineBuffer = lines.pop() ?? '';

    let text = '';
    let reasoning = '';
    let usage: Record<string, any> | undefined;
    let performance: Record<string, any> | undefined;

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '');
      if (trimmed.startsWith('id:')) {
        // SSE id field — ignore
      } else if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr) continue;

        if (currentEvent === 'text' || currentEvent === '') {
          try {
            const parsed = JSON.parse(dataStr);
            if (typeof parsed === 'string') {
              text += parsed;
            } else if (typeof parsed === 'object' && parsed !== null) {
              // Sometimes search pre-flight or other tools send object data
              // If it's a search_complete or similar, we might just ignore it
              // Or if it has a text field, we could extract it, but usually text is sent as string
            } else {
              text += String(parsed);
            }
          } catch {
            // Fallback for unquoted text streams or malformed JSON
            // We need to unescape newlines if they are literal \n in the string
            text += dataStr.replaceAll('\\n', '\n');
          }
        } else if (currentEvent === 'reasoning') {
          try {
            const parsed = JSON.parse(dataStr);
            if (typeof parsed === 'string') {
              reasoning += parsed;
            } else if (typeof parsed === 'object' && parsed !== null) {
              // Ignore
            } else {
              reasoning += String(parsed);
            }
          } catch {
            reasoning += dataStr.replaceAll('\\n', '\n');
          }
        } else if (currentEvent === 'usage') {
          try { usage = JSON.parse(dataStr); } catch { /* ignore */ }
        } else if (currentEvent === 'speed' || currentEvent === 'performance') {
          try { performance = JSON.parse(dataStr); } catch { /* ignore */ }
        }
      } else if (trimmed === '') {
        currentEvent = '';
      }
    }

    return { performance, reasoning, text, usage };
  };
}

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

      return new Promise<StreamResult>((resolve, reject) => {
        const allMessages = [...messages];
        if (options?.systemPrompt) {
          allMessages.unshift({ role: 'system', content: options.systemPrompt });
        }

        const payload: Record<string, unknown> = {
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

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${base}/webapi/chat/${provider}`);
        xhr.responseType = 'text';
        xhr.timeout = 180_000;

        for (const [key, value] of Object.entries(headers)) {
          xhr.setRequestHeader(key, value);
        }
        xhr.setRequestHeader('Content-Type', 'application/json');

        let accText = '';
        let accReasoning = '';
        let lastUsage: Record<string, any> | undefined;
        let lastPerformance: Record<string, any> | undefined;
        let processedLength = 0;
        let thinkingInContent = false;
        let rawTextBuffer = '';
        const parseSSE = createSSEParser();

        const processNewData = (newData: string) => {
          const { text, reasoning, usage: parsedUsage, performance: parsedPerf } = parseSSE(newData);

          if (parsedUsage) {
            lastUsage = parsedUsage;
            callbacks.onUsage?.(parsedUsage);
          }
          if (parsedPerf) {
            lastPerformance = parsedPerf;
            callbacks.onPerformance?.(parsedPerf);
          }

          if (reasoning) {
            accReasoning += reasoning;
            callbacks.onReasoning?.(accReasoning);
          }

          if (text) {
            rawTextBuffer += text;

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
                  callbacks.onReasoning?.(accReasoning);
                }
                const combined = before + after;
                if (combined) {
                  accText = combined;
                  callbacks.onText?.(accText);
                }
              } else {
                const thinkStart = rawTextBuffer.indexOf('<think>');
                const beforeThink = rawTextBuffer.slice(0, thinkStart < 0 ? 0 : thinkStart);
                const thinkContent = rawTextBuffer
                  .slice((thinkStart < 0 ? 0 : thinkStart) + 7)
                  .replaceAll('<think>', '');

                if (thinkContent) {
                  accReasoning = thinkContent;
                  callbacks.onReasoning?.(accReasoning);
                }
                if (beforeThink) {
                  accText = beforeThink;
                  callbacks.onText?.(accText);
                }
              }
            } else {
              accText = rawTextBuffer;
              callbacks.onText?.(accText);
            }
          }
        };

        xhr.onprogress = () => {
          const newData = xhr.responseText.slice(processedLength);
          processedLength = xhr.responseText.length;
          processNewData(newData);
        };

        xhr.onload = () => {
          if (xhr.status >= 400) {
            reject(new Error(`AI chat failed: ${xhr.status}`));
            return;
          }
          const remaining = xhr.responseText.slice(processedLength);
          if (remaining) processNewData(remaining);
          processNewData('\n');
          resolve({ performance: lastPerformance, reasoning: accReasoning, text: accText, usage: lastUsage });
        };

        xhr.onerror = () => reject(new Error('Network error during AI chat'));
        xhr.ontimeout = () => reject(new Error('AI chat request timed out'));

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
        console.warn('[aiChatApi] first attempt failed, retrying once:', firstError);
        await new Promise((r) => setTimeout(r, 800));
        return attempt();
      }
    };

    return run();
  },
};

// ── Topic API ───────────────────────────────────────────────────────
export const topicApi = {
  list: (sessionId: string) => trpcQuery<Topic[]>('topic.getTopics', { sessionId }),
  /** Returns topic ID string, not full Topic object. */
  create: (sessionId: string, title: string) =>
    trpcMutate<string>('topic.createTopic', { sessionId, title }),
  remove: (id: string) => trpcMutate('topic.removeTopic', { id }),
  /** Server has no `favoriteTopic` — use `updateTopic` with favorite flag */
  favorite: (id: string, favorite = true) =>
    trpcMutate('topic.updateTopic', { id, value: { favorite } }),
  update: (id: string, title: string) =>
    trpcMutate('topic.updateTopic', { id, value: { title } }),
};

// ── Session Group API ──────────────────────────────────────────────
export const sessionGroupApi = {
  /** Server procedure is `getSessionGroup` (singular), not `getSessionGroups` */
  list: () => trpcQuery<SessionGroup[]>('sessionGroup.getSessionGroup'),
  /** Returns group ID string, not `{id: string}` */
  create: (name: string) =>
    trpcMutate<string | undefined>('sessionGroup.createSessionGroup', { name }),
  remove: (id: string) =>
    trpcMutate('sessionGroup.removeSessionGroup', { id }),
  removeAll: () =>
    trpcMutate('sessionGroup.removeAllSessionGroups'),
  rename: (id: string, name: string) =>
    trpcMutate('sessionGroup.updateSessionGroup', { id, value: { name } }),
  updateOrder: (sortMap: { id: string; sort: number }[]) =>
    trpcMutate('sessionGroup.updateSessionGroupOrder', { sortMap }),
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
   * Upload a file through the server-side file API.
   *
   * Mobile clients cannot reliably access self-hosted localhost/private S3
   * endpoints from presigned URLs, so this path sends the file to the app
   * server and lets the server complete storage + record creation.
   */
  upload: async (
    uri: string,
    name: string,
    type: string,
    options?: {
      agentId?: string;
      directory?: string;
      knowledgeBaseId?: string;
      sessionId?: string;
      skipCheckFileType?: boolean;
      skipDeduplication?: boolean;
    },
  ): Promise<{ id: string; url: string }> => {
    const base = await getBaseUrl();
    const formData = new FormData();

    formData.append(
      'file',
      {
        name,
        type,
        uri,
      } as any,
    );
    if (options?.agentId) formData.append('agentId', options.agentId);
    if (options?.directory) formData.append('directory', options.directory);
    if (options?.knowledgeBaseId) formData.append('knowledgeBaseId', options.knowledgeBaseId);
    if (options?.sessionId) formData.append('sessionId', options.sessionId);
    if (options?.skipCheckFileType) formData.append('skipCheckFileType', 'true');
    if (options?.skipDeduplication) formData.append('skipDeduplication', 'true');

    const res = await fetch(`${base}/api/v1/files`, {
      body: formData,
      headers: await getAuthHeaders(base),
      method: 'POST',
    });

    const payload = await res.json().catch(() => undefined);
    const data = payload?.data;
    // OpenAPI /files response shape is usually `{ data: { file: { id, url, ... }}}`,
    // while some legacy paths may return `{ data: { id, url } }`.
    const fileData = data?.file ?? data;
    const id = fileData?.id;
    const url = fileData?.url;

    if (!res.ok || !payload?.success || !id || !url) {
      const reason = payload?.error || payload?.message || `upload failed: ${res.status}`;
      throw new Error(reason);
    }

    return { id, url };
  },

  remove: (id: string) => trpcMutate('file.removeFile', { id }),
};

// ── Config / User API ───────────────────────────────────────────────
export const configApi = {
  getGlobalConfig: () => trpcQuery('config.getGlobalConfig'),
};

export const userApi = {
  getUser: () => trpcQuery<UserProfile>('user.getUserState'),
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
  _source: 'skill' | 'mcp' | 'legacy';
  author?: string;
  avatar?: string;
  description?: string;
  identifier: string;
  manifest?: Record<string, any>;
  manifestUrl?: string;
  name?: string;
}

export const marketSkillApi = {
  getList: async (params?: {
    category?: string;
    page?: number;
    pageSize?: number;
    q?: string;
  }): Promise<{ items: MarketListItem[]; totalCount: number }> => {
    const input = {
      category: params?.category,
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 50,
      q: params?.q,
    };

    // Try skill list first (requires market auth)
    try {
      const result = await trpcQuery<any>('market.skill.getSkillList', input);
      if (result?.items?.length > 0) {
        return {
          items: result.items.map((s: any) => ({
            ...s,
            _source: 'skill' as const,
            avatar: s.icon || s.logo,
          })),
          totalCount: result.totalCount || result.items.length,
        };
      }
    } catch { /* skill API unavailable */ }

    // Fallback: MCP list (also via market but more commonly available)
    try {
      const mcpResult = await trpcQuery<any>('market.getMcpList', input);
      if (mcpResult?.items?.length > 0) {
        return {
          items: mcpResult.items.map((m: any) => ({
            ...m,
            _source: 'mcp' as const,
            name: m.name || m.title || m.identifier,
          })),
          totalCount: mcpResult.totalCount || mcpResult.items.length,
        };
      }
    } catch { /* MCP API unavailable */ }

    // Fallback: legacy plugin list (from npm registry, no market auth needed)
    try {
      const legacyResult = await trpcQuery<any[]>('market.getLegacyPluginList', {});
      if (Array.isArray(legacyResult) && legacyResult.length > 0) {
        let items: MarketListItem[] = legacyResult.map((p: any) => ({
          _source: 'legacy' as const,
          identifier: p.identifier,
          name: p.meta?.title || p.identifier,
          description: p.meta?.description || '',
          author: p.author,
          avatar: p.meta?.avatar,
          manifestUrl: typeof p.manifest === 'string' ? p.manifest : undefined,
          manifest: typeof p.manifest === 'object' ? p.manifest : undefined,
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
    } catch { /* legacy API unavailable */ }

    return { items: [], totalCount: 0 };
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

  getDetail: (identifier: string) =>
    trpcQuery<any>('market.skill.getSkillDetail', { identifier }),

  getCategories: () =>
    trpcQuery<string[]>('market.skill.getSkillCategories'),
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
export const memoryApi = {
  // ── Persona & Tags ──
  /** Get user persona (summary + content) */
  getPersona: () => trpcQuery<MemoryPersona>('userMemory.getPersona'),

  /** Get identity roles / tags for the tag cloud */
  queryIdentityRoles: (params?: { page?: number; pageSize?: number }) =>
    trpcQuery<{ items: Array<{ count: number; role: string }>; total: number }>(
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
    trpcQuery<Record<string, any>>('userMemories.getMemoryDetail', { id, layer }),

  // ── Create Identity ──
  createIdentity: (data: { title: string; summary?: string; role?: string }) =>
    trpcMutate<MemoryIdentityItem>('userMemory.createIdentity', data),

  // ── Memory Extraction ──
  requestMemoryFromChatTopic: (params: { topicId: string }) =>
    trpcMutate('userMemory.requestMemoryFromChatTopic', params),

  getMemoryExtractionTask: (params: { topicId: string }) =>
    trpcQuery<{ status: string; progress?: number; error?: string }>('userMemory.getMemoryExtractionTask', params),

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

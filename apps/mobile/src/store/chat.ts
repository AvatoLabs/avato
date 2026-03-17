/**
 * Chat (message) store — manages messages for the active session.
 *
 * Mirrors the web chat store logic:
 *   - Fetch messages from backend
 *   - Send user messages, trigger AI response
 *   - Handle streaming responses
 */
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import type {
  ChatRequestOptions,
  MobileChatMessage,
  MobileMessageToolCall,
  StreamContentState,
  StreamReasoningState,
  ToolExecutionItem,
} from '../lib/api';
import {
  agentApi,
  agentGroupApi,
  aiAgentApi,
  aiChatApi,
  fileApi,
  messageApi,
  sessionApi,
  topicApi,
} from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import { isGroupSessionLike, resolveSessionTypeWithFallback } from '../lib/session';
import type {
  ChatMessage,
  ChatToolPayload,
  MobileChatConfig,
  MobileMemoryEffort,
  Topic,
} from '../types';
import { useFileStore } from './file';
import { useSessionStore } from './session';
import { useTopicStore } from './topic';
import { getUserMemorySettings } from './user';

const toolExecutionsToPayloads = (executions: ToolExecutionItem[]): ChatToolPayload[] =>
  executions.map((exec) => ({
    apiName: exec.apiName,
    arguments: exec.arguments,
    id: exec.id,
    identifier: exec.identifier,
    result_content: exec.result,
    source: exec.identifier.startsWith('lobe-') ? 'builtin' : ('plugin' as const),
    type: 'function',
  }));

/**
 * Resolves per-session chat options with Agent Config as single source of truth:
 *   1. Backend agent config (primary) — model, provider, params, chatConfig.memory, chatConfig.searchMode
 *   2. Session meta fallback (model/provider, chatConfig)
 */
async function getSessionChatOptions(sessionId: string): Promise<ChatRequestOptions> {
  const opts: ChatRequestOptions = {};
  const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);

  // 1. Backend agent config (source of truth)
  if (!isGroupSessionLike(sessionId, session?.type)) {
    try {
      const config = await agentApi.getConfigBySession(sessionId);
      if (config) {
        if (config.model) opts.model = config.model;
        if (config.provider) opts.provider = config.provider;
        if (config.params?.temperature != null) opts.temperature = config.params.temperature;
        if (config.params?.top_p != null) opts.top_p = config.params.top_p;
        if (config.params?.frequency_penalty != null)
          opts.frequency_penalty = config.params.frequency_penalty;
        if (config.params?.presence_penalty != null)
          opts.presence_penalty = config.params.presence_penalty;
        if (config.params?.max_tokens != null) opts.max_tokens = config.params.max_tokens;
        if (config.systemRole) opts.systemPrompt = config.systemRole;
        const chatConfig = config.chatConfig as MobileChatConfig | undefined;
        if (chatConfig?.memory) {
          const effort = chatConfig.memory.effort;
          opts.memory = {
            effort:
              effort === 'low' || effort === 'medium' || effort === 'high' ? effort : 'medium',
            enabled: chatConfig.memory.enabled !== false,
          };
        }
        if (chatConfig?.searchMode) {
          opts.enabledSearch = chatConfig.searchMode !== 'off';
        }
      }
    } catch {
      /* network error — fall through to session meta */
    }
  }

  // 2. Session meta fallback (when agent config missing or incomplete)
  if (session) {
    if (!opts.model && session.model) opts.model = session.model;
    if (!opts.provider && session.provider) opts.provider = session.provider;
    const sessionChatConfig = session.chatConfig as MobileChatConfig | undefined;
    if (!opts.memory && sessionChatConfig?.memory) {
      const effort = sessionChatConfig.memory.effort;
      opts.memory = {
        effort: effort === 'low' || effort === 'medium' || effort === 'high' ? effort : 'medium',
        enabled: sessionChatConfig.memory.enabled !== false,
      };
    }
    if (opts.enabledSearch === undefined && sessionChatConfig?.searchMode) {
      opts.enabledSearch = sessionChatConfig.searchMode !== 'off';
    }
  }

  if (!opts.memory) {
    try {
      const memorySettings = await getUserMemorySettings();

      opts.memory = {
        effort: memorySettings.effort,
        enabled: memorySettings.enabled,
      };
    } catch {
      /* best-effort */
    }
  }

  return opts;
}

interface UploadedAttachment {
  content?: string;
  fileId: string;
  name: string;
  /** base64 data URI for streaming to LLM (avoids SSRF blocks) */
  streamUrl?: string;
  type: string;
  url: string;
}

const buildAssistantMessageMetadata = (
  performance?: Record<string, any>,
  usage?: Record<string, any>,
  contentMetadata?: ChatMessage['metadata'],
) =>
  performance || usage || contentMetadata
    ? {
        ...contentMetadata,
        ...(performance ? { performance: performance as any } : {}),
        ...(usage ? { usage: usage as any } : {}),
      }
    : undefined;

const mergeMessageMetadata = (
  existing: ChatMessage['metadata'],
  contentState?: Pick<StreamContentState, 'isMultimodal' | 'tempDisplayContent'>,
) => {
  if (!contentState?.isMultimodal && !contentState?.tempDisplayContent) return existing;

  return {
    ...existing,
    ...(contentState.isMultimodal ? { isMultimodal: true } : {}),
    ...(contentState.tempDisplayContent
      ? { tempDisplayContent: contentState.tempDisplayContent }
      : {}),
  };
};

const buildReasoningState = (
  reasoning: StreamReasoningState,
  duration?: number,
): NonNullable<ChatMessage['reasoning']> => ({
  ...(reasoning.content ? { content: reasoning.content } : {}),
  ...(duration !== undefined ? { duration } : {}),
  ...(reasoning.isMultimodal ? { isMultimodal: true } : {}),
  ...(reasoning.tempDisplayContent ? { tempDisplayContent: reasoning.tempDisplayContent } : {}),
});

const buildPersistedReasoning = (
  reasoning: ChatMessage['reasoning'],
): NonNullable<ChatMessage['reasoning']> | undefined => {
  if (!reasoning) return undefined;

  if (reasoning.isMultimodal && reasoning.tempDisplayContent?.length) {
    return {
      content: reasoning.content || JSON.stringify(reasoning.tempDisplayContent),
      ...(reasoning.duration !== undefined ? { duration: reasoning.duration } : {}),
      isMultimodal: true,
      ...(reasoning.signature ? { signature: reasoning.signature } : {}),
    };
  }

  if (!reasoning.content && reasoning.duration === undefined && !reasoning.signature)
    return undefined;

  return {
    ...(reasoning.content ? { content: reasoning.content } : {}),
    ...(reasoning.duration !== undefined ? { duration: reasoning.duration } : {}),
    ...(reasoning.signature ? { signature: reasoning.signature } : {}),
  };
};

const isImageAttachment = (mimeType: string) => mimeType.startsWith('image/');

const toBase64DataUri = async (uri: string, mimeType: string): Promise<string | null> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    console.warn('[ChatStore] Failed to convert image to base64:', e);
    return null;
  }
};
const FILE_CONTENT_PREVIEW_LIMIT = 6000;
const FILE_CONTENT_EXTRACTION_RETRY_DELAYS = [0, 600, 1500];

const buildAttachmentDisplayContent = (attachments: UploadedAttachment[]) =>
  attachments.map((f) => `[${f.name}]`).join('\n');

const buildAttachmentContextLine = (attachment: UploadedAttachment) => {
  const extractedContent = attachment.content?.trim();

  if (extractedContent) {
    const preview =
      extractedContent.length > FILE_CONTENT_PREVIEW_LIMIT
        ? `${extractedContent.slice(0, FILE_CONTENT_PREVIEW_LIMIT)}…`
        : extractedContent;

    return `- ${attachment.name}:\n${preview}`;
  }

  return `- ${attachment.name}: [file uploaded successfully, but text extraction is not available yet]`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GROUP_LOADING_CONTENT = '...';
const GROUP_POLL_INTERVAL_MS = 1200;
const GROUP_POLL_MAX_ATTEMPTS = 45;

const hydrateAttachmentContents = async (attachments: UploadedAttachment[]) => {
  const pendingFileIds = attachments
    .filter((attachment) => !isImageAttachment(attachment.type) && !attachment.content?.trim())
    .map((attachment) => attachment.fileId);

  if (pendingFileIds.length === 0) return;

  const unresolvedIds = new Set(pendingFileIds);

  for (const delay of FILE_CONTENT_EXTRACTION_RETRY_DELAYS) {
    if (delay > 0) {
      await sleep(delay);
    }

    try {
      const contents = await fileApi.getFileContents([...unresolvedIds]);

      for (const item of contents) {
        const attachment = attachments.find((candidate) => candidate.fileId === item.fileId);
        const content = item.content?.trim();

        if (!attachment || !content) continue;

        attachment.content = content;
        unresolvedIds.delete(item.fileId);
      }
    } catch {
      // Content extraction is best-effort; keep retrying.
    }

    if (unresolvedIds.size === 0) break;
  }
};

const buildAttachmentPromptText = (text: string, attachments: UploadedAttachment[]) => {
  const nonImageAttachments = attachments.filter((f) => !isImageAttachment(f.type));

  if (nonImageAttachments.length === 0) {
    return text || buildAttachmentDisplayContent(attachments);
  }

  const textBlocks: string[] = [];

  if (text) {
    textBlocks.push(text);
  } else if (attachments.length > 0) {
    textBlocks.push(buildAttachmentDisplayContent(attachments));
  }

  const fileLines = nonImageAttachments.map(buildAttachmentContextLine);
  textBlocks.push(`Attached files:\n${fileLines.join('\n')}`);

  return textBlocks.join('\n\n');
};

const normalizeTopicItem = (topic: any, sessionId: string): Topic => ({
  createdAt:
    typeof topic?.createdAt === 'string'
      ? topic.createdAt
      : new Date(topic?.createdAt ?? Date.now()).toISOString(),
  favorite: topic?.favorite ?? undefined,
  id: String(topic?.id ?? ''),
  sessionId,
  title: String(topic?.title ?? ''),
  updatedAt:
    typeof topic?.updatedAt === 'string'
      ? topic.updatedAt
      : new Date(topic?.updatedAt ?? Date.now()).toISOString(),
});

const syncTopicsForSession = (
  sessionId: string,
  topics: { items: any[]; total: number } | undefined,
  activeTopicId?: string | null,
) => {
  if (!topics) {
    if (!activeTopicId) return;

    useTopicStore.setState((s) => ({
      activeTopicBySession: {
        ...s.activeTopicBySession,
        [sessionId]: activeTopicId,
      },
    }));
    return;
  }

  const items = (topics.items ?? []).map((topic) => normalizeTopicItem(topic, sessionId));

  useTopicStore.setState((s) => ({
    activeTopicBySession: {
      ...s.activeTopicBySession,
      [sessionId]: activeTopicId ?? s.activeTopicBySession[sessionId] ?? null,
    },
    topicsBySession: {
      ...s.topicsBySession,
      [sessionId]: items,
    },
  }));
};

const DEFAULT_TOPIC_TITLES = [
  '',
  'New Chat',
  'New Conversation',
  'New conversation',
  '新对话',
  '新對話',
  'Topics',
  '话题',
  '話題',
  'Untitled',
];

const isDefaultTopicTitle = (title?: string | null) => {
  const trimmedTitle = title?.trim() ?? '';
  if (!trimmedTitle) return true;

  const { t } = useI18n.getState();
  return (
    DEFAULT_TOPIC_TITLES.includes(trimmedTitle) ||
    trimmedTitle === t.topicTitle ||
    trimmedTitle === t.chatListNewConversation
  );
};

const DEFAULT_SESSION_TITLES = ['', 'New Conversation', 'New conversation', '新对话', '新對話'];

const isDefaultSessionTitle = (title?: string | null) => {
  const trimmedTitle = title?.trim() ?? '';
  if (!trimmedTitle) return true;

  const { t } = useI18n.getState();
  return (
    DEFAULT_SESSION_TITLES.includes(trimmedTitle) || trimmedTitle === t.chatListNewConversation
  );
};

const extractPersistedMessageIds = (messages: ChatMessage[]) =>
  messages
    .map((message) => message.id)
    .filter(
      (id) =>
        !id.startsWith('assistant-') &&
        !id.startsWith('local-') &&
        !id.startsWith('tmp_') &&
        !id.startsWith('user-'),
    );

const triggerTopicTitleGeneration = (sessionId: string, topicId?: string | null) => {
  if (!topicId) return;
  const topic = (useTopicStore.getState().topicsBySession[sessionId] ?? []).find(
    (item) => item.id === topicId,
  );

  if (!isDefaultTopicTitle(topic?.title)) return;

  topicApi
    .generateTitle(topicId)
    .then((newTitle) => {
      if (!newTitle) return;
      return useTopicStore.getState().fetchTopics(sessionId);
    })
    .then(() => {
      void useSessionStore.getState().fetchSessions();
    })
    .catch((error) => {
      console.warn('[ChatStore] generateTopicTitle failed:', error);
    });
};

const isGroupAssistantSettled = (message?: ChatMessage) => {
  if (!message) return false;
  if (message.error) return true;
  if (message.imageList?.length) return true;

  const content = message.content?.trim();
  if (!content || content === GROUP_LOADING_CONTENT) {
    return false;
  }

  return true;
};

const getGroupOperationErrorMessage = (
  operationStatus: Awaited<ReturnType<typeof aiAgentApi.getOperationStatus>>,
) => {
  const error = operationStatus?.currentState?.error;

  if (!error) return '';
  if (typeof error === 'string') return error;
  if (
    typeof error === 'object' &&
    error &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return '';
};

const syncGroupMessagesForSession = (
  sessionId: string,
  serverMessages: ChatMessage[] | undefined,
  placeholderMessages: ChatMessage[],
) => {
  if (!serverMessages?.length) return;

  const mergedMessages = mergePersistedMessagesWithLocal(serverMessages, placeholderMessages);

  useChatStore.setState((s) => ({
    messagesBySession: {
      ...s.messagesBySession,
      [sessionId]: mergedMessages,
    },
  }));
};

const buildUserStreamContent = (
  text: string,
  attachments: UploadedAttachment[],
): MobileChatMessage['content'] => {
  const imageAttachments = attachments.filter((f) => isImageAttachment(f.type));
  const nonImageAttachments = attachments.filter((f) => !isImageAttachment(f.type));

  const textBlocks: string[] = [];
  if (text) textBlocks.push(text);

  if (nonImageAttachments.length > 0) {
    const fileLines = nonImageAttachments.map(buildAttachmentContextLine);
    textBlocks.push(`Attached files:\n${fileLines.join('\n')}`);
  }

  const parts: Array<
    | {
        text: string;
        type: 'text';
      }
    | {
        image_url: {
          detail?: 'auto' | 'high' | 'low';
          url: string;
        };
        type: 'image_url';
      }
  > = [];
  if (textBlocks.length > 0) {
    parts.push({ text: textBlocks.join('\n\n'), type: 'text' });
  }

  for (const attachment of imageAttachments) {
    parts.push({
      image_url: { detail: 'auto', url: attachment.streamUrl || attachment.url },
      type: 'image_url',
    });
  }

  if (parts.length === 0) return '';
  if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
  return parts;
};

const toUploadedAttachment = (message: ChatMessage): UploadedAttachment[] => [
  ...(message.fileList || []).map((file) => ({
    content: file.content,
    fileId: file.id,
    name: file.name,
    type: file.fileType,
    url: file.url,
  })),
  ...(message.imageList || []).map((image) => ({
    fileId: image.id,
    name: image.alt || image.id,
    type: 'image/*',
    url: image.url,
  })),
];

const toToolCalls = (message: ChatMessage): MobileMessageToolCall[] | undefined => {
  if (!message.tools?.length) return undefined;

  return message.tools.map((tool) => ({
    function: {
      arguments: tool.arguments,
      name: tool.apiName || tool.identifier,
    },
    id: tool.id,
    ...(tool.thoughtSignature ? { thoughtSignature: tool.thoughtSignature } : {}),
    type: tool.type,
  }));
};

const buildContextMessage = (message: ChatMessage): MobileChatMessage | null => {
  if (message.role === 'user') {
    const attachments = toUploadedAttachment(message);

    return {
      content:
        attachments.length > 0
          ? buildUserStreamContent(message.content, attachments)
          : message.content,
      role: 'user',
    };
  }

  if (message.role === 'assistant') {
    return {
      content: message.content,
      ...(message.reasoning ? { reasoning: message.reasoning } : {}),
      role: 'assistant',
      ...(message.tools?.length ? { tool_calls: toToolCalls(message) } : {}),
    };
  }

  if (message.role === 'tool' && message.toolCallId) {
    return {
      content: message.content,
      role: 'tool',
      tool_call_id: message.toolCallId,
    };
  }

  return null;
};

const hasMessageAttachments = (message?: Pick<ChatMessage, 'fileList' | 'imageList'> | null) =>
  (message?.fileList?.length ?? 0) > 0 || (message?.imageList?.length ?? 0) > 0;

const mergePersistedMessageWithLocal = (
  persisted: ChatMessage,
  local?: ChatMessage,
): ChatMessage => {
  if (!local) return persisted;

  const shouldPreferLocalUserCaption =
    persisted.role === 'user' &&
    local.role === 'user' &&
    hasMessageAttachments(local) &&
    !!local.content?.trim();
  const shouldPreferLocalContent =
    shouldPreferLocalUserCaption || (!persisted.content && !!local.content);

  return {
    ...persisted,
    ...(shouldPreferLocalContent ? { content: local.content } : {}),
    ...(persisted.fileList?.length
      ? {
          fileList: persisted.fileList.map((file) => ({
            ...file,
            content:
              file.content ||
              local.fileList?.find((localFile) => localFile.id === file.id)?.content,
          })),
        }
      : local.fileList
        ? { fileList: local.fileList }
        : {}),
    ...(persisted.imageList?.length ? {} : local.imageList ? { imageList: local.imageList } : {}),
    ...(persisted.metadata ? {} : local.metadata ? { metadata: local.metadata } : {}),
    ...(persisted.reasoning ? {} : local.reasoning ? { reasoning: local.reasoning } : {}),
    ...(persisted.search ? {} : local.search ? { search: local.search } : {}),
    ...(persisted.tools ? {} : local.tools ? { tools: local.tools } : {}),
    ...(persisted.usage ? {} : local.usage ? { usage: local.usage } : {}),
    ...(persisted.performance ? {} : local.performance ? { performance: local.performance } : {}),
    ...(persisted.provider ? {} : local.provider ? { provider: local.provider } : {}),
    ...(persisted.model ? {} : local.model ? { model: local.model } : {}),
  };
};

const mergePersistedMessagesWithLocal = (
  persistedMessages: ChatMessage[],
  localMessages: ChatMessage[],
) => {
  const localById = new Map(localMessages.map((message) => [message.id, message]));

  return persistedMessages.map((message) =>
    mergePersistedMessageWithLocal(message, localById.get(message.id)),
  );
};

interface ChatState {
  /** AbortController for the current streaming request */
  abortController: AbortController | null;
  activeOperationId: string | null;
  activeStreamingMessageId: string | null;
  activeStreamingSessionId: string | null;
  clearMessages: (sessionId: string) => void;
  deleteMessage: (sessionId: string, messageId: string) => Promise<void>;
  /** Message currently being edited (id) */
  editingMessageId: string | null;
  editMessage: (sessionId: string, messageId: string, content: string) => Promise<void>;

  /** Session IDs currently fetching messages (for skeleton) */
  fetchingMessagesBySession: Record<string, boolean>;
  // Actions
  fetchMessages: (sessionId: string, topicId?: string) => Promise<void>;
  /** Whether a message is currently being generated */
  generating: boolean;
  /** Timestamp when generating started, for watchdog timeout */
  generatingStartedAt: number | null;
  /** Whether the model is currently in reasoning/thinking phase */
  isReasoning: boolean;
  /** Messages keyed by sessionId */
  messagesBySession: Record<string, ChatMessage[]>;
  /** Timestamp when reasoning started (for computing duration) */
  reasoningStartedAt: number | null;
  regenerateMessage: (sessionId: string, messageId: string) => Promise<void>;
  reset: () => void;
  sendMessage: (
    sessionId: string,
    content: string,
    topicId?: string,
    options?: {
      memoryEffort?: MobileMemoryEffort;
      memoryEnabled?: boolean;
      plugins?: string[];
      searchEnabled?: boolean;
    },
  ) => Promise<boolean>;
  setEditingMessage: (id: string | null) => void;
  /** Stop the current generation */
  stopGenerating: () => void;
  /** Streaming content buffer for the current generation */
  streamBuffer: string;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeOperationId: null,
  activeStreamingMessageId: null,
  activeStreamingSessionId: null,
  fetchingMessagesBySession: {},
  messagesBySession: {},
  generating: false,
  generatingStartedAt: null,
  isReasoning: false,
  reasoningStartedAt: null,
  streamBuffer: '',
  editingMessageId: null,
  abortController: null,

  reset: () => {
    get().abortController?.abort();
    set({
      activeOperationId: null,
      activeStreamingMessageId: null,
      activeStreamingSessionId: null,
      abortController: null,
      editingMessageId: null,
      fetchingMessagesBySession: {},
      generating: false,
      generatingStartedAt: null,
      isReasoning: false,
      messagesBySession: {},
      reasoningStartedAt: null,
      streamBuffer: '',
    });
  },

  stopGenerating: () => {
    const controller = get().abortController;
    const operationId = get().activeOperationId;
    if (controller) {
      controller.abort();
    }
    if (operationId) {
      void aiAgentApi.interruptTask({ operationId }).catch((error) => {
        console.warn('[ChatStore] Failed to interrupt group operation:', error);
      });
    }
    set({
      activeOperationId: null,
      activeStreamingMessageId: null,
      activeStreamingSessionId: null,
      abortController: null,
      generating: false,
      generatingStartedAt: null,
      isReasoning: false,
      reasoningStartedAt: null,
      streamBuffer: '',
    });
  },

  fetchMessages: async (sessionId: string, topicId?: string) => {
    set((s) => ({
      fetchingMessagesBySession: { ...s.fetchingMessagesBySession, [sessionId]: true },
    }));
    try {
      const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
      const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
      const messages = await messageApi.list(sessionId, topicId, { sessionType });
      const { activeStreamingMessageId, activeStreamingSessionId, generating, messagesBySession } =
        get();

      const shouldKeepLocalStreamingMessage =
        generating &&
        activeStreamingSessionId === sessionId &&
        !!activeStreamingMessageId &&
        !messages.some((message) => message.id === activeStreamingMessageId);

      const localStreamingMessage = shouldKeepLocalStreamingMessage
        ? (messagesBySession[sessionId] || []).find(
            (message) => message.id === activeStreamingMessageId,
          )
        : undefined;
      const mergedMessages = mergePersistedMessagesWithLocal(
        messages ?? [],
        messagesBySession[sessionId] || [],
      );

      set((s) => ({
        fetchingMessagesBySession: { ...s.fetchingMessagesBySession, [sessionId]: false },
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]:
            localStreamingMessage &&
            !mergedMessages.some((message) => message.id === localStreamingMessage.id)
              ? [...mergedMessages, localStreamingMessage]
              : mergedMessages,
        },
      }));
    } catch (err) {
      set((s) => ({
        fetchingMessagesBySession: { ...s.fetchingMessagesBySession, [sessionId]: false },
      }));
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
    }
  },

  sendMessage: async (
    sessionId: string,
    content: string,
    topicId?: string,
    options?: {
      memoryEffort?: MobileMemoryEffort;
      memoryEnabled?: boolean;
      plugins?: string[];
      searchEnabled?: boolean;
    },
  ) => {
    if (get().generating) return false;

    const textContent = content.trim();
    const fileState = useFileStore.getState();
    const attachments = fileState.pendingFiles.filter((f) => f.status !== 'error');
    if (attachments.some((f) => f.status === 'uploading')) {
      return false;
    }

    if (!textContent && attachments.length === 0) return false;

    const uploadedAttachments: UploadedAttachment[] = [];
    if (attachments.length > 0) {
      const uploaded = await Promise.all(
        attachments.map(async (file) => {
          const result = await useFileStore.getState().uploadFile(file.id, { sessionId });
          if (!result) return null;

          let streamUrl = result.url;
          if (isImageAttachment(file.type)) {
            const dataUri = await toBase64DataUri(file.uri, file.type);
            if (dataUri) streamUrl = dataUri;
          }

          return {
            fileId: result.fileId,
            name: file.name,
            streamUrl,
            type: file.type,
            url: result.url,
          } satisfies UploadedAttachment;
        }),
      );

      const successful = uploaded.filter(Boolean) as UploadedAttachment[];
      if (successful.length !== attachments.length) {
        const t = useI18n.getState().t;
        useToast.getState().show('error', t.errorSendFailed);
        return false;
      }
      uploadedAttachments.push(...successful);
      await hydrateAttachmentContents(uploadedAttachments);
    }

    const displayContent = textContent || buildAttachmentDisplayContent(uploadedAttachments);
    const attachedFileIds = uploadedAttachments.map((f) => f.fileId);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sessionId,
      role: 'user',
      content: displayContent,
      fileList: uploadedAttachments
        .filter((f) => !isImageAttachment(f.type))
        .map((f) => ({
          content: f.content,
          fileType: f.type,
          id: f.fileId,
          name: f.name,
          size: 0,
          url: f.url,
        })),
      imageList: uploadedAttachments
        .filter((f) => isImageAttachment(f.type))
        .map((f) => ({
          alt: f.name,
          id: f.fileId,
          url: f.url,
        })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);
    // When getGroupedSessions fails (e.g. tag_id), session may be undefined; fallback to group detail
    let isGroupSession = isGroupSessionLike(sessionId, session?.type);
    if (!isGroupSession && !session) {
      try {
        const groupDetail = await agentGroupApi.getGroupDetail(sessionId);
        isGroupSession = !!groupDetail?.supervisorAgentId;
      } catch {
        /* not a group */
      }
    }
    let resolvedTopicId =
      topicId ?? useTopicStore.getState().activeTopicBySession[sessionId] ?? undefined;
    const shouldCreateTopicAfterResponse = !isGroupSession && !resolvedTopicId;

    if (isGroupSession) {
      const assistantPlaceholderId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantPlaceholderId,
        sessionId,
        role: 'assistant',
        content: GROUP_LOADING_CONTENT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const abortController = new AbortController();
      set((s) => ({
        activeOperationId: null,
        activeStreamingMessageId: assistantPlaceholderId,
        activeStreamingSessionId: sessionId,
        abortController,
        generating: true,
        generatingStartedAt: Date.now(),
        isReasoning: false,
        reasoningStartedAt: null,
        streamBuffer: '',
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: [...(s.messagesBySession[sessionId] || []), userMsg, assistantMsg],
        },
      }));

      try {
        const t = useI18n.getState().t;
        const placeholderMessages = get().messagesBySession[sessionId] || [];
        const groupDetail = await agentGroupApi.getGroupDetail(sessionId);
        const supervisorAgentId = groupDetail?.supervisorAgentId;

        if (!supervisorAgentId) {
          throw new Error('Group supervisor not found');
        }

        const result = await aiAgentApi.execGroupAgent({
          agentId: supervisorAgentId,
          ...(attachedFileIds.length > 0 ? { files: attachedFileIds } : {}),
          groupId: sessionId,
          message: buildAttachmentPromptText(textContent, uploadedAttachments),
          topicId,
        });

        if (uploadedAttachments.length > 0) {
          useFileStore.getState().clearPending();
        }

        const resolvedTopicId = result.topicId ?? topicId ?? null;
        syncTopicsForSession(sessionId, result.topics, resolvedTopicId);
        syncGroupMessagesForSession(sessionId, result.messages, placeholderMessages);

        set((s) => ({
          activeOperationId: result.operationId ?? null,
          activeStreamingMessageId: result.assistantMessageId ?? assistantPlaceholderId,
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: s.messagesBySession[sessionId] || [],
          },
        }));

        if (abortController.signal.aborted) {
          if (result.operationId) {
            void aiAgentApi.interruptTask({ operationId: result.operationId }).catch((error) => {
              console.warn('[ChatStore] Failed to interrupt aborted group operation:', error);
            });
          }
          return true;
        }

        if (result.success === false) {
          throw new Error(result.error?.trim() || t.errorSendFailed);
        }

        if (!result.operationId) {
          throw new Error(result.error?.trim() || t.errorSendFailed);
        }

        let didSettle = false;

        for (let attempt = 0; attempt < GROUP_POLL_MAX_ATTEMPTS; attempt += 1) {
          await sleep(GROUP_POLL_INTERVAL_MS);
          if (abortController.signal.aborted) {
            return true;
          }

          const operationStatus = result.operationId
            ? await aiAgentApi
                .getOperationStatus({ operationId: result.operationId })
                .catch(() => null)
            : null;

          await get().fetchMessages(sessionId, resolvedTopicId ?? undefined);

          let assistantMessage = (get().messagesBySession[sessionId] || []).find(
            (message) => message.id === (result.assistantMessageId ?? assistantPlaceholderId),
          );

          if (isGroupAssistantSettled(assistantMessage)) {
            triggerTopicTitleGeneration(sessionId, resolvedTopicId);
            didSettle = true;
            break;
          }

          if (operationStatus?.hasError || operationStatus?.currentState?.status === 'error') {
            throw new Error(getGroupOperationErrorMessage(operationStatus) || t.errorSendFailed);
          }

          if (operationStatus?.isCompleted) {
            await sleep(250);
            await get().fetchMessages(sessionId, resolvedTopicId ?? undefined);

            assistantMessage = (get().messagesBySession[sessionId] || []).find(
              (message) => message.id === (result.assistantMessageId ?? assistantPlaceholderId),
            );

            if (isGroupAssistantSettled(assistantMessage)) {
              triggerTopicTitleGeneration(sessionId, resolvedTopicId);
              didSettle = true;
              break;
            }

            const assistantError =
              typeof assistantMessage?.error === 'string' ? assistantMessage.error : '';

            throw new Error(
              assistantError || getGroupOperationErrorMessage(operationStatus) || t.errorSendFailed,
            );
          }
        }

        if (!didSettle) {
          throw new Error(t.errorSendFailed);
        }

        return true;
      } catch (err) {
        if (abortController.signal.aborted) {
          return true;
        }

        console.warn('[ChatStore] group send error:', err);
        const t = useI18n.getState().t;
        const rawMessage = err instanceof Error ? err.message : '';
        const errorMessage = rawMessage || t.errorSendFailed;
        useToast.getState().show('error', errorMessage);

        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).filter(
              (message) => message.id !== assistantPlaceholderId,
            ),
          },
        }));

        return false;
      } finally {
        set({
          activeOperationId: null,
          activeStreamingMessageId: null,
          activeStreamingSessionId: null,
          abortController: null,
          generating: false,
          generatingStartedAt: null,
          isReasoning: false,
          reasoningStartedAt: null,
          streamBuffer: '',
        });
      }
    }

    // Optimistically add user message
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] || []), userMsg],
      },
    }));

    // Persist user message on backend
    let persistedMessagesAfterUser: ChatMessage[] | undefined;
    let userMessageServerId: string | undefined;
    try {
      const result = await messageApi.create({
        sessionId,
        content: displayContent,
        ...(attachedFileIds.length > 0 ? { files: attachedFileIds } : {}),
        role: 'user',
        topicId: resolvedTopicId,
      } as any);
      userMessageServerId = result?.id;
      persistedMessagesAfterUser = mergePersistedMessagesWithLocal(result?.messages ?? [], [
        ...(get().messagesBySession[sessionId] || []),
        userMsg,
      ]);

      if (persistedMessagesAfterUser?.length) {
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: persistedMessagesAfterUser!,
          },
        }));
      }
    } catch {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorSendFailed);
      return false;
    }

    const messagesForContext =
      persistedMessagesAfterUser && persistedMessagesAfterUser.length > 0
        ? persistedMessagesAfterUser
        : get().messagesBySession[sessionId] || [];
    const contextMessages = messagesForContext
      .map(buildContextMessage)
      .filter(Boolean) as MobileChatMessage[];

    // Ensure the latest user message uses freshly uploaded attachments.
    // This keeps local image data-URIs (when available) so model providers
    // don't need to fetch internal `/f/:id` URLs and trigger SSRF-safe fetch.
    if (uploadedAttachments.length > 0 && contextMessages.length > 0) {
      const lastIndex = contextMessages.length - 1;
      const lastCtx = contextMessages.at(-1);
      if (!lastCtx) return false;
      if (lastCtx.role === 'user') {
        const lastTextContent =
          typeof lastCtx.content === 'string' ? lastCtx.content : textContent || displayContent;
        const multimodalContent = buildUserStreamContent(lastTextContent, uploadedAttachments);
        contextMessages[lastIndex] = {
          ...lastCtx,
          content: multimodalContent,
        };
      }
    }

    // Create a placeholder for the assistant response
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      sessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const abortController = new AbortController();
    set((s) => ({
      activeStreamingMessageId: assistantMsgId,
      activeStreamingSessionId: sessionId,
      abortController,
      generating: true,
      generatingStartedAt: Date.now(),
      isReasoning: false,
      reasoningStartedAt: null,
      streamBuffer: '',
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [
          ...(persistedMessagesAfterUser || s.messagesBySession[sessionId] || []),
          assistantMsg,
        ],
      },
    }));
    if (uploadedAttachments.length > 0) {
      useFileStore.getState().clearPending();
    }

    // Stream AI response via XHR (RN fetch lacks ReadableStream support)
    try {
      const chatOptions = await getSessionChatOptions(sessionId);
      const provider = chatOptions.provider || 'openai';
      chatOptions.sessionId = sessionId;
      chatOptions.topicId = resolvedTopicId;

      // Set model/provider on the assistant message for immediate UI display
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId ? { ...m, model: chatOptions.model, provider } : m,
          ),
        },
      }));

      // Memory: prefer explicit options, else use session/agent chatConfig (for regenerateMessage etc.)
      chatOptions.memory = {
        effort: (options?.memoryEffort ?? chatOptions.memory?.effort) || 'medium',
        enabled:
          options?.memoryEnabled !== undefined
            ? options.memoryEnabled !== false
            : chatOptions.memory?.enabled !== false,
      };
      if (options?.searchEnabled !== undefined) {
        chatOptions.enabledSearch = options.searchEnabled;
      }
      if (options?.plugins?.length) {
        chatOptions.plugins = options.plugins;
      }

      // Throttle store updates to smooth streaming text rendering
      const THROTTLE_MS = 180;
      let pendingReasoning: StreamReasoningState | null = null;
      let pendingContent: StreamContentState | null = null;
      let throttleTimer: ReturnType<typeof setTimeout> | null = null;

      const flushPending = () => {
        throttleTimer = null;
        const reasoning = pendingReasoning;
        const contentState = pendingContent;
        pendingReasoning = null;
        pendingContent = null;

        if (reasoning !== null && contentState === null) {
          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                m.id === assistantMsgId ? { ...m, reasoning: buildReasoningState(reasoning) } : m,
              ),
            },
          }));
        } else if (contentState !== null) {
          const wasReasoning = get().isReasoning;
          if (wasReasoning) {
            const startedAt = get().reasoningStartedAt;
            const duration = startedAt ? Date.now() - startedAt : undefined;
            const finalReasoning = reasoning ?? undefined;
            set((s) => ({
              isReasoning: false,
              streamBuffer: contentState.content,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: contentState.content,
                        ...(mergeMessageMetadata(m.metadata, contentState)
                          ? { metadata: mergeMessageMetadata(m.metadata, contentState) }
                          : {}),
                        reasoning: finalReasoning
                          ? {
                              ...buildReasoningState(finalReasoning),
                              ...(duration !== undefined ? { duration } : {}),
                            }
                          : m.reasoning
                            ? { ...m.reasoning, ...(duration !== undefined ? { duration } : {}) }
                            : m.reasoning,
                      }
                    : m,
                ),
              },
            }));
          } else {
            set((s) => ({
              streamBuffer: contentState.content,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: contentState.content,
                        ...(mergeMessageMetadata(m.metadata, contentState)
                          ? { metadata: mergeMessageMetadata(m.metadata, contentState) }
                          : {}),
                        ...(reasoning ? { reasoning: buildReasoningState(reasoning) } : {}),
                      }
                    : m,
                ),
              },
            }));
          }
        }
      };

      const scheduleFlush = () => {
        if (!throttleTimer) {
          throttleTimer = setTimeout(flushPending, THROTTLE_MS);
        }
      };

      const result = await aiChatApi.createAssistantMessageStream(
        provider,
        contextMessages as any,
        chatOptions,
        {
          onImages: (images) => {
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, imageList: images } : m,
                ),
              },
            }));
          },
          onReasoning: (accReasoning) => {
            if (!get().reasoningStartedAt) {
              set({ isReasoning: true, reasoningStartedAt: Date.now() });
            }
            pendingReasoning = accReasoning;
            scheduleFlush();
          },
          onContent: (contentState) => {
            pendingContent = contentState;
            scheduleFlush();
          },
          onSearch: (search) => {
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, search } : m,
                ),
              },
            }));
          },
          onToolExecutions: (executions) => {
            const toolPayloads = toolExecutionsToPayloads(executions);
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, tools: toolPayloads } : m,
                ),
              },
            }));
          },
          onTools: (tools) => {
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, tools } : m,
                ),
              },
            }));
          },
        },
        abortController.signal,
      );

      // Flush any remaining pending updates
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      pendingContent = {
        content: result.text,
        ...result.contentMetadata,
      };
      flushPending();

      // Finalize reasoning duration if it was still reasoning when stream ended
      if (get().isReasoning) {
        const startedAt = get().reasoningStartedAt;
        const duration = startedAt ? Date.now() - startedAt : undefined;
        set((s) => ({
          isReasoning: false,
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId && m.reasoning
                ? {
                    ...m,
                    content: result.text,
                    reasoning: {
                      ...m.reasoning,
                      ...(duration !== undefined ? { duration } : {}),
                    },
                  }
                : m,
            ),
          },
        }));
      }

      const resolvedTools =
        result.tools ||
        (result.toolExecutions ? toolExecutionsToPayloads(result.toolExecutions) : undefined);

      if (result.images || result.search || resolvedTools || result.usage || result.performance) {
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    ...(result.images ? { imageList: result.images } : {}),
                    ...(result.search ? { search: result.search } : {}),
                    ...(resolvedTools ? { tools: resolvedTools } : {}),
                    ...(result.usage ? { usage: result.usage as any } : {}),
                    ...(result.performance ? { performance: result.performance as any } : {}),
                    ...(mergeMessageMetadata(m.metadata, result.contentMetadata)
                      ? { metadata: mergeMessageMetadata(m.metadata, result.contentMetadata) }
                      : {}),
                    provider,
                  }
                : m,
            ),
          },
        }));
      }

      // Persist assistant message to backend (including reasoning if present)
      const localMsg = (get().messagesBySession[sessionId] || []).find(
        (m) => m.id === assistantMsgId,
      );
      try {
        const persistedAssistant = await messageApi.create({
          sessionId,
          content: result.text,
          role: 'assistant',
          model: chatOptions.model,
          ...(result.images ? { imageList: result.images } : {}),
          metadata: buildAssistantMessageMetadata(
            result.performance,
            result.usage,
            localMsg?.metadata,
          ),
          ...(result.search ? { search: result.search } : {}),
          ...(resolvedTools ? { tools: resolvedTools } : {}),
          provider,
          parentId: userMessageServerId,
          topicId: resolvedTopicId,
          reasoning: buildPersistedReasoning(localMsg?.reasoning),
        });

        if (persistedAssistant?.messages?.length) {
          const localMessages = get().messagesBySession[sessionId] || [];
          const mergedPersistedMessages = mergePersistedMessagesWithLocal(
            persistedAssistant.messages,
            localMessages,
          );

          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: mergedPersistedMessages,
            },
          }));

          // Fire-and-forget: generate session title if still default
          const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
          if (session && isDefaultSessionTitle(session.title)) {
            sessionApi
              .generateTitle(sessionId)
              .then((newTitle) => {
                if (newTitle) {
                  useSessionStore.getState().updateSessionTitle(sessionId, newTitle);
                  useSessionStore.getState().fetchSessions();
                }
              })
              .catch((err) => {
                console.warn('[ChatStore] generateSessionTitle failed:', err);
                useToast.getState().show('error', useI18n.getState().t.errorUnknown);
              });
          }

          if (shouldCreateTopicAfterResponse && !resolvedTopicId) {
            const createdTopic = await useTopicStore.getState().createTopic(sessionId, '', {
              messageIds: extractPersistedMessageIds(mergedPersistedMessages),
            });

            if (createdTopic?.id) {
              resolvedTopicId = createdTopic.id;
              useTopicStore.getState().switchTopic(sessionId, createdTopic.id);
              await useTopicStore.getState().fetchTopics(sessionId);
              await get().fetchMessages(sessionId, createdTopic.id);
            }
          }

          triggerTopicTitleGeneration(sessionId, resolvedTopicId);
        }
      } catch (err) {
        console.warn('[ChatStore] Failed to persist assistant message:', err);
      }
    } catch (err) {
      if (abortController.signal.aborted) return true;
      console.warn('[ChatStore] AI streaming error:', err);
      const t = useI18n.getState().t;
      const rawMessage = err instanceof Error ? err.message : '';
      const errorMessage = rawMessage || t.errorNetwork;
      useToast.getState().show('error', errorMessage);
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  error: {
                    body: err instanceof Error ? err.stack : undefined,
                    message: errorMessage,
                    type: 'StreamError',
                  },
                }
              : m,
          ),
        },
      }));
    } finally {
      set({
        activeOperationId: null,
        activeStreamingMessageId: null,
        activeStreamingSessionId: null,
        abortController: null,
        generating: false,
        generatingStartedAt: null,
        isReasoning: false,
        reasoningStartedAt: null,
        streamBuffer: '',
      });
    }
    return true;
  },

  clearMessages: (sessionId: string) => {
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [],
      },
    }));
  },

  deleteMessage: async (sessionId: string, messageId: string) => {
    if (get().activeStreamingMessageId === messageId) {
      get().stopGenerating();
    }

    // Optimistic removal
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: (s.messagesBySession[sessionId] || []).filter((m) => m.id !== messageId),
      },
    }));
    try {
      await messageApi.remove(messageId);
    } catch {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorDeleteFailed);
      await get().fetchMessages(sessionId);
    }
  },

  editMessage: async (sessionId: string, messageId: string, content: string) => {
    // Optimistic update
    set((s) => ({
      editingMessageId: null,
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
          m.id === messageId ? { ...m, content } : m,
        ),
      },
    }));
    try {
      await messageApi.update(messageId, content);
    } catch {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorEditFailed);
      await get().fetchMessages(sessionId);
    }
  },

  regenerateMessage: async (sessionId: string, messageId: string) => {
    if (get().generating) return;

    const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);
    if (isGroupSessionLike(sessionId, session?.type)) {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorUnknown);
      return;
    }

    const messages = get().messagesBySession[sessionId] || [];
    const targetIdx = messages.findIndex((m) => m.id === messageId);
    if (targetIdx < 0) return;

    const target = messages[targetIdx];
    const topicId = useTopicStore.getState().activeTopicBySession[sessionId] ?? undefined;

    // If it's an assistant message, remove it and resend from previous user message
    // If it's a user message, remove subsequent assistant and regenerate
    let contextMessages: MobileChatMessage[];
    if (target.role === 'assistant') {
      // Remove this assistant message
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).filter((m) => m.id !== messageId),
        },
      }));
      void messageApi.remove(messageId).catch((error) => {
        console.warn('[ChatStore] Failed to remove assistant during regeneration:', error);
      });
      contextMessages = messages
        .slice(0, targetIdx)
        .map(buildContextMessage)
        .filter(Boolean) as MobileChatMessage[];
    } else {
      // User message: remove all after it, then regenerate
      const afterIds = messages.slice(targetIdx + 1).map((m) => m.id);
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).filter(
            (m) => !afterIds.includes(m.id),
          ),
        },
      }));
      if (afterIds.length > 0) {
        void messageApi.removeAll(afterIds).catch((error) => {
          console.warn(
            '[ChatStore] Failed to remove trailing messages during regeneration:',
            error,
          );
        });
      }
      contextMessages = messages
        .slice(0, targetIdx + 1)
        .map(buildContextMessage)
        .filter(Boolean) as MobileChatMessage[];
    }

    // Create a new assistant placeholder and stream
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      sessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const abortController = new AbortController();
    set((s) => ({
      activeStreamingMessageId: assistantMsgId,
      activeStreamingSessionId: sessionId,
      abortController,
      generating: true,
      generatingStartedAt: Date.now(),
      isReasoning: false,
      reasoningStartedAt: null,
      streamBuffer: '',
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] || []), assistantMsg],
      },
    }));

    const parentMessageId = target.role === 'assistant' ? messages[targetIdx - 1]?.id : target.id;

    try {
      const chatOptions = await getSessionChatOptions(sessionId);
      const provider = chatOptions.provider || 'openai';
      chatOptions.sessionId = sessionId;
      chatOptions.topicId = topicId;
      // memory/searchMode come from getSessionChatOptions (agent/session chatConfig)
      // When undefined, backend resolveEffectiveMemoryPayload falls back to agent config

      // Set model/provider on the assistant message for immediate display
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId ? { ...m, model: chatOptions.model, provider } : m,
          ),
        },
      }));

      const THROTTLE_MS = 100;
      let pendingReasoning: StreamReasoningState | null = null;
      let pendingContent: StreamContentState | null = null;
      let throttleTimer: ReturnType<typeof setTimeout> | null = null;

      const flushPending = () => {
        throttleTimer = null;
        const reasoning = pendingReasoning;
        const contentState = pendingContent;
        pendingReasoning = null;
        pendingContent = null;

        if (reasoning !== null && contentState === null) {
          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                m.id === assistantMsgId ? { ...m, reasoning: buildReasoningState(reasoning) } : m,
              ),
            },
          }));
        } else if (contentState !== null) {
          const wasReasoning = get().isReasoning;
          if (wasReasoning) {
            const startedAt = get().reasoningStartedAt;
            const duration = startedAt ? Date.now() - startedAt : undefined;
            const finalReasoning = reasoning ?? undefined;
            set((s) => ({
              isReasoning: false,
              streamBuffer: contentState.content,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: contentState.content,
                        ...(mergeMessageMetadata(m.metadata, contentState)
                          ? { metadata: mergeMessageMetadata(m.metadata, contentState) }
                          : {}),
                        reasoning: finalReasoning
                          ? {
                              ...buildReasoningState(finalReasoning),
                              ...(duration !== undefined ? { duration } : {}),
                            }
                          : m.reasoning
                            ? { ...m.reasoning, ...(duration !== undefined ? { duration } : {}) }
                            : m.reasoning,
                      }
                    : m,
                ),
              },
            }));
          } else {
            set((s) => ({
              streamBuffer: contentState.content,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: contentState.content,
                        ...(mergeMessageMetadata(m.metadata, contentState)
                          ? { metadata: mergeMessageMetadata(m.metadata, contentState) }
                          : {}),
                        ...(reasoning ? { reasoning: buildReasoningState(reasoning) } : {}),
                      }
                    : m,
                ),
              },
            }));
          }
        }
      };

      const scheduleFlush = () => {
        if (!throttleTimer) {
          throttleTimer = setTimeout(flushPending, THROTTLE_MS);
        }
      };

      const result = await aiChatApi.createAssistantMessageStream(
        provider,
        contextMessages,
        chatOptions,
        {
          onImages: (images) => {
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, imageList: images } : m,
                ),
              },
            }));
          },
          onReasoning: (accReasoning) => {
            if (!get().reasoningStartedAt) {
              set({ isReasoning: true, reasoningStartedAt: Date.now() });
            }
            pendingReasoning = accReasoning;
            scheduleFlush();
          },
          onContent: (contentState) => {
            pendingContent = contentState;
            scheduleFlush();
          },
          onSearch: (search) => {
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, search } : m,
                ),
              },
            }));
          },
          onToolExecutions: (executions) => {
            const toolPayloads = toolExecutionsToPayloads(executions);
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, tools: toolPayloads } : m,
                ),
              },
            }));
          },
          onTools: (tools) => {
            set((s) => ({
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, tools } : m,
                ),
              },
            }));
          },
        },
        abortController.signal,
      );

      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      pendingContent = {
        content: result.text,
        ...result.contentMetadata,
      };
      flushPending();

      if (get().isReasoning) {
        const startedAt = get().reasoningStartedAt;
        const duration = startedAt ? Date.now() - startedAt : undefined;
        set((s) => ({
          isReasoning: false,
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId && m.reasoning
                ? {
                    ...m,
                    content: result.text,
                    reasoning: {
                      ...m.reasoning,
                      ...(duration !== undefined ? { duration } : {}),
                    },
                  }
                : m,
            ),
          },
        }));
      }

      const resolvedToolsRegen =
        result.tools ||
        (result.toolExecutions ? toolExecutionsToPayloads(result.toolExecutions) : undefined);

      if (
        result.images ||
        result.search ||
        resolvedToolsRegen ||
        result.usage ||
        result.performance
      ) {
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    ...(result.images ? { imageList: result.images } : {}),
                    ...(result.search ? { search: result.search } : {}),
                    ...(resolvedToolsRegen ? { tools: resolvedToolsRegen } : {}),
                    ...(result.usage ? { usage: result.usage as any } : {}),
                    ...(result.performance ? { performance: result.performance as any } : {}),
                    ...(mergeMessageMetadata(m.metadata, result.contentMetadata)
                      ? { metadata: mergeMessageMetadata(m.metadata, result.contentMetadata) }
                      : {}),
                    provider,
                  }
                : m,
            ),
          },
        }));
      }

      // Persist assistant message to backend (including reasoning if present)
      const localMsg = (get().messagesBySession[sessionId] || []).find(
        (m) => m.id === assistantMsgId,
      );
      try {
        const persistedAssistant = await messageApi.create({
          sessionId,
          content: result.text,
          ...(result.images ? { imageList: result.images } : {}),
          role: 'assistant',
          model: chatOptions.model,
          metadata: buildAssistantMessageMetadata(
            result.performance,
            result.usage,
            localMsg?.metadata,
          ),
          ...(result.search ? { search: result.search } : {}),
          provider,
          ...(resolvedToolsRegen ? { tools: resolvedToolsRegen } : {}),
          parentId: parentMessageId,
          topicId,
          reasoning: buildPersistedReasoning(localMsg?.reasoning),
        });

        if (persistedAssistant?.messages?.length) {
          const localMessages = get().messagesBySession[sessionId] || [];
          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: mergePersistedMessagesWithLocal(
                persistedAssistant.messages,
                localMessages,
              ),
            },
          }));
        }
      } catch (err) {
        console.warn('[ChatStore] Failed to persist regenerated assistant message:', err);
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      console.warn('[ChatStore] regenerate streaming error:', err);
      const t = useI18n.getState().t;
      const rawMessage = err instanceof Error ? err.message : '';
      const errorMessage = rawMessage || t.errorNetwork;
      useToast.getState().show('error', errorMessage);
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  error: {
                    body: err instanceof Error ? err.stack : undefined,
                    message: errorMessage,
                    type: 'StreamError',
                  },
                }
              : m,
          ),
        },
      }));
    } finally {
      set({
        activeOperationId: null,
        activeStreamingMessageId: null,
        activeStreamingSessionId: null,
        abortController: null,
        generating: false,
        generatingStartedAt: null,
        isReasoning: false,
        reasoningStartedAt: null,
        streamBuffer: '',
      });
    }
  },

  setEditingMessage: (id: string | null) => {
    set({ editingMessageId: id });
  },
}));

// Re-export types for backward compat
export type { ChatMessage } from '../types';

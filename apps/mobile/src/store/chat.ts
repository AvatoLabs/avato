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
  const currentActiveTopic = useTopicStore.getState().activeTopicBySession[sessionId] ?? null;
  const nextActiveTopic =
    activeTopicId ?? currentActiveTopic ?? (items.length > 0 ? items[0].id : null);

  useTopicStore.setState((s) => ({
    activeTopicBySession: {
      ...s.activeTopicBySession,
      [sessionId]: nextActiveTopic,
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
    DEFAULT_SESSION_TITLES.includes(trimmedTitle) ||
    trimmedTitle === t.chatListNewConversation ||
    trimmedTitle === t.chatListCreateGroup ||
    trimmedTitle === t.groupCreateDefaultTitle
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

const buildMessageContainerParams = (
  sessionId: string,
  sessionType: 'agent' | 'group',
) =>
  sessionType === 'group'
    ? {
        groupId: sessionId,
        sessionId: null,
      }
    : { sessionId };

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

const isGroupAssistantSettled = (message?: ChatMessage): boolean => {
  if (!message) return false;
  if (message.role === 'compareGroup') {
    return message.children?.some((child) => isGroupAssistantSettled(child)) ?? false;
  }
  if (message.role === 'compressedGroup') {
    const compressedContent = message.content?.trim();
    return !!compressedContent && compressedContent !== GROUP_LOADING_CONTENT;
  }
  if (message.error) return true;
  if (message.imageList?.length) return true;
  if (message.tools?.length) return true;
  if (message.reasoning?.content?.trim()) return true;

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

type RuntimeAssistantSnapshot = NonNullable<
  NonNullable<Awaited<ReturnType<typeof aiAgentApi.getOperationStatus>>>['latestAssistant']
>;

const toRuntimeGroupToolPayloads = (
  toolCalls?: RuntimeAssistantSnapshot['toolCalls'],
): ChatToolPayload[] | undefined => {
  if (!toolCalls?.length) return undefined;

  const payloads = toolCalls
    .map((toolCall: NonNullable<RuntimeAssistantSnapshot['toolCalls']>[number], index: number) => {
      const apiName = toolCall.function?.name?.trim();
      if (!apiName) return null;

      return {
        apiName,
        arguments: toolCall.function?.arguments || '{}',
        id: toolCall.id || `runtime-tool-${Date.now()}-${index}`,
        identifier: apiName,
        type: toolCall.type || 'function',
      } satisfies ChatToolPayload;
    })
    .filter(Boolean) as ChatToolPayload[];

  return payloads.length > 0 ? payloads : undefined;
};

const applyGroupRuntimeAssistantFallback = (
  sessionId: string,
  assistantMessageId: string,
  operationStatus: Awaited<ReturnType<typeof aiAgentApi.getOperationStatus>>,
) => {
  const runtimeAssistant = operationStatus?.latestAssistant;

  const content = runtimeAssistant?.content?.trim() || '';
  const reasoning = runtimeAssistant?.reasoning?.trim() || '';
  const tools = toRuntimeGroupToolPayloads(runtimeAssistant?.toolCalls);
  const hasUsableRuntimeAssistant = !!content || !!reasoning || !!tools?.length;

  if (!hasUsableRuntimeAssistant) return;

  useChatStore.setState((state) => {
    const currentMessages = state.messagesBySession[sessionId] || [];
    const assistantIndex = currentMessages.findIndex((message) => message.id === assistantMessageId);

    const buildUpdatedAssistant = (message?: ChatMessage): ChatMessage => ({
      ...(message ?? {
        content: '',
        createdAt: new Date().toISOString(),
        id: assistantMessageId,
        role: 'assistant' as const,
        sessionId,
      }),
      ...(content ? { content } : message?.content === GROUP_LOADING_CONTENT ? { content: '' } : {}),
      ...(reasoning ? { reasoning: { content: reasoning } } : {}),
      ...(tools?.length ? { tools } : {}),
      updatedAt: new Date().toISOString(),
    });

    const nextMessages =
      assistantIndex >= 0
        ? currentMessages.map((message, index) =>
            index === assistantIndex ? buildUpdatedAssistant(message) : message,
          )
        : [...currentMessages, buildUpdatedAssistant()];

    return {
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: nextMessages,
      },
    };
  });
};

const findSettledGroupAssistant = (
  messages: ChatMessage[],
  preferredAssistantId?: string,
): ChatMessage | undefined => {
  if (preferredAssistantId) {
    for (const message of messages) {
      if (message.id === preferredAssistantId && isGroupAssistantSettled(message)) {
        return message;
      }

      if (
        message.role === 'compareGroup' &&
        message.children?.some(
          (child) => child.id === preferredAssistantId && isGroupAssistantSettled(child),
        )
      ) {
        return message;
      }
    }
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      (message.role === 'assistant' ||
        message.role === 'compareGroup' ||
        message.role === 'compressedGroup') &&
      isGroupAssistantSettled(message)
    ) {
      return message;
    }
  }

  return undefined;
};

const findGroupAssistantCandidate = (
  messages: ChatMessage[],
  preferredAssistantId?: string,
): ChatMessage | undefined => {
  if (preferredAssistantId) {
    const directMatch = messages.find((message) => message.id === preferredAssistantId);
    if (directMatch) return directMatch;

    const compareGroupParent = messages.find(
      (message) =>
        message.role === 'compareGroup' &&
        message.children?.some((child) => child.id === preferredAssistantId),
    );
    if (compareGroupParent) return compareGroupParent;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message.role === 'assistant' ||
      message.role === 'compareGroup' ||
      message.role === 'compressedGroup'
    ) {
      return message;
    }
  }

  return undefined;
};

const pruneGroupLoadingPlaceholder = (
  sessionId: string,
  placeholderAssistantId: string,
  settledAssistantId?: string,
) => {
  if (!settledAssistantId || settledAssistantId === placeholderAssistantId) return;

  useChatStore.setState((state) => {
    const currentMessages = state.messagesBySession[sessionId] || [];
    const placeholderMessage = currentMessages.find(
      (message) => message.id === placeholderAssistantId,
    );

    if (!placeholderMessage || isGroupAssistantSettled(placeholderMessage)) {
      return state;
    }

    if (placeholderMessage.content?.trim() !== GROUP_LOADING_CONTENT) {
      return state;
    }

    return {
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: currentMessages.filter((message) => message.id !== placeholderAssistantId),
      },
    };
  });
};

const rebindGroupPlaceholderMessages = (
  sessionId: string,
  placeholderUserId: string,
  placeholderAssistantId: string,
  ids: {
    assistantMessageId?: string;
    userMessageId?: string;
  },
) => {
  useChatStore.setState((s) => {
    const currentMessages = s.messagesBySession[sessionId] || [];

    return {
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: currentMessages.map((message) => {
          if (message.id === placeholderUserId && ids.userMessageId) {
            return {
              ...message,
              id: ids.userMessageId,
            };
          }

          if (message.id === placeholderAssistantId && ids.assistantMessageId) {
            return {
              ...message,
              id: ids.assistantMessageId,
            };
          }

          return message;
        }),
      },
    };
  });
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
  const shouldPreferLocalAssistantContent =
    persisted.role === 'assistant' &&
    local.role === 'assistant' &&
    persisted.content?.trim() === GROUP_LOADING_CONTENT &&
    !!local.content?.trim() &&
    local.content.trim() !== GROUP_LOADING_CONTENT;
  const shouldPreferLocalContent =
    shouldPreferLocalUserCaption ||
    shouldPreferLocalAssistantContent ||
    (!persisted.content && !!local.content);

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
  fetchMessages: (
    sessionId: string,
    topicId?: string,
    options?: { preserveOnEmpty?: boolean },
  ) => Promise<void>;
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

  fetchMessages: async (
    sessionId: string,
    topicId?: string,
    options?: { preserveOnEmpty?: boolean },
  ) => {
    set((s) => ({
      fetchingMessagesBySession: { ...s.fetchingMessagesBySession, [sessionId]: true },
    }));
    try {
      const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
      const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
      let effectiveTopicId = topicId;
      let messages =
        sessionType === 'group'
          ? await aiAgentApi.getGroupMessages({ groupId: sessionId, topicId: effectiveTopicId })
          : await messageApi.list(sessionId, effectiveTopicId, { sessionType });

      if (!effectiveTopicId && (!messages || messages.length === 0)) {
        const knownTopics = useTopicStore.getState().topicsBySession[sessionId] ?? [];
        let fallbackTopics = knownTopics;

        if (fallbackTopics.length === 0) {
          fallbackTopics = await topicApi.list(sessionId, { sessionType }).catch(() => []);
          if (fallbackTopics.length > 0) {
            useTopicStore.setState((s) => ({
              topicsBySession: {
                ...s.topicsBySession,
                [sessionId]: fallbackTopics,
              },
            }));
          }
        }

        const fallbackTopicId = fallbackTopics[0]?.id;
        if (fallbackTopicId) {
          effectiveTopicId = fallbackTopicId;
          useTopicStore.getState().switchTopic(sessionId, fallbackTopicId);
          messages =
            sessionType === 'group'
              ? await aiAgentApi.getGroupMessages({
                  groupId: sessionId,
                  topicId: fallbackTopicId,
                })
              : await messageApi.list(sessionId, fallbackTopicId, { sessionType });
        }
      }
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

      const existingCount = (messagesBySession[sessionId] || []).length;
      const preserveOnEmpty =
        options?.preserveOnEmpty &&
        (messages ?? []).length === 0 &&
        mergedMessages.length === 0 &&
        existingCount > 0;

      const finalMessages =
        preserveOnEmpty ? (messagesBySession[sessionId] || []) : mergedMessages;
      const finalWithLocal =
        localStreamingMessage &&
        !finalMessages.some((message) => message.id === localStreamingMessage.id)
          ? [...finalMessages, localStreamingMessage]
          : finalMessages;

      set((s) => ({
        fetchingMessagesBySession: { ...s.fetchingMessagesBySession, [sessionId]: false },
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: finalWithLocal,
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
    const sessionType = isGroupSession ? 'group' : 'agent';
    const messageContainerParams = buildMessageContainerParams(sessionId, sessionType);

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
        if (result.messages?.length) {
          syncGroupMessagesForSession(sessionId, result.messages, placeholderMessages);
        } else {
          rebindGroupPlaceholderMessages(sessionId, userMsg.id, assistantPlaceholderId, {
            assistantMessageId: result.assistantMessageId,
            userMessageId: result.userMessageId,
          });
        }

        // Web uses SSE for real-time updates; mobile polls. If initial result.messages is empty
        // (backend timing), fetch immediately via aiChat.getMessagesAndTopics (same as execGroupAgent).
        const hasAssistantInResult = result.messages?.some(
          (m: ChatMessage) => m.id === (result.assistantMessageId ?? assistantPlaceholderId),
        );
        if (!hasAssistantInResult && result.assistantMessageId) {
          await sleep(300);
          try {
            const groupMessages = await aiAgentApi.getGroupMessages({
              groupId: sessionId,
              topicId: resolvedTopicId ?? undefined,
            });
            if (groupMessages?.length > 0) {
              const placeholder = get().messagesBySession[sessionId] || [];
              const merged = mergePersistedMessagesWithLocal(groupMessages, placeholder);
              set((s) => ({
                messagesBySession: {
                  ...s.messagesBySession,
                  [sessionId]: merged,
                },
              }));
            }
          } catch {
            await get().fetchMessages(sessionId, resolvedTopicId ?? undefined, {
              preserveOnEmpty: true,
            });
          }
        }

        set({
          activeOperationId: result.operationId ?? null,
          activeStreamingMessageId: result.assistantMessageId ?? assistantPlaceholderId,
        });

        if (abortController.signal.aborted) {
          if (result.operationId) {
            void aiAgentApi.interruptTask({ operationId: result.operationId }).catch((error) => {
              console.warn('[ChatStore] Failed to interrupt aborted group operation:', error);
            });
          }
          return true;
        }

        if (result.success === false) {
          const errMsg = result.error?.trim() || t.errorSendFailed;
          console.warn('[ChatStore] execGroupAgent failed:', { error: result.error, success: result.success });
          throw new Error(errMsg);
        }

        if (!result.operationId) {
          const errMsg = result.error?.trim() || t.errorSendFailed;
          console.warn('[ChatStore] execGroupAgent no operationId:', { result });
          throw new Error(errMsg);
        }

        let didSettle = false;
        let completionObserved = false;

        for (let attempt = 0; attempt < GROUP_POLL_MAX_ATTEMPTS; attempt += 1) {
          await sleep(GROUP_POLL_INTERVAL_MS);
          if (abortController.signal.aborted) {
            return true;
          }

          const operationStatus = result.operationId
            ? await aiAgentApi
                .getOperationStatus({
                  historyLimit: 10,
                  includeHistory: true,
                  operationId: result.operationId,
                })
                .catch(() => null)
            : null;

          if (operationStatus?.latestAssistant && result.assistantMessageId) {
            applyGroupRuntimeAssistantFallback(
              sessionId,
              result.assistantMessageId,
              operationStatus,
            );
          }

          // Use aiChat.getMessagesAndTopics (same as execGroupAgent) for consistency with web
          try {
            const groupMessages = await aiAgentApi.getGroupMessages({
              groupId: sessionId,
              topicId: resolvedTopicId ?? undefined,
            });
            if (groupMessages?.length > 0) {
              const local = get().messagesBySession[sessionId] || [];
              const merged = mergePersistedMessagesWithLocal(groupMessages, local);
              set((s) => ({
                messagesBySession: {
                  ...s.messagesBySession,
                  [sessionId]: merged,
                },
              }));
            } else {
              await get().fetchMessages(sessionId, resolvedTopicId ?? undefined, {
                preserveOnEmpty: true,
              });
            }
          } catch {
            await get().fetchMessages(sessionId, resolvedTopicId ?? undefined, {
              preserveOnEmpty: true,
            });
          }

          const currentMessages = get().messagesBySession[sessionId] || [];
          const settledAssistant = findSettledGroupAssistant(
            currentMessages,
            result.assistantMessageId ?? assistantPlaceholderId,
          );
          let assistantMessage =
            settledAssistant ||
            currentMessages.find(
              (message) => message.id === (result.assistantMessageId ?? assistantPlaceholderId),
            );

          if (settledAssistant) {
            pruneGroupLoadingPlaceholder(
              sessionId,
              result.assistantMessageId ?? assistantPlaceholderId,
              settledAssistant.id,
            );
            triggerTopicTitleGeneration(sessionId, resolvedTopicId);
            const sess = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
            if (sess && isDefaultSessionTitle(sess.title)) {
              sessionApi
                .generateTitle(sessionId)
                .then((newTitle) => {
                  if (newTitle) {
                    useSessionStore.getState().updateSessionTitle(sessionId, newTitle);
                    useSessionStore.getState().fetchSessions();
                  }
                })
                .catch((err) => {
                  console.warn('[ChatStore] generateSessionTitle (group) failed:', err);
                });
            }
            didSettle = true;
            break;
          }

          if (operationStatus?.hasError || operationStatus?.currentState?.status === 'error') {
            const errMsg = getGroupOperationErrorMessage(operationStatus) || t.errorSendFailed;
            console.warn('[ChatStore] group operation error:', {
              hasError: operationStatus?.hasError,
              status: operationStatus?.currentState?.status,
              error: operationStatus?.currentState?.error,
            });
            throw new Error(errMsg);
          }

          if (operationStatus?.isCompleted) {
            completionObserved = true;
            const targetAssistantId = result.assistantMessageId ?? assistantPlaceholderId;
            const COMPLETED_FETCH_RETRIES = 5;
            const COMPLETED_FETCH_DELAY_MS = 600;
            // Give backend time to persist assistant message before first fetch
            await sleep(400);

            for (let fetchAttempt = 0; fetchAttempt <= COMPLETED_FETCH_RETRIES; fetchAttempt += 1) {
              if (fetchAttempt > 0) await sleep(COMPLETED_FETCH_DELAY_MS);
              // Use aiChat.getMessagesAndTopics (same as execGroupAgent) for consistency with web
              try {
                const groupMessages = await aiAgentApi.getGroupMessages({
                  groupId: sessionId,
                  topicId: resolvedTopicId ?? undefined,
                });
                if (groupMessages?.length > 0) {
                  const local = get().messagesBySession[sessionId] || [];
                  const merged = mergePersistedMessagesWithLocal(groupMessages, local);
                  set((s) => ({
                    messagesBySession: {
                      ...s.messagesBySession,
                      [sessionId]: merged,
                    },
                  }));
                } else {
                  await get().fetchMessages(sessionId, resolvedTopicId ?? undefined, {
                    preserveOnEmpty: true,
                  });
                }
              } catch {
                await get().fetchMessages(sessionId, resolvedTopicId ?? undefined, {
                  preserveOnEmpty: true,
                });
              }

              const iterationMessages = get().messagesBySession[sessionId] || [];
              let settledAssistant = findSettledGroupAssistant(
                iterationMessages,
                targetAssistantId,
              );
              assistantMessage =
                settledAssistant || findGroupAssistantCandidate(iterationMessages, targetAssistantId);

              if (!settledAssistant && operationStatus?.latestAssistant) {
                applyGroupRuntimeAssistantFallback(sessionId, targetAssistantId, operationStatus);
                const fallbackMessages = get().messagesBySession[sessionId] || [];
                settledAssistant = findSettledGroupAssistant(fallbackMessages, targetAssistantId);
                assistantMessage =
                  settledAssistant ||
                  fallbackMessages.find((message) => message.id === targetAssistantId);
              }

              if (settledAssistant) {
                pruneGroupLoadingPlaceholder(sessionId, targetAssistantId, settledAssistant.id);
                triggerTopicTitleGeneration(sessionId, resolvedTopicId);
                const sess = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
                if (sess && isDefaultSessionTitle(sess.title)) {
                  sessionApi
                    .generateTitle(sessionId)
                    .then((newTitle) => {
                      if (newTitle) {
                        useSessionStore.getState().updateSessionTitle(sessionId, newTitle);
                        useSessionStore.getState().fetchSessions();
                      }
                    })
                    .catch((err) => {
                      console.warn('[ChatStore] generateSessionTitle (group) failed:', err);
                    });
                }
                didSettle = true;
                break;
              }
            }

              if (!didSettle && resolvedTopicId) {
              // Fallback: try fetching without topicId (message might be in group root)
              await sleep(300);
              try {
                const groupMessages = await aiAgentApi.getGroupMessages({
                  groupId: sessionId,
                  topicId: undefined,
                });
                if (groupMessages?.length > 0) {
                  const local = get().messagesBySession[sessionId] || [];
                  const merged = mergePersistedMessagesWithLocal(groupMessages, local);
                  set((s) => ({
                    messagesBySession: {
                      ...s.messagesBySession,
                      [sessionId]: merged,
                    },
                  }));
                }
              } catch {
                await get().fetchMessages(sessionId, undefined, { preserveOnEmpty: true });
              }
              const fallbackMessages = get().messagesBySession[sessionId] || [];
              let settledAssistant = findSettledGroupAssistant(fallbackMessages, targetAssistantId);
              assistantMessage =
                settledAssistant || findGroupAssistantCandidate(fallbackMessages, targetAssistantId);
              if (!settledAssistant && operationStatus?.latestAssistant) {
                applyGroupRuntimeAssistantFallback(sessionId, targetAssistantId, operationStatus);
                const runtimeMessages = get().messagesBySession[sessionId] || [];
                settledAssistant = findSettledGroupAssistant(runtimeMessages, targetAssistantId);
                assistantMessage =
                  settledAssistant || runtimeMessages.find((m) => m.id === targetAssistantId);
              }
              if (settledAssistant) {
                pruneGroupLoadingPlaceholder(sessionId, targetAssistantId, settledAssistant.id);
                didSettle = true;
              }
            }

            if (!didSettle) {
              const assistantError =
                typeof assistantMessage?.error === 'string' ? assistantMessage.error : '';

              const errMsg = assistantError || getGroupOperationErrorMessage(operationStatus);
              console.warn('[ChatStore] group completed but assistant not settled:', {
                attempt,
                assistantMessageId: targetAssistantId,
                hasAssistant: !!assistantMessage,
                assistantContent: assistantMessage?.content?.slice(0, 50),
                assistantError: assistantMessage?.error,
                messageIds: (get().messagesBySession[sessionId] || []).map((m) => m.id),
              });

              if (!errMsg && completionObserved) {
                triggerTopicTitleGeneration(sessionId, resolvedTopicId);
                const sess = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
                if (sess && isDefaultSessionTitle(sess.title)) {
                  void sessionApi.generateTitle(sessionId).then((newTitle) => {
                    if (newTitle) {
                      useSessionStore.getState().updateSessionTitle(sessionId, newTitle);
                    }
                  });
                }

                setTimeout(() => {
                  void Promise.allSettled([
                    get().fetchMessages(sessionId, resolvedTopicId ?? undefined, {
                      preserveOnEmpty: true,
                    }),
                    useSessionStore.getState().fetchSessions(),
                  ]);
                }, 1200);

                setTimeout(() => {
                  void Promise.allSettled([
                    get().fetchMessages(sessionId, resolvedTopicId ?? undefined, {
                      preserveOnEmpty: true,
                    }),
                    useSessionStore.getState().fetchSessions(),
                  ]);
                }, 1500);

                didSettle = true;
                break;
              }
              if (errMsg) {
                throw new Error(errMsg);
              }

              continue;
            }
            if (didSettle) break;
          }
        }

        if (!didSettle) {
          console.warn('[ChatStore] group poll exhausted:', {
            attempts: GROUP_POLL_MAX_ATTEMPTS,
            completionObserved,
            assistantMessageId: result.assistantMessageId ?? assistantPlaceholderId,
          });
          throw new Error(t.errorSendFailed);
        }

        return true;
      } catch (err) {
        if (abortController.signal.aborted) {
          return true;
        }

        const rawMessage = err instanceof Error ? err.message : String(err);
        console.warn('[ChatStore] group send error:', rawMessage, err);
        const t = useI18n.getState().t;
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
        ...messageContainerParams,
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
          ...messageContainerParams,
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
    const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
    if (sessionType === 'group') {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorUnknown);
      return;
    }
    const messageContainerParams = buildMessageContainerParams(sessionId, sessionType);

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
          ...messageContainerParams,
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

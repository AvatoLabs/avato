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
  MobileChatMessage,
  MobileMessageToolCall,
  StreamContentState,
  StreamReasoningState,
  ToolExecutionItem,
} from '../lib/api';
import {
  agentGroupApi,
  aiAgentApi,
  aiChatApi,
  chatToolApi,
  fileApi,
  messageApi,
  topicApi,
} from '../lib/api';
import {
  buildDocContextDisplayText,
  buildDocContextPromptText,
  toDocSelections,
} from '../lib/chatContext';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import { navigateToLogin } from '../lib/navigation';
import { isRawFileResourceId } from '../lib/resourceList';
import { isGroupSessionLike, resolveSessionTypeWithFallback } from '../lib/session';
import { generateBestTitle } from '../lib/titleGeneration';
import type {
  ChatContextSelection,
  ChatMessage,
  ChatToolPayload,
  DocSelection,
  FileAttachment,
  MobileMemoryEffort,
  Topic,
} from '../types';
import {
  getSessionChatOptions,
  mergeResolvedToolPayloads,
  mergeToolPayloads,
  parseTargetIdFromMentions,
  resolveProviderByModel,
  toolExecutionsToPayloads,
} from './chatHelpers';
import { useFileStore } from './file';
import { useSessionStore } from './session';
import { useTopicStore } from './topic';

/** In-flight promises by sessionId:topicId for request deduplication */
const fetchMessagesInFlight = new Map<string, Promise<void>>();

const fetchMessagesKey = (sessionId: string, topicId?: string) =>
  `${sessionId}:${topicId ?? 'null'}`;

interface UploadedAttachment {
  content?: string;
  fileId: string;
  name: string;
  /** base64 data URI for streaming to LLM (avoids SSRF blocks) */
  streamUrl?: string;
  type: string;
  url: string;
}

export const buildAssistantMessageMetadata = (
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

export const mergeMessageMetadata = (
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

export const buildReasoningState = (
  reasoning: StreamReasoningState,
  duration?: number,
): NonNullable<ChatMessage['reasoning']> => ({
  ...(reasoning.content ? { content: reasoning.content } : {}),
  ...(duration !== undefined ? { duration } : {}),
  ...(reasoning.isMultimodal ? { isMultimodal: true } : {}),
  ...(reasoning.tempDisplayContent ? { tempDisplayContent: reasoning.tempDisplayContent } : {}),
});

export const buildPersistedReasoning = (
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

const getMessageDocSelections = (
  message?: Pick<ChatMessage, 'metadata'> | null,
): DocSelection[] => {
  const rawSelections = message?.metadata?.docSelections;
  if (!Array.isArray(rawSelections)) return [];

  return rawSelections.filter(
    (selection): selection is DocSelection =>
      !!selection &&
      typeof selection === 'object' &&
      typeof (selection as DocSelection).content === 'string' &&
      typeof (selection as DocSelection).docId === 'string' &&
      typeof (selection as DocSelection).id === 'string',
  );
};

const hasMessageDocSelections = (message?: Pick<ChatMessage, 'metadata'> | null) =>
  getMessageDocSelections(message).length > 0;

const buildDocContextSummarySection = (contexts: Array<ChatContextSelection | DocSelection>) => {
  if (contexts.length === 0) return '';

  return `Document context:\n${buildDocContextDisplayText(contexts)}`;
};

const buildDocContextPromptSection = (contexts: Array<ChatContextSelection | DocSelection>) => {
  if (contexts.length === 0) return '';

  return `Document context:\n${buildDocContextPromptText(contexts)}`;
};

const buildUserDisplayContent = (
  text: string,
  attachments: UploadedAttachment[],
  docContexts: ChatContextSelection[],
) => {
  const blocks: string[] = [];

  if (text) blocks.push(text);
  if (!text && docContexts.length > 0) {
    blocks.push(buildDocContextSummarySection(docContexts));
  }

  if (blocks.length === 0 && attachments.length > 0) {
    blocks.push(buildAttachmentDisplayContent(attachments));
  }

  return blocks.join('\n\n').trim();
};

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
const isAttachableFileId = (fileId?: string | null) => isRawFileResourceId(fileId);

const hydrateAttachmentContents = async (attachments: UploadedAttachment[]) => {
  const pendingFileIds = attachments
    .filter(
      (attachment) =>
        !isImageAttachment(attachment.type) &&
        !attachment.content?.trim() &&
        isAttachableFileId(attachment.fileId),
    )
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

const buildUserPromptText = (
  text: string,
  attachments: UploadedAttachment[],
  docContexts: Array<ChatContextSelection | DocSelection>,
) => {
  const textBlocks: string[] = [];
  const attachmentText = buildAttachmentPromptText(text, attachments).trim();
  const docContextText = buildDocContextPromptSection(docContexts);

  if (attachmentText) {
    textBlocks.push(attachmentText);
  }

  if (docContextText) {
    textBlocks.push(docContextText);
  }

  return textBlocks.join('\n\n').trim();
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

/** 占位话题标题（对话=Topic）。 */
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

const buildMessageContainerParams = (sessionId: string, sessionType: 'agent' | 'group') =>
  sessionType === 'group'
    ? {
        groupId: sessionId,
        sessionId: null,
      }
    : { sessionId };

const triggerTopicTitleGeneration = (sessionId: string, topicId?: string | null) => {
  if (!topicId) return;

  void generateBestTitle({ force: false, sessionId, topicId })
    .then(() => undefined)
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
    const compressedMessages = (message as any).compressedMessages as ChatMessage[] | undefined;
    const hasContent = !!compressedContent && compressedContent !== GROUP_LOADING_CONTENT;
    const hasSettledChildren =
      Array.isArray(compressedMessages) &&
      compressedMessages.some((m) => isGroupAssistantSettled(m));
    return hasContent || hasSettledChildren;
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

/** Recursively find message by id in flat list and nested children (compareGroup, etc.) */
const findMessageByIdInTree = (
  messages: ChatMessage[],
  targetId: string,
): ChatMessage | undefined => {
  for (const msg of messages) {
    if (msg.id === targetId) return msg;
    const children = (msg as any).children as ChatMessage[] | undefined;
    if (Array.isArray(children) && children.length > 0) {
      const found = findMessageByIdInTree(children, targetId);
      if (found) return found;
    }
  }
  return undefined;
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
    const assistantIndex = currentMessages.findIndex(
      (message) => message.id === assistantMessageId,
    );

    const buildUpdatedAssistant = (message?: ChatMessage): ChatMessage => ({
      ...(message ?? {
        content: '',
        createdAt: new Date().toISOString(),
        id: assistantMessageId,
        role: 'assistant' as const,
        sessionId,
      }),
      ...(content
        ? { content }
        : message?.content === GROUP_LOADING_CONTENT
          ? { content: '' }
          : {}),
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
    const direct = messages.find((m) => m.id === preferredAssistantId);
    if (direct && isGroupAssistantSettled(direct)) return direct;

    for (const message of messages) {
      if (message.role === 'compareGroup' && message.children?.length) {
        const found = findSettledGroupAssistant(message.children, preferredAssistantId);
        if (found) return found;
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

export const buildContextMessage = (message: ChatMessage): MobileChatMessage | null => {
  if (message.role === 'user') {
    const attachments = toUploadedAttachment(message);
    const docSelections = getMessageDocSelections(message);
    const promptText = buildUserPromptText(message.content, attachments, docSelections);

    return {
      content:
        attachments.length > 0 ? buildUserStreamContent(promptText, attachments) : promptText,
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
    (hasMessageAttachments(local) || hasMessageDocSelections(local)) &&
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

const findMessageIndexFromEnd = (messages: ChatMessage[], messageId: string) => {
  const lastIndex = messages.length - 1;
  if (lastIndex >= 0 && messages[lastIndex]?.id === messageId) return lastIndex;

  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.id === messageId) return index;
  }

  return -1;
};

const getSessionMessageById = (
  messagesBySession: Record<string, ChatMessage[]>,
  sessionId: string,
  messageId: string,
) => {
  const messages = messagesBySession[sessionId] || [];
  const index = findMessageIndexFromEnd(messages, messageId);
  return index >= 0 ? messages[index] : undefined;
};

const updateSessionMessageRecord = (
  messagesBySession: Record<string, ChatMessage[]>,
  sessionId: string,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
) => {
  const messages = messagesBySession[sessionId] || [];
  const index = findMessageIndexFromEnd(messages, messageId);

  if (index < 0) return messagesBySession;

  const current = messages[index]!;
  const next = updater(current);

  if (next === current) return messagesBySession;

  const nextMessages = messages.slice();
  nextMessages[index] = next;

  return { ...messagesBySession, [sessionId]: nextMessages };
};

interface ChatState {
  /** AbortController for the current streaming request */
  abortController: AbortController | null;
  activeOperationId: string | null;
  activeStreamingMessageId: string | null;
  activeStreamingSessionId: string | null;
  approveToolCall: (
    sessionId: string,
    messageId: string,
    topicId?: string,
    assistantGroupId?: string,
  ) => Promise<void>;
  clearMessages: (sessionId: string) => Promise<void>;
  /** Mobile: continue tool execution after approving a pending tool (webapi/chat/continue) */
  continueToolIntervention: (
    sessionId: string,
    topicId: string | undefined,
    assistantMessageId: string,
    approvedTool: ChatToolPayload,
  ) => Promise<void>;
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
    options?: { preferPopulatedTopic?: boolean; preserveOnEmpty?: boolean },
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
  /** Reject pending tool and resume LLM loop (mobile /webapi/chat/continue) */
  rejectAndContinueToolIntervention: (
    sessionId: string,
    topicId: string | undefined,
    assistantMessageId: string,
    toolId: string,
    reason?: string,
  ) => Promise<void>;
  rejectToolCall: (sessionId: string, messageId: string, toolId: string, reason?: string) => void;
  /** Reject a tool message (role=tool) - updates plugin.intervention locally */
  rejectToolMessage: (sessionId: string, messageId: string, reason?: string) => void;
  reset: () => void;
  sendMessage: (
    sessionId: string,
    content: string,
    topicId?: string,
    options?: {
      chatContextSelections?: ChatContextSelection[];
      memoryEffort?: MobileMemoryEffort;
      memoryEnabled?: boolean;
      pendingFileSessionId?: string;
      pendingFiles?: FileAttachment[];
      preserveChatContextSelections?: boolean;
      plugins?: string[];
      searchEnabled?: boolean;
    },
  ) => Promise<boolean>;
  setEditingMessage: (id: string | null) => void;
  /** Stop the current generation */
  stopGenerating: () => void;
  /** Streaming content buffer for the current generation */
  streamBuffer: string;
  toggleMessageCollapsed: (sessionId: string, messageId: string, expanded?: boolean) => void;
  /** Update tool arguments (for Intervention form edits before approve) */
  updatePluginArguments: (
    sessionId: string,
    messageId: string,
    toolId: string,
    value: Record<string, unknown>,
    replace?: boolean,
  ) => void;
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
    fetchMessagesInFlight.clear();
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
    options?: { preferPopulatedTopic?: boolean; preserveOnEmpty?: boolean },
  ) => {
    const key = fetchMessagesKey(sessionId, topicId);
    const existing = fetchMessagesInFlight.get(key);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      set((s) => ({
        fetchingMessagesBySession: { ...s.fetchingMessagesBySession, [sessionId]: true },
      }));
      try {
        const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
        const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
        const fetchByTopic = (nextTopicId?: string) =>
          sessionType === 'group'
            ? aiAgentApi.getGroupMessages({ groupId: sessionId, topicId: nextTopicId })
            : messageApi.list(sessionId, nextTopicId, { sessionType });

        let effectiveTopicId = topicId;
        let messages = await fetchByTopic(effectiveTopicId);

        let knownTopics = useTopicStore.getState().topicsBySession[sessionId] ?? [];
        const ensureKnownTopics = async () => {
          if (sessionType === 'group' || knownTopics.length > 0) return;

          const fetchedTopics = await topicApi.list(sessionId, { sessionType }).catch(() => []);
          knownTopics = fetchedTopics;
          if (fetchedTopics.length > 0) {
            useTopicStore.setState((s) => ({
              topicsBySession: {
                ...s.topicsBySession,
                [sessionId]: fetchedTopics,
              },
            }));
          }
        };

        if (!effectiveTopicId && (!messages || messages.length === 0)) {
          await ensureKnownTopics();
          const fallbackTopicId = knownTopics[0]?.id;
          if (fallbackTopicId) {
            effectiveTopicId = fallbackTopicId;
            useTopicStore.getState().switchTopic(sessionId, fallbackTopicId);
            messages = await fetchByTopic(fallbackTopicId);
          }
        }

        if (
          options?.preferPopulatedTopic &&
          sessionType !== 'group' &&
          !effectiveTopicId &&
          (!messages || messages.length === 0)
        ) {
          await ensureKnownTopics();

          const candidateTopicIds = knownTopics
            .map((topic) => topic.id)
            .filter(Boolean)
            .slice(0, 8);

          for (const candidateTopicId of candidateTopicIds) {
            const candidateMessages = await fetchByTopic(candidateTopicId);
            if (candidateMessages.length === 0) continue;

            effectiveTopicId = candidateTopicId;
            useTopicStore.getState().switchTopic(sessionId, candidateTopicId);
            messages = candidateMessages;
            break;
          }
        }
        const {
          activeStreamingMessageId,
          activeStreamingSessionId,
          generating,
          messagesBySession,
        } = get();

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

        const finalMessages = preserveOnEmpty ? messagesBySession[sessionId] || [] : mergedMessages;
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
        const { messageKey, type } = classifyError(err);
        const t = useI18n.getState().t;
        useToast.getState().show('error', t[messageKey], {
          onRetry:
            type === 'auth' ? navigateToLogin : () => void get().fetchMessages(sessionId, topicId),
          retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
        });
      } finally {
        fetchMessagesInFlight.delete(key);
      }
    })();

    fetchMessagesInFlight.set(key, promise);
    await promise;
  },

  sendMessage: async (
    sessionId: string,
    content: string,
    topicId?: string,
    options?: {
      chatContextSelections?: ChatContextSelection[];
      memoryEffort?: MobileMemoryEffort;
      memoryEnabled?: boolean;
      pendingFileSessionId?: string;
      pendingFiles?: FileAttachment[];
      preserveChatContextSelections?: boolean;
      plugins?: string[];
      searchEnabled?: boolean;
    },
  ) => {
    if (get().generating) return false;

    const textContent = content.trim();
    const fileState = useFileStore.getState();
    const attachments = (options?.pendingFiles ?? fileState.pendingFiles).filter(
      (file) => file.status !== 'error',
    );
    const chatContextSelections = options?.chatContextSelections ?? fileState.chatContextSelections;
    const docSelections = toDocSelections(chatContextSelections);
    if (attachments.some((f) => f.status === 'uploading')) {
      return false;
    }

    if (!textContent && attachments.length === 0 && chatContextSelections.length === 0)
      return false;

    const uploadedAttachments: UploadedAttachment[] = [];
    if (attachments.length > 0) {
      const uploaded = await Promise.all(
        attachments.map(async (file) => {
          const result = await useFileStore.getState().uploadFile(file.id, {
            sessionId: options?.pendingFileSessionId,
          });
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

    if (uploadedAttachments.some((file) => !isAttachableFileId(file.fileId))) {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.fileUploadFailed);
      return false;
    }

    const displayContent = buildUserDisplayContent(
      textContent,
      uploadedAttachments,
      chatContextSelections,
    );
    const promptContent = buildUserPromptText(
      textContent,
      uploadedAttachments,
      chatContextSelections,
    );
    const attachedFileIds = uploadedAttachments
      .map((f) => f.fileId)
      .filter((fileId): fileId is string => isAttachableFileId(fileId));

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
      ...(docSelections.length > 0 ? { metadata: { docSelections } } : {}),
      updatedAt: new Date().toISOString(),
    };

    const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);
    // If grouped session fetch misses this ID, fallback to group detail probing.
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

        const targetId = parseTargetIdFromMentions(textContent) ?? undefined;
        const result = await aiAgentApi.execGroupAgent({
          agentId: supervisorAgentId,
          ...(attachedFileIds.length > 0 ? { files: attachedFileIds } : {}),
          groupId: sessionId,
          message: promptContent,
          targetId,
          topicId,
        });

        if (result.userMessageId) {
          if (promptContent !== displayContent) {
            void messageApi.update(result.userMessageId, displayContent).catch((error) => {
              console.warn('[ChatStore] Failed to normalize group user message content:', error);
            });
          }

          if (docSelections.length > 0) {
            void messageApi
              .updateMetadata(result.userMessageId, { docSelections })
              .catch((error) => {
                console.warn('[ChatStore] Failed to persist group doc selections:', error);
              });
          }
        }

        if (uploadedAttachments.length > 0) {
          useFileStore.getState().clearPending({ sessionId: options?.pendingFileSessionId });
        }
        if (chatContextSelections.length > 0 && !options?.preserveChatContextSelections) {
          useFileStore.getState().clearChatContextSelections();
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
          console.warn('[ChatStore] execGroupAgent failed:', {
            error: result.error,
            success: result.success,
          });
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
            didSettle = true;
            break;
          }

          if (!settledAssistant && operationStatus?.isCompleted) {
            const targetId = result.assistantMessageId ?? assistantPlaceholderId;
            const byId = findMessageByIdInTree(currentMessages, targetId);
            if (byId) {
              pruneGroupLoadingPlaceholder(sessionId, targetId, byId.id);
              triggerTopicTitleGeneration(sessionId, resolvedTopicId);
              didSettle = true;
              break;
            }
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
                settledAssistant ||
                findGroupAssistantCandidate(iterationMessages, targetAssistantId);

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
                didSettle = true;
                break;
              }

              // Trust backend: when isCompleted, treat assistant found by id as settled
              if (!settledAssistant && operationStatus?.isCompleted) {
                const byId = findMessageByIdInTree(iterationMessages, targetAssistantId);
                if (byId) {
                  pruneGroupLoadingPlaceholder(sessionId, targetAssistantId, byId.id);
                  triggerTopicTitleGeneration(sessionId, resolvedTopicId);
                  didSettle = true;
                  break;
                }
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
                settledAssistant ||
                findGroupAssistantCandidate(fallbackMessages, targetAssistantId);
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
              if (!settledAssistant && operationStatus?.isCompleted) {
                const byId = findMessageByIdInTree(fallbackMessages, targetAssistantId);
                if (byId) {
                  pruneGroupLoadingPlaceholder(sessionId, targetAssistantId, byId.id);
                  didSettle = true;
                }
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
        const { messageKey } = classifyError(err);
        const errorMessage =
          messageKey === 'errorProviderOverloaded'
            ? t.errorProviderOverloaded
            : rawMessage || t.errorSendFailed;
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
        ...(docSelections.length > 0 ? { metadata: { docSelections } } : {}),
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
        const multimodalContent = buildUserStreamContent(promptContent, uploadedAttachments);
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
      useFileStore.getState().clearPending({ sessionId: options?.pendingFileSessionId });
    }
    if (chatContextSelections.length > 0 && !options?.preserveChatContextSelections) {
      useFileStore.getState().clearChatContextSelections();
    }

    // Stream AI response via XHR (RN fetch lacks ReadableStream support)
    try {
      const chatOptions = await getSessionChatOptions(sessionId);
      const resolvedProvider =
        chatOptions.provider || resolveProviderByModel(chatOptions.model) || 'openai';
      const provider = resolvedProvider;
      chatOptions.provider = resolvedProvider;
      chatOptions.sessionId = sessionId;
      chatOptions.topicId = resolvedTopicId;

      // Set model/provider on the assistant message for immediate UI display
      set((s) => ({
        messagesBySession: updateSessionMessageRecord(
          s.messagesBySession,
          sessionId,
          assistantMsgId,
          (message) => ({ ...message, model: chatOptions.model, provider }),
        ),
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
            messagesBySession: updateSessionMessageRecord(
              s.messagesBySession,
              sessionId,
              assistantMsgId,
              (message) => ({ ...message, reasoning: buildReasoningState(reasoning) }),
            ),
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
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => {
                  const nextMetadata = mergeMessageMetadata(message.metadata, contentState);

                  return {
                    ...message,
                    content: contentState.content,
                    ...(nextMetadata ? { metadata: nextMetadata } : {}),
                    reasoning: finalReasoning
                      ? {
                          ...buildReasoningState(finalReasoning),
                          ...(duration !== undefined ? { duration } : {}),
                        }
                      : message.reasoning
                        ? { ...message.reasoning, ...(duration !== undefined ? { duration } : {}) }
                        : message.reasoning,
                  };
                },
              ),
            }));
          } else {
            set((s) => ({
              streamBuffer: contentState.content,
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => {
                  const nextMetadata = mergeMessageMetadata(message.metadata, contentState);

                  return {
                    ...message,
                    content: contentState.content,
                    ...(nextMetadata ? { metadata: nextMetadata } : {}),
                    ...(reasoning ? { reasoning: buildReasoningState(reasoning) } : {}),
                  };
                },
              ),
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
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({ ...message, imageList: images }),
              ),
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
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({ ...message, search }),
              ),
            }));
          },
          onToolExecutions: (executions) => {
            const toolPayloads = toolExecutionsToPayloads(executions);
            set((s) => ({
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({
                  ...message,
                  tools: mergeToolPayloads(message.tools ?? undefined, toolPayloads),
                }),
              ),
            }));
          },
          onTools: (tools) => {
            set((s) => ({
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({
                  ...message,
                  tools: mergeToolPayloads(message.tools ?? undefined, tools),
                }),
              ),
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
          messagesBySession: updateSessionMessageRecord(
            s.messagesBySession,
            sessionId,
            assistantMsgId,
            (message) =>
              message.reasoning
                ? {
                    ...message,
                    content: result.text,
                    reasoning: {
                      ...message.reasoning,
                      ...(duration !== undefined ? { duration } : {}),
                    },
                  }
                : message,
          ),
        }));
      }

      const resolvedTools = mergeResolvedToolPayloads(result.tools, result.toolExecutions);

      if (result.images || result.search || resolvedTools || result.usage || result.performance) {
        set((s) => ({
          messagesBySession: updateSessionMessageRecord(
            s.messagesBySession,
            sessionId,
            assistantMsgId,
            (message) => {
              const nextMetadata = mergeMessageMetadata(message.metadata, result.contentMetadata);

              return {
                ...message,
                ...(result.images ? { imageList: result.images } : {}),
                ...(result.search ? { search: result.search } : {}),
                ...(resolvedTools ? { tools: resolvedTools } : {}),
                ...(result.usage ? { usage: result.usage as any } : {}),
                ...(result.performance ? { performance: result.performance as any } : {}),
                ...(nextMetadata ? { metadata: nextMetadata } : {}),
                provider,
              };
            },
          ),
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

          if (shouldCreateTopicAfterResponse && !resolvedTopicId) {
            const createdTopic = await useTopicStore.getState().createTopic(sessionId, '', {
              messageIds: extractPersistedMessageIds(mergedPersistedMessages),
            });

            if (createdTopic?.id) {
              resolvedTopicId = createdTopic.id;
              useTopicStore.getState().switchTopic(sessionId, createdTopic.id);
              await useTopicStore.getState().fetchTopics(sessionId);
              await get().fetchMessages(sessionId, createdTopic.id);
            } else {
              useToast.getState().show('error', useI18n.getState().t.toastTopicCreateFailed);
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
      const { messageKey } = classifyError(err);
      const errorMessage =
        messageKey === 'errorProviderOverloaded'
          ? t.errorProviderOverloaded
          : rawMessage || t.errorNetwork;
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

  clearMessages: async (sessionId: string) => {
    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
    const isGroup = isGroupSessionLike(sessionId, session?.type);
    const activeTopicId = useTopicStore.getState().activeTopicBySession[sessionId] ?? null;

    try {
      if (isGroup) {
        await messageApi.removeMessagesByGroup(sessionId, activeTopicId);
      } else {
        await messageApi.removeMessagesByAssistant(sessionId, activeTopicId);
      }
      if (activeTopicId) {
        await topicApi.remove(activeTopicId);
      }
      await useTopicStore.getState().fetchTopics(sessionId);
      useTopicStore.getState().switchTopic(sessionId, null);
    } catch (err) {
      console.warn('[ChatStore] clearMessages failed:', err);
      const { messageKey, type } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey], {
        onRetry: type === 'auth' ? navigateToLogin : undefined,
        retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
      });
      throw err;
    }

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

  toggleMessageCollapsed: (sessionId: string, messageId: string, expanded?: boolean) => {
    const messages = get().messagesBySession[sessionId] || [];
    const target =
      findMessageByIdInTree(messages, messageId) || messages.find((m) => m.id === messageId);
    if (!target || target.role !== 'compressedGroup') return;

    const nextExpanded = expanded ?? !(target.metadata as Record<string, unknown>)?.expanded;
    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
          m.id === messageId
            ? {
                ...m,
                metadata: {
                  ...m.metadata,
                  expanded: nextExpanded,
                },
              }
            : m,
        ),
      },
    }));
  },

  regenerateMessage: async (sessionId: string, messageId: string) => {
    if (get().generating) return;

    const session = useSessionStore.getState().sessions.find((item) => item.id === sessionId);
    const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
    const messages = get().messagesBySession[sessionId] || [];

    if (sessionType === 'group') {
      let target: ChatMessage | undefined = messages.find((m) => m.id === messageId);
      let targetIdx = target ? messages.findIndex((m) => m.id === messageId) : -1;

      if (!target || targetIdx < 0) {
        const foundInTree = findMessageByIdInTree(messages, messageId);
        if (foundInTree) {
          const compareGroupParent = messages.find(
            (m) => m.role === 'compareGroup' && m.children?.some((c) => c.id === messageId),
          );
          if (compareGroupParent) {
            target = compareGroupParent;
            targetIdx = messages.findIndex((m) => m.id === compareGroupParent.id);
          }
        }
      }
      if (!target || targetIdx < 0) return;
      const userMsg = messages[targetIdx - 1];
      if (!userMsg || userMsg.role !== 'user') {
        const t = useI18n.getState().t;
        useToast.getState().show('error', t.errorUnknown);
        return;
      }

      const messageText = (userMsg.content || '').trim();
      if (!messageText) {
        const t = useI18n.getState().t;
        useToast.getState().show('error', t.errorUnknown);
        return;
      }

      const rawFileIds: string[] = [
        ...(userMsg.fileList?.map((f) => f.id).filter(Boolean) ?? []),
        ...(userMsg.imageList?.map((i) => i.id).filter(Boolean) ?? []),
      ];
      if (rawFileIds.some((fileId) => !isAttachableFileId(fileId))) {
        const t = useI18n.getState().t;
        useToast.getState().show('error', t.fileUploadFailed);
        return;
      }
      const fileIds = rawFileIds;

      const topicId = useTopicStore.getState().activeTopicBySession[sessionId] ?? undefined;

      const idsToRemove: string[] = [userMsg.id];
      if (target.role === 'compareGroup' || target.role === 'compressedGroup') {
        idsToRemove.push(target.id);
        target.children?.forEach((c) => {
          if (c.id) idsToRemove.push(c.id);
        });
      } else {
        idsToRemove.push(messageId);
      }

      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).filter(
            (m) => !idsToRemove.includes(m.id),
          ),
        },
      }));

      for (const id of idsToRemove) {
        void messageApi.remove(id).catch(() => {});
      }

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
          [sessionId]: [...(s.messagesBySession[sessionId] || []), assistantMsg],
        },
      }));

      try {
        const groupDetail = await agentGroupApi.getGroupDetail(sessionId);
        const supervisorAgentId = groupDetail?.supervisorAgentId;
        if (!supervisorAgentId) {
          throw new Error('Group supervisor not found');
        }

        const result = await aiAgentApi.execGroupAgent({
          agentId: supervisorAgentId,
          ...(fileIds.length > 0 ? { files: fileIds } : {}),
          groupId: sessionId,
          message: messageText,
          topicId,
        });

        const resolvedTopicId = result.topicId ?? topicId ?? null;
        syncTopicsForSession(sessionId, result.topics, resolvedTopicId);
        const placeholderMessages = get().messagesBySession[sessionId] || [];
        if (result.messages?.length) {
          syncGroupMessagesForSession(sessionId, result.messages, placeholderMessages);
        } else if (result.assistantMessageId) {
          rebindGroupPlaceholderMessages(sessionId, '', assistantPlaceholderId, {
            assistantMessageId: result.assistantMessageId,
            userMessageId: result.userMessageId,
          });
        }

        set({
          activeOperationId: result.operationId ?? null,
          activeStreamingMessageId: result.assistantMessageId ?? assistantPlaceholderId,
        });

        if (result.success === false) {
          throw new Error(result.error?.trim() || useI18n.getState().t.errorSendFailed);
        }
        if (!result.operationId) {
          throw new Error(useI18n.getState().t.errorSendFailed);
        }

        let didSettle = false;
        for (let attempt = 0; attempt < GROUP_POLL_MAX_ATTEMPTS; attempt += 1) {
          await sleep(GROUP_POLL_INTERVAL_MS);
          if (abortController.signal.aborted) return;

          const operationStatus = await aiAgentApi
            .getOperationStatus({
              historyLimit: 10,
              includeHistory: true,
              operationId: result.operationId!,
            })
            .catch(() => null);

          if (operationStatus?.latestAssistant && result.assistantMessageId) {
            applyGroupRuntimeAssistantFallback(
              sessionId,
              result.assistantMessageId,
              operationStatus,
            );
          }

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
          if (settledAssistant) {
            pruneGroupLoadingPlaceholder(
              sessionId,
              result.assistantMessageId ?? assistantPlaceholderId,
              settledAssistant.id,
            );
            didSettle = true;
            break;
          }
          if (operationStatus?.isCompleted) {
            didSettle = true;
            break;
          }
        }

        if (!didSettle) {
          await get().fetchMessages(sessionId, resolvedTopicId ?? undefined);
        }
      } catch (err) {
        const t = useI18n.getState().t;
        const { messageKey, type } = classifyError(err);
        useToast.getState().show('error', t[messageKey] ?? t.errorUnknown, {
          onRetry: type === 'auth' ? navigateToLogin : undefined,
          retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
        });
        if (type !== 'auth') {
          await get().fetchMessages(sessionId, topicId);
        }
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
      return;
    }

    const messageContainerParams = buildMessageContainerParams(sessionId, sessionType);
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
      const resolvedProvider =
        chatOptions.provider || resolveProviderByModel(chatOptions.model) || 'openai';
      const provider = resolvedProvider;
      chatOptions.provider = resolvedProvider;
      chatOptions.sessionId = sessionId;
      chatOptions.topicId = topicId;
      // memory/searchMode come from getSessionChatOptions (agent/session chatConfig)
      // When undefined, backend resolveEffectiveMemoryPayload falls back to agent config

      // Set model/provider on the assistant message for immediate display
      set((s) => ({
        messagesBySession: updateSessionMessageRecord(
          s.messagesBySession,
          sessionId,
          assistantMsgId,
          (message) => ({ ...message, model: chatOptions.model, provider }),
        ),
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
            messagesBySession: updateSessionMessageRecord(
              s.messagesBySession,
              sessionId,
              assistantMsgId,
              (message) => ({ ...message, reasoning: buildReasoningState(reasoning) }),
            ),
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
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => {
                  const nextMetadata = mergeMessageMetadata(message.metadata, contentState);

                  return {
                    ...message,
                    content: contentState.content,
                    ...(nextMetadata ? { metadata: nextMetadata } : {}),
                    reasoning: finalReasoning
                      ? {
                          ...buildReasoningState(finalReasoning),
                          ...(duration !== undefined ? { duration } : {}),
                        }
                      : message.reasoning
                        ? { ...message.reasoning, ...(duration !== undefined ? { duration } : {}) }
                        : message.reasoning,
                  };
                },
              ),
            }));
          } else {
            set((s) => ({
              streamBuffer: contentState.content,
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => {
                  const nextMetadata = mergeMessageMetadata(message.metadata, contentState);

                  return {
                    ...message,
                    content: contentState.content,
                    ...(nextMetadata ? { metadata: nextMetadata } : {}),
                    ...(reasoning ? { reasoning: buildReasoningState(reasoning) } : {}),
                  };
                },
              ),
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
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({ ...message, imageList: images }),
              ),
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
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({ ...message, search }),
              ),
            }));
          },
          onToolExecutions: (executions) => {
            const toolPayloads = toolExecutionsToPayloads(executions);
            set((s) => ({
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({
                  ...message,
                  tools: mergeToolPayloads(message.tools ?? undefined, toolPayloads),
                }),
              ),
            }));
          },
          onTools: (tools) => {
            set((s) => ({
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMsgId,
                (message) => ({
                  ...message,
                  tools: mergeToolPayloads(message.tools ?? undefined, tools),
                }),
              ),
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
          messagesBySession: updateSessionMessageRecord(
            s.messagesBySession,
            sessionId,
            assistantMsgId,
            (message) =>
              message.reasoning
                ? {
                    ...message,
                    content: result.text,
                    reasoning: {
                      ...message.reasoning,
                      ...(duration !== undefined ? { duration } : {}),
                    },
                  }
                : message,
          ),
        }));
      }

      const resolvedToolsRegen = mergeResolvedToolPayloads(result.tools, result.toolExecutions);

      if (
        result.images ||
        result.search ||
        resolvedToolsRegen ||
        result.usage ||
        result.performance
      ) {
        set((s) => ({
          messagesBySession: updateSessionMessageRecord(
            s.messagesBySession,
            sessionId,
            assistantMsgId,
            (message) => {
              const nextMetadata = mergeMessageMetadata(message.metadata, result.contentMetadata);

              return {
                ...message,
                ...(result.images ? { imageList: result.images } : {}),
                ...(result.search ? { search: result.search } : {}),
                ...(resolvedToolsRegen ? { tools: resolvedToolsRegen } : {}),
                ...(result.usage ? { usage: result.usage as any } : {}),
                ...(result.performance ? { performance: result.performance as any } : {}),
                ...(nextMetadata ? { metadata: nextMetadata } : {}),
                provider,
              };
            },
          ),
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

  approveToolCall: async (
    sessionId: string,
    messageId: string,
    topicId?: string,
    assistantGroupId?: string,
  ) => {
    const t = useI18n.getState().t;
    try {
      await chatToolApi.approveToolCall({
        assistantGroupId,
        sessionId,
        topicId,
        toolMessageId: messageId,
      });
      await get().fetchMessages(sessionId, topicId ?? undefined, { preserveOnEmpty: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNotSupported = msg.includes('not yet supported') || msg.includes('not implemented');
      useToast.getState().show('error', isNotSupported ? t.chatToolApproveNotSupported : msg);
    }
  },

  continueToolIntervention: async (
    sessionId: string,
    topicId: string | undefined,
    assistantMessageId: string,
    approvedTool: ChatToolPayload,
  ) => {
    const t = useI18n.getState().t;
    try {
      const chatOptions = await getSessionChatOptions(sessionId);
      const provider =
        chatOptions.provider || resolveProviderByModel(chatOptions.model) || 'openai';

      const result = await aiChatApi.continueToolIntervention(
        provider,
        { approvedToolCall: approvedTool, sessionId, topicId },
        {
          onContent: (state) => {
            set((s) => ({
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMessageId,
                (message) => ({ ...message, content: state.content }),
              ),
            }));
          },
          onTools: (tools) => {
            set((s) => ({
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMessageId,
                (message) => ({ ...message, tools }),
              ),
            }));
          },
          onToolExecutions: (executions) => {
            const resolved = mergeResolvedToolPayloads(
              getSessionMessageById(get().messagesBySession, sessionId, assistantMessageId)
                ?.tools ?? undefined,
              executions,
            );
            if (resolved) {
              set((s) => ({
                messagesBySession: updateSessionMessageRecord(
                  s.messagesBySession,
                  sessionId,
                  assistantMessageId,
                  (message) => ({ ...message, tools: resolved }),
                ),
              }));
            }
          },
        },
      );

      if (result.tools) {
        const resolved = mergeResolvedToolPayloads(result.tools, result.toolExecutions);
        if (resolved) {
          set((s) => ({
            messagesBySession: updateSessionMessageRecord(
              s.messagesBySession,
              sessionId,
              assistantMessageId,
              (message) => ({ ...message, tools: resolved }),
            ),
          }));
        }
      }
      if (result.text) {
        set((s) => ({
          messagesBySession: updateSessionMessageRecord(
            s.messagesBySession,
            sessionId,
            assistantMessageId,
            (message) => ({ ...message, content: result.text }),
          ),
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useToast.getState().show('error', msg || t.errorSendFailed);
    }
  },

  rejectAndContinueToolIntervention: async (
    sessionId: string,
    topicId: string | undefined,
    assistantMessageId: string,
    toolId: string,
    reason?: string,
  ) => {
    const t = useI18n.getState().t;
    try {
      const chatOptions = await getSessionChatOptions(sessionId);
      const provider =
        chatOptions.provider || resolveProviderByModel(chatOptions.model) || 'openai';

      const streamCallbacks = {
        onContent: (state: { content: string }) => {
          set((s) => ({
            messagesBySession: updateSessionMessageRecord(
              s.messagesBySession,
              sessionId,
              assistantMessageId,
              (message) => ({ ...message, content: state.content }),
            ),
          }));
        },
        onTools: (tools: ChatToolPayload[]) => {
          set((s) => ({
            messagesBySession: updateSessionMessageRecord(
              s.messagesBySession,
              sessionId,
              assistantMessageId,
              (message) => ({ ...message, tools }),
            ),
          }));
        },
        onToolExecutions: (executions: ToolExecutionItem[]) => {
          const resolved = mergeResolvedToolPayloads(
            getSessionMessageById(get().messagesBySession, sessionId, assistantMessageId)?.tools ??
              undefined,
            executions,
          );
          if (resolved) {
            set((s) => ({
              messagesBySession: updateSessionMessageRecord(
                s.messagesBySession,
                sessionId,
                assistantMessageId,
                (message) => ({ ...message, tools: resolved }),
              ),
            }));
          }
        },
      };

      const result = await aiChatApi.continueToolIntervention(
        provider,
        { rejectedToolCall: { id: toolId, reason }, sessionId, topicId },
        streamCallbacks,
      );

      if (result.tools) {
        const resolved = mergeResolvedToolPayloads(result.tools, result.toolExecutions);
        if (resolved) {
          set((s) => ({
            messagesBySession: updateSessionMessageRecord(
              s.messagesBySession,
              sessionId,
              assistantMessageId,
              (message) => ({ ...message, tools: resolved }),
            ),
          }));
        }
      }
      if (result.text) {
        set((s) => ({
          messagesBySession: updateSessionMessageRecord(
            s.messagesBySession,
            sessionId,
            assistantMessageId,
            (message) => ({ ...message, content: result.text }),
          ),
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useToast.getState().show('error', msg || t.errorSendFailed);
    }
  },

  rejectToolCall: (sessionId: string, messageId: string, toolId: string, reason?: string) => {
    set((s) => {
      const messages = s.messagesBySession[sessionId] || [];
      const nextMessages = messages.map((msg) => {
        if (msg.id !== messageId || !msg.tools?.length) return msg;
        return {
          ...msg,
          tools: msg.tools.map((t) =>
            t.id === toolId
              ? { ...t, intervention: { rejectedReason: reason, status: 'rejected' as const } }
              : t,
          ),
        };
      });
      return {
        messagesBySession: { ...s.messagesBySession, [sessionId]: nextMessages },
      };
    });
  },

  rejectToolMessage: (sessionId: string, messageId: string, reason?: string) => {
    const intervention: { rejectedReason?: string; status: 'rejected' } = {
      rejectedReason: reason,
      status: 'rejected',
    };
    set((s) => {
      const messages = s.messagesBySession[sessionId] || [];
      const nextMessages = messages.map((msg) => {
        if (msg.id !== messageId || msg.role !== 'tool') return msg;
        return {
          ...msg,
          plugin: msg.plugin ? { ...msg.plugin, intervention } : msg.plugin,
          pluginIntervention: intervention,
        };
      });
      return {
        messagesBySession: { ...s.messagesBySession, [sessionId]: nextMessages },
      };
    });
  },

  updatePluginArguments: (
    sessionId: string,
    messageId: string,
    toolId: string,
    value: Record<string, unknown>,
    replace = false,
  ) => {
    set((s) => {
      const messages = s.messagesBySession[sessionId] || [];
      const nextMessages = messages.map((msg) => {
        if (msg.id !== messageId || !msg.tools?.length) return msg;
        return {
          ...msg,
          tools: msg.tools.map((t) => {
            if (t.id !== toolId) return t;
            let prev: Record<string, unknown> = {};
            try {
              prev = JSON.parse(t.arguments || '{}') as Record<string, unknown>;
            } catch {
              //
            }
            const next = replace ? value : { ...prev, ...value };
            return { ...t, arguments: JSON.stringify(next) };
          }),
        };
      });
      return {
        messagesBySession: { ...s.messagesBySession, [sessionId]: nextMessages },
      };
    });
  },
}));

// Re-export types for backward compat
export type { ChatMessage } from '../types';

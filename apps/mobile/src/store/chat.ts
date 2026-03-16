/**
 * Chat (message) store — manages messages for the active session.
 *
 * Mirrors the web chat store logic:
 *   - Fetch messages from backend
 *   - Send user messages, trigger AI response
 *   - Handle streaming responses
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import type {
  ChatRequestOptions,
  MobileChatMessage,
  MobileMessageToolCall,
  StreamContentState,
  StreamReasoningState,
} from '../lib/api';
import { agentApi, aiChatApi, messageApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { ChatMessage, MobileMemoryEffort } from '../types';
import { useFileStore } from './file';

/**
 * Resolves per-session chat options with a 3-tier priority:
 *   1. Backend agent config (source of truth)
 *   2. Per-session AsyncStorage (legacy / offline fallback)
 *   3. Global default model/provider
 */
async function getSessionChatOptions(sessionId: string): Promise<ChatRequestOptions> {
  const opts: ChatRequestOptions = {};

  // 1. Backend agent config
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
    }
  } catch {
    /* network error — fall through to AsyncStorage */
  }

  // 2. Per-session AsyncStorage (legacy / offline)
  if (!opts.model || !opts.provider) {
    try {
      const raw = await AsyncStorage.getItem(`avato_chat_settings_${sessionId}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (!opts.model && saved.model) opts.model = saved.model;
        if (!opts.provider && saved.provider) opts.provider = saved.provider;
        if (opts.temperature == null && saved.temperature)
          opts.temperature = parseFloat(saved.temperature);
        if (!opts.systemPrompt && saved.systemPrompt) opts.systemPrompt = saved.systemPrompt;
      }
    } catch {
      /* ignore */
    }
  }

  // 3. Global defaults
  if (!opts.model) {
    try {
      const globalModel = await AsyncStorage.getItem('avato_default_model');
      if (globalModel) opts.model = globalModel;
    } catch {
      /* ignore */
    }
  }
  if (!opts.provider) {
    try {
      const globalProvider = await AsyncStorage.getItem('avato_default_provider');
      if (globalProvider) opts.provider = globalProvider;
    } catch {
      /* ignore */
    }
  }
  return opts;
}

interface UploadedAttachment {
  content?: string;
  fileId: string;
  name: string;
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
      content:
        reasoning.content || JSON.stringify(reasoning.tempDisplayContent),
      ...(reasoning.duration !== undefined ? { duration: reasoning.duration } : {}),
      isMultimodal: true,
      ...(reasoning.signature ? { signature: reasoning.signature } : {}),
    };
  }

  if (!reasoning.content && reasoning.duration === undefined && !reasoning.signature) return undefined;

  return {
    ...(reasoning.content ? { content: reasoning.content } : {}),
    ...(reasoning.duration !== undefined ? { duration: reasoning.duration } : {}),
    ...(reasoning.signature ? { signature: reasoning.signature } : {}),
  };
};

const isImageAttachment = (mimeType: string) => mimeType.startsWith('image/');
const FILE_CONTENT_PREVIEW_LIMIT = 6000;

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

  return `- ${attachment.name}: ${attachment.url}`;
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
      image_url: { detail: 'auto', url: attachment.url },
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

interface ChatState {
  /** AbortController for the current streaming request */
  abortController: AbortController | null;
  activeStreamingMessageId: string | null;
  activeStreamingSessionId: string | null;
  clearMessages: (sessionId: string) => void;
  deleteMessage: (sessionId: string, messageId: string) => Promise<void>;
  /** Message currently being edited (id) */
  editingMessageId: string | null;
  editMessage: (sessionId: string, messageId: string, content: string) => Promise<void>;

  // Actions
  fetchMessages: (sessionId: string, topicId?: string) => Promise<void>;
  /** Whether a message is currently being generated */
  generating: boolean;
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
  ) => Promise<void>;
  setEditingMessage: (id: string | null) => void;
  /** Stop the current generation */
  stopGenerating: () => void;
  /** Streaming content buffer for the current generation */
  streamBuffer: string;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeStreamingMessageId: null,
  activeStreamingSessionId: null,
  messagesBySession: {},
  generating: false,
  isReasoning: false,
  reasoningStartedAt: null,
  streamBuffer: '',
  editingMessageId: null,
  abortController: null,

  reset: () => {
    get().abortController?.abort();
    set({
      activeStreamingMessageId: null,
      activeStreamingSessionId: null,
      abortController: null,
      editingMessageId: null,
      generating: false,
      isReasoning: false,
      messagesBySession: {},
      reasoningStartedAt: null,
      streamBuffer: '',
    });
  },

  stopGenerating: () => {
    const controller = get().abortController;
    if (controller) {
      controller.abort();
    }
    set({
      activeStreamingMessageId: null,
      activeStreamingSessionId: null,
      abortController: null,
      generating: false,
      isReasoning: false,
      reasoningStartedAt: null,
      streamBuffer: '',
    });
  },

  fetchMessages: async (sessionId: string, topicId?: string) => {
    try {
      const messages = await messageApi.list(sessionId, topicId);
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
        ? (messagesBySession[sessionId] || []).find((message) => message.id === activeStreamingMessageId)
        : undefined;

      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]:
            localStreamingMessage && !messages.some((message) => message.id === localStreamingMessage.id)
              ? [...messages, localStreamingMessage]
              : (messages ?? []),
        },
      }));
    } catch (err) {
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
    const textContent = content.trim();
    const fileState = useFileStore.getState();
    const attachments = fileState.pendingFiles.filter((f) => f.status !== 'error');
    if (attachments.some((f) => f.status === 'uploading')) return;

    if (!textContent && attachments.length === 0) return;

    const uploadedAttachments: UploadedAttachment[] = [];
    if (attachments.length > 0) {
      const uploaded = await Promise.all(
        attachments.map(async (file) => {
          const result = await useFileStore.getState().uploadFile(file.id, { sessionId });
          if (!result) return null;

          return {
            fileId: result.fileId,
            name: file.name,
            type: file.type,
            url: result.url,
          } satisfies UploadedAttachment;
        }),
      );

      const successful = uploaded.filter(Boolean) as UploadedAttachment[];
      if (successful.length !== attachments.length) return;
      uploadedAttachments.push(...successful);
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
        topicId,
      } as any);
      userMessageServerId = result?.id;
      persistedMessagesAfterUser = result?.messages;

      if (result?.messages?.length) {
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: result.messages,
          },
        }));
      }
    } catch {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorSendFailed);
    }

    const contextMessages = (persistedMessagesAfterUser || get().messagesBySession[sessionId] || [])
      .map(buildContextMessage)
      .filter(Boolean) as MobileChatMessage[];

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
      chatOptions.topicId = topicId;

      // Set model/provider on the assistant message for immediate UI display
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId ? { ...m, model: chatOptions.model, provider } : m,
          ),
        },
      }));

      if (options?.searchEnabled) {
        chatOptions.enabledSearch = true;
      }
      chatOptions.memory = {
        effort: options?.memoryEffort || 'medium',
        enabled: options?.memoryEnabled !== false,
      };
      if (options?.plugins?.length) {
        chatOptions.plugins = options.plugins;
      }

      // Throttle store updates to avoid per-token re-renders
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
                        reasoning: m.reasoning
                          ? {
                              ...m.reasoning,
                              ...(m.reasoning.isMultimodal
                                ? {}
                                : { content: m.reasoning.content }),
                              ...(duration !== undefined ? { duration } : {}),
                            }
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

      if (
        result.images ||
        result.search ||
        result.tools ||
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
                    ...(result.tools ? { tools: result.tools } : {}),
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
          ...(result.tools ? { tools: result.tools } : {}),
          provider,
          parentId: userMessageServerId,
          topicId,
          reasoning: buildPersistedReasoning(localMsg?.reasoning),
        });

        if (persistedAssistant?.messages?.length) {
          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: persistedAssistant.messages,
            },
          }));
        }
      } catch (err) {
        console.warn('[ChatStore] Failed to persist assistant message:', err);
      }
    } catch (err) {
      console.warn('[ChatStore] AI streaming error:', err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorNetwork);
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId ? { ...m, content: useI18n.getState().t.errorNetwork } : m,
          ),
        },
      }));
    } finally {
      set({
        activeStreamingMessageId: null,
        activeStreamingSessionId: null,
        abortController: null,
        generating: false,
        isReasoning: false,
        reasoningStartedAt: null,
        streamBuffer: '',
      });
    }
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
      // Refresh from server on failure
      get().fetchMessages(sessionId);
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
      get().fetchMessages(sessionId);
    }
  },

  regenerateMessage: async (sessionId: string, messageId: string) => {
    const messages = get().messagesBySession[sessionId] || [];
    const targetIdx = messages.findIndex((m) => m.id === messageId);
    if (targetIdx < 0) return;

    const target = messages[targetIdx];

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
          console.warn('[ChatStore] Failed to remove trailing messages during regeneration:', error);
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
      isReasoning: false,
      reasoningStartedAt: null,
      streamBuffer: '',
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] || []), assistantMsg],
      },
    }));

    try {
      const chatOptions = await getSessionChatOptions(sessionId);
      const provider = chatOptions.provider || 'openai';

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
                        reasoning: m.reasoning
                          ? {
                              ...m.reasoning,
                              ...(duration !== undefined ? { duration } : {}),
                            }
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

      if (
        result.images ||
        result.search ||
        result.tools ||
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
                    ...(result.tools ? { tools: result.tools } : {}),
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
          ...(result.tools ? { tools: result.tools } : {}),
          reasoning: buildPersistedReasoning(localMsg?.reasoning),
        });

        if (persistedAssistant?.messages?.length) {
          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: persistedAssistant.messages,
            },
          }));
        }
      } catch (err) {
        console.warn('[ChatStore] Failed to persist regenerated assistant message:', err);
      }
    } catch (err) {
      console.warn('[ChatStore] regenerate streaming error:', err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorNetwork);
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId ? { ...m, content: useI18n.getState().t.errorNetwork } : m,
          ),
        },
      }));
    } finally {
      set({
        activeStreamingMessageId: null,
        activeStreamingSessionId: null,
        abortController: null,
        generating: false,
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

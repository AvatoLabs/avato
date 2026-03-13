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
import type { ChatRequestOptions } from '../lib/api';
import { aiChatApi, messageApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { ChatMessage, MobileMemoryEffort } from '../types';
import { useFileStore } from './file';

/**
 * Reads per-session chat settings (model, temperature, systemPrompt, provider)
 * from AsyncStorage. Falls back to global default model/provider if no
 * per-session values are configured.
 */
async function getSessionChatOptions(sessionId: string): Promise<ChatRequestOptions> {
  const opts: ChatRequestOptions = {};
  try {
    const raw = await AsyncStorage.getItem(`minkhub_chat_settings_${sessionId}`);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.model) opts.model = saved.model;
      if (saved.provider) opts.provider = saved.provider;
      if (saved.temperature) opts.temperature = parseFloat(saved.temperature);
      if (saved.systemPrompt) opts.systemPrompt = saved.systemPrompt;
    }
  } catch {
    /* ignore */
  }
  // Fallback to global default model/provider if no per-session values
  if (!opts.model) {
    try {
      const globalModel = await AsyncStorage.getItem('minkhub_default_model');
      if (globalModel) opts.model = globalModel;
    } catch {
      /* ignore */
    }
  }
  if (!opts.provider) {
    try {
      const globalProvider = await AsyncStorage.getItem('minkhub_default_provider');
      if (globalProvider) opts.provider = globalProvider;
    } catch {
      /* ignore */
    }
  }
  return opts;
}

interface UploadedAttachment {
  fileId: string;
  name: string;
  type: string;
  url: string;
}

interface MobileUserMessageContentPartText {
  text: string;
  type: 'text';
}

interface MobileUserMessageContentPartImage {
  image_url: {
    detail?: 'auto' | 'high' | 'low';
    url: string;
  };
  type: 'image_url';
}

type MobileUserMessageContentPart =
  | MobileUserMessageContentPartImage
  | MobileUserMessageContentPartText;

interface MobileChatMessage {
  content: string | MobileUserMessageContentPart[];
  role: string;
}

const isImageAttachment = (mimeType: string) => mimeType.startsWith('image/');

const buildAttachmentDisplayContent = (attachments: UploadedAttachment[]) =>
  attachments.map((f) => `[${f.name}]`).join('\n');

const buildUserStreamContent = (
  text: string,
  attachments: UploadedAttachment[],
): MobileChatMessage['content'] => {
  const imageAttachments = attachments.filter((f) => isImageAttachment(f.type));
  const nonImageAttachments = attachments.filter((f) => !isImageAttachment(f.type));

  const textBlocks: string[] = [];
  if (text) textBlocks.push(text);

  if (nonImageAttachments.length > 0) {
    const fileLines = nonImageAttachments.map((f) => `- ${f.name}: ${f.url}`);
    textBlocks.push(`Attached files:\n${fileLines.join('\n')}`);
  }

  const parts: MobileUserMessageContentPart[] = [];
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

interface ChatState {
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
  /** Streaming content buffer for the current generation */
  streamBuffer: string;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesBySession: {},
  generating: false,
  isReasoning: false,
  reasoningStartedAt: null,
  streamBuffer: '',
  editingMessageId: null,

  fetchMessages: async (sessionId: string, topicId?: string) => {
    try {
      const messages = await messageApi.list(sessionId, topicId);
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: messages ?? [],
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
          const result = await useFileStore.getState().uploadFile(file.id);
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

    // Capture context messages synchronously before any await to prevent race conditions
    // (e.g. fetchMessages overwriting the state while we wait for messageApi.create)
    const capturedMessages = get().messagesBySession[sessionId] || [];
    const contextMessages = capturedMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map<MobileChatMessage>((m) => ({
        role: m.role,
        content: m.content,
      }));

    // Persist user message on backend
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
    } catch (err) {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorSendFailed);
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

    set((s) => ({
      generating: true,
      isReasoning: false,
      reasoningStartedAt: null,
      streamBuffer: '',
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] || []), assistantMsg],
      },
    }));
    if (uploadedAttachments.length > 0) {
      useFileStore.getState().clearPending();
    }

    // Stream AI response via XHR (RN fetch lacks ReadableStream support)
    try {
      if (uploadedAttachments.length > 0 && contextMessages.length > 0) {
        const latest = contextMessages.at(-1);
        if (latest?.role === 'user') {
          latest.content = buildUserStreamContent(textContent, uploadedAttachments);
        }
      }

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
      let pendingReasoning: string | null = null;
      let pendingText: string | null = null;
      let throttleTimer: ReturnType<typeof setTimeout> | null = null;

      const flushPending = () => {
        throttleTimer = null;
        const reasoning = pendingReasoning;
        const text = pendingText;
        pendingReasoning = null;
        pendingText = null;

        if (reasoning !== null && text === null) {
          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                m.id === assistantMsgId ? { ...m, reasoning: { content: reasoning } } : m,
              ),
            },
          }));
        } else if (text !== null) {
          const wasReasoning = get().isReasoning;
          if (wasReasoning) {
            const startedAt = get().reasoningStartedAt;
            const duration = startedAt ? Date.now() - startedAt : undefined;
            set((s) => ({
              isReasoning: false,
              streamBuffer: text,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: text,
                        reasoning: m.reasoning ? { ...m.reasoning, duration } : m.reasoning,
                      }
                    : m,
                ),
              },
            }));
          } else {
            set((s) => ({
              streamBuffer: text,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, content: text } : m,
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
          onReasoning: (accReasoning) => {
            if (!get().reasoningStartedAt) {
              set({ isReasoning: true, reasoningStartedAt: Date.now() });
            }
            pendingReasoning = accReasoning;
            scheduleFlush();
          },
          onText: (accText) => {
            pendingText = accText;
            scheduleFlush();
          },
        },
      );

      // Flush any remaining pending updates
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      pendingText = result.text;
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
                ? { ...m, content: result.text, reasoning: { ...m.reasoning, duration } }
                : m,
            ),
          },
        }));
      }

      // Store usage/performance on the assistant message
      if (result.usage || result.performance) {
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    ...(result.usage ? { usage: result.usage as any } : {}),
                    ...(result.performance ? { performance: result.performance as any } : {}),
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
        await messageApi.create({
          sessionId,
          content: result.text,
          role: 'assistant',
          model: chatOptions.model,
          provider,
          parentId: userMessageServerId,
          topicId,
          reasoning: localMsg?.reasoning || undefined,
        });
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
      set({ generating: false, isReasoning: false, reasoningStartedAt: null, streamBuffer: '' });

      // Refresh from server to sync IDs and ensure consistency
      setTimeout(() => get().fetchMessages(sessionId), 1500);
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
    } catch (err) {
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
    } catch (err) {
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
    let contextMessages: { role: string; content: string }[];
    if (target.role === 'assistant') {
      // Remove this assistant message
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).filter((m) => m.id !== messageId),
        },
      }));
      contextMessages = messages
        .slice(0, targetIdx)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
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
      contextMessages = messages
        .slice(0, targetIdx + 1)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
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

    set((s) => ({
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
      let pendingReasoning: string | null = null;
      let pendingText: string | null = null;
      let throttleTimer: ReturnType<typeof setTimeout> | null = null;

      const flushPending = () => {
        throttleTimer = null;
        const reasoning = pendingReasoning;
        const text = pendingText;
        pendingReasoning = null;
        pendingText = null;

        if (reasoning !== null && text === null) {
          set((s) => ({
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                m.id === assistantMsgId ? { ...m, reasoning: { content: reasoning } } : m,
              ),
            },
          }));
        } else if (text !== null) {
          const wasReasoning = get().isReasoning;
          if (wasReasoning) {
            const startedAt = get().reasoningStartedAt;
            const duration = startedAt ? Date.now() - startedAt : undefined;
            set((s) => ({
              isReasoning: false,
              streamBuffer: text,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: text,
                        reasoning: m.reasoning ? { ...m.reasoning, duration } : m.reasoning,
                      }
                    : m,
                ),
              },
            }));
          } else {
            set((s) => ({
              streamBuffer: text,
              messagesBySession: {
                ...s.messagesBySession,
                [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                  m.id === assistantMsgId ? { ...m, content: text } : m,
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
          onReasoning: (accReasoning) => {
            if (!get().reasoningStartedAt) {
              set({ isReasoning: true, reasoningStartedAt: Date.now() });
            }
            pendingReasoning = accReasoning;
            scheduleFlush();
          },
          onText: (accText) => {
            pendingText = accText;
            scheduleFlush();
          },
        },
      );

      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      pendingText = result.text;
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
                ? { ...m, content: result.text, reasoning: { ...m.reasoning, duration } }
                : m,
            ),
          },
        }));
      }

      // Store usage/performance on the regenerated assistant message
      if (result.usage || result.performance) {
        set((s) => ({
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    ...(result.usage ? { usage: result.usage as any } : {}),
                    ...(result.performance ? { performance: result.performance as any } : {}),
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
        await messageApi.create({
          sessionId,
          content: result.text,
          role: 'assistant',
          model: chatOptions.model,
          provider,
          reasoning: localMsg?.reasoning || undefined,
        });
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
      set({ generating: false, isReasoning: false, reasoningStartedAt: null, streamBuffer: '' });
      setTimeout(() => get().fetchMessages(sessionId), 1500);
    }
  },

  setEditingMessage: (id: string | null) => {
    set({ editingMessageId: id });
  },
}));

// Re-export types for backward compat
export type { ChatMessage } from '../types';

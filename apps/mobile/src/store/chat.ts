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
import type { ChatMessage } from '../types';

/**
 * Reads per-session chat settings (model, temperature, systemPrompt)
 * from AsyncStorage. Falls back to global default model if no per-session
 * model is configured.
 */
async function getSessionChatOptions(sessionId: string): Promise<ChatRequestOptions> {
  const opts: ChatRequestOptions = {};
  try {
    const raw = await AsyncStorage.getItem(`minkhub_chat_settings_${sessionId}`);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.model) opts.model = saved.model;
      if (saved.temperature) opts.temperature = parseFloat(saved.temperature);
      if (saved.systemPrompt) opts.systemPrompt = saved.systemPrompt;
    }
  } catch {
    /* ignore */
  }
  // Fallback to global default model if no per-session model
  if (!opts.model) {
    try {
      const globalModel = await AsyncStorage.getItem('minkhub_default_model');
      if (globalModel) opts.model = globalModel;
    } catch {
      /* ignore */
    }
  }
  return opts;
}

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
  /** Messages keyed by sessionId */
  messagesBySession: Record<string, ChatMessage[]>;
  regenerateMessage: (sessionId: string, messageId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string, topicId?: string) => Promise<void>;
  setEditingMessage: (id: string | null) => void;
  /** Streaming content buffer for the current generation */
  streamBuffer: string;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesBySession: {},
  generating: false,
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

  sendMessage: async (sessionId: string, content: string, topicId?: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
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

    // Try to persist on backend
    try {
      await messageApi.create(sessionId, content, topicId);
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
      streamBuffer: '',
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] || []), assistantMsg],
      },
    }));

    // Try streaming AI response
    try {
      const allMessages = get().messagesBySession[sessionId] || [];
      const contextMessages = allMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const chatOptions = await getSessionChatOptions(sessionId);
      const response = await aiChatApi.createAssistantMessage(
        sessionId,
        contextMessages,
        chatOptions,
      );

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          // Update the assistant message content in real-time
          set((s) => ({
            streamBuffer: accumulated,
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                m.id === assistantMsgId ? { ...m, content: accumulated } : m,
              ),
            },
          }));
        }
      }
    } catch (err) {
      console.warn('[ChatStore] AI streaming error:', err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorNetwork);
      // Put a fallback error message
      set((s) => ({
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
            m.id === assistantMsgId ? { ...m, content: useI18n.getState().t.errorNetwork } : m,
          ),
        },
      }));
    } finally {
      set({ generating: false, streamBuffer: '' });

      // Background refresh to sync with server
      get().fetchMessages(sessionId);
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
      streamBuffer: '',
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] || []), assistantMsg],
      },
    }));

    try {
      const chatOptions = await getSessionChatOptions(sessionId);
      const response = await aiChatApi.createAssistantMessage(
        sessionId,
        contextMessages,
        chatOptions,
      );
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          set((s) => ({
            streamBuffer: accumulated,
            messagesBySession: {
              ...s.messagesBySession,
              [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                m.id === assistantMsgId ? { ...m, content: accumulated } : m,
              ),
            },
          }));
        }
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
      set({ generating: false, streamBuffer: '' });
      get().fetchMessages(sessionId);
    }
  },

  setEditingMessage: (id: string | null) => {
    set({ editingMessageId: id });
  },
}));

// Re-export types for backward compat
export type { ChatMessage } from '../types';

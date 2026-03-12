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

/**
 * Lightweight SSE parser for extracting text content from the backend's
 * Server-Sent Events stream. The backend (via model-runtime) sends events
 * with `event: text` and JSON-encoded `data:` lines.
 *
 * Handles partial chunks by maintaining a line buffer across calls.
 */
function extractTextFromSSE(raw: string, lineBuffer: string): { text: string; remaining: string } {
  const combined = lineBuffer + raw;
  const lines = combined.split('\n');
  // The last element might be a partial line — keep it for next chunk
  const remaining = lines.pop() ?? '';

  let text = '';
  let currentEvent = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const dataStr = line.slice(5).trim();
      // Only extract text content (skip tool_calls, usage, etc.)
      if (currentEvent === 'text' || currentEvent === '') {
        try {
          const parsed = JSON.parse(dataStr);
          if (typeof parsed === 'string') {
            text += parsed;
          }
        } catch {
          // If not valid JSON, use as-is (some providers send plain text)
          if (dataStr) text += dataStr;
        }
      }
      // Reset event after processing data (each event: + data: pair is one SSE event)
    } else if (line.trim() === '') {
      // Empty line marks end of SSE event block — reset event type
      currentEvent = '';
    }
  }

  return { text, remaining };
}

/**
 * Reads an SSE stream from the response body and calls onChunk with the
 * extracted text for each chunk. Returns the full accumulated text.
 */
async function readSSEStream(
  response: Response,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let lineBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const { text, remaining } = extractTextFromSSE(chunk, lineBuffer);
    lineBuffer = remaining;

    if (text) {
      accumulated += text;
      onChunk(accumulated);
    }
  }

  // Flush any remaining buffer
  if (lineBuffer.trim()) {
    const { text } = extractTextFromSSE('\n', lineBuffer);
    if (text) {
      accumulated += text;
      onChunk(accumulated);
    }
  }

  return accumulated;
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
      const provider = chatOptions.provider || 'openai';
      const response = await aiChatApi.createAssistantMessage(
        provider,
        contextMessages,
        chatOptions,
      );

      await readSSEStream(response, (accumulated) => {
        set((s) => ({
          streamBuffer: accumulated,
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId ? { ...m, content: accumulated } : m,
            ),
          },
        }));
      });
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
      const provider = chatOptions.provider || 'openai';
      const response = await aiChatApi.createAssistantMessage(
        provider,
        contextMessages,
        chatOptions,
      );

      await readSSEStream(response, (accumulated) => {
        set((s) => ({
          streamBuffer: accumulated,
          messagesBySession: {
            ...s.messagesBySession,
            [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
              m.id === assistantMsgId ? { ...m, content: accumulated } : m,
            ),
          },
        }));
      });
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

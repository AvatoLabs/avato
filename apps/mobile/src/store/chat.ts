/**
 * Chat (message) store — manages messages for the active session.
 *
 * Mirrors the web chat store logic:
 *   - Fetch messages from backend
 *   - Send user messages, trigger AI response
 *   - Handle streaming responses
 */
import { create } from 'zustand';

import { aiChatApi, messageApi } from '../lib/api';
import type { ChatMessage } from '../types';

interface ChatState {
    /** Messages keyed by sessionId */
    messagesBySession: Record<string, ChatMessage[]>;
    /** Whether a message is currently being generated */
    generating: boolean;
    /** Streaming content buffer for the current generation */
    streamBuffer: string;

    // Actions
    fetchMessages: (sessionId: string) => Promise<void>;
    sendMessage: (sessionId: string, content: string) => Promise<void>;
    clearMessages: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    messagesBySession: {},
    generating: false,
    streamBuffer: '',

    fetchMessages: async (sessionId: string) => {
        try {
            const messages = await messageApi.list(sessionId);
            set((s) => ({
                messagesBySession: {
                    ...s.messagesBySession,
                    [sessionId]: messages ?? [],
                },
            }));
        } catch (err) {
            console.warn('[ChatStore] fetchMessages error:', err);
        }
    },

    sendMessage: async (sessionId: string, content: string) => {
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
            await messageApi.create(sessionId, content);
        } catch (err) {
            console.warn('[ChatStore] persist user message error:', err);
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

            const response = await aiChatApi.createAssistantMessage(sessionId, contextMessages);

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
            // Put a fallback error message
            set((s) => ({
                messagesBySession: {
                    ...s.messagesBySession,
                    [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
                        m.id === assistantMsgId
                            ? { ...m, content: "I'm having trouble connecting. Please check your network." }
                            : m,
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
}));

// Re-export types for backward compat
export type { ChatMessage } from '../types';

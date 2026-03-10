import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: number;
}

export interface ChatSession {
    id: string;
    title: string;
    description?: string;
    avatar?: string;
    updatedAt: number;
}

interface ChatStoreState {
    sessions: ChatSession[];
    messages: Record<string, ChatMessage[]>;
    activeSessionId: string | null;
}

interface ChatStoreActions {
    createSession: (title?: string) => string;
    deleteSession: (id: string) => void;
    setActiveSession: (id: string) => void;
    sendMessage: (sessionId: string, content: string) => void;
    clearMessages: (sessionId: string) => void;
}

export const useChatStore = create<ChatStoreState & ChatStoreActions>()(
    persist(
        (set, get) => ({
            sessions: [
                {
                    id: 'default',
                    title: 'Welcome to MinkHub',
                    description: 'A new chat experience is here.',
                    updatedAt: Date.now(),
                },
            ],
            messages: {
                default: [
                    {
                        id: 'init-msg',
                        role: 'assistant',
                        content: 'Hello! I am MinkHub. How can I help you today?',
                        createdAt: Date.now(),
                    },
                ],
            },
            activeSessionId: null,

            createSession: (title = 'New Chat') => {
                const id = `session-${Date.now()}`;
                set((state) => ({
                    sessions: [
                        { id, title, updatedAt: Date.now() },
                        ...state.sessions,
                    ],
                    messages: { ...state.messages, [id]: [] },
                }));
                return id;
            },

            deleteSession: (id) => {
                set((state) => {
                    const newSessions = state.sessions.filter((s) => s.id !== id);
                    const newMessages = { ...state.messages };
                    delete newMessages[id];
                    return {
                        sessions: newSessions,
                        messages: newMessages,
                        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
                    };
                });
            },

            setActiveSession: (id) => set({ activeSessionId: id }),

            sendMessage: (sessionId, content) => {
                const userMsg: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    role: 'user',
                    content,
                    createdAt: Date.now(),
                };

                // Add user message
                set((state) => ({
                    messages: {
                        ...state.messages,
                        [sessionId]: [...(state.messages[sessionId] || []), userMsg],
                    },
                    sessions: state.sessions.map((s) =>
                        s.id === sessionId ? { ...s, updatedAt: Date.now() } : s
                    ),
                }));

                // Mock assistant response (In a real app, this calls tRPC / streaming API)
                setTimeout(() => {
                    const assistantMsg: ChatMessage = {
                        id: `msg-${Date.now()}-reply`,
                        role: 'assistant',
                        content: `This is a mock response from MinkHub for: "${content}"`,
                        createdAt: Date.now(),
                    };
                    set((state) => ({
                        messages: {
                            ...state.messages,
                            [sessionId]: [...(state.messages[sessionId] || []), assistantMsg],
                        },
                        sessions: state.sessions.map((s) =>
                            s.id === sessionId ? { ...s, updatedAt: Date.now() } : s
                        ),
                    }));
                }, 1000);
            },

            clearMessages: (sessionId) => {
                set((state) => ({
                    messages: { ...state.messages, [sessionId]: [] },
                }));
            },
        }),
        {
            name: 'minkhub-chat-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

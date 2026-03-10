/**
 * Session store — manages the chat session list.
 *
 * Mirrors the web `useSessionStore` logic:
 *   - Fetch sessions from backend on mount
 *   - Create / remove / pin / switch sessions
 *   - Persist active session ID locally
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { sessionApi } from '../lib/api';
import type { ChatSession } from '../types';

interface SessionState {
    /** Whether the initial fetch has completed */
    initialized: boolean;
    loading: boolean;
    sessions: ChatSession[];
    activeSessionId: string | null;

    // Actions
    fetchSessions: () => Promise<void>;
    createSession: (title?: string) => Promise<string>;
    removeSession: (id: string) => Promise<void>;
    switchSession: (id: string) => void;
    pinSession: (id: string) => Promise<void>;
    unpinSession: (id: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
    initialized: false,
    loading: false,
    sessions: [],
    activeSessionId: null,

    fetchSessions: async () => {
        set({ loading: true });
        try {
            const sessions = await sessionApi.list();
            const stored = await AsyncStorage.getItem('activeSessionId');
            set({
                sessions: sessions ?? [],
                activeSessionId: stored || (sessions?.[0]?.id ?? null),
                initialized: true,
                loading: false,
            });
        } catch (err) {
            console.warn('[SessionStore] fetchSessions error:', err);
            set({ loading: false, initialized: true });
        }
    },

    createSession: async (title = 'New Conversation') => {
        try {
            const result = await sessionApi.create(title);
            const newId = result?.id ?? `local-${Date.now()}`;

            // Optimistic: add a placeholder locally then refresh
            const placeholder: ChatSession = {
                id: newId,
                title,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            set((s) => ({
                sessions: [placeholder, ...s.sessions],
                activeSessionId: newId,
            }));

            await AsyncStorage.setItem('activeSessionId', newId);

            // Background refresh
            get().fetchSessions();
            return newId;
        } catch (err) {
            console.warn('[SessionStore] createSession error:', err);
            // Fallback to local-only session
            const localId = `local-${Date.now()}`;
            const fallback: ChatSession = {
                id: localId,
                title,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            set((s) => ({
                sessions: [fallback, ...s.sessions],
                activeSessionId: localId,
            }));
            return localId;
        }
    },

    removeSession: async (id: string) => {
        set((s) => ({
            sessions: s.sessions.filter((sess) => sess.id !== id),
            activeSessionId: s.activeSessionId === id ? (s.sessions[0]?.id ?? null) : s.activeSessionId,
        }));
        try {
            await sessionApi.remove(id);
        } catch (err) {
            console.warn('[SessionStore] removeSession error:', err);
        }
    },

    switchSession: (id: string) => {
        set({ activeSessionId: id });
        AsyncStorage.setItem('activeSessionId', id);
    },

    pinSession: async (id: string) => {
        set((s) => ({
            sessions: s.sessions.map((sess) =>
                sess.id === id ? { ...sess, pinned: true } : sess,
            ),
        }));
        try {
            await sessionApi.pin(id);
        } catch (err) {
            console.warn('[SessionStore] pinSession error:', err);
        }
    },

    unpinSession: async (id: string) => {
        set((s) => ({
            sessions: s.sessions.map((sess) =>
                sess.id === id ? { ...sess, pinned: false } : sess,
            ),
        }));
        try {
            await sessionApi.unpin(id);
        } catch (err) {
            console.warn('[SessionStore] unpinSession error:', err);
        }
    },
}));

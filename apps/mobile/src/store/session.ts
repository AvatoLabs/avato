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

import { useToast } from '../components/ui/Toast';
import { sessionApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { ChatSession } from '../types';

interface SessionState {
  activeSessionId: string | null;
  createSession: (title?: string) => Promise<string>;
  duplicateSession: (id: string) => Promise<string | null>;
  // Actions
  fetchSessions: () => Promise<void>;

  /** Whether the initial fetch has completed */
  initialized: boolean;
  loading: boolean;
  moveToGroup: (sessionId: string, groupId: string) => Promise<void>;
  pinSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  sessions: ChatSession[];
  switchSession: (id: string) => void;
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
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
      set({ loading: false, initialized: true });
    }
  },

  createSession: async (title = 'New Conversation') => {
    try {
      // sessionApi.create now returns the session ID string directly
      const newId = (await sessionApi.create(title)) ?? `local-${Date.now()}`;

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
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
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
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorDeleteFailed);
    }
  },

  switchSession: (id: string) => {
    set({ activeSessionId: id });
    AsyncStorage.setItem('activeSessionId', id);
  },

  pinSession: async (id: string) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, pinned: true } : sess)),
    }));
    try {
      await sessionApi.pin(id);
    } catch (err) {
      console.warn('[SessionStore] pinSession error:', err);
    }
  },

  unpinSession: async (id: string) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, pinned: false } : sess)),
    }));
    try {
      await sessionApi.unpin(id);
    } catch (err) {
      console.warn('[SessionStore] unpinSession error:', err);
    }
  },

  moveToGroup: async (sessionId: string, groupId: string) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, groupId } : sess)),
    }));
    try {
      await sessionApi.updateGroup(sessionId, groupId);
    } catch (err) {
      console.warn('[SessionStore] moveToGroup error:', err);
      get().fetchSessions();
    }
  },

  duplicateSession: async (id: string) => {
    try {
      // cloneSession returns the new session ID string directly
      const newId = await sessionApi.duplicate(id);
      if (newId) {
        get().fetchSessions();
        return newId;
      }
      return null;
    } catch (err) {
      console.warn('[SessionStore] duplicateSession error:', err);
      return null;
    }
  },

  renameSession: async (id: string, title: string) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, title } : sess)),
    }));
    try {
      await sessionApi.rename(id, title);
    } catch (err) {
      console.warn('[SessionStore] renameSession error:', err);
      get().fetchSessions();
    }
  },
}));

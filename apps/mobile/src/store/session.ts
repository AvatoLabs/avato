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
import { agentApi, sessionApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { ChatSession, CreateSessionConfig } from '../types';

interface SessionState {
  activeSessionId: string | null;
  createSession: (titleOrConfig?: string | CreateSessionConfig) => Promise<string>;
  duplicateSession: (id: string) => Promise<string | null>;
  // Actions
  fetchSessions: () => Promise<void>;

  /** Whether the initial fetch has completed */
  initialized: boolean;
  loading: boolean;
  moveToGroup: (sessionId: string, groupId: string) => Promise<void>;
  /** IDs currently being deleted — fetchSessions filters these out to prevent "resurrection" */
  pendingDeletes: Set<string>;
  pinSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  reset: () => void;
  sessions: ChatSession[];
  switchSession: (id: string) => void;
  unpinSession: (id: string) => Promise<void>;
  /** Immediately update model/provider on a session (local-only, for instant UI feedback) */
  updateSessionMeta: (id: string, meta: { model?: string; provider?: string }) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  initialized: false,
  loading: false,
  sessions: [],
  activeSessionId: null,
  pendingDeletes: new Set<string>(),

  reset: () => {
    void AsyncStorage.removeItem('activeSessionId');
    set({
      activeSessionId: null,
      initialized: false,
      loading: false,
      pendingDeletes: new Set<string>(),
      sessions: [],
    });
  },

  fetchSessions: async () => {
    set({ loading: true });
    try {
      const sessions = await sessionApi.list();
      const stored = await AsyncStorage.getItem('activeSessionId');

      // Overlay per-session model/provider from AsyncStorage only when server has no value
      const settingsKeys = (sessions ?? []).map((s) => `avato_chat_settings_${s.id}`);
      if (settingsKeys.length > 0) {
        try {
          const pairs = await AsyncStorage.multiGet(settingsKeys);
          for (const [key, raw] of pairs) {
            if (!raw) continue;
            try {
              const saved = JSON.parse(raw);
              const sid = key.replace('avato_chat_settings_', '');
              const sess = sessions?.find((s) => s.id === sid);
              if (sess) {
                if (!sess.model && saved.model) sess.model = saved.model;
                if (!sess.provider && saved.provider) sess.provider = saved.provider;
              }
            } catch {
              /* ignore parse error */
            }
          }
        } catch {
          /* multiGet failed, use server-side values */
        }
      }

      const pending = get().pendingDeletes;
      const filtered = (sessions ?? []).filter((s) => !pending.has(s.id));

      set({
        sessions: filtered,
        activeSessionId: stored || (filtered[0]?.id ?? null),
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

  createSession: async (titleOrConfig) => {
    const config: CreateSessionConfig =
      typeof titleOrConfig === 'string' ? { title: titleOrConfig } : (titleOrConfig ?? {});
    const title = config.title || 'New Conversation';

    try {
      const agentConfig: Record<string, unknown> = { title };
      if (config.description) agentConfig.description = config.description;
      if (config.avatar) agentConfig.avatar = config.avatar;
      if (config.systemPrompt) agentConfig.systemRole = config.systemPrompt;
      if (config.model) agentConfig.model = config.model;
      if (config.provider) agentConfig.provider = config.provider;
      if (config.plugins) agentConfig.plugins = config.plugins;

      const result = await agentApi.create(agentConfig, config.groupId);
      const newId = result?.sessionId ?? `local-${Date.now()}`;

      const placeholder: ChatSession = {
        id: newId,
        title,
        agentId: result?.agentId,
        avatar: config.avatar,
        model: config.model,
        provider: config.provider,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((s) => ({
        sessions: [placeholder, ...s.sessions],
        activeSessionId: newId,
      }));

      await AsyncStorage.setItem('activeSessionId', newId);

      get().fetchSessions();
      return newId;
    } catch (err) {
      console.warn('[SessionStore] createSession error:', err);
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
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
    const target = get().sessions.find((s) => s.id === id);
    const isChatGroup = target?.type === 'group';
    const nextPending = new Set(get().pendingDeletes);
    nextPending.add(id);

    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      activeSessionId: s.activeSessionId === id ? (s.sessions[0]?.id ?? null) : s.activeSessionId,
      pendingDeletes: nextPending,
    }));

    try {
      if (isChatGroup) {
        await sessionApi.removeChatGroup(id);
      } else {
        await sessionApi.remove(id);
      }
    } catch (err) {
      console.error('[SessionStore] removeSession FAILED:', id, err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.errorDeleteFailed);
    } finally {
      const cleaned = new Set(get().pendingDeletes);
      cleaned.delete(id);
      set({ pendingDeletes: cleaned });
      get().fetchSessions();
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

  updateSessionMeta: (id: string, meta: { model?: string; provider?: string }) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, ...meta } : sess)),
    }));
  },
}));

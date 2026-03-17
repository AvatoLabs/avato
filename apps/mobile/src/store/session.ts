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
import { agentGroupApi, sessionApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { ChatSession, CreateSessionConfig } from '../types';

type FetchSessionsOptions = {
  throwOnError?: boolean;
};

/** In-flight promise for request deduplication (avoids concurrent duplicate fetches) */
let fetchSessionsInFlight: Promise<ChatSession[]> | null = null;

interface SessionState {
  activeSessionId: string | null;
  createSession: (titleOrConfig?: string | CreateSessionConfig) => Promise<string>;
  duplicateSession: (id: string) => Promise<string | null>;
  errorMessage: string | null;
  // Actions
  fetchSessions: (options?: FetchSessionsOptions) => Promise<ChatSession[]>;

  /** Whether the initial fetch has completed */
  initialized: boolean;
  loading: boolean;
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
  updateSessionTag: (id: string, tagId?: string | null) => Promise<void>;
  /** Update session title locally (e.g. after auto-generation) */
  updateSessionTitle: (id: string, title: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  initialized: false,
  loading: false,
  errorMessage: null,
  sessions: [],
  activeSessionId: null,
  pendingDeletes: new Set<string>(),

  reset: () => {
    fetchSessionsInFlight = null;
    void AsyncStorage.removeItem('activeSessionId');
    set({
      activeSessionId: null,
      errorMessage: null,
      initialized: false,
      loading: false,
      pendingDeletes: new Set<string>(),
      sessions: [],
    });
  },

  fetchSessions: async (options) => {
    if (fetchSessionsInFlight) {
      try {
        return await fetchSessionsInFlight;
      } catch (e) {
        if (options?.throwOnError) throw e;
        return [];
      }
    }

    const promise = (async () => {
      set({ loading: true });
      try {
        const sessions = await sessionApi.list();
        const stored = await AsyncStorage.getItem('activeSessionId');

        const pending = get().pendingDeletes;
        const filtered = (sessions ?? []).filter((s) => !pending.has(s.id));
        const nextActiveSessionId =
          stored && filtered.some((session) => session.id === stored)
            ? stored
            : (filtered[0]?.id ?? null);

        set({
          sessions: filtered,
          activeSessionId: nextActiveSessionId,
          errorMessage: null,
          initialized: true,
          loading: false,
        });
        return filtered;
      } catch (err) {
        const { messageKey } = classifyError(err);
        const t = useI18n.getState().t;
        useToast.getState().show('error', t[messageKey], {
          onRetry: () => void get().fetchSessions(),
        });
        set({ errorMessage: t[messageKey], loading: false, initialized: true });
        if (options?.throwOnError) throw err;
        return [];
      } finally {
        fetchSessionsInFlight = null;
      }
    })();

    fetchSessionsInFlight = promise;
    return promise;
  },

  createSession: async (titleOrConfig) => {
    const inputConfig: CreateSessionConfig =
      typeof titleOrConfig === 'string' ? { title: titleOrConfig } : (titleOrConfig ?? {});
    const requestConfig: CreateSessionConfig = {
      avatar: inputConfig.avatar,
      description: inputConfig.description,
      model: inputConfig.model,
      plugins: inputConfig.plugins,
      provider: inputConfig.provider,
      systemPrompt: inputConfig.systemPrompt,
      tagId: inputConfig.tagId,
      title: inputConfig.title,
    };
    const title = requestConfig.title || 'New Conversation';

    try {
      const newId = await sessionApi.create(requestConfig);

      const placeholder: ChatSession = {
        id: newId,
        title,
        avatar: requestConfig.avatar,
        description: requestConfig.description,
        model: requestConfig.model,
        provider: requestConfig.provider,
        tagId: requestConfig.tagId,
        type: 'agent',
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
      throw err;
    }
  },

  removeSession: async (id: string) => {
    const target = get().sessions.find((s) => s.id === id);
    const isChatGroup = target?.type === 'group';
    const nextPending = new Set(get().pendingDeletes);
    nextPending.add(id);

    set((s) => {
      const remaining = s.sessions.filter((sess) => sess.id !== id);
      return {
        sessions: remaining,
        activeSessionId: s.activeSessionId === id ? (remaining[0]?.id ?? null) : s.activeSessionId,
        pendingDeletes: nextPending,
      };
    });

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
      const target = get().sessions.find((session) => session.id === id);

      if (target?.type === 'group') {
        await agentGroupApi.updateGroup(id, { title });
      } else {
        await sessionApi.rename(id, title);
      }
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

  updateSessionTag: async (id: string, tagId?: string | null) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, tagId: tagId || undefined } : sess,
      ),
    }));
    try {
      await sessionApi.updateTag(id, tagId);
    } catch (err) {
      console.warn('[SessionStore] updateSessionTag error:', err);
      get().fetchSessions();
      throw err;
    }
  },

  updateSessionTitle: (id: string, title: string) => {
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, title } : sess)),
    }));
  },
}));

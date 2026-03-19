/**
 * Topic store — manages topics for the active session.
 */
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import { topicApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import { navigateToLogin } from '../lib/navigation';
import { resolveSessionTypeWithFallback } from '../lib/session';
import type { Topic } from '../types';
import { useSessionStore } from './session';

/** In-flight promises by sessionId for request deduplication */
const fetchTopicsInFlight = new Map<string, Promise<void>>();

interface TopicState {
  activeTopicBySession: Record<string, string | null>;
  createTopic: (
    sessionId: string,
    title: string,
    options?: { messageIds?: string[]; tagId?: string | null },
  ) => Promise<Topic | null>;
  favoriteTopic: (id: string) => Promise<void>;
  fetchTopics: (sessionId: string) => Promise<void>;
  loadingBySession: Record<string, boolean>;
  removeTopic: (id: string, sessionId: string) => Promise<void>;
  switchTopic: (sessionId: string, topicId: string | null) => void;
  topicsBySession: Record<string, Topic[]>;
  updateTopic: (id: string, sessionId: string, title: string) => Promise<void>;
  updateTopicTag: (id: string, sessionId: string, tagId?: string | null) => Promise<void>;
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topicsBySession: {},
  activeTopicBySession: {},
  loadingBySession: {},

  fetchTopics: async (sessionId: string) => {
    const existing = fetchTopicsInFlight.get(sessionId);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      set((s) => ({
        loadingBySession: { ...s.loadingBySession, [sessionId]: true },
      }));
      try {
        const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
        const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
        const topics = await topicApi.list(sessionId, { sessionType });
        set((s) => {
          const nextTopics = topics ?? [];
          const activeTopic = s.activeTopicBySession[sessionId] ?? null;
          const activeStillExists = activeTopic
            ? nextTopics.some((topic) => topic.id === activeTopic)
            : false;
          const nextActiveTopic = activeStillExists ? activeTopic : (nextTopics[0]?.id ?? null);

          return {
            activeTopicBySession: {
              ...s.activeTopicBySession,
              [sessionId]: nextActiveTopic,
            },
            loadingBySession: { ...s.loadingBySession, [sessionId]: false },
            topicsBySession: { ...s.topicsBySession, [sessionId]: nextTopics },
          };
        });
      } catch (err) {
        const { messageKey, type } = classifyError(err);
        const t = useI18n.getState().t;
        useToast.getState().show('error', t[messageKey], {
          onRetry: type === 'auth' ? navigateToLogin : () => void get().fetchTopics(sessionId),
          retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
        });
        set((s) => ({
          loadingBySession: { ...s.loadingBySession, [sessionId]: false },
        }));
      } finally {
        fetchTopicsInFlight.delete(sessionId);
      }
    })();

    fetchTopicsInFlight.set(sessionId, promise);
    await promise;
  },

  createTopic: async (
    sessionId: string,
    title: string,
    options?: { messageIds?: string[]; tagId?: string | null },
  ) => {
    try {
      const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
      const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
      // createTopic now returns the topic ID string, not a full Topic object
      const topicId = await topicApi.create(sessionId, title, {
        messageIds: options?.messageIds,
        sessionType,
        tagId: options?.tagId,
      });
      if (topicId) {
        const placeholder: Topic = {
          id: topicId,
          title,
          sessionId,
          tagId: options?.tagId ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          topicsBySession: {
            ...s.topicsBySession,
            [sessionId]: [placeholder, ...(s.topicsBySession[sessionId] ?? [])],
          },
        }));
        return placeholder;
      }
      return null;
    } catch (err) {
      console.warn('[TopicStore] createTopic error:', err);
      return null;
    }
  },

  removeTopic: async (id: string, sessionId: string) => {
    set((s) => ({
      activeTopicBySession: {
        ...s.activeTopicBySession,
        [sessionId]:
          s.activeTopicBySession[sessionId] === id
            ? null
            : (s.activeTopicBySession[sessionId] ?? null),
      },
      topicsBySession: {
        ...s.topicsBySession,
        [sessionId]: (s.topicsBySession[sessionId] ?? []).filter((t) => t.id !== id),
      },
    }));
    try {
      await topicApi.remove(id);
    } catch (err) {
      console.warn('[TopicStore] removeTopic error:', err);
      get().fetchTopics(sessionId);
    }
  },

  switchTopic: (sessionId: string, topicId: string | null) => {
    set((s) => ({
      activeTopicBySession: { ...s.activeTopicBySession, [sessionId]: topicId },
    }));
  },

  favoriteTopic: async (id: string) => {
    set((s) => ({
      topicsBySession: Object.fromEntries(
        Object.entries(s.topicsBySession).map(([sessionId, topics]) => [
          sessionId,
          topics.map((topic) =>
            topic.id === id ? { ...topic, favorite: !topic.favorite } : topic,
          ),
        ]),
      ),
    }));
    try {
      await topicApi.favorite(id);
    } catch (err) {
      console.warn('[TopicStore] favoriteTopic error:', err);
    }
  },

  updateTopic: async (id: string, sessionId: string, title: string) => {
    set((s) => ({
      topicsBySession: {
        ...s.topicsBySession,
        [sessionId]: (s.topicsBySession[sessionId] ?? []).map((topic) =>
          topic.id === id ? { ...topic, title } : topic,
        ),
      },
    }));
    try {
      await topicApi.update(id, { title });
    } catch (err) {
      console.warn('[TopicStore] updateTopic error:', err);
    }
  },

  updateTopicTag: async (id: string, sessionId: string, tagId?: string | null) => {
    set((s) => ({
      topicsBySession: {
        ...s.topicsBySession,
        [sessionId]: (s.topicsBySession[sessionId] ?? []).map((topic) =>
          topic.id === id ? { ...topic, tagId: tagId ?? null } : topic,
        ),
      },
    }));
    try {
      await topicApi.update(id, { tagId: tagId ?? null });
    } catch (err) {
      console.warn('[TopicStore] updateTopicTag error:', err);
      get().fetchTopics(sessionId);
      throw err;
    }
  },
}));

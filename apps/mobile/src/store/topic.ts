/**
 * Topic store — manages topics for the active session.
 */
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import { topicApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import { resolveSessionTypeWithFallback } from '../lib/session';
import type { Topic } from '../types';
import { useSessionStore } from './session';

interface TopicState {
  activeTopicBySession: Record<string, string | null>;
  createTopic: (
    sessionId: string,
    title: string,
    options?: { messageIds?: string[] },
  ) => Promise<Topic | null>;
  favoriteTopic: (id: string) => Promise<void>;
  fetchTopics: (sessionId: string) => Promise<void>;
  loadingBySession: Record<string, boolean>;
  removeTopic: (id: string, sessionId: string) => Promise<void>;
  switchTopic: (sessionId: string, topicId: string | null) => void;
  topicsBySession: Record<string, Topic[]>;
  updateTopic: (id: string, sessionId: string, title: string) => Promise<void>;
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topicsBySession: {},
  activeTopicBySession: {},
  loadingBySession: {},

  fetchTopics: async (sessionId: string) => {
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
          : true;

        return {
          activeTopicBySession: {
            ...s.activeTopicBySession,
            [sessionId]: activeStillExists ? activeTopic : null,
          },
          loadingBySession: { ...s.loadingBySession, [sessionId]: false },
          topicsBySession: { ...s.topicsBySession, [sessionId]: nextTopics },
        };
      });
    } catch (err) {
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
      set((s) => ({
        loadingBySession: { ...s.loadingBySession, [sessionId]: false },
      }));
    }
  },

  createTopic: async (sessionId: string, title: string, options?: { messageIds?: string[] }) => {
    try {
      const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId);
      const sessionType = resolveSessionTypeWithFallback(sessionId, session?.type);
      // createTopic now returns the topic ID string, not a full Topic object
      const topicId = await topicApi.create(sessionId, title, {
        messageIds: options?.messageIds,
        sessionType,
      });
      if (topicId) {
        const placeholder: Topic = {
          id: topicId,
          title,
          sessionId,
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
      await topicApi.update(id, title);
    } catch (err) {
      console.warn('[TopicStore] updateTopic error:', err);
    }
  },
}));

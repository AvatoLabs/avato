/**
 * Topic store — manages topics for the active session.
 */
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import { topicApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { useI18n } from '../lib/i18n';
import type { Topic } from '../types';

interface TopicState {
  activeTopic: string | null;
  createTopic: (sessionId: string, title: string) => Promise<Topic | null>;
  favoriteTopic: (id: string) => Promise<void>;

  fetchTopics: (sessionId: string) => Promise<void>;
  loading: boolean;
  removeTopic: (id: string, sessionId: string) => Promise<void>;
  switchTopic: (topicId: string | null) => void;
  topics: Topic[];
  updateTopic: (id: string, title: string) => Promise<void>;
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: [],
  activeTopic: null,
  loading: false,

  fetchTopics: async (sessionId: string) => {
    set({ loading: true });
    try {
      const topics = await topicApi.list(sessionId);
      set({ topics: topics ?? [], loading: false });
    } catch (err) {
      const { messageKey } = classifyError(err);
      const t = useI18n.getState().t;
      useToast.getState().show('error', t[messageKey]);
      set({ loading: false });
    }
  },

  createTopic: async (sessionId: string, title: string) => {
    try {
      // createTopic now returns the topic ID string, not a full Topic object
      const topicId = await topicApi.create(sessionId, title);
      if (topicId) {
        const placeholder: Topic = {
          id: topicId,
          title,
          sessionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ topics: [placeholder, ...s.topics] }));
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
      topics: s.topics.filter((t) => t.id !== id),
      activeTopic: s.activeTopic === id ? null : s.activeTopic,
    }));
    try {
      await topicApi.remove(id);
    } catch (err) {
      console.warn('[TopicStore] removeTopic error:', err);
      get().fetchTopics(sessionId);
    }
  },

  switchTopic: (topicId: string | null) => {
    set({ activeTopic: topicId });
  },

  favoriteTopic: async (id: string) => {
    set((s) => ({
      topics: s.topics.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)),
    }));
    try {
      await topicApi.favorite(id);
    } catch (err) {
      console.warn('[TopicStore] favoriteTopic error:', err);
    }
  },

  updateTopic: async (id: string, title: string) => {
    set((s) => ({
      topics: s.topics.map((t) => (t.id === id ? { ...t, title } : t)),
    }));
    try {
      await topicApi.update(id, title);
    } catch (err) {
      console.warn('[TopicStore] updateTopic error:', err);
    }
  },
}));

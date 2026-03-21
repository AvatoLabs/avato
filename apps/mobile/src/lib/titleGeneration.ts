import { useSessionStore } from '../store/session';
import { useTopicStore } from '../store/topic';
import { sessionApi, topicApi } from './api';

export interface GenerateBestTitleParams {
  force?: boolean;
  sessionId: string;
  topicId?: string | null;
}

export interface GenerateBestTitleResult {
  target: 'session' | 'topic';
  title: string;
}

const trimGeneratedTitle = (value?: string | null) => value?.trim() || '';

export const generateBestTitle = async ({
  force = true,
  sessionId,
  topicId,
}: GenerateBestTitleParams): Promise<GenerateBestTitleResult | null> => {
  const refreshTopics = async () => {
    await Promise.allSettled([useTopicStore.getState().fetchTopics(sessionId)]);
  };

  const refreshSession = async () => {
    await Promise.allSettled([useSessionStore.getState().fetchSessions()]);
  };

  if (topicId) {
    try {
      const nextTopicTitle = trimGeneratedTitle(await topicApi.generateTitle(topicId, { force }));
      if (nextTopicTitle) {
        useTopicStore.setState((state) => ({
          topicsBySession: {
            ...state.topicsBySession,
            [sessionId]: (state.topicsBySession[sessionId] ?? []).map((topic) =>
              topic.id === topicId ? { ...topic, title: nextTopicTitle } : topic,
            ),
          },
        }));
        await refreshTopics();
        return { target: 'topic', title: nextTopicTitle };
      }
    } catch (error) {
      console.warn('[titleGeneration] topic title generation failed:', error);
    }

    return null;
  }

  try {
    const nextSessionTitle = trimGeneratedTitle(await sessionApi.generateTitle(sessionId));
    if (nextSessionTitle) {
      useSessionStore.getState().updateSessionTitle(sessionId, nextSessionTitle);
      await refreshSession();
      return { target: 'session', title: nextSessionTitle };
    }
  } catch (error) {
    console.warn('[titleGeneration] session title generation failed:', error);
  }

  return null;
};

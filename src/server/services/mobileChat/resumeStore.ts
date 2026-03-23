import type { ChatToolPayload } from '@lobechat/types';

const TTL_MS = 30 * 60 * 1000;

export interface MobileInterventionResumeState {
  createdAt: number;
  loopMessages: any[];
  payload: any;
  pendingToolCalls: ChatToolPayload[];
  round: number;
  toolSet: any;
  userId: string;
}

const store = new Map<string, MobileInterventionResumeState>();

const resumeKey = (userId: string, sessionId: string, topicId?: string) =>
  `${userId}:${sessionId}:${topicId ?? 'null'}`;

export function getMobileInterventionResumeStore() {
  return {
    get(key: string) {
      const state = store.get(key);
      if (!state) return undefined;
      if (Date.now() - state.createdAt > TTL_MS) {
        store.delete(key);
        return undefined;
      }
      return state;
    },
    key: resumeKey,
    set(key: string, state: Omit<MobileInterventionResumeState, 'createdAt'>) {
      store.set(key, { ...state, createdAt: Date.now() });
    },
    delete(key: string) {
      store.delete(key);
    },
  };
}

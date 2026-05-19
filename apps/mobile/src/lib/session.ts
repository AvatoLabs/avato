import type { ChatSession } from '../types';

const GROUP_SESSION_ID_PREFIX = 'cg_';

export const looksLikeGroupSessionId = (sessionId?: string | null) =>
  typeof sessionId === 'string' && sessionId.startsWith(GROUP_SESSION_ID_PREFIX);

export const isGroupSessionLike = (
  sessionId?: string | null,
  sessionType?: ChatSession['type'],
) => sessionType === 'group' || looksLikeGroupSessionId(sessionId);

export const resolveSessionTypeWithFallback = (
  sessionId?: string | null,
  sessionType?: ChatSession['type'],
): 'agent' | 'group' => (isGroupSessionLike(sessionId, sessionType) ? 'group' : 'agent');

import type { LobeSessions } from './agentSession';
import type { LobeSessionGroups, SessionGroupId } from './sessionGroup';
import type { SessionTagId } from './sessionTag';

export * from './agentSession';
export * from './sessionGroup';
export * from './sessionTag';

export interface ChatSessionList {
  sessionGroups: LobeSessionGroups;
  sessions: LobeSessions;
}

export interface UpdateSessionParams {
  group?: SessionGroupId;
  meta?: any;
  pinned?: boolean;
  tagId?: SessionTagId | null;
  updatedAt: Date;
}

export interface SessionRankItem {
  avatar: string | null;
  backgroundColor: string | null;
  count: number;
  id: string;
  title: string | null;
}

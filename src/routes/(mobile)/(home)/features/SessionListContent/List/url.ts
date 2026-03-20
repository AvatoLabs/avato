import { GROUP_CHAT_URL, SESSION_CHAT_URL } from '@lobechat/const';

import { type LobeSession, LobeSessionType } from '@/types/session';

export const getSessionListItemUrl = (session: LobeSession, mobile?: boolean) =>
  session.type === LobeSessionType.Group
    ? GROUP_CHAT_URL(session.id)
    : SESSION_CHAT_URL(session.id, mobile);

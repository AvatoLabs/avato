import { GROUP_CHAT_URL, SESSION_CHAT_URL } from '@lobechat/const';
import { describe, expect, it } from 'vitest';

import { type LobeAgentSession, type LobeGroupSession, LobeSessionType } from '@/types/session';

import { getSessionListItemUrl } from './url';

describe('getSessionListItemUrl', () => {
  it('should build agent session url from the session id', () => {
    const session = {
      id: 'session-1',
      type: LobeSessionType.Agent,
    } as LobeAgentSession;

    expect(getSessionListItemUrl(session, true)).toBe(SESSION_CHAT_URL('session-1', true));
  });

  it('should build group session url from the group session id', () => {
    const session = {
      id: 'cg_1',
      type: LobeSessionType.Group,
    } as LobeGroupSession;

    expect(getSessionListItemUrl(session, true)).toBe(GROUP_CHAT_URL('cg_1'));
  });
});

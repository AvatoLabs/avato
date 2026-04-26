import { type UIChatMessage } from '@lobechat/types';

import { type DataState } from './initialState';

type DisplayState = Pick<DataState, 'displayMessageIds' | 'displayMessageMap' | 'displayMessages'>;
type DbState = Pick<
  DataState,
  | 'dbMessageByToolCallIdMap'
  | 'dbMessageMap'
  | 'dbMessages'
  | 'latestUserMessageId'
  | 'userMessageCount'
>;

const collectDisplayMessage = (
  map: Record<string, UIChatMessage>,
  message: UIChatMessage,
  includeMembers = true,
) => {
  map[message.id] = message;

  if (!includeMembers || message.role !== 'agentCouncil') return;

  const members = (message as any).members as UIChatMessage[] | undefined;
  if (!members) return;

  for (const member of members) {
    map[member.id] = member;
  }
};

export const buildDisplayState = (displayMessages: UIChatMessage[]): DisplayState => {
  const displayMessageMap: Record<string, UIChatMessage> = {};

  for (const message of displayMessages) {
    collectDisplayMessage(displayMessageMap, message);
  }

  return {
    displayMessageIds: displayMessages.map((message) => message.id),
    displayMessageMap,
    displayMessages,
  };
};

export const buildDbState = (dbMessages: UIChatMessage[]): DbState => {
  const dbMessageByToolCallIdMap: Record<string, UIChatMessage> = {};
  const dbMessageMap: Record<string, UIChatMessage> = {};
  let latestUserMessageId: string | undefined;
  let userMessageCount = 0;

  for (const message of dbMessages) {
    dbMessageMap[message.id] = message;

    if (message.tool_call_id) {
      dbMessageByToolCallIdMap[message.tool_call_id] = message;
    }

    if (message.role === 'user') {
      latestUserMessageId = message.id;
      userMessageCount += 1;
    }
  }

  return {
    dbMessageByToolCallIdMap,
    dbMessageMap,
    dbMessages,
    latestUserMessageId,
    userMessageCount,
  };
};

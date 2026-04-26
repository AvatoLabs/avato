import { type UIChatMessage } from '@lobechat/types';

export interface DataState {
  dbMessageByToolCallIdMap: Record<string, UIChatMessage>;
  dbMessageMap: Record<string, UIChatMessage>;
  /**
   * Raw messages from DB (before parsing)
   * Order is preserved from database fetch
   */
  dbMessages: UIChatMessage[];

  displayMessageIds: string[];
  displayMessageMap: Record<string, UIChatMessage>;
  /**
   * Display messages array (parsed and sorted from conversation-flow)
   * This is the source of truth for rendering
   */
  displayMessages: UIChatMessage[];

  latestUserMessageId?: string;

  /**
   * Whether messages have been initialized
   */
  messagesInit: boolean;

  /**
   * Skip internal message fetching (when external messages are provided)
   */
  skipFetch?: boolean;

  userMessageCount: number;
}

export const dataInitialState: DataState = {
  dbMessages: [],
  dbMessageByToolCallIdMap: {},
  dbMessageMap: {},
  displayMessages: [],
  displayMessageIds: [],
  displayMessageMap: {},
  latestUserMessageId: undefined,
  messagesInit: false,
  userMessageCount: 0,
};

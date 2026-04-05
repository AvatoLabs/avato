/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatList from './index';

const {
  chatListState,
  mockUseFetchMessages,
  mockUseFetchNotebookDocuments,
  mockUseFetchTopicMemories,
} = vi.hoisted(() => ({
  chatListState: {
    agentChatConfig: { memory: { effort: 'high' } } as any,
    context: {
      agentId: 'agent-1',
      topicId: 'topic-1',
      topicShareId: undefined as string | undefined,
    },
    currentMemorySettings: { effort: 'low' },
    displayMessageIds: ['msg-1'],
    enableUserMemories: true,
    latestUserMessageId: 'msg-user-1',
    messagesInit: true,
    skipFetch: false,
    topicMemoryRetrieval: undefined as { message: string; status: 'error' } | undefined,
    userMessageCount: 3,
  },
  mockUseFetchMessages: vi.fn(),
  mockUseFetchNotebookDocuments: vi.fn(),
  mockUseFetchTopicMemories: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Alert: ({ description, title }: any) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'chatList.memoryUnavailable.desc':
            'Replies will continue without topic memory for now. Retry later if you need memory-backed context.',
          'chatList.memoryUnavailable.title': 'Memory is temporarily unavailable',
        } as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock('@/hooks/useFetchMemoryForTopic', () => ({
  useFetchTopicMemories: mockUseFetchTopicMemories,
}));

vi.mock('@/hooks/useFetchNotebookDocuments', () => ({
  useFetchNotebookDocuments: mockUseFetchNotebookDocuments,
}));

vi.mock('@/store/agent/selectors', () => ({
  chatConfigByIdSelectors: {
    getChatConfigById: () => () => chatListState.agentChatConfig,
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) => selector({}),
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentMemorySettings: (state: any) => state.currentMemorySettings,
    memoryEnabled: (state: any) => state.enableUserMemories,
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) =>
    selector({
      currentMemorySettings: chatListState.currentMemorySettings,
      enableUserMemories: chatListState.enableUserMemories,
    }),
}));

vi.mock('@/store/userMemory', () => ({
  agentMemorySelectors: {
    topicMemoryRetrieval:
      (topicId: string | undefined) =>
      (state: any) =>
        topicId ? state.topicMemoryRetrievalMap[topicId] : undefined,
  },
  useUserMemoryStore: (selector: any) =>
    selector({
      topicMemoryRetrievalMap: {
        'topic-1': chatListState.topicMemoryRetrieval,
      },
    }),
}));

vi.mock('../store', () => ({
  dataSelectors: {
    displayMessageIds: (state: any) => state.displayMessageIds,
    latestUserMessageId: (state: any) => state.latestUserMessageId,
    messagesInit: (state: any) => state.messagesInit,
    skipFetch: (state: any) => state.skipFetch,
    userMessageCount: (state: any) => state.userMessageCount,
  },
  useConversationStore: (selector: any) =>
    selector({
      context: chatListState.context,
      displayMessageIds: chatListState.displayMessageIds,
      latestUserMessageId: chatListState.latestUserMessageId,
      messagesInit: chatListState.messagesInit,
      skipFetch: chatListState.skipFetch,
      useFetchMessages: mockUseFetchMessages,
      userMessageCount: chatListState.userMessageCount,
    }),
}));

vi.mock('../../WideScreenContainer', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../components/SkeletonList', () => ({
  default: () => <div>Skeleton</div>,
}));

vi.mock('../Messages', () => ({
  default: ({ id }: any) => <div>{id}</div>,
}));

vi.mock('../Messages/Contexts/MessageActionProvider', () => ({
  MessageActionProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('./components/VirtualizedList', () => ({
  default: ({ dataSource }: any) => <div>VirtualizedList:{dataSource.join(',')}</div>,
}));

describe('Conversation ChatList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatListState.agentChatConfig = { memory: { effort: 'high' } };
    chatListState.context = { agentId: 'agent-1', topicId: 'topic-1', topicShareId: undefined };
    chatListState.currentMemorySettings = { effort: 'low' };
    chatListState.displayMessageIds = ['msg-1'];
    chatListState.enableUserMemories = true;
    chatListState.latestUserMessageId = 'msg-user-1';
    chatListState.messagesInit = true;
    chatListState.skipFetch = false;
    chatListState.topicMemoryRetrieval = undefined;
    chatListState.userMessageCount = 3;
  });

  it('passes the effective per-chat memory effort into topic memory prefetch', () => {
    render(<ChatList />);

    expect(mockUseFetchTopicMemories).toHaveBeenCalledWith({
      effort: 'high',
      latestUserMessageId: 'msg-user-1',
      topicId: 'topic-1',
      userMessageCount: 3,
    });
  });

  it('shows a warning when topic memory retrieval failed', () => {
    chatListState.topicMemoryRetrieval = {
      message: 'Failed to retrieve topic memories.',
      status: 'error',
    };

    render(<ChatList />);

    expect(screen.getByText('Memory is temporarily unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Replies will continue without topic memory for now. Retry later if you need memory-backed context.',
      ),
    ).toBeInTheDocument();
  });

  it('does not show the warning on share pages', () => {
    chatListState.context = {
      agentId: 'agent-1',
      topicId: 'topic-1',
      topicShareId: 'share-topic-1',
    };
    chatListState.topicMemoryRetrieval = {
      message: 'Failed to retrieve topic memories.',
      status: 'error',
    };

    render(<ChatList />);

    expect(screen.queryByText('Memory is temporarily unavailable')).not.toBeInTheDocument();
    expect(mockUseFetchTopicMemories).toHaveBeenCalledWith({
      effort: 'high',
      latestUserMessageId: 'msg-user-1',
      topicId: undefined,
      userMessageCount: 3,
    });
  });
});

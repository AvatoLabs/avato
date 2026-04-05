'use client';

import { Alert, Flexbox } from '@lobehub/ui';
import { type ReactNode } from 'react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useFetchTopicMemories } from '@/hooks/useFetchMemoryForTopic';
import { useFetchNotebookDocuments } from '@/hooks/useFetchNotebookDocuments';
import { chatConfigByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useUserStore } from '@/store/user';
import { agentMemorySelectors, useUserMemoryStore } from '@/store/userMemory';
import { settingsSelectors } from '@/store/user/selectors';

import WideScreenContainer from '../../WideScreenContainer';
import SkeletonList from '../components/SkeletonList';
import MessageItem from '../Messages';
import { MessageActionProvider } from '../Messages/Contexts/MessageActionProvider';
import { dataSelectors, useConversationStore } from '../store';
import VirtualizedList from './components/VirtualizedList';

export interface ChatListProps {
  /**
   * Disable the actions bar for all messages (e.g., in share page)
   */
  disableActionsBar?: boolean;
  /**
   * Custom item renderer. If not provided, uses default ChatItem.
   */
  itemContent?: (index: number, id: string) => ReactNode;
  /**
   * Welcome component to display when there are no messages
   */
  welcome?: ReactNode;
}
/**
 * ChatList component for Conversation
 *
 * Uses ConversationStore for message data and fetching.
 */
const ChatList = memo<ChatListProps>(({ disableActionsBar, welcome, itemContent }) => {
  const { t } = useTranslation('chat');
  // Fetch messages (SWR key is null when skipFetch is true)
  const context = useConversationStore((s) => s.context);
  const enableUserMemories = useUserStore(settingsSelectors.memoryEnabled);
  const currentMemorySettings = useUserStore(settingsSelectors.currentMemorySettings);
  const agentChatConfig = useAgentStore(
    chatConfigByIdSelectors.getChatConfigById(context.agentId || ''),
  );
  const [skipFetch, useFetchMessages] = useConversationStore((s) => [
    dataSelectors.skipFetch(s),
    s.useFetchMessages,
  ]);
  useFetchMessages(context, skipFetch);

  // Skip fetching notebook and memories for share pages (they require authentication)
  const isSharePage = !!context.topicShareId;

  // Fetch notebook documents when topic is selected (skip for share pages)
  useFetchNotebookDocuments(isSharePage ? undefined : context.topicId!);
  const latestUserMessageId = useConversationStore(dataSelectors.latestUserMessageId);
  const userMessageCount = useConversationStore(dataSelectors.userMessageCount);
  const effectiveMemoryEffort =
    agentChatConfig.memory?.effort ?? currentMemorySettings.effort ?? 'medium';
  const topicMemoryRetrieval = useUserMemoryStore(
    agentMemorySelectors.topicMemoryRetrieval(context.topicId),
  );

  useFetchTopicMemories({
    effort: effectiveMemoryEffort,
    latestUserMessageId,
    topicId: enableUserMemories && !isSharePage ? context.topicId : undefined,
    userMessageCount,
  });

  // Use selectors for data

  const displayMessageIds = useConversationStore(dataSelectors.displayMessageIds);
  const showTopicMemoryWarning =
    enableUserMemories &&
    !isSharePage &&
    !!context.topicId &&
    topicMemoryRetrieval?.status === 'error';

  const defaultItemContent = useCallback(
    (index: number, id: string) => {
      const isLatestItem = displayMessageIds.length === index + 1;
      return <MessageItem id={id} index={index} isLatestItem={isLatestItem} />;
    },
    [displayMessageIds.length],
  );
  const messagesInit = useConversationStore(dataSelectors.messagesInit);

  // When topicId is null (new conversation), show welcome directly without waiting for fetch
  // because there's no server data to fetch - only local optimistic updates exist
  const isNewConversation = !context.topicId;

  if (!messagesInit && !isNewConversation) {
    return <SkeletonList />;
  }

  if (displayMessageIds.length === 0) {
    return (
      <WideScreenContainer
        style={{
          height: '100%',
        }}
        wrapperStyle={{
          minHeight: '100%',
          overflowY: 'auto',
        }}
      >
        {welcome}
      </WideScreenContainer>
    );
  }

  return (
    <MessageActionProvider withSingletonActionsBar={!disableActionsBar}>
      <Flexbox height={'100%'} style={{ minHeight: 0 }}>
        {showTopicMemoryWarning && (
          <WideScreenContainer>
            <Flexbox paddingBlock={'8px 0'} paddingInline={12}>
              <Alert
                description={t('chatList.memoryUnavailable.desc')}
                title={t('chatList.memoryUnavailable.title')}
                type={'secondary'}
                variant={'borderless'}
              />
            </Flexbox>
          </WideScreenContainer>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <VirtualizedList
            dataSource={displayMessageIds}
            itemContent={itemContent ?? defaultItemContent}
          />
        </div>
      </Flexbox>
    </MessageActionProvider>
  );
});

ChatList.displayName = 'ConversationChatList';

export default ChatList;

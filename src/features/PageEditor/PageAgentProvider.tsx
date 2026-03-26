import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { isChatGroupSessionId } from '@lobechat/types';
import { type ReactNode } from 'react';
import { memo, useEffect, useMemo } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { ConversationProvider } from '@/features/Conversation';
import { usePageEditorStore } from '@/features/PageEditor/store';
import { useOperationState } from '@/hooks/useOperationState';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { type MessageMapKeyInput } from '@/store/chat/utils/messageMapKey';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';
import { settingsSelectors } from '@/store/user/selectors';
import { useUserStore } from '@/store/user/store';
import { TABLE_PAGE_KIND } from '@/utils/page';
import { shouldSyncPageAgentToUserDefault } from '@/utils/pageAgentModel';

interface PageAgentProviderProps {
  children: ReactNode;
}

export const PageAgentProvider = memo<PageAgentProviderProps>(({ children }) => {
  const [useInitBuiltinAgent, updateAgentConfigById] = useAgentStore((s) => [
    s.useInitBuiltinAgent,
    s.updateAgentConfigById,
  ]);
  const pageAgentId = useAgentStore(builtinAgentSelectors.pageAgentId);
  const pageAgentConfig = useAgentStore((s) => {
    const agent = pageAgentId ? s.agentMap[pageAgentId] : undefined;

    return {
      model: agent?.model,
      provider: agent?.provider,
    };
  });
  const activeTopicId = useChatStore((s) => s.activeTopicId);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const defaultAgentConfig = useUserStore(settingsSelectors.defaultAgentConfig);
  const pageKind = usePageEditorStore((s) => s.pageKind);
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const shouldSyncPageAgent = shouldSyncPageAgentToUserDefault(pageAgentConfig, defaultAgentConfig);

  useInitBuiltinAgent(BUILTIN_AGENT_SLUGS.pageAgent);

  useEffect(() => {
    if (!pageAgentId || !shouldSyncPageAgent) return;
    if (!defaultAgentConfig.model || !defaultAgentConfig.provider) return;

    void updateAgentConfigById(pageAgentId, {
      model: defaultAgentConfig.model,
      provider: defaultAgentConfig.provider,
    });
  }, [
    defaultAgentConfig.model,
    defaultAgentConfig.provider,
    pageAgentId,
    shouldSyncPageAgent,
    updateAgentConfigById,
  ]);

  // Build conversation context for page agent.
  // Ignore chat-group ids in page scope and fall back to page agent.
  const selectedAgentId =
    isTablePage || !activeAgentId || isChatGroupSessionId(activeAgentId)
      ? pageAgentId
      : activeAgentId;
  const selectedTopicId = isTablePage && activeAgentId !== pageAgentId ? null : activeTopicId;

  const context = useMemo<MessageMapKeyInput>(
    () => ({
      agentId: selectedAgentId,
      scope: 'page',
      topicId: selectedTopicId, // No topic initially, can be extended later
    }),
    [selectedAgentId, selectedTopicId],
  );

  // Get messages from ChatStore based on context
  const chatKey = useMemo(() => messageMapKey(context), [context]);
  const replaceMessages = useChatStore((s) => s.replaceMessages);
  const messages = useChatStore((s) => (chatKey ? s.dbMessagesMap[chatKey] : undefined));

  // Get operation state for reactive updates
  const operationState = useOperationState(context);

  if (!pageAgentId || shouldSyncPageAgent) return <Loading debugId="PageAgentProvider" />;

  return (
    <ConversationProvider
      context={context}
      hasInitMessages={!!messages}
      messages={messages}
      operationState={operationState}
      onMessagesChange={(msgs, ctx) => {
        replaceMessages(msgs, { context: ctx });
      }}
    >
      {children}
    </ConversationProvider>
  );
});

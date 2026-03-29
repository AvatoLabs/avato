import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { isChatGroupSessionId } from '@lobechat/types';
import { type ReactNode } from 'react';
import { memo, useEffect, useMemo } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { type ConversationContext, ConversationProvider } from '@/features/Conversation';
import { usePageEditorStore } from '@/features/PageEditor/store';
import { useOperationState } from '@/hooks/useOperationState';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';
import { settingsSelectors } from '@/store/user/selectors';
import { useUserStore } from '@/store/user/store';
import { TABLE_PAGE_KIND } from '@/utils/docs';
import { shouldSyncDocsAgentToUserDefault } from '@/utils/docsAgentModel';

interface DocsAgentProviderProps {
  children: ReactNode;
}

export const DocsAgentProvider = memo<DocsAgentProviderProps>(({ children }) => {
  const [useInitBuiltinAgent, updateAgentConfigById] = useAgentStore((s) => [
    s.useInitBuiltinAgent,
    s.updateAgentConfigById,
  ]);
  const docsAgentId = useAgentStore(builtinAgentSelectors.docsAgentId);
  const docsAgentConfig = useAgentStore((s) => {
    const agent = docsAgentId ? s.agentMap[docsAgentId] : undefined;

    return {
      model: agent?.model,
      provider: agent?.provider,
    };
  });
  const activeTopicId = useChatStore((s) => s.activeTopicId);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const documentId = usePageEditorStore((s) => s.documentId);
  const defaultAgentConfig = useUserStore(settingsSelectors.defaultAgentConfig);
  const pageKind = usePageEditorStore((s) => s.pageKind);
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const shouldSyncDocsAgent = shouldSyncDocsAgentToUserDefault(docsAgentConfig, defaultAgentConfig);

  useInitBuiltinAgent(BUILTIN_AGENT_SLUGS.docsAgent);

  useEffect(() => {
    if (!docsAgentId || !shouldSyncDocsAgent) return;
    if (!defaultAgentConfig.model || !defaultAgentConfig.provider) return;

    void updateAgentConfigById(docsAgentId, {
      model: defaultAgentConfig.model,
      provider: defaultAgentConfig.provider,
    });
  }, [
    defaultAgentConfig.model,
    defaultAgentConfig.provider,
    docsAgentId,
    shouldSyncDocsAgent,
    updateAgentConfigById,
  ]);

  // Build conversation context for Docs Agent.
  // Ignore chat-group ids in doc scope and fall back to Docs Agent.
  const selectedAgentId =
    isTablePage || !activeAgentId || isChatGroupSessionId(activeAgentId)
      ? docsAgentId
      : activeAgentId;
  const selectedTopicId = isTablePage && activeAgentId !== docsAgentId ? null : activeTopicId;

  const context = useMemo<ConversationContext>(
    () => ({
      agentId: selectedAgentId,
      metadata: documentId ? { documentId } : undefined,
      scope: 'doc',
      topicId: selectedTopicId, // No topic initially, can be extended later
    }),
    [documentId, selectedAgentId, selectedTopicId],
  );

  // Get messages from ChatStore based on context
  const chatKey = useMemo(() => messageMapKey(context), [context]);
  const replaceMessages = useChatStore((s) => s.replaceMessages);
  const messages = useChatStore((s) => (chatKey ? s.dbMessagesMap[chatKey] : undefined));

  // Get operation state for reactive updates
  const operationState = useOperationState(context);

  if (!docsAgentId || shouldSyncDocsAgent) return <Loading debugId="DocsAgentProvider" />;

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

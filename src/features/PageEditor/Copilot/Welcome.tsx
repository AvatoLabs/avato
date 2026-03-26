'use client';

import { DEFAULT_DOC_COPILOT_AVATAR, normalizeBuiltinAvatar } from '@lobechat/const';
import { Avatar, Flexbox, Markdown, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { conversationSelectors, useConversationStore } from '@/features/Conversation';
import { usePageEditorStore } from '@/features/PageEditor/store';
import SuggestQuestions from '@/features/SuggestQuestions';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { TABLE_PAGE_KIND } from '@/utils/page';

const AgentBuilderWelcome = memo(() => {
  const { t } = useTranslation('chat');
  const agentId = useConversationStore(conversationSelectors.agentId);
  const agent = useAgentStore(agentByIdSelectors.getAgentConfigById(agentId));
  const pageKind = usePageEditorStore((s) => s.pageKind);
  const isTablePage = pageKind === TABLE_PAGE_KIND;

  return (
    <>
      <Flexbox flex={1} />
      <Flexbox
        gap={12}
        width={'100%'}
        style={{
          paddingBottom: 16,
        }}
      >
        <Avatar
          avatar={normalizeBuiltinAvatar(agent?.avatar) || DEFAULT_DOC_COPILOT_AVATAR}
          shape={'square'}
          size={78}
        />
        <Text fontSize={24} weight={'bold'}>
          {t(isTablePage ? 'pageCopilot.table.title' : 'pageCopilot.title')}
        </Text>
        <Markdown fontSize={14} variant={'chat'}>
          {t(isTablePage ? 'pageCopilot.table.welcome' : 'pageCopilot.welcome')}
        </Markdown>
        <SuggestQuestions count={3} mode="write" />
      </Flexbox>
    </>
  );
});

export default AgentBuilderWelcome;

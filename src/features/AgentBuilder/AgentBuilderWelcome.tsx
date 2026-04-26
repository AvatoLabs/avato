'use client';

import { DEFAULT_AGENT_BUILDER_AVATAR, normalizeBuiltinAvatar } from '@lobechat/const';
import { Avatar, Flexbox, Markdown, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { conversationSelectors, useConversationStore } from '@/features/Conversation';
import { type SuggestMode } from '@/features/SuggestQuestions';
import SuggestQuestions from '@/features/SuggestQuestions';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

interface AgentBuilderWelcomeProps {
  mode?: SuggestMode;
}

const AgentBuilderWelcome = memo<AgentBuilderWelcomeProps>(({ mode = 'agent' }) => {
  const { t } = useTranslation('chat');
  const agentId = useConversationStore(conversationSelectors.agentId);
  const agent = useAgentStore(agentByIdSelectors.getAgentConfigById(agentId));

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
          avatar={normalizeBuiltinAvatar(agent.avatar) || DEFAULT_AGENT_BUILDER_AVATAR}
          shape={'square'}
          size={78}
        />
        <Text fontSize={24} weight={'bold'}>
          {t('agentBuilder.title')}
        </Text>
        <Markdown fontSize={14} variant={'chat'}>
          {t('agentBuilder.welcome')}
        </Markdown>
        <SuggestQuestions count={3} mode={mode} />
      </Flexbox>
    </>
  );
});

export default AgentBuilderWelcome;

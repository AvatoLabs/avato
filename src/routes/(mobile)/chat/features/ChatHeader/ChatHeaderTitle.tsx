import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { ChevronDown } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chevron: css`
    flex: none;
    color: ${cssVar.colorTextDescription};
    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 90%, transparent);
  `,
  desc: css`
    overflow: hidden;

    max-width: 60vw;

    line-height: 1.2;
    color: ${cssVar.colorTextDescription};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  trigger: css`
    cursor: pointer;
    min-width: 0;
  `,
  title: css`
    overflow: hidden;

    max-width: 64vw;
    margin-inline-end: 8px;

    font-weight: 600;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const ChatHeaderTitle = memo(() => {
  const { t } = useTranslation(['chat', 'topic']);
  const toggleConfig = useGlobalStore((s) => s.toggleMobileTopic);
  const [topicCount, topic] = useChatStore((s) => [
    topicSelectors.currentTopicCount(s),
    topicSelectors.currentActiveTopic(s),
  ]);
  const isInbox = useAgentStore(builtinAgentSelectors.isInboxAgent);
  const title = useAgentStore(agentSelectors.currentAgentTitle);

  const displayTitle = isInbox ? 'Avato' : title;

  return (
    <ChatHeader.Title
      desc={
        <Flexbox
          horizontal
          align={'center'}
          className={styles.trigger}
          gap={4}
          onClick={() => toggleConfig()}
        >
          <span className={styles.desc}>{topic?.title || t('title', { ns: 'topic' })}</span>
          <ActionIcon
            active
            className={styles.chevron}
            icon={ChevronDown}
            size={{ blockSize: 14, borderRadius: '50%', size: 12 }}
          />
        </Flexbox>
      }
      title={
        <div className={styles.title} onClick={() => toggleConfig()}>
          {displayTitle}
          {topicCount > 0 ? ` (${topicCount})` : ''}
        </div>
      }
    />
  );
});

export default ChatHeaderTitle;

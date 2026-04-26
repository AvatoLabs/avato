import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { createStaticStyles } from 'antd-style';
import { ChevronDown } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chevron: css`
    flex: none;
    color: ${cssVar.colorTextDescription};
    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 90%, transparent);
  `,
  countPill: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    min-width: 20px;
    height: 20px;
    padding-inline: 7px;
    border-radius: 999px;

    font-size: 11px;
    font-weight: 600;
    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 68%, ${cssVar.colorBgContainer});
  `,
  desc: css`
    overflow: hidden;

    max-width: 58vw;

    font-size: 12px;
    line-height: 1.2;
    color: ${cssVar.colorTextDescription};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  subtitleRow: css`
    min-width: 0;
  `,
  trigger: css`
    cursor: pointer;
    min-width: 0;
  `,
  title: css`
    overflow: hidden;

    max-width: 62vw;

    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
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
  const topicTitle = topic?.title || t('title', { ns: 'topic' });

  return (
    <ChatHeader.Title
      desc={
        <Flexbox
          horizontal
          align={'center'}
          className={styles.subtitleRow}
          gap={4}
          onClick={() => toggleConfig()}
        >
          <Text ellipsis as={'span'} className={styles.desc}>
            {displayTitle}
          </Text>
          {topicCount > 1 && <span className={styles.countPill}>{topicCount}</span>}
          <ActionIcon
            active
            className={styles.chevron}
            icon={ChevronDown}
            size={{ blockSize: 14, borderRadius: '50%', size: 12 }}
          />
        </Flexbox>
      }
      title={
        <Text ellipsis as={'div'} className={styles.title} onClick={() => toggleConfig()}>
          {topicTitle}
        </Text>
      }
    />
  );
});

export default ChatHeaderTitle;

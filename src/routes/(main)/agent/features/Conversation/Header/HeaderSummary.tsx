'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';

const styles = createStaticStyles(({ css, cssVar }) => ({
  countPill: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    min-width: 22px;
    height: 22px;
    padding-inline: 8px;
    border-radius: 999px;

    font-size: 11px;
    font-weight: 600;
    color: color-mix(in srgb, ${cssVar.colorTextSecondary} 78%, ${cssVar.colorText} 22%);

    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 84%, transparent);
  `,
  subtitle: css`
    overflow: hidden;

    max-width: min(32vw, 320px);

    font-size: 12px;
    line-height: 1.35;
    color: color-mix(in srgb, ${cssVar.colorTextDescription} 72%, ${cssVar.colorText} 28%);
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  title: css`
    overflow: hidden;

    max-width: min(34vw, 360px);

    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
    white-space: nowrap;
  `,
}));

const HeaderSummary = memo(() => {
  const { t } = useTranslation('topic');
  const agentTitle = useAgentStore(agentSelectors.currentAgentTitle);
  const [activeTopicTitle, topicCount] = useChatStore((s) => [
    topicSelectors.currentActiveTopic(s)?.title,
    topicSelectors.currentTopicCount(s),
  ]);

  const title = activeTopicTitle || agentTitle || t('title');
  const subtitle =
    activeTopicTitle && agentTitle && activeTopicTitle !== agentTitle ? agentTitle : null;

  return (
    <Flexbox gap={2} style={{ minWidth: 0 }}>
      <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
        <Text as={'div'} className={styles.title} title={title}>
          {title}
        </Text>
        {topicCount > 1 && <span className={styles.countPill}>{topicCount}</span>}
      </Flexbox>
      {subtitle && (
        <Text as={'div'} className={styles.subtitle} title={subtitle}>
          {subtitle}
        </Text>
      )}
    </Flexbox>
  );
});

HeaderSummary.displayName = 'AgentConversationHeaderSummary';

export default HeaderSummary;

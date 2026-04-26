'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAgentGroupStore } from '@/store/agentGroup';
import { agentGroupSelectors } from '@/store/agentGroup/selectors';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';

const styles = createStaticStyles(({ css, cssVar }) => ({
  subtitle: css`
    overflow: hidden;

    max-width: min(32vw, 320px);

    font-size: 12px;
    line-height: 1.35;
    color: ${cssVar.colorTextDescription};
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
  const { t } = useTranslation('chat');
  const currentGroupMeta = useAgentGroupStore(agentGroupSelectors.currentGroupMeta);
  const activeTopicTitle = useChatStore((s) => topicSelectors.currentActiveTopic(s)?.title);

  const groupTitle = currentGroupMeta.title || t('untitledGroup');
  const title = activeTopicTitle || groupTitle;
  const subtitle = activeTopicTitle && activeTopicTitle !== groupTitle ? groupTitle : null;

  return (
    <Flexbox gap={2} style={{ minWidth: 0 }}>
      <Text as={'div'} className={styles.title} title={title}>
        {title}
      </Text>
      {subtitle && (
        <Text as={'div'} className={styles.subtitle} title={subtitle}>
          {subtitle}
        </Text>
      )}
    </Flexbox>
  );
});

HeaderSummary.displayName = 'GroupConversationHeaderSummary';

export default HeaderSummary;

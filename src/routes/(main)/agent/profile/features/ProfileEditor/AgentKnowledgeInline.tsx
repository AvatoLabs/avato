'use client';

import { Button, Flexbox, Tag } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { PlusIcon, X } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import KnowledgeIcon from '@/components/KnowledgeIcon';
import { AttachKnowledgeModal } from '@/features/LibraryModal';
import { useOpenChatSettings } from '@/hooks/useInterceptingRoutes';
import { useIsDark } from '@/hooks/useIsDark';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';
import { KnowledgeType } from '@/types/knowledgeBase';

interface AgentKnowledgeInlineItem {
  fileType?: string;
  id: string;
  name: string;
  type: KnowledgeType;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  addButton: css`
    color: ${cssVar.colorTextSecondary} !important;
  `,
  tag: css`
    cursor: pointer;
    height: 28px !important;
    border-radius: ${cssVar.borderRadiusSM} !important;
    color: ${cssVar.colorTextSecondary} !important;

    :where(.ant-tag-close-icon) {
      color: ${cssVar.colorTextSecondary} !important;
    }
  `,
}));

const AgentKnowledgeInline = memo(() => {
  const { t } = useTranslation('setting');
  const [modalOpen, setModalOpen] = useState(false);
  const isDarkMode = useIsDark();
  const openKnowledgeSettings = useOpenChatSettings(ChatSettingsTabs.Knowledge);

  const [files, knowledgeBases] = useAgentStore(
    (s) => [agentSelectors.currentAgentFiles(s), agentSelectors.currentAgentKnowledgeBases(s)],
    isEqual,
  );
  const [removeFileFromAgent, removeKnowledgeBaseFromAgent] = useAgentStore((s) => [
    s.removeFileFromAgent,
    s.removeKnowledgeBaseFromAgent,
  ]);

  const items = useMemo<AgentKnowledgeInlineItem[]>(
    () =>
      [
        ...knowledgeBases.map((item) => ({
          id: item.id,
          name: item.name,
          type: KnowledgeType.KnowledgeBase,
        })),
        ...files.map((item) => ({
          fileType: item.type,
          id: item.id,
          name: item.name,
          type: KnowledgeType.File,
        })),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [files, knowledgeBases],
  );

  const handleRemove = useCallback(
    (item: AgentKnowledgeInlineItem) => async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (item.type === KnowledgeType.KnowledgeBase) {
        await removeKnowledgeBaseFromAgent(item.id);
        return;
      }

      await removeFileFromAgent(item.id);
    },
    [removeFileFromAgent, removeKnowledgeBaseFromAgent],
  );

  return (
    <>
      <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
        <Button
          className={styles.addButton}
          icon={PlusIcon}
          size={'small'}
          type={'text'}
          onClick={() => setModalOpen(true)}
        >
          {t('settingKnowledge.inlineAdd')}
        </Button>
        {items.map((item) => (
          <Tag
            closable
            className={styles.tag}
            closeIcon={<X size={12} />}
            key={item.id}
            variant={isDarkMode ? 'filled' : 'outlined'}
            icon={
              <KnowledgeIcon
                fileType={item.fileType}
                name={item.name}
                size={{ file: 16, repo: 16 }}
                type={item.type}
              />
            }
            onClick={openKnowledgeSettings}
            onClose={handleRemove(item)}
          >
            {item.name}
          </Tag>
        ))}
      </Flexbox>

      <AttachKnowledgeModal open={modalOpen} scope={'agent'} setOpen={setModalOpen} />
    </>
  );
});

AgentKnowledgeInline.displayName = 'AgentKnowledgeInline';

export default AgentKnowledgeInline;

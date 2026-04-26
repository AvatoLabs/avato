'use client';

import { Button, Flexbox, Tag } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { PlusIcon, X } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SourceIcon from '@/components/SourceIcon';
import { useSpaceName } from '@/features/ResourceSpaces';
import { AttachSourceSetModal } from '@/features/SourceSetModal';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useOpenChatSettings } from '@/hooks/useInterceptingRoutes';
import { useIsDark } from '@/hooks/useIsDark';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';
import { AgentSourceKind } from '@/types/sourceSet';

interface AgentSourcesInlineItem {
  fileType?: string;
  id: string;
  name: string;
  spaceId?: string | null;
  type: AgentSourceKind;
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

const AgentSourceTag = memo(
  ({
    activeSpaceId,
    isDarkMode,
    item,
    onClick,
    onClose,
  }: {
    activeSpaceId?: string;
    isDarkMode: boolean;
    item: AgentSourcesInlineItem;
    onClick: () => void;
    onClose: (event: React.MouseEvent) => void;
  }) => {
    const spaceName = useSpaceName(item.spaceId);
    const label =
      item.spaceId && item.spaceId !== activeSpaceId && spaceName
        ? `${item.name} · ${spaceName}`
        : item.name;

    return (
      <Tag
        closable
        className={styles.tag}
        closeIcon={<X size={12} />}
        variant={isDarkMode ? 'filled' : 'outlined'}
        icon={
          <SourceIcon
            fileType={item.fileType}
            name={item.name}
            size={{ file: 16, repo: 16 }}
            type={item.type}
          />
        }
        onClick={onClick}
        onClose={onClose}
      >
        {label}
      </Tag>
    );
  },
);

AgentSourceTag.displayName = 'AgentSourceTag';

const AgentSourcesInline = memo(() => {
  const { t } = useTranslation('setting');
  const [modalOpen, setModalOpen] = useState(false);
  const isDarkMode = useIsDark();
  const openSourceSettings = useOpenChatSettings(ChatSettingsTabs.Sources);
  const activeWorkspaceSpaceId = resolveWorkspaceSpaceId();

  const [files, sourceSets] = useAgentStore(
    (s) => [agentSelectors.currentAgentFiles(s), agentSelectors.currentAgentSourceSets(s)],
    isEqual,
  );
  const [removeFileFromAgent, detachSourceSetFromAgent] = useAgentStore((s) => [
    s.removeFileFromAgent,
    s.detachSourceSetFromAgent,
  ]);

  const items = useMemo<AgentSourcesInlineItem[]>(
    () =>
      [
        ...sourceSets.map((item) => ({
          id: item.id,
          name: item.name,
          spaceId: item.spaceId,
          type: AgentSourceKind.SourceSet,
        })),
        ...files.map((item) => ({
          fileType: item.type,
          id: item.id,
          name: item.name,
          spaceId: item.spaceId,
          type: AgentSourceKind.File,
        })),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [files, sourceSets],
  );

  const handleRemove = useCallback(
    (item: AgentSourcesInlineItem) => async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (item.type === AgentSourceKind.SourceSet) {
        await detachSourceSetFromAgent(item.id);
        return;
      }

      await removeFileFromAgent(item.id);
    },
    [removeFileFromAgent, detachSourceSetFromAgent],
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
          {t('settingSources.inlineAdd')}
        </Button>
        {items.map((item) => (
          <AgentSourceTag
            activeSpaceId={activeWorkspaceSpaceId}
            isDarkMode={isDarkMode}
            item={item}
            key={item.id}
            onClick={openSourceSettings}
            onClose={handleRemove(item)}
          />
        ))}
      </Flexbox>

      <AttachSourceSetModal open={modalOpen} scope={'agent'} setOpen={setModalOpen} />
    </>
  );
});

AgentSourcesInline.displayName = 'AgentSourcesInline';

export default AgentSourcesInline;

'use client';

import { ActionIcon, Button, DropdownMenu, Empty, Flexbox, Tag, Text } from '@lobehub/ui';
import { Switch } from 'antd';
import { createStaticStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { FolderSearch2, InfoIcon, LibraryBig, MoreVerticalIcon, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import SourceIcon from '@/components/SourceIcon';
import { isCanonicalDocumentEntry } from '@/features/ContentManager/utils/isCanonicalDocumentEntry';
import {
  buildFilesPreviewPath,
  buildFilesRootPath,
  buildSourceSetPath,
  useSpaceName,
} from '@/features/ResourceSpaces';
import { AttachSourceSetModal } from '@/features/SourceSetModal';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { AgentSourceKind } from '@/types/sourceSet';
import { getPageDetailPath } from '@/utils/docs';

interface AgentSourceListItem {
  description?: string | null;
  enabled: boolean;
  fileType?: string;
  id: string;
  name: string;
  spaceId?: string | null;
  type: AgentSourceKind;
}

interface SourceItemRowProps {
  activeSpaceId?: string;
  item: AgentSourceListItem;
  onOpen: (item: AgentSourceListItem) => void;
  onRemove: (item: AgentSourceListItem) => Promise<void>;
  onToggle: (item: AgentSourceListItem, enabled: boolean) => Promise<void>;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  note: css`
    gap: 0.5rem;

    padding-block: 0.875rem;
    padding-inline: 1rem;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: ${cssVar.colorFillTertiary};
  `,
  row: css`
    gap: 0.75rem;

    padding-block: 0.875rem;
    padding-inline: 1rem;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: ${cssVar.colorBgContainer};
  `,
  secondaryText: css`
    font-size: 0.75rem;
    line-height: 1.5;
    color: ${cssVar.colorTextDescription};
  `,
  sectionTitle: css`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
  `,
  title: css`
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.4;
  `,
}));

const WorkspaceBadge = memo(
  ({ activeSpaceId, spaceId }: { activeSpaceId?: string; spaceId?: string | null }) => {
    const spaceName = useSpaceName(spaceId);

    if (!spaceId || !spaceName || spaceId === activeSpaceId) return null;

    return <Tag bordered={false}>{spaceName}</Tag>;
  },
);

WorkspaceBadge.displayName = 'WorkspaceBadge';

const SourceItemRow = memo<SourceItemRowProps>(
  ({ activeSpaceId, item, onOpen, onRemove, onToggle }) => {
    const { t } = useTranslation('setting');
    const [loading, setLoading] = useState(false);

    const handleToggle = useCallback(
      async (enabled: boolean) => {
        setLoading(true);
        try {
          await onToggle(item, enabled);
        } finally {
          setLoading(false);
        }
      },
      [item, onToggle],
    );

    const handleRemove = useCallback(async () => {
      setLoading(true);
      try {
        await onRemove(item);
      } finally {
        setLoading(false);
      }
    }, [item, onRemove]);

    const secondary =
      item.description ||
      (item.type === AgentSourceKind.SourceSet
        ? t('settingSources.item.sourceSetDesc')
        : item.fileType || t('settingSources.item.fileDesc'));

    return (
      <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
        <Flexbox horizontal align={'center'} flex={1} gap={12} style={{ minWidth: 0 }}>
          <SourceIcon
            fileType={item.fileType}
            name={item.name}
            size={{ file: 36, repo: 36 }}
            type={item.type}
          />
          <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
            <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }} wrap={'wrap'}>
              <Text ellipsis className={styles.title}>
                {item.name}
              </Text>
              <Tag bordered={false}>
                {t(
                  item.type === AgentSourceKind.SourceSet
                    ? 'settingSources.badge.sourceSet'
                    : 'settingSources.badge.file',
                )}
              </Tag>
              <WorkspaceBadge activeSpaceId={activeSpaceId} spaceId={item.spaceId} />
            </Flexbox>
            <Text ellipsis className={styles.secondaryText}>
              {secondary}
            </Text>
          </Flexbox>
        </Flexbox>
        <Flexbox horizontal align={'center'} gap={12}>
          <Switch checked={item.enabled} loading={loading} onChange={handleToggle} />
          <DropdownMenu
            placement="bottomRight"
            items={[
              {
                icon: <InfoIcon size={16} />,
                key: 'detail',
                label: t('settingSources.actions.detail'),
                onClick: () => onOpen(item),
              },
              {
                danger: true,
                icon: <Trash2 size={16} />,
                key: 'remove',
                label: t('settingSources.actions.remove'),
                onClick: () => void handleRemove(),
              },
            ]}
          >
            <ActionIcon icon={MoreVerticalIcon} loading={loading} />
          </DropdownMenu>
        </Flexbox>
      </Flexbox>
    );
  },
);

SourceItemRow.displayName = 'SourceItemRow';

const AgentSources = memo(() => {
  const { t } = useTranslation('setting');
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const activeWorkspaceSpaceId = resolveWorkspaceSpaceId();
  const activeWorkspaceName = useSpaceName(activeWorkspaceSpaceId);

  const [files, sourceSets] = useAgentStore(
    (s) => [agentSelectors.currentAgentFiles(s), agentSelectors.currentAgentSourceSets(s)],
    isEqual,
  );
  const [removeFileFromAgent, detachSourceSetFromAgent, toggleFile, setSourceSetEnabled] =
    useAgentStore((s) => [
      s.removeFileFromAgent,
      s.detachSourceSetFromAgent,
      s.toggleFile,
      s.setSourceSetEnabled,
    ]);

  const sourceSetItems = useMemo<AgentSourceListItem[]>(
    () =>
      [...sourceSets]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          description: item.description,
          enabled: !!item.enabled,
          id: item.id,
          name: item.name,
          spaceId: item.spaceId,
          type: AgentSourceKind.SourceSet,
        })),
    [sourceSets],
  );

  const fileItems = useMemo<AgentSourceListItem[]>(
    () =>
      [...files]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          enabled: !!item.enabled,
          fileType: item.type,
          id: item.id,
          name: item.name,
          spaceId: item.spaceId,
          type: AgentSourceKind.File,
        })),
    [files],
  );

  const totalCount = sourceSetItems.length + fileItems.length;

  const closeAndNavigate = useCallback(
    (path: string) => {
      useAgentStore.setState({ activeAgentSettingTab: undefined, showAgentSetting: false });
      navigate(path);
    },
    [navigate],
  );

  const handleOpenItem = useCallback(
    (item: AgentSourceListItem) => {
      const targetSpaceId = resolveWorkspaceSpaceId({ spaceId: item.spaceId });
      const path =
        item.type === AgentSourceKind.SourceSet
          ? buildSourceSetPath(targetSpaceId, item.id)
          : isCanonicalDocumentEntry({ id: item.id })
            ? getPageDetailPath(item.id, 'doc', targetSpaceId)
            : buildFilesPreviewPath(targetSpaceId, item.id);

      closeAndNavigate(path);
    },
    [closeAndNavigate],
  );

  const handleToggleItem = useCallback(
    async (item: AgentSourceListItem, enabled: boolean) => {
      if (item.type === AgentSourceKind.SourceSet) {
        await setSourceSetEnabled(item.id, enabled);
        return;
      }

      await toggleFile(item.id, enabled);
    },
    [setSourceSetEnabled, toggleFile],
  );

  const handleRemoveItem = useCallback(
    async (item: AgentSourceListItem) => {
      if (item.type === AgentSourceKind.SourceSet) {
        await detachSourceSetFromAgent(item.id);
        return;
      }

      await removeFileFromAgent(item.id);
    },
    [removeFileFromAgent, detachSourceSetFromAgent],
  );

  const renderSection = useCallback(
    (title: string, items: AgentSourceListItem[]) => {
      if (items.length === 0) return null;

      return (
        <Flexbox gap={8}>
          <Text className={styles.sectionTitle}>{title}</Text>
          <Flexbox gap={8}>
            {items.map((item) => (
              <SourceItemRow
                activeSpaceId={activeWorkspaceSpaceId}
                item={item}
                key={item.id}
                onOpen={handleOpenItem}
                onRemove={handleRemoveItem}
                onToggle={handleToggleItem}
              />
            ))}
          </Flexbox>
        </Flexbox>
      );
    },
    [activeWorkspaceSpaceId, handleOpenItem, handleRemoveItem, handleToggleItem],
  );

  return (
    <>
      <Flexbox gap={16}>
        <Flexbox gap={4}>
          <Text as={'h2'}>{t('settingSources.title')}</Text>
          <Text type={'secondary'}>{t('settingSources.desc')}</Text>
        </Flexbox>

        <Flexbox className={styles.note}>
          <Flexbox gap={8}>
            <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
              <Tag color={'blue'}>{t('settingSources.scope.agent')}</Tag>
              <Text className={styles.secondaryText}>{t('settingSources.scope.conversation')}</Text>
            </Flexbox>
            {activeWorkspaceName && (
              <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                <Tag bordered={false}>{t('settingSources.scope.workspace')}</Tag>
                <Text className={styles.secondaryText}>
                  {t('settingSources.scope.workspaceHint', { name: activeWorkspaceName })}
                </Text>
              </Flexbox>
            )}
          </Flexbox>
        </Flexbox>

        <Flexbox horizontal align={'center'} gap={8} justify={'space-between'} wrap={'wrap'}>
          <Flexbox horizontal gap={8} wrap={'wrap'}>
            <Button icon={LibraryBig} type={'primary'} onClick={() => setModalOpen(true)}>
              {t('settingSources.actions.add')}
            </Button>
            <Button
              icon={FolderSearch2}
              onClick={() => closeAndNavigate(buildFilesRootPath(activeWorkspaceSpaceId))}
            >
              {t('settingSources.actions.manage')}
            </Button>
          </Flexbox>
          <Text type={'secondary'}>{t('settingSources.count', { count: totalCount })}</Text>
        </Flexbox>

        {totalCount === 0 ? (
          <Empty
            descriptionProps={{ fontSize: 14 }}
            icon={LibraryBig}
            description={
              activeWorkspaceName
                ? t('settingSources.emptyDescInWorkspace', { name: activeWorkspaceName })
                : t('settingSources.emptyDesc')
            }
          >
            <Button type={'primary'} onClick={() => setModalOpen(true)}>
              {t('settingSources.actions.add')}
            </Button>
          </Empty>
        ) : (
          <Flexbox gap={16}>
            {renderSection(t('settingSources.section.sourceSets'), sourceSetItems)}
            {renderSection(t('settingSources.section.files'), fileItems)}
          </Flexbox>
        )}
      </Flexbox>

      <AttachSourceSetModal open={modalOpen} scope={'agent'} setOpen={setModalOpen} />
    </>
  );
});

AgentSources.displayName = 'AgentSources';

export default AgentSources;

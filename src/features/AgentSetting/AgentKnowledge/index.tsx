'use client';

import { ActionIcon, Button, DropdownMenu, Empty, Flexbox, Tag, Text } from '@lobehub/ui';
import { Switch } from 'antd';
import { createStaticStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { FolderSearch2, InfoIcon, LibraryBig, MoreVerticalIcon, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import KnowledgeIcon from '@/components/KnowledgeIcon';
import { AttachKnowledgeModal } from '@/features/LibraryModal';
import { buildResourceLibraryPath, buildResourcePreviewPath } from '@/features/ResourceSpaces';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { KnowledgeType } from '@/types/knowledgeBase';

interface AgentKnowledgeListItem {
  description?: string | null;
  enabled: boolean;
  fileType?: string;
  id: string;
  name: string;
  spaceId?: string | null;
  type: KnowledgeType;
}

interface KnowledgeItemRowProps {
  item: AgentKnowledgeListItem;
  onOpen: (item: AgentKnowledgeListItem) => void;
  onRemove: (item: AgentKnowledgeListItem) => Promise<void>;
  onToggle: (item: AgentKnowledgeListItem, enabled: boolean) => Promise<void>;
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

const KnowledgeItemRow = memo<KnowledgeItemRowProps>(({ item, onOpen, onRemove, onToggle }) => {
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
    (item.type === KnowledgeType.KnowledgeBase
      ? t('settingKnowledge.item.libraryDesc')
      : item.fileType || t('settingKnowledge.item.fileDesc'));

  return (
    <Flexbox horizontal align={'center'} className={styles.row} justify={'space-between'}>
      <Flexbox horizontal align={'center'} flex={1} gap={12} style={{ minWidth: 0 }}>
        <KnowledgeIcon
          fileType={item.fileType}
          name={item.name}
          size={{ file: 36, repo: 36 }}
          type={item.type}
        />
        <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
          <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
            <Text ellipsis className={styles.title}>
              {item.name}
            </Text>
            <Tag bordered={false}>
              {t(
                item.type === KnowledgeType.KnowledgeBase
                  ? 'settingKnowledge.badge.library'
                  : 'settingKnowledge.badge.file',
              )}
            </Tag>
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
              label: t('settingKnowledge.actions.detail'),
              onClick: () => onOpen(item),
            },
            {
              danger: true,
              icon: <Trash2 size={16} />,
              key: 'remove',
              label: t('settingKnowledge.actions.remove'),
              onClick: () => void handleRemove(),
            },
          ]}
        >
          <ActionIcon icon={MoreVerticalIcon} loading={loading} />
        </DropdownMenu>
      </Flexbox>
    </Flexbox>
  );
});

KnowledgeItemRow.displayName = 'KnowledgeItemRow';

const AgentKnowledge = memo(() => {
  const { t } = useTranslation('setting');
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const [files, knowledgeBases] = useAgentStore(
    (s) => [agentSelectors.currentAgentFiles(s), agentSelectors.currentAgentKnowledgeBases(s)],
    isEqual,
  );
  const [removeFileFromAgent, removeKnowledgeBaseFromAgent, toggleFile, toggleKnowledgeBase] =
    useAgentStore((s) => [
      s.removeFileFromAgent,
      s.removeKnowledgeBaseFromAgent,
      s.toggleFile,
      s.toggleKnowledgeBase,
    ]);

  const libraryItems = useMemo<AgentKnowledgeListItem[]>(
    () =>
      [...knowledgeBases]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          description: item.description,
          enabled: !!item.enabled,
          id: item.id,
          name: item.name,
          spaceId: item.spaceId,
          type: KnowledgeType.KnowledgeBase,
        })),
    [knowledgeBases],
  );

  const fileItems = useMemo<AgentKnowledgeListItem[]>(
    () =>
      [...files]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          enabled: !!item.enabled,
          fileType: item.type,
          id: item.id,
          name: item.name,
          spaceId: item.spaceId,
          type: KnowledgeType.File,
        })),
    [files],
  );

  const totalCount = libraryItems.length + fileItems.length;

  const closeAndNavigate = useCallback(
    (path: string) => {
      useAgentStore.setState({ activeAgentSettingTab: undefined, showAgentSetting: false });
      navigate(path);
    },
    [navigate],
  );

  const handleOpenItem = useCallback(
    (item: AgentKnowledgeListItem) => {
      const path =
        item.type === KnowledgeType.KnowledgeBase
          ? buildResourceLibraryPath(item.spaceId, item.id)
          : buildResourcePreviewPath(item.spaceId, item.id);

      closeAndNavigate(path);
    },
    [closeAndNavigate],
  );

  const handleToggleItem = useCallback(
    async (item: AgentKnowledgeListItem, enabled: boolean) => {
      if (item.type === KnowledgeType.KnowledgeBase) {
        await toggleKnowledgeBase(item.id, enabled);
        return;
      }

      await toggleFile(item.id, enabled);
    },
    [toggleFile, toggleKnowledgeBase],
  );

  const handleRemoveItem = useCallback(
    async (item: AgentKnowledgeListItem) => {
      if (item.type === KnowledgeType.KnowledgeBase) {
        await removeKnowledgeBaseFromAgent(item.id);
        return;
      }

      await removeFileFromAgent(item.id);
    },
    [removeFileFromAgent, removeKnowledgeBaseFromAgent],
  );

  const renderSection = useCallback(
    (title: string, items: AgentKnowledgeListItem[]) => {
      if (items.length === 0) return null;

      return (
        <Flexbox gap={8}>
          <Text className={styles.sectionTitle}>{title}</Text>
          <Flexbox gap={8}>
            {items.map((item) => (
              <KnowledgeItemRow
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
    [handleOpenItem, handleRemoveItem, handleToggleItem],
  );

  return (
    <>
      <Flexbox gap={16}>
        <Flexbox gap={4}>
          <Text as={'h2'}>{t('settingKnowledge.title')}</Text>
          <Text type={'secondary'}>{t('settingKnowledge.desc')}</Text>
        </Flexbox>

        <Flexbox className={styles.note}>
          <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
            <Tag color={'blue'}>{t('settingKnowledge.scope.agent')}</Tag>
            <Text className={styles.secondaryText}>{t('settingKnowledge.scope.conversation')}</Text>
          </Flexbox>
        </Flexbox>

        <Flexbox horizontal align={'center'} gap={8} justify={'space-between'} wrap={'wrap'}>
          <Flexbox horizontal gap={8} wrap={'wrap'}>
            <Button icon={LibraryBig} type={'primary'} onClick={() => setModalOpen(true)}>
              {t('settingKnowledge.actions.add')}
            </Button>
            <Button icon={FolderSearch2} onClick={() => closeAndNavigate('/resource')}>
              {t('settingKnowledge.actions.manage')}
            </Button>
          </Flexbox>
          <Text type={'secondary'}>{t('settingKnowledge.count', { count: totalCount })}</Text>
        </Flexbox>

        {totalCount === 0 ? (
          <Empty
            description={t('settingKnowledge.emptyDesc')}
            descriptionProps={{ fontSize: 14 }}
            icon={LibraryBig}
          >
            <Button type={'primary'} onClick={() => setModalOpen(true)}>
              {t('settingKnowledge.actions.add')}
            </Button>
          </Empty>
        ) : (
          <Flexbox gap={16}>
            {renderSection(t('settingKnowledge.section.libraries'), libraryItems)}
            {renderSection(t('settingKnowledge.section.files'), fileItems)}
          </Flexbox>
        )}
      </Flexbox>

      <AttachKnowledgeModal open={modalOpen} scope={'agent'} setOpen={setModalOpen} />
    </>
  );
});

AgentKnowledge.displayName = 'AgentKnowledge';

export default AgentKnowledge;
